import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers.mjs';

test('curriculum, assignments, grading and attendance follow cohort roles',async t=>{
 const {ids,query,as,rpc,rejects}=await setup(['admin','tutor','learner','other','outsider']);
 const {admin,tutor,learner,other,outsider}=ids;
 await query('insert into private.staff values($1)',[admin]);
 await as(admin);
 const program=(await query("select id from public.programs where slug='sema'"))[0].id;
 const course=await rpc('save_course',[null,null,{program_id:program,slug:'production',title:'Production'}]);
 const otherCourse=await rpc('save_course',[null,null,{program_id:program,slug:'mixing',title:'Mixing'}]);
 const cohort=await rpc('save_cohort',[null,null,{course_id:course,name:'Intake',status:'active'}]);
 const otherCohort=await rpc('save_cohort',[null,null,{course_id:otherCourse,name:'Other',status:'active'}]);
 await rpc('set_cohort_member',[cohort,tutor,'tutor','active']);
 await rpc('set_cohort_member',[cohort,learner,'learner','active']);
 await rpc('set_cohort_member',[otherCohort,other,'learner','active']);
 let module,assignment,submission,session;

 await t.test('tutors build curriculum for their own course only',async()=>{
  await as(tutor);
  module=await rpc('save_module',[null,null,{course_id:course,title:'Week 1',summary:'Outcomes'}]);
  await rpc('save_material',[null,null,{course_id:course,module_id:module,title:'Reading',kind:'note',body:'Notes'}]);
  await rpc('save_material',[null,null,{course_id:course,module_id:module,title:'Draft',kind:'note',body:'Hidden',published:false}]);
  await rpc('save_material',[null,null,{course_id:course,title:'Stems',kind:'file',file_path:`materials/${course}/stems.zip`,file_name:'stems.zip'}]);
  await rejects(()=>rpc('save_material',[null,null,{course_id:course,title:'Bad',kind:'file',file_path:`materials/${otherCourse}/x.zip`}]),/Invalid file location/);
  await rejects(()=>rpc('save_material',[null,null,{course_id:course,title:'No URL',kind:'link'}]),/check constraint/);
  await rejects(()=>rpc('save_module',[null,null,{course_id:otherCourse,title:'Nope'}]),/Tutor or staff/);
  await rejects(()=>rpc('save_material',[null,null,{course_id:course,module_id:module,title:'x',kind:'note'}]).then(()=>as(learner)).then(()=>rpc('save_module',[null,null,{course_id:course,title:'Learner'}])),/Tutor or staff/);
 });

 await t.test('learners see published materials; outsiders see nothing',async()=>{
  await as(learner);
  assert.equal((await query('select * from public.modules')).length,1);
  assert.deepEqual((await query('select title from public.materials order by title')).map(r=>r.title),['Reading','Stems','x']);
  await as(other);assert.equal((await query('select * from public.materials')).length,0);
  await as(outsider);assert.equal((await query('select * from public.modules')).length,0);
  await as(tutor);assert.equal((await query('select * from public.materials')).length,4);
 });

 await t.test('assignments are hidden until published and accept checked submissions',async()=>{
  await as(tutor);
  assignment=await rpc('save_assignment',[null,null,{cohort_id:cohort,module_id:module,title:'Beat',due_at:'2027-01-20T18:00:00+03:00',max_points:20,submission_type:'any'}]);
  await as(learner);assert.equal((await query('select * from public.assignments')).length,0);
  await rejects(()=>rpc('submit_assignment',[assignment,'hi','','','']),/not available/);
  await as(tutor);const a=(await query('select * from public.assignments'))[0];
  await rpc('save_assignment',[a.id,a.version,{...a,published:true}]);
  await as(learner);
  await rejects(()=>rpc('submit_assignment',[assignment,'','','','']),/Add a file/);
  await rejects(()=>rpc('submit_assignment',[assignment,'','','submissions/x/y/z/f.wav','f.wav']),/Invalid file location/);
  submission=await rpc('submit_assignment',[assignment,'First try','','','']);
  assert.equal(await rpc('submit_assignment',[assignment,'Second try','',`submissions/${cohort}/${assignment}/${learner}/beat.wav`,'beat.wav']),submission);
  await rejects(()=>rpc('grade_submission',[submission,20,'self','graded']),/Tutor or staff/);
  await as(other);assert.equal((await query('select * from public.submissions')).length,0);
  await rejects(()=>rpc('submit_assignment',[assignment,'x','','','']),/not available/);
 });

 await t.test('tutors grade, return for revision and see progress',async()=>{
  await as(tutor);
  await rejects(()=>rpc('grade_submission',[submission,25,'','graded']),/between 0 and 20/);
  await rpc('grade_submission',[submission,null,'Tighten the drums','returned']);
  await as(learner);await rpc('submit_assignment',[assignment,'Revised','','','']);
  await as(tutor);await rpc('grade_submission',[submission,15,'Great work','graded']);
  await as(learner);
  const mine=(await query('select * from public.submissions'))[0];
  assert.equal(mine.status,'graded');assert.equal(Number(mine.score),15);assert.equal(mine.feedback,'Great work');
  await rejects(()=>rpc('submit_assignment',[assignment,'Again','','','']),/graded/);
  await rejects(()=>query('select * from cohort_progress($1)',[cohort]),/Tutor or staff/);
  await as(tutor);await rejects(()=>rpc('delete_assignment',[assignment]),/has submissions/);
 });

 await t.test('attendance is marked by tutors for learners in the cohort',async()=>{
  await as(tutor);
  session=await rpc('save_session',[null,null,{cohort_id:cohort,title:'Studio session',starts_at:'2027-01-12T10:00:00+03:00',ends_at:'2027-01-12T13:00:00+03:00',location:'Studio'}]);
  await rejects(()=>rpc('save_session',[null,null,{cohort_id:cohort,title:'Backwards',starts_at:'2027-01-12T10:00:00+03:00',ends_at:'2027-01-12T09:00:00+03:00'}]),/check constraint/);
  await rejects(()=>rpc('mark_attendance',[session,JSON.stringify([{user_id:other,status:'present'}])]),/Not a learner/);
  await rpc('mark_attendance',[session,JSON.stringify([{user_id:learner,status:'late',note:'Traffic'}])]);
  const [progress]=await query('select * from cohort_progress($1)',[cohort]);
  assert.equal(progress.submitted,1);assert.equal(progress.graded,1);assert.equal(Number(progress.score_percent),75);assert.equal(progress.attended,1);assert.equal(progress.sessions_marked,1);
  await as(learner);
  assert.equal((await query('select * from public.attendance'))[0].status,'late');
  assert.equal((await query('select * from public.class_sessions')).length,1);
  await rejects(()=>rpc('mark_attendance',[session,JSON.stringify([{user_id:learner,status:'present'}])]),/Tutor or staff/);
  await as(other);assert.equal((await query('select * from public.class_sessions')).length,0);
  await as(admin);const overview=await rpc('learning_overview');assert.equal(overview.learners,2);assert.equal(overview.to_grade,0);
  await as(tutor);await rejects(()=>rpc('learning_overview'),/Staff access/);
 });

 await t.test('storage paths follow the same rules',async()=>{
  const can=async(name,write)=>(await query('select public.learning_file_access($1,$2) as ok',[name,write]))[0].ok;
  await as(learner);
  assert.equal(await can(`materials/${course}/stems.zip`,false),true);
  assert.equal(await can(`materials/${course}/new.zip`,true),false);
  assert.equal(await can(`submissions/${cohort}/${assignment}/${learner}/beat.wav`,true),true);
  assert.equal(await can(`submissions/${cohort}/${assignment}/${other}/beat.wav`,false),false);
  assert.equal(await can('submissions/not-a-uuid/x/y/z',false),false);
  await as(tutor);
  assert.equal(await can(`submissions/${cohort}/${assignment}/${learner}/beat.wav`,false),true);
  assert.equal(await can(`submissions/${cohort}/${assignment}/${learner}/beat.wav`,true),false);
  assert.equal(await can(`materials/${course}/new.zip`,true),true);
  await as(other);assert.equal(await can(`materials/${course}/stems.zip`,false),false);
 });
});

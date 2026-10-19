import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers.mjs';

test('staff deletions are top-down and protect learner work',async t=>{
 const {ids,query,as,rpc,rejects}=await setup(['admin','tutor','learner']);
 const {admin,tutor,learner}=ids;
 await query('insert into private.staff values($1)',[admin]);
 await as(admin);
 const program=await rpc('save_program',[null,null,{slug:'temp',name:'Temporary'}]);
 const course=await rpc('save_course',[null,null,{program_id:program,slug:'temp-course',title:'Temp course'}]);
 const empty=await rpc('save_cohort',[null,null,{course_id:course,name:'Created by mistake'}]);
 const busy=await rpc('save_cohort',[null,null,{course_id:course,name:'Real intake',status:'active'}]);
 await rpc('set_cohort_member',[busy,tutor,'tutor','active']);await rpc('set_cohort_member',[busy,learner,'learner','active']);
 await rpc('save_module',[null,null,{course_id:course,title:'Week 1'}]);
 const assignment=await rpc('save_assignment',[null,null,{cohort_id:busy,title:'Beat',published:true}]);
 const session=await rpc('save_session',[null,null,{cohort_id:busy,title:'Class',starts_at:'2027-01-12T10:00:00+03:00',ends_at:'2027-01-12T12:00:00+03:00'}]);
 await rpc('mark_attendance',[session,JSON.stringify([{user_id:learner,status:'present'}])]);
 await as(learner);await rpc('submit_assignment',[assignment,'work','','','']);

 await t.test('only staff can delete',async()=>{
  for(const who of [tutor,learner]){await as(who);
   await rejects(()=>rpc('delete_cohort',[empty,'']),/Staff access/);
   await rejects(()=>rpc('delete_course',[course]),/Staff access/);
   await rejects(()=>rpc('delete_program',[program]),/Staff access/);}
 });
 await t.test('parents with children cannot be deleted',async()=>{
  await as(admin);
  await rejects(()=>rpc('delete_program',[program]),/courses first/);
  await rejects(()=>rpc('delete_course',[course]),/cohorts first/);
 });
 await t.test('cohorts with learner work need their name typed',async()=>{
  await rpc('delete_cohort',[empty,'']);
  await rejects(()=>rpc('delete_cohort',[busy,'']),/Type the cohort name/);
  await rejects(()=>rpc('delete_cohort',[busy,'real intake']),/Type the cohort name/);
  await rpc('delete_cohort',[busy,'Real intake']);
  for(const table of ['cohorts','cohort_members','assignments','submissions','class_sessions','attendance'])assert.equal((await query(`select * from public.${table}`)).length,0,table);
 });
 await t.test('then the course and program can go, and the audit log remembers',async()=>{
  await rpc('delete_course',[course]);
  assert.equal((await query('select * from public.modules')).length,0);
  await rpc('delete_program',[program]);
  assert.equal((await query("select * from public.programs where slug='temp'")).length,0);
  const log=(await query("select action,details from public.audit_log where action like '%_deleted' order by id")).map(r=>r.action);
  assert.deepEqual(log,['cohort_deleted','cohort_deleted','course_deleted','program_deleted']);
 });
});

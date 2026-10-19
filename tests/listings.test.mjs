import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers.mjs';

test('tutor list and public listings',async t=>{
 const {ids,query,as,rpc,rejects}=await setup(['admin','tina','lee']);
 const {admin,tina,lee}=ids;
 await query('insert into private.staff values($1)',[admin]);
 await as(admin);
 const program=(await query("select id from public.programs where slug='instrument-makers-lab'"))[0].id;
 const course=await rpc('save_course',[null,null,{program_id:program,slug:'synth-lab',title:'Synth lab',format:'lab'}]);
 const soon=new Date(Date.now()+20*86400000).toISOString().slice(0,10),past=new Date(Date.now()-20*86400000).toISOString().slice(0,10);
 let listed;

 await t.test('staff manage the tutor list; others cannot see it',async()=>{
  await rpc('set_tutor',[tina,true]);await rpc('set_tutor',[tina,true]);
  assert.deepEqual((await query('select * from list_tutors()')).map(r=>r.email),['tina@example.test']);
  const cohort=await rpc('save_cohort',[null,null,{course_id:course,name:'Staffed',status:'active'}]);
  await rpc('set_cohort_member',[cohort,lee,'tutor','active']);
  const tutors=await query('select * from list_tutors()');
  assert.deepEqual(tutors.map(r=>r.email).sort(),['lee@example.test','tina@example.test'],'assigning a cohort tutor lists them');
  assert.equal(tutors.find(r=>r.user_id===lee).teaching,1);
  await rpc('set_tutor',[lee,false]);
  assert.equal((await query('select * from cohort_members where user_id=$1',[lee]))[0].role,'tutor','unlisting keeps cohort access');
  await as(tina);
  await rejects(()=>query('select * from list_tutors()'),/Staff access/);
  await rejects(()=>rpc('set_tutor',[tina,false]),/Staff access/);
  assert.equal((await query('select * from public.tutors')).length,0);
 });

 await t.test('only listed, unfinished cohorts reach the public page',async()=>{
  await as(admin);
  listed=await rpc('save_cohort',[null,null,{course_id:course,name:'Open lab',starts_on:soon,ends_on:soon,status:'planned',listed:true,blurb:'Build a synth',location:'Santuri',apply_url:'https://example.com/apply',poster_path:'posters/abc/poster.jpg'}]);
  await rpc('save_cohort',[null,null,{course_id:course,name:'Hidden',starts_on:soon,status:'planned'}]);
  await rpc('save_cohort',[null,null,{course_id:course,name:'Finished',starts_on:past,ends_on:past,status:'planned',listed:true}]);
  await rpc('save_cohort',[null,null,{course_id:course,name:'Archived',starts_on:soon,status:'archived',listed:true}]);
  await rejects(()=>rpc('save_cohort',[null,null,{course_id:course,name:'Bad',apply_url:'javascript:alert(1)'}]),/check constraint/);
  await rejects(()=>rpc('save_cohort',[null,null,{course_id:course,name:'Bad',poster_path:'../secret'}]),/check constraint/);
  await as(null,'anon');
  const rows=await query('select * from upcoming_listings()');
  assert.deepEqual(rows.map(r=>r.cohort_name),['Open lab']);
  assert.equal(rows[0].program_name,'Instrument Makers Lab');assert.equal(rows[0].format,'lab');
  await rejects(()=>query('select * from public.cohorts'),/permission denied/);
  await rejects(()=>rpc('list_tutors'),/permission denied/);
 });
});

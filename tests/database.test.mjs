import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers.mjs';

test('learning schema enforces staff administration and cohort privacy',async t=>{
 const {ids,query,as,rpc}=await setup(['admin','tina','alice','bob']);
 await query('insert into private.staff values($1)',[ids.admin]);
 const {admin,tina:tutor,alice,bob}=ids;
 let program,course,cohort,otherCohort;

 await t.test('anonymous visitors and members cannot administer learning',async()=>{
  await as(null,'anon');
  await assert.rejects(()=>query('select * from public.programs'),/permission denied/);
  await assert.rejects(()=>rpc('save_program',[null,null,{slug:'x',name:'X'}]),/permission denied/);
  await as(alice);
  assert.equal((await query('select * from public.programs')).length,2);
  await assert.rejects(()=>rpc('save_program',[null,null,{slug:'x',name:'X'}]),/Staff access/);
  await assert.rejects(()=>query("insert into public.programs(slug,name) values('x','X')"),/permission denied/);
  await assert.rejects(()=>rpc('search_people',['bo']),/Staff access/);
 });

 await t.test('staff build programs, courses and cohorts with stale-edit protection',async()=>{
  await as(admin);
  program=(await query("select * from public.programs where slug='sema'"))[0];
  await rpc('save_program',[program.id,program.version,{...program,summary:'Electronic music'}]);
  await assert.rejects(()=>rpc('save_program',[program.id,program.version,{...program,name:'Lost update'}]),/changed/);
  await assert.rejects(()=>rpc('save_program',[null,null,{slug:'Bad Slug',name:'Bad'}]),/check constraint/);
  course=await rpc('save_course',[null,null,{program_id:program.id,slug:'production-1',title:'Production I',format:'course'}]);
  await assert.rejects(()=>rpc('save_course',[null,null,{program_id:program.id,slug:'x',title:'X',format:'lecture'}]),/check constraint/);
  cohort=await rpc('save_cohort',[null,null,{course_id:course,name:'2027 Intake',starts_on:'2027-01-10',ends_on:'2027-06-30',status:'active'}]);
  otherCohort=await rpc('save_cohort',[null,null,{course_id:course,name:'Other',starts_on:'',ends_on:''}]);
  await assert.rejects(()=>rpc('save_cohort',[null,null,{course_id:course,name:'Backwards',starts_on:'2027-02-01',ends_on:'2027-01-01'}]),/check constraint/);
  assert.deepEqual((await query('select * from search_people($1)',['ali'])).map(p=>p.email),['alice@example.test']);
  assert.equal((await query('select * from search_people($1)',['%%'])).length,0,'wildcards are escaped');
  await assert.rejects(()=>query('select * from search_people($1)',['a']),/two characters/);
  await rpc('set_cohort_member',[cohort,tutor,'tutor','active']);
  await rpc('set_cohort_member',[cohort,alice,'learner','active']);
  await rpc('set_cohort_member',[cohort,bob,'learner','active']);
  await rpc('set_cohort_member',[otherCohort,alice,'tutor','active']);
  await rpc('set_cohort_member',[cohort,bob,'learner','withdrawn']);
  assert.equal((await query('select * from cohort_roster($1)',[cohort])).length,3);
  assert.ok((await query("select * from public.audit_log where action='cohort_member_set'")).length>=5);
 });

 await t.test('learners see only their own cohorts and enrollment rows',async()=>{
  await as(alice);
  const rows=await query('select * from public.cohort_members');
  assert.deepEqual(rows.map(r=>r.role).sort(),['learner','tutor']);
  assert.equal((await query('select * from public.cohorts')).length,2);
  await assert.rejects(()=>query('select * from cohort_roster($1)',[cohort]),/Tutor or staff/);
  await assert.rejects(()=>query("update public.cohort_members set role='tutor'"),/permission denied/);
  await as(bob);
  assert.equal((await query('select * from public.cohorts')).length,0,'withdrawn learners lose cohort visibility');
  assert.equal((await query('select * from public.cohort_members')).length,1);
 });

 await t.test('tutors see their roster but cannot change it',async()=>{
  await as(tutor);
  assert.equal((await query('select * from public.cohort_members')).length,3);
  const roster=await query('select * from cohort_roster($1)',[cohort]);
  assert.equal(roster[0].role,'tutor');assert.ok(roster.some(r=>r.email==='alice@example.test'));
  await assert.rejects(()=>query('select * from cohort_roster($1)',[otherCohort]),/Tutor or staff/);
  await assert.rejects(()=>rpc('set_cohort_member',[cohort,bob,'learner','active']),/Staff access/);
  await as(admin);await rpc('remove_cohort_member',[cohort,bob]);
  await assert.rejects(()=>rpc('remove_cohort_member',[cohort,bob]),/not in this cohort/);
 });
});

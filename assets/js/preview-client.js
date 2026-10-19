// Local design preview: an in-browser stand-in for the Supabase client with sample data.
// Loaded only on 127.0.0.1/localhost with ?preview (see supabase-client.js). Never talks to Supabase.
// It mirrors the database rules closely enough to click through every role; the real rules live in supabase/migrations.
const KEY='santuri-learning-preview-v4';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const people=[
 [1,'Sample Staff','staff@example.test'],[2,'Sample Tutor','tutor@example.test'],[3,'Sample Learner','learner@example.test'],
 [4,'Amani Example','amani@example.test'],[5,'Wanjiru Example','wanjiru@example.test'],[6,'Otieno Example','otieno@example.test'],[7,'Zawadi Example','zawadi@example.test']
].map(([n,full_name,email])=>({id:id(n),full_name,email,phone:'',alumni:false}));
const at=(days,hour=10)=>{const d=new Date(Date.now()+days*86400000);d.setUTCHours(hour-3,0,0,0);return d.toISOString();};
const today=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
function seed(){
 const A=id(301),course=id(201);
 return {
 programs:[
  {id:id(101),slug:'sema',name:'SEMA',summary:'',active:true,sort_order:1,version:1},
  {id:id(102),slug:'instrument-makers-lab',name:'Instrument Makers Lab',summary:'',active:true,sort_order:2,version:1}],
 courses:[
  {id:course,program_id:id(101),slug:'sample-production-course',title:'Sample production course',summary:'Placeholder course description. Replace it with the real course overview, who it is for and what learners will make.',format:'course',active:true,sort_order:0,version:1},
  {id:id(202),program_id:id(101),slug:'sample-dj-masterclass',title:'Sample DJ masterclass',summary:'',format:'masterclass',active:true,sort_order:1,version:1},
  {id:id(203),program_id:id(102),slug:'sample-build-workshop',title:'Sample build workshop',summary:'Placeholder description for a hands-on workshop.',format:'workshop',active:true,sort_order:0,version:1},
  {id:id(204),program_id:id(102),slug:'sample-synth-lab',title:'Sample synth lab',summary:'Placeholder description for a lab.',format:'lab',active:true,sort_order:1,version:1}],
 cohorts:[
  {id:A,course_id:course,name:'Sample intake A',starts_on:today(-35),ends_on:today(120),status:'active',version:1},
  {id:id(302),course_id:id(202),name:'Sample session',starts_on:today(30),ends_on:today(30),status:'planned',version:1,listed:true,location:'Sample location',blurb:'Placeholder poster text: one or two lines about the masterclass.',apply_url:'https://example.com/register'},
  {id:id(303),course_id:id(203),name:'Sample weekend',starts_on:today(26),ends_on:today(27),status:'planned',version:1,listed:true,location:'Sample location'},
  {id:id(304),course_id:id(204),name:'Sample evening lab',starts_on:today(45),ends_on:today(66),status:'planned',version:1,listed:true,blurb:'Placeholder poster text for a multi-week lab.'},
  {id:id(305),course_id:course,name:'Sample intake B',starts_on:today(110),ends_on:null,status:'planned',version:1,listed:true},
  {id:id(306),course_id:id(203),name:'Sample past weekend',starts_on:today(-60),ends_on:today(-59),status:'completed',version:1,listed:true,location:'Sample location',blurb:'Placeholder text for a finished workshop.'},
  {id:id(307),course_id:id(202),name:'Sample past session',starts_on:today(-20),ends_on:today(-20),status:'completed',version:1,listed:true}].map(h=>({listed:false,blurb:'',location:'',apply_url:'',poster_path:'',...h})),
 tutors:[id(1),id(2),id(6)].map(user_id=>({user_id,added_at:at(-60)})),
 members:[[301,2,'tutor'],[301,3,'learner'],[301,4,'learner'],[301,5,'learner'],[302,1,'tutor'],[302,3,'learner'],[303,2,'tutor'],[303,6,'learner'],[303,7,'learner']]
  .map(([c,u,role])=>({cohort_id:id(c),user_id:id(u),role,status:'active',added_at:at(-40)})),
 modules:[
  {id:id(401),course_id:course,title:'Module 1 · Sample topic',summary:'Placeholder learning outcomes:\n• Outcome one\n• Outcome two',sort_order:0,version:1},
  {id:id(402),course_id:course,title:'Module 2 · Sample topic',summary:'Placeholder summary for the second module.',sort_order:1,version:1},
  {id:id(403),course_id:course,title:'Module 3 · Sample topic',summary:'',sort_order:2,version:1}],
 materials:[
  {id:id(501),course_id:course,module_id:id(401),title:'Sample reading',kind:'note',body:'This is placeholder reading text.\n\nTutors can write notes, lesson plans or reading directly in the portal.',url:'',file_path:'',file_name:'',published:true,sort_order:0,version:1},
  {id:id(502),course_id:course,module_id:id(401),title:'Sample video link',kind:'link',body:'Links can point to videos, articles or playlists.',url:'https://example.com/',file_path:'',file_name:'',published:true,sort_order:1,version:1},
  {id:id(503),course_id:course,module_id:id(402),title:'Sample stems pack',kind:'file',body:'Files can be audio, PDFs or project files.',url:'',file_path:`materials/${course}/sample-stems.txt`,file_name:'sample-stems.zip',published:true,sort_order:0,version:1},
  {id:id(504),course_id:course,module_id:id(403),title:'Draft material (hidden from learners)',kind:'note',body:'Tutors see drafts; learners don’t.',url:'',file_path:'',file_name:'',published:false,sort_order:0,version:1},
  {id:id(505),course_id:course,module_id:null,title:'Sample course handbook',kind:'note',body:'Placeholder for general course information.',url:'',file_path:'',file_name:'',published:true,sort_order:0,version:1}],
 assignments:[
  {id:id(601),cohort_id:A,module_id:id(401),title:'Sample assignment 1',instructions:'Placeholder instructions for a graded assignment.',due_at:at(-14,18),max_points:20,submission_type:'any',published:true,version:1},
  {id:id(602),cohort_id:A,module_id:id(402),title:'Sample assignment 2',instructions:'Placeholder instructions. Submit a file or a link.',due_at:at(-2,18),max_points:20,submission_type:'any',published:true,version:1},
  {id:id(603),cohort_id:A,module_id:id(402),title:'Sample assignment 3',instructions:'Placeholder instructions for an upcoming assignment.',due_at:at(5,18),max_points:10,submission_type:'any',published:true,version:1},
  {id:id(604),cohort_id:A,module_id:id(403),title:'Sample reflection (feedback only)',instructions:'Placeholder: a short written reflection.',due_at:at(12,18),max_points:null,submission_type:'text',published:true,version:1},
  {id:id(605),cohort_id:A,module_id:id(403),title:'Draft assignment',instructions:'Not yet published.',due_at:null,max_points:20,submission_type:'any',published:false,version:1}],
 submissions:[
  {id:id(701),assignment_id:id(601),cohort_id:A,user_id:id(3),body:'Sample submission text.',url:'https://example.com/track',file_path:'',file_name:'',status:'graded',score:16,feedback:'Placeholder tutor feedback: what worked and what to try next.',graded_at:at(-10),submitted_at:at(-15)},
  {id:id(702),assignment_id:id(601),cohort_id:A,user_id:id(4),body:'',url:'',file_path:`submissions/${A}/${id(601)}/${id(4)}/sample.txt`,file_name:'sample-track.wav',status:'graded',score:18,feedback:'Placeholder feedback.',graded_at:at(-10),submitted_at:at(-14,17)},
  {id:id(703),assignment_id:id(601),cohort_id:A,user_id:id(5),body:'Sample text.',url:'',file_path:'',file_name:'',status:'returned',score:null,feedback:'Placeholder: please revise and resubmit.',graded_at:at(-9),submitted_at:at(-13)},
  {id:id(704),assignment_id:id(602),cohort_id:A,user_id:id(3),body:'',url:'https://example.com/sample',file_path:'',file_name:'',status:'submitted',score:null,feedback:'',graded_at:null,submitted_at:at(-1,9)},
  {id:id(705),assignment_id:id(602),cohort_id:A,user_id:id(4),body:'Sample text.',url:'',file_path:'',file_name:'',status:'submitted',score:null,feedback:'',graded_at:null,submitted_at:at(-3)}],
 sessions:[
  {id:id(801),cohort_id:A,title:'Sample session 1',starts_at:at(-14,10),ends_at:at(-14,13),location:'Classroom',notes:'',version:1},
  {id:id(802),cohort_id:A,title:'Sample session 2',starts_at:at(-7,10),ends_at:at(-7,13),location:'Studio',notes:'',version:1},
  {id:id(803),cohort_id:A,title:'Sample session 3',starts_at:at(-0.9,10),ends_at:at(-0.9,13),location:'Classroom',notes:'',version:1},
  {id:id(804),cohort_id:A,title:'Sample session 4',starts_at:at(2,10),ends_at:at(2,13),location:'Studio',notes:'Placeholder note for learners.',version:1},
  {id:id(805),cohort_id:A,title:'Sample session 5',starts_at:at(9,10),ends_at:at(9,13),location:'Classroom',notes:'',version:1}],
 attendance:[[801,3,'present'],[801,4,'present'],[801,5,'late'],[802,3,'absent'],[802,4,'present'],[802,5,'excused']]
  .map(([s,u,status])=>({session_id:id(s),cohort_id:A,user_id:id(u),status,note:'',marked_at:at(-7)})),
 persona:'staff'};
}
let state;try{state=JSON.parse(sessionStorage.getItem(KEY))||seed();}catch{state=seed();}
const save=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(state));}catch{}};
const personas={staff:id(1),tutor:id(2),learner:id(3)};
const me=()=>personas[state.persona]||null;
const fail=message=>({data:null,error:{message}});
const staff=()=>state.persona==='staff';
const requireStaff=()=>{if(!staff())throw Error('Staff access required');};
const program=pid=>state.programs.find(p=>p.id===pid);
const course=cid=>{const c=state.courses.find(x=>x.id===cid);return c&&{...c,programs:program(c.program_id)};};
const cohort=hid=>{const h=state.cohorts.find(x=>x.id===hid);return h&&{...h,courses:course(h.course_id)};};
const roleIn=hid=>state.members.find(m=>m.cohort_id===hid&&m.user_id===me()&&m.status!=='withdrawn')?.role??null;
const teachCohort=hid=>staff()||roleIn(hid)==='tutor';
const courseOf=hid=>state.cohorts.find(h=>h.id===hid)?.course_id;
const teachCourse=cid=>staff()||state.cohorts.some(h=>h.course_id===cid&&roleIn(h.id)==='tutor');
const inCourse=cid=>staff()||state.cohorts.some(h=>h.course_id===cid&&roleIn(h.id));
const activeLearner=hid=>state.members.some(m=>m.cohort_id===hid&&m.user_id===me()&&m.role==='learner'&&m.status==='active');
const slugOk=s=>/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s||'');
const guard=(ok,text='Tutor or staff access required')=>{if(!ok)throw Error(text);};
function upsert(list,pid,version,row,what){
 if(pid){const cur=list.find(x=>x.id===pid);if(!cur||cur.version!==version)throw Error(`This ${what} changed. Reload before saving.`);Object.assign(cur,row,{version:cur.version+1});return pid;}
 const nid=crypto.randomUUID();list.push({...row,id:nid,version:1});return nid;
}
const sessionCohort=sid=>state.sessions.find(s=>s.id===sid)?.cohort_id;
// Visible rows per table, mirroring the database's row-level security.
function rows(table){
 const uid=me();
 switch(table){
  case 'profiles':return people.filter(p=>staff()||p.id===uid);
  case 'programs':return state.programs.filter(p=>p.active||staff());
  case 'courses':return state.courses.filter(c=>c.active||staff()).map(c=>course(c.id));
  case 'cohorts':return state.cohorts.filter(h=>staff()||roleIn(h.id)).map(h=>cohort(h.id));
  case 'cohort_members':return state.members.filter(m=>m.user_id===uid||staff()||roleIn(m.cohort_id)==='tutor').map(m=>({...m,cohorts:cohort(m.cohort_id)}));
  case 'modules':return state.modules.filter(m=>inCourse(m.course_id));
  case 'materials':return state.materials.filter(m=>teachCourse(m.course_id)||(m.published&&inCourse(m.course_id)));
  case 'assignments':return state.assignments.filter(a=>teachCohort(a.cohort_id)||(a.published&&roleIn(a.cohort_id)==='learner'));
  case 'submissions':return state.submissions.filter(s=>s.user_id===uid||teachCohort(s.cohort_id));
  case 'class_sessions':return state.sessions.filter(s=>teachCohort(s.cohort_id)||roleIn(s.cohort_id));
  case 'attendance':return state.attendance.filter(a=>a.user_id===uid||teachCohort(a.cohort_id));
 }
 return [];
}
function query(table){
 const filters=[],orders=[];let single=false,limit=Infinity;
 const q={select:()=>q,eq:(c,v)=>(filters.push(r=>r[c]===v),q),neq:(c,v)=>(filters.push(r=>r[c]!==v),q),gte:(c,v)=>(filters.push(r=>String(r[c])>=String(v)),q),
  order:(c,o={})=>(orders.push([c,o.ascending!==false]),q),limit:n=>(limit=n,q),single:()=>(single=true,q),
  then(resolve,reject){
   let data=rows(table).filter(r=>filters.every(f=>f(r)));
   // Postgres sorts nulls last in ascending order.
   for(const [c,asc] of [...orders].reverse())data=[...data].sort((a,b)=>a[c]==null?(b[c]==null?0:1):b[c]==null?-1:String(a[c]).localeCompare(String(b[c]),undefined,{numeric:true})*(asc?1:-1));
   data=data.slice(0,limit);
   return Promise.resolve(single?(data.length===1?{data:data[0],error:null}:fail('Row not found')):{data:structuredClone(data),error:null}).then(resolve,reject);
  }};
 return q;
}
const roster=hid=>state.members.filter(m=>m.cohort_id===hid).map(m=>{const p=people.find(x=>x.id===m.user_id);return {...m,full_name:p.full_name,email:p.email};}).sort((a,b)=>b.role.localeCompare(a.role)||a.full_name.localeCompare(b.full_name));
const weekStart=()=>{const d=new Date(Date.now()+3*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.getTime()-3*3600000;};
const nairobiToday=()=>new Date(Date.now()+3*3600000).toISOString().slice(0,10);
// Public listing rows, mirroring upcoming_listings() and past_listings() in the database.
const listings=(keep,order)=>state.cohorts.filter(h=>h.listed&&keep(h)).sort(order).map(h=>({h,c:course(h.course_id)})).filter(({c})=>c.active&&c.programs.active)
 .map(({h,c})=>({cohort_id:h.id,cohort_name:h.name,starts_on:h.starts_on,ends_on:h.ends_on,status:h.status,blurb:h.blurb,location:h.location,apply_url:h.apply_url,poster_path:h.poster_path,course_title:c.title,course_summary:c.summary,format:c.format,program_name:c.programs.name,program_slug:c.programs.slug}));
const rpcs={
 is_staff:()=>staff(),
 my_cohort_role:({p_cohort})=>roleIn(p_cohort),
 save_program:({p_id,p_version,p_data:d})=>{requireStaff();guard(slugOk(d.slug),'Use lowercase letters, numbers and hyphens for the slug');
  return upsert(state.programs,p_id,p_version,{slug:d.slug,name:d.name.trim(),summary:(d.summary||'').trim(),active:d.active??true,sort_order:d.sort_order||0},'program');},
 save_course:({p_id,p_version,p_data:d})=>{requireStaff();guard(slugOk(d.slug),'Use lowercase letters, numbers and hyphens for the slug');
  return upsert(state.courses,p_id,p_version,{program_id:d.program_id,slug:d.slug,title:d.title.trim(),summary:(d.summary||'').trim(),format:d.format,active:d.active??true,sort_order:d.sort_order||0},'course');},
 save_cohort:({p_id,p_version,p_data:d})=>{requireStaff();guard(!(d.starts_on&&d.ends_on&&d.ends_on<d.starts_on),'The end date must be on or after the start date');guard(!d.apply_url||/^https?:\/\//.test(d.apply_url),'Registration link must start with https://');
  return upsert(state.cohorts,p_id,p_version,{course_id:d.course_id,name:d.name.trim(),starts_on:d.starts_on||null,ends_on:d.ends_on||null,status:d.status,listed:!!d.listed,location:(d.location||'').trim(),apply_url:(d.apply_url||'').trim(),blurb:(d.blurb||'').trim(),poster_path:d.poster_path||''},'cohort');},
 set_tutor:({p_user,p_tutor})=>{requireStaff();state.tutors=state.tutors.filter(t=>t.user_id!==p_user);if(p_tutor)state.tutors.push({user_id:p_user,added_at:new Date().toISOString()});},
 list_tutors:()=>{requireStaff();return state.tutors.map(t=>{const p=people.find(x=>x.id===t.user_id);return {user_id:t.user_id,full_name:p.full_name,email:p.email,added_at:t.added_at,
  teaching:state.members.filter(m=>m.user_id===t.user_id&&m.role==='tutor'&&m.status==='active'&&['planned','active'].includes(state.cohorts.find(h=>h.id===m.cohort_id)?.status)).length};}).sort((a,b)=>a.full_name.localeCompare(b.full_name));},
 upcoming_listings:()=>listings(h=>['planned','active'].includes(h.status)&&(!h.ends_on||h.ends_on>=nairobiToday()),(a,b)=>(a.starts_on||'9').localeCompare(b.starts_on||'9')),
 past_listings:()=>listings(h=>h.status!=='archived'&&(h.status==='completed'||(h.ends_on&&h.ends_on<nairobiToday())),(a,b)=>(b.ends_on||b.starts_on||'').localeCompare(a.ends_on||a.starts_on||'')).slice(0,60),
 set_cohort_member:({p_cohort,p_user,p_role,p_status})=>{requireStaff();const m=state.members.find(x=>x.cohort_id===p_cohort&&x.user_id===p_user);
  if(m)Object.assign(m,{role:p_role,status:p_status});else state.members.push({cohort_id:p_cohort,user_id:p_user,role:p_role,status:p_status||'active',added_at:new Date().toISOString()});
  if(p_role==='tutor'&&!state.tutors.some(t=>t.user_id===p_user))state.tutors.push({user_id:p_user,added_at:new Date().toISOString()});},
 remove_cohort_member:({p_cohort,p_user})=>{requireStaff();const n=state.members.length;state.members=state.members.filter(m=>!(m.cohort_id===p_cohort&&m.user_id===p_user));guard(n!==state.members.length,'Member is not in this cohort');},
 cohort_roster:({p_cohort})=>{guard(teachCohort(p_cohort));return roster(p_cohort);},
 search_people:({p_query})=>{requireStaff();const q=(p_query||'').trim().toLowerCase();guard(q.length>=2,'Type at least two characters');
  return people.filter(p=>p.full_name.toLowerCase().includes(q)||p.email.includes(q)).map(({id,full_name,email})=>({id,full_name,email}));},
 learning_overview:()=>{requireStaff();const current=new Set(state.cohorts.filter(h=>['planned','active'].includes(h.status)).map(h=>h.id)),distinct=role=>new Set(state.members.filter(m=>m.role===role&&m.status==='active'&&current.has(m.cohort_id)).map(m=>m.user_id)).size,ws=weekStart();
  return {programs:state.programs.filter(p=>p.active).length,courses:state.courses.filter(c=>c.active).length,active_cohorts:state.cohorts.filter(h=>h.status==='active').length,learners:distinct('learner'),tutors:distinct('tutor'),to_grade:state.submissions.filter(s=>s.status==='submitted').length,sessions_this_week:state.sessions.filter(s=>{const t=new Date(s.starts_at).getTime();return t>=ws&&t<ws+7*86400000;}).length};},
 save_module:({p_id,p_version,p_data:d})=>{const cid=p_id?state.modules.find(m=>m.id===p_id)?.course_id:d.course_id;guard(teachCourse(cid));
  return upsert(state.modules,p_id,p_version,{course_id:cid,title:d.title.trim(),summary:(d.summary||'').trim(),sort_order:d.sort_order||0},'module');},
 delete_module:({p_id})=>{const m=state.modules.find(x=>x.id===p_id);guard(m&&teachCourse(m.course_id));state.modules=state.modules.filter(x=>x.id!==p_id);
  for(const list of [state.materials,state.assignments])for(const x of list)if(x.module_id===p_id)x.module_id=null;},
 save_material:({p_id,p_version,p_data:d})=>{const cid=p_id?state.materials.find(m=>m.id===p_id)?.course_id:d.course_id;guard(teachCourse(cid));
  guard(d.kind!=='link'||/^https?:\/\//.test(d.url||''),'Add a link starting with https://');
  return upsert(state.materials,p_id,p_version,{course_id:cid,module_id:d.module_id||null,title:d.title.trim(),kind:d.kind,body:d.body||'',url:d.url||'',file_path:d.file_path||'',file_name:d.file_name||'',published:d.published??true,sort_order:d.sort_order||0},'material');},
 delete_material:({p_id})=>{const m=state.materials.find(x=>x.id===p_id);guard(m&&teachCourse(m.course_id));state.materials=state.materials.filter(x=>x.id!==p_id);},
 save_assignment:({p_id,p_version,p_data:d})=>{const hid=p_id?state.assignments.find(a=>a.id===p_id)?.cohort_id:d.cohort_id;guard(teachCohort(hid));
  const max=d.max_points===''||d.max_points==null?null:Number(d.max_points);guard(max===null||(max>=1&&max<=1000),'Points must be between 1 and 1000');
  return upsert(state.assignments,p_id,p_version,{cohort_id:hid,module_id:d.module_id||null,title:d.title.trim(),instructions:d.instructions||'',due_at:d.due_at||null,max_points:max,submission_type:d.submission_type||'any',published:d.published??false},'assignment');},
 delete_assignment:({p_id})=>{const a=state.assignments.find(x=>x.id===p_id);guard(a&&teachCohort(a.cohort_id));guard(!state.submissions.some(s=>s.assignment_id===p_id),'This assignment has submissions. Unpublish it instead.');state.assignments=state.assignments.filter(x=>x.id!==p_id);},
 submit_assignment:({p_assignment,p_body,p_url,p_file_path,p_file_name})=>{
  const a=state.assignments.find(x=>x.id===p_assignment),body=(p_body||'').trim(),url=(p_url||'').trim(),path=p_file_path||'';
  guard(a&&a.published&&activeLearner(a.cohort_id),'Assignment not available');
  guard(!(a.submission_type==='file'&&!path),'Attach a file');guard(!(a.submission_type==='link'&&!url),'Add a link');guard(!(a.submission_type==='text'&&!body),'Write your response');guard(body||url||path,'Add a file, link or response');
  const prior=state.submissions.find(s=>s.assignment_id===a.id&&s.user_id===me());guard(prior?.status!=='graded','This assignment has been graded. Ask your tutor to reopen it.');
  const row={body,url,file_path:path,file_name:p_file_name||'',status:'submitted',score:null,graded_at:null,submitted_at:new Date().toISOString()};
  if(prior){Object.assign(prior,row);return prior.id;}const sid=crypto.randomUUID();state.submissions.push({...row,id:sid,assignment_id:a.id,cohort_id:a.cohort_id,user_id:me(),feedback:''});return sid;},
 grade_submission:({p_submission,p_score,p_feedback,p_status})=>{const s=state.submissions.find(x=>x.id===p_submission);guard(s&&teachCohort(s.cohort_id));
  const max=state.assignments.find(a=>a.id===s.assignment_id)?.max_points;
  guard(!(max&&p_status==='graded'&&(p_score==null||p_score<0||p_score>max)),`Enter a score between 0 and ${max}`);
  Object.assign(s,{status:p_status,score:p_status==='graded'?p_score:null,feedback:p_feedback||'',graded_at:new Date().toISOString()});},
 save_session:({p_id,p_version,p_data:d})=>{const hid=p_id?sessionCohort(p_id):d.cohort_id;guard(teachCohort(hid));guard(d.ends_at>d.starts_at,'The session must end after it starts');
  return upsert(state.sessions,p_id,p_version,{cohort_id:hid,title:d.title.trim(),starts_at:new Date(d.starts_at).toISOString(),ends_at:new Date(d.ends_at).toISOString(),location:(d.location||'').trim(),notes:d.notes||''},'session');},
 delete_session:({p_id})=>{guard(teachCohort(sessionCohort(p_id)));state.sessions=state.sessions.filter(s=>s.id!==p_id);state.attendance=state.attendance.filter(a=>a.session_id!==p_id);},
 mark_attendance:({p_session,p_records})=>{const hid=sessionCohort(p_session);guard(hid&&teachCohort(hid));
  for(const r of p_records){const row=state.attendance.find(a=>a.session_id===p_session&&a.user_id===r.user_id);if(row)Object.assign(row,{status:r.status,note:r.note||''});else state.attendance.push({session_id:p_session,cohort_id:hid,user_id:r.user_id,status:r.status,note:r.note||'',marked_at:new Date().toISOString()});}},
 cohort_progress:({p_cohort})=>{guard(teachCohort(p_cohort));const assigns=state.assignments.filter(a=>a.cohort_id===p_cohort&&a.published);
  return roster(p_cohort).filter(r=>r.role==='learner').map(r=>{const subs=state.submissions.filter(s=>s.cohort_id===p_cohort&&s.user_id===r.user_id),graded=subs.filter(s=>s.status==='graded'),scored=graded.map(s=>[s,state.assignments.find(a=>a.id===s.assignment_id)]).filter(([,a])=>a?.max_points),marks=state.attendance.filter(a=>a.cohort_id===p_cohort&&a.user_id===r.user_id);
   return {user_id:r.user_id,full_name:r.full_name,email:r.email,status:r.status,assignments:assigns.length,submitted:subs.length,graded:graded.length,score_percent:scored.length?Math.round(scored.reduce((n,[s,a])=>n+s.score/a.max_points*100,0)/scored.length*10)/10:null,sessions_marked:marks.filter(m=>m.status!=='excused').length,attended:marks.filter(m=>['present','late'].includes(m.status)).length};});}
};
// Uploaded files stay in this tab's memory; sample files open as a placeholder.
const files=new Map();
const missingPoster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#ddd"/><text x="200" y="255" font-family="monospace" font-size="16" text-anchor="middle">Poster uploaded in an earlier tab</text></svg>');
const storage={from:()=>({
 getPublicUrl:path=>({data:{publicUrl:files.get(path)||missingPoster}}),
 upload:(path,file)=>{files.set(path,URL.createObjectURL(file));return Promise.resolve({data:{path},error:null});},
 createSignedUrl:path=>Promise.resolve({data:{signedUrl:files.get(path)||URL.createObjectURL(new Blob([`Preview placeholder for ${path.split('/').pop()}.\nReal files open from Supabase Storage.`],{type:'text/plain'}))},error:null}),
 remove:()=>Promise.resolve({data:[],error:null})})};
const user=()=>me()&&{id:me(),email:people.find(p=>p.id===me()).email};
const signedIn=()=>Promise.resolve({data:{user:user(),session:me()?{user:user()}:null},error:null});
function setPersona(persona){state.persona=persona;save();location.assign(persona==='out'?'index.html':'dashboard.html');}
export function createClient(){
 return {
  from:query,storage,
  rpc:(name,args={})=>{try{const data=rpcs[name](args);save();return Promise.resolve({data:structuredClone(data??null),error:null});}catch(err){return Promise.resolve(fail(err.message));}},
  auth:{getSession:signedIn,getUser:signedIn,onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
   signOut:()=>{state.persona='out';save();return Promise.resolve({error:null});},
   signInWithPassword:()=>{state.persona='staff';save();return Promise.resolve({data:{},error:null});},
   signUp:()=>Promise.resolve(fail('Preview mode: account creation is disabled.')),
   resetPasswordForEmail:()=>Promise.resolve({data:{},error:null}),
   updateUser:()=>Promise.resolve({data:{},error:null})}
 };
}

const bar=document.createElement('div');bar.className='preview-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Preview controls');
bar.innerHTML=`<strong>Preview · sample data only</strong><span>View as</span>${[['staff','Staff / admin'],['tutor','Tutor'],['learner','Learner'],['out','Signed out']].map(([p,l])=>`<button type="button" data-persona="${p}" aria-pressed="${state.persona===p}">${l}</button>`).join('')}<button type="button" data-reset>Reset data</button><a href="?preview=0">Exit preview</a>`;
document.body.append(bar);
bar.querySelectorAll('[data-persona]').forEach(b=>b.onclick=()=>setPersona(b.dataset.persona));
bar.querySelector('[data-reset]').onclick=()=>{try{sessionStorage.removeItem(KEY);}catch{}location.reload();};

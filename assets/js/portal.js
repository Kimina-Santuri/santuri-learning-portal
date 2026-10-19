import {result} from './supabase-client.js';
import {escapeHTML as e,slugify,dateRange,label,when,safeFileName,FORMATS,COHORT_STATUSES,MEMBER_STATUSES,ROLES} from './portal-utils.js';
import {app,page,support,field,area,select,options,check,empty,action,stat,tabs,message,run,bindForm,modal,session,rpc,rows,startSession,fail} from './ui.js';
let adminTab='overview',cohortFilter='',openCohort=null;
const db=()=>session.db;
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
const workspace=id=>`cohort.html?id=${encodeURIComponent(id)}`;

async function start(){
 if(!await startSession({allowSignedOut:page==='signin'||page==='reset-password'}))return;
 if(page==='reset-password'){renderReset();return;}
 if(page==='signin'){if(session.user)location.replace('dashboard.html');else renderAuth();return;}
 if(page==='admin'){if(!session.staff){app.innerHTML=empty('Staff access required.','Learning administration is available to authorised Santuri staff.',action('dashboard.html','Back to my learning'));return;}await renderAdmin();}
 else await renderDashboard();
}

// Sign-in uses the same Supabase Auth accounts as bookings.santuri.org.
function renderAuth(mode='signin'){
 const registering=mode==='register',forgot=mode==='forgot';
 app.innerHTML=`<div class="auth-layout"><section class="panel"><div class="tabs" role="group" aria-label="Account access"><button data-mode="signin" aria-pressed="${mode==='signin'}">Sign in</button><button data-mode="register" aria-pressed="${registering}">Create account</button></div><h2>${forgot?'Reset your password':registering?'Create your Santuri account':'Sign in to Santuri Learning'}</h2><form id="auth-form" class="form-grid">${registering?`<div class="full">${field('Full name','full_name','text','','required maxlength="150" autocomplete="name"')}</div><div class="full">${field('Phone number','phone','tel','','required maxlength="30" autocomplete="tel"')}</div>`:''}<div class="full">${field('Email address','email','email','','required autocomplete="email"')}</div>${!forgot?`<div class="full">${field('Password','password','password','','required minlength="12" autocomplete="'+(registering?'new-password':'current-password')+'"')}</div>`:''}${registering?'<label class="check-field full"><input type="checkbox" required> I have read the <a href="https://bookings.santuri.org/privacy.html">privacy information</a>.</label>':''}<div class="actions full"><button class="button" type="submit">${forgot?'Send reset link':registering?'Create account':'Sign in'} ↗</button><button class="text-button" type="button" data-mode="${forgot?'signin':'forgot'}">${forgot?'Back to sign in':'Forgot password?'}</button></div></form></section><aside class="auth-aside"><p class="eyebrow">One Santuri account</p><h2>Already book<br>spaces with us?</h2><p>Sign in with the same email and password you use for Santuri bookings. Your courses appear once the team enrolls you.</p></aside></div>`;
 app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{message('');renderAuth(b.dataset.mode);});
 bindForm('#auth-form',async f=>{
  const email=f.get('email').trim();
  if(forgot){await result(db().auth.resetPasswordForEmail(email,{redirectTo:new URL('reset-password.html',location.href).href}));message('If an account exists for this address, a password reset link will arrive shortly.');return;}
  if(registering){const data=await result(db().auth.signUp({email,password:f.get('password'),options:{data:{full_name:f.get('full_name').trim(),phone:f.get('phone').trim()},emailRedirectTo:new URL('dashboard.html',location.href).href}}));if(data.session)location.assign('dashboard.html');else message('Check your email to confirm your account. Open the link in this browser.');}
  else{await result(db().auth.signInWithPassword({email,password:f.get('password')}));location.assign('dashboard.html');}
 });
}
function renderReset(){
 if(!session.user){app.innerHTML=empty('Open your password reset link.','Request a fresh link from the sign-in page, then open it in the same browser.',action('signin.html','Go to sign in'));return;}
 app.innerHTML=`<section class="panel"><form id="reset-form" class="form-grid">${field('New password','password','password','','required minlength="12" autocomplete="new-password"')}${field('Confirm new password','confirmation','password','','required minlength="12" autocomplete="new-password"')}<div class="full"><button class="button">Save new password</button></div></form></section>`;
 bindForm('#reset-form',async f=>{if(f.get('password')!==f.get('confirmation'))throw Error('Passwords do not match.');await result(db().auth.updateUser({password:f.get('password')}));await result(db().auth.signOut());app.innerHTML=empty('Password updated.','Sign in with your new password.',action('signin.html','Sign in'));});
}

async function renderDashboard(){
 const uid=session.user.id,now=new Date().toISOString();
 const [memberships,assignments,submissions,sessions]=await Promise.all([
  rows(db().from('cohort_members').select('role,status,cohort_id,cohorts(id,name,starts_on,ends_on,status,courses(title,format,summary,programs(name)))').eq('user_id',uid).neq('status','withdrawn')),
  rows(db().from('assignments').select('id,cohort_id,title,due_at,published')),
  rows(db().from('submissions').select('assignment_id,cohort_id,user_id,status')),
  rows(db().from('class_sessions').select('id,cohort_id,title,starts_at,ends_at,location').gte('ends_at',now).order('starts_at').limit(5))]);
 const visible=memberships.filter(r=>r.cohorts&&r.cohorts.status!=='archived'),teaching=visible.filter(r=>r.role==='tutor'),learning=visible.filter(r=>r.role==='learner');
 if(!visible.length){app.innerHTML=empty('No courses yet.',`Once the Santuri team enrolls you in a program, it will appear here. Questions? Email ${e(support)}.`,session.staff?action('admin.html','Open admin ↗'):'');return;}
 const mine=new Set(submissions.filter(s=>s.user_id===uid).map(s=>s.assignment_id));
 const todo=learning.flatMap(r=>assignments.filter(a=>a.cohort_id===r.cohort_id&&a.published&&!mine.has(a.id))).sort((a,b)=>(a.due_at||'9').localeCompare(b.due_at||'9'));
 const toGrade=id=>submissions.filter(s=>s.cohort_id===id&&s.status==='submitted').length;
 const cohortName=id=>visible.find(r=>r.cohort_id===id)?.cohorts;
 const card=r=>{const c=r.cohorts,course=c.courses,due=todo.filter(a=>a.cohort_id===c.id).length,grade=r.role==='tutor'?toGrade(c.id):0;
  return `<a class="booking-card learning-card" href="${workspace(c.id)}"><div><p class="eyebrow">${e(course?.programs?.name||'Santuri')} · ${e(label(FORMATS,course?.format||'course'))}</p><h3>${e(course?.title||'Course')}</h3><p>${e(c.name)}${dateRange(c.starts_on,c.ends_on)?' · '+e(dateRange(c.starts_on,c.ends_on)):''}</p>${r.role==='learner'&&due?`<p class="hint">${due} assignment${due===1?'':'s'} to submit</p>`:''}${grade?`<p class="hint">${grade} submission${grade===1?'':'s'} to grade</p>`:''}</div><div class="learning-badges"><span class="badge ${r.role==='tutor'?'solid':''}">${e(label(ROLES,r.role))}</span><span class="badge">${e(label(COHORT_STATUSES,c.status))}</span>${r.status==='completed'?'<span class="badge">Completed</span>':''}<span class="open-arrow" aria-hidden="true">↗</span></div></a>`;};
 app.innerHTML=`<div class="stats">${stat('Learning',learning.length,learning.length===1?'course':'courses')}${stat('To submit',todo.length,todo[0]?.due_at?'Next due '+e(when(todo[0].due_at)):'No deadlines pending')}${teaching.length?stat('To grade',teaching.reduce((n,r)=>n+toGrade(r.cohort_id),0),`Across ${teaching.length} cohort${teaching.length===1?'':'s'} you teach`):stat('Next session',sessions[0]?e(when(sessions[0].starts_at)):'—',sessions[0]?e(sessions[0].title):'Nothing scheduled')}</div>
 ${learning.length?`<section class="panel"><h2>Learning</h2>${learning.map(card).join('')}</section>`:''}${teaching.length?`<section class="panel"><h2>Teaching</h2>${teaching.map(card).join('')}</section>`:''}
 <div class="two-columns"><section class="panel"><h2>Coming up</h2>${sessions.length?`<ul class="plain-list">${sessions.map(s=>`<li><a href="${workspace(s.cohort_id)}&tab=attendance"><strong>${e(when(s.starts_at))}</strong> · ${e(s.title)}</a><small>${e(cohortName(s.cohort_id)?.courses?.title||'')}${s.location?' · '+e(s.location):''}</small></li>`).join('')}</ul>`:'<p class="muted">No upcoming sessions.</p>'}</section>
 <section class="panel"><h2>Deadlines</h2>${todo.length?`<ul class="plain-list">${todo.slice(0,5).map(a=>`<li><a href="${workspace(a.cohort_id)}&tab=assignments"><strong>${e(a.title)}</strong></a><small>${a.due_at?'Due '+e(when(a.due_at)):'No deadline'}${new Date(a.due_at)<new Date()?' · overdue':''} · ${e(cohortName(a.cohort_id)?.courses?.title||'')}</small></li>`).join('')}</ul>`:'<p class="muted">You’re all caught up.</p>'}</section></div>`;
}

async function renderAdmin(){
 app.innerHTML=`${tabs([['overview','Overview'],['programs','Programs'],['courses','Courses'],['cohorts','Cohorts'],['tutors','Tutors'],['people','People']],adminTab,'Admin sections')}<div id="admin-content" aria-busy="true"></div>`;
 app.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.tab;openCohort=null;message('');renderAdmin();});
 const content=document.querySelector('#admin-content');
 await run(async()=>{await ({overview:adminOverview,programs:adminPrograms,courses:adminCourses,cohorts:adminCohorts,tutors:adminTutors,people:adminPeople})[adminTab](content);});
 content.removeAttribute('aria-busy');
}
const loadPrograms=()=>rows(db().from('programs').select('*').order('sort_order').order('name'));
const loadCourses=()=>rows(db().from('courses').select('*,programs(name)').order('sort_order').order('title'));
const courseLabel=c=>`${c?.programs?.name??''} · ${c?.title??''}`;
const posterUrl=path=>db().storage.from('learning-posters').getPublicUrl(path).data.publicUrl;

async function adminOverview(content){
 const [o,cohorts,members]=await Promise.all([rpc('learning_overview'),rows(db().from('cohorts').select('*,courses(title,programs(name))').order('starts_on')),rows(db().from('cohort_members').select('cohort_id,role,status').eq('status','active'))]);
 const running=cohorts.filter(h=>['active','planned'].includes(h.status)),count=(id,role)=>members.filter(m=>m.cohort_id===id&&m.role===role).length;
 content.innerHTML=`<div class="stats">${stat('Learners',o.learners,'Active in current cohorts')}${stat('Tutors',o.tutors,'Teaching current cohorts')}${stat('Active cohorts',o.active_cohorts,`${o.courses} courses · ${o.programs} programs`)}</div><div class="stats">${stat('Awaiting grading',o.to_grade,'Submitted, not yet graded')}${stat('Sessions this week',o.sessions_this_week,'Monday–Sunday, EAT')}${stat('Planned cohorts',running.filter(h=>h.status==='planned').length,'Not started yet')}</div>
 <section class="panel"><div class="panel-header"><h2>Current cohorts</h2><button class="button secondary" data-goto="cohorts">Manage cohorts</button></div>${running.length?`<div class="table-wrap"><table><thead><tr><th>Cohort</th><th>Course</th><th>Dates</th><th>People</th><th>Status</th><th></th></tr></thead><tbody>${running.map(h=>`<tr><td>${e(h.name)}</td><td>${e(h.courses?.title)}<small>${e(h.courses?.programs?.name)}</small></td><td>${e(dateRange(h.starts_on,h.ends_on)||'Not set')}</td><td>${plural(count(h.id,'learner'),'learner')}<small>${plural(count(h.id,'tutor'),'tutor')}</small></td><td><span class="badge ${h.status==='active'?'solid':''}">${e(label(COHORT_STATUSES,h.status))}</span></td><td><a class="text-link" href="${workspace(h.id)}">Open workspace ↗</a></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No planned or active cohorts.</p>'}</section>`;
 content.querySelector('[data-goto]').onclick=()=>{adminTab='cohorts';renderAdmin();};
}

async function adminPrograms(content){
 const [programs,courses]=await Promise.all([loadPrograms(),rows(db().from('courses').select('id,program_id'))]);
 content.innerHTML=`<section class="panel"><div class="panel-header"><div><h2>Programs</h2><p class="hint">Top-level Santuri programs such as SEMA and Instrument Makers Lab.</p></div><button class="button" id="new-program">Add program +</button></div>${programs.length?`<div class="table-wrap"><table><thead><tr><th>Program</th><th>Courses</th><th>Status</th><th>Actions</th></tr></thead><tbody>${programs.map(p=>`<tr><td>${e(p.name)}<small>${e(p.slug)}</small></td><td>${courses.filter(c=>c.program_id===p.id).length}</td><td><span class="badge ${p.active?'solid':''}">${p.active?'Active':'Archived'}</span></td><td><div class="actions"><button class="text-button" data-edit="${p.id}">Edit</button><button class="text-button" data-archive="${p.id}">${p.active?'Archive':'Restore'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No programs yet.</p>'}</section>`;
 const edit=p=>modal(p?'Edit program':'Add program',`<form class="form-grid"><div class="full">${field('Name','name','text',p?.name,'required maxlength="120"')}</div>${field('URL slug','slug','text',p?.slug,'maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="Generated from the name"')}${field('Sort order','sort_order','number',p?.sort_order??0,'step="1"')}<div class="full">${area('Summary','summary',p?.summary,'maxlength="2000" rows="4"')}</div><div class="full"><button class="button">Save program</button></div></form>`,async f=>{
  await rpc('save_program',{p_id:p?.id??null,p_version:p?.version??null,p_data:{name:f.get('name'),slug:f.get('slug')||slugify(f.get('name')),summary:f.get('summary'),sort_order:Number(f.get('sort_order')||0),active:p?.active??true}});
  message('Program saved.');await renderAdmin();});
 content.querySelector('#new-program').onclick=()=>edit();
 content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(programs.find(p=>p.id===b.dataset.edit)));
 content.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>run(async()=>{const p=programs.find(x=>x.id===b.dataset.archive);await rpc('save_program',{p_id:p.id,p_version:p.version,p_data:{...p,active:!p.active}});await renderAdmin();},b));
}

async function adminCourses(content){
 const [programs,courses,cohorts]=await Promise.all([loadPrograms(),loadCourses(),rows(db().from('cohorts').select('id,course_id,status'))]);
 if(!programs.length){content.innerHTML=empty('Add a program first.','Courses belong to a program.');return;}
 content.innerHTML=`<section class="panel"><div class="panel-header"><div><h2>Courses</h2><p class="hint">Courses, workshops, labs and masterclasses. Each course has one curriculum, shared by all of its cohorts.</p></div><button class="button" id="new-course">Add course +</button></div>${courses.length?`<div class="table-wrap"><table><thead><tr><th>Course</th><th>Program</th><th>Format</th><th>Cohorts</th><th>Status</th><th>Actions</th></tr></thead><tbody>${courses.map(c=>{const first=cohorts.find(h=>h.course_id===c.id);return `<tr><td>${e(c.title)}<small>${e(c.slug)}</small></td><td>${e(c.programs?.name)}</td><td>${e(label(FORMATS,c.format))}</td><td>${cohorts.filter(h=>h.course_id===c.id).length}</td><td><span class="badge ${c.active?'solid':''}">${c.active?'Active':'Archived'}</span></td><td><div class="actions"><button class="text-button" data-edit="${c.id}">Edit</button>${first?`<a class="text-button" href="${workspace(first.id)}&tab=curriculum">Curriculum</a>`:''}<button class="text-button" data-archive="${c.id}">${c.active?'Archive':'Restore'}</button></div></td></tr>`;}).join('')}</tbody></table></div><p class="hint">Edit a course’s curriculum from any of its cohort workspaces. Add a cohort first if the course has none.</p>`:'<p class="muted">No courses yet.</p>'}</section>`;
 const edit=c=>modal(c?'Edit course':'Add course',`<form class="form-grid">${select('Program','program_id',programs.map(p=>[p.id,p.name+(p.active?'':' (archived)')]),c?.program_id??programs[0].id,'required')}${select('Format','format',FORMATS,c?.format??'course','required')}<div class="full">${field('Title','title','text',c?.title,'required maxlength="160"')}</div>${field('URL slug','slug','text',c?.slug,'maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="Generated from the title"')}${field('Sort order','sort_order','number',c?.sort_order??0,'step="1"')}<div class="full">${area('Summary','summary',c?.summary,'maxlength="4000" rows="5"')}</div><div class="full"><button class="button">Save course</button></div></form>`,async f=>{
  await rpc('save_course',{p_id:c?.id??null,p_version:c?.version??null,p_data:{program_id:f.get('program_id'),format:f.get('format'),title:f.get('title'),slug:f.get('slug')||slugify(f.get('title')),summary:f.get('summary'),sort_order:Number(f.get('sort_order')||0),active:c?.active??true}});
  message('Course saved.');await renderAdmin();});
 content.querySelector('#new-course').onclick=()=>edit();
 content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(courses.find(c=>c.id===b.dataset.edit)));
 content.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>run(async()=>{const {programs:_,...c}=courses.find(x=>x.id===b.dataset.archive);await rpc('save_course',{p_id:c.id,p_version:c.version,p_data:{...c,active:!c.active}});await renderAdmin();},b));
}

async function adminCohorts(content){
 const [courses,cohorts,members]=await Promise.all([loadCourses(),rows(db().from('cohorts').select('*').order('starts_on',{ascending:false,nullsFirst:true}).order('name')),rows(db().from('cohort_members').select('cohort_id,role,status').neq('status','withdrawn'))]);
 if(!courses.length){content.innerHTML=empty('Add a course first.','Each cohort is one run of a course.');return;}
 const course=id=>courses.find(c=>c.id===id),shown=cohorts.filter(h=>!cohortFilter||h.course_id===cohortFilter);
 const count=(id,role)=>members.filter(m=>m.cohort_id===id&&m.role===role).length;
 content.innerHTML=`<section class="panel"><div class="panel-header"><div><h2>Cohorts</h2><p class="hint">A cohort is one run of a course: an intake, a workshop date or a masterclass. Assign tutors and learners here.</p></div><button class="button" id="new-cohort">Add cohort +</button></div><div class="form-grid"><label class="field">Course<select id="cohort-filter"><option value="">All courses</option>${options(courses.map(c=>[c.id,courseLabel(c)]),cohortFilter)}</select></label></div>${shown.length?`<div class="table-wrap"><table><thead><tr><th>Cohort</th><th>Course</th><th>Dates</th><th>People</th><th>Status</th><th>Actions</th></tr></thead><tbody>${shown.map(h=>`<tr${openCohort===h.id?' class="selected-row"':''}><td>${e(h.name)}</td><td>${e(course(h.course_id)?.title)}<small>${e(course(h.course_id)?.programs?.name)}</small></td><td>${e(dateRange(h.starts_on,h.ends_on)||'Not set')}</td><td>${plural(count(h.id,'learner'),'learner')}<small>${plural(count(h.id,'tutor'),'tutor')}</small></td><td><span class="badge ${h.status==='active'?'solid':''}">${e(label(COHORT_STATUSES,h.status))}</span>${h.listed?'<small>On landing page</small>':''}</td><td><div class="actions"><a class="text-button" href="${workspace(h.id)}">Open</a><button class="text-button" data-people="${h.id}">People</button><button class="text-button" data-edit="${h.id}">Edit</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No cohorts in this view.</p>'}</section><div id="cohort-people"></div>`;
 content.querySelector('#cohort-filter').onchange=event=>{cohortFilter=event.target.value;renderAdmin();};
 const edit=h=>{const dialog=modal(h?'Edit cohort':'Add cohort',`<form class="form-grid"><div class="full">${select('Course','course_id',courses.map(c=>[c.id,courseLabel(c)]),h?.course_id??(cohortFilter||courses[0].id),'required')}</div><div class="full">${field('Name','name','text',h?.name,'required maxlength="120" placeholder="e.g. 2027 Intake"')}</div>${field('Starts','starts_on','date',h?.starts_on??'')}${field('Ends','ends_on','date',h?.ends_on??'')}${select('Status','status',COHORT_STATUSES,h?.status??'planned','required')}
  <fieldset class="full listing-fields"><legend>Landing page poster</legend>${check('Show on the public landing page while planned or active','listed',h?.listed)}<div class="form-grid">${field('Location','location','text',h?.location,'maxlength="200" placeholder="e.g. Santuri, Westlands"')}${field('Registration link','apply_url','url',h?.apply_url,'placeholder="https:// (optional, e.g. a Google Form)"')}<div class="full">${area('Short description','blurb',h?.blurb,'maxlength="600" rows="3" placeholder="Shown under the poster. Leave blank to use the course summary."')}</div><div class="full"><label class="field">Poster image <small>JPG, PNG or WebP up to 5 MB, ideally portrait 4:5. Without one, a typographic poster is shown.</small><input name="poster" type="file" accept="image/jpeg,image/png,image/webp"></label>${h?.poster_path?`<img class="poster-preview" src="${e(posterUrl(h.poster_path))}" alt="Current poster">${check('Remove current poster','remove_poster',false)}`:''}</div></div><p class="hint">Without a registration link, the poster offers a “Register interest” email to ${e(support)}.</p></fieldset>
  <div class="full"><button class="button">Save cohort</button></div></form>`,async f=>{
  let poster=h?.poster_path||'';const file=f.get('poster');
  if(f.has('remove_poster'))poster='';
  if(file?.size){if(file.size>5242880)throw Error('Poster images must be 5 MB or smaller.');poster=`posters/${crypto.randomUUID()}-${safeFileName(file.name)}`;await result(db().storage.from('learning-posters').upload(poster,file,{upsert:false,contentType:file.type}));}
  const id=await rpc('save_cohort',{p_id:h?.id??null,p_version:h?.version??null,p_data:{course_id:f.get('course_id'),name:f.get('name'),starts_on:f.get('starts_on'),ends_on:f.get('ends_on'),status:f.get('status'),listed:f.has('listed'),location:f.get('location'),apply_url:f.get('apply_url'),blurb:f.get('blurb'),poster_path:poster}});
  if(h?.poster_path&&h.poster_path!==poster)db().storage.from('learning-posters').remove([h.poster_path]).catch(()=>{});
  if(!h)openCohort=id;message('Cohort saved.');await renderAdmin();});return dialog;};
 content.querySelector('#new-cohort').onclick=()=>edit();
 content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(cohorts.find(h=>h.id===b.dataset.edit)));
 content.querySelectorAll('[data-people]').forEach(b=>b.onclick=()=>{openCohort=b.dataset.people;renderAdmin();});
 const selected=cohorts.find(h=>h.id===openCohort);if(selected)await cohortPeople(selected,course(selected.course_id));
}

async function cohortPeople(cohort,course){
 const el=document.querySelector('#cohort-people'),[roster,tutors]=await Promise.all([rpc('cohort_roster',{p_cohort:cohort.id}),rpc('list_tutors')]),available=tutors.filter(t=>!roster.some(r=>r.user_id===t.user_id));
 el.innerHTML=`<section class="panel" id="people-panel"><div class="panel-header"><div><p class="eyebrow">${e(courseLabel(course))}</p><h2>${e(cohort.name)} · People</h2></div><button class="text-button" id="close-people">Close</button></div><form id="tutor-pick" class="form-grid"><label class="field">Add a tutor from the tutor list<select name="tutor" required ${available.length?'':'disabled'}><option value="">${available.length?'Choose a tutor':tutors.length?'Every listed tutor is already here':'No tutors listed yet'}</option>${options(available.map(t=>[t.user_id,t.full_name||t.email]),'')}</select></label><div class="actions tutor-pick-actions"><button class="button secondary" ${available.length?'':'disabled'}>Add as tutor</button><button type="button" class="text-button" data-goto="tutors">Manage tutor list</button></div></form><form id="people-search" class="form-grid"><label class="field full">Or find any Santuri account by name or email<input name="q" type="search" minlength="2" required class="search-input" placeholder="At least two characters"></label><div class="full"><button class="button secondary">Search</button></div></form><div id="people-results" aria-live="polite"></div><p class="hint">People need a Santuri account first. They can create one on the sign-in page or at bookings.santuri.org.</p>${roster.length?`<div class="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${roster.map(r=>`<tr><td>${e(r.full_name||r.email)}<small>${e(r.email)}</small></td><td><select data-role="${r.user_id}" aria-label="Role for ${e(r.full_name||r.email)}">${options(ROLES,r.role)}</select></td><td><select data-status="${r.user_id}" aria-label="Status for ${e(r.full_name||r.email)}">${options(MEMBER_STATUSES,r.status)}</select></td><td><button class="text-button" data-remove="${r.user_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nobody is assigned to this cohort yet.</p>'}</section>`;
 el.querySelector('#close-people').onclick=()=>{openCohort=null;renderAdmin();};
 const assign=(id,role,status,button)=>run(async()=>{await rpc('set_cohort_member',{p_cohort:cohort.id,p_user:id,p_role:role,p_status:status});await renderAdmin();},button);
 bindForm('#tutor-pick',async f=>{await rpc('set_cohort_member',{p_cohort:cohort.id,p_user:f.get('tutor'),p_role:'tutor',p_status:'active'});message('Tutor added.');await renderAdmin();});
 el.querySelector('[data-goto="tutors"]').onclick=()=>{adminTab='tutors';openCohort=null;renderAdmin();};
 bindForm('#people-search',async f=>{
  const found=await rpc('search_people',{p_query:f.get('q')}),inCohort=new Set(roster.map(r=>r.user_id)),box=el.querySelector('#people-results');
  box.innerHTML=found.length?`<div class="table-wrap"><table><tbody>${found.map(p=>`<tr><td>${e(p.full_name||p.email)}<small>${e(p.email)}</small></td><td>${inCohort.has(p.id)?'<span class="badge">Already assigned</span>':`<div class="actions"><button class="text-button" data-add="${p.id}" data-as="learner">Add as learner</button><button class="text-button" data-add="${p.id}" data-as="tutor">Add as tutor</button></div>`}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No matching accounts.</p>';
  box.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>assign(b.dataset.add,b.dataset.as,'active',b));
 });
 const row=id=>roster.find(r=>r.user_id===id);
 el.querySelectorAll('[data-role]').forEach(s=>s.onchange=()=>assign(s.dataset.role,s.value,row(s.dataset.role).status,s));
 el.querySelectorAll('[data-status]').forEach(s=>s.onchange=()=>assign(s.dataset.status,row(s.dataset.status).role,s.value,s));
 el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const r=row(b.dataset.remove);modal('Remove from cohort',`<form><p>Remove ${e(r.full_name||r.email)} from ${e(cohort.name)}? To keep their history, set their status to Withdrawn instead.</p><div class="actions"><button class="button">Remove</button></div></form>`,async()=>{await rpc('remove_cohort_member',{p_cohort:cohort.id,p_user:r.user_id});await renderAdmin();});});
}

// Tutor list: who staff can pick when staffing a cohort. Listing alone grants no access.
async function adminTutors(content){
 const tutors=await rpc('list_tutors');
 content.innerHTML=`<section class="panel"><div class="panel-header"><div><h2>Tutors</h2><p class="hint">Santuri’s tutor list. Listed tutors can be added to any cohort in one click from Cohorts → People. Being listed gives no access by itself: tutors only see the cohorts they’re assigned to.</p></div></div>${tutors.length?`<div class="table-wrap"><table><thead><tr><th>Tutor</th><th>Teaching now</th><th>Listed</th><th></th></tr></thead><tbody>${tutors.map(t=>`<tr><td>${e(t.full_name||t.email)}<small>${e(t.email)}</small></td><td>${t.teaching} cohort${t.teaching===1?'':'s'}</td><td>${e(new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(t.added_at)))}</td><td><button class="text-button" data-unlist="${t.user_id}">Remove from list</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No tutors listed yet.</p>'}</section>
 <section class="panel"><h2>Add a tutor</h2><p class="hint">They need a Santuri account first. People are also added automatically when you make them a tutor in a cohort.</p><form id="tutor-search" class="form-grid"><label class="field full">Name or email<input name="q" type="search" minlength="2" required class="search-input" placeholder="At least two characters"></label><div class="full"><button class="button secondary">Search</button></div></form><div id="tutor-results" aria-live="polite"></div></section>`;
 content.querySelectorAll('[data-unlist]').forEach(b=>b.onclick=()=>{const t=tutors.find(x=>x.user_id===b.dataset.unlist);modal('Remove from tutor list',`<form><p>Remove ${e(t.full_name||t.email)} from the tutor list?${t.teaching?` They keep access to the ${t.teaching} cohort${t.teaching===1?'':'s'} they currently teach; set their status to Withdrawn in a cohort to remove that.`:''}</p><div class="actions"><button class="button">Remove</button></div></form>`,async()=>{await rpc('set_tutor',{p_user:t.user_id,p_tutor:false});message('Removed from the tutor list.');await renderAdmin();});});
 bindForm('#tutor-search',async f=>{
  const found=await rpc('search_people',{p_query:f.get('q')}),listed=new Set(tutors.map(t=>t.user_id)),box=content.querySelector('#tutor-results');
  box.innerHTML=found.length?`<div class="table-wrap"><table><tbody>${found.map(p=>`<tr><td>${e(p.full_name||p.email)}<small>${e(p.email)}</small></td><td>${listed.has(p.id)?'<span class="badge">Already listed</span>':`<button class="text-button" data-list="${p.id}">Add to tutor list</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No matching accounts.</p>';
  box.querySelectorAll('[data-list]').forEach(b=>b.onclick=()=>run(async()=>{await rpc('set_tutor',{p_user:b.dataset.list,p_tutor:true});message('Added to the tutor list.');await renderAdmin();},b));
 });
}

// Look up anyone with a Santuri account and see every cohort they learn or teach in.
async function adminPeople(content){
 content.innerHTML=`<section class="panel"><h2>People</h2><p class="hint">Search any Santuri account to see where they learn and teach. Assign people to cohorts from the Cohorts tab.</p><form id="directory-search" class="form-grid"><label class="field full">Name or email<input name="q" type="search" minlength="2" required class="search-input" placeholder="At least two characters"></label><div class="full"><button class="button secondary">Search</button></div></form><div id="directory-results" aria-live="polite"></div></section>`;
 bindForm('#directory-search',async f=>{
  const found=await rpc('search_people',{p_query:f.get('q')}),box=content.querySelector('#directory-results');
  if(!found.length){box.innerHTML='<p class="muted">No matching accounts.</p>';return;}
  const [all,tutors]=await Promise.all([rows(db().from('cohort_members').select('user_id,role,status,cohort_id,cohorts(id,name,status,courses(title,programs(name)))')),rpc('list_tutors')]),listed=new Set(tutors.map(t=>t.user_id));
  box.innerHTML=found.map(p=>{const mine=all.filter(m=>m.user_id===p.id);return `<article class="booking-card person-card"><div><h3>${e(p.full_name||p.email)}</h3><p class="hint">${e(p.email)}</p>${listed.has(p.id)?'<span class="badge solid">Tutor list</span> ':''}<button type="button" class="text-button" data-tutor="${p.id}" data-listed="${listed.has(p.id)}">${listed.has(p.id)?'Remove from tutor list':'Add to tutor list'}</button></div><div>${mine.length?`<ul class="plain-list">${mine.map(m=>`<li><a href="${workspace(m.cohort_id)}">${e(m.cohorts?.courses?.title)} · ${e(m.cohorts?.name)}</a><small>${e(m.cohorts?.courses?.programs?.name)} · ${e(label(ROLES,m.role))} · ${e(label(MEMBER_STATUSES,m.status))}</small></li>`).join('')}</ul>`:'<p class="muted">Not in any cohort.</p>'}</div></article>`;}).join('');
  box.querySelectorAll('[data-tutor]').forEach(b=>b.onclick=()=>run(async()=>{await rpc('set_tutor',{p_user:b.dataset.tutor,p_tutor:b.dataset.listed!=='true'});message(b.dataset.listed==='true'?'Removed from the tutor list.':'Added to the tutor list.');content.querySelector('#directory-search').requestSubmit();},b));
 });
}

start().catch(fail).finally(()=>app.removeAttribute('aria-busy'));

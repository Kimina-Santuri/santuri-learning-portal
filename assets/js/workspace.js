import {result} from './supabase-client.js';
import {escapeHTML as e,dateRange,label,when,toLocalInput,fromLocalInput,percent,safeFileName,FORMATS,MATERIAL_KINDS,SUBMISSION_TYPES,ATTENDANCE,MEMBER_STATUSES} from './portal-utils.js';
import {app,field,area,select,check,empty,action,stat,tabs,message,run,modal,session,rpc,rows,startSession,fail} from './ui.js';
// Course workspace for one cohort. Learners study and submit; tutors (and staff) teach, grade and take attendance.
const BUCKET='learning-files';
const params=new URLSearchParams(location.search),cohortId=params.get('id');
let tab=params.get('tab')||'overview',ctx,reviewing=null;
const db=()=>session.db;
const text=value=>`<div class="prose">${e(value)}</div>`;
const isLate=(s,a)=>a?.due_at&&s&&new Date(s.submitted_at)>new Date(a.due_at);
const isPast=a=>a.due_at&&new Date(a.due_at)<new Date();
const points=(s,a)=>s?.status==='graded'?(a.max_points?`${Number(s.score)} / ${a.max_points}`:'Feedback given'):'—';

async function start(){
 if(!await startSession())return;
 if(!cohortId){app.innerHTML=empty('Choose a course.','Open a course from My learning.',action('dashboard.html','My learning'));return;}
 const [cohort]=await rows(db().from('cohorts').select('*,courses(*,programs(name))').eq('id',cohortId));
 if(!cohort){app.innerHTML=empty('Course not available.','You are not part of this cohort, or it no longer exists.',action('dashboard.html','Back to my learning'));return;}
 const role=await rpc('my_cohort_role',{p_cohort:cohortId});
 ctx={cohort,course:cohort.courses,role,teach:session.staff||role==='tutor'};
 document.title=`${ctx.course.title} | Santuri Learning`;
 document.querySelector('#ws-eyebrow').textContent=`${ctx.course.programs?.name??''} · ${label(FORMATS,ctx.course.format)}`;
 document.querySelector('#ws-title').textContent=ctx.course.title;
 document.querySelector('#ws-intro').textContent=[cohort.name,dateRange(cohort.starts_on,cohort.ends_on),ctx.teach?(role==='tutor'?'You are teaching':'Staff view'):'You are a learner'].filter(Boolean).join(' · ');
 await render();
}
async function render(){
 const items=ctx.teach?[['overview','Overview'],['curriculum','Curriculum'],['assignments','Assignments'],['attendance','Attendance'],['learners','Learners']]:[['overview','Overview'],['curriculum','Curriculum'],['assignments','Assignments'],['attendance','Attendance'],['grades','Grades']];
 if(!items.some(([id])=>id===tab))tab='overview';
 history.replaceState(null,'',`?id=${encodeURIComponent(cohortId)}&tab=${tab}`);
 app.innerHTML=`${tabs(items,tab,'Course sections')}<div id="ws-content" aria-busy="true"></div>`;
 app.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;reviewing=null;message('');render();});
 const content=document.querySelector('#ws-content');
 await run(async()=>{await ({overview,curriculum,assignments,attendance,learners,grades})[tab](content);});
 content.removeAttribute('aria-busy');bindFiles(content);
}
const go=next=>{tab=next;render();};

// Data
const loadCurriculum=()=>Promise.all([rows(db().from('modules').select('*').eq('course_id',ctx.course.id).order('sort_order').order('title')),rows(db().from('materials').select('*').eq('course_id',ctx.course.id).order('sort_order').order('title'))]);
const loadAssignments=()=>Promise.all([rows(db().from('assignments').select('*').eq('cohort_id',cohortId).order('due_at').order('title')),rows(db().from('submissions').select('*').eq('cohort_id',cohortId))]);
const loadSessions=()=>Promise.all([rows(db().from('class_sessions').select('*').eq('cohort_id',cohortId).order('starts_at')),rows(db().from('attendance').select('*').eq('cohort_id',cohortId))]);
const loadLearners=async()=>(await rpc('cohort_roster',{p_cohort:cohortId})).filter(r=>r.role==='learner'&&r.status!=='withdrawn');

// Files live in one private bucket and open through short-lived signed links.
async function upload(path,file){await result(db().storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||undefined}));}
function removeFile(path){if(path)db().storage.from(BUCKET).remove([path]).catch(()=>{});}
const fileButton=(path,name)=>path?`<button type="button" class="text-button" data-file="${e(path)}">${e(name||'Download file')} ↓</button>`:'';
function bindFiles(scope){scope.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{const w=window.open('about:blank','_blank');run(async()=>{const {signedUrl}=await result(db().storage.from(BUCKET).createSignedUrl(b.dataset.file,3600));if(w)w.location.href=signedUrl;else location.assign(signedUrl);},b);});}
const confirmDelete=(title,copy,task)=>modal(title,`<form><p>${copy}</p><div class="actions"><button class="button">Delete</button></div></form>`,async()=>{await task();await render();});

// Overview
async function overview(content){
 const [[assigns,subs],[sessions,marks]]=await Promise.all([loadAssignments(),loadSessions()]);
 const upcoming=sessions.filter(s=>new Date(s.ends_at)>new Date()).slice(0,3);
 const sessionList=`<section class="panel"><div class="panel-header"><h2>Upcoming sessions</h2><button class="text-button" data-go="attendance">All sessions</button></div>${upcoming.length?`<ul class="plain-list">${upcoming.map(s=>`<li><strong>${e(when(s.starts_at))}–${e(when(s.ends_at).slice(-5))}</strong> · ${e(s.title)}<small>${e(s.location||'')}</small></li>`).join('')}</ul>`:'<p class="muted">No sessions scheduled.</p>'}</section>`;
 const about=ctx.course.summary?`<section class="panel"><h2>About this course</h2>${text(ctx.course.summary)}</section>`:'';
 if(ctx.teach){
  const roster=await loadLearners(),name=id=>roster.find(r=>r.user_id===id)?.full_name||'Learner';
  const queue=subs.filter(s=>s.status==='submitted').sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at)),rate=percent(marks.filter(m=>['present','late'].includes(m.status)).length,marks.filter(m=>m.status!=='excused').length);
  content.innerHTML=`<div class="stats">${stat('Learners',roster.filter(r=>r.status==='active').length,`${roster.length} enrolled in total`)}${stat('To grade',queue.length,queue[0]?'Oldest from '+e(when(queue[0].submitted_at)):'All caught up')}${stat('Attendance',rate===null?'—':rate+'%',`${sessions.filter(s=>new Date(s.starts_at)<new Date()).length} sessions held`)}</div>
  <div class="two-columns"><section class="panel"><div class="panel-header"><h2>Needs grading</h2><button class="text-button" data-go="assignments">All assignments</button></div>${queue.length?`<ul class="plain-list">${queue.slice(0,6).map(s=>{const a=assigns.find(x=>x.id===s.assignment_id);return `<li><button type="button" class="link-button" data-review="${s.assignment_id}">${e(name(s.user_id))} · ${e(a?.title)}</button><small>Submitted ${e(when(s.submitted_at))}${isLate(s,a)?' · late':''}</small></li>`;}).join('')}</ul>`:'<p class="muted">Nothing waiting for you.</p>'}</section>${sessionList}</div>${about}`;
  content.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{reviewing=b.dataset.review;go('assignments');});
 }else{
  const mine=subs.filter(s=>s.user_id===session.user.id),sub=a=>mine.find(s=>s.assignment_id===a.id);
  const todo=assigns.filter(a=>!sub(a)||sub(a).status==='returned'),graded=mine.filter(s=>s.status==='graded'),feedback=mine.filter(s=>s.feedback&&s.graded_at).sort((a,b)=>b.graded_at.localeCompare(a.graded_at)).slice(0,3);
  const scored=graded.map(s=>[s,assigns.find(a=>a.id===s.assignment_id)]).filter(([,a])=>a?.max_points),avg=scored.length?Math.round(scored.reduce((n,[s,a])=>n+s.score/a.max_points*100,0)/scored.length):null;
  const myMarks=marks.filter(m=>m.user_id===session.user.id),rate=percent(myMarks.filter(m=>['present','late'].includes(m.status)).length,myMarks.filter(m=>m.status!=='excused').length);
  content.innerHTML=`<div class="stats">${stat('Next deadline',todo[0]?e(todo[0].title):'—',todo[0]?.due_at?'Due '+e(when(todo[0].due_at)):'Nothing due')}${stat('Average grade',avg===null?'—':avg+'%',`${graded.length} graded`)}${stat('Attendance',rate===null?'—':rate+'%',`${myMarks.length} sessions recorded`)}</div>
  <div class="two-columns"><section class="panel"><div class="panel-header"><h2>To do</h2><button class="text-button" data-go="assignments">All assignments</button></div>${todo.length?`<ul class="plain-list">${todo.slice(0,5).map(a=>`<li><button type="button" class="link-button" data-open="${a.id}">${e(a.title)}</button><small>${sub(a)?.status==='returned'?'Returned for revision · ':''}${a.due_at?'Due '+e(when(a.due_at)):'No deadline'}${isPast(a)?' · overdue':''}</small></li>`).join('')}</ul>`:'<p class="muted">You’re all caught up.</p>'}</section>${sessionList}</div>
  <section class="panel"><h2>Recent feedback</h2>${feedback.length?feedback.map(s=>{const a=assigns.find(x=>x.id===s.assignment_id);return `<article class="feedback"><p class="eyebrow">${e(a?.title)} · ${e(points(s,a))}</p>${text(s.feedback)}</article>`;}).join(''):'<p class="muted">Feedback from your tutors will appear here.</p>'}</section>${about}`;
  content.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openAssignment(assigns.find(a=>a.id===b.dataset.open),sub(assigns.find(a=>a.id===b.dataset.open))));
 }
 content.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
}

// Curriculum: modules with their materials; shared by every cohort of the course.
async function curriculum(content){
 const [modules,materials]=await loadCurriculum(),teach=ctx.teach;
 const item=m=>`<li class="material"><span class="badge">${e({note:'Note',link:'Link',file:'File'}[m.kind])}</span><div><strong>${e(m.title)}</strong>${!m.published?' <span class="badge">Draft</span>':''}${m.kind!=='note'&&m.body?`<small>${e(m.body.slice(0,160))}</small>`:''}</div><div class="actions">${m.kind==='note'?`<button type="button" class="text-button" data-read="${m.id}">Read</button>`:m.kind==='link'?`<a class="text-button" href="${e(m.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`:fileButton(m.file_path,m.file_name)}${teach?`<button type="button" class="text-button" data-edit-material="${m.id}">Edit</button><button type="button" class="text-button" data-delete-material="${m.id}">Delete</button>`:''}</div></li>`;
 const list=items=>items.length?`<ul class="material-list">${items.map(item).join('')}</ul>`:'<p class="muted">No materials yet.</p>';
 const general=materials.filter(m=>!m.module_id);
 content.innerHTML=`${teach?`<div class="panel-header"><p class="hint">The curriculum belongs to the course and is shared by all of its cohorts. Drafts are hidden from learners.</p><div class="actions"><button class="button secondary" id="new-material">Add material +</button><button class="button" id="new-module">Add module +</button></div></div>`:''}
 ${modules.length||general.length?'':empty('No curriculum yet.',teach?'Start with a module (a week, unit or topic), then add notes, links and files to it.':'Your tutors haven’t published course materials yet.')}
 ${modules.map((m,i)=>`<section class="panel module"><div class="panel-header"><div><p class="eyebrow">Module ${i+1}</p><h2>${e(m.title)}</h2></div>${teach?`<div class="actions"><button class="text-button" data-add-to="${m.id}">Add material</button><button class="text-button" data-edit-module="${m.id}">Edit</button><button class="text-button" data-delete-module="${m.id}">Delete</button></div>`:''}</div>${m.summary?text(m.summary):''}${list(materials.filter(x=>x.module_id===m.id))}</section>`).join('')}
 ${general.length?`<section class="panel module"><h2>General resources</h2>${list(general)}</section>`:''}`;
 content.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>{const m=materials.find(x=>x.id===b.dataset.read);modal(m.title,`<div class="reading">${text(m.body)}</div>`);});
 if(!teach)return;
 const editModule=m=>modal(m?'Edit module':'Add module',`<form class="form-grid"><div class="full">${field('Title','title','text',m?.title,'required maxlength="160" placeholder="e.g. Week 1 · Rhythm and groove"')}</div><div class="full">${area('Summary and learning outcomes','summary',m?.summary,'maxlength="4000" rows="5"')}</div>${field('Order','sort_order','number',m?.sort_order??modules.length,'step="1"')}<div class="full"><button class="button">Save module</button></div></form>`,async f=>{
  await rpc('save_module',{p_id:m?.id??null,p_version:m?.version??null,p_data:{course_id:ctx.course.id,title:f.get('title'),summary:f.get('summary'),sort_order:Number(f.get('sort_order')||0)}});message('Module saved.');await render();});
 content.querySelector('#new-module').onclick=()=>editModule();
 content.querySelector('#new-material').onclick=()=>editMaterial(null,modules,'');
 content.querySelectorAll('[data-add-to]').forEach(b=>b.onclick=()=>editMaterial(null,modules,b.dataset.addTo));
 content.querySelectorAll('[data-edit-module]').forEach(b=>b.onclick=()=>editModule(modules.find(m=>m.id===b.dataset.editModule)));
 content.querySelectorAll('[data-delete-module]').forEach(b=>b.onclick=()=>{const m=modules.find(x=>x.id===b.dataset.deleteModule);confirmDelete('Delete module',`Delete “${e(m.title)}”? Its materials move to General resources and its assignments stay in place.`,()=>rpc('delete_module',{p_id:m.id}));});
 content.querySelectorAll('[data-edit-material]').forEach(b=>b.onclick=()=>{const m=materials.find(x=>x.id===b.dataset.editMaterial);editMaterial(m,modules,m.module_id||'');});
 content.querySelectorAll('[data-delete-material]').forEach(b=>b.onclick=()=>{const m=materials.find(x=>x.id===b.dataset.deleteMaterial);confirmDelete('Delete material',`Delete “${e(m.title)}”${m.file_path?' and its file':''}? Learners will no longer see it.`,async()=>{await rpc('delete_material',{p_id:m.id});removeFile(m.file_path);});});
}
function editMaterial(m,modules,moduleId){
 const dialog=modal(m?'Edit material':'Add material',`<form class="form-grid"><div class="full">${field('Title','title','text',m?.title,'required maxlength="160"')}</div>${select('Module','module_id',[['','General resources'],...modules.map(x=>[x.id,x.title])],moduleId)}${select('Type','kind',MATERIAL_KINDS,m?.kind??'note','required')}
  <div class="full" data-kind="link">${field('Link','url','url',m?.url,'placeholder="https://"')}</div>
  <div class="full" data-kind="file"><label class="field">File${m?.file_name?` <small>Current: ${e(m.file_name)}. Choose a new file to replace it.</small>`:''}<input name="file" type="file"></label><p class="hint">Up to 50 MB per file. For bigger projects, zip them or share a link instead.</p></div>
  <div class="full">${area('<span data-body-label>Content</span>','body',m?.body,'maxlength="20000" rows="8"')}</div>${field('Order','sort_order','number',m?.sort_order??0,'step="1"')}<div>${check('Visible to learners','published',m?.published??true)}</div><div class="full"><button class="button">Save material</button></div></form>`,async f=>{
  const kind=f.get('kind'),file=f.get('file');let path=kind==='file'?m?.file_path||'':'',name=kind==='file'?m?.file_name||'':'';
  if(kind==='file'&&file?.size){path=`materials/${ctx.course.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;await upload(path,file);name=file.name;}
  if(kind==='file'&&!path)throw Error('Choose a file to upload.');
  await rpc('save_material',{p_id:m?.id??null,p_version:m?.version??null,p_data:{course_id:ctx.course.id,module_id:f.get('module_id'),title:f.get('title'),kind,body:f.get('body'),url:kind==='link'?f.get('url'):'',file_path:path,file_name:name,published:f.has('published'),sort_order:Number(f.get('sort_order')||0)}});
  if(m?.file_path&&m.file_path!==path)removeFile(m.file_path);
  message('Material saved.');await render();});
 const kind=dialog.querySelector('[name=kind]'),sync=()=>{dialog.querySelectorAll('[data-kind]').forEach(el=>el.hidden=el.dataset.kind!==kind.value);dialog.querySelector('[name=url]').required=kind.value==='link';dialog.querySelector('[data-body-label]').textContent=kind.value==='note'?'Content':'Description (optional)';};
 kind.onchange=sync;sync();
}

// Assignments
async function assignments(content){
 const [[assigns,subs],modules]=await Promise.all([loadAssignments(),rows(db().from('modules').select('id,title').eq('course_id',ctx.course.id).order('sort_order'))]);
 const moduleName=id=>modules.find(m=>m.id===id)?.title;
 if(ctx.teach){
  const roster=await loadLearners();
  content.innerHTML=`<section class="panel"><div class="panel-header"><div><h2>Assignments</h2><p class="hint">Assignments belong to this cohort. Learners only see published ones.</p></div><button class="button" id="new-assignment">Add assignment +</button></div>${assigns.length?`<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Due · EAT</th><th>Submissions</th><th>Status</th><th>Actions</th></tr></thead><tbody>${assigns.map(a=>{const s=subs.filter(x=>x.assignment_id===a.id),waiting=s.filter(x=>x.status==='submitted').length;return `<tr${reviewing===a.id?' class="selected-row"':''}><td>${e(a.title)}<small>${e(moduleName(a.module_id)||'No module')} · ${a.max_points?a.max_points+' points':'Feedback only'}</small></td><td>${a.due_at?e(when(a.due_at)):'No deadline'}</td><td>${s.length} / ${roster.length}<small>${waiting?waiting+' to grade':'Nothing to grade'}</small></td><td><span class="badge ${a.published?'solid':''}">${a.published?'Published':'Draft'}</span></td><td><div class="actions"><button class="text-button" data-review="${a.id}">Review</button><button class="text-button" data-edit="${a.id}">Edit</button>${s.length?'':`<button class="text-button" data-delete="${a.id}">Delete</button>`}</div></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">No assignments yet.</p>'}</section><div id="review-panel"></div>`;
  content.querySelector('#new-assignment').onclick=()=>editAssignment(null,modules);
  content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editAssignment(assigns.find(a=>a.id===b.dataset.edit),modules));
  content.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const a=assigns.find(x=>x.id===b.dataset.delete);confirmDelete('Delete assignment',`Delete “${e(a.title)}”?`,()=>rpc('delete_assignment',{p_id:a.id}));});
  content.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{reviewing=b.dataset.review;render();});
  const a=assigns.find(x=>x.id===reviewing);if(a)reviewPanel(content.querySelector('#review-panel'),a,subs.filter(s=>s.assignment_id===a.id),roster);
  return;
 }
 const mine=subs.filter(s=>s.user_id===session.user.id),sub=a=>mine.find(s=>s.assignment_id===a.id);
 const state=a=>{const s=sub(a);return !s?(isPast(a)?['Overdue','']:['Not submitted','']):s.status==='graded'?[`Graded · ${points(s,a)}`,'solid']:s.status==='returned'?['Returned · please revise','']:[isLate(s,a)?'Submitted late':'Submitted',''];};
 content.innerHTML=assigns.length?`<section class="panel"><h2>Assignments</h2>${assigns.map(a=>{const [text_,cls]=state(a);return `<article class="booking-card learning-card"><div><p class="eyebrow">${e(moduleName(a.module_id)||'Assignment')} · ${a.max_points?a.max_points+' points':'Feedback only'}</p><h3>${e(a.title)}</h3><p>${a.due_at?'Due '+e(when(a.due_at))+' EAT':'No deadline'}</p></div><div class="learning-badges"><span class="badge ${cls}">${e(text_)}</span><button class="button secondary" data-open="${a.id}">Open</button></div></article>`;}).join('')}</section>`:empty('No assignments yet.','Assignments from your tutors will appear here.');
 content.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const a=assigns.find(x=>x.id===b.dataset.open);openAssignment(a,sub(a));});
}
function editAssignment(a,modules){
 modal(a?'Edit assignment':'Add assignment',`<form class="form-grid"><div class="full">${field('Title','title','text',a?.title,'required maxlength="160"')}</div>${select('Module','module_id',[['','No module'],...modules.map(m=>[m.id,m.title])],a?.module_id??'')}${select('Learners submit','submission_type',SUBMISSION_TYPES,a?.submission_type??'any')}${field('Due (EAT)','due_at','datetime-local',toLocalInput(a?.due_at))}${field('Points','max_points','number',a?.max_points??'','min="1" max="1000" step="1" placeholder="Leave blank for feedback only"')}<div class="full">${area('Instructions','instructions',a?.instructions,'maxlength="20000" rows="8"')}</div><div class="full">${check('Published (visible to learners)','published',a?.published??false)}</div><div class="full"><button class="button">Save assignment</button></div></form>`,async f=>{
  await rpc('save_assignment',{p_id:a?.id??null,p_version:a?.version??null,p_data:{cohort_id:cohortId,module_id:f.get('module_id'),title:f.get('title'),instructions:f.get('instructions'),due_at:fromLocalInput(f.get('due_at')),max_points:f.get('max_points'),submission_type:f.get('submission_type'),published:f.has('published')}});
  message('Assignment saved.');await render();});
}
function submissionView(s,a){
 if(!s)return '<p class="muted">Nothing submitted yet.</p>';
 return `<div class="submission"><p class="hint">Submitted ${e(when(s.submitted_at))} EAT${isLate(s,a)?' · <strong>late</strong>':''}</p>${s.body?text(s.body):''}${s.url?`<p><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.url)} ↗</a></p>`:''}${fileButton(s.file_path,s.file_name)}</div>`;
}
function openAssignment(a,s){
 const graded=s?.status==='graded',type=a.submission_type;
 const dialog=modal(a.title,`<p class="hint">${a.due_at?'Due '+e(when(a.due_at))+' EAT':'No deadline'} · ${a.max_points?a.max_points+' points':'Feedback only'} · ${e(label(SUBMISSION_TYPES,type))}</p>${a.instructions?`<div class="reading">${text(a.instructions)}</div>`:''}
  <h3>Your submission</h3>${submissionView(s,a)}${s?.feedback?`<div class="feedback"><p class="eyebrow">Tutor feedback${s.status==='graded'?' · '+e(points(s,a)):s.status==='returned'?' · returned for revision':''}</p>${text(s.feedback)}</div>`:''}
  ${graded?'<p class="hint">This assignment has been graded. Ask your tutor if you need to resubmit.</p>':`<form class="form-grid"><h3 class="full">${s?'Resubmit':'Submit your work'}</h3>${['any','text'].includes(type)?`<div class="full">${area('Written response','body',s?.body??'','maxlength="20000" rows="6"'+(type==='text'?' required':''))}</div>`:''}${['any','link'].includes(type)?`<div class="full">${field('Link (SoundCloud, Drive, YouTube…)','url','url',s?.url??'','placeholder="https://"'+(type==='link'?' required':''))}</div>`:''}${['any','file'].includes(type)?`<div class="full"><label class="field">File${s?.file_name?` <small>Current: ${e(s.file_name)}. Leave empty to keep it.</small>`:''}<input name="file" type="file" ${type==='file'&&!s?.file_path?'required':''}></label><p class="hint">Up to 50 MB. For large WAVs or Ableton projects, share a link instead.</p></div>`:''}<div class="full"><button class="button">${s?'Resubmit':'Submit'} ↗</button></div></form>`}`,graded?null:async f=>{
  const file=f.get('file');let path=s?.file_path||'',name=s?.file_name||'';
  if(file?.size){path=`submissions/${cohortId}/${a.id}/${session.user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;await upload(path,file);name=file.name;}
  await rpc('submit_assignment',{p_assignment:a.id,p_body:f.get('body')??'',p_url:f.get('url')??'',p_file_path:path,p_file_name:name});
  message(`Submitted “${a.title}”.`);await render();});
 bindFiles(dialog);
}
function reviewPanel(el,a,subs,roster){
 const sub=id=>subs.find(s=>s.user_id===id);
 const status=s=>!s?['Not submitted','']:s.status==='graded'?[`Graded · ${points(s,a)}`,'solid']:s.status==='returned'?['Returned','']:[isLate(s,a)?'Submitted late':'Submitted',''];
 el.innerHTML=`<section class="panel"><div class="panel-header"><div><p class="eyebrow">Review submissions</p><h2>${e(a.title)}</h2></div><button class="text-button" id="close-review">Close</button></div>${a.instructions?`<details><summary>Instructions</summary>${text(a.instructions)}</details>`:''}${roster.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Status</th><th>Submitted · EAT</th><th></th></tr></thead><tbody>${roster.map(r=>{const s=sub(r.user_id),[t,c]=status(s);return `<tr><td>${e(r.full_name||r.email)}<small>${e(r.email)}</small></td><td><span class="badge ${c}">${e(t)}</span></td><td>${s?e(when(s.submitted_at)):'—'}</td><td>${s?`<button class="text-button" data-grade="${s.id}">${s.status==='submitted'?'Grade':'View'}</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">No learners in this cohort yet.</p>'}</section>`;
 el.querySelector('#close-review').onclick=()=>{reviewing=null;render();};
 el.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const s=subs.find(x=>x.id===b.dataset.grade),r=roster.find(x=>x.user_id===s.user_id);
  const dialog=modal(`${r?.full_name||'Learner'} · ${a.title}`,`${submissionView(s,a)}<form class="form-grid">${a.max_points?field(`Score (out of ${a.max_points})`,'score','number',s.score??'',`min="0" max="${a.max_points}" step="0.5"`):''}<div class="full">${area('Feedback','feedback',s.feedback,'maxlength="10000" rows="6"')}</div><div class="actions full"><button class="button" name="decision" value="graded">Save grade</button><button class="button secondary" name="decision" value="returned">Return for revision</button></div><p class="hint full">Returning lets the learner resubmit. Grading locks their submission.</p></form>`,async(f,_,button)=>{
   const decision=button?.value||'graded',score=f.get('score');
   await rpc('grade_submission',{p_submission:s.id,p_score:decision==='graded'&&a.max_points&&score!==''?Number(score):null,p_feedback:f.get('feedback'),p_status:decision});
   message(decision==='graded'?'Grade saved.':'Returned to the learner for revision.');await render();});
  bindFiles(dialog);});
}

// Attendance
async function attendance(content){
 const [sessions,marks]=await loadSessions();
 if(ctx.teach){
  const roster=await loadLearners();
  content.innerHTML=`<section class="panel"><div class="panel-header"><div><h2>Sessions & attendance</h2><p class="hint">Schedule class sessions, then take attendance for each one. All times EAT.</p></div><button class="button" id="new-session">Add session +</button></div>${sessions.length?`<div class="table-wrap"><table><thead><tr><th>When · EAT</th><th>Session</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>${sessions.map(s=>{const m=marks.filter(x=>x.session_id===s.id),here=m.filter(x=>['present','late'].includes(x.status)).length;return `<tr><td>${e(when(s.starts_at))}<small>until ${e(when(s.ends_at).slice(-5))}</small></td><td>${e(s.title)}<small>${e(s.location)}</small></td><td>${m.length?`${here} / ${m.length} present`:new Date(s.starts_at)>new Date()?'Upcoming':'<strong>Not taken</strong>'}</td><td><div class="actions"><button class="text-button" data-take="${s.id}">${m.length?'Update':'Take'} attendance</button><button class="text-button" data-edit="${s.id}">Edit</button><button class="text-button" data-delete="${s.id}">Delete</button></div></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">No sessions yet.</p>'}</section>`;
  content.querySelector('#new-session').onclick=()=>editSession();
  content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editSession(sessions.find(s=>s.id===b.dataset.edit)));
  content.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const s=sessions.find(x=>x.id===b.dataset.delete);confirmDelete('Delete session',`Delete “${e(s.title)}” on ${e(when(s.starts_at))}? Its attendance records are deleted too.`,()=>rpc('delete_session',{p_id:s.id}));});
  content.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>takeAttendance(sessions.find(s=>s.id===b.dataset.take),roster,marks));
  return;
 }
 const mine=marks.filter(m=>m.user_id===session.user.id),mark=id=>mine.find(m=>m.session_id===id),rate=percent(mine.filter(m=>['present','late'].includes(m.status)).length,mine.filter(m=>m.status!=='excused').length);
 content.innerHTML=`<div class="stats">${stat('Attendance',rate===null?'—':rate+'%','Present or late, excluding excused')}${stat('Sessions attended',mine.filter(m=>['present','late'].includes(m.status)).length,`of ${mine.length} recorded`)}${stat('Upcoming',sessions.filter(s=>new Date(s.starts_at)>new Date()).length,'sessions scheduled')}</div><section class="panel"><h2>Sessions</h2>${sessions.length?`<div class="table-wrap"><table><thead><tr><th>When · EAT</th><th>Session</th><th>Your attendance</th></tr></thead><tbody>${sessions.map(s=>{const m=mark(s.id);return `<tr><td>${e(when(s.starts_at))}<small>until ${e(when(s.ends_at).slice(-5))}</small></td><td>${e(s.title)}<small>${e(s.location)}</small>${s.notes?`<small>${e(s.notes)}</small>`:''}</td><td>${m?`<span class="badge ${m.status==='present'?'solid':''}">${e(label(ATTENDANCE,m.status))}</span>${m.note?`<small>${e(m.note)}</small>`:''}`:new Date(s.starts_at)>new Date()?'Upcoming':'Not recorded'}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">No sessions scheduled yet.</p>'}</section>`;
}
function editSession(s){
 modal(s?'Edit session':'Add session',`<form class="form-grid"><div class="full">${field('Title','title','text',s?.title,'required maxlength="160" placeholder="e.g. Studio session · Sampling"')}</div>${field('Starts (EAT)','starts_at','datetime-local',toLocalInput(s?.starts_at),'required')}${field('Ends (EAT)','ends_at','datetime-local',toLocalInput(s?.ends_at),'required')}<div class="full">${field('Location','location','text',s?.location,'maxlength="200" placeholder="e.g. Classroom"')}</div><div class="full">${area('Notes for learners','notes',s?.notes,'maxlength="4000" rows="3"')}</div><div class="full"><button class="button">Save session</button></div></form>`,async f=>{
  await rpc('save_session',{p_id:s?.id??null,p_version:s?.version??null,p_data:{cohort_id:cohortId,title:f.get('title'),starts_at:fromLocalInput(f.get('starts_at')),ends_at:fromLocalInput(f.get('ends_at')),location:f.get('location'),notes:f.get('notes')}});
  message('Session saved.');await render();});
}
function takeAttendance(s,roster,marks){
 if(!roster.length){message('Add learners to this cohort before taking attendance.',true);return;}
 const mark=id=>marks.find(m=>m.session_id===s.id&&m.user_id===id);
 const dialog=modal(`Attendance · ${s.title}`,`<p class="hint">${e(when(s.starts_at))} EAT${s.location?' · '+e(s.location):''}</p><form><div class="table-wrap"><table class="attendance-grid"><thead><tr><th>Learner</th><th>Status</th><th>Note</th></tr></thead><tbody>${roster.map(r=>`<tr><td>${e(r.full_name||r.email)}</td><td><select name="status-${r.user_id}" aria-label="Attendance for ${e(r.full_name||r.email)}">${ATTENDANCE.map(([v,l])=>`<option value="${v}" ${(mark(r.user_id)?.status??'present')===v?'selected':''}>${l}</option>`).join('')}</select></td><td><input name="note-${r.user_id}" maxlength="500" value="${e(mark(r.user_id)?.note??'')}" aria-label="Note for ${e(r.full_name||r.email)}"></td></tr>`).join('')}</tbody></table></div><div class="actions"><button class="button">Save attendance</button><button type="button" class="button secondary" id="all-present">Mark everyone present</button></div></form>`,async f=>{
  await rpc('mark_attendance',{p_session:s.id,p_records:roster.map(r=>({user_id:r.user_id,status:f.get(`status-${r.user_id}`),note:f.get(`note-${r.user_id}`)}))});
  message('Attendance saved.');await render();});
 dialog.querySelector('#all-present').onclick=()=>dialog.querySelectorAll('select').forEach(x=>x.value='present');
}

// Learner progress (tutors and staff)
async function learners(content){
 const progress=await rpc('cohort_progress',{p_cohort:cohortId});
 content.innerHTML=`<section class="panel"><h2>Learner progress</h2><p class="hint">Average grade covers graded, points-based assignments. Attendance counts present and late, excluding excused absences. Manage who is enrolled from Admin → Cohorts.</p>${progress.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Submitted</th><th>Graded</th><th>Average</th><th>Attendance</th></tr></thead><tbody>${progress.map(p=>{const att=percent(p.attended,p.sessions_marked);return `<tr><td>${e(p.full_name||p.email)}<small>${e(p.email)}${p.status!=='active'?' · '+e(label(MEMBER_STATUSES,p.status)):''}</small></td><td>${p.submitted} / ${p.assignments}</td><td>${p.graded}</td><td>${p.score_percent===null?'—':Math.round(p.score_percent)+'%'}</td><td>${att===null?'—':att+'%'}<small>${p.attended} of ${p.sessions_marked}</small></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">No learners enrolled yet.</p>'}</section>`;
}

// Grades (learners)
async function grades(content){
 const [assigns,subs]=await loadAssignments(),mine=subs.filter(s=>s.user_id===session.user.id),sub=a=>mine.find(s=>s.assignment_id===a.id);
 const scored=assigns.filter(a=>a.max_points&&sub(a)?.status==='graded'),avg=scored.length?Math.round(scored.reduce((n,a)=>n+sub(a).score/a.max_points*100,0)/scored.length):null;
 content.innerHTML=`<div class="stats">${stat('Average grade',avg===null?'—':avg+'%',`${scored.length} graded assignment${scored.length===1?'':'s'}`)}${stat('Submitted',mine.length,`of ${assigns.length} assignments`)}${stat('Awaiting grading',mine.filter(s=>s.status==='submitted').length,'with your tutor')}</div><section class="panel"><h2>Grades & feedback</h2>${assigns.length?`<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Status</th><th>Grade</th><th>Feedback</th></tr></thead><tbody>${assigns.map(a=>{const s=sub(a);return `<tr><td>${e(a.title)}<small>${a.due_at?'Due '+e(when(a.due_at)):'No deadline'}</small></td><td>${!s?(isPast(a)?'Overdue':'Not submitted'):s.status==='graded'?'Graded':s.status==='returned'?'Returned':'Submitted'}</td><td>${e(points(s,a))}</td><td>${s?.feedback?`<button class="text-button" data-feedback="${a.id}">Read</button>`:'—'}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">No assignments yet.</p>'}</section>`;
 content.querySelectorAll('[data-feedback]').forEach(b=>b.onclick=()=>{const a=assigns.find(x=>x.id===b.dataset.feedback);modal(`Feedback · ${a.title}`,`<p class="eyebrow">${e(points(sub(a),a))}</p>${text(sub(a).feedback)}`);});
}

start().catch(fail).finally(()=>app.removeAttribute('aria-busy'));

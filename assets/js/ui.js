import {configured,getClient,result} from './supabase-client.js';
import {escapeHTML as e} from './portal-utils.js';
// Shared page shell, form builders and session start-up for every portal page.
export const app=document.querySelector('#app'),notice=document.querySelector('#notice'),page=document.body.dataset.page;
export const support=window.SANTURI_CONFIG?.supportEmail||'admissions@santuri.org';
export const field=(label,name,type='text',value='',extra='')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
export const area=(label,name,value='',extra='')=>`<label class="field">${label}<textarea name="${name}" ${extra}>${e(value)}</textarea></label>`;
export const options=(items,selected)=>items.map(([v,l])=>`<option value="${e(v)}" ${v===selected?'selected':''}>${e(l)}</option>`).join('');
export const select=(label,name,items,selected,extra='')=>`<label class="field">${label}<select name="${name}" ${extra}>${options(items,selected)}</select></label>`;
export const check=(label,name,checked)=>`<label class="check-field"><input type="checkbox" name="${name}" ${checked?'checked':''}> ${label}</label>`;
export const empty=(title,copy,action='')=>`<div class="empty-state"><h2>${title}</h2><p>${copy}</p>${action}</div>`;
export const action=(href,text)=>`<a class="button" href="${href}">${text}</a>`;
export const stat=(eyebrow,value,note='')=>`<article class="stat"><p class="eyebrow">${eyebrow}</p><strong>${value}</strong><small>${note}</small></article>`;
export const tabs=(items,current,labelText)=>`<div class="tabs" role="group" aria-label="${labelText}">${items.map(([id,text])=>`<button data-tab="${id}" aria-pressed="${current===id}">${text}</button>`).join('')}</div>`;
export function message(text,error=false){notice.textContent=text;notice.dataset.error=error;notice.hidden=!text;}
export async function run(task,button){if(button)button.disabled=true;try{await task();}catch(error){message(error.message||'Something went wrong. Please try again.',true);}finally{if(button?.isConnected)button.disabled=false;}}
export function bindForm(id,handler){document.querySelector(id)?.addEventListener('submit',event=>{event.preventDefault();run(()=>handler(new FormData(event.currentTarget),event.currentTarget),event.submitter);});}
// onSubmit receives the clicked submit button so one form can offer several actions.
export function modal(title,content,onSubmit){
 const dialog=document.createElement('dialog');dialog.innerHTML=`<div class="dialog-heading"><h2>${e(title)}</h2><button type="button" aria-label="Close dialog">×</button></div><div class="dialog-status" role="status" aria-live="polite"></div>${content}`;
 document.body.append(dialog);dialog.querySelector('.dialog-heading button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
 if(onSubmit)dialog.querySelector('form')?.addEventListener('submit',async event=>{event.preventDefault();const b=event.submitter;if(b)b.disabled=true;try{await onSubmit(new FormData(event.currentTarget),dialog,b);dialog.close();}catch(err){dialog.querySelector('.dialog-status').textContent=err.message;}finally{if(b)b.disabled=false;}});dialog.showModal();return dialog;
}
export const session={db:null,user:null,profile:null,staff:false};
export const rpc=(name,args)=>result(session.db.rpc(name,args));
export const rows=query=>result(query);

// Connects, restores the session and fills in the sidebar. Returns false when the page should stop.
export async function startSession({allowSignedOut=false}={}){
 document.querySelector('#help-link').href=`mailto:${support}`;
 if(!configured()){app.innerHTML=empty('The learning portal is not connected yet.',`Contact the Santuri team at ${e(support)}.`);return false;}
 const db=session.db=await getClient();
 // The SDK exchanges verification/recovery codes before reading the session.
 const {data,error}=await db.auth.getSession();if(error)throw error;
 if(data.session)session.user=await result(db.auth.getUser()).then(d=>d.user);
 if(!session.user){if(!allowSignedOut)location.replace('signin.html');return allowSignedOut;}
 [session.profile,session.staff]=await Promise.all([result(db.from('profiles').select('*').eq('id',session.user.id).single()),rpc('is_staff')]);
 document.querySelector('#signed-in-as').textContent=session.profile.full_name||session.profile.email;
 document.querySelector('#staff-link').hidden=!session.staff;document.querySelector('#sign-out').hidden=false;
 document.querySelector('#sign-out').onclick=event=>run(async()=>{await result(db.auth.signOut());location.assign('index.html');},event.currentTarget);
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('index.html');});
 return true;
}
export const fail=error=>{app.innerHTML=empty('Unable to load.',e(error.message||'Please refresh and try again.'));};

import {configured,getClient,result} from './supabase-client.js';
import {escapeHTML as e,dateRange,label,FORMATS} from './portal-utils.js';
// Public landing page: posters for listed, upcoming cohorts. Works signed out.
const grid=document.querySelector('#posters'),filter=document.querySelector('#program-filter'),support=window.SANTURI_CONFIG?.supportEmail||'admissions@santuri.org';
document.querySelector('#help-link').href=`mailto:${support}`;
let listings=[],chosen='';

// A typographic poster stands in until staff upload artwork.
function poster(l,i,db){
 if(l.poster_path){const {data}=db.storage.from('learning-posters').getPublicUrl(l.poster_path);return `<div class="poster"><img src="${e(data.publicUrl)}" alt="Poster for ${e(l.course_title)}" loading="lazy"></div>`;}
 return `<div class="poster poster-generated ${i%3===1?'poster-light':''}" aria-hidden="true"><span class="poster-program">${e(l.program_name)}</span><strong class="poster-title">${e(l.course_title)}</strong><span class="poster-meta">${e(label(FORMATS,l.format))}<br>${e(dateRange(l.starts_on,l.ends_on)||'Dates to be announced')}</span></div>`;
}
function card(l,i,db){
 const ask=`mailto:${support}?subject=${encodeURIComponent(`${l.course_title} · ${l.cohort_name}`)}`;
 return `<article class="poster-card">${poster(l,i,db)}<div class="poster-info"><p class="eyebrow">${e(l.program_name)} · ${e(label(FORMATS,l.format))}</p><h3>${e(l.course_title)}</h3><p class="poster-when">${e(l.cohort_name)}<br>${e(dateRange(l.starts_on,l.ends_on)||'Dates to be announced')}${l.location?' · '+e(l.location):''}</p>${l.blurb||l.course_summary?`<p class="hint">${e(l.blurb||l.course_summary)}</p>`:''}<div class="actions">${l.apply_url?`<a class="button" href="${e(l.apply_url)}" target="_blank" rel="noopener noreferrer">Register ↗</a><a class="text-button" href="${ask}">Ask a question</a>`:`<a class="button" href="${ask}">Register interest ↗</a>`}</div></div></article>`;
}
function show(db){
 const shown=listings.filter(l=>!chosen||l.program_slug===chosen);
 grid.innerHTML=shown.length?shown.map((l,i)=>card(l,i,db)).join(''):`<div class="empty-state"><h2>Nothing listed right now.</h2><p>New courses and workshops are announced here. Questions? Email <a href="mailto:${e(support)}">${e(support)}</a>.</p></div>`;
 filter.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.program===chosen));
}
async function start(){
 if(!configured()){grid.innerHTML=`<p class="muted">Upcoming programs will appear here soon.</p>`;return;}
 const db=await getClient();
 const {data}=await db.auth.getSession();
 if(data.session)for(const id of ['#account-cta','#hero-cta']){const a=document.querySelector(id);a.href='dashboard.html';a.textContent=id==='#account-cta'?'My learning':'Go to my learning';}
 listings=await result(db.rpc('upcoming_listings'));
 const programs=[...new Map(listings.map(l=>[l.program_slug,l.program_name])).entries()];
 if(programs.length>1){filter.hidden=false;filter.innerHTML=[['','All'],...programs].map(([slug,name])=>`<button type="button" data-program="${e(slug)}">${e(name)}</button>`).join('');filter.querySelectorAll('button').forEach(b=>b.onclick=()=>{chosen=b.dataset.program;show(db);});}
 show(db);
}
start().catch(()=>{grid.innerHTML='<p class="muted">Upcoming programs could not be loaded. Please refresh the page.</p>';}).finally(()=>grid.removeAttribute('aria-busy'));

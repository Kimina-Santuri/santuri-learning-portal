import {configured,getClient,result} from './supabase-client.js';
import {escapeHTML as e,dateRange,label,FORMATS} from './portal-utils.js';
// Public landing page: posters for listed cohorts, switchable between upcoming/running and past. Works signed out.
const grid=document.querySelector('#posters'),filter=document.querySelector('#program-filter'),views=document.querySelector('#view-switch'),eyebrow=document.querySelector('#upcoming-eyebrow');
const support=window.SANTURI_CONFIG?.supportEmail||'admissions@santuri.org';
document.querySelector('#help-link').href=`mailto:${support}`;
const loaded={upcoming:null,past:null},source={upcoming:'upcoming_listings',past:'past_listings'};
let db,view=new URLSearchParams(location.search).get('view')==='past'?'past':'upcoming',chosen='';

// A typographic poster stands in until staff upload artwork.
function poster(l,i,past){
 const tag=past?'<span class="poster-tag">Past</span>':l.status==='active'?'<span class="poster-tag">Running now</span>':'';
 if(l.poster_path){const {data}=db.storage.from('learning-posters').getPublicUrl(l.poster_path);return `<div class="poster ${past?'poster-past':''}">${tag}<img src="${e(data.publicUrl)}" alt="Poster for ${e(l.course_title)}" loading="lazy"></div>`;}
 return `<div class="poster poster-generated ${i%3===1?'poster-light':''} ${past?'poster-past':''}">${tag}<span class="poster-program" aria-hidden="true">${e(l.program_name)}</span><strong class="poster-title" aria-hidden="true">${e(l.course_title)}</strong><span class="poster-meta" aria-hidden="true">${e(label(FORMATS,l.format))}<br>${e(dateRange(l.starts_on,l.ends_on)||'Dates to be announced')}</span></div>`;
}
function card(l,i,past){
 const ask=`mailto:${support}?subject=${encodeURIComponent(`${l.course_title} · ${past?'future dates':l.cohort_name}`)}`;
 const actions=past?`<a class="button secondary" href="${ask}">Ask about future dates ↗</a>`:l.apply_url?`<a class="button" href="${e(l.apply_url)}" target="_blank" rel="noopener noreferrer">Register ↗</a><a class="text-button" href="${ask}">Ask a question</a>`:`<a class="button" href="${ask}">Register interest ↗</a>`;
 return `<article class="poster-card">${poster(l,i,past)}<div class="poster-info"><p class="eyebrow">${e(l.program_name)} · ${e(label(FORMATS,l.format))}</p><h3>${e(l.course_title)}</h3><p class="poster-when">${e(l.cohort_name)}<br>${e(dateRange(l.starts_on,l.ends_on)||'Dates to be announced')}${l.location?' · '+e(l.location):''}</p>${l.blurb||l.course_summary?`<p class="hint">${e(l.blurb||l.course_summary)}</p>`:''}<div class="actions">${actions}</div></div></article>`;
}
function show(){
 const listings=loaded[view]||[],past=view==='past',shown=listings.filter(l=>!chosen||l.program_slug===chosen);
 eyebrow.textContent=past?'Past':'Upcoming';
 views.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
 const programs=[...new Map(listings.map(l=>[l.program_slug,l.program_name])).entries()];
 if(chosen&&!programs.some(([slug])=>slug===chosen))chosen='';
 filter.hidden=programs.length<2;
 filter.innerHTML=[['','All programs'],...programs].map(([slug,name])=>`<button type="button" data-program="${e(slug)}" aria-pressed="${slug===chosen}">${e(name)}</button>`).join('');
 filter.querySelectorAll('button').forEach(b=>b.onclick=()=>{chosen=b.dataset.program;show();});
 grid.innerHTML=shown.length?shown.map((l,i)=>card(l,i,past)).join(''):past?`<div class="empty-state"><h2>No past programs listed yet.</h2><p>Finished courses and workshops will appear here.</p></div>`:`<div class="empty-state"><h2>Nothing listed right now.</h2><p>New courses and workshops are announced here. Questions? Email <a href="mailto:${e(support)}">${e(support)}</a>.</p></div>`;
}
async function load(next){
 view=next;history.replaceState(null,'',view==='past'?'?view=past#upcoming':location.pathname+location.hash);
 if(!loaded[view]){grid.setAttribute('aria-busy','true');grid.innerHTML='<p class="muted">Loading…</p>';
  try{loaded[view]=await result(db.rpc(source[view]));}catch{grid.innerHTML='<p class="muted">These programs could not be loaded. Please refresh the page.</p>';return;}finally{grid.removeAttribute('aria-busy');}}
 show();
}
async function start(){
 if(!configured()){grid.innerHTML=`<p class="muted">Upcoming programs will appear here soon.</p>`;return;}
 db=await getClient();
 const {data}=await db.auth.getSession();
 if(data.session)for(const id of ['#account-cta','#hero-cta']){const a=document.querySelector(id);a.href='dashboard.html';a.textContent=id==='#account-cta'?'My learning':'Go to my learning';}
 views.querySelectorAll('button').forEach(b=>b.onclick=()=>run(b.dataset.view));
 await load(view);
}
const run=next=>load(next).catch(()=>{grid.innerHTML='<p class="muted">Programs could not be loaded. Please refresh the page.</p>';});
start().catch(()=>{grid.innerHTML='<p class="muted">Upcoming programs could not be loaded. Please refresh the page.</p>';}).finally(()=>grid.removeAttribute('aria-busy'));

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const FORMATS=[['course','Course'],['workshop','Workshop'],['lab','Lab'],['masterclass','Masterclass']];
export const COHORT_STATUSES=[['planned','Planned'],['active','Active'],['completed','Completed'],['archived','Archived']];
export const MEMBER_STATUSES=[['active','Active'],['completed','Completed'],['withdrawn','Withdrawn']];
export const ROLES=[['learner','Learner'],['tutor','Tutor']];
export const MATERIAL_KINDS=[['note','Note / reading'],['link','Link (video, article, playlist…)'],['file','File (audio, PDF, project…)']];
export const SUBMISSION_TYPES=[['any','File, link or text'],['file','File upload'],['link','Link'],['text','Written response']];
export const ATTENDANCE=[['present','Present'],['late','Late'],['absent','Absent'],['excused','Excused']];
export const label=(list,value)=>list.find(([v])=>v===value)?.[1]??value;
// Matches the database slug check: lowercase words joined by single hyphens.
export const slugify=text=>String(text??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'');
const day=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
export const dateRange=(start,end)=>start&&end&&start===end?day(start):start&&end?`${day(start)} – ${day(end)}`:start?`From ${day(start)}`:end?`Until ${day(end)}`:'';
// All portal times are Nairobi time (EAT, UTC+3, no daylight saving).
const nairobi=(options,value)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',...options}).format(new Date(value));
export const when=value=>value?nairobi({weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'},value):'';
export const timeOnly=value=>nairobi({hour:'2-digit',minute:'2-digit',hourCycle:'h23'},value);
export const toLocalInput=value=>value?new Date(new Date(value).getTime()+3*3600000).toISOString().slice(0,16):'';
export const fromLocalInput=value=>value?`${value}:00+03:00`:'';
export const percent=(part,whole)=>whole?Math.round(part/whole*100):null;
// Storage keys: a unique prefix keeps uploads from overwriting each other; the original name is kept for display.
export const safeFileName=name=>String(name||'file').normalize('NFKD').replace(/[^\w.-]+/g,'-').replace(/^-+/,'').slice(-120)||'file';

begin;
-- Learning workspace: curriculum (modules + materials), assignments and submissions,
-- class sessions and attendance. A course's curriculum is shared by all its cohorts;
-- assignments, sessions and attendance belong to one cohort. Tutors teach the cohorts
-- they are assigned to; Santuri staff can do everything a tutor can.

create function public.can_teach_cohort(p_cohort uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() or exists(select 1 from public.cohort_members where cohort_id=p_cohort and user_id=auth.uid() and role='tutor' and status<>'withdrawn'); $$;
create function public.can_teach_course(p_course uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() or exists(select 1 from public.cohort_members m join public.cohorts h on h.id=m.cohort_id
  where h.course_id=p_course and m.user_id=auth.uid() and m.role='tutor' and m.status<>'withdrawn'); $$;
create function public.in_course(p_course uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_staff() or exists(select 1 from public.cohort_members m join public.cohorts h on h.id=m.cohort_id
  where h.course_id=p_course and m.user_id=auth.uid() and m.status<>'withdrawn'); $$;
create function private.is_active_learner(p_cohort uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cohort_members where cohort_id=p_cohort and user_id=p_user and role='learner' and status='active'); $$;

create table public.modules (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
 title text not null check(length(title) between 1 and 160), summary text not null default '' check(length(summary)<=4000),
 sort_order integer not null default 0, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index modules_course on public.modules(course_id);
create table public.materials (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
 module_id uuid references public.modules(id) on delete set null,
 title text not null check(length(title) between 1 and 160), kind text not null check(kind in ('note','link','file')),
 body text not null default '' check(length(body)<=20000), url text not null default '' check(url='' or url ~ '^https?://'),
 file_path text not null default '', file_name text not null default '' check(length(file_name)<=200),
 published boolean not null default true, sort_order integer not null default 0, version integer not null default 1,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(kind<>'link' or url<>''), check(kind<>'file' or file_path<>'')
);
create index materials_course on public.materials(course_id);
create table public.assignments (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id),
 module_id uuid references public.modules(id) on delete set null,
 title text not null check(length(title) between 1 and 160), instructions text not null default '' check(length(instructions)<=20000),
 due_at timestamptz, max_points integer check(max_points is null or max_points between 1 and 1000),
 submission_type text not null default 'any' check(submission_type in ('file','link','text','any')),
 published boolean not null default false, version integer not null default 1, created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index assignments_cohort on public.assignments(cohort_id);
create table public.submissions (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id),
 cohort_id uuid not null references public.cohorts(id), user_id uuid not null references public.profiles(id),
 body text not null default '' check(length(body)<=20000), url text not null default '' check(url='' or url ~ '^https?://'),
 file_path text not null default '', file_name text not null default '' check(length(file_name)<=200),
 status text not null default 'submitted' check(status in ('submitted','returned','graded')),
 score numeric(7,2) check(score>=0), feedback text not null default '' check(length(feedback)<=10000),
 graded_by uuid references public.profiles(id), graded_at timestamptz, submitted_at timestamptz not null default now(),
 unique(assignment_id,user_id)
);
create index submissions_cohort on public.submissions(cohort_id);
create table public.class_sessions (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id),
 title text not null check(length(title) between 1 and 160), starts_at timestamptz not null, ends_at timestamptz not null,
 location text not null default '' check(length(location)<=200), notes text not null default '' check(length(notes)<=4000),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index class_sessions_cohort on public.class_sessions(cohort_id,starts_at);
create table public.attendance (
 session_id uuid not null references public.class_sessions(id) on delete cascade, cohort_id uuid not null references public.cohorts(id),
 user_id uuid not null references public.profiles(id), status text not null check(status in ('present','late','absent','excused')),
 note text not null default '' check(length(note)<=500), marked_by uuid references public.profiles(id),
 marked_at timestamptz not null default now(), primary key(session_id,user_id)
);
create index attendance_cohort on public.attendance(cohort_id);

alter table public.modules enable row level security;
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
revoke all on public.modules,public.materials,public.assignments,public.submissions,public.class_sessions,public.attendance from anon,authenticated;
grant select on public.modules,public.materials,public.assignments,public.submissions,public.class_sessions,public.attendance to authenticated;
grant all on public.modules,public.materials,public.assignments,public.submissions,public.class_sessions,public.attendance to service_role;
create policy read_modules on public.modules for select to authenticated using(public.in_course(course_id));
create policy read_materials on public.materials for select to authenticated using(public.can_teach_course(course_id) or (published and public.in_course(course_id)));
create policy read_assignments on public.assignments for select to authenticated using(public.can_teach_cohort(cohort_id) or (published and public.my_cohort_role(cohort_id)='learner'));
create policy read_submissions on public.submissions for select to authenticated using(user_id=auth.uid() or public.can_teach_cohort(cohort_id));
create policy read_class_sessions on public.class_sessions for select to authenticated using(public.can_teach_cohort(cohort_id) or public.my_cohort_role(cohort_id) is not null);
create policy read_attendance on public.attendance for select to authenticated using(user_id=auth.uid() or public.can_teach_cohort(cohort_id));

-- Curriculum
create function public.save_module(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid:=coalesce(p_id,gen_random_uuid()); cur public.modules; course uuid:=(p_data->>'course_id')::uuid;
begin
 if p_id is not null then
  select * into cur from public.modules where id=p_id for update;
  if cur.id is null or cur.version<>p_version then raise exception 'This module changed. Reload before saving.'; end if;
  course:=cur.course_id;
 end if;
 if not public.can_teach_course(course) then raise exception 'Tutor or staff access required'; end if;
 insert into public.modules(id,course_id,title,summary,sort_order) values(mid,course,trim(p_data->>'title'),coalesce(trim(p_data->>'summary'),''),coalesce((p_data->>'sort_order')::int,0))
 on conflict(id) do update set title=excluded.title,summary=excluded.summary,sort_order=excluded.sort_order,version=public.modules.version+1,updated_at=now();
 perform private.log('module_saved',mid::text,jsonb_build_object('before_version',cur.version,'data',p_data)); return mid;
end; $$;
create function public.delete_module(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare course uuid;
begin select course_id into course from public.modules where id=p_id for update;
 if course is null then raise exception 'Module not found'; end if;
 if not public.can_teach_course(course) then raise exception 'Tutor or staff access required'; end if;
 delete from public.modules where id=p_id; perform private.log('module_deleted',p_id::text);
end; $$;
create function public.save_material(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid:=coalesce(p_id,gen_random_uuid()); cur public.materials; course uuid:=(p_data->>'course_id')::uuid; module uuid:=nullif(p_data->>'module_id','')::uuid; path text:=coalesce(p_data->>'file_path','');
begin
 if p_id is not null then
  select * into cur from public.materials where id=p_id for update;
  if cur.id is null or cur.version<>p_version then raise exception 'This material changed. Reload before saving.'; end if;
  course:=cur.course_id;
 end if;
 if not public.can_teach_course(course) then raise exception 'Tutor or staff access required'; end if;
 if module is not null and not exists(select 1 from public.modules where id=module and course_id=course) then raise exception 'Module belongs to another course'; end if;
 if path<>'' and path not like 'materials/'||course||'/%' then raise exception 'Invalid file location'; end if;
 insert into public.materials(id,course_id,module_id,title,kind,body,url,file_path,file_name,published,sort_order,created_by)
 values(mid,course,module,trim(p_data->>'title'),p_data->>'kind',coalesce(p_data->>'body',''),coalesce(trim(p_data->>'url'),''),path,coalesce(p_data->>'file_name',''),coalesce((p_data->>'published')::boolean,true),coalesce((p_data->>'sort_order')::int,0),auth.uid())
 on conflict(id) do update set module_id=excluded.module_id,title=excluded.title,kind=excluded.kind,body=excluded.body,url=excluded.url,file_path=excluded.file_path,file_name=excluded.file_name,published=excluded.published,sort_order=excluded.sort_order,version=public.materials.version+1,updated_at=now();
 perform private.log('material_saved',mid::text,jsonb_build_object('before_version',cur.version,'title',p_data->>'title')); return mid;
end; $$;
create function public.delete_material(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare course uuid;
begin select course_id into course from public.materials where id=p_id for update;
 if course is null then raise exception 'Material not found'; end if;
 if not public.can_teach_course(course) then raise exception 'Tutor or staff access required'; end if;
 delete from public.materials where id=p_id; perform private.log('material_deleted',p_id::text);
end; $$;

-- Assignments and submissions
create function public.save_assignment(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare aid uuid:=coalesce(p_id,gen_random_uuid()); cur public.assignments; cohort uuid:=(p_data->>'cohort_id')::uuid; module uuid:=nullif(p_data->>'module_id','')::uuid;
begin
 if p_id is not null then
  select * into cur from public.assignments where id=p_id for update;
  if cur.id is null or cur.version<>p_version then raise exception 'This assignment changed. Reload before saving.'; end if;
  cohort:=cur.cohort_id;
 end if;
 if not public.can_teach_cohort(cohort) then raise exception 'Tutor or staff access required'; end if;
 if module is not null and not exists(select 1 from public.modules m join public.cohorts h on h.course_id=m.course_id where m.id=module and h.id=cohort) then raise exception 'Module belongs to another course'; end if;
 insert into public.assignments(id,cohort_id,module_id,title,instructions,due_at,max_points,submission_type,published,created_by)
 values(aid,cohort,module,trim(p_data->>'title'),coalesce(p_data->>'instructions',''),nullif(p_data->>'due_at','')::timestamptz,nullif(p_data->>'max_points','')::int,coalesce(p_data->>'submission_type','any'),coalesce((p_data->>'published')::boolean,false),auth.uid())
 on conflict(id) do update set module_id=excluded.module_id,title=excluded.title,instructions=excluded.instructions,due_at=excluded.due_at,max_points=excluded.max_points,submission_type=excluded.submission_type,published=excluded.published,version=public.assignments.version+1,updated_at=now();
 perform private.log('assignment_saved',aid::text,jsonb_build_object('before_version',cur.version,'title',p_data->>'title')); return aid;
end; $$;
create function public.delete_assignment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cohort uuid;
begin select cohort_id into cohort from public.assignments where id=p_id for update;
 if cohort is null then raise exception 'Assignment not found'; end if;
 if not public.can_teach_cohort(cohort) then raise exception 'Tutor or staff access required'; end if;
 if exists(select 1 from public.submissions where assignment_id=p_id) then raise exception 'This assignment has submissions. Unpublish it instead.'; end if;
 delete from public.assignments where id=p_id; perform private.log('assignment_deleted',p_id::text);
end; $$;
-- Learners may resubmit until graded; a tutor can return work for revision to reopen it.
create function public.submit_assignment(p_assignment uuid,p_body text,p_url text,p_file_path text,p_file_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.assignments; prior public.submissions; sid uuid; body text:=coalesce(trim(p_body),''); link text:=coalesce(trim(p_url),''); path text:=coalesce(p_file_path,'');
begin
 select * into a from public.assignments where id=p_assignment;
 if a.id is null or not a.published or not private.is_active_learner(a.cohort_id,auth.uid()) then raise exception 'Assignment not available'; end if;
 if a.submission_type='file' and path='' then raise exception 'Attach a file';
 elsif a.submission_type='link' and link='' then raise exception 'Add a link';
 elsif a.submission_type='text' and body='' then raise exception 'Write your response';
 elsif body='' and link='' and path='' then raise exception 'Add a file, link or response'; end if;
 if path<>'' and path not like 'submissions/'||a.cohort_id||'/'||a.id||'/'||auth.uid()||'/%' then raise exception 'Invalid file location'; end if;
 select * into prior from public.submissions where assignment_id=a.id and user_id=auth.uid() for update;
 if prior.status='graded' then raise exception 'This assignment has been graded. Ask your tutor to reopen it.'; end if;
 insert into public.submissions(assignment_id,cohort_id,user_id,body,url,file_path,file_name)
 values(a.id,a.cohort_id,auth.uid(),body,link,path,coalesce(p_file_name,''))
 on conflict(assignment_id,user_id) do update set body=excluded.body,url=excluded.url,file_path=excluded.file_path,file_name=excluded.file_name,status='submitted',score=null,graded_by=null,graded_at=null,submitted_at=now()
 returning id into sid;
 perform private.log('assignment_submitted',sid::text,jsonb_build_object('assignment_id',a.id)); return sid;
end; $$;
create function public.grade_submission(p_submission uuid,p_score numeric,p_feedback text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare s public.submissions; maximum integer;
begin
 select * into s from public.submissions where id=p_submission for update;
 if s.id is null then raise exception 'Submission not found'; end if;
 if not public.can_teach_cohort(s.cohort_id) then raise exception 'Tutor or staff access required'; end if;
 if p_status not in ('graded','returned') then raise exception 'Choose graded or returned'; end if;
 select max_points into maximum from public.assignments where id=s.assignment_id;
 if maximum is null and p_score is not null then raise exception 'This assignment is feedback-only';
 elsif maximum is not null and p_status='graded' and (p_score is null or p_score<0 or p_score>maximum) then raise exception 'Enter a score between 0 and %',maximum; end if;
 update public.submissions set status=p_status,score=case when p_status='graded' then p_score end,feedback=coalesce(p_feedback,''),graded_by=auth.uid(),graded_at=now() where id=s.id;
 perform private.log('submission_'||p_status,s.id::text,jsonb_build_object('score',p_score));
end; $$;

-- Class sessions and attendance
create function public.save_session(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=coalesce(p_id,gen_random_uuid()); cur public.class_sessions; cohort uuid:=(p_data->>'cohort_id')::uuid;
begin
 if p_id is not null then
  select * into cur from public.class_sessions where id=p_id for update;
  if cur.id is null or cur.version<>p_version then raise exception 'This session changed. Reload before saving.'; end if;
  cohort:=cur.cohort_id;
 end if;
 if not public.can_teach_cohort(cohort) then raise exception 'Tutor or staff access required'; end if;
 insert into public.class_sessions(id,cohort_id,title,starts_at,ends_at,location,notes)
 values(sid,cohort,trim(p_data->>'title'),(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,coalesce(trim(p_data->>'location'),''),coalesce(p_data->>'notes',''))
 on conflict(id) do update set title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,notes=excluded.notes,version=public.class_sessions.version+1,updated_at=now();
 perform private.log('session_saved',sid::text,jsonb_build_object('before_version',cur.version,'data',p_data)); return sid;
end; $$;
create function public.delete_session(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cohort uuid;
begin select cohort_id into cohort from public.class_sessions where id=p_id for update;
 if cohort is null then raise exception 'Session not found'; end if;
 if not public.can_teach_cohort(cohort) then raise exception 'Tutor or staff access required'; end if;
 delete from public.class_sessions where id=p_id; perform private.log('session_deleted',p_id::text);
end; $$;
create function public.mark_attendance(p_session uuid,p_records jsonb) returns void language plpgsql security definer set search_path='' as $$
declare cohort uuid; r jsonb;
begin
 select cohort_id into cohort from public.class_sessions where id=p_session for update;
 if cohort is null then raise exception 'Session not found'; end if;
 if not public.can_teach_cohort(cohort) then raise exception 'Tutor or staff access required'; end if;
 if jsonb_typeof(p_records)<>'array' then raise exception 'Invalid attendance'; end if;
 for r in select * from jsonb_array_elements(p_records) loop
  if not exists(select 1 from public.cohort_members where cohort_id=cohort and user_id=(r->>'user_id')::uuid and role='learner') then raise exception 'Not a learner in this cohort'; end if;
  insert into public.attendance(session_id,cohort_id,user_id,status,note,marked_by) values(p_session,cohort,(r->>'user_id')::uuid,r->>'status',coalesce(r->>'note',''),auth.uid())
  on conflict(session_id,user_id) do update set status=excluded.status,note=excluded.note,marked_by=excluded.marked_by,marked_at=now();
 end loop;
 perform private.log('attendance_marked',p_session::text,jsonb_build_object('records',jsonb_array_length(p_records)));
end; $$;

-- Progress for tutors and staff: one row per learner in the cohort.
create function public.cohort_progress(p_cohort uuid) returns table(user_id uuid,full_name text,email text,status text,assignments integer,submitted integer,graded integer,score_percent numeric,sessions_marked integer,attended integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_teach_cohort(p_cohort) then raise exception 'Tutor or staff access required'; end if;
 return query select m.user_id,p.full_name,p.email,m.status,
  (select count(*)::int from public.assignments a where a.cohort_id=p_cohort and a.published),
  (select count(*)::int from public.submissions s where s.cohort_id=p_cohort and s.user_id=m.user_id),
  (select count(*)::int from public.submissions s where s.cohort_id=p_cohort and s.user_id=m.user_id and s.status='graded'),
  (select round(avg(s.score/a.max_points*100),1) from public.submissions s join public.assignments a on a.id=s.assignment_id where s.cohort_id=p_cohort and s.user_id=m.user_id and s.status='graded' and a.max_points is not null),
  (select count(*)::int from public.attendance t where t.cohort_id=p_cohort and t.user_id=m.user_id and t.status<>'excused'),
  (select count(*)::int from public.attendance t where t.cohort_id=p_cohort and t.user_id=m.user_id and t.status in ('present','late'))
 from public.cohort_members m join public.profiles p on p.id=m.user_id where m.cohort_id=p_cohort and m.role='learner' order by p.full_name,p.email;
end; $$;
create function public.learning_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform private.require_staff();
 return jsonb_build_object(
  'programs',(select count(*) from public.programs where active),
  'courses',(select count(*) from public.courses where active),
  'active_cohorts',(select count(*) from public.cohorts where status='active'),
  'learners',(select count(distinct user_id) from public.cohort_members m join public.cohorts h on h.id=m.cohort_id where m.role='learner' and m.status='active' and h.status in ('planned','active')),
  'tutors',(select count(distinct user_id) from public.cohort_members m join public.cohorts h on h.id=m.cohort_id where m.role='tutor' and m.status='active' and h.status in ('planned','active')),
  'to_grade',(select count(*) from public.submissions where status='submitted'),
  'sessions_this_week',(select count(*) from public.class_sessions where starts_at>=date_trunc('week',now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi' and starts_at<(date_trunc('week',now() at time zone 'Africa/Nairobi')+interval '7 days') at time zone 'Africa/Nairobi'));
end; $$;

-- Files: one private bucket. materials/{course}/… for curriculum files,
-- submissions/{cohort}/{assignment}/{learner}/… for learner work.
insert into storage.buckets(id,name,public,file_size_limit) values('learning-files','learning-files',false,52428800) on conflict(id) do nothing;
create function public.learning_file_access(p_name text,p_write boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare part text[]:=string_to_array(p_name,'/');
begin
 if part[1]='materials' and cardinality(part)>=3 then
  return case when p_write then public.can_teach_course(part[2]::uuid) else public.in_course(part[2]::uuid) end;
 elsif part[1]='submissions' and cardinality(part)>=5 then
  if p_write then return part[4]::uuid=auth.uid() and private.is_active_learner(part[2]::uuid,auth.uid())
   and exists(select 1 from public.assignments where id=part[3]::uuid and cohort_id=part[2]::uuid and published); end if;
  return part[4]::uuid=auth.uid() or public.can_teach_cohort(part[2]::uuid);
 end if;
 return false;
exception when invalid_text_representation then return false;
end; $$;
create policy learning_files_read on storage.objects for select to authenticated using(bucket_id='learning-files' and public.learning_file_access(name,false));
create policy learning_files_insert on storage.objects for insert to authenticated with check(bucket_id='learning-files' and public.learning_file_access(name,true));
create policy learning_files_delete on storage.objects for delete to authenticated using(bucket_id='learning-files' and public.learning_file_access(name,true));

revoke all on function public.can_teach_cohort(uuid),public.can_teach_course(uuid),public.in_course(uuid),private.is_active_learner(uuid,uuid),
 public.save_module(uuid,integer,jsonb),public.delete_module(uuid),public.save_material(uuid,integer,jsonb),public.delete_material(uuid),
 public.save_assignment(uuid,integer,jsonb),public.delete_assignment(uuid),public.submit_assignment(uuid,text,text,text,text),public.grade_submission(uuid,numeric,text,text),
 public.save_session(uuid,integer,jsonb),public.delete_session(uuid),public.mark_attendance(uuid,jsonb),public.cohort_progress(uuid),public.learning_overview(),
 public.learning_file_access(text,boolean) from public,anon,authenticated;
grant execute on function public.can_teach_cohort(uuid),public.can_teach_course(uuid),public.in_course(uuid),
 public.save_module(uuid,integer,jsonb),public.delete_module(uuid),public.save_material(uuid,integer,jsonb),public.delete_material(uuid),
 public.save_assignment(uuid,integer,jsonb),public.delete_assignment(uuid),public.submit_assignment(uuid,text,text,text,text),public.grade_submission(uuid,numeric,text,text),
 public.save_session(uuid,integer,jsonb),public.delete_session(uuid),public.mark_attendance(uuid,jsonb),public.cohort_progress(uuid),public.learning_overview(),
 public.learning_file_access(text,boolean) to authenticated;
commit;

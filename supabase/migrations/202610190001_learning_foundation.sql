begin;
-- Santuri Learning Portal foundation: programs → courses → cohorts → cohort members.
-- Runs in the shared santuri-bookings Supabase project and reuses its public.profiles,
-- public.is_staff(), private.require_staff() and private.log(). One account per person:
-- Santuri staff administer learning; tutors and learners are assigned per cohort, so the
-- same person can study in one cohort and teach in another. Booking "Student access"
-- (private.students) is unrelated to cohort enrollment and is not changed here.

create table public.programs (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check(length(name) between 1 and 120), summary text not null default '' check(length(summary)<=2000),
 active boolean not null default true, sort_order integer not null default 0, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.courses (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.programs(id),
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null check(length(title) between 1 and 160),
 summary text not null default '' check(length(summary)<=4000),
 format text not null default 'course' check(format in ('course','workshop','lab','masterclass')),
 active boolean not null default true, sort_order integer not null default 0, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(program_id,slug)
);
create index courses_program on public.courses(program_id);
-- A cohort is one run of a course: a SEMA intake, an IML workshop date, a masterclass.
create table public.cohorts (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
 name text not null check(length(name) between 1 and 120), starts_on date, ends_on date,
 status text not null default 'planned' check(status in ('planned','active','completed','archived')),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(starts_on is null or ends_on is null or ends_on>=starts_on)
);
create index cohorts_course on public.cohorts(course_id);
create table public.cohort_members (
 cohort_id uuid not null references public.cohorts(id), user_id uuid not null references public.profiles(id),
 role text not null check(role in ('learner','tutor')), status text not null default 'active' check(status in ('active','completed','withdrawn')),
 added_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(cohort_id,user_id)
);
create index cohort_members_user on public.cohort_members(user_id);

alter table public.programs enable row level security;
alter table public.courses enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
revoke all on public.programs,public.courses,public.cohorts,public.cohort_members from anon,authenticated;
grant select on public.programs,public.courses,public.cohorts,public.cohort_members to authenticated;
grant all on public.programs,public.courses,public.cohorts,public.cohort_members to service_role;

-- Caller's role in a cohort; security definer so cohort_members policies do not recurse.
create function public.my_cohort_role(p_cohort uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.cohort_members where cohort_id=p_cohort and user_id=auth.uid() and status<>'withdrawn'; $$;

create policy read_programs on public.programs for select to authenticated using(active or public.is_staff());
create policy read_courses on public.courses for select to authenticated using(active or public.is_staff());
create policy read_cohorts on public.cohorts for select to authenticated using(public.is_staff() or public.my_cohort_role(id) is not null);
create policy read_cohort_members on public.cohort_members for select to authenticated
 using(user_id=auth.uid() or public.is_staff() or public.my_cohort_role(cohort_id)='tutor');

create function public.save_program(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid:=coalesce(p_id,gen_random_uuid()); current_version integer;
begin perform private.require_staff();
 if p_id is not null then
  select version into current_version from public.programs where id=p_id for update;
  if current_version is null or current_version<>p_version then raise exception 'This program changed. Reload before saving.'; end if;
 end if;
 insert into public.programs(id,slug,name,summary,active,sort_order)
 values(pid,p_data->>'slug',trim(p_data->>'name'),coalesce(trim(p_data->>'summary'),''),coalesce((p_data->>'active')::boolean,true),coalesce((p_data->>'sort_order')::int,0))
 on conflict(id) do update set slug=excluded.slug,name=excluded.name,summary=excluded.summary,active=excluded.active,sort_order=excluded.sort_order,version=public.programs.version+1,updated_at=now();
 perform private.log('program_saved',pid::text,jsonb_build_object('before_version',current_version,'data',p_data)); return pid;
end; $$;

create function public.save_course(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=coalesce(p_id,gen_random_uuid()); current_version integer;
begin perform private.require_staff();
 if p_id is not null then
  select version into current_version from public.courses where id=p_id for update;
  if current_version is null or current_version<>p_version then raise exception 'This course changed. Reload before saving.'; end if;
 end if;
 insert into public.courses(id,program_id,slug,title,summary,format,active,sort_order)
 values(cid,(p_data->>'program_id')::uuid,p_data->>'slug',trim(p_data->>'title'),coalesce(trim(p_data->>'summary'),''),coalesce(p_data->>'format','course'),coalesce((p_data->>'active')::boolean,true),coalesce((p_data->>'sort_order')::int,0))
 on conflict(id) do update set program_id=excluded.program_id,slug=excluded.slug,title=excluded.title,summary=excluded.summary,format=excluded.format,active=excluded.active,sort_order=excluded.sort_order,version=public.courses.version+1,updated_at=now();
 perform private.log('course_saved',cid::text,jsonb_build_object('before_version',current_version,'data',p_data)); return cid;
end; $$;

create function public.save_cohort(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare hid uuid:=coalesce(p_id,gen_random_uuid()); current_version integer;
begin perform private.require_staff();
 if p_id is not null then
  select version into current_version from public.cohorts where id=p_id for update;
  if current_version is null or current_version<>p_version then raise exception 'This cohort changed. Reload before saving.'; end if;
 end if;
 insert into public.cohorts(id,course_id,name,starts_on,ends_on,status)
 values(hid,(p_data->>'course_id')::uuid,trim(p_data->>'name'),nullif(p_data->>'starts_on','')::date,nullif(p_data->>'ends_on','')::date,coalesce(p_data->>'status','planned'))
 on conflict(id) do update set course_id=excluded.course_id,name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,status=excluded.status,version=public.cohorts.version+1,updated_at=now();
 perform private.log('cohort_saved',hid::text,jsonb_build_object('before_version',current_version,'data',p_data)); return hid;
end; $$;

create function public.set_cohort_member(p_cohort uuid,p_user uuid,p_role text,p_status text default 'active') returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_staff();
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'Member not found'; end if;
 insert into public.cohort_members(cohort_id,user_id,role,status) values(p_cohort,p_user,p_role,coalesce(p_status,'active'))
 on conflict(cohort_id,user_id) do update set role=excluded.role,status=excluded.status,updated_at=now();
 perform private.log('cohort_member_set',p_cohort::text,jsonb_build_object('user_id',p_user,'role',p_role,'status',p_status));
end; $$;

-- Removal is for mistaken assignments; use status 'withdrawn' to keep a learner's history.
create function public.remove_cohort_member(p_cohort uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_staff();
 delete from public.cohort_members where cohort_id=p_cohort and user_id=p_user;
 if not found then raise exception 'Member is not in this cohort'; end if;
 perform private.log('cohort_member_removed',p_cohort::text,jsonb_build_object('user_id',p_user));
end; $$;

-- Staff and the cohort's tutors see names and emails; learners see only their own rows.
create function public.cohort_roster(p_cohort uuid) returns table(user_id uuid,full_name text,email text,role text,status text,added_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.is_staff() or public.my_cohort_role(p_cohort) is not distinct from 'tutor') then raise exception 'Tutor or staff access required'; end if;
 return query select m.user_id,p.full_name,p.email,m.role,m.status,m.added_at from public.cohort_members m join public.profiles p on p.id=m.user_id
  where m.cohort_id=p_cohort order by m.role desc,p.full_name,p.email;
end; $$;

create function public.search_people(p_query text) returns table(id uuid,full_name text,email text) language plpgsql stable security definer set search_path='' as $$
declare q text:=trim(coalesce(p_query,''));
begin perform private.require_staff();
 if length(q)<2 then raise exception 'Type at least two characters'; end if;
 q:='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 return query select p.id,p.full_name,p.email from public.profiles p where p.full_name ilike q or p.email ilike q order by p.full_name,p.email limit 20;
end; $$;

revoke all on function public.my_cohort_role(uuid),public.save_program(uuid,integer,jsonb),public.save_course(uuid,integer,jsonb),public.save_cohort(uuid,integer,jsonb),
 public.set_cohort_member(uuid,uuid,text,text),public.remove_cohort_member(uuid,uuid),public.cohort_roster(uuid),public.search_people(text) from public,anon,authenticated;
grant execute on function public.my_cohort_role(uuid),public.save_program(uuid,integer,jsonb),public.save_course(uuid,integer,jsonb),public.save_cohort(uuid,integer,jsonb),
 public.set_cohort_member(uuid,uuid,text,text),public.remove_cohort_member(uuid,uuid),public.cohort_roster(uuid),public.search_people(text) to authenticated;
commit;

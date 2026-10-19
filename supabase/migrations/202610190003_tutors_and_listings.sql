begin;
-- Tutor list: staff keep a roster of Santuri tutors to pick from when staffing cohorts.
-- Being listed grants no access by itself; teaching access still comes from a cohort assignment.
create table public.tutors (
 user_id uuid primary key references public.profiles(id), added_at timestamptz not null default now()
);
alter table public.tutors enable row level security;
revoke all on public.tutors from anon,authenticated;
grant select on public.tutors to authenticated;
grant all on public.tutors to service_role;
create policy read_tutors on public.tutors for select to authenticated using(public.is_staff());
insert into public.tutors(user_id) select distinct user_id from public.cohort_members where role='tutor' on conflict do nothing;

create function public.set_tutor(p_user uuid,p_tutor boolean) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_staff();
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'Member not found'; end if;
 if p_tutor then insert into public.tutors(user_id) values(p_user) on conflict do nothing;
 else delete from public.tutors where user_id=p_user; end if;
 perform private.log(case when p_tutor then 'tutor_listed' else 'tutor_unlisted' end,p_user::text);
end; $$;
create function public.list_tutors() returns table(user_id uuid,full_name text,email text,added_at timestamptz,teaching integer)
language plpgsql stable security definer set search_path='' as $$
begin perform private.require_staff();
 return query select t.user_id,p.full_name,p.email,t.added_at,
  (select count(*)::int from public.cohort_members m join public.cohorts h on h.id=m.cohort_id where m.user_id=t.user_id and m.role='tutor' and m.status='active' and h.status in ('planned','active'))
 from public.tutors t join public.profiles p on p.id=t.user_id order by p.full_name,p.email;
end; $$;

-- Assigning someone as a cohort tutor also puts them on the tutor list.
create or replace function public.set_cohort_member(p_cohort uuid,p_user uuid,p_role text,p_status text default 'active') returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_staff();
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'Member not found'; end if;
 insert into public.cohort_members(cohort_id,user_id,role,status) values(p_cohort,p_user,p_role,coalesce(p_status,'active'))
 on conflict(cohort_id,user_id) do update set role=excluded.role,status=excluded.status,updated_at=now();
 if p_role='tutor' then insert into public.tutors(user_id) values(p_user) on conflict do nothing; end if;
 perform private.log('cohort_member_set',p_cohort::text,jsonb_build_object('user_id',p_user,'role',p_role,'status',p_status));
end; $$;

-- Public listings: staff choose which cohorts appear as posters on the landing page.
alter table public.cohorts
 add column listed boolean not null default false,
 add column blurb text not null default '' check(length(blurb)<=600),
 add column location text not null default '' check(length(location)<=200),
 add column apply_url text not null default '' check(apply_url='' or apply_url ~ '^https?://'),
 add column poster_path text not null default '' check(poster_path='' or poster_path ~ '^posters/[A-Za-z0-9._/-]+$');

create or replace function public.save_cohort(p_id uuid,p_version integer,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare hid uuid:=coalesce(p_id,gen_random_uuid()); current_version integer;
begin perform private.require_staff();
 if p_id is not null then
  select version into current_version from public.cohorts where id=p_id for update;
  if current_version is null or current_version<>p_version then raise exception 'This cohort changed. Reload before saving.'; end if;
 end if;
 insert into public.cohorts(id,course_id,name,starts_on,ends_on,status,listed,blurb,location,apply_url,poster_path)
 values(hid,(p_data->>'course_id')::uuid,trim(p_data->>'name'),nullif(p_data->>'starts_on','')::date,nullif(p_data->>'ends_on','')::date,coalesce(p_data->>'status','planned'),
  coalesce((p_data->>'listed')::boolean,false),coalesce(trim(p_data->>'blurb'),''),coalesce(trim(p_data->>'location'),''),coalesce(trim(p_data->>'apply_url'),''),coalesce(p_data->>'poster_path',''))
 on conflict(id) do update set course_id=excluded.course_id,name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,status=excluded.status,
  listed=excluded.listed,blurb=excluded.blurb,location=excluded.location,apply_url=excluded.apply_url,poster_path=excluded.poster_path,version=public.cohorts.version+1,updated_at=now();
 perform private.log('cohort_saved',hid::text,jsonb_build_object('before_version',current_version,'data',p_data)); return hid;
end; $$;

-- Anyone, signed in or not, can read listed cohorts that have not finished yet. No people or private data.
create function public.upcoming_listings() returns table(cohort_id uuid,cohort_name text,starts_on date,ends_on date,status text,blurb text,location text,apply_url text,poster_path text,course_title text,course_summary text,format text,program_name text,program_slug text)
language sql stable security definer set search_path='' as $$
 select h.id,h.name,h.starts_on,h.ends_on,h.status,h.blurb,h.location,h.apply_url,h.poster_path,c.title,c.summary,c.format,p.name,p.slug
 from public.cohorts h join public.courses c on c.id=h.course_id join public.programs p on p.id=c.program_id
 where h.listed and h.status in ('planned','active') and c.active and p.active
  and (h.ends_on is null or h.ends_on>=(now() at time zone 'Africa/Nairobi')::date)
 order by h.starts_on nulls last,c.title; $$;

-- Posters are public images; only staff upload or remove them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('learning-posters','learning-posters',true,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
create policy learning_posters_read on storage.objects for select to authenticated using(bucket_id='learning-posters');
create policy learning_posters_insert on storage.objects for insert to authenticated with check(bucket_id='learning-posters' and name like 'posters/%' and public.is_staff());
create policy learning_posters_delete on storage.objects for delete to authenticated using(bucket_id='learning-posters' and public.is_staff());

revoke all on function public.set_tutor(uuid,boolean),public.list_tutors(),public.upcoming_listings() from public,anon,authenticated;
grant execute on function public.set_tutor(uuid,boolean),public.list_tutors() to authenticated;
grant execute on function public.upcoming_listings() to anon,authenticated;
commit;

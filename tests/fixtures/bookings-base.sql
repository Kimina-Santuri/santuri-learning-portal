-- Minimal copy of the santuri-bookings objects the learning migrations depend on
-- (see santuri-bookings supabase/migrations/202609070001_booking_system.sql and 202609230001_profile_phone.sql).
-- Tests only: the real objects already exist in the shared Supabase project.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null default '' check(length(full_name)<=150),
 email text not null, alumni boolean not null default false, phone text not null default '', created_at timestamptz not null default now()
);
create table private.staff (user_id uuid primary key references public.profiles(id));
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.staff where user_id=auth.uid()); $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email,full_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),150)); return new; end; $$;
create trigger santuri_new_user after insert on auth.users for each row execute function private.new_user();
create table public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid, action text not null, entity_id text,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.audit_log to authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
create policy read_profile on public.profiles for select to authenticated using(id=auth.uid() or public.is_staff());
create policy read_audit on public.audit_log for select to authenticated using(public.is_staff());
create function private.require_staff() returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_staff() then raise exception 'Staff access required'; end if; end; $$;
create function private.log(p_action text,p_id text,p_details jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),p_action,p_id,p_details); $$;
revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function public.is_staff() to anon,authenticated;

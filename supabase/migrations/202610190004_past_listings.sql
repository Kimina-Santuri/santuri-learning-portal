begin;
-- Past listings for the landing page's Upcoming / Past switch: listed cohorts that have
-- finished (completed, or past their end date). Archiving a cohort hides it everywhere.
create function public.past_listings() returns table(cohort_id uuid,cohort_name text,starts_on date,ends_on date,status text,blurb text,location text,apply_url text,poster_path text,course_title text,course_summary text,format text,program_name text,program_slug text)
language sql stable security definer set search_path='' as $$
 select h.id,h.name,h.starts_on,h.ends_on,h.status,h.blurb,h.location,h.apply_url,h.poster_path,c.title,c.summary,c.format,p.name,p.slug
 from public.cohorts h join public.courses c on c.id=h.course_id join public.programs p on p.id=c.program_id
 where h.listed and c.active and p.active and h.status<>'archived'
  and (h.status='completed' or h.ends_on<(now() at time zone 'Africa/Nairobi')::date)
 order by coalesce(h.ends_on,h.starts_on) desc nulls last,c.title
 limit 60; $$;
revoke all on function public.past_listings() from public,anon,authenticated;
grant execute on function public.past_listings() to anon,authenticated;
commit;

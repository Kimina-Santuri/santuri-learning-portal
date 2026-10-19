begin;
-- Staff deletions. Archive remains the reversible way to hide things; deleting is permanent.
-- Deletes go top-down: cohorts first, then a course with no cohorts, then a program with no courses.
-- A cohort with submissions or attendance needs its exact name typed as confirmation.
-- Every deletion is kept in the audit log.

create function public.delete_cohort(p_id uuid,p_confirm text default '') returns void language plpgsql security definer set search_path='' as $$
declare h public.cohorts; has_work boolean;
begin perform private.require_staff();
 select * into h from public.cohorts where id=p_id for update;
 if h.id is null then raise exception 'Cohort not found'; end if;
 has_work:=exists(select 1 from public.submissions where cohort_id=p_id) or exists(select 1 from public.attendance where cohort_id=p_id);
 if has_work and coalesce(trim(p_confirm),'')<>h.name then raise exception 'This cohort has learner work or attendance. Type the cohort name exactly to confirm.'; end if;
 delete from public.attendance where cohort_id=p_id;
 delete from public.class_sessions where cohort_id=p_id;
 delete from public.submissions where cohort_id=p_id;
 delete from public.assignments where cohort_id=p_id;
 delete from public.cohort_members where cohort_id=p_id;
 delete from public.cohorts where id=p_id;
 perform private.log('cohort_deleted',p_id::text,jsonb_build_object('name',h.name,'course_id',h.course_id,'had_learner_work',has_work));
end; $$;

create function public.delete_course(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.courses;
begin perform private.require_staff();
 select * into c from public.courses where id=p_id for update;
 if c.id is null then raise exception 'Course not found'; end if;
 if exists(select 1 from public.cohorts where course_id=p_id) then raise exception 'Delete or move this course''s cohorts first.'; end if;
 delete from public.materials where course_id=p_id;
 delete from public.modules where course_id=p_id;
 delete from public.courses where id=p_id;
 perform private.log('course_deleted',p_id::text,jsonb_build_object('title',c.title,'program_id',c.program_id));
end; $$;

create function public.delete_program(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.programs;
begin perform private.require_staff();
 select * into p from public.programs where id=p_id for update;
 if p.id is null then raise exception 'Program not found'; end if;
 if exists(select 1 from public.courses where program_id=p_id) then raise exception 'Delete or move this program''s courses first.'; end if;
 delete from public.programs where id=p_id;
 perform private.log('program_deleted',p_id::text,jsonb_build_object('name',p.name,'slug',p.slug));
end; $$;

-- Lets staff remove the files that belonged to deleted materials and submissions.
create policy learning_files_staff_delete on storage.objects for delete to authenticated using(bucket_id='learning-files' and public.is_staff());

revoke all on function public.delete_cohort(uuid,text),public.delete_course(uuid),public.delete_program(uuid) from public,anon,authenticated;
grant execute on function public.delete_cohort(uuid,text),public.delete_course(uuid),public.delete_program(uuid) to authenticated;
commit;

-- Programs confirmed for the first release. Staff add courses, cohorts and descriptions in the Admin dashboard.
insert into public.programs(slug,name,sort_order) values('sema','SEMA',1),('instrument-makers-lab','Instrument Makers Lab',2) on conflict(slug) do nothing;

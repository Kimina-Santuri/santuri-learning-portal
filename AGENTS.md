# Santuri Learning Portal — Agent Guide

## Project overview

Framework-free static portal (HTML/CSS/JS + supabase-js bundled by esbuild) for all Santuri educational programs: SEMA, Instrument Makers Lab and future programs. Same conventions as santuri-bookings (`../santuri-bookings-main`); keep it framework-free unless the user explicitly requests a migration.

## Working rules

- Keep changes local unless the user explicitly asks to commit, publish or push.
- The Supabase project is shared with santuri-bookings. Never modify or drop bookings tables/functions from this repo. New learning objects go in new migrations here.
- DDL is applied by the user in the Supabase SQL editor; do not run schema changes against the live project.
- Never put a secret or service-role key in frontend files. Only the publishable key belongs in `assets/js/config.js`.
- Booking "Student access" (`private.students`) is a bookings allowance role, unrelated to learning cohort enrollment.
- Do not invent program details, course content, dates or policies.
- Run `npm run build`, `npm run check` and `npm test` after JavaScript or database changes. Database tests use PGlite with `tests/fixtures/bookings-base.sql` standing in for the bookings objects; keep that fixture in sync if those objects change.

## Roadmap

1. Foundation: programs, courses, cohorts, cohort members (roles `learner` and `tutor`; the UI says "Learner", never "student"), staff admin.
2. Course workspace (`cohort.html`): curriculum (modules + materials, shared per course), assignments, submissions with file uploads, grading/feedback/return-for-revision, class sessions and attendance, learner progress, learner grades.
3. Tutor list (`public.tutors`, staff-only; listing grants no access, cohort assignment does) and the public landing page (`index.html`, posters for cohorts staff mark as listed, via the anon-safe `upcoming_listings()`; sign-in lives at `signin.html`).
4. Next candidates: announcements, email notifications, invitations for people without accounts (Edge Function), certificates, portfolios, analytics.

## State (2026-10-19)

- 2026-10-19: phases 1–3 pushed to https://github.com/Kimina-Santuri/santuri-learning-portal (public, main) and deployed by GitHub Actions to https://kimina-santuri.github.io/santuri-learning-portal/ (Pages source: GitHub Actions). The user applied all three migrations and the seed in the Supabase SQL editor the same day; verified via the public API.
- Contact/support email is admissions@santuri.org (`supportEmail` in config.js). robots.txt intentionally blocks indexing (user decision).
- Pending: add the Pages URLs (dashboard.html, reset-password.html) to Supabase Auth redirect URLs; custom domain not chosen yet.
- Local preview with sample data: `npm run dev`, then open `http://127.0.0.1:8081/index.html?preview`. `assets/js/preview-client.js` mimics the database rules in the browser and is excluded from `dist/`. Keep it in step with migrations when adding features.

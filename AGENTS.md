# Santuri Learning Portal — Agent Guide

## Project overview

Framework-free static portal (HTML/CSS/JS + supabase-js bundled by esbuild) for all Santuri educational programs: SEMA, Instrument Makers Lab and future programs. Same conventions as santuri-bookings (`../santuri-bookings-main`); keep it framework-free unless the user explicitly requests a migration.

Live at https://learn.santuri.org. Code: https://github.com/Kimina-Santuri/santuri-learning-portal (public, `main`).

## Working rules

- Keep changes local unless the user explicitly asks to commit, publish or push. Pushing to `main` deploys to production automatically (see Deployment).
- The Supabase project (`gudbkpwxszdtirewawep`) is shared with santuri-bookings. Never modify or drop bookings tables/functions from this repo. New learning objects go in new numbered migrations here.
- DDL is applied by the user in the Supabase SQL editor; do not run schema changes against the live project. Copy the new migration to the clipboard (`pbcopy`) for them. When a frontend change depends on a new migration, wait for the user to confirm it ran, verify it through the public REST API with the publishable key, and only then push, so the live site never calls a missing function.
- Never put a secret or service-role key in frontend files. Only the publishable key belongs in `assets/js/config.js`.
- Booking "Student access" (`private.students`) is a bookings allowance role, unrelated to learning cohort enrollment.
- Terminology: the UI says "Learner", never "student" (user decision). Database role values are `learner` and `tutor`.
- Do not invent program details, course content, dates or policies. Preview sample data is clearly labelled placeholder content.
- Run `npm run build`, `npm run check` and `npm test` after JavaScript or database changes. Database tests use PGlite with `tests/fixtures/bookings-base.sql` standing in for the bookings objects; keep that fixture in sync if those objects change.
- Keep `assets/js/preview-client.js` (local sample-data stand-in for Supabase) in step with every new table, RPC or rule, or the preview breaks.

## Structure

- Pages: `index.html` (public landing page: poster grid with Upcoming & running / Past switch and program filter), `signin.html`, `dashboard.html` (My learning), `cohort.html` (course workspace, role-adaptive), `admin.html` (staff), `reset-password.html`.
- JS: `ui.js` (shared shell, forms, session), `portal.js` (sign-in, dashboard, admin), `workspace.js` (course workspace), `landing.js`, `images.js` (client-side image resizing), `portal-utils.js` (formatting/labels), `supabase-client.js` (real client or preview), `site.js` (footer year, topographic canvas), `config.js`.
- Styles: `main.css` and `account.css` are copied from santuri-bookings; portal additions live in `portal.css`.
- Migrations (all applied to production, 2026-10-19):
  1. `202610190001_learning_foundation.sql`: programs, courses, cohorts, cohort_members, roster/search, staff save functions.
  2. `202610190002_learning_workspace.sql`: modules, materials, assignments, submissions, class_sessions, attendance, progress/overview, private `learning-files` bucket (50 MB/file) with path-based policies.
  3. `202610190003_tutors_and_listings.sql`: `public.tutors` list, cohort listing fields (listed, blurb, location, apply_url, poster_path), anon-safe `upcoming_listings()`, public `learning-posters` bucket (5 MB, images).
  4. `202610190004_past_listings.sql`: anon-safe `past_listings()`.
  5. `202610190005_deletions.sql`: `delete_cohort` (typed name required when learner work/attendance exists), `delete_course` (no cohorts), `delete_program` (no courses), staff delete policy on learning files.
  Plus `supabase/seed.sql` (SEMA, Instrument Makers Lab).

## Product decisions

- Staff (`private.staff` from bookings) administer everything and can act as tutor in any cohort. Tutors and learners are assigned per cohort; one person can learn in one cohort and teach in another. Any bookings account can sign in; it sees nothing until enrolled.
- Curriculum (modules/materials) belongs to the course and is shared by all its cohorts. Assignments, sessions and attendance belong to a cohort.
- Learners may resubmit until graded; "Return for revision" reopens a submission; grading locks it.
- Tutor list grants no access by itself; assigning someone as a cohort tutor also adds them to the list. Tutors can be assigned from the cohort dialog checkboxes, the Assign tutor link in the Cohorts list, the Tutors tab, or Cohorts → People.
- Landing page: listed cohorts that are planned/active and not ended show under Upcoming ("Running now" tag when active); completed or ended ones show under Past (greyed, "Ask about future dates"); archived never show. Without a registration link the poster offers a "Register interest" email.
- Images (JPEG/PNG/WebP) are resized in the browser before upload: posters to fit 1080×1350, material/submission photos to 2000 px, re-encoded WebP (JPEG fallback). Other files upload unchanged.
- Deletes are top-down and permanent; Archive is the reversible way to hide. All deletions are audit-logged.
- Contact/support email: admissions@santuri.org (`supportEmail` in config.js).
- `robots.txt` blocks indexing (user decision; keep it).

## Deployment

- GitHub Actions (`.github/workflows/deploy.yml`) builds, checks and tests on every push to `main`, then deploys `dist/` to GitHub Pages (source: GitHub Actions). `preview-client.js` is excluded from `dist/`.
- Custom domain learn.santuri.org: DNS at Cargo (santuri.org nameservers ns1/ns2.cargo.site), CNAME `learn` → `kimina-santuri.github.io`. Pages custom domain set via repo settings/API (the `CNAME` file only documents it); HTTPS enforced, certificate approved 2026-10-19.
- Supabase Auth redirect URLs include https://learn.santuri.org/dashboard.html and /reset-password.html (added by the user 2026-10-19).
- GitHub CLI is authenticated as Kimina-Santuri on this machine.

## Local preview

`npm run dev` serves the repo at http://127.0.0.1:8081. Add `?preview` to any page (e.g. `/dashboard.html?preview`) for sample data with a bar to switch between Staff/admin, Tutor, Learner and Signed out views; "Reset data" restores the samples. Preview only activates on 127.0.0.1/localhost and keeps uploads in memory for the current page.

## Roadmap

Done (2026-10-19): foundation and admin; course workspace (curriculum, assignments, submissions, grading, attendance, progress, grades); tutor list; landing page with posters and Upcoming/Past; deletions; image resizing; easier tutor assignment.

Next candidates: changes from the user's test run (pending), announcements, email notifications (deadlines, grades), invitations for people without accounts (Edge Function), certificates, portfolios, analytics, and a link to learn.santuri.org from the bookings site.

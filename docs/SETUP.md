# Setup

## 1. Database (shared santuri-bookings project)

The portal uses the existing Supabase project `gudbkpwxszdtirewawep`. Its migration builds on objects created by santuri-bookings (`public.profiles`, `public.is_staff()`, `private.require_staff()`, `private.log()`), so bookings migrations must already be applied (they are).

1. Open the Supabase dashboard → SQL editor.
2. Run the files in `supabase/migrations/` in order: `202610190001_learning_foundation.sql`, `202610190002_learning_workspace.sql`, `202610190003_tutors_and_listings.sql`.
3. Run `supabase/seed.sql` to add the SEMA and Instrument Makers Lab programs.

The migrations only add new tables (programs, courses, cohorts, cohort members, modules, materials, assignments, submissions, class sessions, attendance), functions, a tutor list, a private `learning-files` storage bucket (50 MB per file) and a public `learning-posters` bucket (images up to 5 MB) with their access policies. They do not modify any bookings table or function.

## 2. Auth redirect URLs

In Authentication → URL Configuration, add the portal's URLs to **Redirect URLs** (keep the existing bookings ones):

- `http://127.0.0.1:8081/dashboard.html` and `http://127.0.0.1:8081/reset-password.html` (local testing)
- the same two pages on the production domain once chosen (e.g. `https://learn.santuri.org/...`)

## 3. Staff

Staff are managed in santuri-bookings (Staff dashboard → Members). Anyone with Staff access there can use the learning Admin page.

## 4. Deploy

Create the GitHub repository `Kimina-Santuri/santuri-learning-portal`, push `main`, then in Settings → Pages set **Source: GitHub Actions**. The workflow builds, checks, tests and deploys `dist/`. For a custom domain, add a `CNAME` file containing the domain and the matching DNS record.

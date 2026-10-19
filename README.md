# Santuri Learning Portal

Framework-free learning and program management portal for Santuri East Africa's educational programs (SEMA, Instrument Makers Lab and future programs). It shares the Supabase project, account system and visual style of [santuri-bookings](https://github.com/Kimina-Santuri/santuri-bookings), so each person has one Santuri login.

## Local development

```sh
npm install
npm run build
npm test
npm run check
npm run dev
```

Open `http://127.0.0.1:8081`. Pages: `index.html` (public landing page with upcoming posters), `signin.html`, `dashboard.html` (My learning), `cohort.html` (course workspace), `admin.html` (staff) and `reset-password.html`. Add `?preview` to any page on 127.0.0.1 for a sample-data preview with no sign-in.

## Data model

- **Program** — SEMA, Instrument Makers Lab, …
- **Course** — a course, workshop, lab or masterclass within a program
- **Cohort** — one run of a course (an intake, a workshop date)
- **Cohort member** — a person in a cohort as `student` or `tutor`, with status `active`, `completed` or `withdrawn`

Santuri staff (the existing `private.staff` list from bookings) administer everything. Tutors see their cohort's roster; students see only their own enrollments. All writes go through checked database functions in `supabase/migrations/`.

See [docs/SETUP.md](docs/SETUP.md) for applying the database migration and deploying.

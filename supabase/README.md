# Supabase setup — do this once

## 1. Create the project
1. Go to supabase.com → sign up (free) → **New project**.
2. Pick any name/region, set a database password, and **save that password somewhere** (a password manager, not this repo) — you likely won't need it again, but it's the master DB password if you ever do.
3. Wait ~2 minutes for it to provision.

## 2. Run the schema
1. In the project, open **SQL Editor → New query**.
2. Paste the full contents of `supabase/schema.sql`, click **Run**.
3. New query again, paste `supabase/policies.sql`, click **Run**.

If either errors, stop and send me the exact error — don't re-run a partially-failed script blind, since `create table` isn't safe to run twice.

## 3. Create the first admin account
The schema deliberately never lets anyone become `admin` through signup (that's the point — it closes the hole where anyone could self-register as staff). So the very first admin has to be created by hand, once:

1. **Authentication → Users → Add user** (top right). Enter a real email you control and a strong password. Click Create.
2. Copy the new user's **UID** (shown in the users table).
3. Back in **SQL Editor → New query**, run (replacing the UUID):
   ```sql
   update public.profiles
   set role = 'admin', display_id = 'CH-STAFF-01', name = 'Admin'
   where id = 'PASTE-THE-UUID-HERE';
   ```
4. That email + the password you set is now the real admin login — replacing the old hardcoded `CH-STAFF-01` / `password123` default.

## 4. Set up free custom SMTP (for real password-reset emails)
Supabase's built-in mailer is capped at 2 emails/hour — fine for nothing beyond one test. Use Brevo's free tier (300 emails/day) instead:

1. Sign up free at brevo.com → **SMTP & API** → generate SMTP credentials.
2. In Supabase: **Authentication → Emails → SMTP Settings** → toggle "Enable Custom SMTP" → paste Brevo's host/port/username/SMTP key.
3. **Authentication → URL Configuration** → set Site URL to `http://localhost:5173` for now (update to your real domain once deployed), and add `http://localhost:5173/reset-password` to Redirect URLs.

## 5. What to send back
From **Settings → API**:
- **Project URL**
- **anon / public key**

Do **not** send me the `service_role` key or DB password — the anon key is the only one the frontend needs, and it's safe by design because every table is locked down with the RLS policies in `policies.sql`.

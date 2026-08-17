-- ============================================================
-- Citadel Highflyers UMS -- patch 10
-- Public admissions form. Unlike every other table in this app, this
-- one is written to by anonymous website visitors (not logged in),
-- so it's the one deliberate exception to "no table grants anything
-- to anon" from policies.sql. The tradeoff is scoped tightly: anon
-- can INSERT one application and nothing else -- no SELECT policy
-- exists for anon at all, not even to read back what they just
-- submitted, so a submitted application can never be scraped or
-- enumerated from the public site. Only admins can read.
--
-- The client generates the row's id itself (crypto.randomUUID())
-- before inserting, so it can upload the photo to a path derived
-- from that id and insert the row in one shot -- no "insert, read
-- back the generated id, then upload" round trip that would require
-- a SELECT policy just to support the round trip.
-- ============================================================

create table if not exists public.admission_applications (
  id uuid primary key,
  surname text not null,
  first_name text not null,
  other_names text,
  sex text not null check (sex in ('Male', 'Female')),
  date_of_birth date not null,
  home_address text not null,
  nationality text not null,
  state_of_origin text not null,
  lga text not null,
  religion text,
  blood_group text,
  genotype text,
  father_name text,
  father_occupation text,
  father_office_address text,
  father_phone text,
  mother_name text,
  mother_occupation text,
  mother_office_address text,
  mother_phone text,
  health_challenge text,
  health_challenge_details text,
  school_last_attended text,
  pickup_person text not null,
  pickup_phone text not null,
  sibling_names text,
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'admitted', 'declined')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admission_applications enable row level security;

grant insert on public.admission_applications to anon, authenticated;
grant select, update on public.admission_applications to authenticated;

drop policy if exists "anyone can submit an application" on public.admission_applications;
create policy "anyone can submit an application"
  on public.admission_applications for insert
  with check (true);

drop policy if exists "admins view applications" on public.admission_applications;
create policy "admins view applications"
  on public.admission_applications for select
  using (public.current_role() = 'admin');

drop policy if exists "admins review applications" on public.admission_applications;
create policy "admins review applications"
  on public.admission_applications for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('admission-photos', 'admission-photos', false)
on conflict (id) do nothing;

drop policy if exists "anyone can upload an admission photo" on storage.objects;
create policy "anyone can upload an admission photo"
  on storage.objects for insert
  with check (bucket_id = 'admission-photos');

drop policy if exists "admins read admission photos" on storage.objects;
create policy "admins read admission photos"
  on storage.objects for select
  using (bucket_id = 'admission-photos' and public.current_role() = 'admin');

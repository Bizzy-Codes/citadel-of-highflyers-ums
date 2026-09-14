-- ============================================================
-- Citadel Highflyers UMS -- patch 22
--
-- Pupil bio/guardian details live on the profile.
--
-- Until now, everything a family filled in on the admissions form
-- (blood group, genotype, parents, pickup contacts, address) stayed
-- locked inside admission_applications, so once a pupil was admitted
-- the admin's Pupil Profile screen showed nothing but name, phone and
-- class. These columns put that data where the school actually needs
-- it -- on the pupil's own record -- so it can be viewed, edited,
-- printed, and exported.
--
-- The same columns are filled by returning pupils who create their own
-- account (the sign-up form now asks for them) and by the admit step
-- (which copies them across from the application).
--
-- Privacy: profiles already restricts SELECT to the owner, the class
-- teacher, and admins -- exactly who should see a child's blood group
-- and emergency contacts -- so no new policies are needed.
-- ============================================================

-- Child
alter table public.profiles add column if not exists sex text
  check (sex is null or sex in ('Male', 'Female'));
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists home_address text;
alter table public.profiles add column if not exists nationality text;
alter table public.profiles add column if not exists state_of_origin text;
alter table public.profiles add column if not exists lga text;
alter table public.profiles add column if not exists religion text;
alter table public.profiles add column if not exists blood_group text;
alter table public.profiles add column if not exists genotype text;
alter table public.profiles add column if not exists health_notes text;

-- Father
alter table public.profiles add column if not exists father_name text;
alter table public.profiles add column if not exists father_occupation text;
alter table public.profiles add column if not exists father_phone text;

-- Mother
alter table public.profiles add column if not exists mother_name text;
alter table public.profiles add column if not exists mother_occupation text;
alter table public.profiles add column if not exists mother_phone text;

-- Pickup / emergency
alter table public.profiles add column if not exists pickup_person text;
alter table public.profiles add column if not exists pickup_phone text;

-- Provenance + first-login welcome letter
alter table public.profiles add column if not exists admission_application_id uuid
  references public.admission_applications(id) on delete set null;
alter table public.profiles add column if not exists welcome_seen_at timestamptz;

-- ------------------------------------------------------------
-- class_applying_for becomes optional.
--
-- Families no longer pick a class on the admissions form -- the admin
-- chooses it at the point of admitting, which is when the school
-- actually knows where the child fits. Existing rows keep whatever
-- they had.
-- ------------------------------------------------------------
alter table public.admission_applications alter column class_applying_for drop not null;

-- ------------------------------------------------------------
-- Let a pupil fill in their own bio details at sign-up -- WITHOUT
-- letting them promote themselves.
--
-- The existing policy is `using (id = auth.uid())` with no WITH CHECK
-- and no column restriction, so any signed-in user could already run
--   update profiles set role = 'admin' where id = auth.uid()
-- straight from the browser console. RLS cannot restrict columns, so
-- the guard has to be a trigger. This matters more now that the
-- sign-up form writes a whole block of fields through that same path.
-- ------------------------------------------------------------
create or replace function public.guard_profile_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Trusted server-side callers (service_role: edge functions, SQL
  -- console) have no auth.uid() and are not subject to this guard --
  -- admin-create-user promotes a newly created teacher this way.
  if auth.uid() is null then
    return new;
  end if;
  -- Admins may change anything.
  if public.current_role() = 'admin' then
    return new;
  end if;
  -- Everyone else keeps their existing role, status and display_id.
  new.role := old.role;
  new.status := old.status;
  new.display_id := old.display_id;
  -- A pupil cannot move themselves between classes.
  if old.role = 'student' and auth.uid() = old.id then
    new.grade := old.grade;
    new.assigned_class := old.assigned_class;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update
  before update on public.profiles
  for each row execute function public.guard_profile_self_update();

notify pgrst, 'reload schema';

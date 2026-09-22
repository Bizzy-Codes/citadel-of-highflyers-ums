-- ============================================================
-- Citadel Highflyers UMS -- patch 27
--
-- People's names are stored in CAPITALS, always. Management asked for
-- this after parents registered in lower-case / mixed case and the
-- printed records looked inconsistent.
--
-- Enforced at the database, not just in the forms, so every write
-- path (registration, admission form, admin edits, the profile
-- trigger on sign-up, future imports) lands the same way. Login is
-- unaffected: email_for_login_id() already compares names with
-- lower() on both sides.
--
-- 1. Trigger: upper-case the person-name columns on every insert or
--    update of profiles and admission_applications.
-- 2. Backfill: fix every row already in the tables.
--
-- Not touched: emails, class names, file names, occupations, addresses.
-- ============================================================

create or replace function public.uppercase_person_names()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'profiles' then
    new.name        := upper(btrim(new.name));
    new.father_name := upper(btrim(new.father_name));
    new.mother_name := upper(btrim(new.mother_name));
  elsif tg_table_name = 'admission_applications' then
    new.surname       := upper(btrim(new.surname));
    new.first_name    := upper(btrim(new.first_name));
    new.other_names   := upper(btrim(new.other_names));
    new.father_name   := upper(btrim(new.father_name));
    new.mother_name   := upper(btrim(new.mother_name));
    new.sibling_names := upper(btrim(new.sibling_names));
    new.pickup_person := upper(btrim(new.pickup_person));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_uppercase_names on public.profiles;
create trigger profiles_uppercase_names
  before insert or update of name, father_name, mother_name on public.profiles
  for each row execute function public.uppercase_person_names();

drop trigger if exists admission_applications_uppercase_names on public.admission_applications;
create trigger admission_applications_uppercase_names
  before insert or update of surname, first_name, other_names, father_name, mother_name, sibling_names, pickup_person
  on public.admission_applications
  for each row execute function public.uppercase_person_names();

-- Backfill existing rows. Only touches rows that actually change, so
-- updated_at-style triggers elsewhere don't fire for nothing.
update public.profiles
set name        = upper(btrim(name)),
    father_name = upper(btrim(father_name)),
    mother_name = upper(btrim(mother_name))
where name        is distinct from upper(btrim(name))
   or father_name is distinct from upper(btrim(father_name))
   or mother_name is distinct from upper(btrim(mother_name));

update public.admission_applications
set surname       = upper(btrim(surname)),
    first_name    = upper(btrim(first_name)),
    other_names   = upper(btrim(other_names)),
    father_name   = upper(btrim(father_name)),
    mother_name   = upper(btrim(mother_name)),
    sibling_names = upper(btrim(sibling_names)),
    pickup_person = upper(btrim(pickup_person))
where surname       is distinct from upper(btrim(surname))
   or first_name    is distinct from upper(btrim(first_name))
   or other_names   is distinct from upper(btrim(other_names))
   or father_name   is distinct from upper(btrim(father_name))
   or mother_name   is distinct from upper(btrim(mother_name))
   or sibling_names is distinct from upper(btrim(sibling_names))
   or pickup_person is distinct from upper(btrim(pickup_person));

-- The name shown in auth metadata (used by the profile-creation
-- trigger and some emails) should match too.
update auth.users
set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{name}', to_jsonb(upper(btrim(raw_user_meta_data->>'name'))))
where raw_user_meta_data ? 'name'
  and raw_user_meta_data->>'name' is distinct from upper(btrim(raw_user_meta_data->>'name'));

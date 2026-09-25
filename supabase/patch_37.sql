-- ============================================================
-- Citadel Highflyers UMS -- patch 37
--
-- Choose your own password on first log in.
--
-- Accounts the school creates all start on the same default password,
-- and that default has been exposed (it was in the website's code and
-- Citadel AI repeated it). Anyone who knew it plus a pupil's name could
-- get into that pupil's account. So:
--
--   * profiles.must_change_password -- true for anyone still on a
--     password someone else knows. The portal won't let them past a
--     "Choose your own password" page until they've set a new one.
--   * The admin-create-user function sets it when the school creates an
--     account or an admin sets someone's password.
--   * password_changed() clears it once the person has saved a new
--     password (called by the app straight after the change).
--
-- Existing accounts still on the default were flagged in the same
-- change by comparing each stored password hash against the default --
-- run separately so the password itself is never written into this
-- file (see the commit that added this patch).
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Only admins set the flag, and only the person themselves can clear it
-- (a teacher editing a pupil's profile can't switch it off for them).
create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
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
  -- ...and can only clear their OWN "must change password" flag.
  if not (auth.uid() = old.id and new.must_change_password = false) then
    new.must_change_password := old.must_change_password;
  end if;
  -- A pupil cannot move themselves between classes.
  if old.role = 'student' and auth.uid() = old.id then
    new.grade := old.grade;
    new.assigned_class := old.assigned_class;
  end if;
  return new;
end;
$function$;

create or replace function public.password_changed()
returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;
revoke execute on function public.password_changed() from anon, public;
grant execute on function public.password_changed() to authenticated;

-- ============================================================
-- Citadel Highflyers UMS -- patch 43
--
-- 1. Portal lock. The admin can lock a pupil's portal (e.g. outstanding
--    fees). A locked pupil can still log in but only sees a neutral
--    "please ask your parent or guardian to contact the school office"
--    page. The reason is never shown to the pupil. The lock is stored in
--    its own table so a pupil can never switch it off themselves.
-- 2. Receipt safety. Every uploaded receipt carries a fingerprint of the
--    file, the bank reference and the payment date. A receipt whose file
--    or reference matches an earlier one is flagged for the admin
--    (duplicate_of / duplicate_reason). Nothing is ever approved
--    automatically; the admin always decides.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Portal locks
-- ------------------------------------------------------------
create table if not exists public.portal_locks (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  locked_at timestamptz not null default now(),
  locked_by uuid references public.profiles(id) on delete set null,
  note text,                              -- internal only, never shown to the pupil
  parent_notified_at timestamptz,
  parent_notified_by uuid references public.profiles(id) on delete set null
);
alter table public.portal_locks enable row level security;
grant select, insert, update, delete on public.portal_locks to authenticated;

-- A pupil can see THAT they are locked (the app needs it to show the
-- locked page) but cannot change anything.
drop policy if exists "pupils see their own lock" on public.portal_locks;
create policy "pupils see their own lock"
  on public.portal_locks for select
  using (student_id = auth.uid());

drop policy if exists "admins manage portal locks" on public.portal_locks;
create policy "admins manage portal locks"
  on public.portal_locks for all
  using (coalesce(public.current_role(), '') = 'admin')
  with check (coalesce(public.current_role(), '') = 'admin');

-- Lock or unlock many pupils at once.
create or replace function public.set_portal_lock(p_student_ids uuid[], p_locked boolean, p_note text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if coalesce(public.current_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  if p_locked then
    insert into public.portal_locks (student_id, locked_by, note)
    select p.id, auth.uid(), nullif(trim(p_note), '')
    from public.profiles p where p.id = any(p_student_ids) and p.role = 'student'
    on conflict (student_id) do update set note = coalesce(excluded.note, public.portal_locks.note);
  else
    delete from public.portal_locks where student_id = any(p_student_ids);
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.set_portal_lock(uuid[], boolean, text) from anon, public;
grant execute on function public.set_portal_lock(uuid[], boolean, text) to authenticated;

-- A pupil with a locked portal must not be able to start a test.
-- (Everything else is blocked on the screen; this closes the one action
-- that could otherwise still be started from a saved link.)
create or replace function public.guard_locked_test_start()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.portal_locks where student_id = new.student_id) then
    raise exception 'Portal is locked';
  end if;
  return new;
end;
$$;
drop trigger if exists test_attempts_locked_guard on public.test_attempts;
create trigger test_attempts_locked_guard before insert on public.test_attempts
  for each row execute function public.guard_locked_test_start();

-- ------------------------------------------------------------
-- 2. Receipt safety
-- ------------------------------------------------------------
alter table public.payment_receipts add column if not exists file_hash text;
alter table public.payment_receipts add column if not exists reference text;
alter table public.payment_receipts add column if not exists paid_on date;
alter table public.payment_receipts add column if not exists duplicate_of uuid references public.payment_receipts(id) on delete set null;
alter table public.payment_receipts add column if not exists duplicate_reason text;
create index if not exists payment_receipts_hash_idx on public.payment_receipts (file_hash) where file_hash is not null;
create index if not exists payment_receipts_ref_idx on public.payment_receipts (lower(trim(reference))) where reference is not null;

create or replace function public.flag_duplicate_receipt()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  new.duplicate_of := null;
  new.duplicate_reason := null;
  if new.file_hash is not null then
    select id into v_id from public.payment_receipts where file_hash = new.file_hash order by created_at limit 1;
    if v_id is not null then
      new.duplicate_of := v_id;
      new.duplicate_reason := 'This exact file was uploaded before.';
      return new;
    end if;
  end if;
  if nullif(trim(coalesce(new.reference, '')), '') is not null then
    select id into v_id from public.payment_receipts
    where lower(trim(reference)) = lower(trim(new.reference)) order by created_at limit 1;
    if v_id is not null then
      new.duplicate_of := v_id;
      new.duplicate_reason := 'This payment reference was already used on an earlier receipt.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists payment_receipts_flag_duplicate on public.payment_receipts;
create trigger payment_receipts_flag_duplicate before insert on public.payment_receipts
  for each row execute function public.flag_duplicate_receipt();

-- Pupils may not edit a receipt after sending it (only the admin reviews).
-- (The existing policies already allow only admins to update.)

notify pgrst, 'reload schema';

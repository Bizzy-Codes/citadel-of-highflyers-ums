-- ============================================================
-- Citadel Highflyers UMS -- patch 9
-- Payment receipts: a student (or their parent, using the same
-- login) uploads proof of payment; an admin reviews it and marks it
-- acknowledged or rejected. Files live in a private
-- "payment-receipts" bucket, path {student_id}/<timestamp>-<file>.
-- ============================================================

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  file_path text not null,
  file_name text not null,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_student_idx on public.payment_receipts (student_id, created_at desc);
create index if not exists payment_receipts_status_idx on public.payment_receipts (status, created_at desc);

alter table public.payment_receipts enable row level security;
grant select, insert, update on public.payment_receipts to authenticated;

drop policy if exists "students view own receipts" on public.payment_receipts;
create policy "students view own receipts"
  on public.payment_receipts for select
  using (student_id = auth.uid());

drop policy if exists "students submit own receipts" on public.payment_receipts;
create policy "students submit own receipts"
  on public.payment_receipts for insert
  with check (student_id = auth.uid());

drop policy if exists "admins view all receipts" on public.payment_receipts;
create policy "admins view all receipts"
  on public.payment_receipts for select
  using (public.current_role() = 'admin');

drop policy if exists "admins review receipts" on public.payment_receipts;
create policy "admins review receipts"
  on public.payment_receipts for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

drop policy if exists "students upload own receipts" on storage.objects;
create policy "students upload own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipt owner or admin reads receipt file" on storage.objects;
create policy "receipt owner or admin reads receipt file"
  on storage.objects for select
  using (
    bucket_id = 'payment-receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_role() = 'admin'
    )
  );

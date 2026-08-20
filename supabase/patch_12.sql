-- ============================================================
-- Citadel Highflyers UMS -- patch 12
-- Admission payment step: after submitting the form, the applicant
-- is shown a payment page (processing fee + optional physical copy)
-- and uploads a transfer receipt. Reuses the admission-photos bucket
-- (already anon-insertable) for the receipt file.
--
-- The application row's id is generated client-side at form-submit
-- time (see patch_10.sql) and kept in the browser's local state
-- through the payment step, so the payment update doesn't need a
-- SELECT policy to look the row up again -- same "knowing the UUID
-- is the capability" pattern already used for the photo upload path.
-- A SECURITY DEFINER function is still required though: anon has no
-- UPDATE policy on this table at all (only INSERT), and it should
-- only ever be able to touch the payment columns, never rewrite the
-- application details after admin review has started.
-- ============================================================

alter table public.admission_applications add column if not exists wants_physical_copy boolean not null default false;
alter table public.admission_applications add column if not exists payment_amount numeric(10,2);
alter table public.admission_applications add column if not exists payment_receipt_path text;
alter table public.admission_applications add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'submitted', 'confirmed'));

create or replace function public.submit_admission_payment(
  p_application_id uuid, p_wants_physical_copy boolean, p_payment_amount numeric, p_payment_receipt_path text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.admission_applications
  set wants_physical_copy = p_wants_physical_copy,
      payment_amount = p_payment_amount,
      payment_receipt_path = p_payment_receipt_path,
      payment_status = 'submitted'
  where id = p_application_id and payment_status = 'unpaid';

  if not found then
    raise exception 'Application not found or payment already submitted';
  end if;
end;
$$;
grant execute on function public.submit_admission_payment(uuid, boolean, numeric, text) to anon, authenticated;

-- Admin confirms the payment (separate from the general "review
-- application" status -- an application can be admitted/declined
-- independently of whether its fee has been confirmed paid).
create or replace function public.confirm_admission_payment(p_application_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;
  update public.admission_applications set payment_status = 'confirmed' where id = p_application_id;
end;
$$;
grant execute on function public.confirm_admission_payment(uuid) to authenticated;

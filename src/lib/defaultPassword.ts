import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// The password new accounts start with. It is NOT written anywhere in
// the website's code any more: everything in src/ is downloaded by every
// visitor, so a constant here was readable by anyone. Admin screens ask
// the admin-create-user function for it, which only answers admins.

let cached: Promise<string | null> | null = null;

function fetchDefaultPassword(): Promise<string | null> {
  cached ??= supabase.functions
    .invoke('admin-create-user', { body: { action: 'default_password' } })
    .then(({ data, error }) => (error || typeof data?.password !== 'string' ? null : data.password))
    .catch(() => null)
    .then((pw) => { if (!pw) cached = null; return pw; }); // let a failed lookup be retried
  return cached;
}

// For admin screens only. null until loaded (or if the caller isn't an admin).
export function useDefaultAccountPassword(): string | null {
  const [pw, setPw] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchDefaultPassword().then((p) => { if (alive) setPw(p); });
    return () => { alive = false; };
  }, []);
  return pw;
}

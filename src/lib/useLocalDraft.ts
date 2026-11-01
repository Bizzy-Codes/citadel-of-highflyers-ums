import { useCallback, useEffect, useRef, useState } from 'react';

// Keeps what a teacher is typing safe on this device, so a browser refresh
// (or coming back from copying something in another tab) does not wipe it.
// Saved automatically as they type; `save()` writes it immediately (the
// "Save draft" button); `clear()` removes it once the real thing is saved.
export function useLocalDraft<T>(key: string | null, value: T, enabled: boolean) {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; });

  const write = useCallback(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
      setSavedAt(new Date());
    } catch { /* storage full or blocked: nothing to do */ }
  }, [key]);

  useEffect(() => {
    if (!enabled || !key) return;
    const t = setTimeout(write, 600);
    return () => clearTimeout(t);
  }, [key, enabled, value, write]);

  const load = useCallback((): T | null => {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }, [key]);

  const clear = useCallback(() => {
    if (!key) return;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setSavedAt(null);
  }, [key]);

  return { savedAt, save: write, load, clear };
}

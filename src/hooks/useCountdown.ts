import { useEffect, useRef, useState } from 'react';

// Recomputes remaining time from the absolute server-set expiresAt on
// every tick, rather than decrementing a local counter, so laptop
// sleep / background-tab throttling can't desync it -- on resume it
// immediately recomputes the true remaining time and fires onExpire
// right away if it's already negative.
export function useCountdown(expiresAtIso: string | null, onExpire: () => void) {
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAtIso ? new Date(expiresAtIso).getTime() - Date.now() : 0
  );
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!expiresAtIso) return;

    const tick = () => {
      const remaining = new Date(expiresAtIso).getTime() - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAtIso]);

  return { remainingMs: Math.max(0, remainingMs) };
}

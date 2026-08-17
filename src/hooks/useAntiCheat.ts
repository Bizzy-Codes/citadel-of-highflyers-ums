import { useEffect, useRef } from 'react';

// Detects the student switching away from the tab/window while a test
// attempt is in progress. Both visibilitychange (tab hidden) and blur
// (OS window loses focus, e.g. alt-tab) call the same gated report()
// -- a single alt-tab firing both events in one tick is absorbed by
// the in-flight lock and, once the callback settles, by the cooldown
// window, so it is never double-counted.
//
// This hook never counts strikes itself -- onViolation is expected to
// call the server-trusted record_test_violation RPC and act on
// *its* returned count/status, not a local counter.
export function useAntiCheat(active: boolean, onViolation: () => void | Promise<void>) {
  const pendingRef = useRef(false);
  const lastFiredAtRef = useRef(0);
  const DEDUPE_WINDOW_MS = 1500;

  useEffect(() => {
    if (!active) return;

    const report = () => {
      const now = Date.now();
      if (pendingRef.current || now - lastFiredAtRef.current < DEDUPE_WINDOW_MS) return;
      pendingRef.current = true;
      Promise.resolve(onViolation()).finally(() => {
        pendingRef.current = false;
        lastFiredAtRef.current = Date.now();
      });
    };

    const onVisibility = () => { if (document.hidden) report(); };
    const onBlur = () => report();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

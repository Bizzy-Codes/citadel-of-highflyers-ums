import { useEffect, useRef, useState } from 'react';

// Local self-view only in this phase -- nothing is transmitted
// anywhere. Requests camera-only permission (no mic) while `active`
// is true and stops every track the instant it goes false (submit,
// termination, expiry, or unmount all flip the same boolean that
// drives useAntiCheat). Camera denial does not block test-taking.
//
// streamRef exposes the raw MediaStream so a later phase can publish
// it to a video SDK room without touching this permission/lifecycle
// code.
export function useCameraPreview(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active]);

  return { videoRef, streamRef, error };
}

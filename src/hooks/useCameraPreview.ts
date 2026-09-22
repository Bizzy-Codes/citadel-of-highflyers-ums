import { useEffect, useRef, useState } from 'react';

// Requests camera-only permission (no mic) while `active` is true and
// stops every track the instant it goes false (submit, termination,
// expiry, or unmount all flip the same boolean that drives
// useAntiCheat). Camera denial does not block test-taking.
//
// `stream` is state (not just a ref) so the broadcaster can react the
// moment the camera is actually live and attach it to peer connections.
export function useCameraPreview(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    // 640x480 @ 15fps is plenty for a proctoring thumbnail and keeps
    // each pupil's upstream small enough for a whole class on school Wi-Fi.
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 }, facingMode: 'user' },
      audio: false,
    })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    };
  }, [active]);

  return { videoRef, streamRef, stream, error };
}

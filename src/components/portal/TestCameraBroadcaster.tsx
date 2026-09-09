import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';
import { useCameraPreview } from '../../hooks/useCameraPreview';
import { useAuth } from '../../context/AuthContext';

interface TestCameraBroadcasterProps {
  active: boolean;
  testId?: string;
  attemptId?: string;
  studentId?: string;
  studentName?: string;
  /** How often to relay a frame. Default 12s -- "near-live", tiny bandwidth. */
  intervalMs?: number;
}

// Drop-in replacement for <CameraPreview>: still shows the pupil their
// own corner self-view, and additionally relays a small JPEG frame
// every intervalMs over an ephemeral Realtime broadcast channel so the
// teacher's Live Monitor can show a refreshing thumbnail wall. Nothing
// is uploaded or stored -- frames are relayed and dropped.
const TestCameraBroadcaster = ({
  active, testId, attemptId, studentId, studentName, intervalMs = 12000,
}: TestCameraBroadcasterProps) => {
  const { videoRef, error } = useCameraPreview(active);
  const { createTestSnapshotSender } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active || error || !testId || !attemptId || !studentId) return;

    const sender = createTestSnapshotSender(testId);
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');

    const capture = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
      const w = 240;
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 180;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      let image: string;
      try {
        image = canvas.toDataURL('image/jpeg', 0.4);
      } catch {
        return; // tainted canvas / not ready -- skip this tick
      }
      sender.send({
        attemptId, studentId,
        studentName: studentName ?? 'Pupil',
        image, at: Date.now(),
      });
    };

    const warmup = setTimeout(capture, 3000);
    const timer = setInterval(capture, intervalMs);
    return () => {
      clearTimeout(warmup);
      clearInterval(timer);
      sender.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, error, testId, attemptId, studentId, studentName, intervalMs]);

  if (!active) return null;

  return (
    <div className="camera-preview-corner">
      {error ? (
        <div className="camera-preview-error">
          <VideoOff size={18} />
          <span>Camera unavailable</span>
        </div>
      ) : (
        <video ref={videoRef} autoPlay muted playsInline />
      )}
    </div>
  );
};

export default TestCameraBroadcaster;

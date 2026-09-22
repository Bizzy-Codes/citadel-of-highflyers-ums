import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';
import { useCameraPreview } from '../../hooks/useCameraPreview';
import { useAuth } from '../../context/AuthContext';
import { iceServers, isHealthy, openRtcChannel, waitForIceGathering, type RtcSignal } from '../../lib/testRtc';

interface TestCameraBroadcasterProps {
  active: boolean;
  testId?: string;
  attemptId?: string;
  studentId?: string;
  studentName?: string;
  /** Fallback still-frame cadence, used when live video can't connect. */
  intervalMs?: number;
}

// Shows the pupil their own corner self-view and streams the same
// camera live to whichever teacher is watching the Live Monitor, over
// a direct WebRTC connection per teacher. A small JPEG frame is also
// relayed every few seconds so the monitor still shows something if a
// pupil's video can't get through their network. Nothing is recorded.
const TestCameraBroadcaster = ({
  active, testId, attemptId, studentId, studentName, intervalMs = 5000,
}: TestCameraBroadcasterProps) => {
  const { videoRef, stream, error } = useCameraPreview(active);
  const { createTestSnapshotSender } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Live video: one peer connection per watching teacher ---------
  useEffect(() => {
    if (!active || !stream || !testId || !attemptId) return;
    const peers = new Map<string, RTCPeerConnection>();
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    const channel = openRtcChannel(testId, (s: RtcSignal) => void handle(s));

    const announce = (teacherId: string | null) => channel.send({ kind: 'pupil-ready', attemptId, teacherId });

    const handle = async (s: RtcSignal) => {
      if (s.kind === 'teacher-ready') {
        // Only re-announce when this teacher doesn't already have a
        // working stream from us, so a healthy connection isn't churned.
        if (!isHealthy(peers.get(s.teacherId))) announce(s.teacherId);
        return;
      }
      if (s.kind === 'reinvite') {
        // The teacher gave up on the old link; start fresh even if our
        // side still thought it was fine.
        if (s.attemptId !== attemptId) return;
        peers.get(s.teacherId)?.close();
        peers.delete(s.teacherId);
        announce(s.teacherId);
        return;
      }
      if (s.kind !== 'offer' || s.attemptId !== attemptId) return;

      peers.get(s.teacherId)?.close();
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      peers.set(s.teacherId, pc);
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (peers.get(s.teacherId) === pc) peers.delete(s.teacherId);
        }
      };

      const sender = pc.addTrack(track, stream);
      try {
        const params = sender.getParameters();
        params.encodings = [{ maxBitrate: 250_000, maxFramerate: 15 }];
        await sender.setParameters(params);
      } catch { /* older browsers: defaults are fine */ }

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGathering(pc);
        if (pc.localDescription) {
          channel.send({ kind: 'answer', teacherId: s.teacherId, attemptId, sdp: pc.localDescription.sdp });
        }
      } catch (e) {
        console.error('rtc answer failed', e);
        pc.close();
        peers.delete(s.teacherId);
      }
    };

    // Tell any teacher already watching that we're here.
    announce(null);

    return () => {
      channel.close();
      peers.forEach((pc) => pc.close());
      peers.clear();
    };
  }, [active, stream, testId, attemptId]);

  // --- Fallback still frames -----------------------------------------
  useEffect(() => {
    if (!active || error || !testId || !attemptId || !studentId) return;

    const sender = createTestSnapshotSender(testId);
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');

    const capture = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
      const w = 320;
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 240;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      let image: string;
      try {
        image = canvas.toDataURL('image/jpeg', 0.5);
      } catch {
        return; // tainted canvas / not ready -- skip this tick
      }
      sender.send({
        attemptId, studentId,
        studentName: studentName ?? 'Pupil',
        image, at: Date.now(),
      });
    };

    const warmup = setTimeout(capture, 2000);
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

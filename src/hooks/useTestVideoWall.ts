import { useEffect, useRef, useState } from 'react';
import { iceServers, isHealthy, openRtcChannel, waitForIceGathering, type RtcSignal } from '../lib/testRtc';

export type WallState = 'connecting' | 'live' | 'lost';

// Teacher side of the live exam video. Keeps one receive-only peer
// connection per pupil currently in the test, initiated from here so
// the teacher is always the one that (re)connects. Pupils announce
// themselves; we also heartbeat so a pupil whose link dropped knows
// to re-announce. Returns a live MediaStream per attempt where one
// has connected.
export function useTestVideoWall(testId: string | undefined, liveAttemptIds: string[]) {
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [states, setStates] = useState<Record<string, WallState>>({});
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const channelRef = useRef<ReturnType<typeof openRtcChannel> | null>(null);
  const teacherId = useRef<string | null>(null);
  const liveIds = useRef(new Set<string>());
  useEffect(() => { liveIds.current = new Set(liveAttemptIds); }, [liveAttemptIds]);

  useEffect(() => {
    if (!testId) return;
    if (!teacherId.current) teacherId.current = `t-${Math.random().toString(36).slice(2, 10)}`;
    const me = teacherId.current;
    const peerMap = peers.current;

    const dropPeer = (attemptId: string) => {
      peers.current.get(attemptId)?.close();
      peers.current.delete(attemptId);
      setStreams((prev) => { if (!(attemptId in prev)) return prev; const n = { ...prev }; delete n[attemptId]; return n; });
    };

    const connectTo = async (attemptId: string) => {
      if (!liveIds.current.has(attemptId)) return;
      if (isHealthy(peers.current.get(attemptId))) return;
      dropPeer(attemptId);

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      peers.current.set(attemptId, pc);
      setStates((prev) => ({ ...prev, [attemptId]: 'connecting' }));

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.ontrack = (ev) => {
        const s = ev.streams[0] ?? new MediaStream([ev.track]);
        setStreams((prev) => ({ ...prev, [attemptId]: s }));
      };
      // Give up and re-invite if the link isn't up soon: a lost offer or
      // answer would otherwise leave this pupil stuck on "connecting".
      const retry = () => {
        if (peers.current.get(attemptId) !== pc) return;
        dropPeer(attemptId);
        setStates((prev) => ({ ...prev, [attemptId]: 'lost' }));
        channelRef.current?.send({ kind: 'reinvite', teacherId: me, attemptId });
      };
      const stall = setTimeout(() => { if (pc.connectionState !== 'connected') retry(); }, 15000);
      let graceTimer: ReturnType<typeof setTimeout> | undefined;

      pc.onconnectionstatechange = () => {
        if (peers.current.get(attemptId) !== pc) return;
        if (pc.connectionState === 'connected') {
          clearTimeout(stall);
          clearTimeout(graceTimer);
          setStates((prev) => ({ ...prev, [attemptId]: 'live' }));
        } else if (pc.connectionState === 'disconnected') {
          // Often transient on Wi-Fi; give it a moment to recover.
          setStates((prev) => ({ ...prev, [attemptId]: 'lost' }));
          clearTimeout(graceTimer);
          graceTimer = setTimeout(() => { if (pc.connectionState !== 'connected') retry(); }, 8000);
        } else if (pc.connectionState === 'failed') {
          clearTimeout(stall);
          retry();
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGathering(pc);
        if (pc.localDescription && channelRef.current) {
          channelRef.current.send({ kind: 'offer', teacherId: me, attemptId, sdp: pc.localDescription.sdp });
        }
      } catch (e) {
        console.error('rtc offer failed', e);
        clearTimeout(stall);
        dropPeer(attemptId);
      }
    };

    const channel = openRtcChannel(testId, async (s: RtcSignal) => {
      if (s.kind === 'pupil-ready') {
        if (s.teacherId === null || s.teacherId === me) void connectTo(s.attemptId);
        return;
      }
      if (s.kind === 'answer' && s.teacherId === me) {
        const pc = peers.current.get(s.attemptId);
        if (!pc || pc.signalingState !== 'have-local-offer') return;
        try { await pc.setRemoteDescription({ type: 'answer', sdp: s.sdp }); }
        catch (e) { console.error('rtc setRemote(answer) failed', e); }
      }
    });
    channelRef.current = channel;

    // Announce on join and heartbeat: pupils without a healthy link to
    // this teacher respond with pupil-ready, which kicks off connectTo.
    channel.send({ kind: 'teacher-ready', teacherId: me });
    const heartbeat = setInterval(() => channel.send({ kind: 'teacher-ready', teacherId: me }), 8000);

    return () => {
      clearInterval(heartbeat);
      channel.close();
      channelRef.current = null;
      peerMap.forEach((pc) => pc.close());
      peerMap.clear();
      setStreams({});
      setStates({});
    };
  }, [testId]);

  // Tear down connections for pupils who've finished.
  useEffect(() => {
    const keep = new Set(liveAttemptIds);
    peers.current.forEach((pc, attemptId) => {
      if (!keep.has(attemptId)) {
        pc.close();
        peers.current.delete(attemptId);
        setStreams((prev) => { if (!(attemptId in prev)) return prev; const n = { ...prev }; delete n[attemptId]; return n; });
        setStates((prev) => { if (!(attemptId in prev)) return prev; const n = { ...prev }; delete n[attemptId]; return n; });
      }
    });
  }, [liveAttemptIds]);

  return { streams, states };
}

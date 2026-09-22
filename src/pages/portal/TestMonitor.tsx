import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import {
  useAuth,
  type TestAttempt, type TestAnswerForGrading, type ExamViolation,
  type AttemptProgress, type TestSnapshot,
} from '../../context/AuthContext';
import { ArrowLeft, RefreshCw, AlertTriangle, FileText, Camera, VideoOff, Sparkles, Radio } from 'lucide-react';
import { useTestVideoWall, type WallState } from '../../hooks/useTestVideoWall';
import './Tests.css';

// <video> needs srcObject set imperatively; a ref callback keeps it in
// sync when the stream for a tile changes or is dropped.
const LiveVideo = ({ stream, label }: { stream: MediaStream; label: string }) => (
  <video
    autoPlay muted playsInline
    aria-label={label}
    ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
  />
);

const WALL_LABEL: Record<WallState, string> = { connecting: 'connecting…', live: 'LIVE', lost: 'reconnecting…' };

const STATUS_LABEL: Record<TestAttempt['status'], string> = {
  in_progress: 'In Progress',
  submitted: 'Submitted',
  terminated: 'Terminated',
  expired: 'Expired',
};

const agoLabel = (iso: string | number | null | undefined) => {
  if (!iso) return null;
  const ms = Date.now() - (typeof iso === 'number' ? iso : new Date(iso).getTime());
  if (ms < 0) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
};

const TestMonitor = () => {
  const { testId } = useParams();
  const {
    tests, getAttemptsForTest, subscribeToTestAttempts, getViolationsForTest, subscribeToTestViolations,
    sweepExpiredAttempts, getAnswersForAttempt, gradeEssayAnswer,
    getAttemptProgress, subscribeToTestSnapshots,
  } = useAuth();
  const test = tests.find((t) => t.id === testId);

  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [violations, setViolations] = useState<ExamViolation[]>([]);
  const [sweeping, setSweeping] = useState(false);

  const [progress, setProgress] = useState<Record<string, AttemptProgress>>({});
  const [snaps, setSnaps] = useState<Record<string, TestSnapshot>>({});
  // Re-render once a second so the "Xs ago" labels stay honest.
  const [, forceTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const [gradingAttempt, setGradingAttempt] = useState<TestAttempt | null>(null);
  const [answers, setAnswers] = useState<TestAnswerForGrading[]>([]);
  const [draftScores, setDraftScores] = useState<Record<string, { points: string; feedback: string }>>({});

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;

    getAttemptsForTest(testId).then((a) => { if (!cancelled) setAttempts(a); });
    getViolationsForTest(testId).then((v) => { if (!cancelled) setViolations(v); });

    const unsubAttempts = subscribeToTestAttempts(testId, (updated) => {
      setAttempts((prev) => {
        const exists = prev.some((a) => a.id === updated.id);
        return exists ? prev.map((a) => (a.id === updated.id ? updated : a)) : [updated, ...prev];
      });
    });
    const unsubViolations = subscribeToTestViolations(testId, (v) => {
      setViolations((prev) => [v, ...prev]);
    });
    const unsubSnaps = subscribeToTestSnapshots(testId, (s) => {
      setSnaps((prev) => ({ ...prev, [s.attemptId]: s }));
    });

    // Poll the "how far along is everyone" feed. Realtime only fires on
    // test_attempts rows, not per-answer, so a light 5s poll fills the
    // gap without a second realtime table.
    const pullProgress = () => {
      getAttemptProgress(testId).then((rows) => {
        if (cancelled) return;
        const map: Record<string, AttemptProgress> = {};
        rows.forEach((r) => { map[r.attemptId] = r; });
        setProgress(map);
      });
    };
    pullProgress();
    const progressTimer = setInterval(pullProgress, 5000);
    tickRef.current = setInterval(() => forceTick((n) => n + 1), 1000);

    return () => {
      cancelled = true;
      unsubAttempts(); unsubViolations(); unsubSnaps();
      clearInterval(progressTimer);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const liveAttempts = useMemo(() => attempts.filter((a) => a.status === 'in_progress'), [attempts]);
  const liveIds = useMemo(() => liveAttempts.map((a) => a.id), [liveAttempts]);
  const { streams, states: wallStates } = useTestVideoWall(testId, liveIds);
  const liveCount = liveAttempts.filter((a) => streams[a.id] && wallStates[a.id] === 'live').length;

  const handleSweep = async () => {
    if (!testId) return;
    setSweeping(true);
    await sweepExpiredAttempts(testId);
    setAttempts(await getAttemptsForTest(testId));
    setSweeping(false);
  };

  const openGrading = async (attempt: TestAttempt) => {
    setGradingAttempt(attempt);
    const a = await getAnswersForAttempt(attempt.id);
    setAnswers(a);
    const drafts: Record<string, { points: string; feedback: string }> = {};
    a.forEach((ans) => {
      if (ans.questionType === 'essay') {
        drafts[ans.id] = { points: ans.pointsAwarded != null ? String(ans.pointsAwarded) : '', feedback: ans.feedback ?? '' };
      }
    });
    setDraftScores(drafts);
  };

  const handleGrade = async (answerId: string) => {
    const draft = draftScores[answerId];
    if (!draft) return;
    const points = Number(draft.points);
    if (Number.isNaN(points)) { alert('Enter a valid point value'); return; }
    const { error } = await gradeEssayAnswer(answerId, points, draft.feedback);
    if (error) { alert('Failed to save grade: ' + error); return; }
    if (gradingAttempt) {
      setAnswers(await getAnswersForAttempt(gradingAttempt.id));
      setAttempts(await getAttemptsForTest(testId!));
    }
  };

  if (!test) {
    return (
      <PortalLayout title="Live Monitor">
        <div className="card glass" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Test not found, or still loading. <Link to="/portal/teacher/tests">Back to Tests</Link>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Live Monitor">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <Link to="/portal/teacher/tests" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> Back to Tests
          </Link>
          <h2>{test.title} — Live Monitor</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {test.subject} &middot; {attempts.length} attempt{attempts.length === 1 ? '' : 's'} &middot; {liveAttempts.length} in progress now
          </p>
        </div>

        {/* Live video wall -- a direct WebRTC stream from each pupil's
            webcam, with the periodic still frame as a fallback while a
            stream connects or if it can't get through. Nothing is stored. */}
        <div className="card glass" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Camera size={18} /> Live Camera Feed</h3>
            {liveAttempts.length > 0 && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: liveCount === liveAttempts.length ? 'var(--success)' : 'var(--warning)' }}>
                {liveCount}/{liveAttempts.length} streaming live
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
            Live video from each pupil's webcam. Streams go straight to this screen and are never saved.
          </p>
          {liveAttempts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No pupils are taking this test right now.</p>
          ) : (
            <div className="live-wall">
              {liveAttempts.map((a) => {
                const stream = streams[a.id];
                const state = wallStates[a.id];
                const isLive = !!stream && state === 'live';
                const snap = snaps[a.id];
                const stale = snap ? Date.now() - snap.at > 20000 : false;
                return (
                  <div key={a.id} className={`live-tile ${isLive ? 'live-tile-live' : ''}`}>
                    <div className="live-tile-video">
                      {isLive ? (
                        <LiveVideo stream={stream} label={`${a.studentName ?? a.studentId} live webcam`} />
                      ) : snap ? (
                        <img src={snap.image} alt={`${a.studentName ?? a.studentId} webcam`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: stale ? 0.5 : 1 }} />
                      ) : (
                        <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <VideoOff size={20} /> waiting for camera
                        </div>
                      )}
                      <span className={`live-badge ${isLive ? 'live-badge-on' : ''}`}>
                        <Radio size={10} /> {state ? WALL_LABEL[state] : (snap ? 'still frames' : 'waiting')}
                      </span>
                      {a.violationCount > 0 && (
                        <span style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--warning)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 800, padding: '2px 7px' }}>
                          {a.violationCount}/3
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.studentName ?? a.studentId}</div>
                      <div style={{ fontSize: '11px', color: isLive ? 'var(--success)' : stale ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {isLive ? 'live video' : snap ? `still frame ${agoLabel(snap.at)}` : 'no picture yet'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px' }}>
          <div className="card glass" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Attempts</h3>
              <button className="btn btn-outline sm" disabled={sweeping} onClick={handleSweep}><RefreshCw size={14} /> Sweep Expired</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>PUPIL</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>STATUS</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>PROGRESS</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>STRIKES</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>SCORE</th>
                    <th style={{ padding: '10px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const p = progress[a.id];
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '10px' }}>{a.studentName ?? a.studentId}</td>
                        <td style={{ padding: '10px' }}><span className={`attempt-status-badge attempt-status-${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
                        <td style={{ padding: '10px', fontSize: '13px' }}>
                          {p && p.totalQuestions > 0 ? (
                            <>
                              <strong>{p.answeredCount}</strong>/{p.totalQuestions}
                              {a.status === 'in_progress' && p.lastActivityAt && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> &middot; {agoLabel(p.lastActivityAt)}</span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px' }}>{a.violationCount > 0 ? <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{a.violationCount}/3</span> : '—'}</td>
                        <td style={{ padding: '10px' }}>{a.score != null ? `${a.score}/${a.maxScore}` : '—'}</td>
                        <td style={{ padding: '10px' }}>
                          {a.status !== 'in_progress' && <button className="btn btn-outline sm" onClick={() => openGrading(a)}><FileText size={14} /> Grade</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {attempts.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No attempts yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card glass" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '16px' }}>Violations Feed</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {violations.map((v) => (
                <div key={v.id} className="violation-feed-item">
                  <AlertTriangle size={16} color="var(--warning)" />
                  <div>
                    <strong>{v.studentName ?? v.studentId}</strong> switched away from the test tab
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(v.occurredAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
              {violations.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No violations recorded.</p>}
            </div>
          </div>
        </div>
      </div>

      {gradingAttempt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '4px' }}>Grade: {gradingAttempt.studentName ?? gradingAttempt.studentId}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>Score: {gradingAttempt.score ?? 0}/{gradingAttempt.maxScore}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {answers.map((ans) => (
                <div key={ans.id} className="grading-answer-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <p style={{ fontWeight: 600 }}>{ans.questionPrompt}</p>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ans.questionPoints} pts</span>
                  </div>
                  {ans.questionType === 'objective' ? (
                    <p style={{ fontSize: '13px', marginTop: '6px' }}>
                      Answered: <strong>{ans.selectedOption ?? '(no answer)'}</strong> — {ans.isCorrect ? <span style={{ color: 'var(--success)' }}>Correct</span> : <span style={{ color: 'var(--error)' }}>Incorrect</span>} ({ans.pointsAwarded ?? 0} pts)
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: '13px', marginTop: '6px', whiteSpace: 'pre-wrap', background: 'var(--bg-light)', padding: '10px', borderRadius: '8px' }}>
                        {ans.essayText || '(no answer)'}
                      </p>
                      {ans.aiFeedback && (
                        <p style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={13} /> {ans.aiFeedback} — check it and adjust before it's final.
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="number" min={0} step="0.5" placeholder="points" value={draftScores[ans.id]?.points ?? ''}
                          onChange={(e) => setDraftScores({ ...draftScores, [ans.id]: { ...(draftScores[ans.id] ?? { feedback: '' }), points: e.target.value } })}
                          style={{ width: '90px', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                        <input type="text" placeholder="feedback (optional)" value={draftScores[ans.id]?.feedback ?? ''}
                          onChange={(e) => setDraftScores({ ...draftScores, [ans.id]: { ...(draftScores[ans.id] ?? { points: '' }), feedback: e.target.value } })}
                          style={{ flex: 1, minWidth: '160px', padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                        <button className="btn btn-primary sm" onClick={() => handleGrade(ans.id)}>Save Grade</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <button className="btn btn-outline" style={{ width: '100%', marginTop: '20px' }} onClick={() => setGradingAttempt(null)}>Close</button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default TestMonitor;

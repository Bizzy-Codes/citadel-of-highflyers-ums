import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, type AttemptQuestion, type TestAttempt } from '../../context/AuthContext';
import { useCountdown } from '../../hooks/useCountdown';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import CameraPreview from '../../components/portal/CameraPreview';
import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import './Tests.css';

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

type AnswerDraft = { selectedOption?: string; essayText?: string };

const TestTaking = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { getAttemptById, getAttemptQuestions, saveTestAnswer, submitTestAttempt, recordTestViolation } = useAuth();

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<{ score: number; maxScore: number } | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const status = attempt?.status ?? null;
  const isActive = status === 'in_progress' && !submitting;

  const loadAll = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    const a = await getAttemptById(attemptId);
    if (!a) { setLoading(false); return; }
    setAttempt(a);
    if (a.status === 'in_progress') {
      const qs = await getAttemptQuestions(attemptId);
      setQuestions(qs);
      const drafts: Record<string, AnswerDraft> = {};
      qs.forEach((q) => { drafts[q.questionId] = { selectedOption: q.selectedOption, essayText: q.essayText }; });
      setAnswers(drafts);
    } else {
      setFinalResult({ score: a.score ?? 0, maxScore: a.maxScore });
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    const { error, score, maxScore, status: newStatus } = await submitTestAttempt(attemptId);
    setSubmitting(false);
    if (error) {
      // Attempt may have already been auto-closed server-side (e.g. by
      // save_test_answer's own expiry check) -- refetch to get the
      // authoritative final state instead of surfacing a raw error.
      await loadAll();
      return;
    }
    setFinalResult({ score: score ?? 0, maxScore: maxScore ?? 0 });
    setAttempt((prev) => prev ? { ...prev, status: (newStatus as TestAttempt['status']) ?? 'submitted' } : prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, submitting]);

  const { remainingMs } = useCountdown(isActive ? (attempt?.expiresAt ?? null) : null, handleSubmit);

  const handleViolation = useCallback(async () => {
    if (!attemptId) return;
    const { violationCount, status: newStatus } = await recordTestViolation(attemptId);
    if (newStatus && newStatus !== 'in_progress') {
      await loadAll();
      return;
    }
    setWarning(`Warning ${violationCount ?? '?'} of 3 — leaving the test window is recorded. A 3rd time will end your test.`);
    setTimeout(() => setWarning(null), 6000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useAntiCheat(isActive, handleViolation);

  const handleAnswerChange = (questionId: string, draft: AnswerDraft) => {
    setAnswers((prev) => ({ ...prev, [questionId]: draft }));
    if (!attemptId) return;
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      saveTestAnswer(attemptId, questionId, draft);
    }, 500);
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading test...</div>;
  }

  if (!attempt) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Attempt not found.</div>;
  }

  if (status === 'terminated') {
    return (
      <div className="test-takeover test-takeover-terminated">
        <XCircle size={56} />
        <h2>Test Terminated</h2>
        <p>Your test was ended after 3 warnings for leaving the test window. Your teacher has been notified. You cannot retake this test.</p>
        <button className="btn btn-primary" onClick={() => navigate('/portal/tests')}>Back to My Tests</button>
      </div>
    );
  }

  if (status === 'submitted' || status === 'expired' || finalResult) {
    return (
      <div className="test-takeover test-takeover-done">
        <CheckCircle2 size={56} />
        <h2>{status === 'expired' ? 'Time Expired' : 'Test Submitted'}</h2>
        <p>Your score: <strong>{finalResult?.score ?? attempt.score ?? 0} / {finalResult?.maxScore ?? attempt.maxScore}</strong></p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Essay questions may still be pending manual review from your teacher.</p>
        <button className="btn btn-primary" onClick={() => navigate('/portal/tests')}>Back to My Tests</button>
      </div>
    );
  }

  const answeredCount = questions.filter((q) => {
    const d = answers[q.questionId];
    return d?.selectedOption || (d?.essayText && d.essayText.trim().length > 0);
  }).length;

  return (
    <div className="test-taking-root">
      <CameraPreview active={isActive} />

      {warning && (
        <div className="test-warning-banner"><AlertTriangle size={18} /> {warning}</div>
      )}

      <div className="test-taking-header">
        <div>
          <h2 style={{ marginBottom: '2px' }}>Test in Progress</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{answeredCount} / {questions.length} answered</p>
        </div>
        <div className="test-countdown">
          <Clock size={18} /> {formatTime(remainingMs)}
        </div>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Submitting...' : 'Submit Test'}
        </button>
      </div>

      <div className="test-taking-nav">
        {questions.map((q, i) => {
          const answered = !!(answers[q.questionId]?.selectedOption || answers[q.questionId]?.essayText?.trim());
          return (
            <button
              key={q.questionId}
              className={`test-nav-pill ${answered ? 'test-nav-pill-answered' : ''}`}
              onClick={() => questionRefs.current[q.questionId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="test-taking-questions">
        {questions.map((q, i) => (
          <div key={q.questionId} ref={(el) => { questionRefs.current[q.questionId] = el; }} className="card glass test-question-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
              <strong>Question {i + 1}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{q.points} pts</span>
            </div>
            <p style={{ marginBottom: '16px' }}>{q.prompt}</p>
            {q.type === 'objective' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {q.options?.map((opt) => (
                  <label key={opt.key} className="test-option-label">
                    <input
                      type="radio"
                      name={q.questionId}
                      checked={answers[q.questionId]?.selectedOption === opt.key}
                      onChange={() => handleAnswerChange(q.questionId, { selectedOption: opt.key })}
                    />
                    <span><strong>{opt.key}.</strong> {opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={5}
                placeholder="Type your answer..."
                value={answers[q.questionId]?.essayText ?? ''}
                onChange={(e) => handleAnswerChange(q.questionId, { essayText: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'vertical' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestTaking;

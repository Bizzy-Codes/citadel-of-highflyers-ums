import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, type AttemptQuestion, type TestAttempt } from '../../context/AuthContext';
import { useCountdown } from '../../hooks/useCountdown';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import TestCameraBroadcaster from '../../components/portal/TestCameraBroadcaster';
import { AlertTriangle, CheckCircle2, XCircle, Clock, ArrowLeft, ArrowRight, Flag, Check } from 'lucide-react';
import './Tests.css';

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

type AnswerDraft = { selectedOption?: string; essayText?: string };

const isAnswered = (d?: AnswerDraft) => !!(d?.selectedOption || (d?.essayText && d.essayText.trim().length > 0));

const TestTaking = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { currentUser, getAttemptById, getAttemptQuestions, saveTestAnswer, submitTestAttempt, recordTestViolation } = useAuth();

  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<{ score: number; maxScore: number } | null>(null);

  const [current, setCurrent] = useState(0);
  const [reviewing, setReviewing] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);

  const status = attempt?.status ?? null;
  const isActive = status === 'in_progress' && !submitting;

  const loadAll = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    const a = await getAttemptById(attemptId);
    if (!a) { setLoading(false); return; }
    setAttempt(a);
    if (a.status === 'in_progress') {
      const { questions: qs, error: loadError } = await getAttemptQuestions(attemptId);
      setQuestionsError(loadError);
      setQuestions(qs);
      const drafts: Record<string, AnswerDraft> = {};
      qs.forEach((q) => { drafts[q.questionId] = { selectedOption: q.selectedOption, essayText: q.essayText }; });
      setAnswers(drafts);
      // Resume where they left off: first unanswered question.
      const firstOpen = qs.findIndex((q) => !isAnswered(drafts[q.questionId]));
      setCurrent(firstOpen === -1 ? 0 : firstOpen);
    } else {
      setFinalResult({ score: a.score ?? 0, maxScore: a.maxScore });
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Flush any pending autosave before submitting so the last answer
  // chosen isn't still sitting in a 500ms debounce when grading runs.
  const flushSaves = useCallback(async () => {
    if (!attemptId) return;
    const pending = Object.entries(saveTimers.current);
    saveTimers.current = {};
    await Promise.all(pending.map(([questionId, timer]) => {
      clearTimeout(timer);
      return saveTestAnswer(attemptId, questionId, answers[questionId] ?? {});
    }));
  }, [attemptId, answers, saveTestAnswer]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await flushSaves();
      const { error, score, maxScore, status: newStatus } = await submitTestAttempt(attemptId);
      if (error) {
        // The attempt may already have been closed server-side (expiry,
        // strike limit, a double-tap). Refetch the authoritative state:
        // if it's finished, show the result screen; only if it's really
        // still open do we surface the error so the pupil can retry.
        await loadAll();
        const fresh = await getAttemptById(attemptId);
        if (fresh && fresh.status !== 'in_progress') {
          setFinalResult({ score: fresh.score ?? 0, maxScore: fresh.maxScore });
        } else {
          setSubmitError(error);
        }
        return;
      }
      setFinalResult({ score: score ?? 0, maxScore: maxScore ?? 0 });
      setAttempt((prev) => prev ? { ...prev, status: (newStatus as TestAttempt['status']) ?? 'submitted' } : prev);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not submit. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, submitting, flushSaves]);

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
      delete saveTimers.current[questionId];
      saveTestAnswer(attemptId, questionId, draft);
    }, 500);
  };

  const goTo = (i: number) => {
    setReviewing(false);
    setSubmitError(null);
    setCurrent(Math.max(0, Math.min(questions.length - 1, i)));
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const answeredCount = useMemo(() => questions.filter((q) => isAnswered(answers[q.questionId])).length, [questions, answers]);
  const unanswered = useMemo(() => questions.map((q, i) => ({ q, i })).filter(({ q }) => !isAnswered(answers[q.questionId])), [questions, answers]);

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
    const score = finalResult?.score ?? attempt.score ?? 0;
    const max = finalResult?.maxScore ?? attempt.maxScore;
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    return (
      <div className="test-takeover test-takeover-done">
        <CheckCircle2 size={56} />
        <h2>{status === 'expired' ? 'Time is up!' : 'Well done — test submitted!'}</h2>
        <div className="test-score-big">
          <span className="test-score-num">{score}</span>
          <span className="test-score-den">/ {max}</span>
        </div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>{pct}%</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Multiple-choice questions are marked straight away. If there were any writing questions, your teacher will mark those and your score may go up.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/portal/tests')}>Back to My Tests</button>
      </div>
    );
  }

  const q = questions[current];
  const total = questions.length;
  const isLast = current === total - 1;
  const progressPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="test-taking-root">
      <TestCameraBroadcaster
        active={isActive}
        testId={attempt.testId}
        attemptId={attemptId}
        studentId={currentUser?.id}
        studentName={currentUser?.name}
      />

      {warning && (
        <div className="test-warning-banner"><AlertTriangle size={18} /> {warning}</div>
      )}

      {submitError && (
        <div className="test-warning-banner" style={{ background: 'var(--error, #dc2626)' }}>
          <AlertTriangle size={18} />
          <span style={{ flex: 1 }}>Couldn't submit your test: {submitError}</span>
          <button className="btn sm" style={{ background: '#fff', color: 'var(--error, #dc2626)' }} onClick={handleSubmit} disabled={submitting}>
            Try again
          </button>
          <button className="btn sm btn-outline" style={{ borderColor: '#fff', color: '#fff' }} onClick={() => navigate('/portal/tests')}>
            Leave &amp; tell teacher
          </button>
        </div>
      )}

      <div className="test-taking-header">
        <div>
          <h2 style={{ marginBottom: '2px' }}>{reviewing ? 'Check your answers' : total > 0 ? `Question ${current + 1} of ${total}` : 'Test in Progress'}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{answeredCount} of {total} answered</p>
        </div>
        <div className="test-countdown" title="Time left">
          <Clock size={18} /> {formatTime(remainingMs)}
        </div>
        {!reviewing && total > 0 && (
          <button className="btn btn-outline" disabled={submitting} onClick={() => setReviewing(true)}>
            <Flag size={16} /> Finish test
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="test-progress-track" aria-label={`${progressPct}% answered`}>
          <div className="test-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {total > 0 && (
        <div className="test-taking-nav">
          {questions.map((qq, i) => {
            const answered = isAnswered(answers[qq.questionId]);
            return (
              <button
                key={qq.questionId}
                type="button"
                className={`test-nav-pill ${answered ? 'test-nav-pill-answered' : ''} ${!reviewing && i === current ? 'test-nav-pill-current' : ''}`}
                onClick={() => goTo(i)}
                title={answered ? `Question ${i + 1} — answered` : `Question ${i + 1} — not answered yet`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      <div className="test-taking-questions" ref={cardRef}>
        {total === 0 && (
          <div className="card glass" style={{ padding: '40px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '10px' }}>No questions to show</h3>
            {questionsError ? (
              <>
                <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                  This test couldn't be loaded, so there's nothing to answer yet. Please tell your teacher what it says below.
                </p>
                <p style={{ color: 'var(--error)', fontSize: '13px', fontWeight: 600 }}>{questionsError}</p>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                Your teacher hasn't added any questions to this test yet. Let them know, then try again.
              </p>
            )}
          </div>
        )}

        {total > 0 && reviewing && (
          <div className="card glass test-question-block test-review">
            {unanswered.length === 0 ? (
              <>
                <div className="test-review-icon test-review-icon-ok"><Check size={32} /></div>
                <h3>You've answered all {total} questions.</h3>
                <p style={{ color: 'var(--text-muted)' }}>Happy with your answers? You can still go back and check any of them before you submit.</p>
              </>
            ) : (
              <>
                <div className="test-review-icon test-review-icon-warn"><AlertTriangle size={32} /></div>
                <h3>You haven't answered {unanswered.length === 1 ? 'question' : 'questions'} {unanswered.map(({ i }) => i + 1).join(', ')}.</h3>
                <p style={{ color: 'var(--text-muted)' }}>Tap a number below to go back to it, or submit anyway if you're ready.</p>
                <div className="test-review-missing">
                  {unanswered.map(({ i }) => (
                    <button key={i} type="button" className="btn btn-outline" onClick={() => goTo(i)}>Question {i + 1}</button>
                  ))}
                </div>
              </>
            )}
            <div className="test-review-actions">
              <button type="button" className="btn btn-outline lg" onClick={() => setReviewing(false)} disabled={submitting}>
                <ArrowLeft size={18} /> Go back
              </button>
              <button type="button" className="btn btn-primary lg" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : <><Check size={18} /> Submit my test</>}
              </button>
            </div>
          </div>
        )}

        {total > 0 && !reviewing && q && (
          <div key={q.questionId} className="card glass test-question-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
              <strong style={{ color: 'var(--primary)' }}>Question {current + 1}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{q.points} {q.points === 1 ? 'mark' : 'marks'}</span>
            </div>
            <p className="test-question-prompt">{q.prompt}</p>
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
                    <span className="test-option-key">{opt.key}</span>
                    <span className="test-option-text">{opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={6}
                placeholder="Type your answer here..."
                value={answers[q.questionId]?.essayText ?? ''}
                onChange={(e) => handleAnswerChange(q.questionId, { essayText: e.target.value })}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'vertical', fontSize: '16px' }}
              />
            )}

            <div className="test-step-actions">
              <button type="button" className="btn btn-outline lg" onClick={() => goTo(current - 1)} disabled={current === 0}>
                <ArrowLeft size={18} /> Previous
              </button>
              {isLast ? (
                <button type="button" className="btn btn-primary lg" onClick={() => setReviewing(true)}>
                  <Flag size={18} /> Finish
                </button>
              ) : (
                <button type="button" className="btn btn-primary lg" onClick={() => goTo(current + 1)}>
                  Next question <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestTaking;

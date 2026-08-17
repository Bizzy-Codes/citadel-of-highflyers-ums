import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type TestAttempt } from '../../context/AuthContext';
import { ClipboardList, Clock, CheckCircle2, XCircle } from 'lucide-react';
import './Tests.css';

const StudentTests = () => {
  const navigate = useNavigate();
  const { tests, finalizeMyExpiredAttempts, getMyAttemptForTest, startTestAttempt } = useAuth();
  const [attempts, setAttempts] = useState<Record<string, TestAttempt | null>>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const availableTests = tests.filter((t) => t.status !== 'draft');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await finalizeMyExpiredAttempts();
      const entries = await Promise.all(availableTests.map(async (t) => [t.id, await getMyAttemptForTest(t.id)] as const));
      if (!cancelled) {
        setAttempts(Object.fromEntries(entries));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests.length]);

  const handleStart = async (testId: string) => {
    setStarting(testId);
    const { error, attemptId } = await startTestAttempt(testId);
    setStarting(null);
    if (error || !attemptId) { alert('Failed to start test: ' + (error ?? 'unknown error')); return; }
    navigate(`/portal/tests/${attemptId}`);
  };

  return (
    <PortalLayout title="My Tests">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2>My Tests</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Tests published for your class. Each test can only be attempted once.</p>
        </div>

        <div className="card glass" style={{ padding: '0' }}>
          {!loading && availableTests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <ClipboardList size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>No tests available right now.</p>
            </div>
          )}
          {availableTests.map((t) => {
            const attempt = attempts[t.id];
            return (
              <div key={t.id} className="test-row">
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <strong>{t.title}</strong>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t.subject} &middot; <Clock size={12} style={{ verticalAlign: 'middle' }} /> {t.durationMinutes} min &middot; {t.totalPoints} pts
                  </p>
                </div>
                <div>
                  {!attempt && t.status === 'published' && (
                    <button className="btn btn-primary sm" disabled={starting === t.id} onClick={() => handleStart(t.id)}>
                      {starting === t.id ? 'Starting...' : 'Start Test'}
                    </button>
                  )}
                  {!attempt && t.status === 'closed' && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Closed</span>}
                  {attempt?.status === 'in_progress' && (
                    <button className="btn btn-primary sm" onClick={() => navigate(`/portal/tests/${attempt.id}`)}>Resume</button>
                  )}
                  {(attempt?.status === 'submitted' || attempt?.status === 'expired') && (
                    <span className="test-result-pill">
                      <CheckCircle2 size={14} /> {attempt.score ?? 0}/{attempt.maxScore}
                    </span>
                  )}
                  {attempt?.status === 'terminated' && (
                    <span className="test-result-pill test-result-terminated">
                      <XCircle size={14} /> Terminated
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
};

export default StudentTests;

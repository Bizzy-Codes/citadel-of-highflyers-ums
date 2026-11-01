import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Flame, Trophy, Film, ListChecks, Loader2, CalendarClock, RefreshCw } from 'lucide-react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import { CLASSES } from '../../lib/accounts';
import { type SpotlightCurrent, type LeaderRow, getCurrent, getLeaderboard, weekendLabel } from '../../lib/spotlight';
import RoundView from '../../components/spotlight/RoundView';
import Board from '../../components/spotlight/Board';
import MemoryLane from '../../components/spotlight/MemoryLane';
import TaskBank from '../../components/spotlight/TaskBank';
import '../../components/spotlight/Spotlight.css';

type Tab = 'now' | 'board' | 'memories' | 'tasks';

// Days until the next Saturday (Lagos), for the "next draw" line.
function daysToSaturday(): number {
  const lagos = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  return (6 - lagos.getDay() + 7) % 7;
}

const Spotlight = () => {
  const { currentUser, classChatNames } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = isAdmin || currentUser?.role === 'teacher';
  const [adminClass, setAdminClass] = useState<string>(CLASSES[CLASSES.length - 1]);
  const className = isAdmin ? adminClass : (classChatNames[0] ?? '');

  const [tab, setTab] = useState<Tab>('now');
  const [current, setCurrent] = useState<SpotlightCurrent | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== className;

  const load = useCallback(async (force = false) => {
    if (!className) return;
    const [cur, rows] = await Promise.all([getCurrent(className, force), getLeaderboard(className)]);
    if (cur.error) setError(cur.error); else { setError(null); setCurrent(cur.data ?? null); }
    setBoard(rows);
    setLoadedFor(className);
  }, [className]);

  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  // Keep the stars and shared answers fresh while the page is open.
  useEffect(() => {
    if (tab !== 'now' && tab !== 'board') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 45_000);
    return () => clearInterval(t);
  }, [tab, load]);

  const me = board.find((r) => r.is_me);
  const round = current?.round ?? null;
  const days = daysToSaturday();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'now', label: 'This weekend', icon: <Sparkles size={16} /> },
    { id: 'board', label: 'Class board', icon: <Trophy size={16} /> },
    { id: 'memories', label: 'Memory Lane', icon: <Film size={16} /> },
    ...(isStaff ? [{ id: 'tasks' as Tab, label: 'Task bank', icon: <ListChecks size={16} /> }] : []),
  ];

  return (
    <PortalLayout title="Weekend Spotlight">
      <div className="sp-page animate-fade-in">
        <div className="sp-hero">
          <div>
            <h1>Weekend Spotlight ✨</h1>
            <p>Every weekend one classmate is picked for two fun tasks. Share, cheer, rate — and keep your streak alive!</p>
          </div>
          {currentUser?.role === 'student' && me && (
            <div className={`sp-hero-streak${me.streak > 0 ? ' on' : ''}`}>
              <Flame size={26} />
              <span><b>{me.streak}</b> weekend{me.streak === 1 ? '' : 's'}</span>
              <small>your streak</small>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="sp-class-pick">
            <label>Class
              <select value={adminClass} onChange={(e) => setAdminClass(e.target.value)}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        )}

        {!className ? (
          <div className="sp-empty-card">
            <h3>No class yet</h3>
            <p>{isStaff ? "You haven't been given a class yet — ask the office." : "You'll see the Spotlight as soon as you are placed in a class."}</p>
          </div>
        ) : (
          <>
            <div className="sp-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
              <button type="button" className="sp-refresh" onClick={() => load()} aria-label="Refresh"><RefreshCw size={15} /></button>
            </div>

            {tab === 'now' && (
              loading ? <p className="sp-empty"><Loader2 size={18} className="sp-spin" /> Looking for this weekend's Spotlight…</p>
              : error ? <p className="sp-error">{error}</p>
              : round ? (
                <RoundView round={round} thisWeekend={current?.this_weekend ?? ''} onChanged={() => load()} onStartNew={isStaff ? () => load(true) : undefined} />
              ) : (
                <div className="sp-empty-card">
                  <CalendarClock size={38} />
                  <h3>{current && current.tasks_available === 0 ? 'No tasks yet' : 'The next Spotlight is coming!'}</h3>
                  <p>
                    {current && current.tasks_available === 0
                      ? 'There are no tasks for this class yet. Add some in the Task bank.'
                      : current?.is_weekend
                        ? 'Nobody in this class can be picked yet.'
                        : days === 0 ? 'It is drawn today!' : `A classmate will be picked on Saturday — ${days} day${days === 1 ? '' : 's'} to go. Until then, take a look at Memory Lane.`}
                  </p>
                  {isStaff && current && current.tasks_available > 0 && (
                    <button type="button" className="btn btn-primary" onClick={() => load(true)}>Start a Spotlight now</button>
                  )}
                  {current && <small className="sp-muted">Weekend of {weekendLabel(current.this_weekend)}</small>}
                </div>
              )
            )}

            {tab === 'board' && <Board rows={board} />}
            {tab === 'memories' && <MemoryLane className={className} board={board} />}
            {tab === 'tasks' && isStaff && <TaskBank />}

            <details className="sp-how">
              <summary>How does it work?</summary>
              <ol>
                <li><b>The draw.</b> On Saturday one pupil is picked at random — nobody gets a second turn until everyone has had one.</li>
                <li><b>Two tasks.</b> They get two fun tasks that suit your class — show &amp; tell, a bit of research, your best moment of the week…</li>
                <li><b>Share.</b> They answer with words and/or a photo before Sunday ends. The whole class can see.</li>
                <li><b>Rate.</b> Everyone else gives 1–5 stars. Rating all the answers every weekend builds your 🔥 streak.</li>
                <li><b>Memory Lane.</b> Everything is kept, and at the end of the term it plays back like a little film.</li>
              </ol>
            </details>
          </>
        )}
      </div>
    </PortalLayout>
  );
};

export default Spotlight;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Flame, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { type SpotlightCurrent, getCurrent, getLeaderboard, timeLeft } from '../../lib/spotlight';
import './Spotlight.css';

const firstName = (n: string) => n.split(' ')[0] || n;

// A slim card at the top of the class group chat: who is in the
// Spotlight, what is waiting for you, and your streak.
const SpotlightBanner = ({ className }: { className: string }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<SpotlightCurrent | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    if (!className) return;
    let cancelled = false;
    const load = async () => {
      const [cur, rows] = await Promise.all([getCurrent(className), getLeaderboard(className)]);
      if (cancelled) return;
      if (cur.data) setCurrent(cur.data);
      setStreak(rows.find((r) => r.is_me)?.streak ?? null);
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [className]);

  if (!current) return null;
  const round = current.round;
  const isPupil = currentUser?.role === 'student';
  const owed = round && isPupil && !round.is_me
    ? round.entries.filter((e) => e.submitted && !e.hidden && e.my_stars == null).length
    : 0;

  let headline: string;
  let sub: string;
  if (!round) {
    headline = 'Weekend Spotlight';
    sub = current.is_weekend ? 'Tap to see this weekend' : 'The next classmate is picked on Saturday ✨';
  } else if (round.is_me && round.phase === 'open') {
    headline = "🎉 You're in the Spotlight!";
    sub = `Share your ${round.entries.length === 1 ? 'task' : 'tasks'} · ${timeLeft(round.submit_until)}`;
  } else if (owed > 0) {
    headline = `⭐ ${firstName(round.student.name)} shared their Spotlight`;
    sub = `${owed} waiting for your stars — keep your streak 🔥`;
  } else if (round.phase === 'open') {
    headline = `⭐ ${firstName(round.student.name)} is in the Spotlight`;
    sub = round.entries.some((e) => e.submitted) ? 'Take a look and cheer them on' : 'Waiting for them to share…';
  } else {
    headline = `⭐ ${firstName(round.student.name)}'s Spotlight`;
    sub = round.phase === 'rating' ? `Ratings ${timeLeft(round.rate_until)}` : 'See how it went';
  }

  return (
    <button type="button" className={`sp-banner${owed > 0 || (round?.is_me && round.phase === 'open') ? ' urgent' : ''}`} onClick={() => navigate('/portal/spotlight')}>
      <span className="sp-banner-icon"><Sparkles size={20} /></span>
      <span className="sp-banner-text"><b>{headline}</b><small>{sub}</small></span>
      {isPupil && streak != null && streak > 0 && <span className="sp-banner-streak"><Flame size={15} /> {streak}</span>}
      <ChevronRight size={18} />
    </button>
  );
};

export default SpotlightBanner;

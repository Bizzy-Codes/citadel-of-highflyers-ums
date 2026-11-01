import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Pause, X, ChevronLeft, ChevronRight, Film, Loader2, Flame } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  type LeaderRow, type MemoryLaneData, type SpotlightEntry, type SpotlightRound,
  getMemoryLane, weekendLabel, monthLabel, monthKey, KIND_EMOJI, KIND_LABEL,
} from '../../lib/spotlight';
import { StarRow } from './Stars';
import Avatar from './Avatar';
import { usePhotoUrls } from './usePhotoUrls';

type Shared = { round: SpotlightRound; entry: SpotlightEntry };

type Slide =
  | { type: 'title'; data: MemoryLaneData; photos: number; shared: number }
  | { type: 'week'; round: SpotlightRound }
  | { type: 'entry'; round: SpotlightRound; entry: SpotlightEntry }
  | { type: 'top'; items: Shared[] }
  | { type: 'streaks'; rows: LeaderRow[] };

const firstName = (n: string) => n.split(' ')[0] || n;

// How long each slide stays: longer when there is more to read.
const slideMs = (s: Slide) => {
  switch (s.type) {
    case 'title': return 4500;
    case 'week': return 3500;
    case 'entry': return 6500 + Math.min((s.entry.response_text?.length ?? 0) * 35, 7000);
    case 'top': return 9000;
    case 'streaks': return 8000;
  }
};

// ---- the slideshow ("walk down memory lane") -------------------------------
const Player = ({ slides, start, urls, onClose }: {
  slides: Slide[];
  start: number;
  urls: Record<string, string>;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(start);
  const [playing, setPlaying] = useState(true);
  const slide = slides[index];
  const last = slides.length - 1;

  const go = useCallback((n: number) => setIndex(Math.max(0, Math.min(last, n))), [last]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) return;
    const t = setTimeout(() => setIndex((i) => Math.min(last, i + 1)), slideMs(slide));
    return () => clearTimeout(t);
  }, [index, playing, slide, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [go, index, onClose]);

  const atEnd = index >= last;

  return (
    <div className="sp-player" role="dialog" aria-modal="true" aria-label="Memory Lane slideshow">
      <div className="sp-player-bars">
        {slides.map((_, i) => (
          <span key={i} className={`sp-pbar${i < index ? ' done' : ''}`}>
            {i === index && (
              <span
                key={`${index}-${playing}`}
                className="sp-pbar-fill"
                style={{ animationDuration: `${slideMs(slide)}ms`, animationPlayState: playing && !atEnd ? 'running' : 'paused' }}
              />
            )}
          </span>
        ))}
      </div>

      <button type="button" className="sp-player-close" onClick={onClose} aria-label="Close"><X size={22} /></button>

      <div className="sp-stage" key={index} onClick={() => setPlaying((p) => !p)}>
        {slide.type === 'title' && (
          <div className="sp-slide sp-slide-title">
            <span className="sp-film"><Film size={34} /></span>
            <h1>Memory Lane</h1>
            <h2>{slide.data.term}{slide.data.session ? ` · ${slide.data.session}` : ''}</h2>
            <p>{slide.data.rounds.length} weekends · {slide.shared} things shared · {slide.photos} photos</p>
          </div>
        )}
        {slide.type === 'week' && (
          <div className="sp-slide sp-slide-week">
            <span className="sp-chip light">{weekendLabel(slide.round.weekend_date)}</span>
            <Avatar name={slide.round.student.name} url={slide.round.student.avatar_url} size={96} />
            <h2>{slide.round.student.name}</h2>
            <p>was in the Spotlight ⭐</p>
          </div>
        )}
        {slide.type === 'entry' && (
          <div className={`sp-slide sp-slide-entry${slide.entry.image_path ? ' has-photo' : ''}`}>
            <div className="sp-slide-who">
              <Avatar name={slide.round.student.name} url={slide.round.student.avatar_url} size={34} />
              <span>{slide.round.student.name} · {weekendLabel(slide.round.weekend_date)}</span>
            </div>
            <p className="sp-slide-prompt">{KIND_EMOJI[slide.entry.kind ?? ''] ?? '⭐'} {slide.entry.prompt}</p>
            {slide.entry.image_path && urls[slide.entry.image_path] && (
              <img className="sp-slide-photo" src={urls[slide.entry.image_path]} alt="" />
            )}
            {slide.entry.response_text && <p className="sp-slide-text">{slide.entry.response_text}</p>}
            <div className="sp-slide-stars"><StarRow value={slide.entry.avg} size={22} /> {slide.entry.avg != null && <b>{slide.entry.avg.toFixed(1)}</b>}</div>
          </div>
        )}
        {slide.type === 'top' && (
          <div className="sp-slide sp-slide-top">
            <h2>🏆 Class favourites</h2>
            <ol>
              {slide.items.map(({ round, entry }, i) => (
                <li key={entry.id} style={{ animationDelay: `${i * 0.5}s` }}>
                  <span className="sp-top-no">{i + 1}</span>
                  <span className="sp-top-body"><strong>{round.student.name}</strong><small>{entry.prompt}</small></span>
                  <span className="sp-top-score">{entry.avg?.toFixed(1)} ★</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {slide.type === 'streaks' && (
          <div className="sp-slide sp-slide-top">
            <h2><Flame size={28} /> Streak champions</h2>
            <ol>
              {slide.rows.map((row, i) => (
                <li key={row.id} style={{ animationDelay: `${i * 0.5}s` }}>
                  <Avatar name={row.name} url={row.avatar_url} size={40} />
                  <span className="sp-top-body"><strong>{row.name}</strong><small>best streak: {row.best_streak} weekends</small></span>
                  <span className="sp-top-score">🔥 {row.best_streak}</span>
                </li>
              ))}
            </ol>
            <p className="sp-slide-end">What a term! See you next time 💜</p>
          </div>
        )}
      </div>

      <div className="sp-player-ctrl">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous"><ChevronLeft size={26} /></button>
        <button type="button" onClick={() => { if (atEnd) { setIndex(0); setPlaying(true); } else setPlaying((p) => !p); }} aria-label={playing ? 'Pause' : 'Play'}>
          {playing && !atEnd ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={atEnd} aria-label="Next"><ChevronRight size={26} /></button>
      </div>
    </div>
  );
};

// ---- the page section ---------------------------------------------------------
const MemoryLane = ({ className, board }: { className: string; board: LeaderRow[] }) => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<MemoryLaneData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [pick, setPick] = useState<{ term: string; session: string } | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [playFrom, setPlayFrom] = useState<number | null>(null);

  const wantKey = `${className}|${pick?.term ?? ''}|${pick?.session ?? ''}`;
  const loading = loadedKey !== wantKey;
  useEffect(() => {
    let cancelled = false;
    getMemoryLane(className, pick?.term, pick?.session).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error); else { setError(null); setData(res.data ?? null); }
      setLoadedKey(wantKey);
    });
    return () => { cancelled = true; };
  }, [className, pick, wantKey]);

  const shared: Shared[] = useMemo(() => {
    if (!data) return [];
    const out: Shared[] = [];
    for (const round of data.rounds) {
      for (const entry of round.entries) {
        if (entry.submitted && !entry.hidden) out.push({ round, entry });
      }
    }
    return out;
  }, [data]);

  const urls = usePhotoUrls(shared.map((s) => s.entry.image_path));

  // The full slideshow, and where each answer sits in it (so tapping a
  // tile in the collage starts the show at that answer).
  const { slides, entryIndex } = useMemo(() => {
    const list: Slide[] = [];
    const where: Record<string, number> = {};
    if (!data || shared.length === 0) return { slides: list, entryIndex: where };
    list.push({ type: 'title', data, photos: shared.filter((s) => s.entry.image_path).length, shared: shared.length });
    for (const round of data.rounds) {
      const items = shared.filter((s) => s.round.id === round.id);
      if (items.length === 0) continue;
      list.push({ type: 'week', round });
      for (const it of items) { where[it.entry.id] = list.length; list.push({ type: 'entry', round, entry: it.entry }); }
    }
    const top = shared.filter((s) => s.entry.avg != null)
      .sort((a, b) => (b.entry.avg ?? 0) - (a.entry.avg ?? 0) || b.entry.count - a.entry.count).slice(0, 3);
    if (top.length > 0) list.push({ type: 'top', items: top });
    const champs = [...board].filter((r) => r.best_streak > 0).sort((a, b) => b.best_streak - a.best_streak).slice(0, 3);
    if (champs.length > 0) list.push({ type: 'streaks', rows: champs });
    return { slides: list, entryIndex: where };
  }, [data, shared, board]);

  const visible = onlyMine ? shared.filter((s) => s.round.student.id === currentUser?.id) : shared;
  const months = useMemo(() => {
    const groups = new Map<string, { label: string; items: Shared[] }>();
    for (const s of visible) {
      const k = monthKey(s.round.weekend_date);
      if (!groups.has(k)) groups.set(k, { label: monthLabel(s.round.weekend_date), items: [] });
      groups.get(k)!.items.push(s);
    }
    return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
  }, [visible]);

  if (loading && !data) return <p className="sp-empty"><Loader2 size={18} className="sp-spin" /> Opening your memories…</p>;
  if (error) return <p className="sp-error">{error}</p>;
  if (!data || data.terms.length === 0 || shared.length === 0) {
    return (
      <div className="sp-empty-card">
        <Film size={36} />
        <h3>Memory Lane is empty — for now</h3>
        <p>Every answer shared in the Weekend Spotlight is kept here. At the end of the term you can play them all back as a little film, with the photos, the answers and the stars.</p>
      </div>
    );
  }

  return (
    <div className="sp-memory">
      <div className="sp-memory-top">
        <div className="sp-memory-pick">
          {data.terms.length > 1 && (
            <select
              value={`${data.term}|${data.session}`}
              onChange={(e) => { const [term, session] = e.target.value.split('|'); setPick({ term, session }); }}
              aria-label="Choose a term"
            >
              {data.terms.map((t) => (
                <option key={`${t.term}|${t.session}`} value={`${t.term}|${t.session}`}>{t.term}{t.session ? ` · ${t.session}` : ''}</option>
              ))}
            </select>
          )}
          {currentUser?.role === 'student' && (
            <div className="sp-seg" role="group" aria-label="Whose memories">
              <button type="button" className={!onlyMine ? 'on' : ''} onClick={() => setOnlyMine(false)}>Whole class</button>
              <button type="button" className={onlyMine ? 'on' : ''} onClick={() => setOnlyMine(true)}>Just mine</button>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setPlayFrom(0)}>
          <Play size={16} /> Play Memory Lane
        </button>
      </div>

      {months.length === 0 ? (
        <p className="sp-empty">You haven't been in the Spotlight this term yet — your turn is coming!</p>
      ) : months.map((m) => (
        <div key={m.label} className="sp-month">
          <h3>{m.label}</h3>
          <div className="sp-collage">
            {m.items.map(({ round, entry }) => {
              const url = entry.image_path ? urls[entry.image_path] : undefined;
              return (
                <button type="button" key={entry.id} className={`sp-tile${url ? ' photo' : ' text'}`} onClick={() => setPlayFrom(entryIndex[entry.id] ?? 0)}>
                  {url ? <img src={url} alt="" loading="lazy" /> : (
                    <span className="sp-tile-text">{entry.response_text}</span>
                  )}
                  <span className="sp-tile-cap">
                    <b>{firstName(round.student.name)}</b>
                    <small>{KIND_EMOJI[entry.kind ?? ''] ?? '⭐'} {KIND_LABEL[entry.kind ?? ''] ?? ''} · {weekendLabel(round.weekend_date)}</small>
                    {entry.avg != null && <span className="sp-tile-stars"><StarRow value={entry.avg} size={11} /> {entry.avg.toFixed(1)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {playFrom !== null && slides.length > 0 && (
        <Player slides={slides} start={playFrom} urls={urls} onClose={() => setPlayFrom(null)} />
      )}
    </div>
  );
};

export default MemoryLane;

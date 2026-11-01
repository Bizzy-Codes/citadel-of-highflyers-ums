import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Send, EyeOff, Eye, Shuffle, Clock, CheckCircle2, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  type SpotlightEntry, type SpotlightRound,
  KIND_EMOJI, KIND_LABEL, weekendLabel, timeLeft,
  submitEntry, rateEntry, hideEntry, redrawRound, uploadSpotlightPhoto,
} from '../../lib/spotlight';
import { usePhotoUrls } from './usePhotoUrls';
import { StarInput, StarRow } from './Stars';
import Avatar from './Avatar';

const firstName = (name: string) => name.split(' ')[0] || name;

interface Draft { text: string; file: File | null; preview: string | null; busy: boolean; error: string | null; saved: boolean }

// ---- one task: the question, the pupil's answer, the class's stars -------
const EntryCard = ({ entry, round, photoUrl, canRate, isStaff, onChanged }: {
  entry: SpotlightEntry;
  round: SpotlightRound;
  photoUrl?: string;
  canRate: boolean;
  isStaff: boolean;
  onChanged: () => void;
}) => {
  const answering = round.is_me && round.phase === 'open';
  const [draft, setDraft] = useState<Draft>({ text: entry.response_text ?? '', file: null, preview: null, busy: false, error: null, saved: false });
  const [rateError, setRateError] = useState<string | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  // What the pupil just tapped shows straight away; after that the value from the server takes over.
  const [pendingStars, setPendingStars] = useState<number | null>(null);
  const myStars = pendingStars ?? entry.my_stars;
  const camRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (draft.preview) URL.revokeObjectURL(draft.preview); }, [draft.preview]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    setDraft((d) => ({ ...d, file, preview: URL.createObjectURL(file), error: null, saved: false }));
  };

  const share = async () => {
    const text = draft.text.trim();
    if (!text && !draft.file && !entry.image_path) { setDraft((d) => ({ ...d, error: 'Write something or add a photo first.' })); return; }
    if (entry.needs_photo && !draft.file && !entry.image_path) { setDraft((d) => ({ ...d, error: 'This task needs a photo — tap "Take a photo" or "Choose a photo".' })); return; }
    setDraft((d) => ({ ...d, busy: true, error: null }));
    let path: string | undefined;
    if (draft.file) {
      const up = await uploadSpotlightPhoto(round.id, entry.id, draft.file);
      if (up.error) { setDraft((d) => ({ ...d, busy: false, error: up.error ?? 'Could not upload the photo.' })); return; }
      path = up.path;
    }
    const err = await submitEntry(entry.id, text, path);
    if (err) { setDraft((d) => ({ ...d, busy: false, error: err })); return; }
    setDraft((d) => ({ ...d, busy: false, file: null, preview: null, saved: true }));
    onChanged();
  };

  const rate = async (stars: number) => {
    setRateError(null);
    setRatingBusy(true);
    setPendingStars(stars);
    const err = await rateEntry(entry.id, stars);
    setRatingBusy(false);
    if (err) { setPendingStars(null); setRateError(err); return; }
    onChanged();
  };

  const toggleHide = async () => {
    const err = await hideEntry(entry.id, !entry.hidden);
    if (err) alert(err);
    else onChanged();
  };

  const shownPhoto = draft.preview ?? photoUrl;

  return (
    <article className={`sp-entry${entry.hidden ? ' is-hidden' : ''}`}>
      <header className="sp-entry-head">
        <span className="sp-kind">{KIND_EMOJI[entry.kind ?? ''] ?? '⭐'} {KIND_LABEL[entry.kind ?? ''] ?? 'Task'}</span>
        <span className="sp-task-no">Task {entry.position}</span>
      </header>
      <p className="sp-prompt">{entry.prompt}</p>

      {answering ? (
        <div className="sp-answer">
          {shownPhoto && <img className="sp-photo" src={shownPhoto} alt="Your photo" />}
          <textarea
            className="sp-textarea"
            rows={4}
            maxLength={3000}
            value={draft.text}
            placeholder={entry.needs_photo ? 'Add a photo, then tell us about it…' : 'Type your answer here…'}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value, saved: false }))}
          />
          <div className="sp-answer-actions">
            <button type="button" className="btn btn-outline sm" onClick={() => camRef.current?.click()}><Camera size={16} /> Take a photo</button>
            <button type="button" className="btn btn-outline sm" onClick={() => pickRef.current?.click()}><ImagePlus size={16} /> Choose a photo</button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={pickRef} type="file" accept="image/*" hidden onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <p className="sp-hint">Photos of things, pets, drawings and your work are great. Please don't show faces unless a grown-up says it's OK.</p>
          {draft.error && <p className="sp-error" role="alert">{draft.error}</p>}
          <div className="sp-answer-foot">
            <button type="button" className="btn btn-primary" onClick={share} disabled={draft.busy}>
              {draft.busy ? <><Loader2 size={16} className="sp-spin" /> Sharing…</> : <><Send size={16} /> {entry.submitted ? 'Update my answer' : 'Share with my class'}</>}
            </button>
            {entry.submitted && !draft.busy && <span className="sp-ok"><CheckCircle2 size={16} /> Shared{draft.saved ? ' — saved!' : ''}</span>}
          </div>
        </div>
      ) : entry.submitted ? (
        <div className="sp-shared">
          {entry.hidden && !isStaff ? (
            <p className="sp-muted">This answer was hidden by a teacher.</p>
          ) : (
            <>
              {entry.hidden && <p className="sp-warn">Hidden from the class.</p>}
              {photoUrl && <img className="sp-photo" src={photoUrl} alt={`${firstName(round.student.name)}'s photo`} loading="lazy" />}
              {entry.response_text && <p className="sp-response">{entry.response_text}</p>}
            </>
          )}
          <div className="sp-score">
            <StarRow value={entry.avg} size={18} />
            <span className="sp-score-num">{entry.avg != null ? entry.avg.toFixed(1) : '—'}</span>
            <span className="sp-muted">({entry.count} {entry.count === 1 ? 'rating' : 'ratings'})</span>
          </div>

          {canRate && !entry.hidden && (
            <div className="sp-rate-box">
              <strong>{myStars ? 'Your stars' : `How did ${firstName(round.student.name)} do?`}</strong>
              <StarInput value={myStars} onChange={rate} disabled={ratingBusy} />
              {rateError && <p className="sp-error" role="alert">{rateError}</p>}
            </div>
          )}
          {isStaff && (
            <button type="button" className="sp-link-btn" onClick={toggleHide}>
              {entry.hidden ? <><Eye size={14} /> Show to class</> : <><EyeOff size={14} /> Hide from class</>}
            </button>
          )}
        </div>
      ) : (
        <p className="sp-waiting">
          {round.is_me
            ? 'The weekend is over, so this one stayed empty.'
            : `Waiting for ${firstName(round.student.name)} to share this one…`}
        </p>
      )}
    </article>
  );
};

// ---- the whole round ---------------------------------------------------------
const RoundView = ({ round, thisWeekend, onChanged, onStartNew }: {
  round: SpotlightRound;
  thisWeekend: string;
  onChanged: () => void;
  onStartNew?: () => void;
}) => {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';
  const isPupil = currentUser?.role === 'student';
  const urls = usePhotoUrls(round.entries.map((e) => e.image_path));
  const [redrawing, setRedrawing] = useState(false);
  const [showOwed, setShowOwed] = useState(false);

  const anyShared = round.entries.some((e) => e.submitted);
  const rated = round.raters_total - round.raters_missing;
  const isCurrent = round.weekend_date === thisWeekend;
  const myOwed = isPupil && !round.is_me
    ? round.entries.filter((e) => e.submitted && !e.hidden && e.my_stars == null).length
    : 0;

  const redraw = async () => {
    if (!confirm('Pick a different pupil for this weekend? (Only possible before anything is shared.)')) return;
    setRedrawing(true);
    const err = await redrawRound(round.id);
    setRedrawing(false);
    if (err) alert(err);
    else onChanged();
  };

  return (
    <section className="sp-round">
      <div className="sp-round-hero">
        <Avatar name={round.student.name} url={round.student.avatar_url} size={64} />
        <div className="sp-round-who">
          <span className="sp-chip">{isCurrent ? 'In the Spotlight this weekend' : `Spotlight · ${weekendLabel(round.weekend_date)}`}</span>
          <h2>{round.is_me ? `It's YOU, ${firstName(round.student.name)}! 🎉` : round.student.name}</h2>
          <p>
            {isCurrent && <span>{weekendLabel(round.weekend_date)} · </span>}
            {round.phase === 'open' && <><Clock size={14} /> Answers close in {timeLeft(round.submit_until)}</>}
            {round.phase === 'rating' && <><Clock size={14} /> Answers are closed · ratings {timeLeft(round.rate_until)}</>}
            {round.phase === 'closed' && <>This Spotlight is finished</>}
          </p>
        </div>
      </div>

      {round.is_me && round.phase === 'open' && (
        <div className="sp-callout">
          <strong>Your turn!</strong> You have {round.entries.length === 1 ? 'a task' : `${round.entries.length} tasks`} below. Your whole class will see your answers and give you stars.
        </div>
      )}
      {myOwed > 0 && round.phase !== 'closed' && (
        <div className="sp-callout warn">
          <strong>{myOwed === 1 ? '1 answer is' : `${myOwed} answers are`} waiting for your stars!</strong> Rating every weekend keeps your streak 🔥 alive.
        </div>
      )}

      <div className="sp-entries">
        {round.entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            round={round}
            photoUrl={entry.image_path ? urls[entry.image_path] : undefined}
            canRate={isPupil && !round.is_me && round.phase !== 'closed'}
            isStaff={isStaff}
            onChanged={onChanged}
          />
        ))}
      </div>

      {anyShared && round.raters_total > 0 && (
        <div className="sp-progress-card">
          <div className="sp-progress-top">
            <span><Users size={15} /> {rated} of {round.raters_total} classmates have rated</span>
            {isStaff && round.pending_raters.length > 0 && (
              <button type="button" className="sp-link-btn" onClick={() => setShowOwed((v) => !v)}>
                {showOwed ? 'Hide list' : `Who is left? (${round.pending_raters.length})`}
              </button>
            )}
          </div>
          <div className="sp-progress-bar"><span style={{ width: `${Math.round((rated / round.raters_total) * 100)}%` }} /></div>
          {isStaff && showOwed && (
            <ul className="sp-owed">{round.pending_raters.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
        </div>
      )}

      {isStaff && isCurrent && !anyShared && (
        <button type="button" className="btn btn-outline sm" onClick={redraw} disabled={redrawing}>
          <Shuffle size={15} /> {redrawing ? 'Picking…' : 'Pick someone else'}
        </button>
      )}
      {isStaff && onStartNew && !isCurrent && (
        <button type="button" className="btn btn-outline sm" onClick={onStartNew}>Start this weekend's Spotlight now</button>
      )}
    </section>
  );
};

export default RoundView;

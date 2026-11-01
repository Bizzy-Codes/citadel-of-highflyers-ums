import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  type SpotlightTask, type TaskBand, type TaskKind,
  listTasks, addTask, setTaskActive, deleteTask, KIND_EMOJI, KIND_LABEL, BAND_LABEL,
} from '../../lib/spotlight';

const KINDS = Object.keys(KIND_LABEL) as TaskKind[];
const BANDS = Object.keys(BAND_LABEL) as TaskBand[];

// The pool the weekly draw picks from. Staff can add their own ideas,
// switch ones off (they keep their history) and admins can delete.
const TaskBank = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [tasks, setTasks] = useState<SpotlightTask[] | null>(null);
  const [filterBand, setFilterBand] = useState<TaskBand | 'all'>('all');
  const [filterKind, setFilterKind] = useState<TaskKind | 'all'>('all');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<TaskKind>('fun');
  const [bands, setBands] = useState<TaskBand[]>(['early', 'lower', 'upper']);
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => listTasks().then(setTasks);
  useEffect(() => { load(); }, []);

  const shown = useMemo(
    () => (tasks ?? []).filter((t) => (filterBand === 'all' || t.bands.includes(filterBand)) && (filterKind === 'all' || t.kind === filterKind)),
    [tasks, filterBand, filterKind],
  );

  const toggleBand = (b: TaskBand) => setBands((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (prompt.trim().length < 5) { setError('Write the task first (at least a few words).'); return; }
    if (bands.length === 0) { setError('Pick at least one class group.'); return; }
    if (!currentUser) return;
    setBusy(true);
    const err = await addTask({ prompt, kind, bands, needs_photo: needsPhoto }, currentUser.id);
    setBusy(false);
    if (err) { setError(err); return; }
    setPrompt(''); setNeedsPhoto(false);
    load();
  };

  const toggle = async (t: SpotlightTask) => {
    const err = await setTaskActive(t.id, !t.active);
    if (err) alert(err); else load();
  };

  const remove = async (t: SpotlightTask) => {
    if (!confirm('Delete this task for good? (Switching it off keeps it for later.)')) return;
    const err = await deleteTask(t.id);
    if (err) alert(err); else load();
  };

  return (
    <div className="sp-bank">
      <form className="sp-bank-form" onSubmit={add}>
        <h3>Add a task</h3>
        <textarea
          className="sp-textarea" rows={2} maxLength={500} value={prompt}
          placeholder='e.g. "Show us your favourite book and tell us what it is about."'
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="sp-bank-row">
          <label>Type
            <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_EMOJI[k]} {KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="sp-check"><input type="checkbox" checked={needsPhoto} onChange={(e) => setNeedsPhoto(e.target.checked)} /> Needs a photo</label>
        </div>
        <div className="sp-bank-row">
          {BANDS.map((b) => (
            <label key={b} className="sp-check"><input type="checkbox" checked={bands.includes(b)} onChange={() => toggleBand(b)} /> {BAND_LABEL[b]}</label>
          ))}
        </div>
        {error && <p className="sp-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary sm" disabled={busy}>
          {busy ? <Loader2 size={15} className="sp-spin" /> : <Plus size={15} />} Add task
        </button>
      </form>

      <div className="sp-bank-filters">
        <select value={filterBand} onChange={(e) => setFilterBand(e.target.value as TaskBand | 'all')} aria-label="Filter by class group">
          <option value="all">All class groups</option>
          {BANDS.map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
        </select>
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value as TaskKind | 'all')} aria-label="Filter by type">
          <option value="all">All types</option>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_EMOJI[k]} {KIND_LABEL[k]}</option>)}
        </select>
        <span className="sp-muted">{tasks ? `${shown.length} of ${tasks.length}` : ''}</span>
      </div>

      {tasks === null ? <p className="sp-empty"><Loader2 size={16} className="sp-spin" /> Loading…</p> : (
        <ul className="sp-bank-list">
          {shown.map((t) => (
            <li key={t.id} className={t.active ? '' : 'off'}>
              <div className="sp-bank-text">
                <p>{t.prompt}</p>
                <div className="sp-bank-meta">
                  <span>{KIND_EMOJI[t.kind]} {KIND_LABEL[t.kind]}</span>
                  <span>{t.bands.map((b) => BAND_LABEL[b]).join(', ')}</span>
                  {t.needs_photo && <span>📸 photo</span>}
                </div>
              </div>
              <div className="sp-bank-actions">
                <button type="button" className="btn btn-outline sm" onClick={() => toggle(t)}>{t.active ? 'Switch off' : 'Switch on'}</button>
                {isAdmin && <button type="button" className="icon-btn" onClick={() => remove(t)} aria-label="Delete task"><Trash2 size={16} /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaskBank;

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { supabase } from '../../lib/supabaseClient';
import { allVoiceLines } from '../../components/ai/voiceLines';
import { ArrowLeft, Sparkles, Trash2, RefreshCw, Loader2, Pencil, Save, X, Database, Volume2 } from 'lucide-react';

// Admin > Citadel AI: what people ask the helper, the ready-made FAQ
// answers it gives instantly, and the storage it uses -- with delete
// buttons for all of it. Questions delete themselves after 90 days and
// stored answers after 7 (pg_cron, patch_33); this page is for doing it
// sooner.

interface Question { id: number; question: string; role: string; handled: string; created_at: string }
interface Faq {
  id: number; phrases: string[]; roles: string[]; answer: string;
  open_page: string | null; start_guide: string | null;
  source: string; asked: number; enabled: boolean;
}
interface Stats { questions: number; faqs: number; stored_answers: number; bytes: number }

const HANDLED_LABEL: Record<string, string> = {
  instant: 'Instant', faq: 'FAQ', cache: 'Stored answer', gemini: 'Gemini',
};
const ROLE_LABEL: Record<string, string> = {
  guest: 'Visitor', student: 'Pupil/parent', teacher: 'Teacher', teacher_pending: 'Teacher (pending)', admin: 'Admin',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const card: React.CSSProperties = { padding: '24px', borderRadius: '24px', border: '1px solid var(--glass-border)' };
const pill = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: bg, color: fg, whiteSpace: 'nowrap',
});

const AdminCitadelAI = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [voice, setVoice] = useState<{ clips: number; bytes: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; answer: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'gemini'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [s, q, f, v] = await Promise.all([
      supabase.rpc('ai_storage_stats'),
      supabase.from('ai_questions').select('id, question, role, handled, created_at').order('created_at', { ascending: false }).limit(300),
      supabase.from('ai_faq').select('id, phrases, roles, answer, open_page, start_guide, source, asked, enabled').order('source').order('id'),
      supabase.rpc('ai_voice_stats'),
    ]);
    setStats((s.data as Stats[] | null)?.[0] ?? null);
    setVoice((v.data as { clips: number; bytes: number }[] | null)?.[0] ?? null);
    setQuestions((q.data as Question[] | null) ?? []);
    setFaqs((f.data as Faq[] | null) ?? []);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
  useEffect(() => { load(); }, [load]);

  // Most-asked questions over what's loaded, to see what people want.
  const topAsked = useMemo(() => {
    const counts = new Map<string, { text: string; n: number; handled: Set<string> }>();
    for (const q of questions) {
      const k = q.question.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const c = counts.get(k) ?? { text: q.question, n: 0, handled: new Set<string>() };
      c.n++; c.handled.add(q.handled);
      counts.set(k, c);
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  }, [questions]);

  const shown = filter === 'gemini' ? questions.filter((q) => q.handled === 'gemini') : questions;

  const run = async (key: string, fn: () => Promise<string | null>) => {
    setBusy(key);
    setNotice(null);
    const msg = await fn();
    if (msg) setNotice(msg);
    setBusy(null);
    await load();
  };

  const deleteQuestion = (id: number) => run(`q${id}`, async () => {
    const { error } = await supabase.from('ai_questions').delete().eq('id', id);
    return error ? `Couldn't delete: ${error.message}` : null;
  });

  const deleteAllQuestions = () => {
    if (!confirm('Delete every question in the log? This cannot be undone, and the next FAQ update will have nothing to learn from.')) return;
    run('allq', async () => {
      const { error } = await supabase.from('ai_questions').delete().gt('id', 0);
      return error ? `Couldn't delete: ${error.message}` : 'All questions deleted.';
    });
  };

  const clearStoredAnswers = () => {
    if (!confirm('Clear all stored answers? Visitors will get fresh answers from Gemini (a little slower the first time).')) return;
    run('cache', async () => {
      const { error } = await supabase.from('ai_answer_cache').delete().neq('key', '');
      return error ? `Couldn't clear: ${error.message}` : 'Stored answers cleared.';
    });
  };

  const toggleFaq = (f: Faq) => run(`f${f.id}`, async () => {
    const { error } = await supabase.from('ai_faq').update({ enabled: !f.enabled, updated_at: new Date().toISOString() }).eq('id', f.id);
    return error ? `Couldn't update: ${error.message}` : null;
  });

  const deleteFaq = (f: Faq) => {
    if (!confirm(`Delete this FAQ?\n\n"${f.answer}"`)) return;
    run(`f${f.id}`, async () => {
      const { error } = await supabase.from('ai_faq').delete().eq('id', f.id);
      return error ? `Couldn't delete: ${error.message}` : null;
    });
  };

  const saveFaq = () => {
    if (!editing) return;
    const { id, answer } = editing;
    if (!answer.trim()) return;
    run(`f${id}`, async () => {
      const { error } = await supabase.from('ai_faq').update({ answer: answer.trim(), updated_at: new Date().toISOString() }).eq('id', id);
      setEditing(null);
      return error ? `Couldn't save: ${error.message}` : 'Answer saved. Visitors see it within a few hours (or straight away after a page refresh).';
    });
  };

  const voiceNote = (v?: { newly_saved?: number; remaining?: number; out_of_allowance?: boolean; pieces?: number }) =>
    v ? ` Voices: ${(v.pieces ?? 0) - (v.remaining ?? 0)} of ${v.pieces ?? 0} lines recorded (${v.newly_saved ?? 0} just now).`
      + (v.remaining
        ? v.out_of_allowance
          ? ' Google\'s free daily voice allowance is used up; the rest are recorded over the next nights.'
          : ' Press again to record more, or it carries on tonight.'
        : ' All done.')
      : '';

  const learnNow = () => run('learn', async () => {
    const { data, error } = await supabase.functions.invoke('citadel-ai', { body: { refresh_faq: true } });
    if (error) return "Couldn't run the update right now. Please try again later.";
    const learned = data?.note ?? `Looked at ${data?.looked_at ?? 0} questions: ${data?.added ?? 0} new FAQ answers, ${data?.updated ?? 0} updated.`;
    return learned + voiceNote(data?.voices);
  });

  const recordVoices = () => run('voices', async () => {
    // Queue every fixed line the helper can say (page openings, guide
    // steps, built-in and FAQ answers), then record what we can now.
    const lines = allVoiceLines(faqs.filter((f) => f.enabled));
    const { error: queueError } = await supabase.from('ai_voice_queue')
      .upsert(lines.map((l) => ({ text: l.text, priority: l.priority })), { onConflict: 'text' });
    if (queueError) return `Couldn't queue the voice lines: ${queueError.message}`;
    const { data, error } = await supabase.functions.invoke('citadel-ai', { body: { prerender_voice: true } });
    if (error) return "Couldn't record voices right now. Please try again later.";
    return voiceNote(data).trim();
  });

  return (
    <PortalLayout title="Citadel AI">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <Link to="/portal/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={24} /> Citadel AI
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', maxWidth: '720px' }}>
            What people ask the helper, and the ready-made answers it gives instantly. Only the words of each question are kept
            (no names or accounts), and they delete themselves after 3 months. Every 1st and 15th of the month the helper
            learns new FAQ answers from the questions it had to think about.
          </p>
        </div>

        {notice && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--accent)', color: 'var(--primary)', fontSize: '14px' }}>{notice}</div>
        )}

        {/* Storage */}
        <section className="card glass" style={card}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Database size={18} /> Storage used
          </h3>
          {stats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              {[
                ['Questions logged', stats.questions],
                ['FAQ answers', stats.faqs],
                ['Stored answers', stats.stored_answers],
                ['Database space', fmtBytes(stats.bytes)],
                ['Voice clips', voice ? `${voice.clips} · ${fmtBytes(voice.bytes)}` : '—'],
              ].map(([label, value]) => (
                <div key={label as string} style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-light)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>{loading ? 'Loading…' : 'Not available.'}</p>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button className="btn btn-outline sm" onClick={clearStoredAnswers} disabled={busy !== null}>
              {busy === 'cache' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Clear stored answers
            </button>
            <button className="btn btn-outline sm" onClick={deleteAllQuestions} disabled={busy !== null || !questions.length}>
              {busy === 'allq' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete all questions
            </button>
          </div>
        </section>

        {/* Most asked */}
        <section className="card glass" style={card}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>Most asked</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>From the latest {questions.length} questions.</p>
          {topAsked.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No questions yet.</p>}
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
            {topAsked.map((t) => (
              <li key={t.text}>
                <strong>{t.text}</strong>{' '}
                <span style={{ color: 'var(--text-muted)' }}>· {t.n}× · {[...t.handled].map((h) => HANDLED_LABEL[h] ?? h).join(', ')}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ answers */}
        <section className="card glass" style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Ready-made answers ({faqs.length})</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Given instantly, without asking Gemini. Switch one off to stop using it.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-outline sm" onClick={recordVoices} disabled={busy !== null} title="Record the natural voice for every answer, so it plays instantly">
                {busy === 'voices' ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />} Record voices now
              </button>
              <button className="btn btn-primary sm" onClick={learnNow} disabled={busy !== null}>
                {busy === 'learn' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Learn from questions now
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {faqs.map((f) => (
              <div key={f.id} style={{ padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)', opacity: f.enabled ? 1 : 0.55 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '14px' }}>“{f.phrases[0]}”</strong>
                  <span style={f.source === 'learned' ? pill('#D1FAE5', '#065F46') : pill('var(--accent)', 'var(--primary)')}>
                    {f.source === 'learned' ? `Learned · asked ${f.asked}×` : 'Built-in'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}</span>
                </div>
                {editing?.id === f.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea rows={3} value={editing.answer} onChange={(e) => setEditing({ id: f.id, answer: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary sm" onClick={saveFaq} disabled={busy !== null}><Save size={14} /> Save</button>
                      <button className="btn btn-outline sm" onClick={() => setEditing(null)}><X size={14} /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', margin: 0 }}>{f.answer}</p>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
                  {(f.open_page || f.start_guide) && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {f.open_page ? `Opens: ${f.open_page}` : ''}{f.open_page && f.start_guide ? ' · ' : ''}{f.start_guide ? `Guide: ${f.start_guide}` : ''}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-outline sm" onClick={() => setEditing({ id: f.id, answer: f.answer })} disabled={busy !== null}><Pencil size={14} /> Edit</button>
                  <button className="btn btn-outline sm" onClick={() => toggleFaq(f)} disabled={busy !== null}>{f.enabled ? 'Switch off' : 'Switch on'}</button>
                  <button className="icon-btn" title="Delete" onClick={() => deleteFaq(f)} disabled={busy !== null}><Trash2 size={16} /></button>
                </div>
                {f.phrases.length > 1 && (
                  <details style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <summary style={{ cursor: 'pointer' }}>{f.phrases.length} ways people ask this</summary>
                    <p style={{ margin: '6px 0 0' }}>{f.phrases.join(' · ')}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Question log */}
        <section className="card glass" style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Recent questions</h3>
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'gemini')}
              style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}>
              <option value="all">All questions</option>
              <option value="gemini">Only ones Gemini answered</option>
            </select>
          </div>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
          {!loading && shown.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No questions yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {shown.map((q) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>{q.question}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {fmtDate(q.created_at)} · {ROLE_LABEL[q.role] ?? q.role} · {HANDLED_LABEL[q.handled] ?? q.handled}
                  </div>
                </div>
                <button className="icon-btn" title="Delete" onClick={() => deleteQuestion(q.id)} disabled={busy !== null}>
                  {busy === `q${q.id}` ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PortalLayout>
  );
};

export default AdminCitadelAI;

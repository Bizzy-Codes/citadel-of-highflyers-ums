import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth, type TestQuestion, type TestQuestionOption } from '../../context/AuthContext';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Send, Lock, X } from 'lucide-react';
import './Tests.css';

interface QuestionFormState {
  id?: string;
  type: 'objective' | 'essay';
  prompt: string;
  points: number;
  options: TestQuestionOption[];
  correctOption: string;
  modelAnswer: string;
  keywords: { phrase: string; points: number }[];
}

const nextOptionKey = (options: TestQuestionOption[]) => String.fromCharCode(65 + options.length);

const blankForm: QuestionFormState = {
  type: 'objective',
  prompt: '',
  points: 1,
  options: [{ key: 'A', text: '' }, { key: 'B', text: '' }],
  correctOption: 'A',
  modelAnswer: '',
  keywords: [],
};

const TestEditor = () => {
  const { testId } = useParams();
  const { tests, getTestQuestions, saveQuestion, deleteQuestion, reorderQuestions, publishTest, closeTest } = useAuth();
  const test = tests.find((t) => t.id === testId);

  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<QuestionFormState>(blankForm);
  const [saving, setSaving] = useState(false);

  const loadQuestions = async () => {
    if (!testId) return;
    setLoading(true);
    setQuestions(await getTestQuestions(testId));
    setLoading(false);
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const startNew = () => { setForm(blankForm); setShowForm(true); };

  const startEdit = (q: TestQuestion) => {
    setForm({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      options: q.options ?? [{ key: 'A', text: '' }, { key: 'B', text: '' }],
      correctOption: q.correctOption ?? (q.options?.[0]?.key ?? 'A'),
      modelAnswer: q.modelAnswer ?? '',
      keywords: q.keywords ?? [],
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId) return;
    setSaving(true);
    const { error } = await saveQuestion(testId, {
      id: form.id,
      type: form.type,
      prompt: form.prompt,
      points: form.points,
      options: form.type === 'objective' ? form.options : undefined,
      correctOption: form.type === 'objective' ? form.correctOption : undefined,
      modelAnswer: form.type === 'essay' ? (form.modelAnswer || undefined) : undefined,
      keywords: form.type === 'essay' ? form.keywords : undefined,
    });
    setSaving(false);
    if (error) { alert('Failed to save question: ' + error); return; }
    setShowForm(false);
    await loadQuestions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await deleteQuestion(id);
    await loadQuestions();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const reordered = [...questions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setQuestions(reordered);
    await reorderQuestions(reordered.map((q) => q.id));
    await loadQuestions();
  };

  const addOption = () => setForm({ ...form, options: [...form.options, { key: nextOptionKey(form.options), text: '' }] });

  const removeOption = (key: string) => {
    const remaining = form.options.filter((o) => o.key !== key);
    setForm({ ...form, options: remaining, correctOption: form.correctOption === key ? (remaining[0]?.key ?? '') : form.correctOption });
  };

  const addKeyword = () => setForm({ ...form, keywords: [...form.keywords, { phrase: '', points: 1 }] });
  const removeKeyword = (i: number) => setForm({ ...form, keywords: form.keywords.filter((_, idx) => idx !== i) });

  const keywordPointsSum = form.keywords.reduce((sum, k) => sum + (Number(k.points) || 0), 0);

  if (!test) {
    return (
      <PortalLayout title="Test Editor">
        <div className="card glass" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Test not found, or still loading. <Link to="/portal/teacher/tests">Back to Tests</Link>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Test Editor">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <Link to="/portal/teacher/tests" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> Back to Tests
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2>{test.title}</h2>
                <span className={`test-status-badge test-status-${test.status}`}>{test.status}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                {test.subject} &middot; {test.durationMinutes} min &middot; <strong>{test.totalPoints} total points</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {test.status !== 'published' && test.status !== 'closed' && (
                <button className="btn btn-primary sm" onClick={() => publishTest(test.id)}><Send size={16} /> Publish</button>
              )}
              {test.status === 'published' && (
                <button className="btn btn-outline sm" onClick={() => closeTest(test.id)}><Lock size={16} /> Close</button>
              )}
            </div>
          </div>
          {test.status === 'published' && (
            <p className="test-editor-warning">Editing a published test's points won't retroactively change any already-started or finished attempt's locked score denominator.</p>
          )}
        </div>

        <div className="card glass" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Questions ({questions.length})</h3>
            <button className="btn btn-primary sm" onClick={startNew}><Plus size={16} /> Add Question</button>
          </div>

          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading questions...</p>}
          {!loading && questions.length === 0 && (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0' }}>No questions yet. Add your first one above.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q, i) => (
              <div key={q.id} className="question-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                  <button className="icon-btn sm" disabled={i === questions.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                    <span className={`question-type-badge question-type-${q.type}`}>{q.type === 'objective' ? 'Objective' : 'Essay'}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{q.points} pts</span>
                  </div>
                  <p style={{ fontWeight: '600' }}>{q.prompt}</p>
                  {q.type === 'objective' && (
                    <ul className="question-options-preview">
                      {q.options?.map((o) => (
                        <li key={o.key} style={{ fontWeight: o.key === q.correctOption ? 700 : 400, color: o.key === q.correctOption ? 'var(--success)' : 'var(--text-main)' }}>
                          {o.key}. {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === 'essay' && q.keywords && q.keywords.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Rubric keywords: {q.keywords.map((k) => `"${k.phrase}" (${k.points}pt)`).join(', ')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="icon-btn" title="Edit" onClick={() => startEdit(q)}><Pencil size={16} /></button>
                  <button className="icon-btn" title="Delete" onClick={() => handleDelete(q.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{form.id ? 'Edit Question' : 'Add Question'}</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Question Type</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className={`btn sm ${form.type === 'objective' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, type: 'objective' })}>Objective</button>
                  <button type="button" className={`btn sm ${form.type === 'essay' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm({ ...form, type: 'essay' })}>Essay</button>
                </div>
              </div>

              <div className="input-group">
                <label>Prompt</label>
                <textarea rows={3} required value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
              </div>

              <div className="input-group">
                <label>Points</label>
                <input type="number" min={1} step="0.5" required value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                  style={{ width: '140px', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
              </div>

              {form.type === 'objective' && (
                <div className="input-group">
                  <label>Options (select the correct one)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.options.map((opt) => (
                      <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="radio" name="correctOption" checked={form.correctOption === opt.key}
                          onChange={() => setForm({ ...form, correctOption: opt.key })} />
                        <span style={{ width: '20px', fontWeight: 700 }}>{opt.key}.</span>
                        <input type="text" required value={opt.text}
                          onChange={(e) => setForm({ ...form, options: form.options.map((o) => o.key === opt.key ? { ...o, text: e.target.value } : o) })}
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                        <button type="button" className="icon-btn sm" disabled={form.options.length <= 2} onClick={() => removeOption(opt.key)}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-outline sm" style={{ marginTop: '8px' }} onClick={addOption}><Plus size={14} /> Add Option</button>
                </div>
              )}

              {form.type === 'essay' && (
                <>
                  <div className="input-group">
                    <label>Model Answer (optional, for future AI grading — never shown to pupils)</label>
                    <textarea rows={2} value={form.modelAnswer} onChange={(e) => setForm({ ...form, modelAnswer: e.target.value })}
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', resize: 'none' }} />
                  </div>
                  <div className="input-group">
                    <label>Rubric Keywords / Answer Variations (optional, for future AI grading)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {form.keywords.map((k, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" placeholder="phrase or keyword" value={k.phrase}
                            onChange={(e) => setForm({ ...form, keywords: form.keywords.map((kw, idx) => idx === i ? { ...kw, phrase: e.target.value } : kw) })}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                          <input type="number" min={0} step="0.5" placeholder="pts" value={k.points}
                            onChange={(e) => setForm({ ...form, keywords: form.keywords.map((kw, idx) => idx === i ? { ...kw, points: Number(e.target.value) } : kw) })}
                            style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                          <button type="button" className="icon-btn sm" onClick={() => removeKeyword(i)}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn btn-outline sm" style={{ marginTop: '8px' }} onClick={addKeyword}><Plus size={14} /> Add Keyword</button>
                    {keywordPointsSum > form.points && (
                      <p style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '8px' }}>
                        Keyword points ({keywordPointsSum}) add up to more than the question's {form.points} points.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save Question'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export default TestEditor;

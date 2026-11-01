import { Plus, Trash2, X } from 'lucide-react';
import type { EditAssignmentQuestionInput } from '../../context/AuthContext';
import { blankOptions, blankQuestion, fromExtracted, MAX_OPTIONS } from '../../lib/questionDraft';
import QuestionImport from './QuestionImport';

// Builds a list of questions: written (notebook / answer box / numbered
// lines) or multiple choice with the correct answer ticked -- the same
// idea as the test editor, so assignments and tests feel alike.
const QuestionBuilder = ({ value, onChange, forTest = false }: { value: EditAssignmentQuestionInput[]; onChange: (v: EditAssignmentQuestionInput[]) => void; forTest?: boolean }) => {
  const update = (i: number, patch: Partial<EditAssignmentQuestionInput>) =>
    onChange(value.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const setType = (i: number, type: 'written' | 'objective') => {
    const q = value[i];
    update(i, {
      type,
      options: (q.options && q.options.length >= 2) ? q.options : blankOptions(),
      answerMode: type === 'objective' ? 'none' : q.answerMode,
    });
  };

  const setOption = (i: number, key: string, text: string) =>
    update(i, { options: (value[i].options ?? []).map((o) => (o.key === key ? { ...o, text } : o)) });

  const addOption = (i: number) => {
    const opts = value[i].options ?? [];
    if (opts.length >= MAX_OPTIONS) return;
    update(i, { options: [...opts, { key: String.fromCharCode(65 + opts.length), text: '' }] });
  };

  // Removing a choice re-letters the rest so the keys stay A, B, C...
  const removeOption = (i: number, key: string) => {
    const q = value[i];
    const all = q.options ?? [];
    const removedAt = all.findIndex((o) => o.key === key);
    const relettered = all.filter((o) => o.key !== key).map((o, idx) => ({ ...o, key: String.fromCharCode(65 + idx) }));
    let correct = q.correctOption ?? '';
    if (correct === key) correct = '';
    else if (correct) {
      const at = all.findIndex((o) => o.key === correct);
      correct = String.fromCharCode(65 + (at > removedAt ? at - 1 : at));
    }
    update(i, { options: relettered, correctOption: correct });
  };

  const field = { width: '100%', boxSizing: 'border-box' as const, padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {value.map((q, i) => (
          <div key={i} className="grading-answer-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
              <strong>Question {i + 1}</strong>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button type="button" className={`btn sm ${q.type !== 'objective' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType(i, 'written')}>Written</button>
                <button type="button" className={`btn sm ${q.type === 'objective' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setType(i, 'objective')}>Multiple choice</button>
                <button type="button" className="icon-btn sm" title="Remove question" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><X size={14} /></button>
              </div>
            </div>
            <textarea rows={2} value={q.prompt} placeholder="Type the question..." onChange={(e) => update(i, { prompt: e.target.value })} style={{ ...field, resize: 'vertical' }} />

            {q.type === 'objective' ? (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(q.options ?? []).map((opt) => (
                    <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', fontWeight: 700, color: q.correctOption === opt.key ? 'var(--success)' : 'var(--text-main)' }}>{opt.key}.</span>
                      <input type="text" value={opt.text} placeholder={`Option ${opt.key}`} onChange={(e) => setOption(i, opt.key, e.target.value)} style={{ ...field, flex: 1, width: 'auto' }} />
                      <button type="button" className="icon-btn sm" disabled={(q.options ?? []).length <= 2} onClick={() => removeOption(i, opt.key)} title="Remove this option"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-outline sm" style={{ marginTop: '8px' }} disabled={(q.options ?? []).length >= MAX_OPTIONS} onClick={() => addOption(i)}><Plus size={14} /> Add option</button>
                <div className="answer-key-box" style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13px' }}>Correct answer <span style={{ color: 'var(--error)' }}>*</span></label>
                  <div className="answer-key-choices">
                    {(q.options ?? []).map((opt) => (
                      <button key={opt.key} type="button" title={opt.text ? `${opt.key}. ${opt.text}` : `Option ${opt.key}`}
                        className={`answer-key-choice ${q.correctOption === opt.key ? 'answer-key-choice-on' : ''}`}
                        onClick={() => update(i, { correctOption: opt.key })}>{opt.key}</button>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', marginTop: '6px', color: q.correctOption ? 'var(--success)' : 'var(--text-muted)' }}>
                    {q.correctOption ? `${q.correctOption} is the correct answer. Pupils never see this.` : 'Tap the letter of the correct option.'}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                {!forTest && <button type="button" className={`btn sm ${q.answerMode === 'none' ? 'btn-primary' : 'btn-outline'}`} onClick={() => update(i, { answerMode: 'none' })}>Notebook only</button>}
                <button type="button" className={`btn sm ${q.answerMode !== 'lines' && (forTest || q.answerMode === 'box') ? 'btn-primary' : 'btn-outline'}`} onClick={() => update(i, { answerMode: 'box' })}>Answer box</button>
                <button type="button" className={`btn sm ${q.answerMode === 'lines' ? 'btn-primary' : 'btn-outline'}`} onClick={() => update(i, { answerMode: 'lines' })}>Lines i, ii, iii</button>
                {q.answerMode === 'lines' && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    Lines
                    <input type="number" min={1} max={30} value={q.lineCount} onChange={(e) => update(i, { lineCount: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
                      style={{ width: '64px', padding: '6px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start', marginTop: '10px' }}>
        <button type="button" className="btn btn-outline sm" onClick={() => onChange([...value, blankQuestion()])}><Plus size={14} /> Add a question</button>
        <QuestionImport onExtracted={(qs) => onChange([...value, ...qs.map(fromExtracted)])} />
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
        Written: "Notebook only" means pupils copy it into their notebook; "Answer box" or "Lines" means they type the answer here. Multiple choice: tick the correct option. You can also read the questions straight from a photo, PDF or Word file.
      </p>
    </div>
  );
};

export default QuestionBuilder;

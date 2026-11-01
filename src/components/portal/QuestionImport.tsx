import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { extractQuestionsFromFile, QUESTION_FILE_ACCEPT, type ExtractedQuestion } from '../../lib/extractQuestions';

// "Read my questions from a photo / PDF / Word file". The file is read by
// the school's AI and the questions come back as editable text; the
// teacher reviews them before anything is saved.
const QuestionImport = ({ onExtracted, label = 'From photo, PDF or Word' }: {
  onExtracted: (questions: ExtractedQuestion[]) => void;
  label?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handle = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage('Reading your file... this can take up to a minute.');
    const res = await extractQuestionsFromFile(file);
    setBusy(false);
    if (res.error) { setMessage(res.error); return; }
    setMessage(`Found ${res.questions.length} question${res.questions.length === 1 ? '' : 's'}. Please check them before saving.`);
    onExtracted(res.questions);
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '6px' }}>
      <input ref={inputRef} type="file" accept={QUESTION_FILE_ACCEPT} style={{ display: 'none' }}
        onChange={(e) => { void handle(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <button type="button" className="btn btn-outline sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {label}
      </button>
      {message && <span style={{ fontSize: '12px', color: message.startsWith('Found') ? 'var(--success)' : busy ? 'var(--text-muted)' : 'var(--error)', maxWidth: '320px' }}>{message}</span>}
    </div>
  );
};

export default QuestionImport;

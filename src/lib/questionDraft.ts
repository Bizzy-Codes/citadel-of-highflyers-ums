import type { EditAssignmentQuestionInput } from '../context/AuthContext';
import type { ExtractedQuestion } from './extractQuestions';

export const MAX_OPTIONS = 8;

export const blankOptions = () => ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' }));

export const blankQuestion = (): EditAssignmentQuestionInput => ({
  prompt: '', answerMode: 'none', lineCount: 5, type: 'written', options: blankOptions(), correctOption: '',
});

// A question read from a photo/PDF/Word file, as an editable draft.
export const fromExtracted = (q: ExtractedQuestion): EditAssignmentQuestionInput => ({
  prompt: q.prompt,
  type: q.type,
  answerMode: q.type === 'written' ? 'box' : 'none',
  lineCount: 5,
  options: q.type === 'objective' ? q.options : blankOptions(),
  correctOption: q.correctOption,
});

// Returns a message for the first problem, or null if every question is ready.
export const validateQuestions = (questions: EditAssignmentQuestionInput[]): string | null => {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.prompt.trim()) return `Question ${i + 1} is empty. Type it or remove it.`;
    if (q.type === 'objective') {
      const filled = (q.options ?? []).filter((o) => o.text.trim());
      if (filled.length < 2) return `Question ${i + 1} needs at least two answer options.`;
      if (!q.correctOption || !filled.some((o) => o.key === q.correctOption)) {
        return `Question ${i + 1}: tick which option is the correct answer.`;
      }
    }
  }
  return null;
};

// Drops blank options from multiple-choice questions before saving.
export const cleanQuestions = (questions: EditAssignmentQuestionInput[]): EditAssignmentQuestionInput[] =>
  questions.map((q) => (q.type === 'objective'
    ? { ...q, options: (q.options ?? []).filter((o) => o.text.trim()).map((o) => ({ key: o.key, text: o.text.trim() })) }
    : q));

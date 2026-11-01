import { supabase } from './supabaseClient';
import { compressImageToTarget } from './imageCompression';

// A question read from a teacher's photo / PDF / Word file. The teacher
// always reviews these before pupils see them.
export interface ExtractedQuestion {
  prompt: string;
  type: 'written' | 'objective';
  options: { key: string; text: string }[];
  correctOption: string; // '' when the document did not mark one
}

export interface ExtractResult {
  questions: ExtractedQuestion[];
  note?: string;
  error: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

const toBase64 = async (file: Blob): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
};

export const QUESTION_FILE_ACCEPT = 'image/*,application/pdf,.pdf,.docx,.txt';

// Picks the right route for the file: photos and PDFs are read by the AI
// directly (it can read handwriting and scans); a Word file's own text is
// taken exactly as typed and then structured.
export async function extractQuestionsFromFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  let body: Record<string, string>;

  try {
    if (file.type.startsWith('image/')) {
      let img: File = file;
      try { img = await compressImageToTarget(file, 3 * 1024 * 1024, 2200); } catch { /* send the original */ }
      if (img.size > MAX_BYTES) return { questions: [], error: 'That photo is too big. Please take it again or choose a smaller one.' };
      body = { mimeType: img.type || 'image/jpeg', data: await toBase64(img) };
    } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      if (file.size > MAX_BYTES) return { questions: [], error: 'That PDF is too big (over 10 MB). Please use a smaller one.' };
      body = { mimeType: 'application/pdf', data: await toBase64(file) };
    } else if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth/mammoth.browser.js');
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      body = { text: value };
    } else if (name.endsWith('.txt') || file.type === 'text/plain') {
      body = { text: await file.text() };
    } else if (name.endsWith('.doc')) {
      return { questions: [], error: 'Old .doc files cannot be read. In Word, choose Save As and pick .docx or PDF, then try again.' };
    } else {
      return { questions: [], error: 'Please use a photo, a PDF or a Word (.docx) file.' };
    }
  } catch {
    return { questions: [], error: 'Could not open that file. Please try another one.' };
  }

  const { data, error } = await supabase.functions.invoke('extract-questions', { body });
  if (error) {
    let message = 'Could not read the file. Please try again.';
    try {
      const ctx = (error as { context?: Response }).context;
      const parsed = ctx ? await ctx.json() : null;
      if (parsed?.error) message = parsed.error as string;
    } catch { /* keep the generic message */ }
    return { questions: [], error: message };
  }
  if (data?.error) return { questions: [], error: data.error as string };
  const questions = (data?.questions ?? []) as ExtractedQuestion[];
  if (questions.length === 0) return { questions: [], note: data?.note, error: data?.note || 'No questions were found. Try a clearer photo or a different file.' };
  return { questions, note: data?.note, error: null };
}

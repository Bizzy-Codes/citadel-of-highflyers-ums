import { useMemo } from 'react';

// The pupil's answer sheet for one question, in the style the teacher
// chose: an open typing box, or numbered lines (i, ii, iii ...).
//
// Answers are plain text. Lines are stored as "i. first\nii. second" (only
// the filled-in ones) so they read correctly anywhere the text is shown --
// the teacher's marking screen needs no special handling.

const ROMAN: [number, string][] = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

export const toRoman = (n: number): string => {
  let rest = n;
  let out = '';
  for (const [value, sym] of ROMAN) while (rest >= value) { out += sym; rest -= value; }
  if (n >= 40) return String(n); // beyond a sensible list; show digits
  return out;
};

const fromRoman = (s: string): number => {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[s[i]] ?? 0;
    const next = ROMAN_VALUES[s[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
};

export const linesFromText = (text: string, count: number): string[] => {
  const lines = Array(count).fill('') as string[];
  for (const raw of text.split('\n')) {
    const m = raw.match(/^([ivxlc]+)\.\s?(.*)$/i);
    if (!m) continue;
    const idx = fromRoman(m[1].toLowerCase()) - 1;
    if (idx >= 0 && idx < count) lines[idx] = m[2];
  }
  return lines;
};

export const textFromLines = (lines: string[]): string =>
  lines.map((l, i) => (l.trim() ? `${toRoman(i + 1)}. ${l}` : '')).filter(Boolean).join('\n');

interface Props {
  mode: 'box' | 'lines';
  lineCount: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

const fieldStyle = {
  width: '100%', boxSizing: 'border-box' as const, padding: '12px', borderRadius: '10px',
  border: '1px solid var(--glass-border)', background: 'var(--bg-light)', fontSize: '16px',
  color: 'var(--text-main)',
};

const AnswerSheet = ({ mode, lineCount, value, onChange, disabled, placeholder, rows = 6 }: Props) => {
  const lines = useMemo(() => (mode === 'lines' ? linesFromText(value, lineCount) : []), [mode, lineCount, value]);

  if (mode === 'box') {
    return (
      <textarea
        rows={rows}
        disabled={disabled}
        placeholder={placeholder ?? 'Type your answer here...'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...fieldStyle, resize: 'vertical', padding: '14px', borderRadius: '12px' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '34px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{toRoman(i + 1)}.</span>
          <input
            type="text"
            disabled={disabled}
            value={line}
            onChange={(e) => {
              const next = [...lines];
              next[i] = e.target.value;
              onChange(textFromLines(next));
            }}
            style={fieldStyle}
          />
        </div>
      ))}
    </div>
  );
};

export default AnswerSheet;

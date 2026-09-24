import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar } from 'lucide-react';
import './DateWheelInput.css';

// Drop-in replacement for <input type="date">. Teachers found the
// browser's month-grid calendar slow for dates of birth -- getting to
// 2016 meant pressing "previous" dozens of times -- so this opens three
// swipeable wheels instead (day / month / year), like a phone's alarm
// picker. Value in and out is the same "YYYY-MM-DD" string (or '') the
// native input used, so callers swap the tag and nothing else.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const ROW = 44;       // px per wheel row -- keep in step with the CSS
const VISIBLE = 5;    // rows shown; the middle one is the selection

interface Parts { d: number; m: number; y: number }

function parse(value: string | undefined | null): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  return { y: +match[1], m: +match[2] - 1, d: +match[3] };
}

function format({ d, m, y }: Parts): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysIn(m: number, y: number) {
  return new Date(y, m + 1, 0).getDate();
}

// ---- one scrolling column ------------------------------------------

interface WheelProps {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  label: string;
}

const Wheel = ({ items, index, onChange, label }: WheelProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(index);
  // Follow the selection when it changes from outside (e.g. 31 -> 28
  // when the month becomes February).
  const [prevIndex, setPrevIndex] = useState(index);
  if (index !== prevIndex) {
    setPrevIndex(index);
    setLive(index);
  }
  const settle = useRef<number | undefined>(undefined);
  const drag = useRef<{ y: number; top: number } | null>(null);

  // Snap to the selected row whenever the selection changes from
  // outside (first open, or the day being clamped after a month change)
  // -- but not while it matches where the user already scrolled to.
  // Moving scrollTop fires onScroll, which updates the highlight.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTop = index * ROW;
  }, [index, items.length]);

  const pick = (i: number, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ top: clamped * ROW, behavior: smooth ? 'smooth' : 'auto' });
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
    setLive(i);
    window.clearTimeout(settle.current);
    // Report only once the wheel comes to rest, so the day column isn't
    // rebuilt dozens of times mid-fling.
    settle.current = window.setTimeout(() => { if (!drag.current) onChange(i); }, 110);
  };

  // Touch and trackpads scroll natively; a mouse needs click-and-drag.
  const onMouseDown = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    drag.current = { y: e.clientY, top: el.scrollTop };
    el.classList.add('dwi-dragging');
    const move = (ev: MouseEvent) => {
      if (drag.current) el.scrollTop = drag.current.top - (ev.clientY - drag.current.y);
    };
    const up = (ev: MouseEvent) => {
      const moved = drag.current ? Math.abs(ev.clientY - drag.current.y) : 0;
      drag.current = null;
      el.classList.remove('dwi-dragging');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      // A plain click (no drag) on a row selects that row.
      if (moved < 4) {
        const rect = el.getBoundingClientRect();
        const offset = Math.floor((ev.clientY - rect.top) / ROW) - Math.floor(VISIBLE / 2);
        pick(Math.round(el.scrollTop / ROW) + offset);
      } else {
        pick(Math.round(el.scrollTop / ROW));
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    pick(live + step);
  };

  return (
    <div
      ref={ref}
      className="dwi-wheel"
      role="listbox"
      aria-label={label}
      aria-activedescendant={undefined}
      tabIndex={0}
      onScroll={onScroll}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
    >
      <div className="dwi-pad" />
      {items.map((text, i) => (
        <div key={text} role="option" aria-selected={i === live} className={i === live ? 'dwi-row on' : 'dwi-row'}>
          {text}
        </div>
      ))}
      <div className="dwi-pad" />
    </div>
  );
};

// ---- the field + sheet ---------------------------------------------

interface DateWheelInputProps {
  value: string | undefined | null;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  // 'birth' offers the last 60 years and opens a few years back;
  // 'school' (term dates, due dates, events) offers a few years either
  // side of now and opens on today.
  kind?: 'birth' | 'school';
  minYear?: number;
  maxYear?: number;
  // Where the wheels start when the field is empty.
  initial?: string;
  style?: React.CSSProperties;
  title?: string;
}

const DateWheelInput = ({
  value, onChange, required, placeholder = 'Select date', kind = 'school',
  minYear, maxYear, initial, style, title = kind === 'birth' ? 'Date of birth' : 'Select date',
}: DateWheelInputProps) => {
  const thisYear = new Date().getFullYear();
  const lo = minYear ?? (kind === 'birth' ? thisYear - 60 : thisYear - 3);
  const hi = maxYear ?? (kind === 'birth' ? thisYear : thisYear + 3);
  const startAt = initial ?? (kind === 'birth' ? `${thisYear - 5}-01-01` : undefined);
  const years: number[] = [];
  for (let y = lo; y <= hi; y++) years.push(y);

  const current = parse(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Parts>({ d: 1, m: 0, y: thisYear });

  const openSheet = () => {
    const today = new Date();
    const start = current ?? parse(startAt) ?? { d: today.getDate(), m: today.getMonth(), y: today.getFullYear() };
    const y = Math.max(lo, Math.min(hi, start.y));
    setDraft({ y, m: start.m, d: Math.min(start.d, daysIn(start.m, y)) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const dayCount = daysIn(draft.m, draft.y);
  const dayItems = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  // Changing month/year can shrink the month under the chosen day
  // (31 January -> February), so clamp it.
  const update = (patch: Partial<Parts>) => setDraft((prev) => {
    const next = { ...prev, ...patch };
    next.d = Math.min(next.d, daysIn(next.m, next.y));
    return next;
  });

  const done = () => { onChange(format(draft)); setOpen(false); };
  const clear = () => { onChange(''); setOpen(false); };

  const label = current ? `${current.d} ${MONTHS[current.m]} ${current.y}` : '';

  return (
    <div className="dwi-field-wrap">
      <button type="button" className="dwi-field" style={style} onClick={openSheet} aria-haspopup="dialog">
        <span className={label ? '' : 'dwi-placeholder'}>{label || placeholder}</span>
        <Calendar size={18} aria-hidden="true" />
      </button>
      {/* Keeps native form validation working for required fields: the
          browser checks this, and its warning points at the field. */}
      {required && (
        <input
          className="dwi-validator" tabIndex={-1} aria-hidden="true"
          required value={value ?? ''} onChange={() => {}}
          onFocus={openSheet}
        />
      )}

      {open && createPortal(
        <div className="dwi-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="dwi-sheet" role="dialog" aria-modal="true" aria-label={title}>
            <div className="dwi-head">
              <button type="button" className="dwi-link" onClick={() => setOpen(false)}>Cancel</button>
              <span className="dwi-title">{title}</span>
              <button type="button" className="dwi-link dwi-done" onClick={done}>Done</button>
            </div>
            <div className="dwi-wheels">
              <div className="dwi-band" aria-hidden="true" />
              <Wheel label="Day" items={dayItems} index={draft.d - 1} onChange={(i) => update({ d: i + 1 })} />
              <Wheel label="Month" items={MONTHS} index={draft.m} onChange={(i) => update({ m: i })} />
              <Wheel label="Year" items={years.map(String)} index={years.indexOf(draft.y)} onChange={(i) => update({ y: years[i] })} />
            </div>
            <div className="dwi-foot">
              <span>{draft.d} {MONTHS[draft.m]} {draft.y}</span>
              {!required && current && <button type="button" className="dwi-link" onClick={clear}>Clear date</button>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DateWheelInput;

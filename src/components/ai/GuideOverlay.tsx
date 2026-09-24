import { useEffect, useRef, useState } from 'react';
import type { Guide } from './guides';

// Draws a glowing ring around the element a guide step points at, with
// a speech-bubble tip beside it. The ring never blocks clicks, so the
// visitor types and presses buttons on the real page as normal.

interface Props {
  guide: Guide;
  step: number;
  onNext: () => void;
  onStop: () => void;
}

interface Box { top: number; left: number; width: number; height: number }

const PAD = 6;

const GuideOverlay = ({ guide, step, onNext, onStop }: Props) => {
  const current = guide.steps[step];
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipHeight, setTipHeight] = useState(120);

  // Find the target (it may not exist yet while the page loads or a
  // form opens), bring it into view, and keep the ring glued to it as
  // the page scrolls or reflows.
  useEffect(() => {
    if (!current) return;
    let raf = 0;
    let scrolled = false;
    const started = Date.now();
    const tick = () => {
      const h = tipRef.current?.offsetHeight;
      if (h) setTipHeight((prev) => (prev === h ? prev : h));
      const el = document.querySelector<HTMLElement>(`[data-ai="${current.target}"]`);
      elRef.current = el;
      // Our own date wheel sheet sits over everything; step aside while it's open.
      setHidden(!!document.querySelector('.dwi-backdrop'));
      if (el) {
        if (!scrolled) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); scrolled = true; }
        const r = el.getBoundingClientRect();
        setBox((b) => (b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height)
          ? b : { top: r.top, left: r.left, width: r.width, height: r.height });
        setMissing(false);
      } else if (Date.now() - started > 4000) {
        setMissing(true);
        setBox(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current]);

  // 'click' steps move on when the highlighted button is pressed.
  useEffect(() => {
    if (!current || current.advance !== 'click') return;
    const onClick = (e: MouseEvent) => {
      const el = elRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(onNext, 60);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [current, onNext]);

  if (!current || hidden) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipWidth = Math.min(300, vw - 24);
  let tipStyle: React.CSSProperties;
  let arrow: 'up' | 'down' | null = null;
  if (box) {
    const below = box.top + box.height + PAD + 14;
    const placeBelow = below + tipHeight < vh - 8 || box.top < tipHeight + 30;
    const left = Math.max(12, Math.min(vw - tipWidth - 12, box.left + box.width / 2 - tipWidth / 2));
    tipStyle = placeBelow
      ? { top: Math.min(below, vh - tipHeight - 8), left, width: tipWidth }
      : { top: Math.max(8, box.top - PAD - 14 - tipHeight), left, width: tipWidth };
    arrow = placeBelow ? 'up' : 'down';
  } else {
    tipStyle = { top: vh / 2 - tipHeight / 2, left: vw / 2 - tipWidth / 2, width: tipWidth };
  }
  const arrowLeft = box ? Math.max(14, Math.min(tipWidth - 14, box.left + box.width / 2 - (tipStyle.left as number))) : 0;

  return (
    <div className="cai-guide" aria-live="polite">
      {box && (
        <div
          className="cai-ring"
          style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }}
        />
      )}
      <div ref={tipRef} className="cai-tip" style={tipStyle} role="dialog" aria-label="Citadel AI guide">
        {arrow && <span className={`cai-tip-arrow ${arrow}`} style={{ left: arrowLeft }} />}
        <div className="cai-tip-step">Step {step + 1} of {guide.steps.length}</div>
        <p>{missing ? `${current.text} (Scroll to find it, or press Next.)` : current.text}</p>
        <div className="cai-tip-actions">
          <button type="button" className="cai-tip-stop" onClick={onStop}>Stop guide</button>
          {(current.advance === 'next' || missing) && (
            <button type="button" className="cai-tip-next" onClick={onNext}>
              {step === guide.steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          )}
          {current.advance === 'click' && !missing && <span className="cai-tip-hint">Press the highlighted button</span>}
        </div>
      </div>
    </div>
  );
};

export default GuideOverlay;

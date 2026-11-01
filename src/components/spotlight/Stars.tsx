import { useState } from 'react';
import { Star } from 'lucide-react';

// Kind words, so even a low score never reads as an insult to a child.
const STAR_WORDS = ['', 'Keep going!', 'Nice try', 'Great job', 'Awesome!', 'Superstar!'];

// Read-only stars for an average (4.3 fills four and a bit).
export const StarRow = ({ value, size = 16 }: { value: number | null; size?: number }) => (
  <span className="sp-stars" aria-label={value == null ? 'Not rated yet' : `${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => {
      const fill = value == null ? 0 : Math.max(0, Math.min(1, value - (i - 1)));
      return (
        <span key={i} className="sp-star-wrap" style={{ width: size, height: size }}>
          <Star size={size} className="sp-star-bg" />
          <span className="sp-star-fill" style={{ width: `${fill * 100}%` }}>
            <Star size={size} className="sp-star-fg" />
          </span>
        </span>
      );
    })}
  </span>
);

// Tap a star to rate. Shows a friendly word for what you are about to give.
export const StarInput = ({ value, onChange, disabled }: {
  value: number | null;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div className="sp-star-input">
      <div className="sp-star-buttons" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={`sp-star-btn${i <= shown ? ' on' : ''}`}
            disabled={disabled}
            aria-label={`${i} star${i === 1 ? '' : 's'} — ${STAR_WORDS[i]}`}
            aria-pressed={value === i}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(i)}
          >
            <Star size={30} />
          </button>
        ))}
      </div>
      <span className="sp-star-word">{shown ? STAR_WORDS[shown] : 'Tap a star'}</span>
    </div>
  );
};

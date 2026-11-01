import { Flame } from 'lucide-react';
import { type LeaderRow, badgesFor } from '../../lib/spotlight';
import { StarRow } from './Stars';
import Avatar from './Avatar';

const MEDALS = ['🥇', '🥈', '🥉'];

// The class board: who is keeping their weekend streak going.
const Board = ({ rows }: { rows: LeaderRow[] }) => {
  if (rows.length === 0) {
    return <p className="sp-empty">No pupils here yet.</p>;
  }
  const sorted = [...rows].sort((a, b) =>
    b.streak - a.streak || b.best_streak - a.best_streak || (b.avg_received ?? 0) - (a.avg_received ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="sp-board">
      <p className="sp-board-note">
        A streak grows each weekend you finish your part: rate every answer your classmates share (or share your own when it's your turn). Miss a weekend and it starts again.
      </p>
      <ol className="sp-board-list">
        {sorted.map((row, i) => {
          const badges = badgesFor(row, rows);
          return (
            <li key={row.id} className={`sp-board-row${row.is_me ? ' me' : ''}`}>
              <span className="sp-rank">{MEDALS[i] && row.streak > 0 ? MEDALS[i] : i + 1}</span>
              <Avatar name={row.name} url={row.avatar_url} size={40} />
              <div className="sp-board-main">
                <strong>{row.name}{row.is_me ? ' (you)' : ''}</strong>
                <div className="sp-badges">
                  {badges.length === 0
                    ? <span className="sp-muted">Just getting started</span>
                    : badges.map((b) => <span key={b.label} className="sp-badge" title={b.label}>{b.emoji} {b.label}</span>)}
                </div>
              </div>
              <div className="sp-board-side">
                <span className={`sp-streak${row.streak > 0 ? ' on' : ''}`}><Flame size={16} /> {row.streak}</span>
                {row.avg_received != null && <span className="sp-board-avg"><StarRow value={row.avg_received} size={12} /> {row.avg_received.toFixed(1)}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Board;

import type { CalendarTable } from '../../lib/calendarExtract';

// Renders the published term calendar as a designed, colour-coded
// schedule rather than a bare grid. The first row of each table is its
// header, matching how the school lays these out in Word. Rows that
// mention a holiday, exam, resumption and so on get a coloured marker so
// the important dates jump out.

type Tone = { label: string; bg: string; fg: string };

const TONES: { test: RegExp; tone: Tone }[] = [
  { test: /\b(holiday|break|vacation|public|eid|christmas|easter|independence|democracy|mid-?term)\b/i, tone: { label: 'Break', bg: 'rgba(16,185,129,0.14)', fg: '#047857' } },
  { test: /\b(exam|examination|test|assessment|ca\b|continuous)\b/i, tone: { label: 'Exams', bg: 'rgba(239,68,68,0.12)', fg: '#b91c1c' } },
  { test: /\b(resum|resumption|begin|start|opening|orientation|admission)\b/i, tone: { label: 'Term starts', bg: 'rgba(59,130,246,0.13)', fg: '#1d4ed8' } },
  { test: /\b(vacat|clos|end of term|ends|graduation|prize|speech|cultural|inter-?house|sports|pta|meeting|excursion|dedication)\b/i, tone: { label: 'Event', bg: 'rgba(245,158,11,0.15)', fg: '#b45309' } },
];

const toneFor = (row: string[]): Tone | null => {
  const text = row.join(' ');
  return TONES.find((t) => t.test.test(text))?.tone ?? null;
};

const CalendarTableView = ({ tables }: { tables: CalendarTable[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
    {tables.filter((t) => t.rows.length > 0).map((table, tableIdx) => {
      const [header, ...body] = table.rows;
      return (
        <div key={tableIdx} style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 6px 18px rgba(0,0,0,0.05)' }}>
          {table.heading && (
            <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: '#fff', fontSize: '16px', fontWeight: 800, letterSpacing: '0.3px' }}>
              {table.heading}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${header.length * 120}px` }}>
              <thead>
                <tr>
                  {header.map((cell, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left', padding: '12px 14px', fontSize: '12px', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--primary)',
                        background: 'var(--accent)', borderBottom: '2px solid var(--primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rowIdx) => {
                  const tone = toneFor(row);
                  return (
                    <tr key={rowIdx} style={{ background: tone ? tone.bg : rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                      {row.map((cell, i) => (
                        <td
                          key={i}
                          style={{
                            padding: '11px 14px', fontSize: '13px', verticalAlign: 'top',
                            color: tone && i === 0 ? tone.fg : i === 0 ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: i === 0 ? 700 : 500,
                            borderBottom: '1px solid var(--glass-border)',
                            borderLeft: i === 0 && tone ? `4px solid ${tone.fg}` : i === 0 ? '4px solid transparent' : undefined,
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    })}
  </div>
);

export default CalendarTableView;

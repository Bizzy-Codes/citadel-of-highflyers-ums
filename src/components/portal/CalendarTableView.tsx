import type { CalendarTable } from '../../lib/calendarExtract';

// Renders the published term calendar. The first row of each table is
// its header, matching how the school lays these out in Word.
const CalendarTableView = ({ tables }: { tables: CalendarTable[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
    {tables.filter((t) => t.rows.length > 0).map((table, tableIdx) => {
      const [header, ...body] = table.rows;
      return (
        <div key={tableIdx}>
          {table.heading && (
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px', color: 'var(--primary)' }}>
              {table.heading}
            </h4>
          )}
          <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${header.length * 110}px` }}>
              <thead>
                <tr>
                  {header.map((cell, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left', padding: '12px 14px', fontSize: '12px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--text-muted)',
                        background: 'var(--bg-surface)', borderBottom: '1px solid var(--glass-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rowIdx) => (
                  <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'var(--bg-light)' }}>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        style={{
                          padding: '10px 14px', fontSize: '13px', verticalAlign: 'top',
                          color: i === 0 ? 'var(--text-main)' : 'var(--text-muted)',
                          fontWeight: i === 0 ? 600 : 400,
                          borderBottom: '1px solid var(--glass-border)',
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    })}
  </div>
);

export default CalendarTableView;

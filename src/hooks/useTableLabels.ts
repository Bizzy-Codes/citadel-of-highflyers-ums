import { useEffect } from 'react';

// Tables marked className="resp-table" turn into stacked cards on phones
// (see mobile.css). A card needs each value to carry its column title, so
// this copies every column heading onto the cells beneath it as
// data-label. It watches the page because tables fill in as data loads.
export function useTableLabels() {
  useEffect(() => {
    let frame = 0;
    const label = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>('table.resp-table').forEach((table) => {
        const heads = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim());
        table.querySelectorAll('tbody tr').forEach((row) => {
          Array.from(row.children).forEach((cell, i) => {
            const td = cell as HTMLElement;
            if (td.tagName !== 'TD') return;
            const text = heads[i] ?? '';
            if (td.getAttribute('data-label') !== text) td.setAttribute('data-label', text);
          });
        });
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(label); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
}

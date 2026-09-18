// Turns an uploaded term calendar into a grid the portal can render,
// so pupils and staff read the calendar in the app instead of
// downloading a file and pinching around it on a phone.
//
// Word is exact -- a .docx carries real table markup, so the grid that
// comes out is the grid the school typed. PDF is best-effort: a PDF
// records where each scrap of text was painted, not which cell it
// belonged to, so rows and columns here are inferred from coordinates.
// That's why the admin screen makes you review the result before
// publishing it.

export interface CalendarTable {
  heading: string | null;
  rows: string[][];
}

export interface ExtractResult {
  tables: CalendarTable[];
  error: string | null;
  /** True when the grid was inferred rather than read from real table markup. */
  approximate: boolean;
}

const cleanCell = (text: string) => text.replace(/\s+/g, ' ').trim();

// Pads every row to the widest one and drops columns/rows that ended up
// completely empty, which both parsers produce at the edges.
const tidy = (rows: string[][]): string[][] => {
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (width === 0) return [];
  const padded = rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
  const keepColumn = Array.from({ length: width }, (_, c) => padded.some((r) => r[c] !== ''));
  return padded
    .map((r) => r.filter((_, c) => keepColumn[c]))
    .filter((r) => r.some((cell) => cell !== ''));
};

// ------------------------------------------------------------------
// Word (.docx)
// ------------------------------------------------------------------

const extractDocx = async (file: File): Promise<ExtractResult> => {
  const mammoth = await import('mammoth/mammoth.browser.js');
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const tables: CalendarTable[] = [];
  let heading: string | null = null;

  // Walk the document in order so each table keeps whatever heading or
  // caption sat above it -- a calendar is often "FIRST TERM" followed
  // by its own table, and losing that label loses the meaning.
  for (const el of Array.from(doc.body.children)) {
    if (/^H[1-6]$/.test(el.tagName)) {
      heading = cleanCell(el.textContent ?? '') || null;
      continue;
    }
    if (el.tagName === 'P') {
      const text = cleanCell(el.textContent ?? '');
      if (text) heading = text;
      continue;
    }
    if (el.tagName !== 'TABLE') continue;

    const rows: string[][] = [];
    for (const tr of Array.from((el as HTMLTableElement).rows)) {
      const cells: string[] = [];
      for (const td of Array.from(tr.cells)) {
        cells.push(cleanCell(td.textContent ?? ''));
        // A merged cell occupies several columns; the blanks keep every
        // later cell in the row under the right heading.
        for (let i = 1; i < (td.colSpan || 1); i++) cells.push('');
      }
      rows.push(cells);
    }

    const tidied = tidy(rows);
    if (tidied.length > 0) {
      tables.push({ heading, rows: tidied });
      heading = null;
    }
  }

  if (tables.length === 0) {
    return { tables: [], error: 'No tables found in that Word document. The calendar needs to be laid out as a table for it to be converted.', approximate: false };
  }
  return { tables, error: null, approximate: false };
};

// ------------------------------------------------------------------
// PDF
// ------------------------------------------------------------------

interface TextPiece { text: string; x: number; y: number }

// Groups x positions that sit within `gap` of each other into columns.
// Text painted at roughly the same left edge on many lines is a column;
// this is the whole basis of the PDF reconstruction.
const columnStarts = (pieces: TextPiece[], gap: number): number[] => {
  const xs = [...pieces].map((p) => p.x).sort((a, b) => a - b);
  const starts: number[] = [];
  for (const x of xs) {
    if (starts.length === 0 || x - starts[starts.length - 1] > gap) starts.push(x);
  }
  return starts;
};

const extractPdf = async (file: File): Promise<ExtractResult> => {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const tables: CalendarTable[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    const pieces: TextPiece[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const text = item.str.trim();
      if (!text) continue;
      pieces.push({ text, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) });
    }
    if (pieces.length === 0) continue;

    // Same baseline (within a few points) means same visual row.
    const lines = new Map<number, TextPiece[]>();
    for (const piece of pieces) {
      const key = [...lines.keys()].find((y) => Math.abs(y - piece.y) <= 4);
      const bucket = lines.get(key ?? piece.y);
      if (bucket) bucket.push(piece);
      else lines.set(piece.y, [piece]);
    }

    const starts = columnStarts(pieces, 12);
    const rows: string[][] = [];
    // PDF y counts up from the bottom of the page, so descending y is
    // top-to-bottom reading order.
    for (const [, bucket] of [...lines.entries()].sort((a, b) => b[0] - a[0])) {
      const cells: string[] = Array(starts.length).fill('');
      for (const piece of bucket.sort((a, b) => a.x - b.x)) {
        let col = 0;
        for (let i = 0; i < starts.length; i++) if (piece.x >= starts[i] - 2) col = i;
        cells[col] = cells[col] ? `${cells[col]} ${piece.text}` : piece.text;
      }
      rows.push(cells.map(cleanCell));
    }

    const tidied = tidy(rows);
    if (tidied.length > 0) {
      tables.push({ heading: pdf.numPages > 1 ? `Page ${pageNo}` : null, rows: tidied });
    }
  }

  if (tables.length === 0) {
    return { tables: [], error: 'No readable text found in that PDF. If it is a scan or a photo saved as PDF, retype the calendar in Word and upload that instead.', approximate: true };
  }
  return { tables, error: null, approximate: true };
};

// ------------------------------------------------------------------

export const canExtract = (fileName: string) => /\.(docx|pdf)$/i.test(fileName);

export const extractCalendarTables = async (file: File): Promise<ExtractResult> => {
  try {
    if (/\.docx$/i.test(file.name)) return await extractDocx(file);
    if (/\.pdf$/i.test(file.name)) return await extractPdf(file);
    if (/\.doc$/i.test(file.name)) {
      return { tables: [], error: 'Older .doc files cannot be converted. Open it in Word and use Save As to make a .docx, then upload that.', approximate: false };
    }
    return { tables: [], error: 'Only Word (.docx) and PDF files can be converted to a table.', approximate: false };
  } catch (e) {
    return { tables: [], error: `Could not read that file: ${e instanceof Error ? e.message : String(e)}`, approximate: false };
  }
};

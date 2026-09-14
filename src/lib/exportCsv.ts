import type { User } from '../context/AuthContext';

// Spreadsheet export without pulling in a spreadsheet library.
//
// A CSV written with a UTF-8 byte-order mark opens straight into Excel
// (and Google Sheets, and LibreOffice) with accented characters intact,
// which is all the office actually needs here -- and it keeps ~400KB of
// xlsx parser out of the bundle for a button most people press once a
// term.

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Quote anything containing a delimiter, quote or newline; double up
  // internal quotes. A leading =, +, - or @ is prefixed with a single
  // quote so a spreadsheet treats it as text rather than a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM is what tells Excel the file is UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const STUDENT_COLUMNS: [string, (u: User) => unknown][] = [
  ['Pupil ID', (u) => u.displayId],
  ['Full Name', (u) => u.name],
  ['Class', (u) => u.grade],
  ['Status', (u) => u.status],
  ['Email', (u) => u.email],
  ['Phone', (u) => u.phone],
  ['Sex', (u) => u.sex],
  ['Date of Birth', (u) => u.dateOfBirth],
  ['Nationality', (u) => u.nationality],
  ['State of Origin', (u) => u.stateOfOrigin],
  ['L.G.A', (u) => u.lga],
  ['Religion', (u) => u.religion],
  ['Blood Group', (u) => u.bloodGroup],
  ['Genotype', (u) => u.genotype],
  ['Health Notes', (u) => u.healthNotes],
  ['Home Address', (u) => u.homeAddress ?? u.location],
  ["Father's Name", (u) => u.fatherName],
  ["Father's Occupation", (u) => u.fatherOccupation],
  ["Father's Phone", (u) => u.fatherPhone],
  ["Mother's Name", (u) => u.motherName],
  ["Mother's Occupation", (u) => u.motherOccupation],
  ["Mother's Phone", (u) => u.motherPhone],
  ['Authorised for Pickup', (u) => u.pickupPerson],
  ['Pickup Phone', (u) => u.pickupPhone],
  ['Registered On', (u) => (u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '')],
];

export function exportStudentsToSpreadsheet(students: User[]): void {
  const sorted = [...students].sort((a, b) =>
    (a.grade ?? '').localeCompare(b.grade ?? '') || a.name.localeCompare(b.name)
  );
  const csv = toCsv(
    STUDENT_COLUMNS.map(([label]) => label),
    sorted.map((student) => STUDENT_COLUMNS.map(([, read]) => read(student)))
  );
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`citadel-pupils-${stamp}.csv`, csv);
}

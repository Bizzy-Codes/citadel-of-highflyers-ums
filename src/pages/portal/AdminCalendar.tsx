import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import CalendarTableView from '../../components/portal/CalendarTableView';
import { extractCalendarTables, canExtract, type CalendarTable } from '../../lib/calendarExtract';
import { Save, Upload, FileText, Loader2, Table2, X, Plus, AlertTriangle, Pencil } from 'lucide-react';
import DateWheelInput from '../../components/common/DateWheelInput';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: '10px',
  border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)',
};

const AdminCalendar = () => {
  const {
    academicCalendar, updateAcademicCalendar, uploadAcademicCalendarDocument,
    publishAcademicCalendarTables, getAcademicCalendarDocumentUrl,
  } = useAuth();
  const [term, setTerm] = useState('');
  // Raw text, not a number -- see the note on the CA score fields in
  // ClassManagement.tsx for why a number-typed value bound straight
  // to a number input gets stuck showing a literal "0" once cleared.
  const [totalWeeks, setTotalWeeks] = useState('13');
  const [termStartDate, setTermStartDate] = useState('');
  // The structured term/session results & report cards read, so
  // teachers never re-type them per pupil.
  const [currentTerm, setCurrentTerm] = useState<'1st Term' | '2nd Term' | '3rd Term'>('1st Term');
  const [currentSession, setCurrentSession] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // The converted grid while the admin is checking it over. Nothing
  // reaches pupils until Publish, because PDF extraction infers rows
  // from where text sits on the page and can get them wrong.
  const [draft, setDraft] = useState<CalendarTable[] | null>(null);
  const [approximate, setApproximate] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Fills the editable fields once the calendar arrives from the
  // async initial load, and again after this page's own save updates
  // it -- done during render (React's documented pattern for this)
  // rather than an effect, guarded by updatedAt so it doesn't clobber
  // whatever the admin is mid-typing on every unrelated re-render.
  const [syncedAt, setSyncedAt] = useState<string | undefined>(undefined);
  if (academicCalendar && academicCalendar.updatedAt !== syncedAt) {
    setSyncedAt(academicCalendar.updatedAt);
    setTerm(academicCalendar.term);
    setTotalWeeks(String(academicCalendar.totalWeeks));
    setTermStartDate(academicCalendar.termStartDate ?? '');
    setCurrentTerm(academicCalendar.currentTerm);
    setCurrentSession(academicCalendar.currentSession);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const { error } = await updateAcademicCalendar({
      term, totalWeeks: Number(totalWeeks) || 0, termStartDate: termStartDate || null,
      currentTerm, currentSession: currentSession.trim() || undefined,
    });
    setSaving(false);
    if (error) { alert('Failed to save: ' + error); return; }
    setSaved(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setConvertError('');
    setDraft(null);
    const { error } = await uploadAcademicCalendarDocument(file);
    setUploading(false);
    if (error) { setUploadError(error); return; }
    e.target.value = '';
  };

  const documentUrl = getAcademicCalendarDocumentUrl();
  const documentName = academicCalendar?.documentName ?? null;
  const published = academicCalendar?.documentTables ?? [];

  // Reads the stored file back out of the bucket rather than holding
  // the upload in memory, so Convert still works on a document that
  // was uploaded in some earlier session.
  const handleConvert = async () => {
    if (!documentUrl || !documentName) return;
    setConverting(true);
    setConvertError('');
    try {
      const response = await fetch(documentUrl);
      if (!response.ok) throw new Error(`could not download the file (${response.status})`);
      const file = new File([await response.blob()], documentName);
      const { tables, error, approximate: isApproximate } = await extractCalendarTables(file);
      if (error) { setConvertError(error); return; }
      setDraft(tables);
      setApproximate(isApproximate);
    } catch (err) {
      setConvertError(`Could not read the document: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConverting(false);
    }
  };

  const editTable = (tableIdx: number, change: (table: CalendarTable) => CalendarTable) =>
    setDraft((tables) => tables?.map((t, i) => (i === tableIdx ? change(t) : t)) ?? null);

  const handlePublish = async () => {
    if (!draft) return;
    setPublishing(true);
    // Drop rows the admin emptied out, and tables left with nothing.
    const cleaned = draft
      .map((t) => ({ ...t, rows: t.rows.filter((r) => r.some((cell) => cell.trim() !== '')) }))
      .filter((t) => t.rows.length > 0);
    const { error } = await publishAcademicCalendarTables(cleaned);
    setPublishing(false);
    if (error) { setConvertError(error); return; }
    setDraft(null);
  };

  return (
    <PortalLayout title="Academic Calendar">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: draft ? '1100px' : '700px' }}>
        <div className="card glass" style={{ padding: '30px', borderRadius: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Term Settings</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
            Sets the number of academic weeks pupils see on their attendance page, and the term's start date used to work out which week each day falls into.
          </p>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label>Term Name</label>
              <input
                type="text"
                required
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. 1st Term 2025/2026"
                style={inputStyle}
              />
            </div>
            <div className="input-group">
              <label>Number of Academic Weeks</label>
              <input
                type="number"
                required
                min={1}
                max={20}
                value={totalWeeks}
                onChange={(e) => setTotalWeeks(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group">
                <label>Current Term</label>
                <select
                  value={currentTerm}
                  onChange={(e) => setCurrentTerm(e.target.value as '1st Term' | '2nd Term' | '3rd Term')}
                  style={inputStyle}
                >
                  <option>1st Term</option>
                  <option>2nd Term</option>
                  <option>3rd Term</option>
                </select>
              </div>
              <div className="input-group">
                <label>Current Session</label>
                <input
                  type="text"
                  value={currentSession}
                  onChange={(e) => setCurrentSession(e.target.value)}
                  placeholder="e.g. 2025/2026"
                  style={inputStyle}
                />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-4px' }}>
              Teachers' result sheets and report cards use this term and session automatically &mdash; they never type it in per pupil.
            </p>
            <div className="input-group">
              <label>Term Start Date</label>
              <DateWheelInput
                value={termStartDate}
                onChange={setTermStartDate}
                title="Term start date"
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Week 1 starts on this date. Leave blank to hide attendance week tracking until you're ready.</p>
            </div>
            <button type="submit" className="btn btn-primary lg" disabled={saving} style={{ marginTop: '8px' }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {saving ? 'Saving...' : 'Save Term Settings'}
            </button>
            {saved && <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '600' }}>Saved.</p>}
          </form>
        </div>

        <div className="card glass" style={{ padding: '30px', borderRadius: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Calendar Document</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            Upload the term calendar as a Word document, PDF or image. Word and PDF files can then be converted into a table
            that pupils and teachers read directly in the portal &mdash; no downloading required.
          </p>

          {documentName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', marginBottom: '16px', flexWrap: 'wrap' }}>
              <FileText size={18} color="var(--primary)" />
              <span style={{ flex: 1, fontSize: '14px', minWidth: '140px' }}>{documentName}</span>
              {documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline sm">View</a>}
              {canExtract(documentName) && (
                <button className="btn btn-primary sm" onClick={handleConvert} disabled={converting}>
                  {converting ? <Loader2 size={16} className="animate-spin" /> : <Table2 size={16} />}
                  {converting ? 'Reading...' : 'Convert to table'}
                </button>
              )}
            </div>
          )}

          {documentName && !canExtract(documentName) && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              This file can be downloaded but not converted &mdash; only Word (.docx) and PDF files can be read into a table.
            </p>
          )}

          {uploadError && <div style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{uploadError}</div>}
          {convertError && <div style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{convertError}</div>}

          <label
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '12px',
              border: '1.5px dashed var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-muted)',
              cursor: uploading ? 'wait' : 'pointer', fontSize: '14px',
            }}
          >
            <Upload size={18} />
            <span>{uploading ? 'Uploading...' : documentName ? 'Replace with a new file...' : 'Choose a Word document, PDF or image...'}</span>
            <input
              type="file"
              accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/pdf,image/*"
              disabled={uploading}
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
          </label>
        </div>

        {draft && (
          <div className="card glass" style={{ padding: '30px', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Check the table before publishing</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: approximate ? '12px' : '20px' }}>
              Correct anything that came out wrong, then publish. Pupils and teachers see this table on their School Calendar page.
            </p>

            {approximate && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', marginBottom: '20px' }}>
                <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  A PDF records where text was printed, not which cell it belonged to, so these rows and columns were worked out
                  from the layout. Check them carefully &mdash; uploading the original Word document instead gives an exact result.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {draft.map((table, tableIdx) => {
                const width = table.rows.reduce((max, r) => Math.max(max, r.length), 0);
                return (
                  <div key={tableIdx}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                      <input
                        type="text"
                        value={table.heading ?? ''}
                        placeholder="Section heading (optional)"
                        onChange={(e) => editTable(tableIdx, (t) => ({ ...t, heading: e.target.value || null }))}
                        style={{ ...inputStyle, fontWeight: 700, padding: '8px 12px' }}
                      />
                      <button
                        className="btn btn-outline sm"
                        onClick={() => setDraft((tables) => tables?.filter((_, i) => i !== tableIdx) ?? null)}
                        title="Remove this whole section"
                      >
                        <X size={14} /> Section
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                        <tbody>
                          <tr>
                            {Array.from({ length: width }, (_, colIdx) => (
                              <td key={colIdx} style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => editTable(tableIdx, (t) => ({ ...t, rows: t.rows.map((r) => r.filter((_, c) => c !== colIdx)) }))}
                                  title="Delete this column"
                                  style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                >
                                  <X size={13} />
                                </button>
                              </td>
                            ))}
                          </tr>
                          {table.rows.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              {Array.from({ length: width }, (_, colIdx) => (
                                <td key={colIdx}>
                                  <input
                                    type="text"
                                    value={row[colIdx] ?? ''}
                                    onChange={(e) => editTable(tableIdx, (t) => ({
                                      ...t,
                                      rows: t.rows.map((r, i) => {
                                        if (i !== rowIdx) return r;
                                        const next = [...r, ...Array(Math.max(0, width - r.length)).fill('')];
                                        next[colIdx] = e.target.value;
                                        return next;
                                      }),
                                    }))}
                                    style={{
                                      ...inputStyle, width: '150px', padding: '8px 10px', fontSize: '13px',
                                      fontWeight: rowIdx === 0 ? 700 : 400,
                                      background: rowIdx === 0 ? 'var(--bg-surface)' : 'var(--bg-light)',
                                    }}
                                  />
                                </td>
                              ))}
                              <td>
                                <button
                                  onClick={() => editTable(tableIdx, (t) => ({ ...t, rows: t.rows.filter((_, i) => i !== rowIdx) }))}
                                  title="Delete this row"
                                  style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      className="btn btn-outline sm"
                      style={{ marginTop: '8px' }}
                      onClick={() => editTable(tableIdx, (t) => ({ ...t, rows: [...t.rows, Array(Math.max(width, 1)).fill('')] }))}
                    >
                      <Plus size={14} /> Add row
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary lg" onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {publishing ? 'Publishing...' : 'Publish to pupils & teachers'}
              </button>
              <button className="btn btn-outline lg" onClick={() => setDraft(null)} disabled={publishing}>Discard</button>
            </div>
          </div>
        )}

        {!draft && published.length > 0 && (
          <div className="card glass" style={{ padding: '30px', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Published Calendar</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>This is what pupils and teachers currently see.</p>
              </div>
              <button className="btn btn-outline sm" onClick={() => { setDraft(published); setApproximate(false); }}>
                <Pencil size={14} /> Edit
              </button>
            </div>
            <CalendarTableView tables={published} />
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default AdminCalendar;

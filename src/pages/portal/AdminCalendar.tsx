import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import { Save, Upload, FileText, Loader2 } from 'lucide-react';

const AdminCalendar = () => {
  const { academicCalendar, updateAcademicCalendar, uploadAcademicCalendarDocument, getAcademicCalendarDocumentUrl } = useAuth();
  const [term, setTerm] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(13);
  const [termStartDate, setTermStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Fills the editable fields once the calendar arrives from the
  // async initial load, and again after this page's own save updates
  // it -- done during render (React's documented pattern for this)
  // rather than an effect, guarded by updatedAt so it doesn't clobber
  // whatever the admin is mid-typing on every unrelated re-render.
  const [syncedAt, setSyncedAt] = useState<string | undefined>(undefined);
  if (academicCalendar && academicCalendar.updatedAt !== syncedAt) {
    setSyncedAt(academicCalendar.updatedAt);
    setTerm(academicCalendar.term);
    setTotalWeeks(academicCalendar.totalWeeks);
    setTermStartDate(academicCalendar.termStartDate ?? '');
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const { error } = await updateAcademicCalendar({ term, totalWeeks, termStartDate: termStartDate || null });
    setSaving(false);
    if (error) { alert('Failed to save: ' + error); return; }
    setSaved(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    const { error } = await uploadAcademicCalendarDocument(file);
    setUploading(false);
    if (error) { setUploadError(error); return; }
    e.target.value = '';
  };

  const documentUrl = getAcademicCalendarDocumentUrl();

  return (
    <PortalLayout title="Academic Calendar">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px' }}>
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
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
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
                onChange={(e) => setTotalWeeks(Number(e.target.value))}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
              />
            </div>
            <div className="input-group">
              <label>Term Start Date</label>
              <input
                type="date"
                value={termStartDate}
                onChange={(e) => setTermStartDate(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)' }}
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
            Already have the term calendar typed up as an image or PDF? Upload it here -- pupils and staff will see a "View School Calendar" link on their attendance page.
          </p>

          {academicCalendar?.documentName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', marginBottom: '16px' }}>
              <FileText size={18} color="var(--primary)" />
              <span style={{ flex: 1, fontSize: '14px' }}>{academicCalendar.documentName}</span>
              {documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline sm">View</a>}
            </div>
          )}

          {uploadError && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{uploadError}</div>}

          <label
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '12px',
              border: '1.5px dashed var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-muted)',
              cursor: uploading ? 'wait' : 'pointer', fontSize: '14px',
            }}
          >
            <Upload size={18} />
            <span>{uploading ? 'Uploading...' : academicCalendar?.documentName ? 'Replace with a new file...' : 'Choose an image or PDF...'}</span>
            <input type="file" accept="image/*,application/pdf" disabled={uploading} style={{ display: 'none' }} onChange={handleUpload} />
          </label>
        </div>
      </div>
    </PortalLayout>
  );
};

export default AdminCalendar;

import { useState } from 'react';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import CalendarTableView from '../../components/portal/CalendarTableView';
import { Download, CalendarRange, X, ZoomIn } from 'lucide-react';

const formatShort = (isoDate: string) =>
  new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const SchoolCalendar = () => {
  const { academicCalendar, getAcademicCalendarDocumentUrl } = useAuth();
  const documentUrl = getAcademicCalendarDocumentUrl();
  const tables = academicCalendar?.documentTables ?? [];
  const pictures = academicCalendar?.documentImages ?? [];
  // Full-screen view of a page, inside this page (no new tab).
  const [zoomed, setZoomed] = useState<string | null>(null);

  return (
    <PortalLayout title="School Calendar">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card glass-purple" style={{ padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{academicCalendar?.term ?? 'This Term'}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {academicCalendar?.totalWeeks ?? '—'} academic weeks
              {academicCalendar?.termStartDate ? ` · starting ${formatShort(academicCalendar.termStartDate)}` : ''}
            </p>
          </div>
          {documentUrl && (
            <a href={documentUrl} download={academicCalendar?.documentName ?? 'school-calendar'} className="btn btn-outline sm">
              <Download size={16} /> Save a copy
            </a>
          )}
        </div>

        {pictures.length > 0 ? (
          <div className="card glass" style={{ padding: 'clamp(10px, 3vw, 24px)', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pictures.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setZoomed(url)}
                aria-label={`Enlarge calendar page ${i + 1}`}
                style={{ position: 'relative', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block' }}
              >
                <img src={url} alt={`School calendar, page ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} style={{ width: '100%', display: 'block', borderRadius: '14px', border: '1px solid var(--glass-border)' }} />
                <span style={{ position: 'absolute', right: '10px', bottom: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ZoomIn size={14} /> Tap to enlarge
                </span>
              </button>
            ))}
          </div>
        ) : tables.length > 0 ? (
          <div className="card glass" style={{ padding: 'clamp(14px, 3vw, 24px)', borderRadius: '24px' }}>
            <CalendarTableView tables={tables} />
          </div>
        ) : (
          <div className="card glass" style={{ padding: '40px', textAlign: 'center', borderRadius: '24px' }}>
            <CalendarRange size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>
              {documentUrl
                ? "The school's calendar has been uploaded but is not laid out on this page yet. Please check back soon."
                : "The school hasn't published the term calendar yet. Check back soon."}
            </p>
          </div>
        )}
      </div>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomed(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)', overflow: 'auto', padding: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <button
            type="button"
            onClick={() => setZoomed(null)}
            aria-label="Close"
            style={{ position: 'fixed', top: '14px', right: '14px', width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}
          >
            <X size={20} />
          </button>
          <img src={zoomed} alt="School calendar enlarged" style={{ width: 'min(1500px, 100%)', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </PortalLayout>
  );
};

export default SchoolCalendar;

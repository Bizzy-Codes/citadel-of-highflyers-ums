import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import CalendarTableView from '../../components/portal/CalendarTableView';
import { FileText, CalendarRange } from 'lucide-react';

const formatShort = (isoDate: string) =>
  new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const SchoolCalendar = () => {
  const { academicCalendar, getAcademicCalendarDocumentUrl } = useAuth();
  const documentUrl = getAcademicCalendarDocumentUrl();
  const tables = academicCalendar?.documentTables ?? [];

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
            <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline sm">
              <FileText size={16} /> Download original
            </a>
          )}
        </div>

        {tables.length > 0 ? (
          <div className="card glass" style={{ padding: '24px', borderRadius: '24px' }}>
            <CalendarTableView tables={tables} />
          </div>
        ) : (
          <div className="card glass" style={{ padding: '40px', textAlign: 'center', borderRadius: '24px' }}>
            <CalendarRange size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>
              {documentUrl
                ? "The term calendar hasn't been laid out as a table yet — use the download link above to read it."
                : "The school hasn't published the term calendar yet. Check back soon."}
            </p>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export default SchoolCalendar;

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PortalLayout from '../../components/layout/PortalLayout';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, GraduationCap, Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

const PAGE_SIZE = 10;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '--';

// Every pupil who has been promoted out of the final class. They keep
// their account and can still sign in to look at their own results --
// this is the school's record of who has been through it, not a
// recycle bin.
const AdminGraduates = () => {
  const { students } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const graduates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students
      .filter((s) => s.graduatedAt)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.displayId.toLowerCase().includes(q))
      .sort((a, b) => (b.graduatedAt ?? '').localeCompare(a.graduatedAt ?? ''));
  }, [students, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(graduates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visible = graduates.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <PortalLayout title="Graduated Pupils">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <Link to="/portal/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GraduationCap size={24} /> Graduated Pupils
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Pupils who completed the final class. Their records and results are kept in full, and they can still sign in to view their own results.
          </p>
        </div>

        <section className="card glass" style={{ padding: '30px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {graduates.length} graduate{graduates.length === 1 ? '' : 's'}
            </h3>
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)', color: 'var(--text-main)', fontSize: '14px' }}
              />
            </div>
          </div>

          {graduates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <GraduationCap size={40} style={{ opacity: 0.2, marginBottom: '14px' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {searchQuery ? `No graduate matches "${searchQuery}".` : 'No graduates yet.'}
              </p>
              {!searchQuery && (
                <p style={{ fontSize: '13px' }}>
                  When a teacher promotes a pupil out of the final class, they appear here.
                </p>
              )}
            </div>
          ) : (
            <>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 20px' }}>PUPIL NAME</th>
                      <th style={{ padding: '12px 20px' }}>ID / LOGIN</th>
                      <th style={{ padding: '12px 20px' }}>FINAL CLASS</th>
                      <th style={{ padding: '12px 20px' }}>SESSION</th>
                      <th style={{ padding: '12px 20px' }}>GRADUATED</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>RECORD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr key={s.id} style={{ background: 'var(--bg-surface)' }}>
                        <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.displayId}</td>
                        <td style={{ padding: '16px 20px' }}>{s.finalClass ?? '--'}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{s.graduatingSession ?? '--'}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(s.graduatedAt)}</td>
                        <td style={{ padding: '16px 20px', borderRadius: '0 12px 12px 0', textAlign: 'right' }}>
                          <Link to={`/portal/admin/users/${s.id}`} className="btn btn-outline sm">
                            <FileText size={14} /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                  Showing <strong style={{ color: 'var(--text-main)' }}>{pageStart + 1}–{pageStart + visible.length}</strong> of {graduates.length}
                </p>
                {pageCount > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="btn btn-outline sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                      <ChevronLeft size={16} /> Previous
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '90px', textAlign: 'center' }}>
                      Page {currentPage} of {pageCount}
                    </span>
                    <button className="btn btn-outline sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </PortalLayout>
  );
};

export default AdminGraduates;

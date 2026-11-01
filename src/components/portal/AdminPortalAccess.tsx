import { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock, Search, Mail, MessageCircle, CheckCircle2 } from 'lucide-react';
import { useAuth, type PortalLock, type User } from '../../context/AuthContext';
import { CLASSES } from '../../lib/accounts';
import { buildPortalLockedParentMessage } from '../../lib/outreach';
import ContactParentDialog, { type ParentContact } from './ContactParentDialog';

const parentContacts = (s: User): ParentContact[] => [
  { role: 'Father', name: s.fatherName, phone: s.fatherPhone },
  { role: 'Mother', name: s.motherName, phone: s.motherPhone },
  { role: 'Pickup contact', name: s.pickupPerson, phone: s.pickupPhone },
].filter((c) => c.phone);

// The admin's list of pupils with a switch to lock or unlock each portal
// (for example while school fees are outstanding). A locked pupil only sees
// a neutral "ask your parent to contact the school" page; the parents are
// told separately, by WhatsApp or email, from here.
const AdminPortalAccess = () => {
  const { students, getPortalLocks, setPortalLock, markParentsNotified, emailParentsAboutLock } = useAuth();
  const [locks, setLocks] = useState<Record<string, PortalLock>>({});
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('all');
  const [status, setStatus] = useState<'all' | 'locked' | 'open'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [contactFor, setContactFor] = useState<User | null>(null);

  const load = async () => {
    const rows = await getPortalLocks();
    setLocks(Object.fromEntries(rows.map((r) => [r.studentId, r])));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...students]
      .filter((s) => s.role === 'student' && s.grade && (CLASSES as readonly string[]).includes(s.grade))
      .filter((s) => className === 'all' || s.grade === className)
      .filter((s) => status === 'all' || (status === 'locked') === !!locks[s.id])
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.displayId ?? '').toLowerCase().includes(q))
      .sort((a, b) => (a.grade ?? '').localeCompare(b.grade ?? '') || a.name.localeCompare(b.name));
  }, [students, className, status, search, locks]);

  const lockedCount = Object.keys(locks).length;
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((s) => s.id)));

  const apply = async (lock: boolean) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`${lock ? 'Lock' : 'Unlock'} the portal for ${ids.length} pupil${ids.length === 1 ? '' : 's'}?`)) return;
    setBusy(true); setMessage('');
    const { error } = await setPortalLock(ids, lock, note);
    setBusy(false);
    if (error) { alert('Could not update: ' + error); return; }
    await load();
    setMessage(lock
      ? `${ids.length} portal${ids.length === 1 ? '' : 's'} locked. Now tell the parents: use "Email parents" below, or the WhatsApp button on each pupil.`
      : `${ids.length} portal${ids.length === 1 ? '' : 's'} reopened.`);
    if (!lock) setSelected(new Set());
  };

  const emailSelectedLocked = async () => {
    const ids = [...selected].filter((id) => locks[id]);
    if (ids.length === 0) { alert('Select pupils whose portal is locked first.'); return; }
    setBusy(true); setMessage('');
    const res = await emailParentsAboutLock(ids);
    setBusy(false);
    if (res.notConfigured) { setMessage('Email sending is not set up yet (it needs the email service key on the server). Use the WhatsApp button on each pupil for now.'); return; }
    if (res.error) { alert('Could not send: ' + res.error); return; }
    await load();
    setMessage(`Emailed ${res.sent ?? 0} parent${res.sent === 1 ? '' : 's'}${res.skipped ? `; ${res.skipped} had no email address on file` : ''}.`);
  };

  const markNotified = async (id: string) => {
    await markParentsNotified([id]);
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card glass" style={{ padding: '20px', borderRadius: '20px' }}>
        <h3 style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={18} /> Portal access</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Lock the portal of pupils who owe fees. When they log in they only see "Please ask your parent or guardian to contact the school admin or secretary" — it never says why.
          Parents are told separately from here. <strong>{lockedCount}</strong> portal{lockedCount === 1 ? ' is' : 's are'} locked right now.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search pupil..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '9px 10px 9px 30px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
          </div>
          <select value={className} onChange={(e) => setClassName(e.target.value)} style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}>
            <option value="all">All classes</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'locked' | 'open')} style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }}>
            <option value="all">Locked and open</option>
            <option value="locked">Locked only</option>
            <option value="open">Open only</option>
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card glass" style={{ padding: '14px 18px', borderRadius: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ fontSize: '14px' }}>{selected.size} selected</strong>
          <input type="text" placeholder="Internal note (optional, e.g. Term 2 fees)" value={note} onChange={(e) => setNote(e.target.value)}
            style={{ flex: 1, minWidth: '180px', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-light)' }} />
          <button className="btn btn-primary sm" disabled={busy} onClick={() => apply(true)}><Lock size={14} /> Lock portals</button>
          <button className="btn btn-outline sm" disabled={busy} onClick={() => apply(false)}><Unlock size={14} /> Unlock portals</button>
          <button className="btn btn-outline sm" disabled={busy} onClick={emailSelectedLocked}><Mail size={14} /> Email parents</button>
        </div>
      )}

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>{message}</div>
      )}

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        {!loading && visible.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No pupils match.</p>
        )}
        {visible.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', borderBottom: '1px solid var(--glass-border)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all shown" />
            Select all shown ({visible.length})
          </div>
        )}
        {visible.map((s) => {
          const lock = locks[s.id];
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} />
              <div style={{ flex: 1, minWidth: '180px' }}>
                <strong style={{ fontSize: '14px' }}>{s.name}</strong>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.displayId} · {s.grade}{lock?.note ? ` · ${lock.note}` : ''}</div>
              </div>
              {lock ? (
                <span style={{ padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                  Locked {new Date(lock.lockedAt).toLocaleDateString()}
                </span>
              ) : (
                <span style={{ padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Open</span>
              )}
              {lock && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {lock.parentNotifiedAt
                    ? <span style={{ fontSize: '11px', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Parent told {new Date(lock.parentNotifiedAt).toLocaleDateString()}</span>
                    : <span style={{ fontSize: '11px', color: 'var(--warning)' }}>Parent not told yet</span>}
                  <button className="btn btn-outline sm" onClick={() => setContactFor(s)} title="Message the parent on WhatsApp"><MessageCircle size={14} /> WhatsApp parent</button>
                  {!lock.parentNotifiedAt && <button className="btn btn-outline sm" onClick={() => markNotified(s.id)}>Mark as told</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ContactParentDialog
        open={!!contactFor}
        title="Tell the parent"
        description="Choose which parent or guardian to message. The pupil is never shown this wording."
        contacts={contactFor ? parentContacts(contactFor) : []}
        message={contactFor ? buildPortalLockedParentMessage(contactFor.name) : ''}
        onClose={() => setContactFor(null)}
      />
    </div>
  );
};

export default AdminPortalAccess;

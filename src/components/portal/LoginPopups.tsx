import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Bell, X } from 'lucide-react';
import { useAuth, type Notification } from '../../context/AuthContext';
import { messageNav } from '../../lib/messageNav';
import PushToggle from './PushToggle';
import { syncPushForLogin } from '../../lib/push';

// What a person sees right after logging in: any announcement the office
// has set to pop up (for the number of days it chose), and a reminder if
// there are unread private messages. Shown once per login -- the flag is
// cleared on logout, so the next login shows it again, until the notice's
// pop-up period runs out.
const SHOWN_KEY = 'citadel:loginPopupsShown';

const LoginPopups = () => {
  const { currentUser, notifications, unreadMessageCount, unreadTarget } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [decided, setDecided] = useState(false);
  const [askPush, setAskPush] = useState(false);

  const uid = currentUser?.id;

  useEffect(() => {
    if (!uid || decided) return;
    let shown = false;
    try { shown = sessionStorage.getItem(SHOWN_KEY) === uid; } catch { /* storage blocked */ }
    if (shown) { setDecided(true); return; }
    // Wait a moment for notifications and the unread count to load --
    // they arrive just after the profile does.
    const t = setTimeout(async () => {
      // Anyone who hasn't switched phone notifications on is asked at every
      // login until they do (browsers only allow the permission prompt after
      // a tap, so this pop-up carries the button). 'blocked' / unsupported /
      // not-configured are left alone.
      // A phone that already allowed notifications is simply (re)registered
      // for this account -- no question asked. Only a phone that has not
      // allowed them yet gets the prompt.
      const pushState = await syncPushForLogin();
      const needsPush = pushState === 'off';
      setAskPush(needsPush);
      const now = Date.now();
      const active = notifications.filter((n) => n.popupUntil && new Date(n.popupUntil).getTime() > now);
      setNotices(active);
      setUnread(unreadMessageCount);
      setDecided(true);
      if (active.length > 0 || unreadMessageCount > 0 || needsPush) {
        setOpen(true);
        try { sessionStorage.setItem(SHOWN_KEY, uid); } catch { /* storage blocked */ }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [uid, decided, notifications, unreadMessageCount]);

  if (!open || !uid) return null;

  const close = () => setOpen(false);

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass animate-fade-in" style={{ background: 'var(--bg-surface)', borderRadius: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
        <button onClick={close} aria-label="Close" style={{ position: 'absolute', top: '14px', right: '14px', width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'var(--bg-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} />
        </button>

        {unread > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '16px', background: 'var(--accent)', marginBottom: notices.length ? '18px' : '14px', marginRight: '40px' }}>
            <MessageSquare size={26} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>
                {unread === 1 ? 'You have a new message' : `You have ${unread} new messages`}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Open your messages to read and reply.</div>
            </div>
            <button className="btn btn-primary sm" onClick={() => { close(); navigate('/portal/messages', { state: messageNav(unreadTarget) }); }}>
              View
            </button>
          </div>
        )}

        {askPush && unread === 0 && notices.length === 0 && (
          <div style={{ marginBottom: '14px', paddingRight: '40px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '17px', marginBottom: '6px' }}>Don't miss anything</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Turn on notifications and we will tell you about new messages, assignments, tests and notices, even when the website is closed.</p>
          </div>
        )}

        {notices.map((n) => (
          <div key={n.id} style={{ marginBottom: '18px', paddingRight: unread > 0 ? 0 : '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Bell size={16} color={n.type === 'warning' ? 'var(--warning)' : n.type === 'success' ? 'var(--success)' : 'var(--primary)'} />
              <h3 style={{ fontWeight: 800, fontSize: '17px' }}>{n.title}</h3>
            </div>
            {n.imageUrl && <img src={n.imageUrl} alt="" style={{ width: '100%', borderRadius: '14px', marginBottom: '10px', display: 'block' }} />}
            <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.message}</p>
          </div>
        ))}

        {askPush && <div style={{ marginBottom: '16px' }}><PushToggle compact promptOnly /></div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-outline" onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default LoginPopups;

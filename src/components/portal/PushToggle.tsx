import { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { currentPushState, disablePush, enablePush, type PushState } from '../../lib/push';

// "Send notifications to this phone" switch. Used on the Profile page
// and offered once after login. Renders nothing if the browser can't do
// push or the school hasn't set the keys up yet.
const PushToggle = ({ compact = false }: { compact?: boolean }) => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { currentPushState().then(setState); }, []);

  if (!currentUser || state === null || state === 'unsupported' || state === 'not-configured') return null;

  const turnOn = async () => {
    setBusy(true); setMessage('');
    const { error } = await enablePush(currentUser.id);
    setState(await currentPushState());
    setBusy(false);
    if (error) setMessage(error);
  };
  const turnOff = async () => {
    setBusy(true); setMessage('');
    const { error } = await disablePush();
    setState(await currentPushState());
    setBusy(false);
    if (error) setMessage(error);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: compact ? '12px' : '16px', borderRadius: '16px', background: 'var(--accent)' }}>
      {state === 'on' ? <BellRing size={22} color="var(--success)" /> : <BellOff size={22} color="var(--text-muted)" />}
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ fontWeight: 800, fontSize: '14px' }}>
          {state === 'on' ? 'Phone notifications are ON' : 'Get notifications on this phone'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {state === 'blocked'
            ? 'They are blocked for this site. Allow notifications in your browser or phone settings, then come back.'
            : 'We will remind you if a private message has waited for 2 days — even when the website is closed.'}
        </div>
        {message && <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{message}</div>}
      </div>
      {state === 'off' && (
        <button className="btn btn-primary sm" onClick={turnOn} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Turn on
        </button>
      )}
      {state === 'on' && (
        <button className="btn btn-outline sm" onClick={turnOff} disabled={busy}>Turn off</button>
      )}
    </div>
  );
};

export default PushToggle;

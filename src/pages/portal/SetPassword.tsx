import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

// "Choose your own password". Anyone still on a password somebody else
// knows -- the school's starting password, or one an admin set -- is sent
// here before they can use the portal (patch_37), because that password
// plus a pupil's name was enough for anyone to get into the account.
// Everyone else can come here from Profile to change their password.

const homeFor = (role?: string) =>
  role === 'admin' ? '/portal/admin'
    : role === 'teacher' ? '/portal/teacher'
    : role === 'teacher_pending' ? '/portal/pending'
    : '/portal';

const SetPassword = () => {
  const { currentUser, loading, updatePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  const required = !!currentUser.mustChangePassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Your password needs at least 8 letters or numbers.'); return; }
    if (password !== confirm) { setError('The two passwords are not the same. Please type them again.'); return; }
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      setError(/different from the old|same as/i.test(error)
        ? 'Please choose a new password -- not the one you were given.'
        : /weak|short|characters/i.test(error)
          ? 'That password is too easy to guess. Please choose a longer one.'
          : "Your password couldn't be saved. Please try again.");
      return;
    }
    navigate(homeFor(currentUser.role), { replace: true });
  };

  const firstName = currentUser.name.split(' ')[0];
  const niceName = firstName.charAt(0) + firstName.slice(1).toLowerCase();

  return (
    <div className="login-root">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <div className="login-container">
        {!required && (
          <Link to="/portal/profile" className="back-link">
            <ArrowLeft size={18} /> Back to Profile
          </Link>
        )}
        <div className="login-card glass animate-fade-in">
          <div className="login-header">
            <div className="login-logo"><ShieldCheck size={44} color="var(--primary)" /></div>
            <h1>{required ? `Welcome, ${niceName}! Choose your own password` : 'Change your password'}</h1>
            <p>
              {required
                ? 'The password you were given is also known by other people. Make a new one that only you and your family know. You will use it every time you log in.'
                : 'Choose a new password. You will use it the next time you log in.'}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

            <div className="input-group">
              <label>New password</label>
              <div className="input-field">
                <Lock size={18} className="input-icon" />
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="At least 8 letters or numbers"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  autoFocus
                />
                <button type="button" className="password-toggle" onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide passwords' : 'Show passwords'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Type it again</label>
              <div className="input-field">
                <Lock size={18} className="input-icon" />
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="The same password again"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '-4px 0 16px' }}>
              Tip: write it down and keep it somewhere safe at home.
            </p>

            <button type="submit" className="login-submit btn-primary" disabled={saving}>
              {saving ? (<><Loader2 size={20} className="animate-spin" /> Saving...</>) : 'Save my new password'}
            </button>

            {required && (
              <button type="button" onClick={() => logout()} style={{ width: '100%', marginTop: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
                Log out
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;

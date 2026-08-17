import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

// Reached either via the OTP code flow (ForgotPassword already verified
// the code and holds a session by the time it navigates here) or, for
// old email clicks, via Supabase's client picking up the recovery token
// from the URL and firing a PASSWORD_RECOVERY auth event. Either way this
// page just needs a live session to call updateUser({ password }).
const ResetPassword = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // If the tab was already open when the link was clicked, the event
    // may have already fired by the time this listener attaches --
    // check for an existing session too.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    const { error } = await updatePassword(password);
    setIsLoading(false);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="login-root">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <div className="login-container">
        <div className="login-card glass animate-fade-in">
          <div className="login-header">
            <h1>Set a New Password</h1>
          </div>

          {!ready && !success && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              Waiting for reset link verification... If you opened this page directly instead of through the email link, it won't work.
            </p>
          )}

          {ready && !success && (
            <form className="login-form" onSubmit={handleSubmit}>
              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <div className="input-group">
                <label>New Password</label>
                <div className="input-field">
                  <Lock size={18} className="input-icon" />
                  <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="input-field">
                  <Lock size={18} className="input-icon" />
                  <input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </div>

              <button type="submit" className="login-submit btn-primary" disabled={isLoading}>
                {isLoading ? (<><Loader2 size={20} className="animate-spin" /> Saving...</>) : 'Save New Password'}
              </button>
            </form>
          )}

          {success && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--success)' }}>
              Password updated! Redirecting to login...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

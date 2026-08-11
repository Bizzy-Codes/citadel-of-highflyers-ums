import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const { error } = await requestPasswordReset(email);
    setIsLoading(false);
    if (error) {
      setError(error);
    } else {
      // Always show success, whether or not the email exists --
      // otherwise this becomes a way to check who has an account.
      setSent(true);
    }
  };

  return (
    <div className="login-root">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <div className="login-container">
        <Link to="/login" className="back-link">
          <ArrowLeft size={18} />
          Back to Login
        </Link>

        <div className="login-card glass animate-fade-in">
          <div className="login-header">
            <h1>Reset Your Password</h1>
            <p>Enter the email on your account and we'll send you a reset link.</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox (and spam folder).
              </p>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {error && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              <div className="input-group">
                <label>Email Address</label>
                <div className="input-field">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit btn-primary" disabled={isLoading}>
                {isLoading ? (<><Loader2 size={20} className="animate-spin" /> Sending...</>) : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

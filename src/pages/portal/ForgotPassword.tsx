import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const ForgotPassword = () => {
  const { requestPasswordReset, verifyRecoveryOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verified, setVerified] = useState(false);

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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setIsLoading(true);
    const { error } = await verifyRecoveryOtp(email, otpCode);
    setIsLoading(false);
    if (error) {
      setOtpError(error);
      return;
    }
    // Verifying the code establishes a real session (same as clicking the
    // old reset link), so from here the user can either set a new
    // password or just continue into the app as-is.
    setVerified(true);
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
            {!sent && <p>Enter the email on your account and we'll send you a verification code.</p>}
          </div>

          {!sent && (
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
                {isLoading ? (<><Loader2 size={20} className="animate-spin" /> Sending...</>) : 'Send Verification Code'}
              </button>
            </form>
          )}

          {sent && !verified && (
            <form className="login-form animate-fade-in" onSubmit={handleVerifyOtp}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-16px' }}>
                If an account exists for <strong>{email}</strong>, we've sent a verification code. Enter it below (check spam too).
              </p>

              {otpError && <div className="error-message" style={{ color: 'var(--error)', fontSize: '13px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{otpError}</div>}

              <div className="input-group">
                <label>Verification Code</label>
                <div className="input-field">
                  <KeyRound size={18} className="input-icon" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter the code from your email"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    style={{ letterSpacing: '4px', fontSize: '18px' }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit btn-primary" disabled={isLoading || otpCode.length < 6}>
                {isLoading ? (<><Loader2 size={20} className="animate-spin" /> Verifying...</>) : 'Verify Code'}
              </button>
            </form>
          )}

          {verified && (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Code verified! You can now set a new password, or continue straight into your account.
              </p>
              <button
                className="login-submit btn-primary"
                onClick={() => navigate('/reset-password')}
                style={{ marginBottom: '12px' }}
              >
                Set a New Password
              </button>
              <button
                className="login-submit"
                onClick={() => navigate('/portal')}
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
              >
                Continue to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import './Login.css';

// Passwords are managed by the school office only: pupils and teachers
// can't reset or change their own, so there is nothing to type here.
const ForgotPassword = () => (
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
          <KeyRound size={32} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h1>Forgotten your password?</h1>
          <p>Passwords can only be changed by the school office. Please contact the school admin and they will give you a password you can use straight away.</p>
        </div>
        <Link to="/login" className="login-submit btn-primary" style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }} data-ai="forgot-back">
          Back to Login
        </Link>
      </div>
    </div>
  </div>
);

export default ForgotPassword;

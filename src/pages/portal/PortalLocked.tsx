import { Link } from 'react-router-dom';
import { ShieldAlert, LogOut, Receipt } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

// Shown instead of the portal while the school office has the pupil's
// portal locked. Deliberately says nothing about WHY -- the pupil only
// learns that a parent or guardian needs to speak to the office.
const PortalLocked = () => {
  const { logout } = useAuth();
  return (
    <div className="login-root">
      <div className="login-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
      <div className="login-container">
        <div className="login-card glass animate-fade-in" style={{ textAlign: 'center' }}>
          <div className="login-header">
            <ShieldAlert size={36} color="var(--primary)" style={{ marginBottom: '12px' }} />
            <h1>Your portal is not available right now</h1>
            <p>Please ask your parent or guardian to contact the school admin or the school secretary. They will help to open it for you.</p>
          </div>
          <Link
            to="/portal/fees"
            className="login-submit"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)', marginBottom: '12px' }}
          >
            <Receipt size={18} /> Parent or guardian? Send a payment receipt
          </Link>
          <button
            type="button"
            className="login-submit btn-primary"
            onClick={() => { void logout(); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortalLocked;

import { Navigate } from 'react-router-dom';
import { useAuth, type User } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: User['role'][];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '14px', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const fallback = currentUser.role === 'admin' ? '/portal/admin'
      : currentUser.role === 'teacher' ? '/portal/teacher'
      : currentUser.role === 'teacher_pending' ? '/portal/pending'
      : '/portal';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

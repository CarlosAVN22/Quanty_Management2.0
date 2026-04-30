import { Navigate, useLocation } from 'react-router-dom';
import { canAccess, getCurrentUser } from '../utils/auth';

function ProtectedRoute({ permission, children }) {
    const location = useLocation();
    const user = getCurrentUser();

    if (!user) {
        return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    if (permission && !canAccess(permission, user)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

export default ProtectedRoute;

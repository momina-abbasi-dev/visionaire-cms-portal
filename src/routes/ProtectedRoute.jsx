import { getRole, getToken } from "../utils/auth"
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, role }) => {
    const token = getToken();
    const userRole = getRole();

    if (!token) {
        return <Navigate to="/login" />;
    }

    if (role && role !== userRole) {
        return <Navigate to="/login" />;
    }

    return children ? children : <Outlet />;
};

export default ProtectedRoute;
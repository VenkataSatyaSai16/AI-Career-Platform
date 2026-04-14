import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import FullScreenLoader from "./FullScreenLoader";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <FullScreenLoader label="Restoring your workspace" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;

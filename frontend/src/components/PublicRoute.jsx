import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import FullScreenLoader from "./FullScreenLoader";

function PublicRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <FullScreenLoader label="Preparing authentication" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PublicRoute;

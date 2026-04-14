import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { clearAuthStorage, getStoredToken, getStoredUser, persistAuth } from "../services/authStorage";
import { getUserProfile, loginUser, signupUser } from "../services/interviewService";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(() => {
    clearAuthStorage();
    setToken("");
    setUser(null);
  }, []);

  const syncAuthState = useCallback((nextUser, nextToken) => {
    persistAuth(nextUser, nextToken);
    setUser(nextUser);
    setToken(nextToken);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const response = await loginUser(credentials);
      const nextToken = response?.token || "";
      const nextUser = response?.user || null;

      if (!nextToken || !nextUser) {
        throw new Error("Login response is missing user session data.");
      }

      syncAuthState(nextUser, nextToken);
      return response;
    },
    [syncAuthState]
  );

  const signup = useCallback(
    async (payload) => {
      const response = await signupUser(payload);

      if (response?.token && response?.user) {
        syncAuthState(response.user, response.token);
        return response;
      }

      return login({
        identifier: payload.email,
        password: payload.password
      });
    },
    [login, syncAuthState]
  );

  useEffect(() => {
    let active = true;

    async function hydrateUser() {
      const storedToken = getStoredToken();

      if (!storedToken) {
        setIsInitializing(false);
        return;
      }

      try {
        const profile = await getUserProfile();

        if (!active) {
          return;
        }

        syncAuthState(profile?.user || profile, storedToken);
      } catch (error) {
        if (active) {
          logout();
        }
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    }

    hydrateUser();

    return () => {
      active = false;
    };
  }, [logout, syncAuthState]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isInitializing,
      login,
      signup,
      logout,
      setUser
    }),
    [user, token, isInitializing, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const TOKEN_KEY = "ai-interview-platform-token";
const USER_KEY = "ai-interview-platform-user";
const SESSION_KEY = "ai-interview-platform-session";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function persistAuth(user, token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearInterviewSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearInterviewSession();
}

export function saveInterviewSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getInterviewSession() {
  const rawValue = localStorage.getItem(SESSION_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export const TOKEN_STORAGE_KEY = "token";
export const AUTH_USER_STORAGE_KEY = "ai-interview-auth";

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");

    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(window.atob(padded));
  } catch (_error) {
    return null;
  }
}

export function storeAuthToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);

  const payload = decodeJwtPayload(token);
  localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      id: payload?.userId || "",
      username: payload?.username || "",
      email: payload?.email || "",
      name: payload?.name || "",
      profileImage: ""
    })
  );
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function getStoredAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

export function updateStoredAuthUser(patch = {}) {
  const currentUser = getStoredAuthUser() || {};
  localStorage.setItem(
    AUTH_USER_STORAGE_KEY,
    JSON.stringify({
      ...currentUser,
      ...patch
    })
  );
}

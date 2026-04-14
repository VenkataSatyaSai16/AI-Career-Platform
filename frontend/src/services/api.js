import axios from "axios";
import { clearAuthStorage, getStoredToken } from "./authStorage";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthStorage();
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallbackMessage = "Something went wrong. Please try again.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

export async function requestWithFallback(requests) {
  let lastError = null;

  for (const request of requests) {
    try {
      const response = await request();
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(getErrorMessage(lastError));
}

export default api;

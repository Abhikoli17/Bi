//const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
import { API_URL } from "./config";
export const apiCall = async (
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.json();
};


/*const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export const apiCall = async (endpoint: string, options: RequestInit = {}, token?: string | null) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.json();
};*/
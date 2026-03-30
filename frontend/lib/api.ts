import type { ApiError } from "@/types/api";

const STORAGE_KEY_ACCESS = "timehit_access_token";
const STORAGE_KEY_REFRESH = "timehit_refresh_token";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

let accessToken: string | null = readStorage(STORAGE_KEY_ACCESS);
let refreshToken: string | null = readStorage(STORAGE_KEY_REFRESH);

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(STORAGE_KEY_ACCESS, access);
  localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(STORAGE_KEY_ACCESS);
  localStorage.removeItem(STORAGE_KEY_REFRESH);
}

export function getAccessToken() {
  if (!accessToken) accessToken = readStorage(STORAGE_KEY_ACCESS);
  return accessToken;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) refreshToken = readStorage(STORAGE_KEY_REFRESH);
  if (!refreshToken) return false;
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (!accessToken) accessToken = readStorage(STORAGE_KEY_ACCESS);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`/api/v1${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(`/api/v1${path}`, { ...options, headers });
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    throw { status: res.status, ...err.error };
  }

  return data as T;
}

export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
  if (!accessToken) accessToken = readStorage(STORAGE_KEY_ACCESS);
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const res = await fetch(`/api/v1${path}`, { method: "POST", headers, body: formData });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...(data as ApiError).error };
  return data as T;
}

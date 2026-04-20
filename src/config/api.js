import {
  getPersistentItem,
  getSessionItem,
  removePersistentItem,
  removeSessionItem,
  setSessionItem,
  setPersistentItem,
} from "./storage";

const DEFAULT_API_ORIGIN = "https://limpae-jcqa.onrender.com";
const hasWindowLocation =
  typeof window !== "undefined" &&
  typeof window.location !== "undefined" &&
  typeof window.location.hostname === "string";
const isLocalWebRuntime =
  hasWindowLocation &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
const localWebProxyOrigin = "http://localhost:8787";
const rawPublicApiOrigin =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  DEFAULT_API_ORIGIN;
const sanitizeOrigin = (value = "") => {
  const normalizedValue = String(value || "").trim().replace(/\/+$/, "");

  if (!normalizedValue) {
    return DEFAULT_API_ORIGIN;
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  return `https://${normalizedValue}`;
};
const publicApiOrigin = sanitizeOrigin(rawPublicApiOrigin);

export const API_ORIGIN = isLocalWebRuntime
  ? localWebProxyOrigin
  : publicApiOrigin;
export const API_BASE_URL = API_ORIGIN.endsWith("/api")
  ? API_ORIGIN
  : `${API_ORIGIN}/api`;

const normalizePath = (path = "") => (path.startsWith("/") ? path : `/${path}`);
const SUBSCRIPTION_BLOCKED_STORAGE_KEY = "subscription_access_blocked";
const SUBSCRIPTION_BLOCKED_EVENT = "subscription-access-blocked-change";

export const buildApiUrl = (path = "") => `${API_ORIGIN}${normalizePath(path)}`;
export const buildApiPathUrl = (path = "") => `${API_BASE_URL}${normalizePath(path)}`;

export const getToken = () => {
  const token = getPersistentItem("token");

  if (!token) {
    return null;
  }

  const normalizedToken = String(token).trim();
  if (!normalizedToken || normalizedToken === "null" || normalizedToken === "undefined") {
    void removePersistentItem("token");
    return null;
  }

  return normalizedToken;
};

const decodeBase64Url = (value = "") => {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, "=");
  const base64Decoder = typeof atob === "function" ? atob : null;

  if (!base64Decoder) {
    return "";
  }

  try {
    return base64Decoder(paddedValue);
  } catch (error) {
    console.error("Erro ao decodificar token JWT:", error);
    return "";
  }
};

export const getTokenPayload = () => {
  const token = getToken();
  if (!token) {
    return null;
  }

  const [, payload = ""] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload));
  } catch (error) {
    console.error("Erro ao ler payload do token:", error);
    return null;
  }
};

export const getCurrentUserId = () => {
  const payload = getTokenPayload();
  const rawUserId = payload?.user_id;
  const normalizedUserId = Number(rawUserId);

  return Number.isFinite(normalizedUserId) ? normalizedUserId : null;
};
export const setToken = async (token) => setPersistentItem("token", token);
export const clearToken = () => removePersistentItem("token");

export const hasBlockedSubscriptionAccess = () => {
  try {
    return getSessionItem(SUBSCRIPTION_BLOCKED_STORAGE_KEY) === "1";
  } catch (_error) {
    return false;
  }
};

export const setBlockedSubscriptionAccess = (blocked) => {
  try {
    if (blocked) {
      setSessionItem(SUBSCRIPTION_BLOCKED_STORAGE_KEY, "1");
    } else {
      removeSessionItem(SUBSCRIPTION_BLOCKED_STORAGE_KEY);
    }

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent(SUBSCRIPTION_BLOCKED_EVENT, {
          detail: { blocked: Boolean(blocked) },
        }),
      );
    }
  } catch (_error) {
  }
};

export const onBlockedSubscriptionAccessChange = (listener) => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }

  const handler = (event) => {
    listener(Boolean(event?.detail?.blocked));
  };

  window.addEventListener(SUBSCRIPTION_BLOCKED_EVENT, handler);
  return () => {
    window.removeEventListener(SUBSCRIPTION_BLOCKED_EVENT, handler);
  };
};

export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getToken();

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const apiFetch = async (path, options = {}) => {
  const {
    headers = {},
    authenticated = false,
    onUnauthorized,
    useApiBase = true,
    ...restOptions
  } = options;

  const url = useApiBase ? buildApiPathUrl(path) : buildApiUrl(path);
  const requestHeaders = authenticated ? getAuthHeaders(headers) : headers;
  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
    credentials: "include",
  });

  if (response.status === 401) {
    clearToken();
    if (onUnauthorized) {
      onUnauthorized(response);
    }
  }

  if (response.status === 402) {
    setBlockedSubscriptionAccess(true);
  } else if (response.ok && normalizePath(path).startsWith("/subscriptions")) {
    setBlockedSubscriptionAccess(false);
  }

  return response;
};

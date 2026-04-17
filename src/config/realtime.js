import { API_ORIGIN, getToken } from "./api";

const normalizePath = (path = "") => (path.startsWith("/") ? path : `/${path}`);

export const buildWebSocketUrl = (path = "/api/ws/offers") => {
  const normalizedOrigin = API_ORIGIN.replace(/\/$/, "");
  const websocketOrigin = normalizedOrigin.startsWith("https://")
    ? normalizedOrigin.replace("https://", "wss://")
    : normalizedOrigin.replace("http://", "ws://");

  return `${websocketOrigin}${normalizePath(path)}`;
};

export const createAuthenticatedWebSocket = (path = "/api/ws/offers", searchParams = {}) => {
  const token = getToken();

  if (!token) {
    return null;
  }

  const url = new URL(buildWebSocketUrl(path));

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  url.searchParams.set("access_token", token);

  return new WebSocket(url.toString(), ["json", `bearer.${token}`]);
};

import { API_ORIGIN, getToken } from "./api";

const normalizePath = (path = "") => (path.startsWith("/") ? path : `/${path}`);
const encodeQueryValue = (value) => encodeURIComponent(String(value));

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

  try {
    const queryParts = [];

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      queryParts.push(`${encodeQueryValue(key)}=${encodeQueryValue(value)}`);
    });

    queryParts.push(`access_token=${encodeQueryValue(token)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return new WebSocket(`${buildWebSocketUrl(path)}${queryString}`, ["json", `bearer.${token}`]);
  } catch (error) {
    console.error("Erro ao criar URL de websocket:", error);
    return null;
  }
};

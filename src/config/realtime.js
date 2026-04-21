import { API_ORIGIN, getToken } from "./api";

const normalizePath = (path = "") => (path.startsWith("/") ? path : `/${path}`);
const encodeQueryValue = (value) => encodeURIComponent(String(value));
const isReactNativeRuntime =
  typeof navigator !== "undefined" && String(navigator?.product || "").toLowerCase() === "reactnative";

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
    const websocketUrl = `${buildWebSocketUrl(path)}${queryString}`;
    const protocols = ["json", `bearer.${token}`];

    if (isReactNativeRuntime) {
      return new WebSocket(websocketUrl, protocols, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    return new WebSocket(websocketUrl, protocols);
  } catch (error) {
    console.error("Erro ao criar URL de websocket:", error);
    return null;
  }
};

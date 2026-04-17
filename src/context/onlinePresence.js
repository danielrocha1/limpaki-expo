import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  apiFetch,
  getToken,
  hasBlockedSubscriptionAccess,
  onBlockedSubscriptionAccessChange,
  setBlockedSubscriptionAccess,
} from "../config/api";
import { createAuthenticatedWebSocket } from "../config/realtime";

const OnlinePresenceContext = createContext({
  onlineClientIds: [],
  onlineDiaristIds: [],
  isClientOnline: () => false,
  isDiaristOnline: () => false,
});

const POLL_INTERVAL_MS = 15000;
const PRESENCE_EVENT_TYPE = "presence_state";

const normalizeUserIds = (userIds) =>
  Array.isArray(userIds)
    ? userIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

const isSubscriptionFlowPath = () => window.location.pathname.startsWith("/assinatura");

export const OnlinePresenceProvider = ({ children }) => {
  const [onlineClientIds, setOnlineClientIds] = useState([]);
  const [onlineDiaristIds, setOnlineDiaristIds] = useState([]);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(hasBlockedSubscriptionAccess());
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const subscriptionBlockedRef = useRef(hasBlockedSubscriptionAccess());

  const loadOnlineUsersByRole = useCallback(async (role) => {
    if (!getToken() || subscriptionBlockedRef.current || isSubscriptionFlowPath()) {
      return [];
    }

    try {
      const response = await apiFetch(`/realtime/online-users?role=${role}`, {
        authenticated: true,
      });

      if (response.status === 402) {
        subscriptionBlockedRef.current = true;
        setBlockedSubscriptionAccess(true);
        setSubscriptionBlocked(true);
        return [];
      }

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return normalizeUserIds(data?.user_ids);
    } catch (_error) {
      return [];
    }
  }, []);

  const applyPresenceSnapshot = useCallback((role, userIds) => {
    const normalizedIds = normalizeUserIds(userIds);

    if (role === "cliente") {
      setOnlineClientIds(normalizedIds);
      return;
    }

    if (role === "diarista") {
      setOnlineDiaristIds(normalizedIds);
    }
  }, []);

  const refreshPresence = useCallback(async () => {
    if (!getToken() || subscriptionBlocked || isSubscriptionFlowPath()) {
      setOnlineClientIds([]);
      setOnlineDiaristIds([]);
      return;
    }

    const [clientIds, diaristIds] = await Promise.all([
      loadOnlineUsersByRole("cliente"),
      loadOnlineUsersByRole("diarista"),
    ]);

    setOnlineClientIds(clientIds);
    setOnlineDiaristIds(diaristIds);
  }, [loadOnlineUsersByRole, subscriptionBlocked]);

  const closeSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const connectSocket = useCallback(() => {
    if (!getToken() || subscriptionBlocked || isSubscriptionFlowPath()) {
      return;
    }

    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
      return;
    }

    const socket = createAuthenticatedWebSocket("/api/ws/offers");
    if (!socket) {
      return;
    }

    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "client.ping" }));
      refreshPresence();
    };

    socket.onmessage = (event) => {
      try {
        const parsedEvent = JSON.parse(event.data);

        if (parsedEvent?.type === PRESENCE_EVENT_TYPE) {
          applyPresenceSnapshot(parsedEvent?.payload?.role, parsedEvent?.payload?.user_ids);
          return;
        }
      } catch (_error) {
      }

      refreshPresence();
    };

    socket.onerror = () => {};

    socket.onclose = (event) => {
      socketRef.current = null;

      if (!getToken()) {
        return;
      }

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectSocket();
      }, 3000);
    };
  }, [applyPresenceSnapshot, refreshPresence, subscriptionBlocked]);

  useEffect(() => {
    const unsubscribe = onBlockedSubscriptionAccessChange((blocked) => {
      subscriptionBlockedRef.current = blocked;
      setSubscriptionBlocked(blocked);
      if (blocked) {
        setOnlineClientIds([]);
        setOnlineDiaristIds([]);
        closeSocket();
      }
    });

    return unsubscribe;
  }, [closeSocket]);

  useEffect(() => {
    subscriptionBlockedRef.current = hasBlockedSubscriptionAccess();
    setSubscriptionBlocked(subscriptionBlockedRef.current);

    if (!getToken() || subscriptionBlockedRef.current || isSubscriptionFlowPath()) {
      setOnlineClientIds([]);
      setOnlineDiaristIds([]);
      closeSocket();
      return undefined;
    }

    refreshPresence();
    connectSocket();

    const pollInterval = window.setInterval(() => {
      refreshPresence();
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPresence();
        connectSocket();
      }
    };

    const handleBrowserOnline = () => {
      refreshPresence();
      connectSocket();
    };

    const handleBrowserOffline = () => {
      closeSocket();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);

    return () => {
      window.clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("offline", handleBrowserOffline);
      closeSocket();
    };
  }, [closeSocket, connectSocket, refreshPresence]);

  const value = useMemo(() => {
    const clientIdsSet = new Set(onlineClientIds);
    const diaristIdsSet = new Set(onlineDiaristIds);

    return {
      onlineClientIds,
      onlineDiaristIds,
      isClientOnline: (userId) => clientIdsSet.has(Number(userId)),
      isDiaristOnline: (userId) => diaristIdsSet.has(Number(userId)),
    };
  }, [onlineClientIds, onlineDiaristIds]);

  return (
    <OnlinePresenceContext.Provider value={value}>
      {children}
    </OnlinePresenceContext.Provider>
  );
};

export const useOnlinePresence = () => useContext(OnlinePresenceContext);

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  getCurrentUserId,
  getToken,
  hasBlockedSubscriptionAccess,
  onBlockedSubscriptionAccessChange,
  setBlockedSubscriptionAccess,
} from "../config/api";

const ChatCenterContext = createContext(null);
const CHAT_SEEN_STORAGE_KEY = "chat_seen_by_service";
const POLL_INTERVAL_MS = 5000;

const normalizeStatus = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isSubscriptionFlowPath = () =>
  typeof window !== "undefined" &&
  typeof window.location !== "undefined" &&
  typeof window.location.pathname === "string" &&
  window.location.pathname.startsWith("/assinatura");

const isChatAvailable = (service) => {
  const status = normalizeStatus(service?.status);
  return status !== "cancelado" && status !== "concluido" && status !== "em servico";
};

const readSeenRegistry = () => {
  try {
    const raw = localStorage.getItem(CHAT_SEEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
};

const writeSeenRegistry = (registry) => {
  localStorage.setItem(CHAT_SEEN_STORAGE_KEY, JSON.stringify(registry));
};

export const ChatCenterProvider = ({ children }) => {
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [activeChatService, setActiveChatService] = useState(null);
  const [activeChatServices, setActiveChatServices] = useState([]);
  const [chatSummaries, setChatSummaries] = useState([]);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(hasBlockedSubscriptionAccess());
  const activeChatServiceId = useMemo(
    () => Number(activeChatService?.ID ?? activeChatService?.id ?? 0),
    [activeChatService?.ID, activeChatService?.id],
  );

  const markServiceAsSeen = useCallback((serviceId, messageTimestamp = null) => {
    if (!serviceId) {
      return;
    }

    const registry = readSeenRegistry();
    registry[String(serviceId)] = messageTimestamp || new Date().toISOString();
    writeSeenRegistry(registry);
  }, []);

  const openChat = useCallback((service) => {
    if (!service || !isChatAvailable(service)) {
      return;
    }

    setActiveChatService(service);
    setIsChatDrawerOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatDrawerOpen(false);
  }, []);

  const refreshActiveChats = useCallback(async () => {
    const token = getToken();
    const currentUserId = getCurrentUserId();
    if (!token || !currentUserId || subscriptionBlocked || isSubscriptionFlowPath()) {
      setActiveChatServices([]);
      setChatSummaries([]);
      return;
    }

    try {
      const response = await apiFetch("/services/my?page=1&page_size=100", {
        authenticated: true,
      });

      if (response.status === 402) {
        setBlockedSubscriptionAccess(true);
        setSubscriptionBlocked(true);
        setActiveChatServices([]);
        setChatSummaries([]);
        return;
      }

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const services = Array.isArray(payload?.items) ? payload.items : [];
      const filteredServices = services.filter(isChatAvailable);

      setActiveChatServices(filteredServices);

      const seenRegistry = readSeenRegistry();
      const summaries = await Promise.all(
        filteredServices.map(async (service) => {
          const serviceId = Number(service?.ID ?? service?.id ?? 0);
          const messagesResponse = await apiFetch(`/messages?service_id=${serviceId}&page=1&page_size=20`, {
            authenticated: true,
          });

          if (!messagesResponse.ok) {
            return {
              service,
              unreadCount: 0,
              lastMessage: null,
            };
          }

          const messagesPayload = await messagesResponse.json();
          const messages = Array.isArray(messagesPayload?.items) ? messagesPayload.items : [];
          const lastMessage = messages[messages.length - 1] || null;
          const seenAt = seenRegistry[String(serviceId)];

          const unreadCount = messages.filter((message) => {
            const senderId = Number(message?.sender_id ?? message?.senderId ?? message?.SenderID ?? 0);
            const createdAt = message?.created_at || message?.createdAt || message?.CreatedAt;

            if (!createdAt || senderId === currentUserId) {
              return false;
            }

            return !seenAt || new Date(createdAt).getTime() > new Date(seenAt).getTime();
          }).length;

          if (
            isChatDrawerOpen &&
            activeChatServiceId === serviceId &&
            lastMessage?.created_at
          ) {
            markServiceAsSeen(serviceId, lastMessage.created_at);
            return {
              service,
              unreadCount: 0,
              lastMessage,
            };
          }

          return {
            service,
            unreadCount,
            lastMessage,
          };
        }),
      );

      setChatSummaries(summaries);
    } catch (_error) {
    }
  }, [activeChatServiceId, isChatDrawerOpen, markServiceAsSeen, subscriptionBlocked]);

  useEffect(() => {
    const unsubscribe = onBlockedSubscriptionAccessChange((blocked) => {
      setSubscriptionBlocked(blocked);
      if (blocked) {
        setActiveChatServices([]);
        setChatSummaries([]);
        setIsChatDrawerOpen(false);
        setActiveChatService(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setSubscriptionBlocked(hasBlockedSubscriptionAccess());
    refreshActiveChats();
    const intervalId = window.setInterval(refreshActiveChats, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshActiveChats]);

  useEffect(() => {
    if (subscriptionBlocked) {
      return undefined;
    }

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        refreshActiveChats();
      }
    };

    const handleWindowFocus = () => {
      refreshActiveChats();
    };

    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [refreshActiveChats, subscriptionBlocked]);

  useEffect(() => {
    if (!activeChatService || !isChatDrawerOpen) {
      return;
    }

    if (!isChatAvailable(activeChatService)) {
      setIsChatDrawerOpen(false);
      setActiveChatService(null);
      return;
    }

    const serviceId = Number(activeChatService?.ID ?? activeChatService?.id ?? 0);
    const activeSummary = chatSummaries.find(
      (summary) => Number(summary?.service?.ID ?? summary?.service?.id ?? 0) === serviceId,
    );

    if (serviceId && activeSummary?.lastMessage?.created_at) {
      markServiceAsSeen(serviceId, activeSummary.lastMessage.created_at);
      setChatSummaries((currentSummaries) =>
        currentSummaries.map((summary) =>
          Number(summary?.service?.ID ?? summary?.service?.id ?? 0) === serviceId
            ? { ...summary, unreadCount: 0 }
            : summary,
        ),
      );
    }
  }, [activeChatService, chatSummaries, isChatDrawerOpen, markServiceAsSeen]);

  const totalUnreadCount = useMemo(
    () => chatSummaries.reduce((total, summary) => total + Number(summary?.unreadCount || 0), 0),
    [chatSummaries],
  );

  const value = useMemo(
    () => ({
      activeChatService,
      activeChatServices,
      chatSummaries,
      closeChat,
      isChatDrawerOpen,
      markServiceAsSeen,
      openChat,
      refreshActiveChats,
      totalUnreadCount,
    }),
    [
      activeChatService,
      activeChatServices,
      chatSummaries,
      closeChat,
      isChatDrawerOpen,
      markServiceAsSeen,
      openChat,
      refreshActiveChats,
      totalUnreadCount,
    ],
  );

  return <ChatCenterContext.Provider value={value}>{children}</ChatCenterContext.Provider>;
};

export const useChatCenter = () => {
  const context = useContext(ChatCenterContext);
  if (!context) {
    throw new Error("useChatCenter deve ser usado dentro de ChatCenterProvider");
  }
  return context;
};

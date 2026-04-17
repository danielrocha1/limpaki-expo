import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getCurrentUserId } from "../../config/api";
import { createAuthenticatedWebSocket } from "../../config/realtime";

const CHAT_EVENT_TYPES = {
  MESSAGE: "message",
  READ: "read",
  LOCATION: "location",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  PRESENCE: "presence_state",
  ERROR: "error",
};

const MESSAGE_PAGE_SIZE = 50;
const BLOCKED_STATUSES = new Set(["cancelado", "concluido", "em servico"]);
const NON_RETRYABLE_HTTP_STATUSES = new Set([401, 403, 409]);
const serviceChatRegistry = new Map();

const normalizeStatus = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeUser = (user = {}) => ({
  id: Number(user?.ID ?? user?.id ?? 0),
  name: user?.Name || user?.name || "Usuario",
  photo:
    user?.Photo ||
    user?.photo ||
    user?.profile_photo ||
    user?.profilePhoto ||
    user?.profile_picture ||
    user?.profilePicture ||
    user?.image ||
    user?.Image ||
    user?.image_url ||
    user?.imageUrl ||
    user?.Avatar ||
    user?.avatar ||
    "",
});

const buildMessageKey = (message) => {
  if (message?.id) {
    return `id:${message.id}`;
  }

  return [
    "svc",
    message?.serviceId || 0,
    message?.senderId || 0,
    message?.createdAt || "",
    message?.content || "",
  ].join(":");
};

const normalizeMessage = (message = {}, usersById = {}) => {
  const senderId = Number(message?.sender_id ?? message?.senderId ?? message?.SenderID ?? 0);
  const sender = normalizeUser(message?.sender || message?.Sender || usersById[senderId] || {});

  return {
    id: Number(message?.id ?? message?.ID ?? 0) || null,
    serviceId: Number(message?.service_id ?? message?.serviceId ?? message?.ServiceID ?? 0),
    senderId,
    sender,
    content: String(message?.content ?? message?.Content ?? ""),
    createdAt: message?.created_at || message?.createdAt || message?.CreatedAt || null,
    read: Boolean(message?.read ?? message?.Read),
  };
};

const normalizeLocation = (location = {}, usersById = {}) => {
  const userId = Number(location?.user_id ?? location?.userId ?? location?.UserID ?? 0);
  const user = normalizeUser(location?.user || location?.User || usersById[userId] || {});

  return {
    userId,
    serviceId: Number(location?.service_id ?? location?.serviceId ?? location?.ServiceID ?? 0),
    latitude: Number(location?.latitude ?? location?.Latitude ?? 0),
    longitude: Number(location?.longitude ?? location?.Longitude ?? 0),
    updatedAt: location?.updated_at || location?.updatedAt || location?.UpdatedAt || null,
    user,
  };
};

const upsertMessages = (currentMessages, nextMessages) => {
  const registry = new Map();

  currentMessages.forEach((message) => {
    registry.set(buildMessageKey(message), message);
  });

  nextMessages.forEach((message) => {
    registry.set(buildMessageKey(message), message);
  });

  return Array.from(registry.values()).sort((left, right) => {
    const leftDate = new Date(left.createdAt || 0).getTime();
    const rightDate = new Date(right.createdAt || 0).getTime();
    return leftDate - rightDate;
  });
};

const markMessagesAsRead = (currentMessages, messageIds) => {
  const readIdSet = new Set(
    Array.isArray(messageIds) ? messageIds.map((messageId) => Number(messageId)).filter(Boolean) : [],
  );

  if (!readIdSet.size) {
    return currentMessages;
  }

  return currentMessages.map((message) => (
    message?.id && readIdSet.has(Number(message.id))
      ? { ...message, read: true }
      : message
  ));
};

const createEmptyEntry = (serviceId) => ({
  serviceId,
  service: null,
  userRole: "",
  currentUserId: null,
  currentUser: null,
  participant: null,
  usersById: {},
  chatBlocked: false,
  subscribers: new Set(),
  socket: null,
  socketPromise: null,
  reconnectTimer: null,
  reconnectAttempts: 0,
  disableRealtimeReason: "",
  preparedKey: "",
  pendingOpenWaiters: [],
  state: {
    messages: [],
    connectionStatus: "idle",
    isRoomLoading: false,
    isMessagesLoading: false,
    isSending: false,
    error: "",
    socketError: "",
    lastLocationEvent: null,
    locationsByUserId: {},
    onlineUserIds: [],
    isRealtimeDisabled: false,
  },
});

const getEntrySnapshot = (entry) => ({
  currentUser: entry.currentUser,
  participant: entry.participant,
  serviceId: entry.serviceId,
  ...entry.state,
});

const notifyEntry = (entry) => {
  const snapshot = getEntrySnapshot(entry);
  entry.subscribers.forEach((listener) => {
    listener(snapshot);
  });
};

const setEntryState = (entry, patch) => {
  entry.state = {
    ...entry.state,
    ...patch,
  };
  notifyEntry(entry);
};

const resolveOpenWaiters = (entry, error = null) => {
  const waiters = entry.pendingOpenWaiters.splice(0, entry.pendingOpenWaiters.length);
  waiters.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
};

const clearReconnectTimer = (entry) => {
  if (entry.reconnectTimer) {
    window.clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
  }
};

const closeEntrySocket = (entry, code = 1000, reason = "closing") => {
  clearReconnectTimer(entry);
  if (entry.socket) {
    entry.socket.onopen = null;
    entry.socket.onmessage = null;
    entry.socket.onerror = null;
    entry.socket.onclose = null;
    entry.socket.close(code, reason);
    entry.socket = null;
  }
  entry.socketPromise = null;
};

const disableRealtime = (entry, message) => {
  entry.disableRealtimeReason = message || "Tempo real indisponivel para este chat.";
  closeEntrySocket(entry, 1000, "realtime-disabled");
  setEntryState(entry, {
    isRealtimeDisabled: true,
    connectionStatus: "closed",
    socketError: entry.disableRealtimeReason,
  });
  resolveOpenWaiters(entry, new Error(entry.disableRealtimeReason));
};

const ensureRegistryEntry = (serviceId) => {
  if (!serviceChatRegistry.has(serviceId)) {
    serviceChatRegistry.set(serviceId, createEmptyEntry(serviceId));
  }

  return serviceChatRegistry.get(serviceId);
};

const updateEntryConfig = (entry, service, userRole, currentUserId) => {
  entry.service = service;
  entry.userRole = userRole;
  entry.currentUserId = currentUserId;
  entry.currentUser = service
    ? normalizeUser(userRole === "cliente" ? service?.client : service?.diarist)
    : null;
  entry.participant = service
    ? normalizeUser(userRole === "cliente" ? service?.diarist : service?.client)
    : null;
  entry.chatBlocked = BLOCKED_STATUSES.has(normalizeStatus(service?.status));
  entry.usersById = {};

  if (entry.currentUser?.id) {
    entry.usersById[entry.currentUser.id] = entry.currentUser;
  }

  if (entry.participant?.id) {
    entry.usersById[entry.participant.id] = entry.participant;
  }
};

const loadMessages = async (entry, { silent = false } = {}) => {
  if (!entry.serviceId) {
    return;
  }

  if (!silent) {
    setEntryState(entry, { isMessagesLoading: true });
  }

  try {
    const response = await apiFetch(
      `/messages?service_id=${entry.serviceId}&page=1&page_size=${MESSAGE_PAGE_SIZE}`,
      { authenticated: true },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (NON_RETRYABLE_HTTP_STATUSES.has(response.status)) {
        disableRealtime(entry, payload?.error || "Tempo real indisponivel para este chat.");
      }
    throw new Error(payload?.error || "Não foi possível carregar as mensagens.");
    }

    const payload = await response.json();
    const nextMessages = Array.isArray(payload?.items)
      ? payload.items.map((message) => normalizeMessage(message, entry.usersById))
      : [];

    setEntryState(entry, {
      messages: nextMessages,
      error: "",
    });
  } catch (error) {
    if (!silent) {
      setEntryState(entry, {
        error: error.message || "Erro ao carregar o chat.",
      });
    }
  } finally {
    if (!silent) {
      setEntryState(entry, { isMessagesLoading: false });
    }
  }
};

const loadLocations = async (entry, { silent = false } = {}) => {
  if (!entry.serviceId) {
    return;
  }

  try {
    const response = await apiFetch(`/locations?service_id=${entry.serviceId}`, {
      authenticated: true,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (NON_RETRYABLE_HTTP_STATUSES.has(response.status)) {
        disableRealtime(entry, payload?.error || "Tempo real indisponivel para este chat.");
      }
    throw new Error(payload?.error || "Não foi possível carregar as localizações.");
    }

    const payload = await response.json();
    const nextLocations = Array.isArray(payload?.items)
      ? payload.items.map((location) => normalizeLocation(location, entry.usersById))
      : [];

    setEntryState(entry, {
      locationsByUserId: nextLocations.reduce((registry, location) => {
        if (location?.userId) {
          registry[location.userId] = location;
        }
        return registry;
      }, {}),
    });
  } catch (error) {
    if (!silent) {
      setEntryState(entry, {
        error: error.message || "Erro ao carregar localizacoes do chat.",
      });
    }
  }
};

const prepareConversation = async (entry) => {
  if (!entry.service || !entry.serviceId || !entry.currentUserId || !entry.participant?.id) {
    setEntryState(entry, {
      messages: [],
      connectionStatus: "idle",
    });
    return;
  }

  if (entry.chatBlocked) {
    closeEntrySocket(entry, 1000, "chat-blocked");
    setEntryState(entry, {
      messages: [],
      connectionStatus: "closed",
    error: "Chat indisponível para serviços em serviço, cancelados ou concluídos.",
    });
    return;
  }

  setEntryState(entry, {
    isRoomLoading: true,
    isRealtimeDisabled: false,
    error: "",
    socketError: "",
    lastLocationEvent: null,
    locationsByUserId: {},
    onlineUserIds: [],
  });
  entry.disableRealtimeReason = "";

  try {
    await loadMessages(entry);
    await loadLocations(entry, { silent: true });
  } catch (error) {
    setEntryState(entry, {
      messages: [],
      connectionStatus: "closed",
      error: error.message || "Erro ao preparar a conversa.",
    });
  } finally {
    setEntryState(entry, { isRoomLoading: false });
  }
};

const sendReadReceipt = (entry) => {
  if (!entry.serviceId || document.visibilityState !== "visible") {
    return false;
  }

  const socket = entry.socket;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(
    JSON.stringify({
      type: CHAT_EVENT_TYPES.READ,
      service_id: entry.serviceId,
    }),
  );

  return true;
};

const waitForSocketOpen = (entry, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const socket = entry.socket;
  if (socket?.readyState === WebSocket.OPEN) {
    resolve();
    return;
  }

  if (entry.state.isRealtimeDisabled) {
    reject(new Error(entry.disableRealtimeReason || "Tempo real indisponivel para este chat."));
    return;
  }

  const timeoutId = window.setTimeout(() => {
    entry.pendingOpenWaiters = entry.pendingOpenWaiters.filter((waiter) => waiter.reject !== reject);
      reject(new Error("Chat desconectado. Aguarde a reconexão para enviar."));
  }, timeoutMs);

  entry.pendingOpenWaiters.push({
    resolve: () => {
      window.clearTimeout(timeoutId);
      resolve();
    },
    reject: (error) => {
      window.clearTimeout(timeoutId);
      reject(error);
    },
  });
});

const connectEntry = (entry) => {
  if (!entry.serviceId || entry.chatBlocked || entry.state.isRealtimeDisabled) {
    return;
  }

  if (entry.socket && entry.socket.readyState <= WebSocket.OPEN) {
    return;
  }

  if (entry.socketPromise) {
    return;
  }

  entry.socketPromise = Promise.resolve().then(() => {
    clearReconnectTimer(entry);
    setEntryState(entry, {
      connectionStatus: "connecting",
      socketError: "",
    });

    const socket = createAuthenticatedWebSocket("/api/ws/chat", {
      service_id: entry.serviceId,
    });

    if (!socket) {
      entry.socketPromise = null;
      disableRealtime(entry, "Sessao expirada. Faca login novamente.");
      return;
    }

    entry.socket = socket;

    socket.onopen = () => {
      entry.reconnectAttempts = 0;
      entry.socketPromise = null;
      setEntryState(entry, { connectionStatus: "connected" });
      resolveOpenWaiters(entry);
      loadMessages(entry, { silent: true });
      sendReadReceipt(entry);
    };

    socket.onmessage = (event) => {
      try {
        const parsedEvent = JSON.parse(event.data);

        switch (parsedEvent?.type) {
          case CHAT_EVENT_TYPES.MESSAGE: {
            const nextMessage = normalizeMessage(parsedEvent, entry.usersById);
            setEntryState(entry, {
              messages: upsertMessages(entry.state.messages, [nextMessage]),
            });
            if (nextMessage.senderId && nextMessage.senderId !== entry.currentUserId) {
              sendReadReceipt(entry);
            }
            break;
          }

          case CHAT_EVENT_TYPES.READ:
            setEntryState(entry, {
              messages: markMessagesAsRead(entry.state.messages, parsedEvent?.message_ids),
            });
            break;

          case CHAT_EVENT_TYPES.USER_JOINED:
            setEntryState(entry, {
              onlineUserIds: Array.from(
                new Set([...entry.state.onlineUserIds, Number(parsedEvent?.user_id || 0)].filter(Boolean)),
              ),
            });
            break;

          case CHAT_EVENT_TYPES.USER_LEFT:
            setEntryState(entry, {
              onlineUserIds: entry.state.onlineUserIds.filter(
                (userId) => userId !== Number(parsedEvent?.user_id || 0),
              ),
            });
            break;

          case CHAT_EVENT_TYPES.PRESENCE:
            setEntryState(entry, {
              onlineUserIds: Array.isArray(parsedEvent?.user_ids)
                ? parsedEvent.user_ids.map((userId) => Number(userId)).filter(Boolean)
                : [],
            });
            break;

          case CHAT_EVENT_TYPES.LOCATION: {
            const nextLocation = normalizeLocation(parsedEvent, entry.usersById);
            setEntryState(entry, {
              lastLocationEvent: nextLocation,
              locationsByUserId: nextLocation?.userId
                ? {
                    ...entry.state.locationsByUserId,
                    [nextLocation.userId]: nextLocation,
                  }
                : entry.state.locationsByUserId,
            });
            break;
          }

          case CHAT_EVENT_TYPES.ERROR:
            setEntryState(entry, {
              socketError: parsedEvent?.error || "Erro ao processar evento do chat.",
            });
            break;

          default:
            break;
        }
      } catch (_error) {
      }
    };

    socket.onerror = () => {
      setEntryState(entry, {
      socketError: "Falha na conexão em tempo real. Tentando reconectar...",
        connectionStatus: "error",
      });
    };

    socket.onclose = (_event) => {
      entry.socket = null;
      entry.socketPromise = null;

      if (_event?.code === 1000) {
        setEntryState(entry, { connectionStatus: "closed" });
        resolveOpenWaiters(entry, new Error("Chat desconectado."));
        return;
      }

      if (_event?.code === 1008 || _event?.code === 1011) {
        disableRealtime(entry, entry.disableRealtimeReason || "Tempo real indisponivel para este chat.");
        return;
      }

      if (entry.disableRealtimeReason) {
        setEntryState(entry, { connectionStatus: "closed" });
        resolveOpenWaiters(entry, new Error(entry.disableRealtimeReason));
        return;
      }

      setEntryState(entry, { connectionStatus: "closed" });
      entry.reconnectAttempts += 1;
      const nextDelay = Math.min(5000, 1000 * 2 ** Math.min(entry.reconnectAttempts, 3));
      entry.reconnectTimer = window.setTimeout(() => {
        connectEntry(entry);
      }, nextDelay);
      resolveOpenWaiters(entry, new Error("Chat reconectando."));
    };
  });
};

const subscribeToEntry = (entry, listener) => {
  entry.subscribers.add(listener);
  listener(getEntrySnapshot(entry));

  return () => {
    entry.subscribers.delete(listener);
    if (!entry.subscribers.size) {
      closeEntrySocket(entry, 1000, "no-subscribers");
      serviceChatRegistry.delete(entry.serviceId);
    }
  };
};

export const useServiceChat = (service, userRole) => {
  const serviceId = useMemo(() => Number(service?.ID ?? service?.id ?? 0) || null, [service]);
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const [snapshot, setSnapshot] = useState({
    currentUser: null,
    participant: null,
    serviceId,
    messages: [],
    connectionStatus: "idle",
    isRoomLoading: false,
    isMessagesLoading: false,
    isSending: false,
    error: "",
    socketError: "",
    lastLocationEvent: null,
    locationsByUserId: {},
    onlineUserIds: [],
    isRealtimeDisabled: false,
  });

  useEffect(() => {
    if (!serviceId) {
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        serviceId: null,
        currentUser: null,
        participant: null,
        messages: [],
        connectionStatus: "idle",
        isRoomLoading: false,
        isMessagesLoading: false,
        error: "",
        socketError: "",
        locationsByUserId: {},
        onlineUserIds: [],
        isRealtimeDisabled: false,
      }));
      return undefined;
    }

    const entry = ensureRegistryEntry(serviceId);
    updateEntryConfig(entry, service, userRole, currentUserId);
    const preparedKey = [
      serviceId,
      currentUserId || 0,
      entry.participant?.id || 0,
      userRole || "",
      normalizeStatus(service?.status),
    ].join(":");

    notifyEntry(entry);
    if (entry.preparedKey !== preparedKey) {
      entry.preparedKey = preparedKey;
      prepareConversation(entry);
    }
    connectEntry(entry);

    return subscribeToEntry(entry, setSnapshot);
  }, [currentUserId, service, serviceId, userRole]);

  useEffect(() => {
    if (!serviceId || snapshot.connectionStatus === "idle" || snapshot.isRealtimeDisabled) {
      return undefined;
    }

    const entry = ensureRegistryEntry(serviceId);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendReadReceipt(entry);
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [serviceId, snapshot.connectionStatus, snapshot.isRealtimeDisabled]);

  const sendMessage = useCallback(async (content) => {
    const normalizedContent = String(content || "").trim();

    if (!normalizedContent) {
      throw new Error("Digite uma mensagem antes de enviar.");
    }

    if (!serviceId) {
    throw new Error("Conversa indisponível para este serviço.");
    }

    const entry = ensureRegistryEntry(serviceId);
    updateEntryConfig(entry, service, userRole, currentUserId);

    const socket = entry.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connectEntry(entry);
      await waitForSocketOpen(entry);
    }

    setEntryState(entry, {
      isSending: true,
      socketError: "",
    });

    try {
      const payload = {
        type: CHAT_EVENT_TYPES.MESSAGE,
        service_id: serviceId,
        content: normalizedContent,
      };

      entry.socket.send(JSON.stringify(payload));
    } finally {
      setEntryState(entry, { isSending: false });
    }
  }, [currentUserId, service, serviceId, userRole]);

  const sendLocation = useCallback(async ({ latitude, longitude }) => {
    if (!serviceId) {
    throw new Error("Conversa indisponível para este serviço.");
    }

    const entry = ensureRegistryEntry(serviceId);
    updateEntryConfig(entry, service, userRole, currentUserId);

    if (!entry.socket || entry.socket.readyState !== WebSocket.OPEN) {
      connectEntry(entry);
      await waitForSocketOpen(entry);
    }

    entry.socket.send(
      JSON.stringify({
        type: CHAT_EVENT_TYPES.LOCATION,
        service_id: serviceId,
        latitude,
        longitude,
      }),
    );
  }, [currentUserId, service, serviceId, userRole]);

  return {
    currentUser: snapshot.currentUser,
    participant: snapshot.participant,
    serviceId: snapshot.serviceId,
    messages: snapshot.messages,
    isRoomLoading: snapshot.isRoomLoading,
    isMessagesLoading: snapshot.isMessagesLoading,
    isSending: snapshot.isSending,
    connectionStatus: snapshot.connectionStatus,
    error: snapshot.error,
    socketError: snapshot.socketError,
    onlineUserIds: snapshot.onlineUserIds,
    lastLocationEvent: snapshot.lastLocationEvent,
    locationsByUserId: snapshot.locationsByUserId,
    sendMessage,
    sendLocation,
  };
};

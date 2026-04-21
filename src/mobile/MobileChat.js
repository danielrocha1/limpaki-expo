import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { apiFetch } from "../config/api";
import { createAuthenticatedWebSocket } from "../config/realtime";
import LiveLocationMapCanvas from "./LiveLocationMapCanvas";

const palette = {
  surface: "#ffffff",
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  accentAlt: "#fbbf24",
  border: "#d9dee8",
  success: "#10b981",
};

const CHAT_EVENT_TYPES = {
  MESSAGE: "message",
  READ: "read",
  LOCATION: "location",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  PRESENCE: "presence_state",
  ERROR: "error",
};

const CONNECTION_LABELS = {
  idle: "Inicializando",
  connecting: "Conectando...",
  connected: "Conectado em tempo real",
  closed: "Desconectado",
  error: "Conexao instavel",
};

const LOCATION_REQUEST_MESSAGE = "Pode habilitar sua localizacao em tempo real no chat, por favor?";
const MESSAGE_PAGE_SIZE = 50;
const BLOCKED_STATUSES = new Set(["cancelado", "concluido", "em servico"]);
const LIVE_LOCATION_TTL_MS = 60 * 60 * 1000;

const normalizeStatus = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeUser = (user = {}, fallbackName = "Usuario") => ({
  id: Number(user?.ID ?? user?.id ?? 0) || null,
  name: user?.Name || user?.name || fallbackName,
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

const resolveCurrentUser = (service, userRole) =>
  normalizeUser(userRole === "cliente" ? service?.client : service?.diarist, "Voce");

const resolveParticipant = (service, userRole) =>
  normalizeUser(userRole === "cliente" ? service?.diarist : service?.client, "Participante");

const buildMessageKey = (message) => {
  if (message?.id) {
    return `id:${message.id}`;
  }

  return [
    message?.serviceId || 0,
    message?.senderId || 0,
    message?.createdAt || "",
    message?.content || "",
  ].join(":");
};

const normalizeMessage = (message = {}, usersById = {}) => {
  const senderId = Number(message?.sender_id ?? message?.senderId ?? message?.SenderID ?? 0) || null;
  const sender = normalizeUser(message?.sender || message?.Sender || usersById[senderId] || {});

  return {
    id: Number(message?.id ?? message?.ID ?? 0) || null,
    serviceId: Number(message?.service_id ?? message?.serviceId ?? message?.ServiceID ?? 0) || null,
    senderId,
    sender,
    content: String(message?.content ?? message?.Content ?? ""),
    createdAt: message?.created_at || message?.createdAt || message?.CreatedAt || null,
    read: Boolean(message?.read ?? message?.Read),
  };
};

const normalizeLocation = (location = {}, usersById = {}) => {
  const userId = Number(location?.user_id ?? location?.userId ?? location?.UserID ?? 0) || null;
  const user = normalizeUser(location?.user || location?.User || usersById[userId] || {});

  return {
    userId,
    serviceId: Number(location?.service_id ?? location?.serviceId ?? location?.ServiceID ?? 0) || null,
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

  return currentMessages.map((message) =>
    message?.id && readIdSet.has(Number(message.id)) ? { ...message, read: true } : message,
  );
};

const formatMessageTime = (value) => {
  if (!value) {
    return "Agora";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Agora";
  }

  return parsedDate.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLocationStatusTime = (value) => {
  if (!value) {
    return "Atualizacao recente";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Atualizacao recente";
  }

  return parsedDate.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isFreshLiveLocation = (location) => {
  const updatedAt = location?.updatedAt;
  if (!updatedAt) {
    return false;
  }

  const parsedDate = new Date(updatedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return Date.now() - parsedDate.getTime() <= LIVE_LOCATION_TTL_MS;
};

const formatLocationExpiresIn = (value) => {
  if (!value) {
    return "Disponivel por ate 1 hora";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Disponivel por ate 1 hora";
  }

  const remainingMs = LIVE_LOCATION_TTL_MS - (Date.now() - parsedDate.getTime());
  if (remainingMs <= 0) {
    return "Compartilhamento expirado";
  }

  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Disponivel por mais ${remainingMinutes} min`;
};

const resolveAddressPosition = (address) => {
  const latitude = Number(address?.Latitude ?? address?.latitude ?? 0);
  const longitude = Number(address?.Longitude ?? address?.longitude ?? 0);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
};

const isDuplicateLocationConstraintError = (value) => {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("duplicate key") || normalized.includes("chat_locations_pkey");
};

const isNativePlatform = Platform.OS === "ios" || Platform.OS === "android";

const clearLocationTracking = async (trackingRef) => {
  const currentTracking = trackingRef.current;
  if (!currentTracking) {
    return;
  }

  if (currentTracking.kind === "web" && typeof navigator !== "undefined" && navigator?.geolocation) {
    navigator.geolocation.clearWatch(currentTracking.value);
  }

  if (currentTracking.kind === "native" && currentTracking.value?.remove) {
    await currentTracking.value.remove();
  }

  trackingRef.current = null;
};

function ChatLiveLocationCard({ item, isOwn, onPress }) {
  return (
    <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
      {!isOwn ? <ChatAvatar profile={item.author} size={34} /> : null}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        style={[
          styles.locationMessageCard,
          isOwn && styles.locationMessageCardOwn,
        ]}
      >
        <View style={styles.locationMessageHeader}>
          <View style={styles.locationMessageTitleWrap}>
            <Feather name="map-pin" size={14} color={isOwn ? "#ffffff" : palette.accent} />
            <Text style={[styles.locationMessageTitle, isOwn && styles.locationMessageTitleOwn]}>
              {item.title}
            </Text>
          </View>
          <Text style={[styles.locationMessageExpiry, isOwn && styles.locationMessageExpiryOwn]}>
            {item.expiresLabel}
          </Text>
        </View>

        <Text style={[styles.locationMessageBody, isOwn && styles.locationMessageBodyOwn]}>
          {item.description}
        </Text>

        <View style={styles.locationMessageFooter}>
          <Text style={[styles.locationMessageMeta, isOwn && styles.locationMessageMetaOwn]}>
            Atualizado em {formatLocationStatusTime(item.location?.updatedAt)}
          </Text>
          <View style={[styles.locationMessageCta, isOwn && styles.locationMessageCtaOwn]}>
            <Text style={[styles.locationMessageCtaText, isOwn && styles.locationMessageCtaTextOwn]}>
              Ver mapa
            </Text>
            <Feather name="arrow-up-right" size={13} color={isOwn ? "#ffffff" : palette.accent} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function LiveLocationMapModal({ visible, markers, onClose, onOpenExternalMap }) {
  const availableMarkers = useMemo(
    () =>
      Array.isArray(markers)
        ? markers.filter(
            (marker) =>
              Number.isFinite(marker?.latitude) &&
              Number.isFinite(marker?.longitude),
          )
        : [],
    [markers],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.liveMapBackdrop}>
        <View style={styles.liveMapPanel}>
          <View style={styles.liveMapHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.liveMapTitle}>Localizacao em tempo real</Text>
              <Text style={styles.liveMapCopy}>
                Acompanhe a diarista no mapa e veja tambem o pin da cliente.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.liveMapClose}>
              <Feather name="x" size={18} color={palette.ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.liveMapCanvas}>
            <LiveLocationMapCanvas markers={availableMarkers} />
          </View>

          <View style={styles.liveMapLegend}>
            {availableMarkers.map((marker) => (
              <View key={marker.id} style={styles.liveMapLegendItem}>
                <View style={[styles.liveMapLegendDot, { backgroundColor: marker.accentColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveMapLegendTitle}>{marker.name}</Text>
                  <Text style={styles.liveMapLegendCopy}>{marker.statusText}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.liveMapActions}>
            <TouchableOpacity onPress={onClose} style={styles.liveMapSecondaryButton}>
              <Text style={styles.liveMapSecondaryButtonText}>Fechar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenExternalMap} style={styles.liveMapPrimaryButton}>
              <Text style={styles.liveMapPrimaryButtonText}>Abrir mapa externo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ChatAvatar({ profile, size = 42 }) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [profile?.photo]);

  const fallbackLetter = String(profile?.name || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={[styles.avatarShell, { width: size, height: size, borderRadius: size / 2 }]}>
      {profile?.photo && !hasImageError ? (
        <Image
          source={{ uri: profile.photo }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <Text style={styles.avatarFallback}>{fallbackLetter}</Text>
      )}
    </View>
  );
}

export function useMobileServiceChat({ service, userRole, active }) {
  const serviceId = useMemo(() => Number(service?.ID ?? service?.id ?? 0) || null, [service]);
  const currentUser = useMemo(() => resolveCurrentUser(service, userRole), [service, userRole]);
  const participant = useMemo(() => resolveParticipant(service, userRole), [service, userRole]);
  const currentUserId = Number(currentUser?.id || 0) || null;
  const usersById = useMemo(() => {
    const registry = {};

    if (currentUser?.id) {
      registry[currentUser.id] = currentUser;
    }

    if (participant?.id) {
      registry[participant.id] = participant;
    }

    return registry;
  }, [currentUser, participant]);

  const [messages, setMessages] = useState([]);
  const [locationsByUserId, setLocationsByUserId] = useState({});
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [error, setError] = useState("");
  const [socketError, setSocketError] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const usersByIdRef = useRef(usersById);
  const currentUserIdRef = useRef(currentUserId);

  useEffect(() => {
    usersByIdRef.current = usersById;
  }, [usersById]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      setLocationsByUserId({});
      setError("");
      setSocketError("");
      setConnectionStatus("idle");
      setOnlineUserIds([]);
      return undefined;
    }

    return undefined;
  }, [active, serviceId]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      if (socketRef.current) {
        socketRef.current.close(1000, "unmount");
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!active || !serviceId) {
      return undefined;
    }

    if (BLOCKED_STATUSES.has(normalizeStatus(service?.status))) {
      setError("Chat indisponivel para servicos em servico, cancelados ou concluidos.");
      setConnectionStatus("closed");
      return undefined;
    }

    let cancelled = false;

    const loadConversation = async () => {
      setIsMessagesLoading(true);
      setError("");

      try {
        const [messagesResponse, locationsResponse] = await Promise.all([
          apiFetch(`/messages?service_id=${serviceId}&page=1&page_size=${MESSAGE_PAGE_SIZE}`, {
            authenticated: true,
          }),
          apiFetch(`/locations?service_id=${serviceId}`, {
            authenticated: true,
          }),
        ]);

        const messagesPayload = await messagesResponse.json().catch(() => ({}));
        const locationsPayload = await locationsResponse.json().catch(() => ({}));

        if (!messagesResponse.ok) {
          throw new Error(messagesPayload?.error || "Nao foi possivel carregar as mensagens.");
        }

        if (!cancelled) {
          const nextMessages = Array.isArray(messagesPayload?.items)
            ? messagesPayload.items.map((message) => normalizeMessage(message, usersByIdRef.current))
            : [];
          const nextLocations = Array.isArray(locationsPayload?.items)
            ? locationsPayload.items.map((location) => normalizeLocation(location, usersByIdRef.current))
            : [];

          setMessages(nextMessages);
          setLocationsByUserId(
            nextLocations.reduce((registry, location) => {
              if (location?.userId) {
                registry[location.userId] = location;
              }
              return registry;
            }, {}),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Nao foi possivel carregar o chat.");
        }
      } finally {
        if (!cancelled) {
          setIsMessagesLoading(false);
        }
      }
    };

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [active, service?.status, serviceId]);

  useEffect(() => {
    if (!active || !serviceId) {
      return undefined;
    }

    if (BLOCKED_STATUSES.has(normalizeStatus(service?.status))) {
      return undefined;
    }

    let cancelled = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      clearReconnect();
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close(1000, "cleanup");
        socketRef.current = null;
      }
    };

    const sendReadReceipt = () => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      socketRef.current.send(
        JSON.stringify({
          type: CHAT_EVENT_TYPES.READ,
          service_id: serviceId,
        }),
      );
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      clearReconnect();
      setConnectionStatus("connecting");
      setSocketError("");

      const socket = createAuthenticatedWebSocket("/api/ws/chat", { service_id: serviceId });

      if (!socket) {
        setConnectionStatus("closed");
        setSocketError("Sessao expirada. Faca login novamente.");
        return;
      }

      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionStatus("connected");
        sendReadReceipt();
      };

      socket.onmessage = (event) => {
        try {
          const parsedEvent = JSON.parse(event.data);

          switch (parsedEvent?.type) {
            case CHAT_EVENT_TYPES.MESSAGE: {
              const nextMessage = normalizeMessage(parsedEvent, usersByIdRef.current);
              setMessages((currentMessages) => upsertMessages(currentMessages, [nextMessage]));
              if (nextMessage.senderId && nextMessage.senderId !== currentUserIdRef.current) {
                sendReadReceipt();
              }
              break;
            }

            case CHAT_EVENT_TYPES.READ:
              setMessages((currentMessages) => markMessagesAsRead(currentMessages, parsedEvent?.message_ids));
              break;

            case CHAT_EVENT_TYPES.LOCATION: {
              const nextLocation = normalizeLocation(parsedEvent, usersByIdRef.current);
              if (nextLocation?.userId) {
                setLocationsByUserId((currentRegistry) => ({
                  ...currentRegistry,
                  [nextLocation.userId]: nextLocation,
                }));
              }
              break;
            }

            case CHAT_EVENT_TYPES.USER_JOINED:
              setOnlineUserIds((currentIds) =>
                Array.from(new Set([...currentIds, Number(parsedEvent?.user_id || 0)].filter(Boolean))),
              );
              break;

            case CHAT_EVENT_TYPES.USER_LEFT:
              setOnlineUserIds((currentIds) =>
                currentIds.filter((userId) => userId !== Number(parsedEvent?.user_id || 0)),
              );
              break;

            case CHAT_EVENT_TYPES.PRESENCE:
              setOnlineUserIds(
                Array.isArray(parsedEvent?.user_ids)
                  ? parsedEvent.user_ids.map((userId) => Number(userId)).filter(Boolean)
                  : [],
              );
              break;

            case CHAT_EVENT_TYPES.ERROR: {
              const socketMessage = parsedEvent?.error || "Erro ao processar evento do chat.";

              if (isDuplicateLocationConstraintError(socketMessage)) {
                void refreshLocations()
                  .then((nextRegistry) => {
                    const currentUserLocation = currentUserIdRef.current
                      ? nextRegistry[currentUserIdRef.current]
                      : null;
                    if (currentUserLocation) {
                      setSocketError("");
                      return;
                    }

                    setSocketError(socketMessage);
                  })
                  .catch(() => {
                    setSocketError(socketMessage);
                  });
                break;
              }

              setSocketError(socketMessage);
              break;
            }

            default:
              break;
          }
        } catch (_error) {
        }
      };

      socket.onerror = () => {
        setConnectionStatus("error");
        setSocketError("Falha na conexao em tempo real. Tentando reconectar...");
      };

      socket.onclose = (closeEvent) => {
        socketRef.current = null;

        if (cancelled) {
          return;
        }

        if (closeEvent?.code === 1000) {
          setConnectionStatus("closed");
          return;
        }

        setConnectionStatus("closed");
        reconnectAttemptsRef.current += 1;
        const nextDelay = Math.min(5000, 1000 * 2 ** Math.min(reconnectAttemptsRef.current, 3));
        reconnectTimerRef.current = setTimeout(connect, nextDelay);
      };
    };

    connect();

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && socketRef.current?.readyState === WebSocket.OPEN) {
        sendReadReceipt();
      }
    });

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      closeSocket();
    };
  }, [active, currentUserId, service?.status, serviceId]);

  const sendMessage = async (content) => {
    const normalizedContent = String(content || "").trim();

    if (!normalizedContent) {
      throw new Error("Digite uma mensagem antes de enviar.");
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("Chat desconectado. Aguarde a reconexao para enviar.");
    }

    setIsSending(true);
    setSocketError("");

    try {
      socketRef.current.send(
        JSON.stringify({
          type: CHAT_EVENT_TYPES.MESSAGE,
          service_id: serviceId,
          content: normalizedContent,
        }),
      );
    } finally {
      setIsSending(false);
    }
  };

  const sendLocation = async ({ latitude, longitude }) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("Chat desconectado. Aguarde a reconexao para compartilhar localizacao.");
    }

    const optimisticLocation = {
      userId: currentUserIdRef.current,
      serviceId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      updatedAt: new Date().toISOString(),
      user: usersByIdRef.current[currentUserIdRef.current] || currentUser || {},
    };

    if (optimisticLocation.userId) {
      setLocationsByUserId((currentRegistry) => ({
        ...currentRegistry,
        [optimisticLocation.userId]: optimisticLocation,
      }));
    }

    socketRef.current.send(
      JSON.stringify({
        type: CHAT_EVENT_TYPES.LOCATION,
        service_id: serviceId,
        latitude,
        longitude,
      }),
    );
  };

  const refreshLocations = async () => {
    if (!serviceId) {
      return {};
    }

    const response = await apiFetch(`/locations?service_id=${serviceId}`, {
      authenticated: true,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || "Nao foi possivel atualizar as localizacoes.");
    }

    const nextLocations = Array.isArray(payload?.items)
      ? payload.items.map((location) => normalizeLocation(location, usersByIdRef.current))
      : [];

    const nextRegistry = nextLocations.reduce((registry, location) => {
      if (location?.userId) {
        registry[location.userId] = location;
      }
      return registry;
    }, {});

    setLocationsByUserId(nextRegistry);
    return nextRegistry;
  };

  return {
    currentUser,
    participant,
    messages,
    locationsByUserId,
    isMessagesLoading,
    isSending,
    connectionStatus,
    error,
    socketError,
    onlineUserIds,
    sendMessage,
    sendLocation,
    refreshLocations,
  };
}

export function MobileChatModal({ visible, service, userRole, onClose }) {
  const [draft, setDraft] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [locationState, setLocationState] = useState("idle");
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const scrollRef = useRef(null);
  const locationWatchIdRef = useRef(null);

  const {
    currentUser,
    participant,
    messages,
    locationsByUserId,
    isMessagesLoading,
    isSending,
    connectionStatus,
    error,
    socketError,
    onlineUserIds,
    sendMessage,
    sendLocation,
    refreshLocations,
  } = useMobileServiceChat({ service, userRole, active: visible });

  const participantOnline = participant?.id ? onlineUserIds.includes(participant.id) : false;
  const displayName = participant?.name || "Participante";
  const serviceLabel = service?.ID || service?.id || "-";
  const participantLocation = participant?.id ? locationsByUserId[participant.id] : null;
  const ownLocation = currentUser?.id ? locationsByUserId[currentUser.id] : null;
  const diaristProfile = userRole === "cliente" ? participant : currentUser;
  const clientProfile = userRole === "cliente" ? currentUser : participant;
  const clientAddressPosition = resolveAddressPosition(service?.address || service?.Address);
  const diaristLiveLocation = userRole === "cliente" ? participantLocation : ownLocation;
  const serviceStatus = normalizeStatus(service?.status || service?.Status || "");
  const canShareLiveLocation =
    userRole === "diarista" && !["em servico", "cancelado", "concluido"].includes(serviceStatus);
  const activeParticipantLocation = isFreshLiveLocation(participantLocation) ? participantLocation : null;
  const activeDiaristLocation = isFreshLiveLocation(diaristLiveLocation) ? diaristLiveLocation : null;
  const canRequestLiveLocation = userRole === "cliente" && !activeParticipantLocation;
  const hasSharedLiveLocation =
    userRole === "diarista" ? Boolean(activeDiaristLocation) || locationState === "sharing" : Boolean(activeParticipantLocation);
  const displayChatError = useMemo(() => {
    const candidate = error || socketError || submitError;
    return isDuplicateLocationConstraintError(candidate) ? "" : candidate;
  }, [error, socketError, submitError]);
  const locationMarkers = useMemo(
    () =>
      [
        clientAddressPosition && {
          id: `client-${clientProfile?.id || "service-client"}`,
          name: clientProfile?.name || "Cliente",
          label: "Cliente",
          statusText: "Endereco do servico",
          photo: clientProfile?.photo || "",
          accentColor: "#0f766e",
          latitude: clientAddressPosition.latitude,
          longitude: clientAddressPosition.longitude,
        },
        activeDiaristLocation && {
          id: `diarist-${diaristProfile?.id || "service-diarist"}`,
          name: diaristProfile?.name || "Diarista",
          label: "Diarista",
          statusText: `Atualizado em ${formatLocationStatusTime(activeDiaristLocation.updatedAt)}`,
          photo: diaristProfile?.photo || "",
          accentColor: "#1d4ed8",
          latitude: activeDiaristLocation.latitude,
          longitude: activeDiaristLocation.longitude,
        },
      ].filter(Boolean),
    [activeDiaristLocation, clientAddressPosition, clientProfile, diaristProfile],
  );
  const timelineItems = useMemo(() => {
    const items = messages.map((message) => ({ type: "message", sortAt: message?.createdAt || "", data: message }));

    if (activeDiaristLocation) {
      items.push({
        type: "location",
        sortAt: activeDiaristLocation.updatedAt || new Date().toISOString(),
        data: {
          id: `location-${activeDiaristLocation.userId || "diarist"}`,
          author: diaristProfile,
          location: activeDiaristLocation,
          title:
            userRole === "cliente"
              ? `${diaristProfile?.name || "A diarista"} compartilhou a localizacao`
              : "Voce compartilhou sua localizacao",
          description:
            userRole === "cliente"
              ? "Toque para acompanhar a diarista no mapa em tempo real. A visualizacao fica disponivel por ate 1 hora."
              : "Toque para visualizar o mapa com o pin da cliente e a sua posicao atual.",
          expiresLabel: formatLocationExpiresIn(activeDiaristLocation.updatedAt),
          isOwn: userRole === "diarista",
        },
      });
    }

    return items.sort((left, right) => {
      const leftDate = new Date(left.sortAt || 0).getTime();
      const rightDate = new Date(right.sortAt || 0).getTime();
      return leftDate - rightDate;
    });
  }, [activeDiaristLocation, diaristProfile, messages, userRole]);

  useEffect(() => {
    if (!visible) {
      setDraft("");
      setSubmitError("");
      setLocationState("idle");
      setIsLocationModalOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (activeDiaristLocation && isDuplicateLocationConstraintError(submitError)) {
      setSubmitError("");
    }
  }, [activeDiaristLocation, submitError]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 60);

    return () => clearTimeout(timeoutId);
  }, [messages.length, visible]);

  useEffect(() => {
    return () => {
      void clearLocationTracking(locationWatchIdRef);
    };
  }, []);

  const handleSend = async () => {
    setSubmitError("");

    try {
      await sendMessage(draft);
      setDraft("");
    } catch (sendError) {
      setSubmitError(sendError.message || "Nao foi possivel enviar a mensagem.");
    }
  };

  const handleRequestLocation = async () => {
    setSubmitError("");
    setIsRequestingLocation(true);

    try {
      await sendMessage(LOCATION_REQUEST_MESSAGE);
    } catch (requestError) {
      setSubmitError(requestError.message || "Nao foi possivel solicitar a localizacao.");
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleShareLocation = async () => {
    setSubmitError("");

    if (locationState === "sharing") {
      void clearLocationTracking(locationWatchIdRef);
      setLocationState("idle");
      return;
    }

    if (locationsByUserId[currentUser?.id]) {
      setLocationState("sharing");
      setSubmitError("");
      return;
    }

    setLocationState("sending");

    const handleLocationSuccess = async (coords) => {
      try {
        await sendLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setLocationState("sharing");
      } catch (locationError) {
        const normalizedError = String(locationError?.message || "");
        if (
          normalizedError.toLowerCase().includes("duplicate key") ||
          normalizedError.toLowerCase().includes("chat_locations_pkey")
        ) {
          try {
            const refreshedLocations = await refreshLocations();
            const currentUserLocation = currentUser?.id ? refreshedLocations[currentUser.id] : null;
            if (currentUserLocation) {
              setLocationState("sharing");
              setSubmitError("");
              return;
            }
          } catch (_refreshError) {
          }
        }

        setSubmitError(locationError.message || "Nao foi possivel compartilhar a localizacao.");
        setLocationState("idle");
      }
    };

    const handleLocationError = (geoError) => {
      setSubmitError(geoError?.message || "Nao foi possivel obter sua localizacao.");
      setLocationState("idle");
    };

    if (isNativePlatform) {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          setSubmitError("Permita o acesso a localizacao para compartilhar em tempo real.");
          setLocationState("idle");
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        try {
          await handleLocationSuccess(currentPosition.coords);
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Highest,
              timeInterval: 15000,
              distanceInterval: 50,
            },
            async (position) => {
              await handleLocationSuccess(position.coords);
            },
          );
          locationWatchIdRef.current = {
            kind: "native",
            value: subscription,
          };
        } catch (nativeError) {
          handleLocationError(nativeError);
        }
      } catch (permissionError) {
        handleLocationError(permissionError);
      }
      return;
    }

    if (!navigator?.geolocation) {
      setSubmitError("Geolocalizacao nao esta disponivel neste ambiente.");
      setLocationState("idle");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await handleLocationSuccess(position.coords);
      },
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );
  };

  const handleOpenMap = async () => {
    const targetLocation = activeDiaristLocation || activeParticipantLocation || ownLocation || participantLocation;

    if (!targetLocation?.latitude || !targetLocation?.longitude) {
      setSubmitError("Nenhuma localizacao disponivel ainda.");
      return;
    }

    setIsLocationModalOpen(true);
  };

  const handleOpenExternalMap = async () => {
    const targetLocation = activeDiaristLocation || activeParticipantLocation || ownLocation || participantLocation;

    if (!targetLocation?.latitude || !targetLocation?.longitude) {
      setSubmitError("Nenhuma localizacao disponivel ainda.");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${targetLocation.latitude},${targetLocation.longitude}`;

    try {
      await Linking.openURL(url);
    } catch (_error) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      setSubmitError("Nao foi possivel abrir o mapa.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderMain}>
              <ChatAvatar profile={participant} size={48} />
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{displayName}</Text>
                <Text style={styles.modalSubtitle}>Servico #{serviceLabel}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={18} color={palette.ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.connectionBadge}>
              <Text style={styles.connectionBadgeText}>
                {CONNECTION_LABELS[connectionStatus] || CONNECTION_LABELS.idle}
              </Text>
            </View>
            <View style={[styles.presenceBadge, participantOnline && styles.presenceBadgeOnline]}>
              <View
                style={[
                  styles.presenceDot,
                  participantOnline ? styles.presenceDotOnline : styles.presenceDotOffline,
                ]}
              />
              <Text style={[styles.presenceText, participantOnline && styles.presenceTextOnline]}>
                {participantOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>

          {(canShareLiveLocation || canRequestLiveLocation) && (
            <View style={styles.locationActions}>
              {canShareLiveLocation ? (
                <TouchableOpacity style={styles.locationActionButton} onPress={handleShareLocation}>
                  <Feather name="navigation" size={14} color={palette.accent} />
                  <Text style={styles.locationActionText}>
                    {locationState === "sending"
                      ? "Iniciando..."
                      : locationState === "sharing"
                        ? "Parar localizacao"
                        : "Compartilhar localizacao"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {canRequestLiveLocation ? (
                <TouchableOpacity
                  style={styles.locationActionButton}
                  onPress={handleRequestLocation}
                  disabled={isRequestingLocation}
                >
                  <Feather name="map-pin" size={14} color={palette.accent} />
                  <Text style={styles.locationActionText}>
                    {isRequestingLocation ? "Solicitando..." : "Solicitar localizacao"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {displayChatError ? (
            <View style={styles.chatAlert}>
              <Text style={styles.chatAlertText}>{displayChatError}</Text>
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {isMessagesLoading ? (
              <View style={styles.loadingShell}>
                <ActivityIndicator color={palette.accent} />
                <Text style={styles.loadingCopy}>Carregando conversa...</Text>
              </View>
            ) : timelineItems.length === 0 ? (
              <View style={styles.emptyShell}>
                <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
                <Text style={styles.emptyCopy}>
                  Use o campo abaixo para iniciar a conversa em tempo real.
                </Text>
              </View>
            ) : (
              timelineItems.map((entry, index) => {
                if (entry.type === "location") {
                  const locationItem = entry.data;
                  return (
                    <ChatLiveLocationCard
                      key={locationItem.id || `location-${index}`}
                      item={locationItem}
                      isOwn={Boolean(locationItem.isOwn)}
                      onPress={handleOpenMap}
                    />
                  );
                }

                const message = entry.data;
                const isOwnMessage = Number(message?.senderId || 0) === Number(currentUser?.id || 0);
                const messageKey = message?.id || `${message?.createdAt || "msg"}-${index}`;
                const author = isOwnMessage ? currentUser : participant;

                return (
                  <View key={messageKey} style={[styles.messageRow, isOwnMessage && styles.messageRowOwn]}>
                    {!isOwnMessage ? <ChatAvatar profile={author} size={34} /> : null}
                    <View style={[styles.messageBubble, isOwnMessage && styles.messageBubbleOwn]}>
                      <Text style={[styles.messageAuthor, isOwnMessage && styles.messageAuthorOwn]}>
                        {author?.name || (isOwnMessage ? "Voce" : "Participante")}
                      </Text>
                      <Text style={[styles.messageContent, isOwnMessage && styles.messageContentOwn]}>
                        {message?.content || ""}
                      </Text>
                      <Text style={[styles.messageMeta, isOwnMessage && styles.messageMetaOwn]}>
                        {formatMessageTime(message?.createdAt)}
                        {typeof message?.read === "boolean" ? ` | ${message.read ? "Lida" : "Enviada"}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.composerShell}>
            <TextInput
              style={styles.composerInput}
              multiline
              value={draft}
              onChangeText={setDraft}
              placeholder="Digite uma mensagem"
              placeholderTextColor="#9ca3af"
              editable={!isSending}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Feather name="send" size={16} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <LiveLocationMapModal
        visible={isLocationModalOpen}
        markers={locationMarkers}
        onClose={() => setIsLocationModalOpen(false)}
        onOpenExternalMap={handleOpenExternalMap}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Platform.OS === "web" ? "88%" : "92%",
    minHeight: "72%",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.9)",
  },
  modalHeaderMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  connectionBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  connectionBadgeText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "700",
  },
  presenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presenceBadgeOnline: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceDotOnline: {
    backgroundColor: palette.success,
  },
  presenceDotOffline: {
    backgroundColor: "#9ca3af",
  },
  presenceText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  presenceTextOnline: {
    color: "#15803d",
  },
  locationActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  locationActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  locationActionText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  chatAlert: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  chatAlertText: {
    color: "#b91c1c",
    fontSize: 13,
    lineHeight: 18,
  },
  messagesScroll: {
    flex: 1,
    minHeight: 0,
  },
  messagesContent: {
    paddingTop: 4,
    paddingBottom: 18,
    paddingHorizontal: 6,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    borderRadius: 24,
    backgroundColor: "#f8fbff",
  },
  loadingShell: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 10,
  },
  loadingCopy: {
    color: palette.muted,
    fontSize: 13,
  },
  emptyShell: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 12,
    gap: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 18,
    backgroundColor: "#f8fafc",
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "82%",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.95)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  messageBubbleOwn: {
    backgroundColor: "#1d4ed8",
    borderColor: "rgba(37,99,235,0.12)",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 8,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  messageAuthor: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  messageAuthorOwn: {
    color: "#ffffff",
  },
  messageContent: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  messageContentOwn: {
    color: "#ffffff",
  },
  messageMeta: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 9,
  },
  messageMetaOwn: {
    color: "rgba(255,255,255,0.78)",
  },
  locationMessageCard: {
    maxWidth: "84%",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  locationMessageCardOwn: {
    backgroundColor: "#1d4ed8",
    borderColor: "rgba(255,255,255,0.18)",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 8,
  },
  locationMessageHeader: {
    gap: 8,
    marginBottom: 8,
  },
  locationMessageTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationMessageTitle: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
  },
  locationMessageTitleOwn: {
    color: "#ffffff",
  },
  locationMessageExpiry: {
    color: "#1e40af",
    fontSize: 11,
    fontWeight: "800",
  },
  locationMessageExpiryOwn: {
    color: "rgba(255,255,255,0.86)",
  },
  locationMessageBody: {
    color: "#1e293b",
    fontSize: 14,
    lineHeight: 20,
  },
  locationMessageBodyOwn: {
    color: "#ffffff",
  },
  locationMessageFooter: {
    marginTop: 12,
    gap: 8,
  },
  locationMessageMeta: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  locationMessageMetaOwn: {
    color: "rgba(255,255,255,0.76)",
  },
  locationMessageCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationMessageCtaOwn: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  locationMessageCtaText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  locationMessageCtaTextOwn: {
    color: "#ffffff",
  },
  composerShell: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 26,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 10,
    color: palette.ink,
    fontSize: 15,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  avatarShell: {
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#2563eb",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  avatarFallback: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: "800",
  },
  liveMapBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    justifyContent: "center",
    padding: 18,
  },
  liveMapPanel: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 14,
  },
  liveMapHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  liveMapTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  liveMapCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  liveMapClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f7",
  },
  liveMapCanvas: {
    height: 310,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    position: "relative",
  },
  liveMapLegend: {
    gap: 10,
  },
  liveMapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveMapLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  liveMapLegendTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  liveMapLegendCopy: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  liveMapActions: {
    gap: 10,
  },
  liveMapPrimaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  liveMapPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  liveMapSecondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  liveMapSecondaryButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
});

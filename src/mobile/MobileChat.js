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
import { apiFetch } from "../config/api";
import { createAuthenticatedWebSocket } from "../config/realtime";

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
            ? messagesPayload.items.map((message) => normalizeMessage(message, usersById))
            : [];
          const nextLocations = Array.isArray(locationsPayload?.items)
            ? locationsPayload.items.map((location) => normalizeLocation(location, usersById))
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
  }, [active, service?.status, serviceId, usersById]);

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
              const nextMessage = normalizeMessage(parsedEvent, usersById);
              setMessages((currentMessages) => upsertMessages(currentMessages, [nextMessage]));
              if (nextMessage.senderId && nextMessage.senderId !== currentUser?.id) {
                sendReadReceipt();
              }
              break;
            }

            case CHAT_EVENT_TYPES.READ:
              setMessages((currentMessages) => markMessagesAsRead(currentMessages, parsedEvent?.message_ids));
              break;

            case CHAT_EVENT_TYPES.LOCATION: {
              const nextLocation = normalizeLocation(parsedEvent, usersById);
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

            case CHAT_EVENT_TYPES.ERROR:
              setSocketError(parsedEvent?.error || "Erro ao processar evento do chat.");
              break;

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
  }, [active, currentUser?.id, service?.status, serviceId, usersById]);

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

    socketRef.current.send(
      JSON.stringify({
        type: CHAT_EVENT_TYPES.LOCATION,
        service_id: serviceId,
        latitude,
        longitude,
      }),
    );
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
  };
}

export function MobileChatModal({ visible, service, userRole, onClose }) {
  const [draft, setDraft] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [locationState, setLocationState] = useState("idle");
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
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
  } = useMobileServiceChat({ service, userRole, active: visible });

  const participantOnline = participant?.id ? onlineUserIds.includes(participant.id) : false;
  const displayName = participant?.name || "Participante";
  const serviceLabel = service?.ID || service?.id || "-";
  const participantLocation = participant?.id ? locationsByUserId[participant.id] : null;
  const ownLocation = currentUser?.id ? locationsByUserId[currentUser.id] : null;
  const serviceStatus = normalizeStatus(service?.status || service?.Status || "");
  const canShareLiveLocation =
    userRole === "diarista" && !["em servico", "cancelado", "concluido"].includes(serviceStatus);
  const canRequestLiveLocation = userRole === "cliente" && !participantLocation;
  const hasSharedLiveLocation =
    userRole === "diarista" ? Boolean(ownLocation) || locationState === "sharing" : Boolean(participantLocation);

  useEffect(() => {
    if (!visible) {
      setDraft("");
      setSubmitError("");
      setLocationState("idle");
    }
  }, [visible]);

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
      if (locationWatchIdRef.current !== null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
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
    if (!navigator?.geolocation) {
      setSubmitError("Geolocalizacao nao esta disponivel neste ambiente.");
      return;
    }

    setSubmitError("");

    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
      setLocationState("idle");
      return;
    }

    setLocationState("sending");

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await sendLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationState("sharing");
        } catch (locationError) {
          setSubmitError(locationError.message || "Nao foi possivel compartilhar a localizacao.");
          setLocationState("idle");
        }
      },
      (geoError) => {
        setSubmitError(geoError.message || "Nao foi possivel obter sua localizacao.");
        setLocationState("idle");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );
  };

  const handleOpenMap = async () => {
    const targetLocation = userRole === "cliente" ? participantLocation : ownLocation || participantLocation;

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

          {(canShareLiveLocation || canRequestLiveLocation || hasSharedLiveLocation) && (
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

              {hasSharedLiveLocation ? (
                <TouchableOpacity style={styles.locationActionButton} onPress={handleOpenMap}>
                  <Feather name="external-link" size={14} color={palette.accent} />
                  <Text style={styles.locationActionText}>Abrir mapa</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {error || socketError || submitError ? (
            <View style={styles.chatAlert}>
              <Text style={styles.chatAlertText}>{error || socketError || submitError}</Text>
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
            ) : messages.length === 0 ? (
              <View style={styles.emptyShell}>
                <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
                <Text style={styles.emptyCopy}>
                  Use o campo abaixo para iniciar a conversa em tempo real.
                </Text>
              </View>
            ) : (
              messages.map((message, index) => {
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
});

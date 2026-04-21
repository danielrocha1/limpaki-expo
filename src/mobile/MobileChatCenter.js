import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../config/api";
import { MobileChatModal, useMobileServiceChat } from "./MobileChat";

const MobileChatCenterContext = createContext(null);
const CHAT_SEEN_STORAGE_KEY = "mobile_chat_seen_by_service";
const CHAT_POLL_INTERVAL_MS = 5000;
const PRESENCE_POLL_INTERVAL_MS = 15000;
const FLOATING_BUTTON_SIZE = 56;
const FLOATING_BUTTON_BASE_RIGHT = 20;
const FLOATING_BUTTON_BASE_BOTTOM = 88;
const FLOATING_BUTTON_SCREEN_MARGIN = 8;
const FLOATING_BUTTON_TOP_CLEARANCE = 96;

const palette = {
  bg: "#2f5fe0",
  surface: "#ffffff",
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  accentAlt: "#fbbf24",
  border: "#d9dee8",
};

const normalizeStatus = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isChatAvailable = (service) => {
  const status = normalizeStatus(service?.status || service?.Status || "");
  return status !== "cancelado" && status !== "concluido" && status !== "em servico";
};

const getStorage = () => {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    return {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => window.localStorage.setItem(key, value),
    };
  }

  return AsyncStorage;
};

const readSeenRegistry = async () => {
  try {
    const raw = await getStorage().getItem(CHAT_SEEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
};

const writeSeenRegistry = async (registry) => {
  try {
    await getStorage().setItem(CHAT_SEEN_STORAGE_KEY, JSON.stringify(registry));
  } catch (_error) {
  }
};

const getCounterpart = (service, userRole) =>
  userRole === "cliente" ? service?.diarist || {} : service?.client || {};

const getCounterpartId = (service, userRole) =>
  Number(
    userRole === "cliente"
      ? service?.diarist_id || service?.diarist?.ID || service?.diarist?.id || 0
      : service?.client_id || service?.client?.ID || service?.client?.id || 0,
  ) || null;

const getCounterpartName = (service, userRole) => {
  const user = getCounterpart(service, userRole);
  return user?.name || user?.Name || (userRole === "cliente" ? "Diarista" : "Cliente");
};

const getCounterpartPhoto = (service, userRole) => {
  const user = getCounterpart(service, userRole);
  return (
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
    ""
  );
};

function WarmupChatItem({ service, userRole }) {
  useMobileServiceChat({ service, userRole, active: true });
  return null;
}

export function MobileChatCenterProvider({ session, children }) {
  const [activeChatService, setActiveChatService] = useState(null);
  const [activeChatServices, setActiveChatServices] = useState([]);
  const [chatSummaries, setChatSummaries] = useState([]);
  const [onlineClientIds, setOnlineClientIds] = useState([]);
  const [onlineDiaristIds, setOnlineDiaristIds] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeChatServiceId = Number(activeChatService?.ID ?? activeChatService?.id ?? 0) || null;

  const markServiceAsSeen = async (serviceId, messageTimestamp = null) => {
    if (!serviceId) {
      return;
    }

    const registry = await readSeenRegistry();
    registry[String(serviceId)] = messageTimestamp || new Date().toISOString();
    await writeSeenRegistry(registry);
  };

  const refreshActiveChats = async () => {
    if (!session?.token) {
      setActiveChatServices([]);
      setChatSummaries([]);
      return;
    }

    try {
      const response = await apiFetch("/services/my?page=1&page_size=100", {
        authenticated: true,
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const services = Array.isArray(payload?.items) ? payload.items : [];
      const filteredServices = services.filter(isChatAvailable);
      const seenRegistry = await readSeenRegistry();

      const summaries = await Promise.all(
        filteredServices.map(async (service) => {
          const serviceId = Number(service?.ID ?? service?.id ?? 0) || null;
          if (!serviceId) {
            return { service, unreadCount: 0, lastMessage: null };
          }

          const messagesResponse = await apiFetch(
            `/messages?service_id=${serviceId}&page=1&page_size=20`,
            { authenticated: true },
          );

          if (!messagesResponse.ok) {
            return { service, unreadCount: 0, lastMessage: null };
          }

          const messagesPayload = await messagesResponse.json().catch(() => ({}));
          const messages = Array.isArray(messagesPayload?.items) ? messagesPayload.items : [];
          const lastMessage = messages[messages.length - 1] || null;
          const seenAt = seenRegistry[String(serviceId)];
          const unreadCount = messages.filter((message) => {
            const senderId = Number(message?.sender_id ?? message?.senderId ?? message?.SenderID ?? 0);
            const counterpartId = getCounterpartId(service, session.role);
            const createdAt = message?.created_at || message?.createdAt || message?.CreatedAt;

            if (!createdAt || !counterpartId || senderId !== counterpartId) {
              return false;
            }

            return !seenAt || new Date(createdAt).getTime() > new Date(seenAt).getTime();
          }).length;

          return {
            service,
            unreadCount:
              activeChatServiceId && activeChatServiceId === serviceId ? 0 : unreadCount,
            lastMessage,
          };
        }),
      );

      setActiveChatServices(filteredServices);
      setChatSummaries(summaries);
    } catch (_error) {
    }
  };

  const refreshPresence = async () => {
    if (!session?.token) {
      setOnlineClientIds([]);
      setOnlineDiaristIds([]);
      return;
    }

    try {
      const [clientsResponse, diaristsResponse] = await Promise.all([
        apiFetch("/realtime/online-users?role=cliente", { authenticated: true }),
        apiFetch("/realtime/online-users?role=diarista", { authenticated: true }),
      ]);

      const clientsPayload = clientsResponse.ok ? await clientsResponse.json().catch(() => ({})) : {};
      const diaristsPayload = diaristsResponse.ok ? await diaristsResponse.json().catch(() => ({})) : {};

      setOnlineClientIds(
        Array.isArray(clientsPayload?.user_ids)
          ? clientsPayload.user_ids.map((value) => Number(value)).filter(Boolean)
          : [],
      );
      setOnlineDiaristIds(
        Array.isArray(diaristsPayload?.user_ids)
          ? diaristsPayload.user_ids.map((value) => Number(value)).filter(Boolean)
          : [],
      );
    } catch (_error) {
    }
  };

  useEffect(() => {
    void refreshActiveChats();
    void refreshPresence();

    const chatsInterval = setInterval(() => {
      void refreshActiveChats();
    }, CHAT_POLL_INTERVAL_MS);

    const presenceInterval = setInterval(() => {
      void refreshPresence();
    }, PRESENCE_POLL_INTERVAL_MS);

    return () => {
      clearInterval(chatsInterval);
      clearInterval(presenceInterval);
    };
  }, [session?.token, session?.role, activeChatServiceId]);

  useEffect(() => {
    if (!activeChatServiceId) {
      return;
    }

    const activeSummary = chatSummaries.find((summary) => {
      const summaryServiceId = Number(summary?.service?.ID ?? summary?.service?.id ?? 0) || null;
      return summaryServiceId === activeChatServiceId;
    });

    if (activeSummary?.lastMessage) {
      void markServiceAsSeen(
        activeChatServiceId,
        activeSummary.lastMessage?.created_at ||
          activeSummary.lastMessage?.createdAt ||
          activeSummary.lastMessage?.CreatedAt ||
          null,
      );
    }
  }, [activeChatServiceId, chatSummaries]);

  const openChat = (service) => {
    if (!service || !isChatAvailable(service)) {
      return;
    }

    setActiveChatService(service);
    setIsMenuOpen(false);
    const serviceId = Number(service?.ID ?? service?.id ?? 0) || null;
    if (serviceId) {
      void markServiceAsSeen(serviceId);
      setChatSummaries((currentSummaries) =>
        currentSummaries.map((summary) => {
          const summaryServiceId = Number(summary?.service?.ID ?? summary?.service?.id ?? 0) || null;
          return summaryServiceId === serviceId ? { ...summary, unreadCount: 0 } : summary;
        }),
      );
    }
  };

  const closeChat = () => {
    setActiveChatService(null);
  };

  const totalUnreadCount = useMemo(
    () => chatSummaries.reduce((total, summary) => total + Number(summary?.unreadCount || 0), 0),
    [chatSummaries],
  );

  const isClientOnline = (userId) => onlineClientIds.includes(Number(userId));
  const isDiaristOnline = (userId) => onlineDiaristIds.includes(Number(userId));

  const value = useMemo(
    () => ({
      activeChatService,
      activeChatServices,
      chatSummaries,
      closeChat,
      isClientOnline,
      isDiaristOnline,
      isMenuOpen,
      markServiceAsSeen,
      openChat,
      refreshActiveChats,
      setIsMenuOpen,
      totalUnreadCount,
    }),
    [activeChatService, activeChatServices, chatSummaries, isMenuOpen, totalUnreadCount],
  );

  return (
    <MobileChatCenterContext.Provider value={value}>
      {children}

      {activeChatServices
        .filter((service) => {
          const serviceId = Number(service?.ID ?? service?.id ?? 0) || null;
          return serviceId && serviceId !== activeChatServiceId;
        })
        .map((service) => {
          const serviceId = Number(service?.ID ?? service?.id ?? 0) || null;
          return <WarmupChatItem key={serviceId} service={service} userRole={session.role} />;
        })}

      <MobileChatFloatingButton session={session} />
      <MobileChatModal
        visible={Boolean(activeChatService)}
        service={activeChatService}
        userRole={session.role}
        onClose={closeChat}
      />
    </MobileChatCenterContext.Provider>
  );
}

export function useMobileChatCenter() {
  const context = useContext(MobileChatCenterContext);
  if (!context) {
    throw new Error("useMobileChatCenter deve ser usado dentro de MobileChatCenterProvider");
  }
  return context;
}

function MobileChatFloatingButton({ session }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const {
    activeChatServices,
    chatSummaries,
    isClientOnline,
    isDiaristOnline,
    isMenuOpen,
    openChat,
    setIsMenuOpen,
    totalUnreadCount,
  } = useMobileChatCenter();
  const ringRotation = React.useRef(new Animated.Value(0)).current;
  const dragPosition = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragOffsetRef = React.useRef({ x: 0, y: 0 });
  const dragDistanceRef = React.useRef(0);

  const minTranslateX = -Math.max(
    0,
    screenWidth -
      FLOATING_BUTTON_SIZE -
      FLOATING_BUTTON_BASE_RIGHT -
      FLOATING_BUTTON_SCREEN_MARGIN,
  );
  const maxTranslateX = 0;
  const minTranslateY = -Math.max(
    0,
    screenHeight -
      FLOATING_BUTTON_SIZE -
      FLOATING_BUTTON_BASE_BOTTOM -
      FLOATING_BUTTON_TOP_CLEARANCE,
  );
  const maxTranslateY = 0;

  const clampOffset = React.useCallback(
    (x, y) => ({
      x: Math.min(maxTranslateX, Math.max(minTranslateX, Number(x || 0))),
      y: Math.min(maxTranslateY, Math.max(minTranslateY, Number(y || 0))),
    }),
    [maxTranslateX, minTranslateX, maxTranslateY, minTranslateY],
  );

  const animateToOffset = React.useCallback(
    (x, y) => {
      const nextOffset = clampOffset(x, y);
      dragOffsetRef.current = nextOffset;
      Animated.spring(dragPosition, {
        toValue: nextOffset,
        useNativeDriver: Platform.OS !== "web",
        tension: 120,
        friction: 11,
      }).start();
    },
    [clampOffset, dragPosition],
  );

  useEffect(() => {
    const clampedOffset = clampOffset(dragOffsetRef.current.x, dragOffsetRef.current.y);

    if (
      clampedOffset.x !== dragOffsetRef.current.x ||
      clampedOffset.y !== dragOffsetRef.current.y
    ) {
      dragOffsetRef.current = clampedOffset;
      dragPosition.setValue(clampedOffset);
    }
  }, [clampOffset, dragPosition]);

  useEffect(() => {
    let cancelled = false;

    const spin = () => {
      ringRotation.setValue(0);
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 9000,
        useNativeDriver: Platform.OS !== "web",
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          spin();
        }
      });
    };

    spin();

    return () => {
      cancelled = true;
      ringRotation.stopAnimation();
      ringRotation.setValue(0);
    };
  }, [ringRotation]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Platform.OS !== "web" &&
          (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4),
        onPanResponderGrant: () => {
          dragDistanceRef.current = 0;
          dragPosition.stopAnimation((currentValue) => {
            dragOffsetRef.current = clampOffset(currentValue.x, currentValue.y);
            dragPosition.setOffset(dragOffsetRef.current);
            dragPosition.setValue({ x: 0, y: 0 });
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          dragDistanceRef.current = Math.max(
            dragDistanceRef.current,
            Math.abs(gestureState.dx) + Math.abs(gestureState.dy),
          );
          const previewOffset = clampOffset(
            dragOffsetRef.current.x + gestureState.dx,
            dragOffsetRef.current.y + gestureState.dy,
          );
          dragPosition.setValue({
            x: previewOffset.x - dragOffsetRef.current.x,
            y: previewOffset.y - dragOffsetRef.current.y,
          });
        },
        onPanResponderRelease: () => {
          dragPosition.flattenOffset();
          const currentX = dragPosition.x.__getValue();
          const currentY = dragPosition.y.__getValue();
          const middleX = (minTranslateX + maxTranslateX) / 2;
          const snappedX = currentX <= middleX ? minTranslateX : maxTranslateX;
          dragDistanceRef.current = 0;
          animateToOffset(snappedX, currentY);
        },
        onPanResponderTerminate: () => {
          dragPosition.flattenOffset();
          const currentX = dragPosition.x.__getValue();
          const currentY = dragPosition.y.__getValue();
          const middleX = (minTranslateX + maxTranslateX) / 2;
          const snappedX = currentX <= middleX ? minTranslateX : maxTranslateX;
          dragDistanceRef.current = 0;
          animateToOffset(snappedX, currentY);
        },
      }),
    [animateToOffset, clampOffset, dragPosition, maxTranslateX, minTranslateX],
  );

  const summaryByServiceId = useMemo(
    () =>
      new Map(
        (chatSummaries || []).map((summary) => [
          Number(summary?.service?.ID ?? summary?.service?.id ?? 0),
          summary,
        ]),
      ),
    [chatSummaries],
  );

  const items = (activeChatServices || []).map((service) => {
    const serviceId = Number(service?.ID ?? service?.id ?? 0) || null;
    const summary = summaryByServiceId.get(serviceId);
    const counterpartId = getCounterpartId(service, session.role);
    const counterpartOnline =
      session.role === "cliente" ? isDiaristOnline(counterpartId) : isClientOnline(counterpartId);
    const scheduledAt = service?.scheduled_at || service?.ScheduledAt || "";
    const scheduledLabel = scheduledAt
      ? new Date(scheduledAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })
      : "";

    return {
      service,
      serviceId,
      counterpartName: getCounterpartName(service, session.role),
      counterpartPhoto: getCounterpartPhoto(service, session.role),
      counterpartOnline,
      scheduledLabel,
      unreadCount: Number(summary?.unreadCount || 0),
    };
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <Animated.View
        style={[
          styles.floatingButtonWrap,
          {
            transform: dragPosition.getTranslateTransform(),
          },
        ]}
        pointerEvents="box-none"
        {...(Platform.OS !== "web" ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            if (dragDistanceRef.current <= 6) {
              setIsMenuOpen(true);
            }
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floatingButtonRing,
              {
                transform: [
                  {
                    rotate: ringRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.floatingIconWrap}>
            <Feather name="message-circle" size={20} color="#ffffff" />
          </View>
          {totalUnreadCount > 0 ? (
            <View style={styles.floatingBadge}>
              <Text style={styles.floatingBadgeText}>{totalUnreadCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <TouchableOpacity style={styles.menuBackdropTouch} onPress={() => setIsMenuOpen(false)} />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Chats dos seus servicos</Text>

            {items.map((item) => (
              <TouchableOpacity
                key={item.serviceId}
                style={styles.menuItem}
                onPress={() => openChat(item.service)}
              >
                <View style={styles.menuAvatar}>
                  {item.counterpartPhoto ? (
                    <Image source={{ uri: item.counterpartPhoto }} style={styles.menuAvatarImage} />
                  ) : (
                    <Text style={styles.menuAvatarFallback}>
                      {String(item.counterpartName || "?").trim().charAt(0).toUpperCase() || "?"}
                    </Text>
                  )}
                </View>

                <View style={styles.menuCopy}>
                  <Text style={styles.menuEyebrow} numberOfLines={1}>
                    Servico #{item.serviceId}{item.scheduledLabel ? ` • ${item.scheduledLabel}` : ""}
                  </Text>
                  <Text style={styles.menuName} numberOfLines={1}>{item.counterpartName}</Text>
                  <View style={styles.menuPresenceRow}>
                    <View
                      style={[
                        styles.menuPresenceDot,
                        item.counterpartOnline && styles.menuPresenceDotOnline,
                      ]}
                    />
                    <Text style={styles.menuPresenceText}>
                      {item.counterpartOnline ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>

                {item.unreadCount > 0 ? (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{item.unreadCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButtonWrap: {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    right: 20,
    bottom: 88,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
  },
  floatingButtonRing: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ffffff",
    opacity: 1,
    zIndex: 1,
  },
  floatingIconWrap: {
    zIndex: 2,
    elevation: 2,
  },
  floatingButton: {
    width: 56,
    minHeight: 56,
    minWidth: 56,
    borderRadius: 999,
    backgroundColor: "#12213f",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    zIndex: 90,
    overflow: "hidden",
  },
  floatingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.accentAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    zIndex: 3,
    elevation: 3,
  },
  floatingBadgeText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    justifyContent: "flex-end",
  },
  menuBackdropTouch: {
    flex: 1,
  },
  menuSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 10,
    maxHeight: "70%",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
  },
  menuHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 6,
  },
  menuTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  menuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  menuAvatarImage: {
    width: "100%",
    height: "100%",
  },
  menuAvatarFallback: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: "800",
  },
  menuCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  menuEyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  menuName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  menuPresenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  menuPresenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9ca3af",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  menuPresenceDotOnline: {
    backgroundColor: "#10b981",
  },
  menuPresenceText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  menuBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.accentAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
  },
});

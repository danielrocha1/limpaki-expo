import React, { useMemo, useState } from "react";
import { MessageOutlined } from "@ant-design/icons";
import { useChatCenter } from "../../context/chatCenter";
import { useAddress } from "../../context/address";
import { useOnlinePresence } from "../../context/onlinePresence";

const getUserPhoto = (user = {}) => (
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

const getInitials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const getChatCounterpartName = (service, userRole) => {
  if (userRole === "cliente") {
    return (
      service?.diarist?.name ||
      service?.diarist?.Name ||
      service?.diarist_name ||
      service?.diaristName ||
      "Diarista"
    );
  }

  return (
    service?.client?.name ||
    service?.client?.Name ||
    service?.client_name ||
    service?.clientName ||
    "Cliente"
  );
};

const formatChatScheduledDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
};
const ChatFloatingButton = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { userRole } = useAddress();
  const { isClientOnline, isDiaristOnline } = useOnlinePresence();
  const {
    activeChatServices,
    chatSummaries,
    isChatDrawerOpen,
    openChat,
    totalUnreadCount,
  } = useChatCenter();

  const mobileChatItems = useMemo(() => {
    const summaryByServiceId = new Map(
      (chatSummaries || []).map((summary) => [
        Number(summary?.service?.ID ?? summary?.service?.id ?? 0),
        summary,
      ]),
    );

    return (activeChatServices || []).map((service) => {
      const serviceId = Number(service?.ID ?? service?.id ?? 0);
      const summary = summaryByServiceId.get(serviceId);
      const counterpartName = getChatCounterpartName(service, userRole);
      const counterpartUser = userRole === "cliente" ? service?.diarist : service?.client;
      const counterpartId =
        userRole === "cliente"
          ? service?.diarist_id || service?.diarist?.ID || service?.diarist?.id
          : service?.client_id || service?.ClientID || service?.client?.ID || service?.client?.id;
      const counterpartOnline =
        userRole === "cliente"
          ? isDiaristOnline(counterpartId)
          : isClientOnline(counterpartId);
      const counterpartStatusLabel =
        userRole === "cliente"
          ? (counterpartOnline ? "Diarista online" : "Diarista offline")
          : (counterpartOnline ? "Cliente online" : "Cliente offline");

      return {
        service,
        serviceId,
        counterpartName,
        counterpartPhoto: getUserPhoto(counterpartUser),
        counterpartInitials: getInitials(counterpartName),
        counterpartOnline,
        counterpartStatusLabel,
        scheduledLabel: formatChatScheduledDate(service?.scheduled_at || service?.ScheduledAt),
        unreadCount: Number(summary?.unreadCount || 0),
      };
    });
  }, [activeChatServices, chatSummaries, isClientOnline, isDiaristOnline, userRole]);

  if (isChatDrawerOpen || mobileChatItems.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="mobile-chat-floating-btn"
        onClick={() => setIsMenuOpen(true)}
        aria-label="Abrir menu de chats"
        title="Abrir menu de chats"
      >
        <MessageOutlined />
        <span>Chat</span>
        {totalUnreadCount > 0 && (
          <span className="mobile-chat-floating-badge">{totalUnreadCount}</span>
        )}
      </button>

      {isMenuOpen && (
        <div className="mobile-chat-menu-backdrop" onClick={() => setIsMenuOpen(false)}>
          <div className="mobile-chat-menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-chat-menu-handle" />
          <div className="mobile-chat-menu-title">{"Chats dos seus servi\u00e7os"}</div>

            <div className="mobile-chat-menu-list">
              {mobileChatItems.map((item) => (
                <button
                  key={item.serviceId}
                  type="button"
                  className="header-chat-menu-item mobile-chat-menu-item"
                  onClick={() => {
                    openChat(item.service);
                    setIsMenuOpen(false);
                  }}
                >
                  <div className="mobile-chat-menu-avatar" aria-hidden="true">
                    {item.counterpartPhoto ? (
                      <img src={item.counterpartPhoto} alt={item.counterpartName} />
                    ) : (
                      <span>{item.counterpartInitials}</span>
                    )}
                  </div>

                  <div className="header-chat-menu-copy mobile-chat-menu-copy">
                    <span>
                      Serviço #{item.serviceId}
                      {item.scheduledLabel ? ` • ${item.scheduledLabel}` : ""}
                    </span>
                    <strong>{item.counterpartName}</strong>
                    <span
                      className={`mobile-chat-menu-status ${item.counterpartOnline ? "is-online" : "is-offline"}`}
                    >
                      <span className="mobile-chat-menu-status-dot" aria-hidden="true" />
                      {item.counterpartStatusLabel}
                    </span>
                  </div>

                  {item.unreadCount > 0 && (
                    <span className="header-chat-item-badge">{item.unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(ChatFloatingButton);

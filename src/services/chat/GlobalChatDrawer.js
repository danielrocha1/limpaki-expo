import React from "react";
import { createPortal } from "react-dom";
import ServiceChatPanel from "./ServiceChatPanel";
import { useChatCenter } from "../../context/chatCenter";
import "../services.css";

const resolveProfile = (user, fallbackName) => ({
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

const ParticipantAvatar = ({ profile, className = "" }) => (
  <div className={`global-chat-drawer-participant-avatar ${className}`.trim()}>
    {profile?.photo ? (
      <img src={profile.photo} alt={profile.name} />
    ) : (
      <span>{String(profile?.name || "?").trim().charAt(0).toUpperCase() || "?"}</span>
    )}
  </div>
);

const formatServiceReference = (service) => {
  const serviceId = Number(service?.ID ?? service?.id ?? 0);
  const serviceDate = service?.scheduled_at || service?.scheduledAt || service?.date;

  if (!serviceId) {
    return "";
  }

  if (!serviceDate) {
    return `#${serviceId}`;
  }

  const parsedDate = new Date(serviceDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return `#${serviceId}`;
  }

  return `#${serviceId} - ${parsedDate.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const GlobalChatDrawer = () => {
  const { activeChatService, closeChat, isChatDrawerOpen } = useChatCenter();

  if (!isChatDrawerOpen || !activeChatService) {
    return null;
  }

  const clientProfile = resolveProfile(activeChatService.client, "Cliente");
  const diaristProfile = resolveProfile(activeChatService.diarist, "Diarista");
  const counterpartName = diaristProfile.name || clientProfile.name || "Participante";
  const serviceReference = formatServiceReference(activeChatService);

  const drawer = (
    <div className="global-chat-drawer-backdrop" onClick={closeChat}>
      <aside className="global-chat-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="global-chat-drawer-header">
          <div className="global-chat-drawer-header-main">
            <div className="global-chat-drawer-participants">
              <div className="global-chat-drawer-avatar-stack" aria-hidden="true">
                <ParticipantAvatar profile={clientProfile} className="is-client" />
                <ParticipantAvatar profile={diaristProfile} className="is-diarist" />
              </div>

              <div>
                <strong>{counterpartName}</strong>
                <span>
              {serviceReference || "Conversa do serviço"}
                </span>
              </div>
            </div>
          </div>

          <button className="modal-close-btn" onClick={closeChat}>
            {"\u2715"}
          </button>
        </div>

        <div className="global-chat-drawer-body">
          <ServiceChatPanel service={activeChatService} />
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
};

export default React.memo(GlobalChatDrawer);

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AimOutlined, PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import { useAddress } from "../../context/address";
import { getCurrentUserId } from "../../config/api";
import { useServiceChat } from "./useServiceChat";
import LiveLocationMapModal from "./LiveLocationMapModal";

const CONNECTION_LABELS = {
  idle: "Inicializando",
  connecting: "Conectando...",
  connected: "Conectado em tempo real",
  closed: "Reconectando...",
  error: "Conexão instável",
};
const LOCATION_REQUEST_MESSAGE = "Pode habilitar sua localização em tempo real no chat, por favor?";

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

const formatLocationTime = (value) => {
  if (!value) {
    return "Sem compartilhamento ainda";
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

const normalizeStatus = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const resolveUserProfile = (service, userRole, side) => {
  const source =
    side === "current"
      ? (userRole === "cliente" ? service?.client : service?.diarist)
      : (userRole === "cliente" ? service?.diarist : service?.client);

  return {
    id: Number(source?.ID ?? source?.id ?? 0) || null,
    name: source?.Name || source?.name || (side === "current" ? "Voce" : "Participante"),
    photo:
      source?.Photo ||
      source?.photo ||
      source?.profile_photo ||
      source?.profilePhoto ||
      source?.profile_picture ||
      source?.profilePicture ||
      source?.image ||
      source?.Image ||
      source?.image_url ||
      source?.imageUrl ||
      source?.Avatar ||
      source?.avatar ||
      "",
  };
};

const resolveAddressPosition = (address) => {
  const latitude = Number(address?.Latitude ?? address?.latitude ?? 0);
  const longitude = Number(address?.Longitude ?? address?.longitude ?? 0);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
    return null;
  }

  return [latitude, longitude];
};

const ChatAvatar = ({ profile, className }) => {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [profile?.photo]);

  return (
    <div className={className}>
      {profile?.photo && !hasImageError ? (
        <img
          src={profile.photo}
          alt={profile.name}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span>{String(profile?.name || "?").trim().charAt(0).toUpperCase() || "?"}</span>
      )}
    </div>
  );
};

const resolveMessageAuthorProfile = (message, currentUserId, currentUser, participant) => {
  const senderId = Number(message?.senderId ?? message?.sender_id ?? message?.SenderID ?? 0);
  const isOwnMessage = senderId === Number(currentUserId);
  const canonicalProfile = isOwnMessage ? currentUser : participant;

  return {
    name:
      canonicalProfile?.name ||
      message?.sender?.name ||
      (isOwnMessage ? "Voce" : "Participante"),
    photo:
      canonicalProfile?.photo ||
      message?.sender?.photo ||
      "",
  };
};

const ServiceChatPanel = ({ service }) => {
  const { userRole } = useAddress();
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const {
    currentUser,
    participant,
    messages,
    isRoomLoading,
    isMessagesLoading,
    isSending,
    connectionStatus,
    error,
    socketError,
    onlineUserIds,
    locationsByUserId,
    sendMessage,
    sendLocation,
  } = useServiceChat(service, userRole);

  const [draft, setDraft] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [locationState, setLocationState] = useState("idle");
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const locationWatchIdRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const participantOnline = participant?.id
    ? onlineUserIds.includes(participant.id)
    : false;
  const clientProfile = resolveUserProfile(service, "diarista", "participant");
  const diaristProfile = resolveUserProfile(service, "cliente", "participant");
  const clientAddressPosition = resolveAddressPosition(service?.address);
  const participantLocation = participant?.id ? locationsByUserId[participant.id] : null;
  const ownLocation = currentUserId ? locationsByUserId[currentUserId] : null;
  const serviceStatus = normalizeStatus(service?.status);
  const canShareLiveLocation = userRole === "diarista" &&
    !["em servico", "cancelado", "concluido"].includes(serviceStatus);
  const canRequestLiveLocation = userRole === "cliente" && !participantLocation;
  const shouldShowLocationCard =
    canShareLiveLocation ||
    canRequestLiveLocation ||
    Boolean(participantLocation) ||
    Boolean(ownLocation);
  const hasSharedLiveLocation = userRole === "diarista"
    ? Boolean(ownLocation) || locationState === "sharing"
    : Boolean(participantLocation);
  const locationMarkers = useMemo(
    () =>
      [
        clientAddressPosition && {
          id: `client-${clientProfile.id || "service-client"}`,
          name: clientProfile.name || "Cliente",
          label: "Cliente",
      statusText: "Endereço do serviço",
          photo: clientProfile.photo,
          accentColor: "#0f766e",
          position: clientAddressPosition,
        },
        ((userRole === "diarista" && ownLocation) || (userRole === "cliente" && participantLocation)) && {
          id: `diarist-${diaristProfile.id || "service-diarist"}`,
          name: diaristProfile.name || "Diarista",
          label: "Diarista",
          statusText: (userRole === "diarista" ? ownLocation?.updatedAt : participantLocation?.updatedAt)
            ? `Atualizado em ${formatLocationTime(
              userRole === "diarista" ? ownLocation.updatedAt : participantLocation.updatedAt,
            )}`
            : "Sem atualizacao recente",
          photo: diaristProfile.photo,
          accentColor: "#1d4ed8",
          position:
            userRole === "diarista"
              ? [ownLocation.latitude, ownLocation.longitude]
              : [participantLocation.latitude, participantLocation.longitude],
        },
      ].filter(Boolean),
    [
      clientAddressPosition,
      clientProfile.id,
      clientProfile.name,
      clientProfile.photo,
      diaristProfile.id,
      diaristProfile.name,
      diaristProfile.photo,
      ownLocation,
      participantLocation,
      userRole,
    ],
  );
  const canOpenLocationMap = userRole === "cliente"
    ? Boolean(participantLocation)
    : locationMarkers.length > 0;
  const shouldShowShareLocationButton = canShareLiveLocation && !hasSharedLiveLocation;
  const shouldShowLocationMapButton = canOpenLocationMap && hasSharedLiveLocation;

  useEffect(() => {
    if (canShareLiveLocation) {
      return undefined;
    }

    if (locationWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }

    setLocationState("idle");
    return undefined;
  }, [canShareLiveLocation]);

  useEffect(() => () => {
    if (locationWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
  }, []);

  const handleAttachmentClick = () => {
    attachmentInputRef.current?.click();
  };

  const handleAttachmentsChange = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    setPendingAttachments(nextFiles);
  };

  const handleShareLocation = async () => {
    if (!canShareLiveLocation) {
      setSubmitError("A localização em tempo real fica disponível apenas até o início da jornada.");
      return;
    }

    if (!navigator.geolocation) {
      setSubmitError("Geolocalização não é suportada neste navegador.");
      return;
    }

    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
      setLocationState("idle");
      return;
    }

    setSubmitError("");
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
      setSubmitError(locationError.message || "Não foi possível compartilhar a localização.");
          setLocationState("idle");
          if (locationWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(locationWatchIdRef.current);
            locationWatchIdRef.current = null;
          }
        }
      },
      (geoError) => {
      setSubmitError(geoError.message || "Não foi possível obter sua localização.");
        setLocationState("idle");
        if (locationWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(locationWatchIdRef.current);
          locationWatchIdRef.current = null;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
    );
  };

  const handleOpenMap = () => {
    if (!canOpenLocationMap || locationMarkers.length === 0) {
      return;
    }

    setIsLocationModalOpen(true);
  };

  const handleRequestLocation = async () => {
    if (!canRequestLiveLocation) {
      return;
    }

    setSubmitError("");
    setIsRequestingLocation(true);

    try {
      await sendMessage(LOCATION_REQUEST_MESSAGE);
    } catch (requestError) {
      setSubmitError(requestError.message || "Não foi possível solicitar a localização.");
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (pendingAttachments.length > 0) {
      setSubmitError("Os anexos ainda não estão disponíveis no backend do chat.");
      return;
    }

    try {
      await sendMessage(draft);
      setDraft("");
    } catch (sendError) {
      setSubmitError(sendError.message || "Não foi possível enviar a mensagem.");
    }
  };

  return (
      <section className="service-chat-section">
        <div className="service-chat-header">
          <div className="service-chat-badges">
            <span className={`service-chat-status status-${connectionStatus}`}>
              {CONNECTION_LABELS[connectionStatus] || CONNECTION_LABELS.idle}
            </span>
            <span className={`service-chat-presence ${participantOnline ? "is-online" : ""}`}>
              {participantOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

      {(error || socketError || submitError) && (
        <div className="service-chat-alert" role="alert">
          <strong>Atencao:</strong> {error || socketError || submitError}
        </div>
      )}

      {shouldShowLocationCard && (
        <div className="service-chat-location-actions">
          {shouldShowShareLocationButton && (
            <button
              type="button"
              className="service-chat-secondary-btn"
              onClick={handleShareLocation}
              disabled={isRoomLoading || connectionStatus !== "connected" || locationState === "sending"}
            >
              {locationState === "sending" ? "Iniciando..." : "Compartilhar"}
            </button>
          )}

          {canRequestLiveLocation && (
            <button
              type="button"
              className="service-chat-secondary-btn"
              onClick={handleRequestLocation}
              disabled={isRoomLoading || connectionStatus !== "connected" || isRequestingLocation}
            >
                {isRequestingLocation ? "Solicitando..." : "Solicitar localização"}
            </button>
          )}

          {shouldShowLocationMapButton && (
            <button
              type="button"
              className="service-chat-location-map-btn"
              onClick={handleOpenMap}
                title="Ver localização no mapa"
            >
              <AimOutlined />
                <span>Ver localização em tempo real</span>
            </button>
          )}
        </div>
      )}

      {(isRoomLoading || isMessagesLoading) && (
        <div className="service-chat-loading">Carregando conversa...</div>
      )}

      <div className="service-chat-messages" aria-live="polite">
        {!isRoomLoading && !isMessagesLoading && messages.length === 0 && (
          <div className="service-chat-empty">
            <p>Nenhuma mensagem ainda.</p>
            <span>Use o campo abaixo para iniciar a conversa em tempo real.</span>
          </div>
        )}

        {messages.map((message, index) => {
          const isOwnMessage = Number(message.senderId) === Number(currentUserId);
          const fallbackKey = `${message.createdAt || "msg"}-${message.senderId}-${index}`;
          const authorProfile = resolveMessageAuthorProfile(message, currentUserId, currentUser, participant);

          return (
            <article
              key={message.id || fallbackKey}
              className={`service-chat-message ${isOwnMessage ? "is-own" : ""}`}
            >
              {!isOwnMessage && (
                <ChatAvatar profile={authorProfile} className="service-chat-message-avatar" />
              )}

              <div className="service-chat-message-bubble">
                <strong className="service-chat-message-author">
                  {authorProfile?.name || (isOwnMessage ? "Voce" : "Participante")}
                </strong>
                <p>{message.content}</p>
                <span className="service-chat-message-meta">
                  {formatMessageTime(message.createdAt)}
                  {typeof message.read === "boolean" ? ` | ${message.read ? "Lida" : "Enviada"}` : ""}
                </span>
              </div>
            </article>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <form className="service-chat-composer" onSubmit={handleSubmit}>
        {pendingAttachments.length > 0 && (
          <div className="service-chat-attachments">
            {pendingAttachments.map((file) => (
              <span key={`${file.name}-${file.size}`} className="service-chat-attachment-chip">
                {file.name}
              </span>
            ))}
          </div>
        )}

        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          hidden
          onChange={handleAttachmentsChange}
        />

        <div className="service-chat-composer-shell">
          <div className="service-chat-composer-main">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Digite uma mensagem"
              maxLength={4000}
              disabled={isRoomLoading || isSending}
              rows={2}
            />

            <button
              type="submit"
              className="service-chat-primary-btn service-chat-send-btn"
              disabled={isRoomLoading || isSending || !draft.trim()}
              title="Enviar mensagem"
              aria-label="Enviar mensagem"
            >
              <SendOutlined />
            </button>
          </div>

          <div className="service-chat-composer-footer">
            <div className="service-chat-composer-tools">
              <button
                type="button"
                className="service-chat-icon-btn"
                onClick={handleAttachmentClick}
                title="Adicionar anexo"
              >
                <PaperClipOutlined />
              </button>
            </div>
          </div>
        </div>
      </form>

      <LiveLocationMapModal
        isOpen={isLocationModalOpen}
        markers={locationMarkers}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </section>
  );
};

export default ServiceChatPanel;

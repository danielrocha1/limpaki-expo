import React, { useState, useEffect, useCallback } from "react";
import { useAddress } from "../../context/address";
import { useReview } from "../../context/service";
import { useChatCenter } from "../../context/chatCenter";
import { useOnlinePresence } from "../../context/onlinePresence";
import OnlineIndicator from "../../components/OnlineIndicator";
import {
  SERVICE_STATUS,
  SERVICE_ACTIONS,
  SUCCESS_MESSAGES,
  normalizeServiceStatus,
  isCompletedStatus,
} from "../constants";

const legacyAcceptedStatus = "em andamento";

const getDisplayStatusLabel = (status) => {
  const normalizedStatus = normalizeServiceStatus(status);

  if (normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus)) {
    return SERVICE_STATUS.ACCEPTED;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING)) {
    return SERVICE_STATUS.PENDING;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED)) {
    return SERVICE_STATUS.ACCEPTED;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY)) {
    return SERVICE_STATUS.IN_JOURNEY;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE)) {
    return SERVICE_STATUS.IN_JOURNEY;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED)) {
    return SERVICE_STATUS.COMPLETED;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.CANCELLED)) {
    return SERVICE_STATUS.CANCELLED;
  }

  return status;
};

const ServiceCard = ({
  service,
  onServiceClick,
  onUpdateStatus,
  onStartWithPin,
  loading,
  actionLoading,
  activeTab,
}) => {
  const { userRole } = useAddress();
  const { openReview } = useReview();
  const { openChat } = useChatCenter();
  const { isDiaristOnline } = useOnlinePresence();
  const [showPINInput, setShowPINInput] = useState(false);
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinError, setPinError] = useState("");
  const safeService = service || {};
  const serviceId = Number(safeService.ID ?? safeService.id ?? 0);
  const displayServiceId = safeService.ID ?? safeService.id ?? "-";
  const reviewData =
    safeService.review ||
    safeService.Review ||
    safeService.reviews ||
    safeService.Reviews ||
    {};

  useEffect(() => {
    document.body.style.overflow = showPINInput ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showPINInput]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }) +
      "  " +
      date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);

  const handleButtonClick = (e, action, serviceId) => {
    e.stopPropagation();
    let reason = "";
    if (action === SERVICE_ACTIONS.CANCEL) {
      reason = window.prompt("Informe o motivo:") || "";
      if (!reason.trim()) {
        return;
      }
    }
    onUpdateStatus(serviceId, action, reason);
  };

  const handleStartWithPin = useCallback(async () => {
    if (pin.length !== 4) {
      return;
    }

    setPinLoading(true);
    setPinError("");

    try {
      const success = await onStartWithPin(serviceId, pin);
      if (success) {
        setPinSuccess(true);
        setTimeout(() => {
          setShowPINInput(false);
          setPin("");
          setPinSuccess(false);
        }, 1500);
      }
    } catch (error) {
      setPinError(error.message || "PIN incorreto. Tente novamente.");
      setPin("");
    } finally {
      setPinLoading(false);
    }
  }, [onStartWithPin, pin, serviceId]);

  useEffect(() => {
    if (pin.length === 4 && !pinLoading && !pinSuccess) {
      handleStartWithPin();
    }
  }, [handleStartWithPin, pin, pinLoading, pinSuccess]);

  const togglePINInput = (e) => {
    e.stopPropagation();
    setShowPINInput((prev) => !prev);
    setPin("");
    setPinError("");
    setPinSuccess(false);
  };

  const getDisplayName = () => {
    if (userRole === "cliente") {
      return (
        safeService.diarist?.name ||
        safeService.diarist?.Name ||
        `Diarista #${safeService.diarist_id || "Pendente"}`
      );
    }

    return safeService.client?.name || safeService.client?.Name || `Cliente #${safeService.client_id}`;
  };

  const getDisplayAddress = () => {
    const addr = safeService.address;
    if (addr && typeof addr === "object") {
      const street = addr.street || addr.Street || "";
      const number = addr.number || addr.Number;
      const neighborhood = addr.neighborhood || addr.Neighborhood;

      if (isAccepted || isLegacyAccepted) {
        return `${street}${number ? `, ${number}` : ""}${neighborhood ? ` - ${neighborhood}` : ""}`;
      }

      return neighborhood || "Bairro não informado";
    }

    return isAccepted || isLegacyAccepted
      ? safeService.address_id || "Endereço não informado"
      : "Bairro não informado";
  };

  const getAvatarPhoto = () => {
    if (userRole === "cliente") {
      return (
        safeService.diarist?.Photo ||
        safeService.diarist?.photo ||
        safeService.diarist?.Avatar ||
        safeService.diarist?.avatar ||
        ""
      );
    }

    return (
      safeService.client?.Photo ||
      safeService.client?.photo ||
      safeService.client?.Avatar ||
      safeService.client?.avatar ||
      ""
    );
  };

  const getAvatarInitial = () => {
    const name = getDisplayName();
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  };

  const shouldShowReviewButton = () => {
    if (!isCompletedStatus(safeService.status)) return false;
    if (userRole === "cliente") {
      return !(reviewData.client_comment || reviewData.ClientComment);
    }
    if (userRole === "diarista") {
      return !(reviewData.diarist_comment || reviewData.DiaristComment);
    }
    return false;
  };

  const getReviewRating = () => {
    if (userRole === "cliente") {
      return Number(reviewData.diarist_rating || reviewData.DiaristRating || 0);
    }

    if (userRole === "diarista") {
      return Number(reviewData.client_rating || reviewData.ClientRating || 0);
    }

    return 0;
  };

  const getClientStartPin = () => String(safeService.start_pin || safeService.startPin || "");

  const getNextStepText = () => {
    if (userRole !== "diarista" || isHistoryCard) {
      return "";
    }

    if (isPending) {
      return "Aceite o serviço para confirmar o atendimento.";
    }

    if (isAccepted || isLegacyAccepted) {
      return "Inicie a jornada com o PIN da cliente.";
    }

    if (isInJourney || isInService) {
      return "Conclua o serviço quando a limpeza terminar.";
    }

    if (false && (isAccepted || isLegacyAccepted)) {
      return "Inicie a jornada para seguir para o atendimento.";
    }

    if (false && isInJourney) {
      return "Informe o PIN da cliente para iniciar o serviço.";
    }

    if (false && isInService) {
      return "Conclua o serviço quando a limpeza terminar.";
    }

    return "";
  };

  const shouldShowClientPin = () => {
    if (userRole !== "cliente" || isHistoryCard) {
      return false;
    }

    return (isAccepted || isLegacyAccepted) && Boolean(getClientStartPin());
  };

  const normalizedStatus = normalizeServiceStatus(safeService.status);
  const isPending = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING);
  const isAccepted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED);
  const isLegacyAccepted = normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
  const isInJourney = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY);
  const isInService = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE);
  const isJourneyStage = isInJourney || isInService;
  const isCancelled = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.CANCELLED);
  const isCompleted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);
  const chatEnabled = !isCancelled && !isCompleted;
  const reviewRating = getReviewRating();
  const formattedReviewRating = reviewRating.toFixed(1);
  const isHistoryCard = activeTab === "historico";
  const historyIcon = isCompleted ? "\u2705" : "\u274C";
  const avatarPhoto = getAvatarPhoto();
  const chatButtonLabel = userRole === "cliente" ? "Falar com a diarista" : "Falar com cliente";
  const diaristOnline =
    userRole === "cliente" && safeService?.diarist_id ? isDiaristOnline(safeService.diarist_id) : false;
  const isActionLoading = Boolean(loading);
  const activeAction = actionLoading?.serviceId === serviceId ? actionLoading?.action : "";
  const nextStepText = getNextStepText();
  const displayStatus = getDisplayStatusLabel(safeService.status);
  const displayStatusNormalized = normalizeServiceStatus(displayStatus);
  const statusClassName = `status-${displayStatusNormalized.replace(/\s+/g, "-")}`;

  if (!service) {
    return null;
  }

  return (
    <>
      <div
        className={`uber-card ${statusClassName} ${isHistoryCard ? "history-card" : ""} ${
          isActionLoading ? "is-action-loading" : ""
        }`}
        onClick={() => onServiceClick(safeService)}
      >
        <div className="uber-card-main">
          <div className="uber-icon-container">
            {avatarPhoto ? (
              <img
                src={avatarPhoto}
                alt={getDisplayName()}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: "inherit",
                }}
              />
            ) : (
              <div className={`uber-service-icon ${isHistoryCard ? "history-service-icon" : ""}`}>
                {isHistoryCard ? historyIcon : getAvatarInitial()}
              </div>
            )}
          </div>

          <div className="uber-details">
            <div className="uber-top-row">
              <div className="uber-top-row-copy">
                <span className="uber-date">{formatDate(safeService.scheduled_at)}</span>
                <span className="uber-service-id">Serviço #{displayServiceId}</span>
              </div>
              <span className="uber-price">{formatPrice(safeService.total_price)}</span>
            </div>

            <h3 className="uber-title">
              {userRole === "cliente" ? "Diarista: " : "Cliente: "}
              {getDisplayName()}
            </h3>

            {userRole === "cliente" && (
              <OnlineIndicator
                isOnline={diaristOnline}
                label={diaristOnline ? "Diarista online" : "Diarista offline"}
                className="service-person-online"
              />
            )}

            <div className="uber-address">
              <span className="uber-dot" />
              <span className="uber-address-text">{getDisplayAddress()}</span>
            </div>

            <div className="uber-status-row">
              <span className={`uber-badge badge-${displayStatusNormalized.replace(/\s+/g, "-")}`}>
                {displayStatus}
              </span>
              {shouldShowClientPin() && (
                <span className="service-pin-badge">PIN: {getClientStartPin()}</span>
              )}
              <span className="uber-duration">{safeService.duration_hours}h</span>
            </div>

            {nextStepText && (
              <div className="service-next-step">
                <span className="service-next-step__label">Próximo passo</span>
                <p className="service-next-step__text">{nextStepText}</p>
              </div>
            )}

            {isHistoryCard && (
              <div className="history-rating-row">
                <div className="history-rating-stars" aria-label={`Nota ${reviewRating || 0} de 5`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <span
                      key={index}
                      className={`history-rating-star ${index < reviewRating ? "filled" : ""}`}
                    >
                      {"\u2605"}
                    </span>
                  ))}
                </div>
                <span className="history-rating-value">({formattedReviewRating})</span>
              </div>
            )}

            {isHistoryCard && (
              <div className="history-card-summary">
                <div className="history-card-pill">
                  <span className="history-pill-label">Informação do serviço</span>
                  <strong>{safeService.service_type || "Servi\u00e7o"}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="uber-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z" fill="#A0AEC0" />
            </svg>
          </div>
        </div>

        <div className="uber-actions">
          {isActionLoading && (
            <div className="service-card-inline-loading" role="status" aria-live="polite">
              <span className="service-card-inline-loading-spinner" aria-hidden="true" />
              <span>
                {activeAction === "start-with-pin" ? "Iniciando servi\u00e7o..." : "Atualizando servi\u00e7o..."}
              </span>
            </div>
          )}

          {chatEnabled && (
            <button
              className="uber-btn btn-chat-ghost"
              onClick={(e) => {
                e.stopPropagation();
                openChat(service);
              }}
              disabled={isActionLoading}
            >
              {"\uD83D\uDCAC"} {chatButtonLabel}
            </button>
          )}

          {userRole === "cliente" && (isPending || isAccepted || isLegacyAccepted || isInJourney) && (
            <button
              className="uber-btn btn-outline-danger"
              onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.CANCEL, serviceId)}
              disabled={loading}
            >
              Cancelar
            </button>
          )}

          {shouldShowReviewButton() && (
            <button
              className="uber-btn btn-dark"
              onClick={(e) => {
                e.stopPropagation();
                openReview(safeService);
              }}
            >
              Avaliar Experiência
            </button>
          )}

          {userRole === "diarista" && isPending && (
            <div className="uber-action-group">
              <button
                className="uber-btn btn-dark"
                onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.ACCEPT, serviceId)}
                disabled={loading}
              >
                Aceitar
              </button>
              <button
                className="uber-btn btn-outline-danger"
                onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.CANCEL, serviceId)}
                disabled={loading}
              >
                Recusar
              </button>
            </div>
          )}

          {userRole === "diarista" && (isAccepted || isLegacyAccepted) && (
            <div className="uber-action-group">
              <button
                className="uber-btn btn-dark"
                onClick={togglePINInput}
                disabled={loading}
              >
                Iniciar jornada com PIN
              </button>
              <button
                className="uber-btn btn-outline-danger"
                onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.CANCEL, serviceId)}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          )}

          {userRole === "diarista" && isJourneyStage && (
            <button
              className="uber-btn btn-dark"
              onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.COMPLETE, serviceId)}
              disabled={loading}
            >
              Concluir Serviço
            </button>
          )}
        </div>
      </div>

      {showPINInput && (
        <div className="pin-drawer-overlay" onClick={togglePINInput}>
          <div className="pin-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="pin-drawer-header">
              <div className="pin-drawer-handle" />
              <h2 className="pin-drawer-title">Confirmar Início do Serviço</h2>
              <p className="pin-drawer-subtitle">
                Digite os 4 últimos dígitos do telefone do cliente para iniciar o serviço.
              </p>
            </div>

            <div className="pin-input-group">
              {!pinSuccess ? (
                <>
                  <input
                    type="tel"
                    maxLength="4"
                    placeholder=""
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="pin-input-large"
                    disabled={pinLoading}
                    autoFocus
                  />

                  {pinLoading && <p style={{ textAlign: "center", color: "#666" }}>Verificando...</p>}

                  {pinError && <div className="pin-error-msg">{"\u26A0\uFE0F"} {pinError}</div>}

                  <button
                    className="uber-btn btn-dark"
                    style={{ marginTop: "10px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartWithPin();
                    }}
                    disabled={pinLoading || pin.length !== 4}
                  >
                    Confirmar
                  </button>

                  <button
                    className="uber-btn"
                    style={{ background: "transparent", color: "#666", marginTop: "5px" }}
                    onClick={togglePINInput}
                  >
                    Voltar
                  </button>
                </>
              ) : (
                <div className="pin-success-msg">
                  <div style={{ fontSize: "3rem", marginBottom: "10px" }}>{"\u2705"}</div>
                  {SUCCESS_MESSAGES.PIN_VERIFIED}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ServiceCard;






import React from 'react';
import { useAddress } from '../../context/address';
import { useReview } from '../../context/service';
import { Modal } from 'antd';
import { SERVICE_STATUS, SERVICE_ACTIONS, normalizeServiceStatus } from '../constants';

const uiIcons = {
  pending: "\u23F3",
  inProgress: "\uD83D\uDE9A",
  completed: "\u2705",
  cancelled: "\u274C",
  fallback: "\uD83D\uDCCA",
  profile: "\uD83D\uDC64",
  confirm: "\u2705",
  reject: "\u274C",
  review: "\u2B50",
  empty: "\uD83D\uDCCB",
  diarist: "\uD83E\uDDF9",
  address: "\uD83D\uDCCD",
  status: "\uD83D\uDCCA",
  price: "\uD83D\uDCB0",
  duration: "\u23F1\uFE0F",
  scheduled: "\uD83D\uDCC5",
  actions: "\u2699\uFE0F",
};

const legacyAcceptedStatus = 'em andamento';

const getDisplayStatusLabel = (status) => {
  const normalizedStatus = normalizeServiceStatus(status);

  if (normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus)) {
    return SERVICE_STATUS.ACCEPTED;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE)) {
    return SERVICE_STATUS.IN_JOURNEY;
  }

  return status;
};

const ServiceTable = ({
  services,
  onServiceClick,
  onUpdateStatus,
  loading
}) => {
  const { userRole } = useAddress();
  const { openReview } = useReview();
  const getReviews = (service) => service?.reviews || {};

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Hoje às " + date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } else if (diffDays === 2) {
      return "Ontem às " + date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } else {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }) + " às " + date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getStatusClass = (status) => {
    return `status status-${getDisplayStatusLabel(status).replace(" ", "-")}`;
  };

  const getStatusIcon = (status) => {
    const icons = {
      [SERVICE_STATUS.PENDING]: uiIcons.pending,
      [SERVICE_STATUS.ACCEPTED]: uiIcons.confirm,
      [SERVICE_STATUS.IN_JOURNEY]: uiIcons.inProgress,
      [SERVICE_STATUS.IN_SERVICE]: uiIcons.inProgress,
      [SERVICE_STATUS.COMPLETED]: uiIcons.completed,
      [SERVICE_STATUS.CANCELLED]: uiIcons.cancelled
    };
    return icons[status] || uiIcons.fallback;
  };

  const handleRowClick = (event, service) => {
    if (event.target.tagName === "BUTTON" ||
        event.target.tagName === "DIV" ||
        event.target.tagName === "TEXTAREA" ||
        event.target.closest('.action-buttons')) {
      return;
    }
    onServiceClick(service);
  };

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

  const getNormalizedServiceStatus = (service) => normalizeServiceStatus(service?.status);

  const renderClientActions = (service) => (
    <div className="action-buttons">
      {(() => {
        const normalizedStatus = getNormalizedServiceStatus(service);
        const isPending = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING);
        const isAccepted =
          normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED) ||
          normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
        const isInJourney = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY);
        const isCompleted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);

        return (
          <>
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                Modal.info({
                  title: 'Perfil da diarista',
                  content: `Você está visualizando o perfil da diarista #${service.diarist_id}.`,
                });
              }}
              title="Ver perfil da diarista"
            >
              {uiIcons.profile} Ver perfil
            </button>

            {(isPending || isAccepted || isInJourney) && (
              <button
                className="btn btn-danger"
                onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.CANCEL, service.ID)}
                disabled={loading}
                title="Cancelar serviço"
              >
                {uiIcons.reject} Cancelar
              </button>
            )}

            {isCompleted &&
             !(getReviews(service).client_comment || getReviews(service).ClientComment) &&
             userRole === "cliente" && (
              <button
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  openReview(service);
                }}
                title="Avaliar serviço"
              >
                {uiIcons.review} Avaliar
              </button>
            )}
          </>
        );
      })()}
    </div>
  );

  const renderDiaristActions = (service) => (
    <div className="action-buttons">
      {(() => {
        const normalizedStatus = getNormalizedServiceStatus(service);
        const isPending = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING);
        const isAccepted =
          normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED) ||
          normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
        const isInJourney = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY);
        const isInService = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE);
        const isJourneyStage = isInJourney || isInService;
        const isCompleted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);

        return (
          <>
            {isPending && (
              <>
                <button
                  className="btn btn-success"
                  onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.ACCEPT, service.ID)}
                  disabled={loading}
                  title="Aceitar serviço"
                >
                  {uiIcons.confirm} Aceitar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.CANCEL, service.ID)}
                  disabled={loading}
                  title="Recusar serviço"
                >
                  {uiIcons.reject} Recusar
                </button>
              </>
            )}

            {isAccepted && (
              <button
                className="btn btn-success"
                onClick={(e) => {
                  e.stopPropagation();
                  onServiceClick(service);
                }}
                disabled={loading}
                title="Iniciar jornada com PIN"
              >
                {uiIcons.confirm} Iniciar jornada com PIN
              </button>
            )}

            {isJourneyStage && (
              <button
                className="btn btn-success"
                onClick={(e) => handleButtonClick(e, SERVICE_ACTIONS.COMPLETE, service.ID)}
                disabled={loading}
                title="Concluir serviço"
              >
                {uiIcons.confirm} Concluir
              </button>
            )}

            {isCompleted &&
             (getReviews(service).client_comment || getReviews(service).ClientComment) &&
             !(getReviews(service).diarist_comment || getReviews(service).DiaristComment) && (
              <button
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  openReview(service);
                }}
                title="Avaliar serviço"
              >
                {uiIcons.review} Avaliar
              </button>
            )}
          </>
        );
      })()}
    </div>
  );

  if (services.length === 0) {
    return (
      <div className="no-services">
        <div className="no-services-icon">{uiIcons.empty}</div>
        <p>Nenhum serviço encontrado com os filtros atuais.</p>
        <small>Tente ajustar os filtros ou aguarde novos serviços.</small>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="service-table">
        <thead>
          <tr>
            <th>{uiIcons.diarist} Diarista</th>
            <th>{uiIcons.address} Endereço</th>
            <th>{uiIcons.status} Status</th>
            <th>{uiIcons.price} Preço</th>
            <th>{uiIcons.duration} Duração</th>
            <th>{uiIcons.scheduled} Agendado</th>
            <th>{uiIcons.actions} Ações</th>
          </tr>
        </thead>
        <tbody>
          {services.filter(Boolean).map((service) => (
            <tr
              key={service.ID}
              onClick={(event) => handleRowClick(event, service)}
              className="clickable-row"
            >
              <td data-label="Diarista">
                <div className="diarist-info">
                  <span className="diarist-id">{service.diarist_id}</span>
                  <small className="diarist-type">Diarista</small>
                </div>
              </td>
              <td data-label="Endereço">
                <div className="address-info">
                  <span className="address-text">{service.address_id || "Não informado"}</span>
                </div>
              </td>
              <td data-label="Status">
                <span className={getStatusClass(getDisplayStatusLabel(service.status))}>
                  {getStatusIcon(getDisplayStatusLabel(service.status))} {getDisplayStatusLabel(service.status)}
                </span>
              </td>
              <td data-label="Preço">
                <span className="price-value">{formatPrice(service.total_price)}</span>
              </td>
              <td data-label="Duração">
                <span className="duration-value">
                  <span className="duration-icon">{uiIcons.duration}</span>
                  {service.duration_hours}h
                </span>
              </td>
              <td data-label="Agendado">
                <span className="date-value">{formatDate(service.scheduled_at)}</span>
              </td>
              <td data-label="Ações">
                {userRole === "cliente" && renderClientActions(service)}
                {userRole === "diarista" && renderDiaristActions(service)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServiceTable;

import React, { useState } from 'react';
import { message } from 'antd';
import OnlineIndicator from '../../components/OnlineIndicator';
import { useAddress } from '../../context/address';
import { useOnlinePresence } from '../../context/onlinePresence';
import { useChatCenter } from '../../context/chatCenter';
import { SERVICE_ACTIONS, SERVICE_STATUS, normalizeServiceStatus } from '../constants';

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

const getRoomIcon = (roomName) => {
  const normalizedName = String(roomName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalizedName.includes('banheiro') || normalizedName.includes('lavabo')) return '\uD83D\uDEBF';
  if (normalizedName.includes('quarto') || normalizedName.includes('suite')) return '\uD83D\uDECF\uFE0F';
  if (normalizedName.includes('cozinha')) return '\uD83C\uDF73';
  if (normalizedName.includes('sala')) return '\uD83D\uDECB\uFE0F';
  if (normalizedName.includes('area') || normalizedName.includes('lavanderia')) return '\uD83E\uDDFA';
  if (normalizedName.includes('escritorio')) return '\uD83D\uDCBC';
  if (normalizedName.includes('garagem')) return '\uD83D\uDE97';

  return '\uD83C\uDFE0';
};

const ServiceModal = ({ service, onClose, onStartWithPin, onUpdateStatus }) => {
  const { userRole } = useAddress();
  const { isDiaristOnline } = useOnlinePresence();
  const { openChat } = useChatCenter();
  const [showPINModal, setShowPINModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const safeService = service || {};

  if (!service) return null;

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short'
    });

  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);

  const formatAddress = (addr) => {
    if (!addr || typeof addr === 'number') return safeService.address_id || 'Nao informado';

    const street = addr.street || addr.Street || '';
    const number = addr.number || addr.Number;
    const complement = addr.complement || addr.Complement;
    const neighborhood = addr.neighborhood || addr.Neighborhood;
    const city = addr.city || addr.City;
    const state = addr.state || addr.State;

    const parts = [
      street,
      number ? `, ${number}` : '',
      complement ? ` - ${complement}` : '',
      neighborhood ? ` (${neighborhood})` : '',
      city ? ` - ${city}` : '',
      state ? `/${state}` : ''
    ];

    return parts.join('');
  };

  const getNeighborhood = (addr) => {
    if (!addr || typeof addr !== 'object') return '';
    return addr.neighborhood || addr.Neighborhood || '';
  };

  const formatRoomCountLabel = (quantity) => `${quantity} ${quantity === 1 ? 'ambiente' : 'ambientes'}`;

  const getAddressRooms = () => {
    const rooms = safeService.address?.rooms || safeService.address?.Rooms || [];

    if (!Array.isArray(rooms)) {
      return [];
    }

    return rooms
      .map((room) => ({
        id: room?.id || room?.ID || `${room?.name || room?.Name}-${room?.quantity || room?.Quantity || 0}`,
        name: String(room?.name || room?.Name || '').trim(),
        quantity: Number(room?.quantity || room?.Quantity || 0),
      }))
      .filter((room) => room.name && room.quantity > 0);
  };

  const getGoogleMapsUrl = () => {
    const addr = safeService.address;
    if (!addr) return null;

    const latitude = addr.latitude || addr.Latitude;
    const longitude = addr.longitude || addr.Longitude;
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const addressString = encodeURIComponent(formatAddress(addr));
    return `https://www.google.com/maps/search/?api=1&query=${addressString}`;
  };

  const googleMapsUrl = getGoogleMapsUrl();
  const isClient = userRole === 'cliente';
  const isDiarist = userRole === 'diarista';
  const normalizedStatus = normalizeServiceStatus(safeService.status);
  const isAccepted =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED) ||
    normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
  const isInJourney = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY);
  const isInService = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE);
  const isJourneyStage = isInJourney || isInService;
  const displayStatus = getDisplayStatusLabel(safeService.status);
  const displayStatusClassName = `uber-badge badge-${normalizeServiceStatus(displayStatus).replace(/\s+/g, '-')}`;

  const counterpartName = isClient
    ? (safeService.diarist?.name || safeService.diarist?.Name || `Diarista #${safeService.diarist_id || 'Pendente'}`)
    : (safeService.client?.name || safeService.client?.Name || `Cliente #${safeService.client_id}`);
  const counterpartPhoto = isClient
    ? (
      safeService.diarist?.Photo ||
      safeService.diarist?.photo ||
      safeService.diarist?.Avatar ||
      safeService.diarist?.avatar ||
      ''
    )
    : (
      safeService.client?.Photo ||
      safeService.client?.photo ||
      safeService.client?.Avatar ||
      safeService.client?.avatar ||
      ''
    );
  const counterpartInitial = String(counterpartName || '?').trim().charAt(0).toUpperCase() || '?';
  const locationText = isAccepted
    ? formatAddress(safeService.address)
    : (getNeighborhood(safeService.address) || 'Bairro nao informado');
  const addressRooms = getAddressRooms();
  const totalEnvironments = addressRooms.reduce((total, room) => total + room.quantity, 0);
  const headerEyebrow = safeService.service_type || 'Geral';
  const chatButtonLabel = isClient ? 'Falar com diarista' : 'Falar com cliente';
  const canOpenChat = Number(safeService.ID ?? safeService.id ?? 0) > 0;

  const reviewData =
    safeService.review ||
    safeService.Review ||
    safeService.reviews ||
    safeService.Reviews ||
    {};
  const clientRating = Number(reviewData.client_rating || reviewData.ClientRating || 0);
  const diaristRating = Number(reviewData.diarist_rating || reviewData.DiaristRating || 0);

  const formatReviewBadge = (rating, emptyText) => {
    if (!rating) return emptyText;
    return `\u2605 ${rating}/5`;
  };

  const handleStartService = () => {
    setShowPINModal(true);
    setPin('');
  };

  const handleCompleteService = async () => {
    if (!onUpdateStatus) return;

    const success = await onUpdateStatus(safeService.ID, SERVICE_ACTIONS.COMPLETE);
    if (success) {
      onClose();
    }
  };

  const handleSubmitPIN = async () => {
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      message.error('O PIN deve conter exatamente 4 digitos.');
      return;
    }

    setPinLoading(true);
    const success = await onStartWithPin(safeService.ID, pin);
    setPinLoading(false);

    if (success) {
      setShowPINModal(false);
      setPin('');
      onClose();
    }
  };

  const handleClosePINModal = () => {
    setShowPINModal(false);
    setPin('');
  };

  const diaristOnline = isClient && safeService?.diarist_id
    ? isDiaristOnline(safeService.diarist_id)
    : false;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-uber" onClick={(e) => e.stopPropagation()}>
        <div className="modal-drag-handle"></div>

        <div className="modal-header-uber">
          <div className="modal-header-primary">
            <div className="modal-identity-card">
              <div className="modal-title-wrap">
                <div className="modal-title-main-row">
                  <div className="modal-title-person">
                    <div className="modal-title-copy">
                      <div className="modal-title-heading">
                        <div className="modal-title-heading-main">
                          {counterpartPhoto ? (
                            <img src={counterpartPhoto} alt={counterpartName} className="modal-title-avatar" />
                          ) : (
                            <span className="modal-title-avatar modal-title-avatar--fallback">{counterpartInitial}</span>
                          )}
                          <h3 className="modal-title">{counterpartName}</h3>
                        </div>
                        <div className="modal-title-price">
                          {formatPrice(safeService.total_price)}
                        </div>
                      </div>
                      {isClient && (
                        <OnlineIndicator
                          isOnline={diaristOnline}
                          label={diaristOnline ? 'Diarista online agora' : 'Diarista offline no momento'}
                          className="service-modal-online"
                        />
                      )}
                      <div className="modal-title-meta">
                        <div className="modal-title-meta-item">
                          <span className="modal-title-meta-label">Duracao estimada</span>
                          <span className="modal-title-meta-value">{safeService.duration_hours}h</span>
                        </div>
                        <div className="modal-title-meta-item">
                          <span className="modal-title-meta-label">Status</span>
                          <span className={displayStatusClassName}>
                            {displayStatus}
                          </span>
                        </div>
                      </div>
                      <span className="modal-service-description-label">Detalhes do Servico</span>
                      <p className="modal-service-description">{headerEyebrow}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-header-actions">
            {canOpenChat && (
              <button
                className="modal-chat-toggle-btn"
                onClick={() => openChat(safeService)}
                aria-label={chatButtonLabel}
                title={chatButtonLabel}
              >
                <span aria-hidden="true">{'\uD83D\uDCAC'}</span>
                <span>{chatButtonLabel}</span>
              </button>
            )}
            <span className="modal-header-divider" aria-hidden="true" />
            <button className="modal-close-btn" onClick={onClose}>{'\u2715'}</button>
          </div>
        </div>

        <div className="modal-body-uber">
          <div className="modal-section-card">
            <div className="modal-section-header">
              <h4 className="modal-section-title">Resumo</h4>
            </div>

            <div className="overview-grid">
              <div className="overview-item">
                <span className="overview-label">Data e hora do agendamento</span>
                <span className="overview-value">{formatDate(safeService.scheduled_at)}</span>
              </div>

              <div className="overview-item">
                <span className="overview-label">Localizacao do trabalho</span>
                <span className="overview-value">{locationText}</span>
                {(safeService.address?.reference_point || safeService.address?.ReferencePoint) && (
                  <small className="detail-subtext service-reference-note service-reference-note--location">
                    Ponto de referencia: {safeService.address?.reference_point || safeService.address?.ReferencePoint}
                  </small>
                )}
                {googleMapsUrl && (
                  <div className="maps-link-container">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="maps-btn maps-btn--full"
                    >
                      <span className="maps-icon">{'\uD83D\uDDFA\uFE0F'}</span>
                      Ver no Google Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-section-card modal-section-card--soft">
            <div className="modal-section-header">
              <h4 className="modal-section-title modal-section-title--caps">Detalhes da residencia</h4>
              <span className="service-rooms-caption">{addressRooms.length} tipos de comodo</span>
            </div>

            {addressRooms.length > 0 && (
              <div className="service-rooms-panel service-rooms-panel--embedded">
                <div className="service-rooms-summary-grid">
                  <div className="service-rooms-summary-card">
                    <strong>{totalEnvironments}</strong>
                    <span>Ambientes</span>
                  </div>
                </div>

                <div className="service-rooms-list">
                  {addressRooms.map((room) => (
                    <div key={room.id} className="service-room-card">
                      <span className="service-room-icon" aria-hidden="true">{getRoomIcon(room.name)}</span>
                      <div className="service-room-copy">
                        <strong>{room.name}</strong>
                        <span>{formatRoomCountLabel(room.quantity)}</span>
                      </div>
                      <span className="service-room-badge">{room.quantity}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="modal-section-card">
            <div className="modal-section-header">
              <h4 className="modal-section-title">Condicoes do servico</h4>
            </div>

            <div className="overview-grid">
              <div className="overview-item">
                <span className="overview-label">Presenca de animais</span>
                <span className="overview-value">{safeService.has_pets ? 'Sim, ha animais no local.' : 'Nao ha animais informados.'}</span>
              </div>

              {safeService.observations && (
                <div className="overview-item">
                  <span className="overview-label">Instrucoes e observacoes</span>
                  <span className="overview-value overview-value--quote">"{safeService.observations}"</span>
                </div>
              )}
            </div>
          </div>

          <div className="reviews-section-uber modal-section-card">
            <h4 className="section-title">Avaliacoes do servico</h4>

            <div className="reviews-grid-uber">
              <div className="review-card-uber">
                <div className="review-header">
                  <span className="reviewer-type">Avaliacao do cliente</span>
                  <span className="review-rating">
                    {formatReviewBadge(clientRating, 'Ainda nao avaliada')}
                  </span>
                </div>
                <p className="review-comment">
                  {reviewData.client_comment || reviewData.ClientComment || 'O cliente ainda nao deixou um feedback sobre a diarista.'}
                </p>
              </div>

              <div className="review-card-uber">
                <div className="review-header">
                  <span className="reviewer-type">Avaliacao da diarista</span>
                  <span className="review-rating">
                    {formatReviewBadge(diaristRating, 'Ainda nao avaliada')}
                  </span>
                </div>
                <p className="review-comment">
                  {reviewData.diarist_comment || reviewData.DiaristComment || 'A diarista ainda nao deixou um feedback sobre o cliente.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer-uber">
          {isDiarist && isAccepted && (
            <button className="btn-uber-primary" onClick={handleStartService}>
              Iniciar jornada com PIN
            </button>
          )}
          {isDiarist && isJourneyStage && (
            <button className="btn-uber-primary" onClick={handleCompleteService}>
              Concluir servico
            </button>
          )}
          <button className="btn-uber-secondary" onClick={onClose}>
            Fechar detalhes
          </button>
        </div>

        {showPINModal && (
          <div className="modal-overlay" onClick={handleClosePINModal}>
            <div className="modal-content-pin" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-pin">
                <h3>Autenticacao para iniciar o servico</h3>
                <button className="modal-close-btn" onClick={handleClosePINModal}>{'\u2715'}</button>
              </div>

              <div className="modal-body-pin">
                <p className="pin-instruction">Digite os 4 ultimos digitos do telefone da cliente para iniciar o servico.</p>

                <input
                  type="text"
                  maxLength="4"
                  placeholder="0000"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="pin-input"
                  disabled={pinLoading}
                  autoFocus
                />
              </div>

              <div className="modal-footer-pin">
                <button
                  className="btn-cancel"
                  onClick={handleClosePINModal}
                  disabled={pinLoading}
                >
                  Cancelar
                </button>
                <button
                  className="btn-confirm"
                  onClick={handleSubmitPIN}
                  disabled={pinLoading || pin.length !== 4}
                >
                  {pinLoading ? 'Verificando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceModal;


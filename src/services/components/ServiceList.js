import React from 'react';
import ServiceCard from './ServiceCard';

const ServiceList = ({
  services,
  onServiceClick,
  onUpdateStatus,
  onStartWithPin,
  loading,
  activeTab,
  actionLoading,
  showUpdatingState = false,
  updatingLabel = "",
}) => {
  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Carregando seus serviços...</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="no-services-container">
        <div className="no-services-icon">#</div>
        <h3>Nenhum serviço encontrado</h3>
        <p>Tente ajustar os filtros ou aguarde novos serviços.</p>
      </div>
    );
  }

  return (
    <div
      className={`service-list-shell ${showUpdatingState ? "is-updating" : ""}`}
      aria-busy={showUpdatingState}
    >
      {showUpdatingState && updatingLabel ? (
        <div className="services-inline-status" role="status" aria-live="polite">
          <span className="services-inline-status-dot" aria-hidden="true" />
          <span>{updatingLabel}</span>
        </div>
      ) : null}

      <div className="service-list-container">
      {services.map((service) => (
        <ServiceCard
          key={service.ID}
          service={service}
          onServiceClick={onServiceClick}
          onUpdateStatus={onUpdateStatus}
          onStartWithPin={onStartWithPin}
          loading={Boolean(actionLoading?.serviceId) && actionLoading?.serviceId === service.ID}
          actionLoading={actionLoading}
          activeTab={activeTab}
        />
      ))}
      </div>
    </div>
  );
};

export default ServiceList;

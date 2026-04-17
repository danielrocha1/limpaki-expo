import { startTransition, useState, useMemo } from "react";
import { useServices } from "./hooks/useServices";
import ServiceModal from "./components/ServiceModal";
import ServiceList from "./components/ServiceList";
import { SERVICE_STATUS } from "./constants";
import { message, Spin } from "antd";
import { ClockCircleOutlined, HistoryOutlined } from "@ant-design/icons";
import "./services.css";

const normalizeStatus = (status) =>
  String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ServicesPage = () => {
  const [selectedService, setSelectedService] = useState(null);
  const [activeTab, setActiveTab] = useState("ativos");
  const [currentPage, setCurrentPage] = useState(1);
  const currentStatusGroup = activeTab === "historico" ? "history" : "active";

  const {
    services,
    initialLoading,
    isRefreshing,
    isPaginating,
    error,
    pagination,
    actionLoading,
    updateServiceStatus,
    startServiceWithPin,
    refetchServices,
  } = useServices(currentStatusGroup, currentPage);

  const handleServiceClick = (service) => {
    setSelectedService(service);
  };

  const handleCloseModal = () => {
    setSelectedService(null);
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    startTransition(() => {
      setSelectedService(null);
      setCurrentPage(1);
      setActiveTab(tab);
    });
  };

  const handleUpdateStatus = async (id, action, reason = '') => {
    try {
      await updateServiceStatus(id, action, reason);
      if (action === "start") {
        message.success("Jornada iniciada com sucesso!");
      } else if (action === "complete") {
        message.success("Serviço finalizado com sucesso!");
      } else if (action === "accept") {
        message.success("Serviço aceito com sucesso!");
      } else if (action === "cancel") {
        message.success("Serviço cancelado com sucesso!");
      } else {
        message.success("Status atualizado com sucesso!");
      }
      return true;
    } catch (err) {
      message.error(err.message || "Erro ao atualizar o status.");
      return false;
    }
  };

  const handleStartWithPin = async (id, pin) => {
    try {
      await startServiceWithPin(id, pin);
      message.success("Serviço iniciado com sucesso!");
      return true;
    } catch (err) {
      message.error(err.message || "Erro ao iniciar o serviço.");
      return false;
    }
  };

  const filteredServices = useMemo(() => {
    const filtered = [...services].filter((service) => {
      const normalized = normalizeStatus(service?.status);
      const isFinished =
        normalized === normalizeStatus(SERVICE_STATUS.COMPLETED) ||
        normalized === normalizeStatus(SERVICE_STATUS.CANCELLED);

      return activeTab === "ativos" ? !isFinished : isFinished;
    });

    if (activeTab === "ativos") {
      filtered.sort((a, b) => {
        const statusOrder = {
          [normalizeStatus(SERVICE_STATUS.PENDING)]: 0,
          [normalizeStatus(SERVICE_STATUS.ACCEPTED)]: 1,
          [normalizeStatus(SERVICE_STATUS.IN_JOURNEY)]: 2,
          [normalizeStatus(SERVICE_STATUS.IN_SERVICE)]: 3,
        };
        const orderA = statusOrder[normalizeStatus(a.status)] ?? 4;
        const orderB = statusOrder[normalizeStatus(b.status)] ?? 4;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.scheduled_at) - new Date(a.scheduled_at);
      });
    } else {
      filtered.sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
    }

    return filtered;
  }, [services, activeTab]);

  const isListUpdating = isRefreshing || isPaginating;
  const isActionInProgress = Boolean(actionLoading?.serviceId);
  const updatingLabel = isPaginating
    ? "Carregando lista..."
    : isRefreshing
      ? "Atualizando serviços..."
      : "";
  const paginationBusy = initialLoading || isPaginating;

  if (error && services.length === 0) {
    return (
      <div className="services-body">
        <div className="service-container">
          <div className="error-message">
            <div className="error-icon">{"\u26A0\uFE0F"}</div>
            <h3>Erro ao carregar serviços</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => refetchServices()}>
              {"\uD83D\uDD04"} Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="services-body">
      {isActionInProgress && (
        <div className="services-action-overlay" role="status" aria-live="polite">
          <div className="services-action-overlay-card">
            <Spin size="large" />
            <span>Processando ação...</span>
          </div>
        </div>
      )}

      <div className="service-container">
        <div className="service-header">
          <h2>Meus serviços</h2>
          {isListUpdating && (
            <div className="services-header-meta" role="status" aria-live="polite">
              <span className="services-header-meta-dot" aria-hidden="true" />
              <span>{updatingLabel}</span>
            </div>
          )}
        </div>

        <div className="uber-tabs">
          <button
            className={`tab-item ${activeTab === "ativos" ? "active" : ""}`}
            onClick={() => handleTabChange("ativos")}
          >
            <ClockCircleOutlined /> Ativos
          </button>
          <button
            className={`tab-item ${activeTab === "historico" ? "active" : ""}`}
            onClick={() => handleTabChange("historico")}
          >
            <HistoryOutlined /> Histórico
          </button>
        </div>
        <div className="services-pagination">
          <button
            className="services-pagination-btn"
            onClick={() =>
              startTransition(() => {
                setCurrentPage((prev) => Math.max(prev - 1, 1));
              })
            }
            disabled={paginationBusy || !pagination.has_previous}
          >
            Anterior
          </button>

          <div className="services-pagination-status">
            Página {pagination.page} de {pagination.total_pages}
          </div>

          <button
            className="services-pagination-btn"
            onClick={() =>
              startTransition(() => {
                setCurrentPage((prev) => prev + 1);
              })
            }
            disabled={paginationBusy || !pagination.has_next}
          >
            Próxima
          </button>
        </div>

        <ServiceList
          services={filteredServices}
          onServiceClick={handleServiceClick}
          onUpdateStatus={handleUpdateStatus}
          onStartWithPin={handleStartWithPin}
          loading={initialLoading}
          actionLoading={actionLoading}
          showUpdatingState={isListUpdating}
          updatingLabel={updatingLabel}
          activeTab={activeTab}
        />

        {selectedService && (
          <ServiceModal
            service={selectedService}
            onClose={handleCloseModal}
            onUpdateStatus={handleUpdateStatus}
            onStartWithPin={handleStartWithPin}
          />
        )}
      </div>
    </div>
  );
};

export default ServicesPage;

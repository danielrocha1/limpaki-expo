import React from 'react';
import { SERVICE_STATUS } from '../constants';

const ServiceFilter = ({ statusFilter, onStatusChange }) => {
  const statusOptions = [
    { value: "todos", label: "Todos", icon: "#" },
    { value: SERVICE_STATUS.PENDING, label: "Pendentes", icon: "..." },
    { value: SERVICE_STATUS.IN_JOURNEY, label: "Em Jornada", icon: ">" },
    { value: SERVICE_STATUS.IN_SERVICE, label: "Em serviço", icon: ">>" },
    { value: SERVICE_STATUS.COMPLETED, label: "Concluídos", icon: "OK" },
    { value: SERVICE_STATUS.CANCELLED, label: "Cancelados", icon: "X" }
  ];

  return (
    <div className="service-filter-container">
      <div className="filter-chips">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            className={`filter-chip ${statusFilter === option.value ? 'active' : ''}`}
            onClick={() => onStatusChange(option.value)}
          >
            <span className="chip-icon">{option.icon}</span>
            <span className="chip-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ServiceFilter;

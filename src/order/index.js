import { useState, useEffect, useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./order.css";
import { useAddress } from "../context/address";
import OrderStepper from "./OrderStepper";
import { Modal, message } from 'antd';
import { buildApiPathUrl } from "../config/api";

const getDiaristProfile = (diarista = {}) => diarista?.diarist_profile || diarista?.diaristas?.[0] || {};
const getHourlyRate = (diarista = {}) =>
  Number(getDiaristProfile(diarista).price_per_hour || getDiaristProfile(diarista).PricePerHour || 0);
const getSelectedAddressId = (address = {}) => address?.id || address?.ID;

// Usar o novo componente stepper por padrão
export default function Order({ diarista, onClose }) {
  return <OrderStepper diarista={diarista} onClose={onClose} />;
}

// Manter a implementação antiga como fallback
function OrderLegacy({ diarista, onClose }) {
  const { selectedAddress } = useAddress();

  const [date, setDate] = useState(new Date());
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [hireType, setHireType] = useState("hour");
  const [duration, setDuration] = useState(1);
  const [serviceType, setServiceType] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [dailyStart, setDailyStart] = useState("08");
  const hourlyTotalPrice = useMemo(
    () =>
      hireType === "hour"
        ? getHourlyRate(diarista) * duration
        : 0,
    [hireType, duration, diarista]
  );

  const formatISODate = (selectedDate, hour, minute) => {
    const dateObj = new Date(selectedDate);
    dateObj.setHours(Number(hour), Number(minute), 0, 0);
    const offsetMinutes = dateObj.getTimezoneOffset();
    dateObj.setMinutes(dateObj.getMinutes() - offsetMinutes);
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetSign = offsetMinutes > 0 ? "-" : "+";
    const offsetFormatted = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(
      Math.abs(offsetMinutes % 60)
    ).padStart(2, "0")}`;

    return `${dateObj.toISOString().slice(0, -1)}${offsetFormatted}`;
  };

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("Token não encontrado!");
          return;
        }

        const response = await fetch(buildApiPathUrl(`/services/pending-schedules/${diarista.id}`), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data.pending_schedules && Array.isArray(data.pending_schedules)) {
          setSchedule(data.pending_schedules);
        } else {
          console.error("Formato de resposta inesperado:", data);
        }
      } catch (error) {
        console.error("Erro ao buscar o agendamento:", error);
      }
    };

    fetchSchedule();
  }, [diarista.id]);

  const scheduledTimestamps = useMemo(() => {
    return schedule.map((dateStr) => {
      const dateOnly = new Date(dateStr);
      dateOnly.setHours(0, 0, 0, 0);
      return dateOnly.getTime();
    });
  }, [schedule]);

  const disableDates = ({ date }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateTimestamp = new Date(date);
    selectedDateTimestamp.setHours(0, 0, 0, 0);

    return selectedDateTimestamp.getTime() < today.getTime() || scheduledTimestamps.includes(selectedDateTimestamp.getTime());
  };

  const hourOptions = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => String(8 + i).padStart(2, "0"));
  }, []);

  const minuteOptions = ["00", "30"];

  const handleDurationChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 1 && value <= 12) {
      setDuration(value);
    }
  };

  const handleHire = async () => {
    if (hireType === "hour" && (!hour || !minute)) {
      Modal.error({
        title: 'Campo obrigatório',
        content: 'Por favor, selecione um horário.',
      });
      return;
    }

    if (!serviceType.trim()) {
      Modal.error({
        title: 'Campo obrigatório',
        content: 'Descreva o tipo de serviço.',
      });
      return;
    }

    if (hireType === "hour" && (!duration || duration <= 0)) {
      Modal.error({
        title: 'Campo obrigatório',
        content: 'Informe a quantidade de horas.',
      });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      Modal.error({
        title: 'Não autenticado',
        content: 'Usuário não autenticado. Faça login novamente.',
      });
      return;
    }

    const selectedHour = hireType === "hour" ? hour : dailyStart;
    const selectedMinute = hireType === "hour" ? minute : "00";
    const scheduledAt = formatISODate(date, selectedHour, selectedMinute);
    const finalDuration = hireType === "hour" ? duration : 6;
    const totalPrice = getHourlyRate(diarista) * finalDuration;

    const requestBody = {
      diarist_id: diarista.id,
      address_id: getSelectedAddressId(selectedAddress),
      scheduled_at: scheduledAt,
      duration_hours: finalDuration,
      total_price: totalPrice,
      service_type: serviceType,
    };

    try {
      const response = await fetch(buildApiPathUrl("/services"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Erro ao contratar o serviço.");
      }

      message.success('Serviço contratado com sucesso!');
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (error) {
      console.error("Erro na contratação:", error);
      message.error('Falha ao contratar o serviço. Tente novamente.');
    }
  };

  return (
    <div className="order-container">
       <h2 className="h2">Tipo de contratação:</h2>
      <div className="hire-type-container">
        <label className="radio-option">
          <input
            type="radio"
            name="hireType"
            value="hour"
            checked={hireType === "hour"}
            onChange={() => setHireType("hour")}
          />
          <span className="custom-radio">{hireType === "hour" ? "\u23F1\uFE0F" : ""}</span>
          Por Hora
        </label>
        <label className="radio-option">
          <input
            type="radio"
            name="hireType"
            value="daily"
            checked={hireType === "daily"}
            onChange={() => setHireType("daily")}
          />
          <span className="custom-radio">{hireType === "daily" ? "\uD83D\uDCC5" : ""}</span>
          Diária
        </label>
      </div>
      
      <h2 className="h2">Selecione uma data:</h2>
      <Calendar onChange={setDate} value={date} tileDisabled={disableDates} />

      {hireType === "hour" ? (
        <>
          <h2 className="h2">Selecione o horário:</h2>
          <div className="time-select-container">
            <select value={hour} onChange={(e) => setHour(e.target.value)} className="time-select">
              <option value="">--</option>
              {hourOptions.map((hourOption, index) => (
                <option key={index} value={hourOption}>
                  {hourOption}
                </option>
              ))}
            </select>

            <span className="time-separator">:</span>

            <select value={minute} onChange={(e) => setMinute(e.target.value)} className="time-select">
              <option value="">--</option>
              {minuteOptions.map((minuteOption, index) => (
                <option key={index} value={minuteOption}>
                  {minuteOption}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <h2 className="h2">Início da diária:</h2>
          <div className="hire-type-container">
            <label className="radio-option">
              <input
                type="radio"
                name="dailyStart"
                value="08"
                checked={dailyStart === "08"}
                onChange={() => setDailyStart("08")}
              />
              <span className="custom-radio">{dailyStart === "08" ? "\u2600\uFE0F" : ""}</span>
              8h
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="dailyStart"
                value="09"
                checked={dailyStart === "09"}
                onChange={() => setDailyStart("09")}
              />
              <span className="custom-radio">{dailyStart === "09" ? "\u23F0" : ""}</span>
              9h
            </label>
          </div>
          <p className="daily-info">
            A diária tem duração de 6 horas de trabalho e 1 hora para almoço.
          </p>
        </>
      )}

     

      <h2 className="h2">Tipo de serviço:</h2>
      <input
        type="text"
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value)}
        className="service-input"
        placeholder="Ex: Limpeza geral da casa"
      />

        {hireType === "hour" && (
          <>
            <h2 className="h2">Quantidade de horas:</h2>
            <input
              type="number"
              value={duration}
              onChange={handleDurationChange}
              min="1"
              max="12"
              className="duration-input"
            />
            <p className="total-price">
              Valor total: R$ {hourlyTotalPrice.toFixed(2)}
            </p>
          </>
        )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button className="hire-button" onClick={handleHire}>
          Enviar contratação
        </button>
      </div>
    </div>
  );
}

// Exportar ambas as versões para compatibilidade
export { OrderLegacy };

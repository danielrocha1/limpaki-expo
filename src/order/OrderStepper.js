import { useState, useEffect, useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./order-stepper.css";
import { useAddress } from "../context/address";
import { Modal, message } from 'antd';
import { buildApiPathUrl } from "../config/api";

const getDiaristProfile = (diarista = {}) => diarista?.diarist_profile || diarista?.diaristas?.[0] || {};
const getHourlyRate = (diarista = {}) =>
  Number(getDiaristProfile(diarista).price_per_hour || getDiaristProfile(diarista).PricePerHour || 0);
const getSelectedAddressId = (address = {}) => address?.id || address?.ID;
const getSelectedAddressStreet = (address = {}) => address?.street || address?.Street || "Endereço não informado";

const icons = {
  hour: "\u23F1\uFE0F",
  daily: "\uD83D\uDCC5",
  morning: "\u2600\uFE0F",
  clock: "\u23F0",
  location: "\uD83D\uDCCD",
  date: "\uD83D\uDCC6",
  duration: "\u23F3",
  service: "\uD83E\uDDF9",
  money: "\uD83D\uDCB0",
  back: "\u2190",
  next: "\u2192",
};

export default function OrderStepper({ diarista, onClose }) {
  const { selectedAddress } = useAddress();

  const [currentStep, setCurrentStep] = useState(1);
  const [date, setDate] = useState(new Date());
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [hireType, setHireType] = useState("hour");
  const [duration, setDuration] = useState(1);
  const [serviceType, setServiceType] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [dailyStart, setDailyStart] = useState("08");
  const [isLoading, setIsLoading] = useState(false);

  const hourlyTotalPrice = useMemo(
    () =>
      hireType === "hour"
        ? getHourlyRate(diarista) * duration
        : getHourlyRate(diarista) * 6,
    [hireType, duration, diarista]
  );

  const formatISODate = (selectedDate, selectedHour, selectedMinute) => {
    const dateObj = new Date(selectedDate);
    dateObj.setHours(Number(selectedHour), Number(selectedMinute), 0, 0);
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

  const disableDates = ({ date: day }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateTimestamp = new Date(day);
    selectedDateTimestamp.setHours(0, 0, 0, 0);

    return (
      selectedDateTimestamp.getTime() < today.getTime() ||
      scheduledTimestamps.includes(selectedDateTimestamp.getTime())
    );
  };

  const hourOptions = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => String(8 + i).padStart(2, "0"));
  }, []);

  const minuteOptions = ["00", "30"];

  const handleDurationChange = (delta) => {
    const newDuration = duration + delta;
    if (newDuration >= 1 && newDuration <= 12) {
      setDuration(newDuration);
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

    const trimmedServiceType = serviceType.trim();

    if (!trimmedServiceType) {
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

    setIsLoading(true);

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
      service_type: trimmedServiceType,
    };

    try {
      console.log("Request Body enviado:", requestBody);

      const response = await fetch(buildApiPathUrl("/services"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log("Erro retornado pela API:", data);
        throw new Error(data?.error || "Erro ao contratar o serviço.");
      }

      console.log("Resposta da API:", data);

      message.success('Serviço contratado com sucesso!');
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);

    } catch (error) {
      console.log("Request Body que causou erro:", requestBody);
      console.error("Erro na contratação:", error);

      message.error(error.message || 'Falha ao contratar o serviço. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const isStep1Valid = hireType !== "";
  const isStep2Valid = date !== null;
  const isStep3Valid =
    hireType === "daily"
      ? dailyStart !== ""
      : hour !== "" && minute !== "" && duration > 0;
  const isStep4Valid = serviceType.trim() !== "";

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid) setCurrentStep(2);
    else if (currentStep === 2 && isStep2Valid) setCurrentStep(3);
    else if (currentStep === 3 && isStep3Valid) setCurrentStep(4);
    else if (currentStep === 4 && isStep4Valid) setCurrentStep(5);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const formatDate = (d) => {
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="order-stepper-container">
      <div className="stepper-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          ></div>
        </div>
        <div className="progress-steps">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`progress-step ${
                step <= currentStep ? "active" : ""
              } ${step === currentStep ? "current" : ""}`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      <div className="stepper-content">
        {currentStep === 1 && (
          <div className="step-container">
            <div className="step-header">
              <h2 className="step-title">Qual tipo de serviço?</h2>
              <p className="step-subtitle">
                Escolha entre contratação por hora ou diária.
              </p>
            </div>

            <div className="step-options">
              <label className="option-card">
                <input
                  type="radio"
                  name="hireType"
                  value="hour"
                  checked={hireType === "hour"}
                  onChange={() => setHireType("hour")}
                />
                <div className="option-content">
                  <div className="option-icon">{icons.hour}</div>
                  <div className="option-text">
                    <h3>Por hora</h3>
                    <p>Contrate o tempo que precisar.</p>
                  </div>
                </div>
              </label>

              <label className="option-card">
                <input
                  type="radio"
                  name="hireType"
                  value="daily"
                  checked={hireType === "daily"}
                  onChange={() => setHireType("daily")}
                />
                <div className="option-content">
                  <div className="option-icon">{icons.daily}</div>
                  <div className="option-text">
                    <h3>Diária</h3>
                    <p>6 horas de trabalho + 1 hora de almoço.</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-container">
            <div className="step-header">
              <h2 className="step-title">Quando você precisa?</h2>
              <p className="step-subtitle">Selecione a data desejada.</p>
            </div>

            <div className="calendar-wrapper">
              <Calendar onChange={setDate} value={date} tileDisabled={disableDates} />
            </div>

            <div className="selected-date">
              <p>
                <strong>Data selecionada:</strong> {formatDate(date)}
              </p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-container">
            {hireType === "hour" ? (
              <>
                <div className="step-header">
                  <h2 className="step-title">Qual horário?</h2>
                  <p className="step-subtitle">
                    Selecione a hora e a duração do serviço.
                  </p>
                </div>

                <div className="time-section">
                  <label className="form-label">Horário de início</label>
                  <div className="time-picker">
                    <select
                      value={hour}
                      onChange={(e) => setHour(e.target.value)}
                      className="time-input"
                    >
                      <option value="">Hora</option>
                      {hourOptions.map((hourOption, index) => (
                        <option key={index} value={hourOption}>
                          {hourOption}h
                        </option>
                      ))}
                    </select>

                    <select
                      value={minute}
                      onChange={(e) => setMinute(e.target.value)}
                      className="time-input"
                    >
                      <option value="">Minutos</option>
                      {minuteOptions.map((minuteOption, index) => (
                        <option key={index} value={minuteOption}>
                          {minuteOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="duration-section">
                  <label className="form-label">Duração (horas)</label>
                  <div className="duration-stepper">
                    <button
                      className="stepper-btn"
                      onClick={() => handleDurationChange(-1)}
                      disabled={duration <= 1}
                    >
                      -
                    </button>
                    <span className="duration-value">{duration}h</span>
                    <button
                      className="stepper-btn"
                      onClick={() => handleDurationChange(1)}
                      disabled={duration >= 12}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="price-preview">
                  <p className="price-label">Valor estimado:</p>
                  <p className="price-value">R$ {hourlyTotalPrice.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="step-header">
                  <h2 className="step-title">Início da diária</h2>
                  <p className="step-subtitle">
                    Escolha o horário de início (6 horas de trabalho + 1 hora de almoço).
                  </p>
                </div>

                <div className="step-options">
                  <label className="option-card">
                    <input
                      type="radio"
                      name="dailyStart"
                      value="08"
                      checked={dailyStart === "08"}
                      onChange={() => setDailyStart("08")}
                    />
                    <div className="option-content">
                      <div className="option-icon">{icons.morning}</div>
                      <div className="option-text">
                        <h3>8h da manhã</h3>
                        <p>Término às 15h.</p>
                      </div>
                    </div>
                  </label>

                  <label className="option-card">
                    <input
                      type="radio"
                      name="dailyStart"
                      value="09"
                      checked={dailyStart === "09"}
                      onChange={() => setDailyStart("09")}
                    />
                    <div className="option-content">
                      <div className="option-icon">{icons.clock}</div>
                      <div className="option-text">
                        <h3>9h da manhã</h3>
                        <p>Término às 16h.</p>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="price-preview">
                  <p className="price-label">Valor da diária:</p>
                  <p className="price-value">R$ {hourlyTotalPrice.toFixed(2)}</p>
                </div>
              </>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="step-container">
            <div className="step-header">
              <h2 className="step-title">O que precisa ser feito?</h2>
              <p className="step-subtitle">
                Descreva o tipo de serviço que você precisa.
              </p>
            </div>

            <div className="form-group">
              <textarea
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="service-textarea"
                placeholder="Ex.: limpeza geral da casa, organização dos quartos ou limpeza da cozinha."
                rows="6"
                maxLength={500}
              />
              <div className="service-textarea-counter">
                {serviceType.length}/500
              </div>
            </div>

            <div className="address-info">
              <p className="info-label">{icons.location} Local do serviço:</p>
              <p className="info-value">
                {getSelectedAddressStreet(selectedAddress)}
              </p>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="step-container">
            <div className="step-header">
              <h2 className="step-title">Confirme sua contratação</h2>
              <p className="step-subtitle">Revise os detalhes antes de confirmar.</p>
            </div>

            <div className="review-card">
              <div className="review-item">
                <span className="review-label">{icons.date} Data:</span>
                <span className="review-value">{formatDate(date)}</span>
              </div>

              <div className="review-item">
                <span className="review-label">{icons.clock} Horário:</span>
                <span className="review-value">
                  {hireType === "hour"
                    ? `${hour}:${minute}`
                    : `${dailyStart}:00`}
                </span>
              </div>

              <div className="review-item">
                <span className="review-label">{icons.duration} Duração:</span>
                <span className="review-value">
                  {hireType === "hour" ? `${duration}h` : "6h + 1h de almoço"}
                </span>
              </div>

              <div className="review-item">
                <span className="review-label">{icons.service} Serviço:</span>
                <span className="review-value">{serviceType}</span>
              </div>

              <div className="review-item">
                <span className="review-label">{icons.location} Local:</span>
                <span className="review-value">
                  {getSelectedAddressStreet(selectedAddress)}
                </span>
              </div>

              <div className="review-divider"></div>

              <div className="review-item total">
                <span className="review-label">{icons.money} Valor total:</span>
                <span className="review-value-total">
                  R$ {hourlyTotalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="stepper-actions">
        {currentStep > 1 && (
          <button className="btn-secondary" onClick={handlePrevStep}>
            {icons.back} Voltar
          </button>
        )}

        {currentStep < 5 && (
          <button
            className="btn-primary"
            onClick={handleNextStep}
            disabled={
              (currentStep === 1 && !isStep1Valid) ||
              (currentStep === 2 && !isStep2Valid) ||
              (currentStep === 3 && !isStep3Valid) ||
              (currentStep === 4 && !isStep4Valid)
            }
          >
            Próximo {icons.next}
          </button>
        )}

        {currentStep === 5 && (
          <button
            className="btn-success"
            onClick={handleHire}
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : "Confirmar contratação"}
          </button>
        )}
      </div>
    </div>
  );
}

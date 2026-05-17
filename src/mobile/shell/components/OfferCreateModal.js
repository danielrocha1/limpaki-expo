import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../../config/api";
import { palette, styles } from "../AppShell.styles";
import { formatAddress, formatCurrency, normalizeAddress, sanitizeTimeDigits } from "../utils/shellUtils";

const OFFER_CREATE_TOTAL_STEPS = 5;
const OFFER_START_HOUR = 8;
const OFFER_END_HOUR = 20;
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const OFFER_SERVICE_TYPE_OPTIONS = [
  {
    value: "Limpeza padrão",
    label: "Limpeza padrão",
    icon: "home",
    copy: "Limpeza do dia a dia",
  },
  {
    value: "Limpeza pesada",
    label: "Limpeza pesada",
    icon: "layers",
    copy: "Sujeira acumulada ou areas dificeis",
  },
  {
    value: "Pós-obra",
    label: "Pós-obra",
    icon: "tool",
    copy: "Pos-reforma ou construcao",
  },
  {
    value: "Passadoria",
    label: "Passadoria",
    icon: "wind",
    copy: "Roupas e tecidos",
  },
];
const OFFER_TIME_OPTIONS = Array.from(
  { length: (OFFER_END_HOUR - OFFER_START_HOUR) * 2 + 1 },
  (_, index) => {
    const totalMinutes = OFFER_START_HOUR * 60 + index * 30;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minute = String(totalMinutes % 60).padStart(2, "0");
    return `${hour}:${minute}`;
  },
);

function normalizeOfferCreateTime(hourInput, minuteInput) {
  let hour = Number.parseInt(sanitizeTimeDigits(hourInput), 10);
  let minute = Number.parseInt(sanitizeTimeDigits(minuteInput), 10);

  if (!Number.isFinite(hour)) {
    hour = OFFER_START_HOUR;
  }
  if (!Number.isFinite(minute)) {
    minute = 0;
  }

  hour = Math.min(OFFER_END_HOUR, Math.max(OFFER_START_HOUR, hour));
  minute = minute >= 15 && minute < 45 ? 30 : 0;
  if (hour === OFFER_END_HOUR) {
    minute = 0;
  }

  return {
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
}

const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultOfferDateTime = () => {
  const now = new Date();
  const todayAtEight = new Date(now);
  todayAtEight.setHours(OFFER_START_HOUR, 0, 0, 0);

  if (now < todayAtEight) {
    return todayAtEight;
  }

  const tomorrowAtEight = new Date(todayAtEight);
  tomorrowAtEight.setDate(tomorrowAtEight.getDate() + 1);
  return tomorrowAtEight;
};

const buildOfferSchedule = (serviceDate, serviceTime) => {
  const dateParts = String(serviceDate || "")
    .split("-")
    .map((value) => Number(value));
  const timeParts = String(serviceTime || "08:00")
    .split(":")
    .map((value) => Number(value));
  const [year, month, day] = dateParts;
  const [hours = 0, minutes = 0] = timeParts;

  if (!year || !month || !day) {
    return new Date(Number.NaN);
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const normalizeNumericInput = (value) => Number(String(value || "").replace(",", "."));

const getDayStart = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

function formatOfferLongDate(dateValue) {
  const scheduled = buildOfferSchedule(dateValue, "12:00");
  if (Number.isNaN(scheduled.getTime())) {
    return "Data invalida";
  }
  return scheduled.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function OfferCreateModal({ visible, activeAddress, onClose, onCreated }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createCalendarMonth, setCreateCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [createForm, setCreateForm] = useState({
    serviceType: "Limpeza padrão",
    serviceDate: "",
    serviceTime: "08:00",
    hours: "4",
    value: "",
    observations: "",
  });
  const [offerTimeHourInput, setOfferTimeHourInput] = useState("08");
  const [offerTimeMinuteInput, setOfferTimeMinuteInput] = useState("00");

  const addressLabel = formatAddress(normalizeAddress(activeAddress || {})) || "Endereco nao informado";
  const todayStart = useMemo(() => getDayStart(new Date()), []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCurrentStep(1);
    const defaultDateTime = getDefaultOfferDateTime();
    setCreateCalendarMonth(new Date(defaultDateTime.getFullYear(), defaultDateTime.getMonth(), 1));
    setCreateForm({
      serviceType: "Limpeza padrão",
      serviceDate: "",
      serviceTime: "08:00",
      hours: "4",
      value: "",
      observations: "",
    });
    setOfferTimeHourInput("08");
    setOfferTimeMinuteInput("00");
  }, [visible]);

  const createCalendarMonthTitle = useMemo(() => {
    return createCalendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [createCalendarMonth]);

  const createCalendarDays = useMemo(() => {
    const year = createCalendarMonth.getFullYear();
    const month = createCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const days = [];

    for (let index = 0; index < startOffset; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      days.push(new Date(year, month, day));
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [createCalendarMonth]);

  const isCreateDatePast = (value) => getDayStart(value).getTime() < todayStart.getTime();

  const createDateOk = useMemo(() => {
    if (!createForm.serviceDate) {
      return false;
    }
    const scheduled = buildOfferSchedule(createForm.serviceDate, "12:00");
    return !Number.isNaN(scheduled.getTime()) && !isCreateDatePast(scheduled);
  }, [createForm.serviceDate, todayStart]);

  const offerTimeOptions = useMemo(() => {
    const now = new Date();

    return OFFER_TIME_OPTIONS.map((timeValue) => {
      const scheduledAt = buildOfferSchedule(createForm.serviceDate, timeValue);
      const disabled =
        !createForm.serviceDate ||
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt < now ||
        scheduledAt.getHours() < OFFER_START_HOUR ||
        scheduledAt.getHours() > OFFER_END_HOUR;

      return {
        value: timeValue,
        label: timeValue,
        disabled,
      };
    });
  }, [createForm.serviceDate]);

  const parsedOfferCreateTime = useMemo(() => {
    const raw = createForm.serviceTime || "08:00";
    const [hRaw, mRaw] = raw.split(":");
    return normalizeOfferCreateTime(hRaw, mRaw);
  }, [createForm.serviceTime]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setOfferTimeHourInput(parsedOfferCreateTime.hour);
    setOfferTimeMinuteInput(parsedOfferCreateTime.minute);
  }, [visible, parsedOfferCreateTime.hour, parsedOfferCreateTime.minute]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const [h, m] = (createForm.serviceTime || "").split(":");
    if (h === "20" && m === "30") {
      setCreateForm((current) => ({ ...current, serviceTime: "20:00" }));
    }
  }, [visible, createForm.serviceTime]);

  useEffect(() => {
    if (!visible || !createForm.serviceDate) {
      return;
    }

    const selectedTime = offerTimeOptions.find((option) => option.value === createForm.serviceTime);
    if (selectedTime && !selectedTime.disabled) {
      return;
    }

    const nextAvailableTime = offerTimeOptions.find((option) => !option.disabled)?.value || "";
    setCreateForm((current) => ({
      ...current,
      serviceTime: nextAvailableTime,
    }));
  }, [createForm.serviceDate, createForm.serviceTime, visible, offerTimeOptions]);

  const commitOfferCreateTimeInputs = (hourDraft = offerTimeHourInput, minuteDraft = offerTimeMinuteInput) => {
    const { hour, minute } = normalizeOfferCreateTime(hourDraft, minuteDraft);
    setOfferTimeHourInput(hour);
    setOfferTimeMinuteInput(minute);
    setCreateForm((current) => ({ ...current, serviceTime: `${hour}:${minute}` }));
  };

  const isTimeOptionValid = useMemo(() => {
    const selected = offerTimeOptions.find((option) => option.value === createForm.serviceTime);
    return Boolean(selected && !selected.disabled);
  }, [createForm.serviceTime, offerTimeOptions]);

  const scheduledAtPreview = useMemo(() => {
    return buildOfferSchedule(createForm.serviceDate, createForm.serviceTime || "08:00");
  }, [createForm.serviceDate, createForm.serviceTime]);

  const isStep1Valid = Boolean(createForm.serviceType);
  const isStep2Valid = createDateOk && isTimeOptionValid;
  const durationHoursPreview = normalizeNumericInput(createForm.hours);
  const initialValuePreview = normalizeNumericInput(createForm.value);
  const hasValueInput = createForm.value.trim().length > 0;
  const isStep3Valid =
    Number.isFinite(durationHoursPreview) &&
    durationHoursPreview >= 1 &&
    hasValueInput &&
    Number.isFinite(initialValuePreview) &&
    initialValuePreview > 0;
  const isStep4Valid = createForm.observations.trim().length > 0;

  const handleCreateMonthChange = (offset) => {
    setCreateCalendarMonth((previousMonth) => {
      return new Date(previousMonth.getFullYear(), previousMonth.getMonth() + offset, 1);
    });
  };

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      commitOfferCreateTimeInputs();
      if (isStep2Valid) {
        setCurrentStep(3);
      }
      return;
    }
    if (currentStep === 3 && isStep3Valid) {
      setCurrentStep(4);
      return;
    }
    if (currentStep === 4 && isStep4Valid) {
      setCurrentStep(5);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((value) => value - 1);
    }
  };

  const handlePublishOffer = async () => {
    const addressId = activeAddress?.id || activeAddress?.ID;
    if (!addressId) {
      Alert.alert("Endereco obrigatorio", "Selecione ou cadastre um endereco antes de criar uma oferta.");
      return;
    }

    commitOfferCreateTimeInputs();

    if (!createForm.serviceDate || !createForm.serviceTime || !createForm.hours || !createForm.value) {
      Alert.alert("Campos obrigatorios", "Preencha data, hora, duracao e valor.");
      return;
    }

    const scheduledAt = buildOfferSchedule(createForm.serviceDate, createForm.serviceTime);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      Alert.alert("Agenda invalida", "Escolha uma data e horario validos.");
      return;
    }

    const durationHours = normalizeNumericInput(createForm.hours);
    const initialValue = normalizeNumericInput(createForm.value);
    if (!Number.isFinite(durationHours) || durationHours < 1) {
      Alert.alert("Duracao invalida", "Informe uma duracao minima de 1 hora.");
      return;
    }

    if (!Number.isFinite(initialValue) || initialValue <= 0) {
      Alert.alert("Valor invalido", "Informe um valor inicial maior que zero.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiFetch("/offers", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_type: createForm.serviceType || "Limpeza padrão",
          scheduled_at: scheduledAt.toISOString(),
          duration_hours: durationHours,
          initial_value: initialValue,
          address_id: addressId,
          observations: createForm.observations || "",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Nao foi possivel criar a oferta.");
      }

      onCreated?.();
      onClose?.();
      Alert.alert("Oferta criada", "Oferta criada com sucesso!");
    } catch (error) {
      Alert.alert("Erro ao criar oferta", error.message || "Nao foi possivel criar a oferta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.orderShell}>
        <View style={styles.orderHeader}>
          <TouchableOpacity style={styles.orderCloseButton} onPress={onClose}>
            <Feather name="x" size={18} color={palette.ink} />
          </TouchableOpacity>
          <Text style={styles.orderTitle}>Criar nova oferta</Text>
          <Text style={styles.orderSubtitle} numberOfLines={2}>
            {addressLabel}
          </Text>
        </View>

        <View style={styles.orderProgressTrack}>
          <View
            style={[styles.orderProgressFill, { width: `${(currentStep / OFFER_CREATE_TOTAL_STEPS) * 100}%` }]}
          />
        </View>
        <View style={styles.orderProgressSteps}>
          {[1, 2, 3, 4, 5].map((step) => (
            <View
              key={step}
              style={[
                styles.orderProgressStep,
                step <= currentStep && styles.orderProgressStepActive,
                step === currentStep && styles.orderProgressStepCurrent,
              ]}
            >
              <Text
                style={[styles.orderProgressStepText, step <= currentStep && styles.orderProgressStepTextActive]}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.orderBody} contentContainerStyle={styles.orderBodyContent}>
          {currentStep === 1 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Tipo de servico</Text>
              <Text style={styles.orderSectionCopy}>Escolha a categoria principal da limpeza.</Text>
              <View style={styles.offerCreateServiceGrid}>
                {OFFER_SERVICE_TYPE_OPTIONS.map((option) => {
                  const selected = createForm.serviceType === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.85}
                      style={[
                        styles.offerCreateServiceCard,
                        selected && styles.offerCreateServiceCardActive,
                      ]}
                      onPress={() => setCreateForm((current) => ({ ...current, serviceType: option.value }))}
                    >
                      <View
                        style={[
                          styles.offerCreateServiceIconWrap,
                          selected && styles.offerCreateServiceIconWrapActive,
                        ]}
                      >
                        <Feather
                          name={option.icon}
                          size={22}
                          color={selected ? palette.accent : palette.muted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.offerCreateServiceCardTitle,
                          selected && styles.offerCreateServiceCardTitleActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.offerCreateServiceCardCopy}>{option.copy}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {currentStep === 2 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>
                {createDateOk ? "Horario de inicio" : "Quando sera o servico?"}
              </Text>
              <Text style={styles.orderSectionCopy}>
                {createDateOk
                  ? "Confirme o horario de inicio para o dia selecionado."
                  : "Selecione a data no calendario. Depois voce informa o horario."}
              </Text>

              {!createDateOk ? (
                <>
                  <View style={styles.orderCalendarCard}>
                    <View style={styles.orderCalendarHeader}>
                      <TouchableOpacity
                        style={styles.orderCalendarNavButton}
                        onPress={() => handleCreateMonthChange(-1)}
                      >
                        <Text style={styles.orderCalendarNavButtonText}>{"<"}</Text>
                      </TouchableOpacity>
                      <Text style={styles.orderCalendarMonthLabel}>{createCalendarMonthTitle}</Text>
                      <TouchableOpacity
                        style={styles.orderCalendarNavButton}
                        onPress={() => handleCreateMonthChange(1)}
                      >
                        <Text style={styles.orderCalendarNavButtonText}>{">"}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.orderCalendarWeekRow}>
                      {WEEKDAY_LABELS.map((weekday) => (
                        <Text key={weekday} style={styles.orderCalendarWeekday}>
                          {weekday}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.orderCalendarGrid}>
                      {createCalendarDays.map((day, index) => {
                        if (!day) {
                          return <View key={`empty-${index}`} style={styles.orderCalendarCellEmpty} />;
                        }

                        const dateValue = formatDateInputValue(day);
                        const isSelected = createForm.serviceDate === dateValue;
                        const past = isCreateDatePast(day);

                        return (
                          <View key={dateValue} style={styles.orderCalendarCell}>
                            <TouchableOpacity
                              style={[
                                styles.orderCalendarCellButton,
                                past && styles.orderCalendarCellPast,
                                isSelected && !past && styles.orderCalendarCellSelected,
                                past && styles.orderCalendarCellDisabled,
                              ]}
                              onPress={() => {
                                if (!past) {
                                  setCreateForm((current) => ({
                                    ...current,
                                    serviceDate: dateValue,
                                  }));
                                }
                              }}
                              disabled={past}
                            >
                              <Text
                                style={[
                                  styles.orderCalendarCellText,
                                  past && styles.orderCalendarCellPastText,
                                  isSelected && !past && styles.orderCalendarCellSelectedText,
                                ]}
                              >
                                {day.getDate()}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={styles.orderHint}>Toque em um dia disponivel para continuar.</Text>
                </>
              ) : (
                <>
                  <View style={styles.orderSelectedDateCard}>
                    <Text style={styles.orderSelectedDateLabel}>Data selecionada</Text>
                    <Text style={styles.orderSelectedDateValue}>{formatOfferLongDate(createForm.serviceDate)}</Text>
                    <TouchableOpacity
                      onPress={() => setCreateForm((current) => ({ ...current, serviceDate: "" }))}
                      accessibilityRole="button"
                    >
                      <Text style={styles.orderSelectedDateChange}>Alterar data</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.offerCreateTimeHelp}>
                    Informe hora e minutos (intervalos de 30 min: 00 ou 30). Horario permitido: das {OFFER_START_HOUR}h
                    às {OFFER_END_HOUR}h.
                  </Text>

                  <View style={styles.offerCreateTimeInputRow}>
                    <View style={styles.offerCreateTimeInputWrap}>
                      <Text style={styles.offerCreateFieldLabel}>Hora</Text>
                      <TextInput
                        style={[styles.modalInput, styles.offerCreateTimeInput]}
                        value={offerTimeHourInput}
                        onChangeText={(value) => setOfferTimeHourInput(sanitizeTimeDigits(value))}
                        onBlur={() => commitOfferCreateTimeInputs()}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="08"
                        returnKeyType="next"
                      />
                    </View>
                    <Text style={styles.offerCreateTimeInputSeparator}>:</Text>
                    <View style={styles.offerCreateTimeInputWrap}>
                      <Text style={styles.offerCreateFieldLabel}>Minutos</Text>
                      <TextInput
                        style={[styles.modalInput, styles.offerCreateTimeInput]}
                        value={offerTimeMinuteInput}
                        onChangeText={(value) => setOfferTimeMinuteInput(sanitizeTimeDigits(value))}
                        onBlur={() => commitOfferCreateTimeInputs()}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="00"
                        returnKeyType="done"
                        onSubmitEditing={() => commitOfferCreateTimeInputs()}
                      />
                    </View>
                  </View>
                  {!isTimeOptionValid ? (
                    <Text style={styles.errorText}>Horario invalido ou no passado. Escolha outro horario.</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {currentStep === 3 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Duracao e valor</Text>
              <Text style={styles.orderSectionCopy}>
                Defina a duracao estimada do servico e o valor inicial da oferta.
              </Text>
              <View style={styles.offerCreateInputRow}>
                <View style={styles.offerCreateInputColumn}>
                  <Text style={styles.offerCreateFieldLabel}>Duracao (horas)</Text>
                  <TextInput
                    style={[styles.modalInput, styles.offerCreateModalInput]}
                    placeholder="4"
                    keyboardType="numeric"
                    value={createForm.hours}
                    onChangeText={(value) => setCreateForm((current) => ({ ...current, hours: value }))}
                  />
                </View>
                <View style={styles.offerCreateInputColumn}>
                  <Text style={styles.offerCreateFieldLabel}>Valor (R$)</Text>
                  <TextInput
                    style={[styles.modalInput, styles.offerCreateModalInput]}
                    placeholder="Ex.: 120,00"
                    keyboardType="decimal-pad"
                    value={createForm.value}
                    onChangeText={(value) => setCreateForm((current) => ({ ...current, value }))}
                  />
                </View>
              </View>
              {!isStep3Valid && hasValueInput && (!Number.isFinite(initialValuePreview) || initialValuePreview <= 0) ? (
                <Text style={styles.errorText}>Informe um valor inicial maior que zero.</Text>
              ) : null}
              {!hasValueInput ? (
                <Text style={styles.orderHint}>Preencha o valor para continuar.</Text>
              ) : null}
            </View>
          ) : null}

          {currentStep === 4 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Observacoes</Text>
              <Text style={styles.orderSectionCopy}>
                Descreva detalhes para a diarista. No proximo passo voce confere o resumo da oferta.
              </Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea, styles.offerCreateModalInput]}
                placeholder="Ex.: apartamento com pets, foco na cozinha..."
                multiline
                value={createForm.observations}
                onChangeText={(value) => setCreateForm((current) => ({ ...current, observations: value }))}
              />
            </View>
          ) : null}

          {currentStep === 5 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Revise sua oferta</Text>
              <Text style={styles.orderSectionCopy}>
                Confira os dados abaixo. Se estiver tudo certo, publique a oferta.
              </Text>
              <View style={styles.orderReviewCard}>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>🧽 Servico</Text>
                  <Text style={styles.orderReviewValue}>{createForm.serviceType}</Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>📅 Data e hora</Text>
                  <Text style={styles.orderReviewValue}>
                    {!Number.isNaN(scheduledAtPreview.getTime())
                      ? `${scheduledAtPreview.toLocaleDateString("pt-BR")} · ${createForm.serviceTime}`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>⏳ Duracao</Text>
                  <Text style={styles.orderReviewValue}>{createForm.hours || "—"}h</Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>📍 Endereco</Text>
                  <Text style={styles.orderReviewValue}>{addressLabel}</Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>📝 Observacoes</Text>
                  <Text style={styles.orderReviewValue}>{createForm.observations.trim()}</Text>
                </View>
                <View style={styles.orderReviewDivider} />
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>💰 Valor inicial</Text>
                  <Text style={styles.orderReviewValueTotal}>
                    {Number.isFinite(initialValuePreview) ? formatCurrency(initialValuePreview) : "—"}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.orderActions}>
          {currentStep > 1 ? (
            <TouchableOpacity style={styles.orderSecondaryButton} onPress={handlePrevStep}>
              <Text style={styles.orderSecondaryButtonText}>Voltar</Text>
            </TouchableOpacity>
          ) : null}
          {currentStep < OFFER_CREATE_TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.orderPrimaryButton, styles.orderNextButton]}
              onPress={handleNextStep}
              disabled={
                (currentStep === 1 && !isStep1Valid) ||
                (currentStep === 2 && !isStep2Valid) ||
                (currentStep === 3 && !isStep3Valid) ||
                (currentStep === 4 && !isStep4Valid)
              }
            >
              <Text style={styles.orderPrimaryButtonText}>Proximo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.orderSuccessButton} onPress={handlePublishOffer} disabled={submitting}>
              <Text style={styles.orderPrimaryButtonText}>
                {submitting ? "Publicando..." : "Publicar oferta"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

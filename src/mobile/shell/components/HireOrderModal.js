import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../../config/api";
import { palette, styles } from "../AppShell.styles";
import {
  ORDER_HOUR_OPTIONS,
  ORDER_MINUTE_OPTIONS,
  buildOrderIsoDate,
  formatDateInputValue,
  formatCurrency,
  formatLongDate,
  getDiaristPricePerHour,
  getSelectedAddressId,
  getSelectedAddressStreet,
} from "../utils/shellUtils";
export default function HireOrderModal({ visible, diarist, selectedAddress, onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [date, setDate] = useState(new Date());
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [hireType, setHireType] = useState("hour");
  const [duration, setDuration] = useState(1);
  const [serviceType, setServiceType] = useState("");
  const [dailyStart, setDailyStart] = useState("08");
  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !diarist) {
      return;
    }

    setCurrentStep(1);
    setDate(new Date());
    setHour("");
    setMinute("");
    setHireType("hour");
    setDuration(1);
    setServiceType("");
    setDailyStart("08");
  }, [visible, diarist]);

  useEffect(() => {
    let cancelled = false;

    const loadSchedule = async () => {
      if (!visible || !diarist?.id) {
        if (!cancelled) {
          setSchedule([]);
          setScheduleLoading(false);
        }
        return;
      }

      setScheduleLoading(true);
      try {
        const response = await apiFetch(`/services/pending-schedules/${diarist.id}`, {
          authenticated: true,
        });
        const data = await response.json().catch(() => ({}));
        if (!cancelled) {
          setSchedule(Array.isArray(data?.pending_schedules) ? data.pending_schedules : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setSchedule([]);
        }
      } finally {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      }
    };

    void loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [visible, diarist]);

  const hourlyTotalPrice = useMemo(() => {
    if (!diarist) return 0;
    return hireType === "hour" ? getDiaristPricePerHour(diarist) * duration : getDiaristPricePerHour(diarist) * 6;
  }, [diarist, duration, hireType]);

  const disabledDateSet = useMemo(() => {
    return new Set(
      schedule.map((value) => {
        const parsedDate = new Date(value);
        parsedDate.setHours(0, 0, 0, 0);
        return parsedDate.getTime();
      }),
    );
  }, [schedule]);

  const currentDateValue = formatDateInputValue(date);
  const isSelectedDateBlocked = useMemo(() => {
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);
    return disabledDateSet.has(currentDate.getTime());
  }, [date, disabledDateSet]);

  const isStep1Valid = Boolean(hireType);
  const isStep2Valid = Boolean(currentDateValue) && !isSelectedDateBlocked;
  const isStep3Valid = hireType === "daily" ? Boolean(dailyStart) : Boolean(hour && minute && duration > 0);
  const isStep4Valid = serviceType.trim().length > 0;

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid) setCurrentStep(2);
    if (currentStep === 2 && isStep2Valid) setCurrentStep(3);
    if (currentStep === 3 && isStep3Valid) setCurrentStep(4);
    if (currentStep === 4 && isStep4Valid) setCurrentStep(5);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((value) => value - 1);
    }
  };

  const handleDurationChange = (delta) => {
    const nextDuration = duration + delta;
    if (nextDuration >= 1 && nextDuration <= 12) {
      setDuration(nextDuration);
    }
  };

  const handleConfirmHire = async () => {
    if (!diarist?.id) {
      Alert.alert("Diarista invalida", "Nao foi possivel identificar a diarista selecionada.");
      return;
    }

    if (!getSelectedAddressId(selectedAddress)) {
      Alert.alert("Endereco obrigatorio", "Selecione um endereco valido antes de contratar.");
      return;
    }

    if (hireType === "hour" && (!hour || !minute)) {
      Alert.alert("Horario obrigatorio", "Selecione um horario para continuar.");
      return;
    }

    if (!serviceType.trim()) {
      Alert.alert("Servico obrigatorio", "Descreva o tipo de servico.");
      return;
    }

    try {
      setSubmitting(true);
      const selectedHour = hireType === "hour" ? hour : dailyStart;
      const selectedMinute = hireType === "hour" ? minute : "00";
      const finalDuration = hireType === "hour" ? duration : 6;
      const scheduledAt = buildOrderIsoDate(date, selectedHour, selectedMinute);
      const response = await apiFetch("/services", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diarist_id: diarist.id,
          address_id: getSelectedAddressId(selectedAddress),
          scheduled_at: scheduledAt,
          duration_hours: finalDuration,
          total_price: getDiaristPricePerHour(diarist) * finalDuration,
          service_type: serviceType.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel concluir a contratacao.");
      }

      Alert.alert("Contratacao realizada", "Servico contratado com sucesso.");
      onSuccess?.();
      onClose?.();
    } catch (error) {
      Alert.alert("Erro na contratacao", error.message || "Nao foi possivel contratar o servico.");
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
          <Text style={styles.orderTitle}>Contratar diarista</Text>
          <Text style={styles.orderSubtitle}>{diarist?.name || "Diarista selecionada"}</Text>
        </View>

        <View style={styles.orderProgressTrack}>
          <View style={[styles.orderProgressFill, { width: `${(currentStep / 5) * 100}%` }]} />
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
                style={[
                  styles.orderProgressStepText,
                  step <= currentStep && styles.orderProgressStepTextActive,
                ]}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.orderBody} contentContainerStyle={styles.orderBodyContent}>
          {currentStep === 1 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Qual tipo de servico?</Text>
              <Text style={styles.orderSectionCopy}>Escolha entre contratacao por hora ou diaria.</Text>
              <View style={styles.orderOptionsColumn}>
                <TouchableOpacity
                  style={[styles.orderOptionCard, hireType === "hour" && styles.orderOptionCardActive]}
                  onPress={() => setHireType("hour")}
                >
                  <Text style={styles.orderOptionIcon}>⏱</Text>
                  <View style={styles.orderOptionTextBlock}>
                    <Text style={styles.orderOptionTitle}>Por hora</Text>
                    <Text style={styles.orderOptionCopy}>Contrate o tempo que precisar.</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderOptionCard, hireType === "daily" && styles.orderOptionCardActive]}
                  onPress={() => setHireType("daily")}
                >
                  <Text style={styles.orderOptionIcon}>📅</Text>
                  <View style={styles.orderOptionTextBlock}>
                    <Text style={styles.orderOptionTitle}>Diaria</Text>
                    <Text style={styles.orderOptionCopy}>6 horas de trabalho + 1 hora de almoco.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {currentStep === 2 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Quando voce precisa?</Text>
              <Text style={styles.orderSectionCopy}>Selecione a data desejada.</Text>
              <TextInput
                style={styles.modalInput}
                value={currentDateValue}
                onChangeText={(value) => {
                  const nextDate = new Date(`${value}T00:00:00`);
                  if (!Number.isNaN(nextDate.getTime())) {
                    setDate(nextDate);
                  }
                }}
                placeholder="AAAA-MM-DD"
              />
              {scheduleLoading ? <Text style={styles.orderHint}>Carregando datas ocupadas...</Text> : null}
              {isSelectedDateBlocked ? (
                <Text style={styles.errorText}>Essa data ja possui agendamento pendente para a diarista.</Text>
              ) : null}
              <Text style={styles.orderHint}>Data selecionada: {formatLongDate(date)}</Text>
            </View>
          ) : null}

          {currentStep === 3 ? (
            <View style={styles.orderSection}>
              {hireType === "hour" ? (
                <>
                  <Text style={styles.orderSectionTitle}>Qual horario?</Text>
                  <Text style={styles.orderSectionCopy}>Selecione inicio e duracao do servico.</Text>
                  <View style={styles.orderInlineRow}>
                    <TextInput
                      style={[styles.modalInput, styles.orderInlineInput]}
                      value={hour}
                      onChangeText={setHour}
                      placeholder="Hora"
                    />
                    <TextInput
                      style={[styles.modalInput, styles.orderInlineInput]}
                      value={minute}
                      onChangeText={setMinute}
                      placeholder="Min"
                    />
                  </View>
                  <View style={styles.orderChipsRow}>
                    {ORDER_HOUR_OPTIONS.map((hourOption) => (
                      <TouchableOpacity
                        key={hourOption}
                        style={[styles.orderChip, hour === hourOption && styles.orderChipActive]}
                        onPress={() => setHour(hourOption)}
                      >
                        <Text style={[styles.orderChipText, hour === hourOption && styles.orderChipTextActive]}>
                          {hourOption}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.orderChipsRow}>
                    {ORDER_MINUTE_OPTIONS.map((minuteOption) => (
                      <TouchableOpacity
                        key={minuteOption}
                        style={[styles.orderChip, minute === minuteOption && styles.orderChipActive]}
                        onPress={() => setMinute(minuteOption)}
                      >
                        <Text style={[styles.orderChipText, minute === minuteOption && styles.orderChipTextActive]}>
                          {minuteOption}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.orderDurationRow}>
                    <Text style={styles.orderLabel}>Duracao</Text>
                    <View style={styles.orderStepper}>
                      <TouchableOpacity style={styles.orderStepperButton} onPress={() => handleDurationChange(-1)}>
                        <Text style={styles.orderStepperButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.orderStepperValue}>{duration}h</Text>
                      <TouchableOpacity style={styles.orderStepperButton} onPress={() => handleDurationChange(1)}>
                        <Text style={styles.orderStepperButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.orderSectionTitle}>Inicio da diaria</Text>
                  <Text style={styles.orderSectionCopy}>Escolha o horario de inicio da diaria.</Text>
                  <View style={styles.orderOptionsColumn}>
                    {["08", "09"].map((startOption) => (
                      <TouchableOpacity
                        key={startOption}
                        style={[styles.orderOptionCard, dailyStart === startOption && styles.orderOptionCardActive]}
                        onPress={() => setDailyStart(startOption)}
                      >
                        <Text style={styles.orderOptionIcon}>{startOption === "08" ? "☀" : "⏰"}</Text>
                        <View style={styles.orderOptionTextBlock}>
                          <Text style={styles.orderOptionTitle}>{startOption}h da manha</Text>
                          <Text style={styles.orderOptionCopy}>
                            Termino as {startOption === "08" ? "15h" : "16h"}.
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.orderPricePreview}>
                <Text style={styles.orderPriceLabel}>
                  {hireType === "hour" ? "Valor estimado" : "Valor da diaria"}
                </Text>
                <Text style={styles.orderPriceValue}>{formatCurrency(hourlyTotalPrice)}</Text>
              </View>
            </View>
          ) : null}

          {currentStep === 4 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>O que precisa ser feito?</Text>
              <Text style={styles.orderSectionCopy}>Descreva o tipo de servico que voce precisa.</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea]}
                multiline
                value={serviceType}
                onChangeText={setServiceType}
                placeholder="Ex.: limpeza geral da casa, organizacao dos quartos ou limpeza da cozinha."
                maxLength={500}
              />
              <Text style={styles.orderCounter}>{serviceType.length}/500</Text>
              <View style={styles.orderAddressInfo}>
                <Text style={styles.orderLabel}>📍 Local do servico</Text>
                <Text style={styles.secondaryLine}>{getSelectedAddressStreet(selectedAddress)}</Text>
              </View>
            </View>
          ) : null}

          {currentStep === 5 ? (
            <View style={styles.orderSection}>
              <Text style={styles.orderSectionTitle}>Confirme sua contratacao</Text>
              <Text style={styles.orderSectionCopy}>Revise os detalhes antes de confirmar.</Text>
              <View style={styles.orderReviewCard}>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>📅 Data</Text>
                  <Text style={styles.orderReviewValue}>{formatLongDate(date)}</Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>⏰ Horario</Text>
                  <Text style={styles.orderReviewValue}>
                    {hireType === "hour" ? `${hour}:${minute}` : `${dailyStart}:00`}
                  </Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>⏳ Duracao</Text>
                  <Text style={styles.orderReviewValue}>
                    {hireType === "hour" ? `${duration}h` : "6h + 1h de almoco"}
                  </Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>🧽 Servico</Text>
                  <Text style={styles.orderReviewValue}>{serviceType.trim()}</Text>
                </View>
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>📍 Local</Text>
                  <Text style={styles.orderReviewValue}>{getSelectedAddressStreet(selectedAddress)}</Text>
                </View>
                <View style={styles.orderReviewDivider} />
                <View style={styles.orderReviewItem}>
                  <Text style={styles.orderReviewLabel}>💰 Valor total</Text>
                  <Text style={styles.orderReviewValueTotal}>{formatCurrency(hourlyTotalPrice)}</Text>
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
          {currentStep < 5 ? (
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
            <TouchableOpacity style={styles.orderSuccessButton} onPress={handleConfirmHire} disabled={submitting}>
              <Text style={styles.orderPrimaryButtonText}>
                {submitting ? "Processando..." : "Confirmar contratacao"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

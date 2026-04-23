import React, { memo, useEffect, useMemo, useRef, useState } from "react";
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
  normalizeOrderTimeSelection,
  getSelectedAddressId,
  getSelectedAddressStreet,
} from "../utils/shellUtils";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const TIME_WHEEL_ITEM_HEIGHT = 40;

const TimeWheel = memo(function TimeWheel({
  label,
  wheelRef,
  options,
  selectedValue,
  onItemPress,
  onScroll,
  onScrollEndDrag,
  onMomentumScrollEnd,
}) {
  return (
    <View style={styles.orderTimeWheelColumn}>
      <Text style={styles.orderTimeWheelLabel}>{label}</Text>
      <View style={styles.orderTimeWheelWindow}>
        <View pointerEvents="none" style={styles.orderTimeWheelFadeTop} />
        <View pointerEvents="none" style={styles.orderTimeWheelHighlight} />
        <View pointerEvents="none" style={styles.orderTimeWheelFadeBottom} />
        <ScrollView
          ref={wheelRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentContainerStyle={styles.orderTimeWheelContent}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.orderTimeWheelItem}
              onPress={() => onItemPress(option)}
            >
              <Text
                style={[
                  styles.orderTimeWheelItemText,
                  selectedValue === option && styles.orderTimeWheelItemTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
});

function getDayStart(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function HireOrderModal({ visible, diarist, selectedAddress, onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [date, setDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [hireType, setHireType] = useState("hour");
  const [duration, setDuration] = useState(1);
  const [serviceType, setServiceType] = useState("");
  const [dailyStart, setDailyStart] = useState("08");
  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hourWheelRef = useRef(null);
  const minuteWheelRef = useRef(null);
  const hourWheelOffsetRef = useRef(0);
  const minuteWheelOffsetRef = useRef(0);
  const hourWheelSnapTimeoutRef = useRef(null);
  const minuteWheelSnapTimeoutRef = useRef(null);

  useEffect(() => {
    if (!visible || !diarist) {
      return;
    }

    setCurrentStep(1);
    setDate(null);
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setHour("09");
    setMinute("00");
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

  const blockedDateSet = useMemo(() => {
    return new Set(
      schedule.map((value) => {
        if (typeof value === "string") {
          const stringDate = value.slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(stringDate)) {
            return stringDate;
          }
        }
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
          return null;
        }
        return formatDateInputValue(parsedDate);
      }).filter(Boolean),
    );
  }, [schedule]);

  const todayStart = useMemo(() => getDayStart(new Date()), []);
  const currentDateValue = date ? formatDateInputValue(date) : "";

  const isDateBlocked = (value) => blockedDateSet.has(formatDateInputValue(value));
  const isDatePast = (value) => getDayStart(value).getTime() < todayStart.getTime();
  const isDateDisabled = (value) => isDateBlocked(value) || isDatePast(value);

  const isSelectedDateBlocked = useMemo(() => {
    if (!date) {
      return false;
    }
    return isDateBlocked(date);
  }, [date, blockedDateSet]);
  const isSelectedDatePast = useMemo(() => {
    if (!date) {
      return false;
    }
    return isDatePast(date);
  }, [date, todayStart]);

  const monthTitle = useMemo(() => {
    return calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [calendarMonth]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
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
  }, [calendarMonth]);

  const isStep1Valid = Boolean(hireType);
  const isStep2Valid = Boolean(currentDateValue) && !isSelectedDateBlocked && !isSelectedDatePast;
  const isHourOptionValid = ORDER_HOUR_OPTIONS.includes(hour);
  const isMinuteOptionValid = ORDER_MINUTE_OPTIONS.includes(minute);
  const normalizedHourSelection = useMemo(() => normalizeOrderTimeSelection(hour, minute), [hour, minute]);
  const isStep3Valid =
    hireType === "daily" ? Boolean(dailyStart) : Boolean(hour && minute && isHourOptionValid && isMinuteOptionValid && duration > 0);
  const isStep4Valid = serviceType.trim().length > 0;

  const scrollWheelToValue = (ref, options, value, animated = true) => {
    const targetIndex = options.indexOf(value);
    if (!ref?.current || targetIndex < 0) {
      return;
    }
    ref.current.scrollTo({ y: targetIndex * TIME_WHEEL_ITEM_HEIGHT, animated });
  };

  const getTimeWheelValueFromOffset = (offsetY, options) => {
    const maxIndex = Math.max(0, options.length - 1);
    const nextIndex = Math.min(maxIndex, Math.max(0, Math.round(offsetY / TIME_WHEEL_ITEM_HEIGHT)));
    return {
      index: nextIndex,
      value: options[nextIndex],
    };
  };

  const handleTimeWheelScroll = (event, options) => {
    const offsetY = event?.nativeEvent?.contentOffset?.y || 0;
    const offsetRef = options === ORDER_HOUR_OPTIONS ? hourWheelOffsetRef : minuteWheelOffsetRef;
    offsetRef.current = offsetY;
  };

  const scheduleTimeWheelSnap = (options, onSelect, ref, delay = 0) => {
    const isHourWheel = options === ORDER_HOUR_OPTIONS;
    const offsetRef = isHourWheel ? hourWheelOffsetRef : minuteWheelOffsetRef;
    const timeoutRef = isHourWheel ? hourWheelSnapTimeoutRef : minuteWheelSnapTimeoutRef;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const offsetY = offsetRef.current || 0;
      const { index, value } = getTimeWheelValueFromOffset(offsetY, options);
      onSelect(value);
      if (ref?.current) {
        ref.current.scrollTo({ y: index * TIME_WHEEL_ITEM_HEIGHT, animated: true });
      }
      timeoutRef.current = null;
    }, delay);
  };

  const handleTimeWheelScrollEnd = (event, options, onSelect, ref, delay = 0) => {
    const offsetY = event?.nativeEvent?.contentOffset?.y || 0;
    const offsetRef = options === ORDER_HOUR_OPTIONS ? hourWheelOffsetRef : minuteWheelOffsetRef;
    offsetRef.current = offsetY;
    const { value } = getTimeWheelValueFromOffset(offsetY, options);
    onSelect(value);
    scheduleTimeWheelSnap(options, onSelect, ref, delay);
  };

  useEffect(() => {
    if (!visible || currentStep !== 3 || hireType !== "hour") {
      return;
    }
    scrollWheelToValue(hourWheelRef, ORDER_HOUR_OPTIONS, hour, false);
    scrollWheelToValue(minuteWheelRef, ORDER_MINUTE_OPTIONS, minute, false);
  }, [visible, currentStep, hireType]);

  const handleHourPress = (option) => {
    setHour(option);
    scrollWheelToValue(hourWheelRef, ORDER_HOUR_OPTIONS, option);
  };

  const handleMinutePress = (option) => {
    setMinute(option);
    scrollWheelToValue(minuteWheelRef, ORDER_MINUTE_OPTIONS, option);
  };

  useEffect(() => {
    return () => {
      if (hourWheelSnapTimeoutRef.current) {
        clearTimeout(hourWheelSnapTimeoutRef.current);
      }
      if (minuteWheelSnapTimeoutRef.current) {
        clearTimeout(minuteWheelSnapTimeoutRef.current);
      }
    };
  }, []);

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

  const handleMonthChange = (offset) => {
    setCalendarMonth((previousMonth) => {
      return new Date(previousMonth.getFullYear(), previousMonth.getMonth() + offset, 1);
    });
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

    if (!date || isDateDisabled(date)) {
      Alert.alert("Data obrigatoria", "Selecione uma data futura e disponivel para continuar.");
      return;
    }

    if (hireType === "hour" && (!hour || !minute)) {
      Alert.alert("Horario obrigatorio", "Selecione um horario para continuar.");
      return;
    }
    if (hireType === "hour" && (!isHourOptionValid || !isMinuteOptionValid)) {
      Alert.alert("Horario invalido", "Use um horario valido para contratacao por hora.");
      return;
    }

    if (!serviceType.trim()) {
      Alert.alert("Servico obrigatorio", "Descreva o tipo de servico.");
      return;
    }

    try {
      setSubmitting(true);
      const selectedHour = hireType === "hour" ? normalizedHourSelection.hour : dailyStart;
      const selectedMinute = hireType === "hour" ? normalizedHourSelection.minute : "00";
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
              <Text style={styles.orderSectionCopy}>Selecione a data desejada no calendario.</Text>
              <View style={styles.orderCalendarCard}>
                <View style={styles.orderCalendarHeader}>
                  <TouchableOpacity style={styles.orderCalendarNavButton} onPress={() => handleMonthChange(-1)}>
                    <Text style={styles.orderCalendarNavButtonText}>{"<"}</Text>
                  </TouchableOpacity>
                  <Text style={styles.orderCalendarMonthLabel}>{monthTitle}</Text>
                  <TouchableOpacity style={styles.orderCalendarNavButton} onPress={() => handleMonthChange(1)}>
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
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <View key={`empty-${index}`} style={styles.orderCalendarCellEmpty} />;
                    }

                    const isSelected = currentDateValue === formatDateInputValue(day);
                    const blocked = isDateBlocked(day);
                    const past = isDatePast(day);
                    const disabled = blocked || past;

                    return (
                      <View key={formatDateInputValue(day)} style={styles.orderCalendarCell}>
                        <TouchableOpacity
                          style={[
                            styles.orderCalendarCellButton,
                            blocked && styles.orderCalendarCellBlocked,
                            past && styles.orderCalendarCellPast,
                            isSelected && !disabled && styles.orderCalendarCellSelected,
                            disabled && styles.orderCalendarCellDisabled,
                          ]}
                          onPress={() => {
                            if (!disabled) {
                              setDate(day);
                            }
                          }}
                          disabled={disabled}
                        >
                          <Text
                            style={[
                              styles.orderCalendarCellText,
                              blocked && styles.orderCalendarCellBlockedText,
                              past && styles.orderCalendarCellPastText,
                              isSelected && !disabled && styles.orderCalendarCellSelectedText,
                            ]}
                          >
                            {day.getDate()}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.orderCalendarLegendRow}>
                  <View style={styles.orderCalendarLegendItem}>
                    <View style={[styles.orderCalendarLegendDot, styles.orderCalendarLegendDotAvailable]} />
                    <Text style={styles.orderCalendarLegendText}>Disponivel</Text>
                  </View>
                  <View style={styles.orderCalendarLegendItem}>
                    <View style={[styles.orderCalendarLegendDot, styles.orderCalendarLegendDotBlocked]} />
                    <Text style={styles.orderCalendarLegendText}>Ocupada</Text>
                  </View>
                  <View style={styles.orderCalendarLegendItem}>
                    <View style={[styles.orderCalendarLegendDot, styles.orderCalendarLegendDotPast]} />
                    <Text style={styles.orderCalendarLegendText}>Dia indisponivel</Text>
                  </View>
                </View>
              </View>
              {scheduleLoading ? <Text style={styles.orderHint}>Carregando datas ocupadas...</Text> : null}
              {isSelectedDateBlocked ? (
                <Text style={styles.errorText}>Essa data ja possui agendamento pendente para a diarista.</Text>
              ) : null}
              {isSelectedDatePast ? (
                <Text style={styles.errorText}>Datas passadas nao podem ser selecionadas.</Text>
              ) : null}
              <Text style={styles.orderHint}>
                Data selecionada: {date ? formatLongDate(date) : "Nenhuma data selecionada"}
              </Text>
            </View>
          ) : null}

          {currentStep === 3 ? (
            <View style={styles.orderSection}>
              {hireType === "hour" ? (
                <>
                  <Text style={styles.orderSectionTitle}>Qual horario?</Text>
                  <Text style={styles.orderSectionCopy}>Selecione inicio e duracao do servico.</Text>
                  <View style={styles.orderTimePickerCard}>
                    <View style={styles.orderTimeWheelRow}>
                      <TimeWheel
                        label="Hora"
                        wheelRef={hourWheelRef}
                        options={ORDER_HOUR_OPTIONS}
                        selectedValue={hour}
                        onItemPress={handleHourPress}
                        onScroll={(event) => handleTimeWheelScroll(event, ORDER_HOUR_OPTIONS)}
                        onScrollEndDrag={(event) =>
                          handleTimeWheelScrollEnd(event, ORDER_HOUR_OPTIONS, setHour, hourWheelRef, 60)
                        }
                        onMomentumScrollEnd={(event) =>
                          handleTimeWheelScrollEnd(event, ORDER_HOUR_OPTIONS, setHour, hourWheelRef)
                        }
                      />

                      <View style={styles.orderTimeWheelMiddle}>
                        <Text style={styles.orderTimeWheelMiddleText}>:</Text>
                      </View>

                      <TimeWheel
                        label="Minuto"
                        wheelRef={minuteWheelRef}
                        options={ORDER_MINUTE_OPTIONS}
                        selectedValue={minute}
                        onItemPress={handleMinutePress}
                        onScroll={(event) => handleTimeWheelScroll(event, ORDER_MINUTE_OPTIONS)}
                        onScrollEndDrag={(event) =>
                          handleTimeWheelScrollEnd(event, ORDER_MINUTE_OPTIONS, setMinute, minuteWheelRef, 60)
                        }
                        onMomentumScrollEnd={(event) =>
                          handleTimeWheelScrollEnd(event, ORDER_MINUTE_OPTIONS, setMinute, minuteWheelRef)
                        }
                      />
                    </View>
                  </View>
                  {!isHourOptionValid && hour ? (
                    <Text style={styles.errorText}>Hora invalida. Use valores de 08 ate 16.</Text>
                  ) : null}
                  {!isMinuteOptionValid && minute ? (
                    <Text style={styles.errorText}>Minuto invalido. Use valores de 00 ate 60, pulando de 10 em 10.</Text>
                  ) : null}
                  <View style={styles.orderDurationRow}>
                    <Text style={styles.orderLabel}>Duracao</Text>
                    <View style={styles.orderStepper}>
                      <TouchableOpacity style={styles.orderStepperButton} onPress={() => handleDurationChange(-1)}>
                        <Text style={styles.orderStepperButtonText}>-</Text>
                      </TouchableOpacity>
                      <View style={styles.orderStepperValueWrap}>
                        <Text style={styles.orderStepperValue}>{duration}h</Text>
                      </View>
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
                    {hireType === "hour"
                      ? `${normalizedHourSelection.hour}:${normalizedHourSelection.minute}`
                      : `${dailyStart}:00`}
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




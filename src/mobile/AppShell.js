import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch, buildApiPathUrl, getToken } from "../config/api";

const palette = {
  bg: "#2f5fe0",
  surface: "#ffffff",
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  accentAlt: "#fbbf24",
  border: "#d9dee8",
};

const BOTTOM_NAV_HEIGHT = 60;
const ORDER_START_HOUR = 8;
const ORDER_END_HOUR = 16;
const ORDER_HOUR_OPTIONS = Array.from({ length: ORDER_END_HOUR - ORDER_START_HOUR + 1 }, (_, index) =>
  String(ORDER_START_HOUR + index).padStart(2, "0"),
);
const ORDER_MINUTE_OPTIONS = ["00", "30"];

const routeLabels = {
  map: "Diaristas",
  offers: "Ofertas",
  services: "Servicos",
  profile: "Perfil",
  subscription: "Assinatura",
};

const routeIcons = {
  map: "map-pin",
  offers: "tag",
  services: "list",
  profile: "user",
  subscription: "credit-card",
};

function SectionCard({ title, children, right, style }) {
  return (
    <View style={[styles.sectionCard, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function EmptyState({ title, description }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateCopy}>{description}</Text>
    </View>
  );
}

function LoadingState({ label = "Carregando..." }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={palette.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function MapLoadingState() {
  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={[styles.screenContent, styles.mapScreenContent]}
      scrollEnabled={false}
    >
      <View style={styles.loadingHero}>
        <View style={styles.loadingPulseDot} />
        <Text style={styles.loadingHeroTitle}>Buscando diaristas proximas</Text>
        <Text style={styles.loadingHeroCopy}>
          Estamos localizando profissionais perto do seu endereco ativo.
        </Text>
      </View>

      <View style={styles.loadingSectionCard}>
        <View style={styles.loadingSectionHeader}>
          <View style={styles.loadingTitleBar} />
          <View style={styles.loadingCountDot} />
        </View>
        <View style={styles.loadingToolbar}>
          <View style={styles.loadingToolbarCopy}>
            <View style={[styles.loadingLine, styles.loadingLineShorter]} />
            <View style={[styles.loadingLine, styles.loadingLineMedium]} />
          </View>
          <View style={styles.loadingFilterButton} />
        </View>

        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.loadingDiaristCard}>
            <View style={styles.loadingAvatar} />
            <View style={styles.loadingCardBody}>
              <View style={[styles.loadingLine, styles.loadingLineWide]} />
              <View style={[styles.loadingLine, styles.loadingLineMedium]} />
              <View style={[styles.loadingLine, styles.loadingLineShort]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  if (!value) return "Data nao informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data nao informada";
  return date.toLocaleString("pt-BR");
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function formatLongDate(value) {
  if (!value) return "Data nao informada";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Data nao informada";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function normalizeAddress(address = {}) {
  return {
    id: address.id || address.ID || null,
    street: address.street || address.Street || "",
    number: address.number || address.Number || "",
    neighborhood: address.neighborhood || address.Neighborhood || "",
    city: address.city || address.City || "",
    state: address.state || address.State || "",
    zipcode: address.zipcode || address.Zipcode || "",
    latitude: Number(address.latitude || address.Latitude || 0),
    longitude: Number(address.longitude || address.Longitude || 0),
  };
}

function formatAddress(address) {
  return [address?.street, address?.number, address?.neighborhood, address?.city]
    .filter(Boolean)
    .join(", ");
}

function getDiaristProfile(diarista = {}) {
  return diarista?.diarist_profile || diarista?.diaristas?.[0] || {};
}

function getDiaristPricePerHour(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return Number(profile?.price_per_hour || profile?.PricePerHour || 0);
}

function getDiaristPricePerDay(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return Number(profile?.price_per_day || profile?.PricePerDay || 0);
}

function getDiaristExperienceYears(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return Number(profile?.experience_years || profile?.ExperienceYears || 0);
}

function getDiaristAvailable(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  if (typeof profile?.available === "boolean") return profile.available;
  if (typeof profile?.Available === "boolean") return profile.Available;
  return true;
}

function formatAverageRatingText(rating) {
  const numericRating = Number(rating || 0);
  return numericRating > 0 ? numericRating.toFixed(1) : "0";
}

const specialtyPresentationMap = {
  basic_cleaning: { label: "Limpeza Basica", icon: "star" },
  heavy_cleaning: { label: "Limpeza Pesada", icon: "droplet" },
  ironing: { label: "Passar Roupa", icon: "shopping-bag" },
  post_work: { label: "Pos-obra", icon: "tool" },
  organization: { label: "Organizacao", icon: "folder" },
  window_cleaning: { label: "Janelas", icon: "square" },
  carpet_cleaning: { label: "Tapetes", icon: "grid" },
  cooking: { label: "Cozinhar", icon: "coffee" },
};

function parseSpecialties(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function getDiaristSpecialties(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return parseSpecialties(profile?.specialties || profile?.Specialties);
}

function getSpecialtyPresentation(value = "") {
  const key = String(value || "").trim();
  return specialtyPresentationMap[key] || {
    label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || "Especialidade",
    icon: "check-circle",
  };
}

function normalizeDiaristReview(review = {}) {
  return {
    ...review,
    id: review?.id || review?.ID || null,
    client_rating: Number(review?.client_rating || review?.ClientRating || 0),
    client_comment: review?.client_comment || review?.ClientComment || "",
    created_at: review?.created_at || review?.CreatedAt || "",
  };
}

function normalizeMapDiarist(diarist = {}) {
  const profile = getDiaristProfile(diarist);
  const coordinates = diarist?.coordinates || diarist?.coordenadas || {};

  return {
    ...diarist,
    id: diarist?.id || diarist?.ID || null,
    name: diarist?.name || diarist?.Name || "Diarista",
    photo: diarist?.photo || diarist?.Photo || profile?.photo || profile?.Photo || "",
    bio: diarist?.bio || diarist?.Bio || profile?.bio || profile?.Bio || "",
    average_rating: Number(diarist?.average_rating || diarist?.AverageRating || 0),
    total_reviews: Number(diarist?.total_reviews || diarist?.TotalReviews || 0),
    distance: diarist?.distance || diarist?.Distance || "-",
    city: diarist?.city || diarist?.City || profile?.city || profile?.City || "",
    email_verified:
      diarist?.email_verified ??
      diarist?.EmailVerified ??
      profile?.email_verified ??
      profile?.EmailVerified ??
      false,
    coordinates: {
      latitude: coordinates?.latitude ?? coordinates?.Latitude ?? null,
      longitude: coordinates?.longitude ?? coordinates?.Longitude ?? null,
    },
    diarist_profile: {
      ...profile,
      bio: profile?.bio || profile?.Bio || diarist?.bio || diarist?.Bio || "",
      price_per_hour: getDiaristPricePerHour(diarist),
      price_per_day: getDiaristPricePerDay(diarist),
      experience_years: getDiaristExperienceYears(diarist),
      specialties: getDiaristSpecialties(diarist),
      available: getDiaristAvailable(diarist),
    },
  };
}

function getEmailVerificationLabel(isVerified) {
  return isVerified ? "E-mail verificado" : "E-mail nao verificado";
}

function getSelectedAddressId(address = {}) {
  return address?.id || address?.ID || null;
}

function getSelectedAddressStreet(address = {}) {
  return address?.street || address?.Street || "Endereco nao informado";
}

function formatDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildOrderIsoDate(selectedDate, selectedHour, selectedMinute) {
  const dateObj = new Date(selectedDate);
  dateObj.setHours(Number(selectedHour), Number(selectedMinute), 0, 0);
  const offsetMinutes = dateObj.getTimezoneOffset();
  dateObj.setMinutes(dateObj.getMinutes() - offsetMinutes);
  const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
  const offsetSign = offsetMinutes > 0 ? "-" : "+";
  const offsetFormatted = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(
    Math.abs(offsetMinutes % 60),
  ).padStart(2, "0")}`;

  return `${dateObj.toISOString().slice(0, -1)}${offsetFormatted}`;
}

function MobileBottomNavigation({ currentRoute, onNavigate, role }) {
  const routes = role === "diarista" ? ["offers", "services"] : ["map", "offers", "services"];

  return (
    <View style={styles.bottomNavigation}>
      <View style={styles.bottomNavContainer}>
        {routes.map((route) => {
          const active = route === currentRoute;
          return (
            <TouchableOpacity
              key={route}
              onPress={() => onNavigate(route)}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <Feather
                name={routeIcons[route]}
                size={20}
                color={active ? palette.accentAlt : "rgba(255,255,255,0.75)"}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {routeLabels[route]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function useRemoteResource(loader, deps = []) {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    data: null,
  });

  const run = async (refreshing = false) => {
    setState((current) => ({
      ...current,
      loading: refreshing ? current.loading : true,
      refreshing,
      error: "",
    }));

    try {
      const data = await loader();
      setState({
        loading: false,
        refreshing: false,
        error: "",
        data,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: error.message || "Nao foi possivel carregar os dados.",
      }));
    }
  };

  useEffect(() => {
    void run(false);
  }, deps);

  return {
    ...state,
    refresh: () => run(true),
  };
}

function HireOrderModal({ visible, diarist, selectedAddress, onClose, onSuccess }) {
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

function MapScreen({ session }) {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [selectedDiaristForHire, setSelectedDiaristForHire] = useState(null);
  const [hireModalOpen, setHireModalOpen] = useState(false);

  const resource = useRemoteResource(async () => {
    const profileResponse = await apiFetch("/profile", { authenticated: true });
    if (!profileResponse.ok) {
      throw new Error("Nao foi possivel carregar o perfil.");
    }

    const profile = await profileResponse.json().catch(() => ({}));
    const addresses = Array.isArray(profile?.address || profile?.Address)
      ? (profile.address || profile.Address).map(normalizeAddress)
      : [];

    const primaryAddress =
      addresses.find((address) => address.latitude && address.longitude) || addresses[0];

    if (!primaryAddress?.latitude || !primaryAddress?.longitude) {
      return { diarists: [], selectedAddress: null };
    }

    const nearbyResponse = await fetch(
      `${buildApiPathUrl("/diarists-nearby")}?latitude=${primaryAddress.latitude}&longitude=${primaryAddress.longitude}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        credentials: "include",
      },
    );

    const diarists = nearbyResponse.ok ? await nearbyResponse.json().catch(() => []) : [];
    return {
      diarists: Array.isArray(diarists) ? diarists : [],
      selectedAddress: primaryAddress,
    };
  }, [session.token]);

  const payload = resource.data || { diarists: [], selectedAddress: null };

  const loadReviews = async (diaristId) => {
    setReviewsLoading(true);
    try {
      const response = await apiFetch(`/diarist-reviews/${diaristId}`, {
        authenticated: true,
      });

      if (!response.ok) {
        setAllReviews([]);
        return;
      }

      const data = await response.json().catch(() => []);
      const reviews = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setAllReviews(reviews.map(normalizeDiaristReview));
    } catch (_error) {
      setAllReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openProfile = async (diarist) => {
    setSelectedProfile(normalizeMapDiarist(diarist));
    setProfileModalOpen(true);
    setReviewsModalOpen(false);
    setAllReviews([]);
    await loadReviews(diarist?.id || diarist?.ID);
  };

  const openHireModal = (diarist) => {
    setSelectedDiaristForHire(normalizeMapDiarist(diarist));
    setHireModalOpen(true);
  };

  const closeHireModal = () => {
    setHireModalOpen(false);
    setSelectedDiaristForHire(null);
  };

  if (resource.loading && !resource.data) {
    return <MapLoadingState />;
  }

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={[styles.screenContent, styles.mapScreenContent]}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} />}
    >
      <View style={styles.mapHero}>
        <Text style={styles.mapHeroTitle}>Diaristas disponiveis</Text>
        <Text style={styles.mapHeroSubtitle}>
          {payload.diarists.length} profissionais prontos para te atender
        </Text>
        <View style={styles.mapFilterToolbar}>
          <View style={styles.mapFilterToolbarCopy}>
            <Text style={styles.mapFilterKicker}>Resumo</Text>
            <Text style={styles.mapFilterToolbarText}>Profissionais proximas ao endereco ativo</Text>
          </View>
          <View style={styles.mapFilterTrigger}>
            <Feather name="filter" size={14} color="#ffffff" />
            <Text style={styles.mapFilterTriggerText}>Lista</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapList}>
        {resource.error ? (
          <SectionCard title="Diaristas disponiveis" right={<Text style={styles.sectionMeta}>0</Text>}>
            <Text style={styles.errorText}>{resource.error}</Text>
          </SectionCard>
        ) : payload.diarists.length === 0 ? (
          <SectionCard title="Diaristas disponiveis" right={<Text style={styles.sectionMeta}>0</Text>}>
            <EmptyState
              title="Nenhuma diarista encontrada"
              description="Tente ampliar a distancia ou atualizar o endereco ativo para encontrar mais profissionais."
            />
          </SectionCard>
        ) : (
          payload.diarists.map((diarist, index) => {
            const normalizedDiarist = normalizeMapDiarist(diarist);
            const profile = getDiaristProfile(normalizedDiarist);
            const name = normalizedDiarist.name;
            const distance = normalizedDiarist.distance || "Distancia nao informada";
            const rating = formatAverageRatingText(normalizedDiarist.average_rating);
            const experienceYears = getDiaristExperienceYears(normalizedDiarist);
            const isAvailable = getDiaristAvailable(normalizedDiarist);
            const profileInitial = String(name).trim().charAt(0).toUpperCase() || "D";
            const specialties = getDiaristSpecialties(normalizedDiarist);

            return (
              <View key={normalizedDiarist?.id || index} style={styles.mapProfessionalCard}>
                <View style={styles.mapProfessionalMain}>
                  <View style={styles.mapPhotoWrapper}>
                    {normalizedDiarist?.photo ? (
                      <Image source={{ uri: normalizedDiarist.photo }} style={styles.mapPhotoFrameImage} />
                    ) : (
                      <View style={styles.mapPhotoFrame}>
                        <Text style={styles.mapPhotoInitial}>{profileInitial}</Text>
                      </View>
                    )}
                    {Number(normalizedDiarist?.average_rating || 0) >= 4.5 ? (
                      <View style={styles.mapTopRatedBadge}>
                        <Feather name="shield" size={12} color={palette.accentAlt} />
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.mapPhotoStatusBadge,
                        isAvailable ? styles.mapPhotoStatusBadgeOn : styles.mapPhotoStatusBadgeOff,
                      ]}
                    >
                      <View
                        style={[
                          styles.mapPhotoStatusDot,
                          isAvailable ? styles.mapAvailabilityDotOn : styles.mapAvailabilityDotOff,
                        ]}
                      />
                      <Text
                        style={[
                          styles.mapPhotoStatusText,
                          isAvailable ? styles.mapPhotoStatusTextOn : styles.mapPhotoStatusTextOff,
                        ]}
                      >
                        {isAvailable ? "Disponivel" : "Indisponivel"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapProfessionalContent}>
                    <View style={styles.mapProfessionalHeader}>
                      <View style={styles.mapProfessionalNameBlock}>
                        <Text style={styles.mapProfessionalName}>{name}</Text>
                      </View>
                      <View style={styles.mapRatingBadge}>
                        <Feather name="star" size={13} color={palette.accentAlt} />
                        <Text style={styles.mapRatingBadgeText}>{rating}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.mapProfessionalBottom}>
                  <View style={styles.mapMetaRow}>
                    <View style={styles.mapDistanceBadge}>
                      <Feather name="map-pin" size={13} color={palette.accent} />
                      <Text style={styles.mapDistanceBadgeText}>{distance} de distancia</Text>
                    </View>

                    <View style={styles.mapExperienceBadge}>
                      <Feather name="user" size={13} color={palette.accent} />
                      <Text style={styles.mapExperienceBadgeText}>
                        {experienceYears} anos de experiencia
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapPriceGrid}>
                    <View style={styles.mapPriceItem}>
                      <Text style={styles.mapPriceLabel}>Por Hora</Text>
                      <Text style={styles.mapPriceValue}>
                        {formatCurrency(getDiaristPricePerHour(normalizedDiarist))}
                      </Text>
                    </View>
                    <View style={styles.mapPriceDivider} />
                    <View style={styles.mapPriceItem}>
                      <Text style={styles.mapPriceLabel}>Diaria</Text>
                      <Text style={styles.mapPriceValue}>
                        {formatCurrency(getDiaristPricePerDay(normalizedDiarist))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapCardActions}>
                    <TouchableOpacity
                      style={styles.mapSecondaryAction}
                      onPress={() => void openProfile(normalizedDiarist)}
                    >
                      <Text style={styles.mapSecondaryActionText}>Ver Perfil Completo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mapPrimaryAction}
                      onPress={() => openHireModal(normalizedDiarist)}
                    >
                      <Text style={styles.mapPrimaryActionText}>Contratar Agora</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Modal
        visible={profileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.mapProfileModalCard]}>
            {selectedProfile ? (
              <>
                <TouchableOpacity
                  style={styles.mapModalClose}
                  onPress={() => setProfileModalOpen(false)}
                >
                  <Text style={styles.mapModalCloseText}>x</Text>
                </TouchableOpacity>

                <View style={styles.mapProfileHeader}>
                  <View style={styles.mapProfileAvatarWrapper}>
                    {selectedProfile?.photo || selectedProfile?.Photo ? (
                      <Image
                        source={{ uri: selectedProfile?.photo || selectedProfile?.Photo }}
                        style={styles.mapProfileAvatar}
                      />
                    ) : (
                      <View style={styles.mapProfileAvatarFallback}>
                        <Text style={styles.mapProfileAvatarFallbackText}>
                          {String(selectedProfile?.name || "D").trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.mapProfileName}>
                    {selectedProfile?.name || selectedProfile?.Name || "Diarista"}
                  </Text>
                  <View style={styles.mapHeaderMetaRow}>
                    <View style={styles.mapRatingPillLarge}>
                      <Feather name="star" size={14} color={palette.accentAlt} />
                      <Text style={styles.mapRatingPillLargeText}>
                        {formatAverageRatingText(selectedProfile?.average_rating || 0)}
                      </Text>
                      <Text style={styles.mapRatingPillLargeCount}>
                        ({allReviews.length || selectedProfile?.total_reviews || 0} avaliacoes)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.mapVerificationPill,
                        selectedProfile?.email_verified
                          ? styles.mapVerificationPillVerified
                          : styles.mapVerificationPillUnverified,
                      ]}
                    >
                      <Feather
                        name={selectedProfile?.email_verified ? "check-circle" : "x-circle"}
                        size={13}
                        color={selectedProfile?.email_verified ? "#16a34a" : "#dc2626"}
                      />
                      <Text
                        style={[
                          styles.mapVerificationPillText,
                          selectedProfile?.email_verified
                            ? styles.mapVerificationPillTextVerified
                            : styles.mapVerificationPillTextUnverified,
                        ]}
                      >
                        {getEmailVerificationLabel(Boolean(selectedProfile?.email_verified))}
                      </Text>
                    </View>
                  </View>
                </View>

                <ScrollView
                  style={styles.mapProfileBody}
                  contentContainerStyle={styles.mapProfileBodyContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="user" size={16} color={palette.accent} />
                      <Text style={styles.mapProfileSectionTitle}>Sobre a Profissional</Text>
                    </View>
                    <Text style={styles.mapProfileSectionCopy}>
                      {getDiaristProfile(selectedProfile)?.bio ||
                        getDiaristProfile(selectedProfile)?.Bio ||
                        selectedProfile?.bio ||
                        selectedProfile?.Bio ||
                        "Bio profissional nao informada."}
                    </Text>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="award" size={16} color={palette.accentAlt} />
                      <Text style={styles.mapProfileSectionTitle}>Informacoes reais</Text>
                    </View>
                    <View style={styles.mapStatsGrid}>
                      <View style={styles.mapStatCard}>
                        <Feather name="map-pin" size={15} color={palette.accent} />
                        <Text style={styles.mapStatLabel}>Distancia</Text>
                        <Text style={styles.mapStatValue}>{selectedProfile?.distance || "-"}</Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="shield" size={15} color={palette.accent} />
                        <Text style={styles.mapStatLabel}>Experiencia</Text>
                        <Text style={styles.mapStatValue}>
                          {getDiaristExperienceYears(selectedProfile)} anos
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="star" size={15} color={palette.accentAlt} />
                        <Text style={styles.mapStatLabel}>Avaliacao</Text>
                        <Text style={styles.mapStatValue}>
                          {formatAverageRatingText(selectedProfile?.average_rating || 0)}
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather
                          name="check-circle"
                          size={15}
                          color={getDiaristAvailable(selectedProfile) ? "#10b981" : "#94a3b8"}
                        />
                        <Text style={styles.mapStatLabel}>Disponibilidade</Text>
                        <Text style={styles.mapStatValue}>
                          {getDiaristAvailable(selectedProfile) ? "Disponivel" : "Indisponivel"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="dollar-sign" size={16} color={palette.accentAlt} />
                      <Text style={styles.mapProfileSectionTitle}>Valores informados</Text>
                    </View>
                    <View style={styles.mapDrawerPricing}>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por hora</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(getDiaristPricePerHour(selectedProfile))}
                        </Text>
                      </View>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por diaria</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(getDiaristPricePerDay(selectedProfile))}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="check-circle" size={16} color={palette.accent} />
                      <Text style={styles.mapProfileSectionTitle}>Especialidades</Text>
                    </View>
                    <View style={styles.mapSpecialtiesWrap}>
                      {getDiaristSpecialties(selectedProfile).length > 0 ? (
                        getDiaristSpecialties(selectedProfile).map((specialty) => {
                          const presentation = getSpecialtyPresentation(specialty);
                          return (
                            <View key={specialty} style={styles.mapSpecialtyCard}>
                              <Feather name={presentation.icon} size={14} color={palette.accent} />
                              <Text style={styles.mapSpecialtyText}>{presentation.label}</Text>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.mapProfileSectionCopy}>Nenhuma especialidade informada.</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="star" size={16} color={palette.accentAlt} />
                      <Text style={styles.mapProfileSectionTitle}>Avaliacoes</Text>
                    </View>
                    {reviewsLoading ? (
                      <Text style={styles.mapProfileSectionCopy}>Carregando avaliacoes...</Text>
                    ) : allReviews.length === 0 ? (
                      <Text style={styles.mapProfileSectionCopy}>Nenhuma avaliacao ainda.</Text>
                    ) : (
                      allReviews.slice(0, 5).map((review, index) => (
                        <View key={review?.id || review?.ID || index} style={styles.mapReviewCard}>
                          <View style={styles.mapReviewHeader}>
                            <Text style={styles.mapReviewStars}>
                              {"*".repeat(
                                Math.max(
                                  0,
                                  Math.min(
                                    5,
                                    Math.round(Number(review?.client_rating || review?.ClientRating || 0)),
                                  ),
                                ),
                              )}
                            </Text>
                            <Text style={styles.mapReviewDate}>
                              {formatShortDate(review?.created_at || review?.CreatedAt)}
                            </Text>
                          </View>
                          <Text style={styles.mapReviewComment}>
                            {review?.client_comment ||
                              review?.ClientComment ||
                              "Sem comentario informado."}
                          </Text>
                        </View>
                      ))
                    )}
                    {!reviewsLoading && allReviews.length > 5 ? (
                      <TouchableOpacity
                        style={styles.profilePreviewButton}
                        onPress={() => setReviewsModalOpen(true)}
                      >
                        <Text style={styles.profilePreviewButtonText}>
                          Ver todas as {allReviews.length} avaliacoes
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </ScrollView>

                <View style={styles.mapProfileFooter}>
                  <TouchableOpacity
                    style={styles.mapReserveButton}
                    onPress={() => {
                      setProfileModalOpen(false);
                      openHireModal(selectedProfile);
                    }}
                  >
                    <Text style={styles.mapReserveButtonText}>Reservar agora</Text>
                  </TouchableOpacity>
                  <Text style={styles.mapFooterNote}>
                    O pagamento e feito com a diarista no local, apos o servico.
                  </Text>
                  <Text style={styles.mapFooterNote}>
                    Cancelamento gratuito ate 24h antes do servico.
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <HireOrderModal
        visible={hireModalOpen}
        diarist={selectedDiaristForHire}
        selectedAddress={payload.selectedAddress}
        onClose={closeHireModal}
        onSuccess={resource.refresh}
      />

      <Modal
        visible={reviewsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.reviewsModalCard]}>
            <Text style={styles.modalTitle}>Todas as avaliacoes</Text>
            <Text style={styles.modalCopy}>
              {selectedProfile?.name || "Profissional"} - {allReviews.length} avaliacoes
            </Text>
            <ScrollView style={styles.reviewsScroll}>
              {allReviews.map((review, index) => (
                <View key={review?.id || review?.ID || index} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewStars}>
                      {"*".repeat(
                        Math.max(
                          0,
                          Math.min(
                            5,
                            Math.round(Number(review?.client_rating || review?.ClientRating || 0)),
                          ),
                        ),
                      )}
                    </Text>
                    <Text style={styles.reviewDate}>
                      {formatShortDate(review?.created_at || review?.CreatedAt)}
                    </Text>
                  </View>
                  <Text style={styles.secondaryLine}>
                    {review?.client_comment || review?.ClientComment || "Sem comentario informado."}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalGhostButton}
                onPress={() => setReviewsModalOpen(false)}
              >
                <Text style={styles.modalGhostButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function OffersScreen({ session }) {
  const [clientTab, setClientTab] = useState("pendentes");
  const [diaristTab, setDiaristTab] = useState("offers");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [counterModalState, setCounterModalState] = useState({ open: false, offer: null });
  const [reasonModalState, setReasonModalState] = useState({
    open: false,
    mode: "",
    offerId: null,
    negotiationId: null,
  });
  const [submittingKey, setSubmittingKey] = useState("");
  const [createForm, setCreateForm] = useState({
    serviceType: "Limpeza padrao",
    serviceDate: "",
    serviceTime: "08:00",
    hours: "4",
    value: "",
    observations: "",
  });
  const [counterForm, setCounterForm] = useState({
    counterValue: "",
    counterDurationHours: "1",
    message: "",
  });
  const [reasonText, setReasonText] = useState("");
  const [expandedNegotiations, setExpandedNegotiations] = useState({});
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [allReviews, setAllReviews] = useState([]);

  const getDefaultSchedule = () => {
    const now = new Date();
    const draft = new Date(now);
    draft.setHours(8, 0, 0, 0);
    if (now >= draft) {
      draft.setDate(draft.getDate() + 1);
    }

    return {
      serviceDate: draft.toISOString().slice(0, 10),
      serviceTime: `${String(draft.getHours()).padStart(2, "0")}:${String(draft.getMinutes()).padStart(2, "0")}`,
    };
  };

  const openCreateModal = () => {
    const defaults = getDefaultSchedule();
    setCreateForm({
      serviceType: "Limpeza padrao",
      serviceDate: defaults.serviceDate,
      serviceTime: defaults.serviceTime,
      hours: "4",
      value: "",
      observations: "",
    });
    setCreateModalOpen(true);
  };

  const openCounterModal = (offer) => {
    setCounterForm({
      counterValue: String(Number(offer?.initial_value || 0) || ""),
      counterDurationHours: String(Number(offer?.duration_hours || 1) || 1),
      message: "",
    });
    setCounterModalState({ open: true, offer });
  };

  const openReasonModal = (mode, offerId, negotiationId = null) => {
    setReasonText("");
    setReasonModalState({
      open: true,
      mode,
      offerId,
      negotiationId,
    });
  };

  const closeReasonModal = () => {
    setReasonText("");
    setReasonModalState({
      open: false,
      mode: "",
      offerId: null,
      negotiationId: null,
    });
  };

  const loadDiaristReviews = async (diaristId) => {
    setReviewsLoading(true);
    try {
      const response = await apiFetch(`/diarist-reviews/${diaristId}`, {
        authenticated: true,
      });

      if (!response.ok) {
        setAllReviews([]);
        return;
      }

      const data = await response.json().catch(() => []);
      setAllReviews(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch (_error) {
      setAllReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openDiaristProfile = async (negotiation) => {
    const diaristId = negotiation?.diarist_id || negotiation?.diarist?.id || negotiation?.diarist?.ID;
    if (!diaristId) {
      return;
    }

    setProfileLoading(true);
    setSelectedProfile(null);
    setProfileModalOpen(true);
    setReviewsModalOpen(false);
    setAllReviews([]);

    try {
      const [profileResponse] = await Promise.all([
        apiFetch(`/users/${diaristId}`, { authenticated: true }),
        loadDiaristReviews(diaristId),
      ]);

      const profilePayload = profileResponse.ok ? await profileResponse.json().catch(() => ({})) : {};
      const profile = profilePayload?.user || profilePayload;

      setSelectedProfile({
        id: diaristId,
        role: "diarista",
        name:
          profile?.name ||
          profile?.Name ||
          negotiation?.diarist?.name ||
          negotiation?.diarist?.Name ||
          `Diarista #${diaristId}`,
        email: profile?.email || profile?.Email || "",
        bio: profile?.bio || profile?.Bio || "",
        averageRating: Number(
          profile?.average_rating ||
            profile?.AverageRating ||
            negotiation?.diarist_rating ||
            0,
        ),
        totalReviews: Number(
          profile?.total_reviews ||
            profile?.TotalReviews ||
            negotiation?.diarist_total_reviews ||
            0,
        ),
        city:
          profile?.city ||
          profile?.City ||
          profile?.address?.[0]?.city ||
          profile?.Address?.[0]?.City ||
          "",
      });
    } catch (_error) {
      setSelectedProfile({
        id: diaristId,
        role: "diarista",
        name:
          negotiation?.diarist?.name ||
          negotiation?.diarist?.Name ||
          `Diarista #${diaristId}`,
        email: "",
        bio: "",
        averageRating: Number(negotiation?.diarist_rating || 0),
        totalReviews: 0,
        city: "",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const resource = useRemoteResource(async () => {
    const token = getToken();
    const headers = token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};

    if (session.role === "cliente") {
      const statusGroup = clientTab === "aceitas" ? "accepted" : "pending";
      const [response, addressResponse] = await Promise.all([
        apiFetch(
          `/offers/my?status_group=${statusGroup}&page=1&page_size=${statusGroup === "accepted" ? 4 : 6}`,
          {
            authenticated: true,
            headers,
          },
        ),
        apiFetch("/addresses", {
          authenticated: true,
          headers,
        }),
      ]);

      if (!response.ok) {
        throw new Error(
          statusGroup === "accepted"
            ? "Nao foi possivel carregar suas ofertas aceitas."
            : "Nao foi possivel carregar suas ofertas pendentes.",
        );
      }

      const data = await response.json().catch(() => ({}));
      const addressData = addressResponse.ok ? await addressResponse.json().catch(() => []) : [];
      const addresses = Array.isArray(addressData)
        ? addressData
        : Array.isArray(addressData?.items)
          ? addressData.items
          : [];
      const activeAddress =
        addresses.find((address) => address?.active || address?.Active) || addresses[0] || null;

      return {
        mode: "cliente",
        items: Array.isArray(data?.items) ? data.items : [],
        addresses,
        activeAddress,
      };
    }

    if (diaristTab === "negotiations") {
      const response = await apiFetch("/negotiations/my?page=1&page_size=6", {
        authenticated: true,
        headers,
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar suas negociacoes.");
      }

      const data = await response.json().catch(() => ({}));
      return {
        mode: "diarista-negotiations",
        items: Array.isArray(data?.items) ? data.items : [],
      };
    }

    const addressResponse = await apiFetch("/addresses", {
      authenticated: true,
      headers,
    });

    if (!addressResponse.ok) {
      throw new Error("Nao foi possivel validar seus enderecos.");
    }

    const addressData = await addressResponse.json().catch(() => []);
    const addresses = Array.isArray(addressData)
      ? addressData
      : Array.isArray(addressData?.items)
        ? addressData.items
        : [];

    if (addresses.length === 0) {
      return {
        mode: "diarista-offers",
        items: [],
        missingAddress: true,
      };
    }

    const response = await apiFetch("/offers?page=1&page_size=6", {
      authenticated: true,
      headers,
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel carregar as ofertas disponiveis.");
    }

    const data = await response.json().catch(() => ({}));
    return {
      mode: "diarista-offers",
      items: Array.isArray(data?.items) ? data.items : [],
      missingAddress: false,
    };
  }, [session.role, clientTab, diaristTab]);

  if (resource.loading && !resource.data) {
    return <LoadingState label="Carregando ofertas..." />;
  }

  const payload = resource.data || {
    mode: session.role === "cliente" ? "cliente" : "diarista-offers",
    items: [],
    missingAddress: false,
    addresses: [],
    activeAddress: null,
  };
  const items = payload.items || [];
  const shouldCenterCard =
    Boolean(resource.error) || items.length === 0 || payload.missingAddress;

  const handleCreateOffer = async () => {
    if (!payload.activeAddress?.id && !payload.activeAddress?.ID) {
      Alert.alert("Endereco obrigatorio", "Selecione ou cadastre um endereco antes de criar uma oferta.");
      return;
    }

    if (!createForm.serviceDate || !createForm.serviceTime || !createForm.hours || !createForm.value) {
      Alert.alert("Campos obrigatorios", "Preencha data, hora, duracao e valor.");
      return;
    }

    const scheduledAt = new Date(`${createForm.serviceDate}T${createForm.serviceTime}:00`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      Alert.alert("Agenda invalida", "Escolha uma data e horario validos.");
      return;
    }

    try {
      setSubmittingKey("create-offer");
      const response = await apiFetch("/offers", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_type: createForm.serviceType || "Limpeza padrao",
          scheduled_at: scheduledAt.toISOString(),
          duration_hours: Number(createForm.hours),
          initial_value: Number(createForm.value),
          address_id: payload.activeAddress?.id || payload.activeAddress?.ID,
          observations: createForm.observations || "",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Nao foi possivel criar a oferta.");
      }

      setCreateModalOpen(false);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Erro ao criar oferta", error.message || "Nao foi possivel criar a oferta.");
    } finally {
      setSubmittingKey("");
    }
  };

  const handleAcceptOffer = async (offerId) => {
    try {
      setSubmittingKey(`accept-offer-${offerId}`);
      const response = await apiFetch(`/offers/${offerId}/accept`, {
        method: "POST",
        authenticated: true,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Nao foi possivel aceitar a oferta.");
      }

      await resource.refresh();
    } catch (error) {
      Alert.alert("Erro ao aceitar", error.message || "Nao foi possivel aceitar a oferta.");
    } finally {
      setSubmittingKey("");
    }
  };

  const handleSendCounter = async () => {
    const offerId = counterModalState.offer?.id || counterModalState.offer?.ID;
    if (!offerId) {
      return;
    }

    if (!counterForm.counterValue || !counterForm.counterDurationHours) {
      Alert.alert("Campos obrigatorios", "Preencha valor e duracao da contraproposta.");
      return;
    }

    try {
      setSubmittingKey(`counter-offer-${offerId}`);
      const response = await apiFetch(`/offers/${offerId}/negotiate`, {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          counter_value: Number(counterForm.counterValue),
          counter_duration_hours: Number(counterForm.counterDurationHours),
          message: counterForm.message || "",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Nao foi possivel enviar a contraproposta.");
      }

      setCounterModalState({ open: false, offer: null });
      await resource.refresh();
    } catch (error) {
      Alert.alert("Erro ao negociar", error.message || "Nao foi possivel enviar a contraproposta.");
    } finally {
      setSubmittingKey("");
    }
  };

  const submitReasonAction = async () => {
    if (!reasonText.trim()) {
      Alert.alert("Motivo obrigatorio", "Informe o motivo para continuar.");
      return;
    }

    const { mode, offerId, negotiationId } = reasonModalState;
    try {
      setSubmittingKey(`${mode}-${offerId}-${negotiationId || "self"}`);
      let response = null;

      if (mode === "reject-negotiation") {
        response = await apiFetch(`/offers/${offerId}/negotiate/${negotiationId}/reject`, {
          method: "PUT",
          authenticated: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: reasonText.trim() }),
        });
      }

      if (mode === "cancel-offer") {
        response = await apiFetch(`/offers/${offerId}/cancel`, {
          method: "PUT",
          authenticated: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: reasonText.trim() }),
        });
      }

      if (!response?.ok) {
        const errorText = await response?.text().catch(() => "");
        throw new Error(errorText || "Nao foi possivel concluir a acao.");
      }

      closeReasonModal();
      await resource.refresh();
    } catch (error) {
      Alert.alert("Erro", error.message || "Nao foi possivel concluir a acao.");
    } finally {
      setSubmittingKey("");
    }
  };

  const handleAcceptNegotiation = async (offerId, negotiationId) => {
    try {
      setSubmittingKey(`accept-negotiation-${negotiationId}`);
      const response = await apiFetch(`/offers/${offerId}/negotiate/${negotiationId}/accept`, {
        method: "PUT",
        authenticated: true,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Nao foi possivel aceitar a contraproposta.");
      }

      await resource.refresh();
    } catch (error) {
      Alert.alert("Erro ao aceitar", error.message || "Nao foi possivel aceitar a contraproposta.");
    } finally {
      setSubmittingKey("");
    }
  };

  const headerRight =
    session.role === "cliente" ? (
      <View style={styles.inlineMeta}>
        <TouchableOpacity
          onPress={() => setClientTab("pendentes")}
          style={[styles.miniTab, clientTab === "pendentes" && styles.miniTabActive]}
        >
          <Text
            style={[styles.miniTabText, clientTab === "pendentes" && styles.miniTabTextActive]}
          >
            Pendentes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setClientTab("aceitas")}
          style={[styles.miniTab, clientTab === "aceitas" && styles.miniTabActive]}
        >
          <Text style={[styles.miniTabText, clientTab === "aceitas" && styles.miniTabTextActive]}>
            Aceitas
          </Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.inlineMeta}>
        <TouchableOpacity
          onPress={() => setDiaristTab("offers")}
          style={[styles.miniTab, diaristTab === "offers" && styles.miniTabActive]}
        >
          <Text style={[styles.miniTabText, diaristTab === "offers" && styles.miniTabTextActive]}>
            Ofertas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDiaristTab("negotiations")}
          style={[styles.miniTab, diaristTab === "negotiations" && styles.miniTabActive]}
        >
          <Text
            style={[
              styles.miniTabText,
              diaristTab === "negotiations" && styles.miniTabTextActive,
            ]}
          >
            Negociacoes
          </Text>
        </TouchableOpacity>
      </View>
    );

  const emptyState =
    payload.missingAddress && session.role === "diarista" ? (
      <EmptyState
        title="Cadastre um endereco"
        description="No projeto original, diarista so visualiza ofertas disponiveis quando possui endereco cadastrado."
      />
    ) : session.role === "cliente" ? (
      <EmptyState
        title={clientTab === "aceitas" ? "Nenhuma oferta aceita" : "Nenhuma oferta pendente"}
        description="Suas ofertas aparecem aqui seguindo a mesma regra do projeto web."
      />
    ) : diaristTab === "negotiations" ? (
      <EmptyState
        title="Nenhuma negociacao"
        description="Quando houver contrapropostas enviadas ou recebidas, elas aparecerao aqui."
      />
    ) : (
      <EmptyState
        title="Nenhuma oferta disponivel"
        description="As ofertas abertas proximas ao endereco cadastrado aparecem aqui para diaristas."
      />
    );

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={[
        styles.screenContent,
        styles.screenContentFill,
        shouldCenterCard && styles.offersScreenContentCentered,
      ]}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} />}
    >
      <SectionCard
        title={session.role === "cliente" ? "Minhas ofertas" : "Mural de ofertas"}
        right={<Text style={styles.sectionMeta}>{items.length}</Text>}
        style={styles.offersCardCentered}
      >
        <View style={styles.offersTabRow}>{headerRight}</View>
        {session.role === "cliente" ? (
          <TouchableOpacity style={styles.primaryActionButton} onPress={openCreateModal}>
            <Text style={styles.primaryActionButtonText}>Criar nova oferta</Text>
          </TouchableOpacity>
        ) : null}

        {resource.error ? (
          <Text style={styles.errorText}>{resource.error}</Text>
        ) : items.length === 0 || payload.missingAddress ? (
          emptyState
        ) : (
          items.map((item, index) => {
            const itemId = item?.id || item?.ID || index + 1;
            const addressLabel =
              item?.address?.street ||
              item?.address?.Street ||
              item?.address_neighborhood ||
              item?.offer?.address?.street ||
              item?.offer?.address?.Street ||
              "Endereco nao informado";
            const statusLabel =
              item?.service_status ||
              item?.status ||
              item?.Status ||
              (diaristTab === "negotiations" ? "negociacao" : "status nao informado");
            const valueLabel =
              item?.counter_value ||
              item?.CounterValue ||
              item?.initial_value ||
              item?.InitialValue ||
              item?.value ||
              item?.Value;
            const isOfferAvailableForNegotiation =
              item?.status === "aberta" || item?.status === "negociacao";
            const hasPendingNegotiation = Boolean(
              item?.has_pending_negotiation || item?.HasPendingNegotiation,
            );

            return (
              <View key={itemId} style={styles.listCard}>
                <Text style={styles.listTitle}>
                  {session.role === "cliente"
                    ? item?.service_type || "Oferta"
                    : diaristTab === "negotiations"
                      ? "Negociacao"
                      : "Oferta"}{" "}
                  #{itemId}
                </Text>
                <Text style={styles.secondaryLine}>{addressLabel}</Text>
                {item?.scheduled_at || item?.ScheduledAt ? (
                  <Text style={styles.secondaryLine}>
                    {formatDate(item?.scheduled_at || item?.ScheduledAt)}
                  </Text>
                ) : null}
                <View style={styles.inlineMeta}>
                  <Text style={styles.metaBadge}>{statusLabel}</Text>
                  {valueLabel ? <Text style={styles.metaBadge}>{formatCurrency(valueLabel)}</Text> : null}
                </View>

                {session.role === "diarista" &&
                diaristTab === "offers" &&
                isOfferAvailableForNegotiation ? (
                  <View style={styles.offerActionRow}>
                    {!hasPendingNegotiation ? (
                      <TouchableOpacity
                        style={[styles.secondaryActionButton, styles.secondaryActionButtonFilled]}
                        onPress={() => openCounterModal(item)}
                      >
                        <Text style={styles.secondaryActionButtonFilledText}>Contraproposta</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.warningText}>Voce ja fez uma contraproposta</Text>
                    )}
                    <TouchableOpacity
                      style={styles.primaryInlineButton}
                      onPress={() => handleAcceptOffer(itemId)}
                    >
                      <Text style={styles.primaryInlineButtonText}>
                        {submittingKey === `accept-offer-${itemId}` ? "Aceitando..." : "Aceitar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {session.role === "cliente" && Array.isArray(item?.negotiations) && item.negotiations.length > 0 ? (
                  <View style={styles.negotiationStack}>
                    <Text style={styles.subsectionTitle}>Contrapropostas</Text>
                    {item.negotiations.map((negotiation, negotiationIndex) => {
                      const negotiationId = negotiation?.id || negotiation?.ID || negotiationIndex + 1;
                      const isExpanded = Boolean(expandedNegotiations[negotiationId]);
                      return (
                        <View key={negotiationId} style={styles.nestedCard}>
                          <TouchableOpacity
                            style={styles.negotiationSummary}
                            onPress={() =>
                              setExpandedNegotiations((current) => ({
                                ...current,
                                [negotiationId]: !current[negotiationId],
                              }))
                            }
                          >
                            <View style={styles.negotiationSummaryMain}>
                              <Text style={styles.listTitle}>
                                {negotiation?.diarist?.name ||
                                  negotiation?.diarist?.Name ||
                                  `Diarista #${negotiation?.diarist_id || negotiationIndex + 1}`}
                              </Text>
                              <Text style={styles.secondaryLine}>
                                {formatCurrency(negotiation?.counter_value || 0)} -{" "}
                                {Number(
                                  negotiation?.counter_duration_hours ||
                                    negotiation?.duration_hours ||
                                    0,
                                )}
                                h
                              </Text>
                            </View>
                            <View style={styles.negotiationSummarySide}>
                              <Text style={styles.metaBadge}>{negotiation?.status || "pendente"}</Text>
                              <Text style={styles.negotiationChevron}>{isExpanded ? "^" : "v"}</Text>
                            </View>
                          </TouchableOpacity>

                          {isExpanded ? (
                            <View style={styles.negotiationExpanded}>
                              <View style={styles.inlineMeta}>
                                {negotiation?.diarist_distance ? (
                                  <Text style={styles.metaBadge}>
                                    {Number(negotiation.diarist_distance).toFixed(1)} km
                                  </Text>
                                ) : null}
                                <Text style={styles.metaBadge}>
                                  Nota {Number(negotiation?.diarist_rating || 0).toFixed(1)}
                                </Text>
                              </View>

                              {negotiation?.message ? (
                                <Text style={styles.secondaryLine}>{negotiation.message}</Text>
                              ) : (
                                <Text style={styles.secondaryLine}>Sem mensagem adicional.</Text>
                              )}

                              <TouchableOpacity
                                style={styles.profilePreviewButton}
                                onPress={() => openDiaristProfile(negotiation)}
                              >
                                <Text style={styles.profilePreviewButtonText}>Ver perfil da diarista</Text>
                              </TouchableOpacity>

                              {negotiation?.status === "pendente" ? (
                                <View style={styles.offerActionRow}>
                                  <TouchableOpacity
                                    style={styles.primaryInlineButton}
                                    onPress={() => handleAcceptNegotiation(itemId, negotiationId)}
                                  >
                                    <Text style={styles.primaryInlineButtonText}>
                                      {submittingKey === `accept-negotiation-${negotiationId}`
                                        ? "Aceitando..."
                                        : "Aceitar"}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.dangerInlineButton}
                                    onPress={() =>
                                      openReasonModal("reject-negotiation", itemId, negotiationId)
                                    }
                                  >
                                    <Text style={styles.dangerInlineButtonText}>Recusar</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {session.role === "cliente" &&
                (item?.status === "aberta" || item?.status === "negociacao") ? (
                  <View style={styles.offerActionRow}>
                    <TouchableOpacity
                      style={styles.dangerInlineButton}
                      onPress={() => openReasonModal("cancel-offer", itemId)}
                    >
                      <Text style={styles.dangerInlineButtonText}>Cancelar oferta</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </SectionCard>

      <Modal
        visible={createModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Criar nova oferta</Text>
            <Text style={styles.modalCopy}>
              Endereco selecionado: {formatAddress(normalizeAddress(payload.activeAddress || {})) || "Nao informado"}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tipo de limpeza"
              value={createForm.serviceType}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, serviceType: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Data YYYY-MM-DD"
              value={createForm.serviceDate}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, serviceDate: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Hora HH:mm"
              value={createForm.serviceTime}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, serviceTime: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Duracao em horas"
              keyboardType="numeric"
              value={createForm.hours}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, hours: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Valor inicial"
              keyboardType="numeric"
              value={createForm.value}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, value: value }))}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Observacoes"
              multiline
              value={createForm.observations}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, observations: value }))}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalGhostButton}
                onPress={() => setCreateModalOpen(false)}
              >
                <Text style={styles.modalGhostButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryInlineButton} onPress={handleCreateOffer}>
                <Text style={styles.primaryInlineButtonText}>
                  {submittingKey === "create-offer" ? "Publicando..." : "Publicar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={counterModalState.open}
        transparent
        animationType="fade"
        onRequestClose={() => setCounterModalState({ open: false, offer: null })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fazer contraproposta</Text>
            <Text style={styles.modalCopy}>
              Oferta #{counterModalState.offer?.id || counterModalState.offer?.ID || ""}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Valor da contraproposta"
              keyboardType="numeric"
              value={counterForm.counterValue}
              onChangeText={(value) => setCounterForm((current) => ({ ...current, counterValue: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Duracao em horas"
              keyboardType="numeric"
              value={counterForm.counterDurationHours}
              onChangeText={(value) =>
                setCounterForm((current) => ({ ...current, counterDurationHours: value }))
              }
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Mensagem"
              multiline
              value={counterForm.message}
              onChangeText={(value) => setCounterForm((current) => ({ ...current, message: value }))}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalGhostButton}
                onPress={() => setCounterModalState({ open: false, offer: null })}
              >
                <Text style={styles.modalGhostButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryInlineButton} onPress={handleSendCounter}>
                <Text style={styles.primaryInlineButtonText}>
                  {submittingKey.startsWith("counter-offer-") ? "Enviando..." : "Enviar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reasonModalState.open}
        transparent
        animationType="fade"
        onRequestClose={closeReasonModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {reasonModalState.mode === "cancel-offer" ? "Cancelar oferta" : "Recusar contraproposta"}
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Informe o motivo"
              multiline
              value={reasonText}
              onChangeText={setReasonText}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalGhostButton} onPress={closeReasonModal}>
                <Text style={styles.modalGhostButtonText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerInlineButton} onPress={submitReasonAction}>
                <Text style={styles.dangerInlineButtonText}>
                  {submittingKey
                    ? "Salvando..."
                    : reasonModalState.mode === "cancel-offer"
                      ? "Cancelar oferta"
                      : "Recusar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={profileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.profileModalCard]}>
            {profileLoading ? (
              <LoadingState label="Carregando perfil..." />
            ) : selectedProfile ? (
              <>
                <Text style={styles.modalTitle}>{selectedProfile.name}</Text>
                <Text style={styles.modalCopy}>
                  {selectedProfile.city || "Cidade nao informada"}
                </Text>
                <View style={styles.inlineMeta}>
                  <Text style={styles.metaBadge}>
                    Nota {Number(selectedProfile.averageRating || 0).toFixed(1)}
                  </Text>
                  <Text style={styles.metaBadge}>
                    {Number(selectedProfile.totalReviews || allReviews.length)} avaliacoes
                  </Text>
                </View>
                <Text style={styles.profileBio}>
                  {selectedProfile.bio || "A diarista ainda nao cadastrou uma bio."}
                </Text>

                <Text style={styles.subsectionTitle}>Avaliacoes recentes</Text>
                {reviewsLoading ? (
                  <Text style={styles.secondaryLine}>Carregando avaliacoes...</Text>
                ) : allReviews.length === 0 ? (
                  <Text style={styles.secondaryLine}>Nenhuma avaliacao ainda.</Text>
                ) : (
                  allReviews.slice(0, 3).map((review, index) => (
                    <View key={review?.id || review?.ID || index} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewStars}>
                          {"★".repeat(Math.max(0, Math.min(5, Math.round(Number(review?.client_rating || review?.rating || 0)))))}
                        </Text>
                        <Text style={styles.reviewDate}>
                          {formatShortDate(review?.created_at || review?.CreatedAt)}
                        </Text>
                      </View>
                      <Text style={styles.secondaryLine}>
                        {review?.client_comment ||
                          review?.comment ||
                          review?.Comment ||
                          "Sem comentario informado."}
                      </Text>
                    </View>
                  ))
                )}

                {!reviewsLoading && allReviews.length > 3 ? (
                  <TouchableOpacity
                    style={styles.profilePreviewButton}
                    onPress={() => setReviewsModalOpen(true)}
                  >
                    <Text style={styles.profilePreviewButtonText}>Ver todas as avaliacoes</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalGhostButton}
                    onPress={() => setProfileModalOpen(false)}
                  >
                    <Text style={styles.modalGhostButtonText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.secondaryLine}>Nao foi possivel carregar o perfil.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.reviewsModalCard]}>
            <Text style={styles.modalTitle}>Todas as avaliacoes</Text>
            <ScrollView style={styles.reviewsScroll}>
              {allReviews.length === 0 ? (
                <Text style={styles.secondaryLine}>Nenhuma avaliacao ainda.</Text>
              ) : (
                allReviews.map((review, index) => (
                  <View key={review?.id || review?.ID || index} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewStars}>
                        {"★".repeat(Math.max(0, Math.min(5, Math.round(Number(review?.client_rating || review?.rating || 0)))))}
                      </Text>
                      <Text style={styles.reviewDate}>
                        {formatShortDate(review?.created_at || review?.CreatedAt)}
                      </Text>
                    </View>
                    <Text style={styles.secondaryLine}>
                      {review?.client_comment ||
                        review?.comment ||
                        review?.Comment ||
                        "Sem comentario informado."}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalGhostButton}
                onPress={() => setReviewsModalOpen(false)}
              >
                <Text style={styles.modalGhostButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function ServicesScreen() {
  const [tab, setTab] = useState("active");

  const resource = useRemoteResource(async () => {
    const response = await apiFetch(`/services/my?status_group=${tab}&page=1&page_size=20`, {
      authenticated: true,
    });
    if (!response.ok) {
      throw new Error("Nao foi possivel carregar os servicos.");
    }
    const data = await response.json().catch(() => ({}));
    return Array.isArray(data?.items) ? data.items : [];
  }, [tab]);

  const services = resource.data || [];

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} />}
    >
      <SectionCard
        title="Meus servicos"
        right={
          <View style={styles.inlineMeta}>
            <TouchableOpacity
              onPress={() => setTab("active")}
              style={[styles.miniTab, tab === "active" && styles.miniTabActive]}
            >
              <Text style={[styles.miniTabText, tab === "active" && styles.miniTabTextActive]}>
                Ativos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab("history")}
              style={[styles.miniTab, tab === "history" && styles.miniTabActive]}
            >
              <Text style={[styles.miniTabText, tab === "history" && styles.miniTabTextActive]}>
                Historico
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        {resource.loading && !resource.data ? (
          <LoadingState label="Carregando servicos..." />
        ) : resource.error ? (
          <Text style={styles.errorText}>{resource.error}</Text>
        ) : services.length === 0 ? (
          <EmptyState
            title="Nenhum servico nesta aba"
            description="Quando houver servicos vinculados a sua conta, eles aparecerao aqui."
          />
        ) : (
          services.map((service, index) => (
            <View key={service?.id || service?.ID || index} style={styles.listCard}>
              <Text style={styles.listTitle}>Servico #{service?.id || service?.ID || index + 1}</Text>
              <Text style={styles.secondaryLine}>
                {formatDate(service?.scheduled_at || service?.ScheduledAt)}
              </Text>
              <View style={styles.inlineMeta}>
                <Text style={styles.metaBadge}>{service?.status || service?.Status || "status"}</Text>
                {service?.price || service?.Price ? (
                  <Text style={styles.metaBadge}>
                    {formatCurrency(service?.price || service?.Price)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function ProfileScreen({ session }) {
  const resource = useRemoteResource(async () => {
    const [profileResponse, subscriptionResponse] = await Promise.all([
      apiFetch("/profile", { authenticated: true }),
      apiFetch("/subscriptions/access-status", { authenticated: true }),
    ]);

    if (!profileResponse.ok) {
      throw new Error("Nao foi possivel carregar o perfil.");
    }

    const profile = await profileResponse.json().catch(() => ({}));
    const subscription = subscriptionResponse.ok
      ? await subscriptionResponse.json().catch(() => ({}))
      : {};

    return { profile, subscription };
  }, [session.token]);

  if (resource.loading && !resource.data) {
    return <LoadingState label="Carregando perfil..." />;
  }

  const payload = resource.data || { profile: {}, subscription: {} };
  const profile = payload.profile || {};
  const addresses = Array.isArray(profile?.address || profile?.Address)
    ? (profile.address || profile.Address).map(normalizeAddress)
    : [];

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} />}
    >
      <SectionCard title="Conta">
        {resource.error ? (
          <Text style={styles.errorText}>{resource.error}</Text>
        ) : (
          <>
            <Text style={styles.primaryLine}>{profile?.name || profile?.Name || "Usuario"}</Text>
            <Text style={styles.secondaryLine}>{profile?.email || profile?.Email || "E-mail nao informado"}</Text>
            <View style={styles.inlineMeta}>
              <Text style={styles.metaBadge}>{session.role === "diarista" ? "Diarista" : "Cliente"}</Text>
              <Text style={styles.metaBadge}>
                {payload.subscription?.has_valid_subscription || payload.subscription?.is_test_user
                  ? "Assinatura ativa"
                  : "Sem assinatura"}
              </Text>
            </View>
          </>
        )}
      </SectionCard>

      <SectionCard title="Enderecos" right={<Text style={styles.sectionMeta}>{addresses.length}</Text>}>
        {addresses.length === 0 ? (
          <EmptyState
            title="Nenhum endereco"
            description="Adicione ou complete um endereco para usar mapa e ofertas."
          />
        ) : (
          addresses.map((address, index) => (
            <View key={address.id || index} style={styles.listCard}>
              <Text style={styles.listTitle}>{formatAddress(address) || "Endereco sem detalhes"}</Text>
              <Text style={styles.secondaryLine}>{address.zipcode || "CEP nao informado"}</Text>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

function SubscriptionScreen({ session }) {
  return (
    <ScrollView style={styles.screenScroll} contentContainerStyle={styles.screenContent}>
      <SectionCard title="Assinatura">
        <Text style={styles.primaryLine}>
          {session.hasValidSubscription || session.isTestUser ? "Acesso liberado" : "Acesso pendente"}
        </Text>
        <Text style={styles.secondaryLine}>
          {session.hasValidSubscription || session.isTestUser
            ? "Sua conta ja possui acesso premium liberado."
            : "Seu login foi concluido, mas ainda falta uma assinatura valida para liberar todo o fluxo."}
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

export default function AppShell({ forcedRoute, session, onRouteChange, onSessionUpdate, onLogout }) {
  const initialRoute = useMemo(() => {
    if (!session.emailVerified && !session.isTestUser) return "profile";
    if (!session.hasValidSubscription && !session.isTestUser) return "subscription";
    return session.role === "diarista" ? "offers" : "map";
  }, [session]);

  const [currentRoute, setCurrentRoute] = useState(initialRoute);

  useEffect(() => {
    setCurrentRoute(initialRoute);
  }, [initialRoute]);

  useEffect(() => {
    if (!forcedRoute) {
      return;
    }

    setCurrentRoute(forcedRoute);
  }, [forcedRoute]);

  useEffect(() => {
    onRouteChange?.(currentRoute);
  }, [currentRoute, onRouteChange]);

  let screen = null;
  switch (currentRoute) {
    case "map":
      screen = <MapScreen session={session} />;
      break;
    case "offers":
      screen = <OffersScreen session={session} />;
      break;
    case "services":
      screen = <ServicesScreen />;
      break;
    case "subscription":
      screen = <SubscriptionScreen session={session} />;
      break;
    case "profile":
    default:
      screen = <ProfileScreen session={session} />;
      break;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.screenArea}>{screen}</View>
      <MobileBottomNavigation
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        role={session.role}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    position: "relative",
  },
  screenArea: {
    flex: 1,
    minHeight: 0,
    paddingTop: 18,
    paddingBottom: 70,
  },
  screenScroll: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  screenContent: {
    paddingBottom: 24,
    backgroundColor: palette.bg,
  },
  screenContentFill: {
    flexGrow: 1,
  },
  mapScreenContent: {
    paddingBottom: 108,
  },
  mapHero: {
    marginBottom: 16,
  },
  mapHeroTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },
  mapHeroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  mapFilterToolbar: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mapFilterToolbarCopy: {
    flex: 1,
  },
  mapFilterKicker: {
    color: palette.accentAlt,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  mapFilterToolbarText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
  },
  mapFilterTrigger: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mapFilterTriggerText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  mapList: {
    gap: 12,
  },
  mapProfessionalCard: {
    borderRadius: 18,
    backgroundColor: palette.surface,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  mapProfessionalMain: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
  },
  mapPhotoWrapper: {
    position: "relative",
  },
  mapPhotoFrame: {
    width: 74,
    height: 74,
    borderRadius: 18,
    backgroundColor: "#dbe7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  mapPhotoFrameImage: {
    width: 74,
    height: 74,
    borderRadius: 18,
    backgroundColor: "#dbe7ff",
  },
  mapPhotoInitial: {
    color: palette.accent,
    fontSize: 28,
    fontWeight: "900",
  },
  mapTopRatedBadge: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  mapPhotoStatusBadge: {
    position: "absolute",
    left: "50%",
    bottom: -8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    transform: [{ translateX: -36 }],
  },
  mapPhotoStatusBadgeOn: {
    backgroundColor: "#ffffff",
    borderColor: "#d1fae5",
  },
  mapPhotoStatusBadgeOff: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
  },
  mapPhotoStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapPhotoStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  mapPhotoStatusTextOn: {
    color: "#065f46",
  },
  mapPhotoStatusTextOff: {
    color: "#475569",
  },
  mapProfessionalContent: {
    flex: 1,
  },
  mapProfessionalBottom: {
    width: "100%",
  },
  mapProfessionalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  mapProfessionalNameBlock: {
    flex: 1,
  },
  mapProfessionalName: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  mapAvailabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapAvailabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapAvailabilityDotOn: {
    backgroundColor: "#10b981",
  },
  mapAvailabilityDotOff: {
    backgroundColor: "#94a3b8",
  },
  mapAvailabilityText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  mapRatingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mapRatingBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  mapMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  mapDistanceBadge: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eef4ff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
  },
  mapDistanceBadgeText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  mapExperienceBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 34,
  },
  mapExperienceBadgeText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  mapPriceGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    marginBottom: 12,
    overflow: "hidden",
  },
  mapPriceItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mapPriceLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  mapPriceValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  mapPriceDivider: {
    width: 1,
    backgroundColor: "#dbe7ff",
  },
  mapProfessionalBio: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  mapCardActions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginTop: 12,
  },
  mapSecondaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  mapSecondaryActionText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  mapPrimaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  mapPrimaryActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  offersScreenContentCentered: {
    justifyContent: "center",
    paddingTop: 32,
    paddingBottom: 132,
  },
  offersCardCentered: {
    minHeight: 120,
    justifyContent: "center",
  },
  offersTabRow: {
    marginBottom: 14,
  },
  subsectionTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionMeta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryLine: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  secondaryLine: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  listCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fbfdff",
  },
  listTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  inlineMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  metaBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eef4ff",
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
  },
  emptyState: {
    paddingVertical: 10,
  },
  emptyStateTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyStateCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingHero: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 26,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  loadingPulseDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    marginBottom: 16,
  },
  loadingHeroTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  loadingHeroCopy: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 280,
  },
  loadingSectionCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  loadingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  loadingToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  loadingToolbarCopy: {
    flex: 1,
  },
  loadingTitleBar: {
    width: 154,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#dbe7ff",
  },
  loadingCountDot: {
    width: 26,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#e7eefc",
  },
  loadingFilterButton: {
    width: 72,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#dbe7ff",
  },
  loadingDiaristCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    padding: 14,
    marginBottom: 10,
  },
  loadingAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#dbe7ff",
  },
  loadingCardBody: {
    flex: 1,
    justifyContent: "center",
  },
  loadingLine: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#dbe7ff",
    marginBottom: 8,
  },
  loadingLineWide: {
    width: "86%",
  },
  loadingLineMedium: {
    width: "68%",
  },
  loadingLineShort: {
    width: "34%",
    marginBottom: 0,
  },
  loadingLineShorter: {
    width: "22%",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "700",
    alignSelf: "center",
  },
  primaryActionButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  primaryActionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  offerActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  primaryInlineButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryInlineButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionButtonFilled: {
    backgroundColor: "#eff6ff",
  },
  secondaryActionButtonFilledText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  dangerInlineButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerInlineButtonText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "800",
  },
  negotiationStack: {
    marginTop: 14,
  },
  nestedCard: {
    borderWidth: 1,
    borderColor: "#dbe4ff",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8fbff",
    marginTop: 10,
  },
  negotiationSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  negotiationSummaryMain: {
    flex: 1,
  },
  negotiationSummarySide: {
    alignItems: "flex-end",
    gap: 6,
  },
  negotiationChevron: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  negotiationExpanded: {
    marginTop: 12,
    gap: 10,
  },
  profilePreviewButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  profilePreviewButtonText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "800",
  },
  miniTab: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eef2f7",
  },
  miniTabActive: {
    backgroundColor: palette.accent,
  },
  miniTabText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  miniTabTextActive: {
    color: "#ffffff",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 18,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  modalInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
    backgroundColor: "#fbfdff",
    marginBottom: 10,
  },
  modalTextarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  mapProfileModalCard: {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    maxHeight: "100%",
    borderRadius: 0,
    paddingTop: 4,
    minHeight: 440,
    overflow: "hidden",
  },
  mapModalClose: {
    alignSelf: "flex-end",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
  mapModalCloseText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  mapProfileHeader: {
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  mapProfileAvatarWrapper: {
    marginTop: -10,
    marginBottom: 2,
  },
  mapProfileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#dbe7ff",
  },
  mapProfileAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#dbe7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  mapProfileAvatarFallbackText: {
    color: palette.accent,
    fontSize: 22,
    fontWeight: "900",
  },
  mapProfileName: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 2,
  },
  mapHeaderMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    gap: 8,
    marginTop: 4,
    width: "100%",
  },
  mapRatingPillLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  mapRatingPillLargeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  mapRatingPillLargeCount: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
  mapVerificationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  mapVerificationPillVerified: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(134, 239, 172, 0.9)",
  },
  mapVerificationPillUnverified: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderColor: "rgba(252, 165, 165, 0.9)",
  },
  mapVerificationPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  mapVerificationPillTextVerified: {
    color: "#166534",
  },
  mapVerificationPillTextUnverified: {
    color: "#991b1b",
  },
  mapProfileBody: {
    flex: 1,
    minHeight: 0,
    marginTop: 0,
  },
  mapProfileBodyContent: {
    paddingBottom: 16,
  },
  mapProfileSection: {
    marginTop: 16,
  },
  mapProfileSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  mapProfileSectionTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  mapProfileSectionCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  mapStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mapStatCard: {
    width: "48%",
    minHeight: 90,
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    padding: 12,
    justifyContent: "space-between",
  },
  mapStatLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  mapStatValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  mapDrawerPricing: {
    flexDirection: "row",
    gap: 10,
  },
  mapDrawerPriceCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    padding: 14,
  },
  mapDrawerPriceLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  mapDrawerPriceValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  mapSpecialtiesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mapSpecialtyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  mapSpecialtyText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  mapReviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    padding: 12,
    marginBottom: 10,
  },
  mapReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mapReviewStars: {
    color: palette.accentAlt,
    fontSize: 13,
    fontWeight: "900",
  },
  mapReviewDate: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  mapReviewComment: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  mapProfileFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
    marginTop: 2,
    flexShrink: 0,
  },
  mapReserveButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  mapReserveButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  mapFooterNote: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 2,
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 280,
  },
  profileModalCard: {
    maxHeight: "86%",
  },
  reviewsModalCard: {
    maxHeight: "86%",
  },
  modalGhostButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  profileBio: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 14,
  },
  reviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    padding: 12,
    marginTop: 10,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewStars: {
    color: palette.accentAlt,
    fontSize: 14,
    fontWeight: "800",
  },
  reviewDate: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewsScroll: {
    maxHeight: 420,
  },
  bottomNavigation: {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    bottom: 0,
    left: Platform.OS === "web" ? 0 : -14,
    right: Platform.OS === "web" ? 0 : -14,
    width: Platform.OS === "web" ? "100%" : undefined,
    height: 60,
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    display: "flex",
    paddingBottom: 3,
  },
  bottomNavContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    height: "100%",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navItemActive: {
    backgroundColor: "rgba(251, 191, 36, 0.10)",
    borderBottomWidth: 3,
    borderBottomColor: palette.accentAlt,
  },
  navLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  navLabelActive: {
    color: palette.accentAlt,
  },
  orderShell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: 10,
  },
  orderHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  orderCloseButton: {
    alignSelf: "flex-end",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  orderTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  orderSubtitle: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  orderProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#dbe7ff",
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  orderProgressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  orderProgressSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  orderProgressStep: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#dbe7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  orderProgressStepActive: {
    backgroundColor: "#bfdbfe",
  },
  orderProgressStepCurrent: {
    backgroundColor: palette.accent,
  },
  orderProgressStepText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  orderProgressStepTextActive: {
    color: "#ffffff",
  },
  orderBody: {
    flex: 1,
  },
  orderBodyContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  orderSection: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  orderSectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  orderSectionCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  orderOptionsColumn: {
    gap: 12,
  },
  orderOptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderOptionCardActive: {
    borderColor: palette.accent,
    backgroundColor: "#eff6ff",
  },
  orderOptionIcon: {
    fontSize: 22,
  },
  orderOptionTextBlock: {
    flex: 1,
  },
  orderOptionTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  orderOptionCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  orderHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  orderInlineRow: {
    flexDirection: "row",
    gap: 10,
  },
  orderInlineInput: {
    flex: 1,
  },
  orderChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  orderChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#ffffff",
  },
  orderChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  orderChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  orderChipTextActive: {
    color: "#ffffff",
  },
  orderDurationRow: {
    marginTop: 14,
    gap: 8,
  },
  orderLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  orderStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderStepperButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  orderStepperButtonText: {
    color: palette.accent,
    fontSize: 20,
    fontWeight: "900",
  },
  orderStepperValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  orderPricePreview: {
    borderRadius: 16,
    backgroundColor: "#eef6ff",
    padding: 14,
    marginTop: 16,
  },
  orderPriceLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  orderPriceValue: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: "900",
  },
  orderCounter: {
    color: palette.muted,
    fontSize: 12,
    textAlign: "right",
    marginTop: -2,
    marginBottom: 12,
  },
  orderAddressInfo: {
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    padding: 12,
  },
  orderReviewCard: {
    borderRadius: 16,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    padding: 14,
    gap: 10,
  },
  orderReviewItem: {
    gap: 4,
  },
  orderReviewLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  orderReviewValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  orderReviewDivider: {
    height: 1,
    backgroundColor: "#dbe7ff",
    marginVertical: 4,
  },
  orderReviewValueTotal: {
    color: palette.accent,
    fontSize: 22,
    fontWeight: "900",
  },
  orderActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  orderSecondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  orderSecondaryButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  orderPrimaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  orderNextButton: {
    flex: 1,
  },
  orderSuccessButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  orderPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});

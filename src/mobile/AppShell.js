import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  useWindowDimensions,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch, buildApiPathUrl, getToken } from "../config/api";
import { MobileChatCenterProvider, useMobileChatCenter } from "./MobileChatCenter";
import MapConfirmModal from "./MapConfirmModal";

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
const OFFER_START_HOUR = 8;
const OFFER_END_HOUR = 20;
const OFFER_SERVICE_TYPES = [
  { label: "Limpeza padrao", value: "Limpeza padrao", icon: "home" },
  { label: "Limpeza pesada", value: "Limpeza pesada", icon: "droplet" },
  { label: "Pos-obra", value: "Pos-obra", icon: "tool" },
  { label: "Passadoria", value: "Passadoria", icon: "shopping-bag" },
];
const OFFER_TIME_OPTIONS = Array.from(
  { length: (OFFER_END_HOUR - OFFER_START_HOUR) * 2 + 1 },
  (_, index) => {
    const totalMinutes = OFFER_START_HOUR * 60 + index * 30;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minute = String(totalMinutes % 60).padStart(2, "0");
    const value = `${hour}:${minute}`;
    return { label: value, value };
  },
);

function getTodayInputDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatOfferSummaryDate(serviceDate, serviceTime) {
  if (!serviceDate || !serviceTime) {
    return "Defina data e horario";
  }

  const scheduledAt = new Date(`${serviceDate}T${serviceTime}:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return "Data ou horario invalido";
  }

  return scheduledAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNextOrderSlot() {
  const now = new Date();
  const next = new Date(now);
  const currentMinutes = now.getMinutes();
  const roundedMinutes = currentMinutes <= 0 ? 0 : currentMinutes <= 30 ? 30 : 60;

  next.setSeconds(0, 0);
  if (roundedMinutes === 60) {
    next.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(roundedMinutes, 0, 0);
  }

  const dayStart = new Date(next);
  dayStart.setHours(ORDER_START_HOUR, 0, 0, 0);

  const dayEnd = new Date(next);
  dayEnd.setHours(ORDER_END_HOUR, 30, 0, 0);

  if (next < dayStart) {
    next.setHours(ORDER_START_HOUR, 0, 0, 0);
  } else if (next > dayEnd) {
    next.setDate(next.getDate() + 1);
    next.setHours(ORDER_START_HOUR, 0, 0, 0);
  }

  return {
    date: next,
    hour: String(next.getHours()).padStart(2, "0"),
    minute: String(next.getMinutes()).padStart(2, "0"),
  };
}

function buildOrderTimeMask(value = "") {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeOrderTimeValue(value = "") {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (!digits) {
    return { masked: "", hour: "", minute: "" };
  }

  const rawHour = digits.slice(0, Math.min(2, digits.length));
  const rawMinute = digits.length > 2 ? digits.slice(2, 4) : "";

  return {
    masked: buildOrderTimeMask(digits),
    hour: rawHour,
    minute: rawMinute,
  };
}

function finalizeOrderTimeValue(value = "") {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (!digits) {
    return { masked: "", hour: "", minute: "" };
  }

  let parsedHour = Number(digits.slice(0, 2));
  if (Number.isNaN(parsedHour)) {
    parsedHour = ORDER_START_HOUR;
  }
  parsedHour = Math.min(Math.max(parsedHour, ORDER_START_HOUR), ORDER_END_HOUR);

  let parsedMinute = Number((digits.slice(2, 4) || "0").padEnd(2, "0"));
  if (Number.isNaN(parsedMinute)) {
    parsedMinute = 0;
  }
  parsedMinute = parsedMinute >= 30 ? 30 : 0;

  if (parsedHour === ORDER_END_HOUR && parsedMinute > 30) {
    parsedMinute = 30;
  }

  const hour = String(parsedHour).padStart(2, "0");
  const minute = String(parsedMinute).padStart(2, "0");

  return {
    masked: `${hour}:${minute}`,
    hour,
    minute,
  };
}

function getMonthStart(value) {
  const date = value instanceof Date ? new Date(value) : new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addMonths(dateValue, amount) {
  const next = new Date(dateValue);
  next.setMonth(next.getMonth() + amount, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildCalendarDays(monthDate) {
  const start = getMonthStart(monthDate);
  const firstWeekday = start.getDay();
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstWeekday);
  const days = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    current.setHours(0, 0, 0, 0);
    days.push(current);
  }

  return days;
}

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
    residence_type: address.residence_type || address.ResidenceType || "apartment",
    complement: address.complement || address.Complement || "",
    neighborhood: address.neighborhood || address.Neighborhood || "",
    reference_point:
      address.reference_point || address.referencePoint || address.ReferencePoint || "",
    city: address.city || address.City || "",
    state: address.state || address.State || "",
    zipcode: address.zipcode || address.Zipcode || "",
    latitude: Number(address.latitude || address.Latitude || 0),
    longitude: Number(address.longitude || address.Longitude || 0),
    rooms: Array.isArray(address.rooms || address.Rooms)
      ? (address.rooms || address.Rooms).map((room, index) => ({
          id: room?.id || room?.ID || `room-${index}`,
          name: room?.name || room?.Name || "",
          quantity: room?.quantity || room?.Quantity || "",
        }))
      : [],
  };
}

function formatAddress(address) {
  return [address?.street, address?.number, address?.neighborhood, address?.city]
    .filter(Boolean)
    .join(", ");
}

function formatRoleLabel(role = "") {
  return role === "diarista" ? "Diarista" : "Cliente";
}

function formatMonthYear(value) {
  if (!value) return "Nao informado";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Nao informado";
  return parsedDate.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

function formatSpecialtiesDisplay(value) {
  const items = parseSpecialties(value);
  return items.map((item) => getSpecialtyPresentation(item));
}

function getProfilePhoto(profile = {}) {
  return (
    profile?.photo ||
    profile?.Photo ||
    profile?.profile_photo ||
    profile?.profilePhoto ||
    profile?.avatar ||
    profile?.Avatar ||
    ""
  );
}

const defaultProfileForm = {
  name: "",
  email: "",
  phone: "",
  bio: "",
  experience_years: 0,
  desired_frequency: "weekly",
  has_pets: false,
  price_per_hour: 0,
  price_per_day: 0,
  specialties: "",
  available: true,
};

const defaultAddressForm = {
  street: "",
  number: "",
  residence_type: "apartment",
  complement: "",
  neighborhood: "",
  reference_point: "",
  city: "",
  state: "",
  zipcode: "",
  latitude: 0,
  longitude: 0,
  rooms: [],
};

const residenceTypeLabels = {
  apartment: "Apartamento",
  house: "Casa",
  office: "Escritorio",
  studio: "Studio",
};

const frequencyLabels = {
  once: "Uma vez",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  occasional: "Eventual",
};

function onlyDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function formatCep(digits = "") {
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function buildProfileForm(profile = {}) {
  const diaristProfile = profile?.diarist_profile || profile?.DiaristProfile || {};
  const userProfile = profile?.user_profile || profile?.UserProfile || {};

  return {
    name: profile?.name || profile?.Name || "",
    email: profile?.email || profile?.Email || "",
    phone: profile?.phone ? String(profile.phone) : String(profile?.Phone || ""),
    bio: diaristProfile?.bio || diaristProfile?.Bio || "",
    experience_years: diaristProfile?.experience_years || diaristProfile?.ExperienceYears || 0,
    desired_frequency: userProfile?.desired_frequency || userProfile?.DesiredFrequency || "weekly",
    has_pets: Boolean(userProfile?.has_pets ?? userProfile?.HasPets),
    price_per_hour: diaristProfile?.price_per_hour || diaristProfile?.PricePerHour || 0,
    price_per_day: diaristProfile?.price_per_day || diaristProfile?.PricePerDay || 0,
    specialties: parseSpecialties(diaristProfile?.specialties || diaristProfile?.Specialties).join(", "),
    available:
      typeof diaristProfile?.available === "boolean"
        ? diaristProfile.available
        : typeof diaristProfile?.Available === "boolean"
          ? diaristProfile.Available
          : true,
  };
}

function buildAddressForm(address = {}) {
  return {
    street: address.street || "",
    number: address.number || "",
    residence_type: address.residence_type || address.ResidenceType || "apartment",
    complement: address.complement || "",
    neighborhood: address.neighborhood || "",
    reference_point: address.reference_point || "",
    city: address.city || "",
    state: address.state || "",
    zipcode: address.zipcode || "",
    latitude: Number(address.latitude || 0),
    longitude: Number(address.longitude || 0),
    rooms: Array.isArray(address.rooms)
      ? address.rooms.map((room, index) => ({
          id: room?.id || room?.ID || `room-${index}`,
          name: room?.name || room?.Name || "",
          quantity: room?.quantity || room?.Quantity || "",
        }))
      : [],
  };
}

function createRoom(index = 0) {
  return {
    id: `${Date.now()}-${index}`,
    name: "",
    quantity: "",
  };
}

function maskCpf(cpf) {
  if (!cpf) return "Nao informado";
  const digits = String(cpf).replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

function formatCoordinates(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return "Nao informado";
  }

  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

function formatBoolean(value, positive = "Sim", negative = "Nao") {
  return value ? positive : negative;
}

function formatSubscriptionPlan(plan, hasValidSubscription) {
  if (!plan && !hasValidSubscription) return "Sem assinatura";
  if (plan === "premium") return "Premium";
  if (plan === "free") return "Plano gratuito";
  if (!plan) return hasValidSubscription ? "Assinatura ativa" : "Sem assinatura";

  const normalizedPlan = String(plan)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return hasValidSubscription ? `${normalizedPlan} ativa` : normalizedPlan;
}

function formatRoomSummary(rooms = []) {
  if (!Array.isArray(rooms) || rooms.length === 0) return "Nenhum comodo cadastrado";
  return `${rooms.length} comodo(s) cadastrado(s)`;
}

function normalizeStatus(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isServiceChatAvailable(service) {
  const status = normalizeStatus(service?.status || service?.Status || "");
  return status !== "cancelado" && status !== "concluido" && status !== "em servico";
}

function getServiceCounterpart(service = {}, role = "cliente") {
  const source = role === "cliente" ? service?.diarist : service?.client;
  return {
    id: source?.id || source?.ID || null,
    name: source?.name || source?.Name || (role === "cliente" ? "Diarista" : "Cliente"),
    photo:
      source?.Photo ||
      source?.photo ||
      source?.Avatar ||
      source?.avatar ||
      source?.profile_photo ||
      source?.profilePhoto ||
      "",
  };
}

function getServiceAddressLabel(service = {}) {
  const address = service?.address || {};
  const street = address?.street || address?.Street || "";
  const number = address?.number || address?.Number || "";
  const neighborhood = address?.neighborhood || address?.Neighborhood || "";
  const city = address?.city || address?.City || "";

  return [street, number, neighborhood, city].filter(Boolean).join(", ") || "Endereco nao informado";
}

function getServicePrice(service = {}) {
  return (
    service?.total_price ||
    service?.TotalPrice ||
    service?.price ||
    service?.Price ||
    0
  );
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

async function getApiErrorMessage(response, fallbackMessage) {
  try {
    const jsonResponse = await response.clone().json();
    const validationErrors = Array.isArray(jsonResponse?.errors) ? jsonResponse.errors : [];

    if (validationErrors.length > 0) {
      const fieldMessages = validationErrors
        .map(({ field, reason }) => {
          if (typeof reason === "string" && reason.trim()) {
            switch (field) {
              case "scheduled_at":
                if (reason === "must be in the future") {
                  return "Escolha uma data e horario futuros.";
                }
                return "Data ou horario invalido.";
              case "duration_hours":
                return "Informe uma duracao maior que zero.";
              case "service_type":
                return "Descreva o tipo de servico.";
              case "diarist_id":
                return "Nao foi possivel identificar a diarista selecionada.";
              case "body":
                return "Nao foi possivel processar os dados enviados.";
              default:
                return `${field}: ${reason}`;
            }
          }

          return null;
        })
        .filter(Boolean);

      if (fieldMessages.length > 0) {
        return fieldMessages.join("\n");
      }
    }

    const jsonMessage =
      jsonResponse?.message ||
      jsonResponse?.error ||
      jsonResponse?.detail ||
      jsonResponse?.details ||
      jsonResponse?.Message ||
      jsonResponse?.Error;

    if (typeof jsonMessage === "string" && jsonMessage.trim()) {
      return jsonMessage.trim();
    }
  } catch (_error) {
  }

  try {
    const textResponse = await response.clone().text();
    if (typeof textResponse === "string" && textResponse.trim()) {
      return textResponse.trim();
    }
  } catch (_error) {
  }

  return fallbackMessage;
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
  const nextOrderSlot = useMemo(() => getNextOrderSlot(), [visible, diarist?.id]);
  const [currentStep, setCurrentStep] = useState(1);
  const [date, setDate] = useState(null);
  const [hour, setHour] = useState(nextOrderSlot.hour);
  const [minute, setMinute] = useState(nextOrderSlot.minute);
  const [timeInput, setTimeInput] = useState(`${nextOrderSlot.hour}:${nextOrderSlot.minute}`);
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(nextOrderSlot.date));
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
    const fallbackSlot = getNextOrderSlot();
    setDate(null);
    setHour(fallbackSlot.hour);
    setMinute(fallbackSlot.minute);
    setTimeInput(`${fallbackSlot.hour}:${fallbackSlot.minute}`);
    setVisibleMonth(getMonthStart(fallbackSlot.date));
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

  const currentDateValue = date ? formatDateInputValue(date) : "";
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const isSelectedDateBlocked = useMemo(() => {
    if (!date) {
      return false;
    }
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

    if (!date) {
      Alert.alert("Data obrigatoria", "Selecione uma data para continuar.");
      return;
    }

    if (hireType === "hour" && (!hour || !minute)) {
      Alert.alert("Horario obrigatorio", "Selecione um horario para continuar.");
      return;
    }

    if (hireType === "hour") {
      const parsedHour = Number(hour);
      const parsedMinute = Number(minute);

      if (
        Number.isNaN(parsedHour) ||
        Number.isNaN(parsedMinute) ||
        parsedHour < ORDER_START_HOUR ||
        parsedHour > ORDER_END_HOUR ||
        !ORDER_MINUTE_OPTIONS.includes(String(parsedMinute).padStart(2, "0"))
      ) {
        Alert.alert("Horario invalido", "Use um horario entre 08:00 e 16:30.");
        return;
      }
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
      const localScheduledAt = new Date(
        `${formatDateInputValue(date)}T${String(selectedHour).padStart(2, "0")}:${String(
          selectedMinute,
        ).padStart(2, "0")}:00`,
      );

      if (Number.isNaN(localScheduledAt.getTime()) || localScheduledAt.getTime() <= Date.now()) {
        Alert.alert("Horario invalido", "Escolha uma data e horario futuros.");
        setSubmitting(false);
        return;
      }

      const scheduledAt = buildOrderIsoDate(date, selectedHour, selectedMinute);
      const requestBody = {
        diarist_id: diarist.id,
        address_id: getSelectedAddressId(selectedAddress),
        scheduled_at: scheduledAt,
        duration_hours: finalDuration,
        total_price: getDiaristPricePerHour(diarist) * finalDuration,
        service_type: serviceType.trim(),
      };

      console.log("[hire_order] request body", requestBody);
      const response = await apiFetch("/services", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          "Nao foi possivel concluir a contratacao.",
        );
        console.log("[hire_order] api error", errorMessage);
        throw new Error(errorMessage);
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
              <View style={styles.orderCalendarCard}>
                <View style={styles.orderCalendarHeader}>
                  <TouchableOpacity
                    style={styles.orderCalendarNavButton}
                    onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
                  >
                    <Feather name="chevron-left" size={16} color={palette.accent} />
                  </TouchableOpacity>
                  <Text style={styles.orderCalendarTitle}>
                    {visibleMonth.toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                  <TouchableOpacity
                    style={styles.orderCalendarNavButton}
                    onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
                  >
                    <Feather name="chevron-right" size={16} color={palette.accent} />
                  </TouchableOpacity>
                </View>

                <View style={styles.orderCalendarWeekdays}>
                  {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => (
                    <Text key={`${label}-${index}`} style={styles.orderCalendarWeekday}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={styles.orderCalendarGrid}>
                  {calendarDays.map((calendarDay) => {
                    const timestamp = calendarDay.getTime();
                    const isCurrentMonth = calendarDay.getMonth() === visibleMonth.getMonth();
                    const isPastDay = calendarDay < today;
                    const isBlockedDay = !isPastDay && disabledDateSet.has(timestamp);
                    const isSelectedDay = Boolean(date) && isSameDay(calendarDay, date);
                    const isDisabled = !isCurrentMonth || isPastDay || isBlockedDay;

                    return (
                      <TouchableOpacity
                        key={timestamp}
                        disabled={isDisabled}
                        style={[
                          styles.orderCalendarDay,
                          !isCurrentMonth ? styles.orderCalendarDayMuted : null,
                          isPastDay ? styles.orderCalendarDayPast : null,
                          isBlockedDay ? styles.orderCalendarDayBlocked : null,
                          isSelectedDay ? styles.orderCalendarDaySelected : null,
                        ]}
                        onPress={() => setDate(new Date(calendarDay))}
                      >
                        <Text
                          style={[
                            styles.orderCalendarDayText,
                            !isCurrentMonth ? styles.orderCalendarDayTextMuted : null,
                            isPastDay ? styles.orderCalendarDayTextPast : null,
                            isBlockedDay ? styles.orderCalendarDayTextBlocked : null,
                            isSelectedDay ? styles.orderCalendarDayTextSelected : null,
                          ]}
                        >
                          {calendarDay.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {scheduleLoading ? <Text style={styles.orderHint}>Carregando datas ocupadas...</Text> : null}
              {isSelectedDateBlocked ? (
                <Text style={styles.errorText}>Essa data ja possui agendamento pendente para a diarista.</Text>
              ) : null}
              {date ? (
                <Text style={styles.orderHint}>Data selecionada: {formatLongDate(date)}</Text>
              ) : (
                <Text style={styles.orderHint}>Nenhuma data selecionada.</Text>
              )}
            </View>
          ) : null}

          {currentStep === 3 ? (
            <View style={styles.orderSection}>
              {hireType === "hour" ? (
                <>
                  <Text style={styles.orderSectionTitle}>Qual horario?</Text>
                  <Text style={styles.orderSectionCopy}>Selecione inicio e duracao do servico.</Text>
                  <View style={styles.orderTimeFields}>
                    <View style={styles.orderTimeFieldWide}>
                      <Text style={styles.orderTimeLabel}>Horario</Text>
                      <TextInput
                        style={styles.orderTimeInput}
                        value={timeInput}
                        onChangeText={(value) => {
                          const nextValue = normalizeOrderTimeValue(value);
                          setTimeInput(nextValue.masked);
                          setHour(nextValue.hour);
                          setMinute(nextValue.minute);
                        }}
                        onBlur={() => {
                          const nextValue = finalizeOrderTimeValue(timeInput);
                          setTimeInput(nextValue.masked);
                          setHour(nextValue.hour);
                          setMinute(nextValue.minute);
                        }}
                        placeholder="08:30"
                        keyboardType="numeric"
                        maxLength={5}
                        textAlign="center"
                      />
                    </View>
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
  const { width } = useWindowDimensions();
  const isCompactOfferModal = width <= 420;
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
          <View
            style={[
              styles.modalCard,
              styles.offerCreateModalCard,
              isCompactOfferModal ? styles.offerCreateModalCardCompact : null,
            ]}
          >
            <View
              style={[
                styles.offerCreateModalHero,
                isCompactOfferModal ? styles.offerCreateModalHeroCompact : null,
              ]}
            >
              <View style={styles.offerCreateModalHeroCopy}>
                <Text style={[styles.modalTitle, styles.offerCreateHeroTitle]}>Criar oferta</Text>
                <Text style={styles.modalCopy}>
                  Monte a oferta com data, hora e valor em um fluxo mais estavel.
                </Text>
              </View>
            </View>

            <ScrollView
              style={[styles.offerCreateScroll, isCompactOfferModal ? styles.offerCreateScrollCompact : null]}
              contentContainerStyle={[
                styles.offerCreateScrollContent,
                isCompactOfferModal ? styles.offerCreateScrollContentCompact : null,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.offerCreateSection, isCompactOfferModal ? styles.offerCreateSectionCompact : null]}>
                <Text style={styles.offerCreateSectionTitle}>Tipo de servico</Text>
                <Text style={styles.offerCreateSectionCopy}>
                  Escolha a categoria principal da limpeza.
                </Text>
                <Text style={styles.offerCreateFieldLabel}>Tipo de limpeza</Text>
                <View style={styles.offerCreateServiceCards}>
                  {OFFER_SERVICE_TYPES.map((option) => {
                    const isActive = createForm.serviceType === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.offerCreateServiceCard,
                          isActive ? styles.offerCreateServiceCardActive : null,
                        ]}
                        onPress={() =>
                          setCreateForm((current) => ({
                            ...current,
                            serviceType: option.value,
                          }))
                        }
                      >
                        <View style={styles.offerCreateServiceCardHeader}>
                          <View
                            style={[
                              styles.offerCreateServiceCardIconWrap,
                              isActive ? styles.offerCreateServiceCardIconWrapActive : null,
                            ]}
                          >
                            <Feather
                              name={option.icon}
                              size={16}
                              color={isActive ? "#ffffff" : palette.accent}
                            />
                          </View>
                          <View
                            style={[
                              styles.offerCreateServiceCardIndicator,
                              isActive ? styles.offerCreateServiceCardIndicatorActive : null,
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.offerCreateServiceCardTitle,
                            isActive ? styles.offerCreateServiceCardTitleActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.offerCreateSection, isCompactOfferModal ? styles.offerCreateSectionCompact : null]}>
                <Text style={styles.offerCreateSectionTitle}>Agenda</Text>
                <Text style={styles.offerCreateSectionCopy}>
                  Horarios disponiveis entre 08:00 e 20:00.
                </Text>
                <View style={[styles.offerCreateInlineGrid, isCompactOfferModal ? styles.offerCreateInlineGridCompact : null]}>
                  <View style={[styles.offerCreateInlineField, isCompactOfferModal ? styles.offerCreateInlineFieldCompact : null]}>
                    <Text style={styles.offerCreateFieldLabel}>Data do servico</Text>
                    {Platform.OS === "web" ? (
                      <input
                        type="date"
                        min={getTodayInputDate()}
                        value={createForm.serviceDate}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            serviceDate: event.target.value,
                          }))
                        }
                        style={styles.offerCreateWebInput}
                      />
                    ) : (
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Data YYYY-MM-DD"
                        value={createForm.serviceDate}
                        onChangeText={(value) =>
                          setCreateForm((current) => ({ ...current, serviceDate: value }))
                        }
                      />
                    )}
                  </View>

                  <View style={[styles.offerCreateInlineField, isCompactOfferModal ? styles.offerCreateInlineFieldCompact : null]}>
                    <Text style={styles.offerCreateFieldLabel}>Hora de inicio</Text>
                    {Platform.OS === "web" ? (
                      <select
                        value={createForm.serviceTime}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            serviceTime: event.target.value,
                          }))
                        }
                        style={styles.offerCreateWebInput}
                      >
                        {OFFER_TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Hora HH:mm"
                        value={createForm.serviceTime}
                        onChangeText={(value) =>
                          setCreateForm((current) => ({ ...current, serviceTime: value }))
                        }
                      />
                    )}
                  </View>
                </View>
                <Text style={styles.offerCreateFieldHint}>Atalhos de horario</Text>
                <View style={styles.offerCreateChipsRow}>
                  {["08:00", "09:00", "10:00", "13:00", "14:00", "15:00", "16:00"].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.offerCreateChip,
                        createForm.serviceTime === option ? styles.offerCreateChipActive : null,
                      ]}
                      onPress={() =>
                        setCreateForm((current) => ({ ...current, serviceTime: option }))
                      }
                    >
                      <Text
                        style={[
                          styles.offerCreateChipText,
                          createForm.serviceTime === option ? styles.offerCreateChipTextActive : null,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.offerCreateSection, isCompactOfferModal ? styles.offerCreateSectionCompact : null]}>
                <Text style={styles.offerCreateSectionTitle}>Escopo e preco</Text>
                <Text style={styles.offerCreateSectionCopy}>
                  Defina a duracao estimada e o valor inicial da oferta.
                </Text>
                <View style={[styles.offerCreateInlineGrid, isCompactOfferModal ? styles.offerCreateInlineGridCompact : null]}>
                  <View style={[styles.offerCreateInlineField, isCompactOfferModal ? styles.offerCreateInlineFieldCompact : null]}>
                    <Text style={styles.offerCreateFieldLabel}>Duracao (horas)</Text>
                    {Platform.OS === "web" ? (
                      <input
                        type="number"
                        min="1"
                        max="12"
                        step="1"
                        value={createForm.hours}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            hours: event.target.value,
                          }))
                        }
                        style={styles.offerCreateWebInput}
                      />
                    ) : (
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Duracao em horas"
                        keyboardType="numeric"
                        value={createForm.hours}
                        onChangeText={(value) =>
                          setCreateForm((current) => ({ ...current, hours: value }))
                        }
                      />
                    )}
                  </View>
                  <View style={[styles.offerCreateInlineField, isCompactOfferModal ? styles.offerCreateInlineFieldCompact : null]}>
                    <Text style={styles.offerCreateFieldLabel}>Valor inicial (R$)</Text>
                    {Platform.OS === "web" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={createForm.value}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            value: event.target.value,
                          }))
                        }
                        style={styles.offerCreateWebInput}
                      />
                    ) : (
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Valor inicial"
                        keyboardType="numeric"
                        value={createForm.value}
                        onChangeText={(value) =>
                          setCreateForm((current) => ({ ...current, value: value }))
                        }
                      />
                    )}
                  </View>
                </View>
                <View style={[styles.offerCreateSummaryCard, isCompactOfferModal ? styles.offerCreateSummaryCardCompact : null]}>
                  <View style={[styles.offerCreateSummaryRow, isCompactOfferModal ? styles.offerCreateSummaryRowCompact : null]}>
                    <Text style={styles.offerCreateSummaryLabel}>Agendamento</Text>
                    <Text style={styles.offerCreateSummaryValue}>
                      {formatOfferSummaryDate(createForm.serviceDate, createForm.serviceTime)}
                    </Text>
                  </View>
                  <View style={[styles.offerCreateSummaryRow, isCompactOfferModal ? styles.offerCreateSummaryRowCompact : null]}>
                    <Text style={styles.offerCreateSummaryLabel}>Estimativa</Text>
                    <Text style={styles.offerCreateSummaryValue}>
                      {createForm.hours || "0"}h • {createForm.value ? formatCurrency(Number(createForm.value)) : "R$ 0,00"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.offerCreateSection, isCompactOfferModal ? styles.offerCreateSectionCompact : null]}>
                <Text style={styles.offerCreateSectionTitle}>Observacoes</Text>
                <Text style={styles.offerCreateSectionCopy}>
                  Adicione contexto para a diarista chegar preparada.
                </Text>
                <Text style={styles.offerCreateFieldLabel}>Observacoes (opcional)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea, styles.offerCreateTextarea]}
                  placeholder="Ex.: apartamento com pets, foco na cozinha, levar escada pequena..."
                  multiline
                  value={createForm.observations}
                  onChangeText={(value) =>
                    setCreateForm((current) => ({ ...current, observations: value }))
                  }
                />
              </View>
            </ScrollView>

            <View
              style={[
                styles.modalActionRow,
                styles.offerCreateModalActions,
                isCompactOfferModal ? styles.offerCreateModalActionsCompact : null,
              ]}
            >
              <TouchableOpacity
                style={[styles.modalGhostButton, isCompactOfferModal ? styles.offerCreateActionButtonCompact : null]}
                onPress={() => setCreateModalOpen(false)}
              >
                <Text style={styles.modalGhostButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryInlineButton, isCompactOfferModal ? styles.offerCreateActionButtonCompact : null]}
                onPress={handleCreateOffer}
              >
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

function ServicesScreen({ session }) {
  const [tab, setTab] = useState("active");
  const { openChat } = useMobileChatCenter();

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
                <View style={styles.serviceCardHeader}>
                  <View style={styles.serviceCardHeaderMain}>
                    <Text style={styles.listTitle}>Servico #{service?.id || service?.ID || index + 1}</Text>
                    <Text style={styles.secondaryLine}>
                      {session.role === "cliente" ? "Diarista" : "Cliente"}:{" "}
                      {getServiceCounterpart(service, session.role).name}
                    </Text>
                  </View>
                  <Text style={styles.metaBadge}>{service?.status || service?.Status || "status"}</Text>
                </View>
                <Text style={styles.secondaryLine}>
                  {formatDate(service?.scheduled_at || service?.ScheduledAt)}
                </Text>
                <Text style={styles.secondaryLine}>{getServiceAddressLabel(service)}</Text>
                <View style={styles.inlineMeta}>
                  {getServicePrice(service) ? (
                    <Text style={styles.metaBadge}>{formatCurrency(getServicePrice(service))}</Text>
                  ) : null}
                  {service?.duration_hours || service?.DurationHours ? (
                    <Text style={styles.metaBadge}>
                      {Number(service?.duration_hours || service?.DurationHours || 0)}h
                    </Text>
                  ) : null}
                </View>

                {isServiceChatAvailable(service) ? (
                  <TouchableOpacity
                    style={styles.serviceChatButton}
                    onPress={() => openChat(service)}
                  >
                    <Feather name="message-circle" size={16} color="#ffffff" />
                    <Text style={styles.serviceChatButtonText}>
                      {session.role === "cliente" ? "Falar com a diarista" : "Falar com cliente"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.secondaryLine}>
                    O chat fica indisponivel para servicos em servico, cancelados ou concluidos.
                  </Text>
                )}
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    );
  }

function ProfileScreen({ session }) {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("personal");
  const [editMode, setEditMode] = useState(false);
  const [user, setUser] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [emailVerified, setEmailVerified] = useState(Boolean(session.emailVerified));
  const [subscriptionSummary, setSubscriptionSummary] = useState({
    hasValidSubscription: Boolean(session.hasValidSubscription || session.isTestUser),
    plan: "",
    status: "",
  });
  const [profileForm, setProfileForm] = useState(defaultProfileForm);
  const [addressForm, setAddressForm] = useState(defaultAddressForm);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editingRoomsAddressId, setEditingRoomsAddressId] = useState(null);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [isAddressRoomsOpen, setIsAddressRoomsOpen] = useState(false);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [addressMapCoords, setAddressMapCoords] = useState(null);
  const [addressNotice, setAddressNotice] = useState(null);
  const [addressCepLoading, setAddressCepLoading] = useState(false);
  const [expandedAddressRooms, setExpandedAddressRooms] = useState({});
  const [emailResendLoading, setEmailResendLoading] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [status, setStatus] = useState({ show: false, success: false, message: "" });
  const [actionLoading, setActionLoading] = useState({
    uploadPhoto: false,
    saveProfile: false,
    saveAddress: false,
    deleteAddressId: null,
  });

  const isDiarist = session.role === "diarista";
  const userProfile = user?.user_profile || user?.UserProfile || {};
  const diaristProfile = user?.diarist_profile || user?.DiaristProfile || {};
  const specialtyItems = formatSpecialtiesDisplay(diaristProfile?.specialties || diaristProfile?.Specialties);
  const profilePhoto = getProfilePhoto(user);
  const profileName = user?.name || user?.Name || "Usuario";
  const profileEmail = user?.email || user?.Email || "E-mail nao informado";
  const createdAt = user?.created_at || user?.CreatedAt;
  const subscriptionLabel = formatSubscriptionPlan(
    subscriptionSummary.plan,
    subscriptionSummary.hasValidSubscription,
  );
  const subscriptionStatusLabel = subscriptionSummary.status
    ? String(subscriptionSummary.status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : subscriptionSummary.hasValidSubscription
      ? "Ativa"
      : "Sem assinatura";
  const isCompact = width <= 360;
  const isNarrow = width <= 420;
  const contentMaxWidth = width >= 768 ? 620 : width >= 520 ? 560 : 480;
  const responsiveShellStyle = {
    width: "100%",
    maxWidth: contentMaxWidth,
    alignSelf: "center",
  };

  const syncProfileState = useCallback(
    (profile, subscription = {}) => {
      const normalizedAddresses = Array.isArray(profile?.address || profile?.Address)
        ? (profile.address || profile.Address).map(normalizeAddress)
        : [];

      setUser(profile || {});
      setAddresses(normalizedAddresses);
      setEmailVerified(Boolean(profile?.email_verified ?? profile?.EmailVerified ?? session.emailVerified));
      setProfileForm(buildProfileForm(profile || {}));
      setSubscriptionSummary({
        hasValidSubscription: Boolean(
          subscription?.has_valid_subscription ||
            subscription?.is_test_user ||
            session.hasValidSubscription ||
            session.isTestUser,
        ),
        plan: subscription?.subscription_plan || subscription?.plan || "",
        status: subscription?.status || "",
      });
    },
    [session.emailVerified, session.hasValidSubscription, session.isTestUser],
  );

  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
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

        syncProfileState(profile, subscription);
      } catch (loadError) {
        setError(loadError.message || "Nao foi possivel carregar o perfil.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [syncProfileState],
  );

  useEffect(() => {
    void loadProfile(false);
  }, [loadProfile]);

  const closeStatusModal = () => setStatus((prev) => ({ ...prev, show: false }));

  const handleProfileChange = (name, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditToggle = () => {
    if (editMode) {
      setProfileForm(buildProfileForm(user));
    }
    setEditMode((prev) => !prev);
  };

  const handlePhotoSelection = async (file) => {
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("photo", file);

    try {
      setActionLoading((prev) => ({ ...prev, uploadPhoto: true }));
      const response = await apiFetch("/upload-photo", {
        method: "POST",
        authenticated: true,
        body: uploadData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "Erro ao atualizar a foto.");
      }

      setUser((prev) => ({ ...prev, photo: data?.url || prev?.photo || "" }));
      setStatus({ show: true, success: true, message: "Foto atualizada com sucesso." });
    } catch (uploadError) {
      setStatus({
        show: true,
        success: false,
        message: uploadError.message || "Erro ao atualizar a foto.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, uploadPhoto: false }));
      setPhotoPickerOpen(false);
    }
  };

  const openFilePicker = (useCamera = false) => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setStatus({
        show: true,
        success: false,
        message: "Envio de foto disponivel no web por enquanto.",
      });
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (useCamera) {
      input.setAttribute("capture", "environment");
    }
    input.onchange = (event) => {
      const file = event?.target?.files?.[0];
      void handlePhotoSelection(file);
    };
    input.click();
  };

  const handleProfileSave = async () => {
    try {
      setActionLoading((prev) => ({ ...prev, saveProfile: true }));

      const normalizedPayload = {
        ...profileForm,
        experience_years: Number(profileForm.experience_years || 0),
        price_per_hour: Number(profileForm.price_per_hour || 0),
        price_per_day: Number(profileForm.price_per_day || 0),
        specialties: parseSpecialties(profileForm.specialties),
      };

      const response = await apiFetch("/profile", {
        method: "PUT",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedPayload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao atualizar perfil.");
      }

      syncProfileState(data, subscriptionSummary);
      setEditMode(false);
      setStatus({ show: true, success: true, message: "Perfil atualizado com sucesso." });
    } catch (saveError) {
      setStatus({
        show: true,
        success: false,
        message: saveError.message || "Erro ao atualizar perfil.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, saveProfile: false }));
    }
  };

  const handleResendVerificationEmail = async () => {
    try {
      setEmailResendLoading(true);
      const response = await apiFetch("/auth/email-verification/resend", {
        method: "POST",
        authenticated: true,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel reenviar o e-mail.");
      }

      setStatus({
        show: true,
        success: true,
        message: data?.message || "E-mail de ativacao reenviado com sucesso.",
      });
    } catch (resendError) {
      setStatus({
        show: true,
        success: false,
        message: resendError.message || "Nao foi possivel reenviar o e-mail.",
      });
    } finally {
      setEmailResendLoading(false);
    }
  };

  const handleAddressChange = (name, value) => {
    const nextValue = name === "zipcode" ? onlyDigits(value).slice(0, 8) : value;
    const affectsLocation = ["zipcode", "street", "number", "neighborhood", "city", "state"].includes(name);

    setAddressForm((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(affectsLocation ? { latitude: 0, longitude: 0 } : {}),
    }));

    if (affectsLocation) {
      setAddressMapCoords(null);
      setAddressNotice(null);
    }
  };

  const handleAddressRoomChange = (roomId, field, value) => {
    setAddressForm((prev) => ({
      ...prev,
      rooms: (prev.rooms || []).map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]: field === "quantity" ? onlyDigits(value).slice(0, 2) : value,
            }
          : room,
      ),
    }));
  };

  const handleAddAddressRoom = () => {
    setAddressForm((prev) => ({
      ...prev,
      rooms: [...(prev.rooms || []), createRoom((prev.rooms || []).length)],
    }));
  };

  const handleRemoveAddressRoom = (roomId) => {
    setAddressForm((prev) => ({
      ...prev,
      rooms: (prev.rooms || []).filter((room) => room.id !== roomId),
    }));
  };

  const handleUseCurrentLocationForNewAddress = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude),
          lon: Number(position.coords.longitude),
        };
        setAddressMapCoords(coords);
        setAddressForm((prev) => ({
          ...prev,
          latitude: coords.lat,
          longitude: coords.lon,
        }));
        setAddressNotice({
          type: "success",
          text: "Localizacao atual capturada. Confirme o ponto exato no mapa se desejar.",
        });
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 7000,
      },
    );
  };

  const handleCepSearch = async () => {
    const zipcode = onlyDigits(addressForm.zipcode).slice(0, 8);
    if (zipcode.length !== 8) {
      setAddressNotice({
        type: "warning",
        text: "Informe um CEP com 8 digitos para localizar o endereco.",
      });
      return;
    }

    try {
      setAddressCepLoading(true);
      setAddressNotice(null);

      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`);
      const viaCepData = await viaCepResponse.json();

      if (viaCepData?.erro) {
        throw new Error("CEP nao encontrado.");
      }

      const nextAddress = {
        street: viaCepData.logradouro || addressForm.street,
        neighborhood: viaCepData.bairro || addressForm.neighborhood,
        city: viaCepData.localidade || addressForm.city,
        state: viaCepData.uf || addressForm.state,
        zipcode,
      };

      setAddressForm((prev) => ({
        ...prev,
        ...nextAddress,
      }));

      const query = [
        nextAddress.street,
        addressForm.number,
        nextAddress.neighborhood,
        nextAddress.city,
        nextAddress.state,
        "Brasil",
      ]
        .filter(Boolean)
        .join(", ");

      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );
      const nominatimData = await nominatimResponse.json().catch(() => []);

      if (Array.isArray(nominatimData) && nominatimData[0]) {
        const coords = {
          lat: Number(nominatimData[0].lat),
          lon: Number(nominatimData[0].lon),
        };
        setAddressMapCoords(coords);
        setAddressForm((prev) => ({
          ...prev,
          latitude: coords.lat,
          longitude: coords.lon,
        }));
        setAddressNotice({
          type: "success",
          text: "Endereco localizado. Abra o mapa para confirmar o pin exato.",
        });
      } else {
        setAddressNotice({
          type: "warning",
          text: "CEP localizado, mas nao encontramos coordenadas automaticas. Abra o mapa para confirmar.",
        });
      }
    } catch (cepError) {
      setAddressNotice({
        type: "error",
        text: cepError.message || "Nao foi possivel localizar o CEP.",
      });
    } finally {
      setAddressCepLoading(false);
    }
  };

  const openAddressForm = () => {
    setActiveSection("addresses");
    setEditingAddressId(null);
    setEditingRoomsAddressId(null);
    setAddressForm(defaultAddressForm);
    setAddressMapCoords(null);
    setAddressNotice(null);
    setIsAddressFormOpen(true);
    setIsAddressRoomsOpen(false);
    handleUseCurrentLocationForNewAddress();
  };

  const openEditAddressForm = (address) => {
    setActiveSection("addresses");
    setEditingAddressId(address.id);
    setEditingRoomsAddressId(null);
    setAddressForm(buildAddressForm(address));
    setAddressMapCoords(
      address.latitude && address.longitude
        ? { lat: Number(address.latitude), lon: Number(address.longitude) }
        : null,
    );
    setAddressNotice(null);
    setIsAddressFormOpen(true);
    setIsAddressRoomsOpen(false);
  };

  const openInlineRoomsEditor = (address) => {
    const nextForm = buildAddressForm(address);
    if (!Array.isArray(nextForm.rooms) || nextForm.rooms.length === 0) {
      nextForm.rooms = [createRoom(0)];
    }

    setEditingAddressId(address.id);
    setEditingRoomsAddressId(address.id);
    setAddressForm(nextForm);
    setExpandedAddressRooms((prev) => ({ ...prev, [address.id]: true }));
  };

  const closeAddressForm = () => {
    setEditingAddressId(null);
    setEditingRoomsAddressId(null);
    setAddressForm(defaultAddressForm);
    setAddressMapCoords(null);
    setAddressNotice(null);
    setShowAddressMap(false);
    setIsAddressFormOpen(false);
    setIsAddressRoomsOpen(false);
  };

  const closeInlineRoomsEditor = () => {
    setEditingRoomsAddressId(null);
    setEditingAddressId(null);
    setAddressForm(defaultAddressForm);
    setAddressMapCoords(null);
    setAddressNotice(null);
  };

  const handleAddressCoordsChange = (coords) => {
    const lat = Number(coords?.lat ?? coords?.latitude ?? 0);
    const lon = Number(coords?.lon ?? coords?.longitude ?? 0);

    setAddressMapCoords({ lat, lon });
    setAddressForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
    }));
    setAddressNotice({
      type: "success",
      text: "Localizacao confirmada. Agora voce pode salvar o endereco.",
    });
    setShowAddressMap(false);
  };

  const handleOpenAddressMap = () => {
    if (addressMapCoords?.lat && addressMapCoords?.lon) {
      setShowAddressMap(true);
      return;
    }

    void handleCepSearch().then(() => {
      setShowAddressMap(true);
    });
  };

  const handleAddressSave = async () => {
    try {
      if (!addressForm.latitude || !addressForm.longitude) {
        setAddressNotice({
          type: "warning",
          text: "Confirme a localizacao do endereco no mapa antes de salvar.",
        });
        return;
      }

      setActionLoading((prev) => ({ ...prev, saveAddress: true }));
      const endpoint = editingAddressId ? `/addresses/${editingAddressId}` : "/addresses";
      const method = editingAddressId ? "PUT" : "POST";
      const normalizedRooms = isDiarist
        ? []
        : (addressForm.rooms || [])
            .map((room) => ({
              name: room.name?.trim() || "",
              quantity: Number(room.quantity || 0),
            }))
            .filter((room) => room.name && room.quantity > 0);

      const response = await apiFetch(endpoint, {
        method,
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...addressForm,
          zipcode: onlyDigits(addressForm.zipcode),
          latitude: Number(addressForm.latitude || 0),
          longitude: Number(addressForm.longitude || 0),
          rooms: normalizedRooms,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel salvar o endereco.");
      }

      await loadProfile(false);
      closeAddressForm();
      setStatus({
        show: true,
        success: true,
        message: editingAddressId ? "Endereco atualizado com sucesso." : "Endereco adicionado com sucesso.",
      });
    } catch (addressError) {
      setStatus({
        show: true,
        success: false,
        message: addressError.message || "Nao foi possivel salvar o endereco.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, saveAddress: false }));
    }
  };

  const handleDeleteAddress = (addressId) => {
    const runDelete = async () => {
      try {
        setActionLoading((prev) => ({ ...prev, deleteAddressId: addressId }));
        const response = await apiFetch(`/addresses/${addressId}`, {
          method: "DELETE",
          authenticated: true,
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel excluir o endereco.");
        }

        await loadProfile(false);
        setStatus({ show: true, success: true, message: "Endereco removido com sucesso." });
      } catch (deleteError) {
        setStatus({
          show: true,
          success: false,
          message: deleteError.message || "Nao foi possivel excluir o endereco.",
        });
      } finally {
        setActionLoading((prev) => ({ ...prev, deleteAddressId: null }));
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm("Deseja excluir este endereco?")) {
        void runDelete();
      }
      return;
    }

    Alert.alert("Excluir endereco", "Deseja excluir este endereco?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void runDelete() },
    ]);
  };

  const heroBadges = [
    { key: "role", label: formatRoleLabel(session.role), tone: "primary", icon: "user" },
    {
      key: "subscription",
      label: session.isTestUser ? "Usuario de teste" : subscriptionLabel,
      tone: subscriptionSummary.hasValidSubscription ? "success" : "muted",
      icon: "shield",
    },
    {
      key: "email",
      label: emailVerified ? "E-mail verificado" : "E-mail pendente",
      tone: emailVerified ? "success" : "warning",
      icon: emailVerified ? "check-circle" : "alert-circle",
    },
  ];

  if (loading && !user?.id) {
    return <LoadingState label="Carregando perfil..." />;
  }

  return (
    <>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.screenContent,
          styles.profileCompleteContent,
          { paddingHorizontal: isCompact ? 12 : 16 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfile(true)} />}
      >
        {error ? (
          <View style={responsiveShellStyle}>
            <SectionCard title="Perfil">
              <Text style={styles.errorText}>{error}</Text>
            </SectionCard>
          </View>
        ) : (
          <View style={[styles.profileCompleteStack, responsiveShellStyle]}>
            <View
              style={[
                styles.profileCompleteHero,
                isCompact ? styles.profileCompleteHeroCompact : null,
              ]}
            >
              <View
                style={[
                  styles.profileCompleteHeroIdentity,
                  isCompact ? styles.profileCompleteHeroIdentityCompact : null,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.profileCompleteAvatarShell}
                  onPress={() => {
                    if (!actionLoading.uploadPhoto) {
                      setPhotoPickerOpen(true);
                    }
                  }}
                >
                  {profilePhoto ? (
                    <Image source={{ uri: profilePhoto }} style={styles.profileCompleteAvatarImage} />
                  ) : (
                    <View style={styles.profileCompleteAvatarFallback}>
                      <Text style={styles.profileCompleteAvatarFallbackText}>
                        {String(profileName).trim().charAt(0).toUpperCase() || "U"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileCompleteAvatarOverlay}>
                    <Feather name="camera" size={14} color="#ffffff" />
                  </View>
                </TouchableOpacity>

                <View style={styles.profileCompleteHeroCopy}>
                  <View style={styles.profileCompleteHeroCopyTop}>
                    <Text style={styles.profileCompleteKicker}>Meu perfil</Text>
                    <TouchableOpacity
                      style={[
                        styles.profileCompleteEditFab,
                        editMode ? styles.profileCompleteEditFabActive : null,
                      ]}
                      onPress={handleEditToggle}
                      activeOpacity={0.85}
                    >
                      <Feather name={editMode ? "x" : "edit-2"} size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                  <Text
                    style={[
                      styles.profileCompleteName,
                      isCompact ? styles.profileCompleteNameCompact : null,
                    ]}
                  >
                    {profileName}
                  </Text>
                  <Text style={styles.profileCompleteEmail}>{profileEmail}</Text>
                </View>
              </View>

              <View style={styles.profileCompleteBadgeRow}>
                {heroBadges.map((badge) => (
                  <View
                    key={badge.key}
                    style={[
                      styles.profileCompleteBadge,
                      badge.tone === "primary"
                        ? styles.profileCompleteBadgePrimary
                        : badge.tone === "success"
                          ? styles.profileCompleteBadgeSuccess
                          : badge.tone === "warning"
                            ? styles.profileCompleteBadgeWarning
                            : styles.profileCompleteBadgeMuted,
                    ]}
                  >
                    <Feather
                      name={badge.icon}
                      size={12}
                      color={badge.tone === "warning" ? "#92400e" : palette.ink}
                    />
                    <Text
                      style={[
                        styles.profileCompleteBadgeText,
                        badge.tone === "warning" ? styles.profileCompleteBadgeTextWarning : null,
                      ]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.profileCompleteMetrics}>
                <View
                  style={[
                    styles.profileCompleteMetric,
                    isCompact ? styles.profileCompleteMetricCompact : null,
                  ]}
                >
                  <Text style={styles.profileCompleteMetricLabel}>Membro desde</Text>
                  <Text style={styles.profileCompleteMetricValue}>{formatDate(createdAt)}</Text>
                </View>
                <View
                  style={[
                    styles.profileCompleteMetric,
                    isCompact ? styles.profileCompleteMetricCompact : null,
                  ]}
                >
                  <Text style={styles.profileCompleteMetricLabel}>Enderecos</Text>
                  <Text style={styles.profileCompleteMetricValue}>{addresses.length}</Text>
                </View>
                <View
                  style={[
                    styles.profileCompleteMetric,
                    isCompact ? styles.profileCompleteMetricCompact : null,
                  ]}
                >
                  <Text style={styles.profileCompleteMetricLabel}>
                    {isDiarist ? "Experiencia" : "Frequencia"}
                  </Text>
                  <Text style={styles.profileCompleteMetricValue}>
                    {isDiarist
                      ? `${Number(diaristProfile?.experience_years || diaristProfile?.ExperienceYears || 0)} anos`
                      : frequencyLabels[userProfile?.desired_frequency || userProfile?.DesiredFrequency] ||
                        "Nao informado"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.profileCompleteTabs}>
              <TouchableOpacity
                style={[
                  styles.profileCompleteTab,
                  activeSection === "personal" ? styles.profileCompleteTabActive : null,
                ]}
                onPress={() => setActiveSection("personal")}
              >
                <Feather
                  name="user"
                  size={15}
                  color="#ffffff"
                />
                <Text
                  style={[
                    styles.profileCompleteTabText,
                    activeSection === "personal" ? styles.profileCompleteTabTextActive : null,
                  ]}
                >
                  Informacoes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profileCompleteTab,
                  activeSection === "addresses" ? styles.profileCompleteTabActive : null,
                ]}
                onPress={() => setActiveSection("addresses")}
              >
                <Feather
                  name="map-pin"
                  size={15}
                  color="#ffffff"
                />
                <Text
                  style={[
                    styles.profileCompleteTabText,
                    activeSection === "addresses" ? styles.profileCompleteTabTextActive : null,
                  ]}
                >
                  Enderecos
                </Text>
              </TouchableOpacity>
            </View>

            {activeSection === "personal" ? (
              <>
                <View
                  style={[
                    styles.profileCompleteCard,
                    isCompact ? styles.profileCompleteCardCompact : null,
                  ]}
                >
                  <View style={styles.profileCompleteCardHead}>
                    <View>
                      <Text style={styles.profileCompleteCardKicker}>Informacoes pessoais</Text>
                      <Text style={styles.profileCompleteCardTitle}>Conta e cadastro</Text>
                    </View>
                  </View>

                  {editMode ? (
                    <View style={styles.profileCompleteFormGrid}>
                      <View style={styles.profileCompleteField}>
                        <Text style={styles.profileCompleteFieldLabel}>Nome</Text>
                        <TextInput
                          value={profileForm.name}
                          onChangeText={(value) => handleProfileChange("name", value)}
                          style={styles.profileCompleteInput}
                          placeholder="Seu nome"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>

                      <View style={styles.profileCompleteField}>
                        <Text style={styles.profileCompleteFieldLabel}>E-mail</Text>
                        <TextInput
                          value={profileForm.email}
                          onChangeText={(value) => handleProfileChange("email", value)}
                          style={styles.profileCompleteInput}
                          placeholder="Seu e-mail"
                          placeholderTextColor="#9ca3af"
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={styles.profileCompleteField}>
                        <Text style={styles.profileCompleteFieldLabel}>Telefone</Text>
                        <TextInput
                          value={profileForm.phone}
                          onChangeText={(value) => handleProfileChange("phone", value)}
                          style={styles.profileCompleteInput}
                          placeholder="Seu telefone"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>

                      <View style={styles.profileCompleteField}>
                        <Text style={styles.profileCompleteFieldLabel}>CPF</Text>
                        <TextInput value={maskCpf(user?.cpf || user?.Cpf || "")} editable={false} style={styles.profileCompleteInputDisabled} />
                      </View>

                      {!isDiarist ? (
                        <>
                          <View style={styles.profileCompleteField}>
                            <Text style={styles.profileCompleteFieldLabel}>Frequencia desejada</Text>
                            <View style={styles.profileCompleteChoiceGrid}>
                              {Object.entries(frequencyLabels).map(([value, label]) => (
                                <TouchableOpacity
                                  key={value}
                                  style={[
                                    styles.profileCompleteChoiceChip,
                                    profileForm.desired_frequency === value
                                      ? styles.profileCompleteChoiceChipActive
                                      : null,
                                  ]}
                                  onPress={() => handleProfileChange("desired_frequency", value)}
                                >
                                  <Text
                                    style={[
                                      styles.profileCompleteChoiceChipText,
                                      profileForm.desired_frequency === value
                                        ? styles.profileCompleteChoiceChipTextActive
                                        : null,
                                    ]}
                                  >
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          <View style={styles.profileCompleteField}>
                            <Text style={styles.profileCompleteFieldLabel}>Possui pets</Text>
                            <View style={styles.profileCompleteBooleanRow}>
                              <TouchableOpacity
                                style={[
                                  styles.profileCompleteBooleanButton,
                                  profileForm.has_pets ? styles.profileCompleteBooleanButtonActive : null,
                                ]}
                                onPress={() => handleProfileChange("has_pets", true)}
                              >
                                <Text
                                  style={[
                                    styles.profileCompleteBooleanButtonText,
                                    profileForm.has_pets ? styles.profileCompleteBooleanButtonTextActive : null,
                                  ]}
                                >
                                  Sim
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.profileCompleteBooleanButton,
                                  !profileForm.has_pets ? styles.profileCompleteBooleanButtonActive : null,
                                ]}
                                onPress={() => handleProfileChange("has_pets", false)}
                              >
                                <Text
                                  style={[
                                    styles.profileCompleteBooleanButtonText,
                                    !profileForm.has_pets ? styles.profileCompleteBooleanButtonTextActive : null,
                                  ]}
                                >
                                  Nao
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.profileCompleteInfoList}>
                      <View style={styles.profileCompleteInfoRow}>
                        <Text style={styles.profileCompleteInfoLabel}>ID da conta</Text>
                        <Text style={styles.profileCompleteInfoValue}>#{user?.id || user?.ID || "Nao informado"}</Text>
                      </View>
                      <View style={styles.profileCompleteInfoRow}>
                        <Text style={styles.profileCompleteInfoLabel}>Nome</Text>
                        <Text style={styles.profileCompleteInfoValue}>{profileName}</Text>
                      </View>
                      <View style={styles.profileCompleteInfoRow}>
                        <Text style={styles.profileCompleteInfoLabel}>E-mail</Text>
                        <Text style={styles.profileCompleteInfoValue}>{profileEmail}</Text>
                      </View>
                      <View style={styles.profileCompleteInfoRow}>
                        <Text style={styles.profileCompleteInfoLabel}>Telefone</Text>
                        <Text style={styles.profileCompleteInfoValue}>
                          {user?.phone || user?.Phone || "Nao informado"}
                        </Text>
                      </View>
                      <View style={styles.profileCompleteInfoRow}>
                        <Text style={styles.profileCompleteInfoLabel}>CPF</Text>
                        <Text style={styles.profileCompleteInfoValue}>{maskCpf(user?.cpf || user?.Cpf || "")}</Text>
                      </View>
                      <View style={styles.profileCompleteInfoRow}>
                        <Text style={styles.profileCompleteInfoLabel}>Papel</Text>
                        <Text style={styles.profileCompleteInfoValue}>{formatRoleLabel(session.role)}</Text>
                      </View>
                      {!isDiarist ? (
                        <>
                          <View style={styles.profileCompleteInfoRow}>
                            <Text style={styles.profileCompleteInfoLabel}>Frequencia desejada</Text>
                            <Text style={styles.profileCompleteInfoValue}>
                              {frequencyLabels[userProfile?.desired_frequency || userProfile?.DesiredFrequency] ||
                                "Nao informado"}
                            </Text>
                          </View>
                          <View style={styles.profileCompleteInfoRow}>
                            <Text style={styles.profileCompleteInfoLabel}>Possui pets</Text>
                            <Text style={styles.profileCompleteInfoValue}>
                              {formatBoolean(userProfile?.has_pets || userProfile?.HasPets)}
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  )}
                </View>

                {isDiarist ? (
                  <View
                    style={[
                      styles.profileCompleteCard,
                      isCompact ? styles.profileCompleteCardCompact : null,
                    ]}
                  >
                    <View style={styles.profileCompleteCardHead}>
                      <View>
                        <Text style={styles.profileCompleteCardKicker}>Perfil profissional</Text>
                        <Text style={styles.profileCompleteCardTitle}>Bio, precos e disponibilidade</Text>
                      </View>
                    </View>

                    {editMode ? (
                      <View style={styles.profileCompleteFormGrid}>
                        <View style={[styles.profileCompleteField, styles.profileCompleteFieldFull]}>
                          <Text style={styles.profileCompleteFieldLabel}>Bio</Text>
                          <TextInput
                            value={profileForm.bio}
                            onChangeText={(value) => handleProfileChange("bio", value)}
                            style={[styles.profileCompleteInput, styles.profileCompleteTextarea]}
                            multiline
                            placeholder="Fale sobre sua experiencia"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Anos de experiencia</Text>
                          <TextInput
                            value={String(profileForm.experience_years ?? "")}
                            onChangeText={(value) =>
                              handleProfileChange("experience_years", onlyDigits(value).slice(0, 2))
                            }
                            style={styles.profileCompleteInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Preco por hora</Text>
                          <TextInput
                            value={String(profileForm.price_per_hour ?? "")}
                            onChangeText={(value) => handleProfileChange("price_per_hour", value.replace(",", "."))}
                            style={styles.profileCompleteInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Preco por diaria</Text>
                          <TextInput
                            value={String(profileForm.price_per_day ?? "")}
                            onChangeText={(value) => handleProfileChange("price_per_day", value.replace(",", "."))}
                            style={styles.profileCompleteInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Disponivel</Text>
                          <View style={styles.profileCompleteBooleanRow}>
                            <TouchableOpacity
                              style={[
                                styles.profileCompleteBooleanButton,
                                profileForm.available ? styles.profileCompleteBooleanButtonActive : null,
                              ]}
                              onPress={() => handleProfileChange("available", true)}
                            >
                              <Text
                                style={[
                                  styles.profileCompleteBooleanButtonText,
                                  profileForm.available ? styles.profileCompleteBooleanButtonTextActive : null,
                                ]}
                              >
                                Sim
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.profileCompleteBooleanButton,
                                !profileForm.available ? styles.profileCompleteBooleanButtonActive : null,
                              ]}
                              onPress={() => handleProfileChange("available", false)}
                            >
                              <Text
                                style={[
                                  styles.profileCompleteBooleanButtonText,
                                  !profileForm.available ? styles.profileCompleteBooleanButtonTextActive : null,
                                ]}
                              >
                                Nao
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={[styles.profileCompleteField, styles.profileCompleteFieldFull]}>
                          <Text style={styles.profileCompleteFieldLabel}>Especialidades</Text>
                          <TextInput
                            value={profileForm.specialties}
                            onChangeText={(value) => handleProfileChange("specialties", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Ex.: limpeza_basica, passar_roupa"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.profileCompleteParagraph}>
                          {diaristProfile?.bio || diaristProfile?.Bio || "Bio nao informada."}
                        </Text>

                        <View style={styles.profileCompleteMetaRow}>
                          <View style={styles.profileCompleteMetaChip}>
                            <Text style={styles.profileCompleteMetaChipText}>
                              {Number(diaristProfile?.experience_years || diaristProfile?.ExperienceYears || 0)} anos
                            </Text>
                          </View>
                          <View style={styles.profileCompleteMetaChip}>
                            <Text style={styles.profileCompleteMetaChipText}>
                              {formatCurrency(diaristProfile?.price_per_hour || diaristProfile?.PricePerHour || 0)}/hora
                            </Text>
                          </View>
                          <View style={styles.profileCompleteMetaChip}>
                            <Text style={styles.profileCompleteMetaChipText}>
                              {formatCurrency(diaristProfile?.price_per_day || diaristProfile?.PricePerDay || 0)}/diaria
                            </Text>
                          </View>
                          <View style={styles.profileCompleteMetaChip}>
                            <Text style={styles.profileCompleteMetaChipText}>
                              {(diaristProfile?.available ?? diaristProfile?.Available) ? "Disponivel" : "Offline"}
                            </Text>
                          </View>
                        </View>

                        {specialtyItems.length > 0 ? (
                          <View style={styles.profileCompleteSpecialtyGrid}>
                            {specialtyItems.map((item) => (
                              <View key={item.label} style={styles.profileCompleteSpecialtyChip}>
                                <Feather name={item.icon} size={14} color={palette.accent} />
                                <Text style={styles.profileCompleteSpecialtyChipText}>{item.label}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                ) : null}

                <View
                  style={[
                    styles.profileCompleteCard,
                    isCompact ? styles.profileCompleteCardCompact : null,
                  ]}
                >
                  <View style={styles.profileCompleteCardHead}>
                    <View>
                      <Text style={styles.profileCompleteCardKicker}>Seguranca e status</Text>
                      <Text style={styles.profileCompleteCardTitle}>Conta, assinatura e verificacao</Text>
                    </View>
                  </View>

                  <View style={styles.profileCompleteInfoList}>
                    <View style={styles.profileCompleteInfoRow}>
                      <Text style={styles.profileCompleteInfoLabel}>Assinatura</Text>
                      <Text style={styles.profileCompleteInfoValue}>{subscriptionLabel}</Text>
                    </View>
                    <View style={styles.profileCompleteInfoRow}>
                      <Text style={styles.profileCompleteInfoLabel}>Status da assinatura</Text>
                      <Text style={styles.profileCompleteInfoValue}>{subscriptionStatusLabel}</Text>
                    </View>
                    <View style={styles.profileCompleteInfoRow}>
                      <Text style={styles.profileCompleteInfoLabel}>E-mail verificado</Text>
                      <Text style={styles.profileCompleteInfoValue}>{emailVerified ? "Sim" : "Nao"}</Text>
                    </View>
                    <View style={styles.profileCompleteInfoRow}>
                      <Text style={styles.profileCompleteInfoLabel}>Tipo de conta</Text>
                      <Text style={styles.profileCompleteInfoValue}>
                        {session.isTestUser ? "Usuario de teste" : "Conta principal"}
                      </Text>
                    </View>
                    <View style={styles.profileCompleteInfoRow}>
                      <Text style={styles.profileCompleteInfoLabel}>Criado em</Text>
                      <Text style={styles.profileCompleteInfoValue}>{formatDate(createdAt)}</Text>
                    </View>
                  </View>

                  {profileEmail && !emailVerified ? (
                    <TouchableOpacity
                      style={styles.profileCompleteGhostButton}
                      onPress={handleResendVerificationEmail}
                      disabled={emailResendLoading}
                    >
                      <Feather name="mail" size={15} color={palette.accent} />
                      <Text style={styles.profileCompleteGhostButtonText}>
                        {emailResendLoading ? "Enviando..." : "Ativar e-mail"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {editMode ? (
                  <View
                    style={[
                      styles.profileCompleteActions,
                      !isCompact ? styles.profileCompleteActionsInline : null,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.profileCompletePrimaryButton}
                      onPress={handleProfileSave}
                      disabled={actionLoading.saveProfile}
                    >
                      <Text style={styles.profileCompletePrimaryButtonText}>
                        {actionLoading.saveProfile ? "Salvando..." : "Salvar alteracoes"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.profileCompleteSecondaryButton}
                      onPress={handleEditToggle}
                      disabled={actionLoading.saveProfile}
                    >
                      <Text style={styles.profileCompleteSecondaryButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.profileCompleteCard,
                    isCompact ? styles.profileCompleteCardCompact : null,
                  ]}
                >
                  <View style={styles.profileCompleteCardHead}>
                    <View>
                      <Text style={styles.profileCompleteCardKicker}>Enderecos</Text>
                      <Text style={styles.profileCompleteCardTitle}>Gerencie seus enderecos cadastrados</Text>
                    </View>
                    {!isAddressFormOpen ? (
                      <TouchableOpacity style={styles.profileCompleteAddButton} onPress={openAddressForm}>
                        <Feather name="plus" size={16} color="#ffffff" />
                        <Text style={styles.profileCompleteAddButtonText}>Novo</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {isAddressFormOpen ? (
                    <View style={styles.profileCompleteAddressForm}>
                      <View style={styles.profileCompleteFormGrid}>
                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>CEP</Text>
                          <TextInput
                            value={formatCep(addressForm.zipcode)}
                            onChangeText={(value) => handleAddressChange("zipcode", value)}
                            style={styles.profileCompleteInput}
                            keyboardType="numeric"
                            placeholder="00000-000"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Numero</Text>
                          <TextInput
                            value={addressForm.number}
                            onChangeText={(value) => handleAddressChange("number", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Numero"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={[styles.profileCompleteField, styles.profileCompleteFieldFull]}>
                          <Text style={styles.profileCompleteFieldLabel}>Rua</Text>
                          <TextInput
                            value={addressForm.street}
                            onChangeText={(value) => handleAddressChange("street", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Rua"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Bairro</Text>
                          <TextInput
                            value={addressForm.neighborhood}
                            onChangeText={(value) => handleAddressChange("neighborhood", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Bairro"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Cidade</Text>
                          <TextInput
                            value={addressForm.city}
                            onChangeText={(value) => handleAddressChange("city", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Cidade"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Estado</Text>
                          <TextInput
                            value={addressForm.state}
                            onChangeText={(value) => handleAddressChange("state", value)}
                            style={styles.profileCompleteInput}
                            placeholder="UF"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Tipo de residencia</Text>
                          <View style={styles.profileCompleteChoiceGrid}>
                            {Object.entries(residenceTypeLabels).map(([value, label]) => (
                              <TouchableOpacity
                                key={value}
                                style={[
                                  styles.profileCompleteChoiceChip,
                                  addressForm.residence_type === value
                                    ? styles.profileCompleteChoiceChipActive
                                    : null,
                                ]}
                                onPress={() => handleAddressChange("residence_type", value)}
                              >
                                <Text
                                  style={[
                                    styles.profileCompleteChoiceChipText,
                                    addressForm.residence_type === value
                                      ? styles.profileCompleteChoiceChipTextActive
                                      : null,
                                  ]}
                                >
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        <View style={styles.profileCompleteField}>
                          <Text style={styles.profileCompleteFieldLabel}>Complemento</Text>
                          <TextInput
                            value={addressForm.complement}
                            onChangeText={(value) => handleAddressChange("complement", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Complemento"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={[styles.profileCompleteField, styles.profileCompleteFieldFull]}>
                          <Text style={styles.profileCompleteFieldLabel}>Ponto de referencia</Text>
                          <TextInput
                            value={addressForm.reference_point}
                            onChangeText={(value) => handleAddressChange("reference_point", value)}
                            style={styles.profileCompleteInput}
                            placeholder="Ponto de referencia"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                      </View>

                      <View
                        style={[
                          styles.profileCompleteAddressActionsRow,
                          !isNarrow ? styles.profileCompleteActionsInline : null,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.profileCompleteGhostButton}
                          onPress={handleCepSearch}
                          disabled={addressCepLoading}
                        >
                          <Feather name="search" size={15} color={palette.accent} />
                          <Text style={styles.profileCompleteGhostButtonText}>
                            {addressCepLoading ? "Buscando CEP..." : "Buscar CEP"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.profileCompleteGhostButton} onPress={handleOpenAddressMap}>
                          <Feather name="map" size={15} color={palette.accent} />
                          <Text style={styles.profileCompleteGhostButtonText}>Confirmar no mapa</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.profileCompleteCoordinatesBox}>
                        <Text style={styles.profileCompleteCoordinatesText}>
                          {formatCoordinates(addressForm.latitude, addressForm.longitude)}
                        </Text>
                      </View>

                      {addressNotice ? (
                        <View
                          style={[
                            styles.profileCompleteNotice,
                            addressNotice.type === "success"
                              ? styles.profileCompleteNoticeSuccess
                              : addressNotice.type === "warning"
                                ? styles.profileCompleteNoticeWarning
                                : styles.profileCompleteNoticeError,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileCompleteNoticeText,
                              addressNotice.type === "warning"
                                ? styles.profileCompleteNoticeTextWarning
                                : null,
                            ]}
                          >
                            {addressNotice.text}
                          </Text>
                        </View>
                      ) : null}

                      {!isDiarist ? (
                        <View style={styles.profileCompleteRoomsBlock}>
                          <TouchableOpacity
                            style={styles.profileCompleteRoomsToggle}
                            onPress={() => setIsAddressRoomsOpen((prev) => !prev)}
                          >
                            <View style={styles.profileCompleteRoomsToggleCopy}>
                              <Text style={styles.profileCompleteRoomsToggleTitle}>Comodos</Text>
                              <Text style={styles.profileCompleteRoomsToggleSubtitle}>
                                {formatRoomSummary(addressForm.rooms)}
                              </Text>
                            </View>
                            <Feather
                              name={isAddressRoomsOpen ? "chevron-up" : "chevron-down"}
                              size={18}
                              color={palette.accent}
                            />
                          </TouchableOpacity>

                          {isAddressRoomsOpen ? (
                            <View style={styles.profileCompleteRoomList}>
                              <TouchableOpacity
                                style={styles.profileCompleteAddRoomButton}
                                onPress={handleAddAddressRoom}
                              >
                                <Feather name="plus" size={14} color={palette.accent} />
                                <Text style={styles.profileCompleteAddRoomButtonText}>Adicionar comodo</Text>
                              </TouchableOpacity>

                              {(addressForm.rooms || []).length > 0 ? (
                                (addressForm.rooms || []).map((room, index) => (
                                  <View
                                    key={room.id}
                                    style={[
                                      styles.profileCompleteRoomRow,
                                      isCompact ? styles.profileCompleteRoomRowCompact : null,
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.profileCompleteRoomFields,
                                        isCompact ? styles.profileCompleteRoomFieldsCompact : null,
                                      ]}
                                    >
                                      <TextInput
                                        value={room.name}
                                        onChangeText={(value) => handleAddressRoomChange(room.id, "name", value)}
                                        style={[styles.profileCompleteInput, styles.profileCompleteRoomInput]}
                                        placeholder={`Comodo ${index + 1}`}
                                        placeholderTextColor="#9ca3af"
                                      />
                                      <TextInput
                                        value={String(room.quantity ?? "")}
                                        onChangeText={(value) =>
                                          handleAddressRoomChange(room.id, "quantity", value)
                                        }
                                        style={[styles.profileCompleteInput, styles.profileCompleteRoomQuantity]}
                                        keyboardType="numeric"
                                        placeholder="1"
                                        placeholderTextColor="#9ca3af"
                                      />
                                    </View>

                                    <TouchableOpacity
                                      style={styles.profileCompleteRemoveRoomButton}
                                      onPress={() => handleRemoveAddressRoom(room.id)}
                                    >
                                      <Feather name="trash-2" size={14} color="#ef4444" />
                                    </TouchableOpacity>
                                  </View>
                                ))
                              ) : (
                                <Text style={styles.profileCompleteEmptyInline}>
                                  Nenhum comodo cadastrado ainda.
                                </Text>
                              )}
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      <View
                        style={[
                          styles.profileCompleteActions,
                          !isCompact ? styles.profileCompleteActionsInline : null,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.profileCompletePrimaryButton}
                          onPress={handleAddressSave}
                          disabled={actionLoading.saveAddress}
                        >
                          <Text style={styles.profileCompletePrimaryButtonText}>
                            {actionLoading.saveAddress
                              ? "Salvando..."
                              : editingAddressId
                                ? "Salvar endereco"
                                : "Adicionar endereco"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.profileCompleteSecondaryButton}
                          onPress={closeAddressForm}
                          disabled={actionLoading.saveAddress}
                        >
                          <Text style={styles.profileCompleteSecondaryButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>

                {addresses.length > 0 ? (
                  addresses.map((address) => (
                    <View
                      key={address.id}
                      style={[
                        styles.profileCompleteAddressCard,
                        isCompact ? styles.profileCompleteCardCompact : null,
                      ]}
                    >
                      <View style={styles.profileCompleteAddressHead}>
                        <View style={styles.profileCompleteAddressHeadCopy}>
                          <Text style={styles.profileCompleteAddressKicker}>Endereco cadastrado</Text>
                          <Text style={styles.profileCompleteAddressTitle}>
                            {formatAddress(address) || "Endereco sem detalhes"}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.profileCompleteAddressEditButton}
                          onPress={() => openEditAddressForm(address)}
                        >
                          <Feather name="edit-2" size={14} color={palette.accent} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.profileCompleteInfoList}>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>ID do endereco</Text>
                          <Text style={styles.profileCompleteInfoValue}>#{address.id || "Nao informado"}</Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>Tipo</Text>
                          <Text style={styles.profileCompleteInfoValue}>
                            {residenceTypeLabels[address.residence_type] || "Nao informado"}
                          </Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>Complemento</Text>
                          <Text style={styles.profileCompleteInfoValue}>{address.complement || "Nao informado"}</Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>Bairro</Text>
                          <Text style={styles.profileCompleteInfoValue}>{address.neighborhood || "Nao informado"}</Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>Cidade / Estado</Text>
                          <Text style={styles.profileCompleteInfoValue}>
                            {[address.city, address.state].filter(Boolean).join(" / ") || "Nao informado"}
                          </Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>Referencia</Text>
                          <Text style={styles.profileCompleteInfoValue}>
                            {address.reference_point || "Nao informado"}
                          </Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>CEP</Text>
                          <Text style={styles.profileCompleteInfoValue}>
                            {formatCep(address.zipcode) || "Nao informado"}
                          </Text>
                        </View>
                        <View style={styles.profileCompleteInfoRow}>
                          <Text style={styles.profileCompleteInfoLabel}>Coordenadas</Text>
                          <Text style={styles.profileCompleteInfoValue}>
                            {formatCoordinates(address.latitude, address.longitude)}
                          </Text>
                        </View>
                      </View>

                      {!isDiarist ? (
                        <View style={styles.profileCompleteRoomsBlock}>
                          <TouchableOpacity
                            style={styles.profileCompleteRoomsToggle}
                            onPress={() =>
                              setExpandedAddressRooms((prev) => ({
                                ...prev,
                                [address.id]: !prev[address.id],
                              }))
                            }
                          >
                            <View style={styles.profileCompleteRoomsToggleCopy}>
                              <Text style={styles.profileCompleteRoomsToggleTitle}>Comodos</Text>
                              <Text style={styles.profileCompleteRoomsToggleSubtitle}>
                                {formatRoomSummary(address.rooms)}
                              </Text>
                            </View>
                            <Feather
                              name={expandedAddressRooms[address.id] ? "chevron-up" : "chevron-down"}
                              size={18}
                              color={palette.accent}
                            />
                          </TouchableOpacity>

                          {expandedAddressRooms[address.id] ? (
                            <View style={styles.profileCompleteRoomList}>
                              {editingRoomsAddressId === address.id ? (
                                <>
                                  <TouchableOpacity
                                    style={styles.profileCompleteAddRoomButton}
                                    onPress={handleAddAddressRoom}
                                  >
                                    <Feather name="plus" size={14} color={palette.accent} />
                                    <Text style={styles.profileCompleteAddRoomButtonText}>Adicionar comodo</Text>
                                  </TouchableOpacity>

                                  {(addressForm.rooms || []).map((room, index) => (
                                    <View
                                      key={room.id}
                                      style={[
                                        styles.profileCompleteRoomRow,
                                        isCompact ? styles.profileCompleteRoomRowCompact : null,
                                      ]}
                                    >
                                      <View
                                        style={[
                                          styles.profileCompleteRoomFields,
                                          isCompact ? styles.profileCompleteRoomFieldsCompact : null,
                                        ]}
                                      >
                                        <TextInput
                                          value={room.name}
                                          onChangeText={(value) => handleAddressRoomChange(room.id, "name", value)}
                                          style={[styles.profileCompleteInput, styles.profileCompleteRoomInput]}
                                          placeholder={`Comodo ${index + 1}`}
                                          placeholderTextColor="#9ca3af"
                                        />
                                        <TextInput
                                          value={String(room.quantity ?? "")}
                                          onChangeText={(value) =>
                                            handleAddressRoomChange(room.id, "quantity", value)
                                          }
                                          style={[styles.profileCompleteInput, styles.profileCompleteRoomQuantity]}
                                          keyboardType="numeric"
                                          placeholder="1"
                                          placeholderTextColor="#9ca3af"
                                        />
                                      </View>

                                      <TouchableOpacity
                                        style={styles.profileCompleteRemoveRoomButton}
                                        onPress={() => handleRemoveAddressRoom(room.id)}
                                      >
                                        <Feather name="trash-2" size={14} color="#ef4444" />
                                      </TouchableOpacity>
                                    </View>
                                  ))}

                                  <View
                                    style={[
                                      styles.profileCompleteActions,
                                      !isCompact ? styles.profileCompleteActionsInline : null,
                                    ]}
                                  >
                                    <TouchableOpacity
                                      style={styles.profileCompletePrimaryButton}
                                      onPress={handleAddressSave}
                                      disabled={actionLoading.saveAddress}
                                    >
                                      <Text style={styles.profileCompletePrimaryButtonText}>
                                        {actionLoading.saveAddress ? "Salvando..." : "Salvar comodos"}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.profileCompleteSecondaryButton}
                                      onPress={closeInlineRoomsEditor}
                                      disabled={actionLoading.saveAddress}
                                    >
                                      <Text style={styles.profileCompleteSecondaryButtonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                  </View>
                                </>
                              ) : (
                                <>
                                  <TouchableOpacity
                                    style={styles.profileCompleteAddRoomButton}
                                    onPress={() => openInlineRoomsEditor(address)}
                                  >
                                    <Feather name="plus" size={14} color={palette.accent} />
                                    <Text style={styles.profileCompleteAddRoomButtonText}>Adicionar comodo</Text>
                                  </TouchableOpacity>

                                  {Array.isArray(address.rooms) && address.rooms.length > 0 ? (
                                    address.rooms.map((room, index) => (
                                      <View key={room.id || index} style={styles.profileCompleteRoomSummaryRow}>
                                        <View style={styles.profileCompleteRoomSummaryMain}>
                                          <Feather name="home" size={14} color={palette.accent} />
                                          <Text style={styles.profileCompleteRoomSummaryText}>
                                            {room.name || "Comodo sem nome"}
                                          </Text>
                                        </View>
                                        <Text style={styles.profileCompleteRoomSummaryQty}>
                                          {room.quantity || 0}x
                                        </Text>
                                      </View>
                                    ))
                                  ) : (
                                    <Text style={styles.profileCompleteEmptyInline}>
                                      Nenhum comodo cadastrado neste endereco.
                                    </Text>
                                  )}
                                </>
                              )}
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      <View style={styles.profileCompleteAddressFooter}>
                        <TouchableOpacity
                          style={styles.profileCompleteDangerButton}
                          onPress={() => handleDeleteAddress(address.id)}
                          disabled={actionLoading.deleteAddressId === address.id}
                        >
                          <Text style={styles.profileCompleteDangerButtonText}>
                            {actionLoading.deleteAddressId === address.id ? "Excluindo..." : "Excluir"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="Nenhum endereco cadastrado"
                    description="Adicione o primeiro endereco para completar seu perfil no app."
                  />
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={photoPickerOpen} transparent animationType="fade" onRequestClose={() => setPhotoPickerOpen(false)}>
        <View style={styles.profileCompleteModalBackdrop}>
          <View style={styles.profileCompletePhotoSheet}>
            <View style={styles.profileCompletePhotoHandle} />
            <Text style={styles.profileCompletePhotoKicker}>Foto de perfil</Text>
            <Text style={styles.profileCompletePhotoTitle}>Escolha como enviar sua foto</Text>
            <Text style={styles.profileCompletePhotoDescription}>
              Selecione camera ou galeria para atualizar seu perfil.
            </Text>

            <TouchableOpacity
              style={styles.profileCompletePhotoOption}
              onPress={() => openFilePicker(true)}
              disabled={actionLoading.uploadPhoto}
            >
              <Text style={styles.profileCompletePhotoOptionTitle}>Camera</Text>
              <Text style={styles.profileCompletePhotoOptionText}>Tirar uma foto agora</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileCompletePhotoOption}
              onPress={() => openFilePicker(false)}
              disabled={actionLoading.uploadPhoto}
            >
              <Text style={styles.profileCompletePhotoOptionTitle}>Galeria</Text>
              <Text style={styles.profileCompletePhotoOptionText}>Escolher imagem do aparelho</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileCompletePhotoCancel}
              onPress={() => setPhotoPickerOpen(false)}
              disabled={actionLoading.uploadPhoto}
            >
              <Text style={styles.profileCompletePhotoCancelText}>
                {actionLoading.uploadPhoto ? "Enviando..." : "Cancelar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={status.show} transparent animationType="fade" onRequestClose={closeStatusModal}>
        <View style={styles.profileCompleteModalBackdrop}>
          <View style={styles.profileCompleteStatusModal}>
            <View
              style={[
                styles.profileCompleteStatusIcon,
                status.success
                  ? styles.profileCompleteStatusIconSuccess
                  : styles.profileCompleteStatusIconError,
              ]}
            >
              <Feather name={status.success ? "check" : "x"} size={18} color="#ffffff" />
            </View>
            <Text style={styles.profileCompleteStatusTitle}>{status.success ? "Sucesso" : "Erro"}</Text>
            <Text style={styles.profileCompleteStatusMessage}>{status.message}</Text>
            <TouchableOpacity style={styles.profileCompletePrimaryButton} onPress={closeStatusModal}>
              <Text style={styles.profileCompletePrimaryButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MapConfirmModal
        visible={showAddressMap}
        coords={addressMapCoords}
        onClose={() => setShowAddressMap(false)}
        onConfirm={handleAddressCoordsChange}
      />
    </>
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
        screen = <ServicesScreen session={session} />;
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
    <MobileChatCenterProvider session={session}>
      <View style={styles.shell}>
        <View style={styles.screenArea}>{screen}</View>
        <MobileBottomNavigation
          currentRoute={currentRoute}
          onNavigate={setCurrentRoute}
          role={session.role}
        />
      </View>
    </MobileChatCenterProvider>
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
    profileScreenContent: {
      paddingTop: 4,
    },
    profileCompleteContent: {
      paddingTop: 4,
      paddingBottom: 43,
      gap: 14,
    },
    profileCompleteStack: {
      width: "100%",
      gap: 14,
    },
    profileCompleteHero: {
      borderRadius: 26,
      backgroundColor: "#ffffff",
      padding: 18,
      shadowColor: "#0f172a",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
      gap: 12,
    },
    profileCompleteHeroCompact: {
      borderRadius: 22,
      padding: 14,
      gap: 10,
    },
    profileCompleteHeroIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    profileCompleteHeroIdentityCompact: {
      alignItems: "flex-start",
    },
    profileCompleteAvatarShell: {
      width: 90,
      height: 90,
      borderRadius: 45,
      position: "relative",
      overflow: "visible",
    },
    profileCompleteAvatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 45,
      backgroundColor: "#dbeafe",
    },
    profileCompleteAvatarFallback: {
      width: "100%",
      height: "100%",
      borderRadius: 45,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#dbeafe",
    },
    profileCompleteAvatarFallbackText: {
      color: palette.accent,
      fontSize: 32,
      fontWeight: "900",
    },
    profileCompleteAvatarOverlay: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
      borderWidth: 2,
      borderColor: "#ffffff",
    },
    profileCompleteEditFab: {
      minHeight: 40,
      minWidth: 40,
      paddingHorizontal: 12,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
    },
    profileCompleteEditFabActive: {
      backgroundColor: "#ef4444",
    },
    profileCompleteHeroCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    profileCompleteHeroCopyTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    profileCompleteKicker: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    profileCompleteName: {
      color: palette.ink,
      fontSize: 21,
      fontWeight: "900",
      lineHeight: 26,
    },
    profileCompleteNameCompact: {
      fontSize: 18,
      lineHeight: 23,
    },
    profileCompleteEmail: {
      color: palette.muted,
      fontSize: 11,
      lineHeight: 16,
    },
    profileCompleteBadgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    profileCompleteBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    profileCompleteBadgePrimary: {
      backgroundColor: "#dbeafe",
      borderColor: "#bfdbfe",
    },
    profileCompleteBadgeSuccess: {
      backgroundColor: "#dcfce7",
      borderColor: "#bbf7d0",
    },
    profileCompleteBadgeMuted: {
      backgroundColor: "#f3f4f6",
      borderColor: "#e5e7eb",
    },
    profileCompleteBadgeWarning: {
      backgroundColor: "#fef3c7",
      borderColor: "#fcd34d",
    },
    profileCompleteBadgeText: {
      color: palette.ink,
      fontSize: 10,
      fontWeight: "700",
    },
    profileCompleteBadgeTextWarning: {
      color: "#92400e",
    },
    profileCompleteMetrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    profileCompleteMetric: {
      flexGrow: 1,
      flexBasis: 150,
      borderRadius: 16,
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e5e7eb",
      padding: 12,
      gap: 4,
    },
    profileCompleteMetricCompact: {
      flexBasis: "100%",
    },
    profileCompleteMetricLabel: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: "700",
    },
    profileCompleteMetricValue: {
      color: palette.ink,
      fontSize: 11,
      fontWeight: "800",
    },
    profileCompleteTabs: {
      flexDirection: "row",
      gap: 10,
      marginTop: 2,
    },
    profileCompleteTab: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      backgroundColor: "rgba(255,255,255,0.08)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 14,
    },
    profileCompleteTabActive: {
      backgroundColor: "rgba(255,255,255,0.22)",
      borderColor: "rgba(255,255,255,0.3)",
    },
    profileCompleteTabText: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteTabTextActive: {
      color: "#ffffff",
    },
    profileCompleteCard: {
      borderRadius: 24,
      backgroundColor: "#ffffff",
      padding: 18,
      shadowColor: "#0f172a",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
      gap: 14,
      marginTop: 14,
    },
    profileCompleteCardCompact: {
      borderRadius: 20,
      padding: 14,
      gap: 12,
    },
    profileCompleteCardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    profileCompleteCardKicker: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    profileCompleteCardTitle: {
      color: palette.ink,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20,
    },
    profileCompleteFormGrid: {
      gap: 12,
    },
    profileCompleteField: {
      gap: 8,
    },
    profileCompleteFieldFull: {
      width: "100%",
    },
    profileCompleteFieldLabel: {
      color: palette.ink,
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteInput: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: "#f8fafc",
      paddingHorizontal: 14,
      color: palette.ink,
      fontSize: 12,
    },
    profileCompleteInputDisabled: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      backgroundColor: "#f3f4f6",
      paddingHorizontal: 14,
      color: "#6b7280",
      fontSize: 12,
    },
    profileCompleteTextarea: {
      minHeight: 120,
      paddingTop: 14,
      textAlignVertical: "top",
    },
    profileCompleteChoiceGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    profileCompleteChoiceChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#dbeafe",
      backgroundColor: "#eff6ff",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    profileCompleteChoiceChipActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    profileCompleteChoiceChipText: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteChoiceChipTextActive: {
      color: "#ffffff",
    },
    profileCompleteBooleanRow: {
      flexDirection: "row",
      gap: 10,
    },
    profileCompleteBooleanButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: "#f8fafc",
      alignItems: "center",
      justifyContent: "center",
    },
    profileCompleteBooleanButtonActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    profileCompleteBooleanButtonText: {
      color: palette.ink,
      fontSize: 11,
      fontWeight: "800",
    },
    profileCompleteBooleanButtonTextActive: {
      color: "#ffffff",
    },
    profileCompleteInfoList: {
      gap: 10,
    },
    profileCompleteInfoRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#eef2ff",
      backgroundColor: "#f8fafc",
      padding: 12,
      gap: 4,
    },
    profileCompleteInfoLabel: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: "700",
    },
    profileCompleteInfoValue: {
      color: palette.ink,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 17,
    },
    profileCompleteParagraph: {
      color: "#475569",
      fontSize: 12,
      lineHeight: 18,
    },
    profileCompleteMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    profileCompleteMetaChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "#eff6ff",
      borderWidth: 1,
      borderColor: "#dbeafe",
    },
    profileCompleteMetaChipText: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteSpecialtyGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    profileCompleteSpecialtyChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "#eff6ff",
      borderWidth: 1,
      borderColor: "#dbeafe",
    },
    profileCompleteSpecialtyChipText: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteGhostButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
    },
    profileCompleteGhostButtonText: {
      color: palette.accent,
      fontSize: 11,
      fontWeight: "800",
    },
    profileCompleteActions: {
      gap: 10,
    },
    profileCompleteActionsInline: {
      flexDirection: "row",
      alignItems: "center",
    },
    profileCompletePrimaryButton: {
      minHeight: 54,
      borderRadius: 16,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      flex: 1,
    },
    profileCompletePrimaryButtonText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900",
    },
    profileCompleteSecondaryButton: {
      minHeight: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      flex: 1,
    },
    profileCompleteSecondaryButtonText: {
      color: palette.ink,
      fontSize: 11,
      fontWeight: "800",
    },
    profileCompleteAddButton: {
      minHeight: 40,
      borderRadius: 999,
      paddingHorizontal: 14,
      backgroundColor: palette.accent,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    profileCompleteAddButtonText: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteAddressForm: {
      gap: 12,
    },
    profileCompleteAddressActionsRow: {
      gap: 10,
    },
    profileCompleteCoordinatesBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#dbeafe",
      backgroundColor: "#eff6ff",
      padding: 12,
    },
    profileCompleteCoordinatesText: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteNotice: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
    },
    profileCompleteNoticeSuccess: {
      backgroundColor: "#dcfce7",
      borderColor: "#bbf7d0",
    },
    profileCompleteNoticeWarning: {
      backgroundColor: "#fef3c7",
      borderColor: "#fcd34d",
    },
    profileCompleteNoticeError: {
      backgroundColor: "#fee2e2",
      borderColor: "#fecaca",
    },
    profileCompleteNoticeText: {
      color: "#166534",
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 15,
    },
    profileCompleteNoticeTextWarning: {
      color: "#92400e",
    },
    profileCompleteRoomsBlock: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#dbeafe",
      backgroundColor: "#f8fbff",
      padding: 12,
      gap: 12,
    },
    profileCompleteRoomsToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    profileCompleteRoomsToggleCopy: {
      flex: 1,
      gap: 4,
    },
    profileCompleteRoomsToggleTitle: {
      color: palette.ink,
      fontSize: 12,
      fontWeight: "900",
    },
    profileCompleteRoomsToggleSubtitle: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: "700",
    },
    profileCompleteRoomList: {
      gap: 10,
    },
    profileCompleteAddRoomButton: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#dbeafe",
      backgroundColor: "#eff6ff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 14,
    },
    profileCompleteAddRoomButtonText: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
    },
    profileCompleteRoomRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    profileCompleteRoomRowCompact: {
      alignItems: "stretch",
    },
    profileCompleteRoomFields: {
      flex: 1,
      flexDirection: "row",
      gap: 10,
    },
    profileCompleteRoomFieldsCompact: {
      flexDirection: "column",
    },
    profileCompleteRoomInput: {
      flex: 1,
    },
    profileCompleteRoomQuantity: {
      width: 84,
    },
    profileCompleteRemoveRoomButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#fecaca",
      alignItems: "center",
      justifyContent: "center",
    },
    profileCompleteEmptyInline: {
      color: palette.muted,
      fontSize: 10,
      lineHeight: 15,
    },
    profileCompleteAddressCard: {
      borderRadius: 24,
      backgroundColor: "#ffffff",
      padding: 18,
      shadowColor: "#0f172a",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
      gap: 14,
      marginTop: 14,
    },
    profileCompleteAddressHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    profileCompleteAddressHeadCopy: {
      flex: 1,
      gap: 4,
    },
    profileCompleteAddressKicker: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    profileCompleteAddressTitle: {
      color: palette.ink,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 16,
    },
    profileCompleteAddressEditButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#dbeafe",
      backgroundColor: "#eff6ff",
    },
    profileCompleteRoomSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
    },
    profileCompleteRoomSummaryMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    profileCompleteRoomSummaryText: {
      color: palette.ink,
      fontSize: 10,
      fontWeight: "700",
      flex: 1,
    },
    profileCompleteRoomSummaryQty: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "900",
    },
    profileCompleteAddressFooter: {
      paddingTop: 4,
    },
    profileCompleteDangerButton: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#fecaca",
      backgroundColor: "#fff1f2",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    profileCompleteDangerButtonText: {
      color: "#dc2626",
      fontSize: 11,
      fontWeight: "800",
    },
    profileCompleteModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    profileCompletePhotoSheet: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: "#ffffff",
      padding: 20,
      gap: 12,
    },
    profileCompletePhotoHandle: {
      alignSelf: "center",
      width: 48,
      height: 5,
      borderRadius: 999,
      backgroundColor: "#dbe1eb",
    },
    profileCompletePhotoKicker: {
      color: palette.accent,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      textAlign: "center",
    },
    profileCompletePhotoTitle: {
      color: palette.ink,
      fontSize: 15,
      fontWeight: "900",
      textAlign: "center",
    },
    profileCompletePhotoDescription: {
      color: palette.muted,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
    },
    profileCompletePhotoOption: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: "#f8fafc",
      padding: 16,
      gap: 4,
    },
    profileCompletePhotoOptionTitle: {
      color: palette.ink,
      fontSize: 12,
      fontWeight: "900",
    },
    profileCompletePhotoOptionText: {
      color: palette.muted,
      fontSize: 10,
      lineHeight: 15,
    },
    profileCompletePhotoCancel: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    profileCompletePhotoCancelText: {
      color: palette.ink,
      fontSize: 11,
      fontWeight: "800",
    },
    profileCompleteStatusModal: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 24,
      backgroundColor: "#ffffff",
      padding: 22,
      alignItems: "center",
      gap: 14,
    },
    profileCompleteStatusIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    profileCompleteStatusIconSuccess: {
      backgroundColor: "#22c55e",
    },
    profileCompleteStatusIconError: {
      backgroundColor: "#ef4444",
    },
    profileCompleteStatusTitle: {
      color: palette.ink,
      fontSize: 15,
      fontWeight: "900",
    },
    profileCompleteStatusMessage: {
      color: palette.muted,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
    },
    screenContentFill: {
      flexGrow: 1,
    },
  mapScreenContent: {
    paddingBottom: 37,
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
    profileHero: {
      marginBottom: 14,
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.45)",
      backgroundColor: "rgba(255,255,255,0.84)",
      shadowColor: "#0f172a",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
    profileHeroMain: {
      flexDirection: "row",
      gap: 14,
      alignItems: "flex-start",
      marginBottom: 14,
    },
    profileAvatarShell: {
      width: 84,
      height: 84,
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: "#dbeafe",
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.92)",
      shadowColor: "#0f172a",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    profileAvatarImage: {
      width: "100%",
      height: "100%",
    },
    profileAvatarFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#dbeafe",
    },
    profileAvatarFallbackText: {
      color: palette.accent,
      fontSize: 30,
      fontWeight: "900",
    },
    profileHeroCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    profileKicker: {
      color: "#5d7288",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.6,
      textTransform: "uppercase",
    },
    profileHeroTitle: {
      color: "#0f172a",
      fontSize: 28,
      lineHeight: 28,
      fontWeight: "900",
      letterSpacing: -1,
    },
    profileHeroSubtitle: {
      color: "#52697f",
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "500",
    },
    profileIdentityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 2,
    },
    profileSecurityBadge: {
      minHeight: 28,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: "rgba(148, 163, 184, 0.16)",
      backgroundColor: "rgba(255,255,255,0.72)",
      color: "#23364a",
      fontSize: 11,
      fontWeight: "700",
      overflow: "hidden",
    },
    profileSecurityBadgePrimary: {
      backgroundColor: "rgba(37, 99, 235, 0.12)",
      color: "#1d4ed8",
    },
    profileSecurityBadgeSuccess: {
      backgroundColor: "rgba(16, 185, 129, 0.12)",
      color: "#059669",
    },
    profileSecurityBadgeMuted: {
      backgroundColor: "rgba(148, 163, 184, 0.12)",
      color: "#475569",
    },
    profileHeroMetrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    profileHeroMetric: {
      flex: 1,
      minWidth: 92,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(219, 230, 238, 0.9)",
      backgroundColor: "rgba(255,255,255,0.64)",
    },
    profileHeroMetricLabel: {
      color: "#5d7288",
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 4,
    },
    profileHeroMetricValue: {
      color: "#0f172a",
      fontSize: 12,
      fontWeight: "800",
    },
    profilePanel: {
      padding: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.45)",
      backgroundColor: "rgba(255,255,255,0.88)",
      marginBottom: 14,
      shadowColor: "#0f172a",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
    profilePanelHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 14,
    },
    profilePanelHeadCopy: {
      flex: 1,
      gap: 6,
    },
    profilePanelKicker: {
      color: "#5d7288",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.6,
      textTransform: "uppercase",
    },
    profilePanelTitle: {
      color: "#0f172a",
      fontSize: 20,
      fontWeight: "800",
    },
    profilePanelDescription: {
      color: "#5d7288",
      fontSize: 12,
      lineHeight: 18,
    },
    profilePanelCounter: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#eef4ff",
      color: palette.accent,
      textAlign: "center",
      textAlignVertical: "center",
      fontSize: 12,
      fontWeight: "800",
      paddingTop: Platform.OS === "android" ? 4 : 6,
      overflow: "hidden",
    },
    profileSectionGrid: {
      gap: 10,
    },
    profileCard: {
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.5)",
      backgroundColor: "rgba(255,255,255,0.78)",
      shadowColor: "#0f172a",
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
      marginBottom: 10,
    },
    profileAccountCard: {
      marginBottom: 10,
    },
    profileProfessionalCard: {
      marginBottom: 0,
    },
    profileCardHeadline: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      marginBottom: 12,
    },
    profileCardHeadlineIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37, 99, 235, 0.12)",
    },
    profileCardHeadlineCopy: {
      flex: 1,
      gap: 4,
    },
    profileCardHeadlineTitle: {
      color: "#0f172a",
      fontSize: 13,
      fontWeight: "800",
    },
    profileCardHeadlineDescription: {
      color: "#5d7288",
      fontSize: 11,
      lineHeight: 16,
    },
    profileInfoList: {
      gap: 8,
    },
    profileInfoRow: {
      minHeight: 36,
      borderWidth: 1,
      borderColor: "#e7edf3",
      borderRadius: 10,
      backgroundColor: "rgba(252,253,255,0.96)",
      paddingHorizontal: 10,
      paddingVertical: 8,
      justifyContent: "space-between",
      gap: 6,
    },
    profileInfoLabel: {
      color: "#5d7288",
      fontSize: 11,
      marginBottom: 3,
    },
    profileInfoValue: {
      color: "#0f172a",
      fontSize: 12,
      fontWeight: "700",
    },
    profileBioCopy: {
      color: "#23364a",
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 10,
    },
    profileInlineMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10,
    },
    profileChip: {
      minHeight: 26,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: "rgba(37, 99, 235, 0.1)",
      color: palette.accent,
      fontSize: 11,
      fontWeight: "700",
      overflow: "hidden",
    },
    profileSpecialtyGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    profileSpecialtyCard: {
      borderWidth: 1,
      borderColor: "#d9e5ff",
      backgroundColor: "#f7faff",
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    profileSpecialtyCardLabel: {
      color: "#0f172a",
      fontSize: 11,
      fontWeight: "700",
    },
    addressesGrid: {
      gap: 10,
    },
    addressCard: {
      borderWidth: 1,
      borderColor: "#dfe8ef",
      borderRadius: 18,
      padding: 14,
      backgroundColor: "rgba(255,255,255,0.92)",
    },
    addressCardKicker: {
      color: "#5d7288",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    addressCardTitle: {
      color: "#0f172a",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "800",
      marginBottom: 6,
    },
    addressCardLine: {
      color: "#5d7288",
      fontSize: 12,
      lineHeight: 18,
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
  serviceCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  serviceCardHeaderMain: {
    flex: 1,
    minWidth: 0,
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
  serviceChatButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  serviceChatButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
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
  offerCreateModalCard: {
    width: "92%",
    maxHeight: "86%",
    padding: 0,
    overflow: "hidden",
  },
  offerCreateModalCardCompact: {
    width: "94%",
    maxHeight: "90%",
    borderRadius: 20,
  },
  offerCreateModalHero: {
    padding: 18,
    gap: 14,
    backgroundColor: "#f8fbff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5edf8",
  },
  offerCreateModalHeroCompact: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  offerCreateModalHeroCopy: {
    gap: 6,
  },
  offerCreateHeroTitle: {
    color: palette.accent,
    marginBottom: 0,
  },
  offerCreateModalKicker: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  offerCreateAddressCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    gap: 4,
  },
  offerCreateAddressLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  offerCreateAddressValue: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  offerCreateScroll: {
    flexGrow: 0,
    maxHeight: 440,
  },
  offerCreateScrollCompact: {
    maxHeight: undefined,
    flexShrink: 1,
  },
  offerCreateScrollContent: {
    padding: 18,
    gap: 14,
  },
  offerCreateScrollContentCompact: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  offerCreateSection: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  offerCreateSectionCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  offerCreateSectionTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  offerCreateSectionCopy: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  offerCreateChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  offerCreateServiceCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  offerCreateServiceCard: {
    flexBasis: "47%",
    width: "47%",
    maxWidth: "47%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 6,
    opacity: 0.82,
  },
  offerCreateServiceCardActive: {
    backgroundColor: "#eff6ff",
    borderColor: palette.accent,
    opacity: 1,
    shadowColor: "#2563eb",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  offerCreateServiceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  offerCreateServiceCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  offerCreateServiceCardIconWrapActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  offerCreateServiceCardIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
  },
  offerCreateServiceCardIndicatorActive: {
    backgroundColor: palette.accentAlt,
  },
  offerCreateServiceCardTitle: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  offerCreateServiceCardTitleActive: {
    color: palette.accent,
  },
  offerCreateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offerCreateChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  offerCreateChipText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  offerCreateChipTextActive: {
    color: "#ffffff",
  },
  offerCreateInlineGrid: {
    gap: 10,
  },
  offerCreateInlineGridCompact: {
    gap: 8,
  },
  offerCreateInlineField: {
    marginBottom: 0,
    gap: 6,
  },
  offerCreateInlineFieldCompact: {
    width: "100%",
  },
  offerCreateFieldLabel: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  offerCreateFieldHint: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  offerCreateWebInput: {
    width: "90%",
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: palette.ink,
    backgroundColor: "#fbfdff",
    fontSize: 13,
    outlineStyle: "none",
  },
  offerCreateSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    padding: 12,
    gap: 8,
  },
  offerCreateSummaryCardCompact: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  offerCreateSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  offerCreateSummaryRowCompact: {
    alignItems: "flex-start",
  },
  offerCreateSummaryLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 0,
  },
  offerCreateSummaryValue: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },
  offerCreateTextarea: {
    marginBottom: 0,
  },
  offerCreateModalActions: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#e5edf8",
    backgroundColor: "#ffffff",
  },
  offerCreateModalActionsCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginTop: 0,
  },
  offerCreateActionButtonCompact: {
    flex: 1,
    minHeight: 44,
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
    width: "90%",
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
    backgroundColor: "#fbfdff",
    marginBottom: 10,
    alignSelf: "center",
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
  orderCalendarCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    padding: 12,
  },
  orderCalendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderCalendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  orderCalendarTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  orderCalendarWeekdays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderCalendarWeekday: {
    width: "14.28%",
    textAlign: "center",
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  orderCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  orderCalendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginBottom: 6,
  },
  orderCalendarDayMuted: {
    opacity: 0.32,
  },
  orderCalendarDayPast: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orderCalendarDayBlocked: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  orderCalendarDaySelected: {
    backgroundColor: palette.accent,
  },
  orderCalendarDayText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  orderCalendarDayTextMuted: {
    color: "#94a3b8",
  },
  orderCalendarDayTextPast: {
    color: "#94a3b8",
  },
  orderCalendarDayTextBlocked: {
    color: "#b91c1c",
  },
  orderCalendarDayTextSelected: {
    color: "#ffffff",
  },
  orderInlineRow: {
    flexDirection: "row",
    gap: 10,
  },
  orderInlineInput: {
    flex: 1,
  },
  orderTimeFields: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  orderTimeField: {
    alignItems: "center",
    gap: 6,
  },
  orderTimeFieldWide: {
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  orderTimeLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  orderTimeInput: {
    width: 120,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#fbfdff",
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  orderTimeSeparator: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: "900",
    paddingBottom: 12,
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
    justifyContent: "space-between",
    width: "100%",
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
    textAlign: "center",
    flex: 1,
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

export const ORDER_START_HOUR = 8;
export const ORDER_END_HOUR = 16;
export const ORDER_HOUR_OPTIONS = Array.from({ length: ORDER_END_HOUR - ORDER_START_HOUR + 1 }, (_, index) =>
  String(ORDER_START_HOUR + index).padStart(2, "0"),
);
export const ORDER_MINUTE_OPTIONS = ["00", "30"];

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value) {
  if (!value) return "Data nao informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data nao informada";
  return date.toLocaleString("pt-BR");
}

export function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

export function formatLongDate(value) {
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

export function normalizeAddress(address = {}) {
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

export function formatAddress(address) {
  return [address?.street, address?.number, address?.neighborhood, address?.city]
    .filter(Boolean)
    .join(", ");
}

export function getDiaristProfile(diarista = {}) {
  return diarista?.diarist_profile || diarista?.diaristas?.[0] || {};
}

export function getDiaristPricePerHour(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return Number(profile?.price_per_hour || profile?.PricePerHour || 0);
}

export function getDiaristPricePerDay(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return Number(profile?.price_per_day || profile?.PricePerDay || 0);
}

export function getDiaristExperienceYears(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return Number(profile?.experience_years || profile?.ExperienceYears || 0);
}

export function getDiaristAvailable(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  if (typeof profile?.available === "boolean") return profile.available;
  if (typeof profile?.Available === "boolean") return profile.Available;
  return true;
}

export function formatAverageRatingText(rating) {
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

export function parseSpecialties(value) {
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

export function getDiaristSpecialties(diarista = {}) {
  const profile = getDiaristProfile(diarista);
  return parseSpecialties(profile?.specialties || profile?.Specialties);
}

export function getSpecialtyPresentation(value = "") {
  const key = String(value || "").trim();
  return specialtyPresentationMap[key] || {
    label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || "Especialidade",
    icon: "check-circle",
  };
}

export function normalizeDiaristReview(review = {}) {
  return {
    ...review,
    id: review?.id || review?.ID || null,
    client_rating: Number(review?.client_rating || review?.ClientRating || 0),
    client_comment: review?.client_comment || review?.ClientComment || "",
    created_at: review?.created_at || review?.CreatedAt || "",
  };
}

export function normalizeMapDiarist(diarist = {}) {
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

export function getEmailVerificationLabel(isVerified) {
  return isVerified ? "E-mail verificado" : "E-mail nao verificado";
}

export function getSelectedAddressId(address = {}) {
  return address?.id || address?.ID || null;
}

export function getSelectedAddressStreet(address = {}) {
  return address?.street || address?.Street || "Endereco nao informado";
}

export function formatDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildOrderIsoDate(selectedDate, selectedHour, selectedMinute) {
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

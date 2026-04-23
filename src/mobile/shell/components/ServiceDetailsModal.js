import React, { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SERVICE_STATUS, normalizeServiceStatus } from "../../../services/constants";
import { formatCurrency, formatDate } from "../utils/shellUtils";

const legacyAcceptedStatus = "em andamento";

const getDisplayStatusLabel = (status) => {
  const normalizedStatus = normalizeServiceStatus(status);

  if (normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus)) {
    return SERVICE_STATUS.ACCEPTED;
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE)) {
    return SERVICE_STATUS.IN_JOURNEY;
  }

  return status;
};

const getStatusPresentation = (status) => {
  const normalizedStatus = normalizeServiceStatus(status);

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING)) {
    return {
      bg: "#fff5d9",
      text: "#a16207",
      border: "#f7df9d",
    };
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED)) {
    return {
      bg: "#e8f0ff",
      text: "#1d4ed8",
      border: "#c5d7ff",
    };
  }

  if (
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY) ||
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE)
  ) {
    return {
      bg: "#eaf8ef",
      text: "#166534",
      border: "#cbe8d6",
    };
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED)) {
    return {
      bg: "#eaf8ef",
      text: "#166534",
      border: "#cbe8d6",
    };
  }

  return {
    bg: "#fff1f2",
    text: "#b91c1c",
    border: "#fecdd3",
  };
};

const getRoomIcon = (roomName) => {
  const normalizedName = String(roomName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedName.includes("banheiro") || normalizedName.includes("lavabo")) return "droplet";
  if (normalizedName.includes("quarto") || normalizedName.includes("suite")) return "moon";
  if (normalizedName.includes("cozinha")) return "coffee";
  if (normalizedName.includes("sala")) return "home";
  if (normalizedName.includes("area") || normalizedName.includes("lavanderia")) return "wind";
  if (normalizedName.includes("escritorio")) return "briefcase";
  if (normalizedName.includes("garagem")) return "truck";
  return "grid";
};

const getNeighborhood = (service) =>
  service?.address?.neighborhood || service?.address?.Neighborhood || "Bairro nao informado";

const getFullAddress = (service) => {
  const address = service?.address || service?.Address || {};

  const street = address?.street || address?.Street || "";
  const number = address?.number || address?.Number || "";
  const complement = address?.complement || address?.Complement || "";
  const neighborhood = address?.neighborhood || address?.Neighborhood || "";
  const city = address?.city || address?.City || "";
  const state = address?.state || address?.State || "";

  const parts = [
    street,
    number ? `, ${number}` : "",
    complement ? ` - ${complement}` : "",
    neighborhood ? ` (${neighborhood})` : "",
    city ? ` - ${city}` : "",
    state ? `/${state}` : "",
  ];

  return parts.join("") || "Endereco nao informado";
};

const formatRoomCountLabel = (quantity) => `${quantity} ${quantity === 1 ? "ambiente" : "ambientes"}`;

const isSameLocalDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const formatReviewBadge = (rating, emptyText) => {
  const numeric = Number(rating || 0);
  if (!numeric) {
    return emptyText;
  }

  return `★ ${numeric}/5`;
};

export default function ServiceDetailsModal({
  visible,
  service,
  role = "diarista",
  busyAction,
  onClose,
  onAccept,
  onCancel,
  onComplete,
  onOpenClientProfile,
  onStartWithPin,
  onOpenChat,
  chatLabel = "Abrir chat",
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const safeService = service || {};
  const serviceStatus = safeService?.status || safeService?.Status || "";
  const normalizedStatus = normalizeServiceStatus(serviceStatus);
  const isClient = role === "cliente";
  const isDiarist = role === "diarista";
  const isAccepted =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED) ||
    normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
  const isInJourney =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY) ||
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE);
  const isCompleted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);
  const displayStatus = getDisplayStatusLabel(serviceStatus);
  const statusPresentation = getStatusPresentation(displayStatus);
  const counterpart = isClient ? safeService.diarist : safeService.client;
  const counterpartName =
    counterpart?.name ||
    counterpart?.Name ||
    (isClient
      ? `Diarista #${safeService.diarist_id || "pendente"}`
      : `Cliente #${safeService.client_id || "pendente"}`);
  const counterpartPhoto =
    counterpart?.photo || counterpart?.Photo || counterpart?.avatar || counterpart?.Avatar || "";
  const counterpartInitial = String(counterpartName || "?").trim().charAt(0).toUpperCase() || "?";
  const serviceId = safeService?.id || safeService?.ID || "-";
  const clientPin =
    safeService?.start_pin ||
    safeService?.startPin ||
    safeService?.StartPin ||
    safeService?.pin ||
    safeService?.Pin ||
    "";
  const locationText = isAccepted ? getFullAddress(safeService) : getNeighborhood(safeService);
  const serviceDescription = safeService.service_type || "Detalhes do servico";
  const referencePoint =
    safeService?.address?.reference_point || safeService?.address?.ReferencePoint || "";
  const rooms = useMemo(() => {
    const roomList = safeService?.address?.rooms || safeService?.address?.Rooms || [];
    if (!Array.isArray(roomList)) {
      return [];
    }

    return roomList
      .map((room, index) => ({
        id: room?.id || room?.ID || `${index}`,
        name: String(room?.name || room?.Name || "").trim(),
        quantity: Number(room?.quantity || room?.Quantity || 0),
      }))
      .filter((room) => room.name && room.quantity > 0);
  }, [safeService]);
  const totalEnvironments = rooms.reduce((total, room) => total + room.quantity, 0);
  const googleMapsUrl = useMemo(() => {
    const address = safeService?.address || safeService?.Address || {};
    const latitude = address?.latitude || address?.Latitude;
    const longitude = address?.longitude || address?.Longitude;

    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const rawAddress = getFullAddress(safeService);
    if (!rawAddress || rawAddress === "Endereco nao informado") {
      return "";
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`;
  }, [safeService]);
  const reviewData =
    safeService.review ||
    safeService.Review ||
    safeService.reviews ||
    safeService.Reviews ||
    {};
  const clientReviewBadge = formatReviewBadge(
    reviewData?.client_rating || reviewData?.ClientRating,
    "Ainda nao avaliada",
  );
  const diaristReviewBadge = formatReviewBadge(
    reviewData?.diarist_rating || reviewData?.DiaristRating,
    "Ainda nao avaliada",
  );
  const isScheduledForToday = isSameLocalDay(safeService?.scheduled_at || safeService?.ScheduledAt);
  const isPending = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING);
  const canClientCancel =
    isClient &&
    !isScheduledForToday &&
    !isInJourney &&
    !isCompleted &&
    (isPending || isAccepted);

  const submitPin = async () => {
    const normalizedPin = String(pin || "").replace(/\D/g, "");
    if (normalizedPin.length !== 4) {
      setPinError("O PIN deve conter exatamente 4 digitos.");
      return;
    }

    setPinError("");
    const success = await onStartWithPin?.(safeService, normalizedPin);
    if (success) {
      setPin("");
      onClose?.();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.42)", justifyContent: "flex-end" }}>
        <View
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: "#ffffff",
            maxHeight: "94%",
            overflow: "hidden",
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 999, backgroundColor: "#d6d9df" }} />
          </View>

          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {onOpenChat ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onOpenChat?.(safeService)}
                style={{
                  minHeight: 40,
                  borderRadius: 999,
                  backgroundColor: "#2348b9",
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  shadowColor: "#2348b9",
                  shadowOpacity: 0.18,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                }}
              >
                <Feather name="message-square" size={14} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
                  {chatLabel}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 1, height: 28, backgroundColor: "#e2e8f0" }} />
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                }}
              >
                <Feather name="x" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 22 }}>
            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#dbe7ff",
                padding: 14,
                marginBottom: 14,
                shadowColor: "#0f172a",
                shadowOpacity: 0.08,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#dbe7ff",
                  }}
                >
                  {counterpartPhoto ? (
                    <Image source={{ uri: counterpartPhoto }} style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <Text style={{ color: "#2563eb", fontSize: 20, fontWeight: "900" }}>{counterpartInitial}</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#111827",
                      fontSize: 10,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      marginBottom: 5,
                    }}
                  >
                    Servico #{serviceId}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#64748b",
                          fontSize: 11,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          marginBottom: 5,
                        }}
                      >
                        {isClient ? "Diarista" : "Cliente"}
                      </Text>
                      <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>
                        {counterpartName}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          color: "#64748b",
                          fontSize: 11,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          marginBottom: 5,
                        }}
                      >
                        Valor
                      </Text>
                      <Text style={{ color: "#111827", fontSize: 15, fontWeight: "900" }}>
                        {formatCurrency(safeService.total_price || 0)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginTop: 14, marginBottom: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <Text
                        style={{
                          color: "#64748b",
                          fontSize: 11,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                        }}
                      >
                        Status do servico
                      </Text>
                      <Text style={{ color: statusPresentation.text, fontSize: 12, fontWeight: "900" }}>
                        {displayStatus}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <Text
                        style={{
                          color: "#64748b",
                          fontSize: 11,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                        }}
                      >
                        Horas a trabalhar
                      </Text>
                      <Text style={{ color: "#2563eb", fontSize: 15, fontWeight: "900" }}>
                        {safeService.duration_hours || 0}h
                      </Text>
                      {isAccepted && clientPin ? (
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: "#111827",
                          }}
                        >
                          <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "900" }}>
                            PIN {String(clientPin)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <Text
                    style={{
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    Detalhes do servico
                  </Text>
                  <Text style={{ color: "#475569", fontSize: 15, lineHeight: 22 }}>
                    {serviceDescription}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#edf2ff",
                padding: 14,
                marginBottom: 14,
                shadowColor: "#0f172a",
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 14 }}>
                Resumo
              </Text>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 8,
                  }}
                >
                  Data e hora do agendamento
                </Text>
                <Text style={{ color: "#111827", fontSize: 16, fontWeight: "700", lineHeight: 22 }}>
                  {formatDate(safeService.scheduled_at)}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 8,
                  }}
                >
                  Localizacao do trabalho
                </Text>
                <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800", lineHeight: 22 }}>
                  {locationText}
                </Text>
                {referencePoint ? (
                  <Text
                    style={{
                      color: "#7c8798",
                      fontSize: 13,
                      lineHeight: 18,
                      fontStyle: "italic",
                      marginTop: 8,
                    }}
                  >
                    Ponto de referencia: {referencePoint}
                  </Text>
                ) : null}
                {googleMapsUrl && !isPending ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(googleMapsUrl)}
                    style={{
                      marginTop: 12,
                      minHeight: 40,
                      borderRadius: 14,
                      backgroundColor: "#ddebff",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Feather name="map" size={14} color="#1d4ed8" />
                    <Text style={{ color: "#1d4ed8", fontSize: 14, fontWeight: "800" }}>
                      Ver no Google Maps
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#edf2ff",
                padding: 14,
                marginBottom: 14,
                shadowColor: "#0f172a",
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}
              >
                <Text
                  style={{
                    color: "#111827",
                    fontSize: 16,
                    fontWeight: "900",
                    textTransform: "uppercase",
                  }}
                >
                  Detalhes da residencia
                </Text>
                <Text style={{ color: "#64748b", fontSize: 12, lineHeight: 16, textAlign: "right" }}>
                  {rooms.length} tipos de{"\n"}comodo
                </Text>
              </View>

              {rooms.length > 0 ? (
                <>
                  <View style={{ flexDirection: "row", marginBottom: 12 }}>
                    <View
                      style={{
                        width: 72,
                        minHeight: 72,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#bfd6ff",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#ffffff",
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: "#111827", fontSize: 28, fontWeight: "900" }}>
                        {totalEnvironments}
                      </Text>
                      <Text style={{ color: "#64748b", fontSize: 13 }}>
                        Ambientes
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    {rooms.map((room) => (
                      <View
                        key={room.id}
                        style={{
                          borderRadius: 14,
                          backgroundColor: "#f8fbff",
                          borderWidth: 1,
                          borderColor: "#dbe7ff",
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            backgroundColor: "#e8f0ff",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name={getRoomIcon(room.name)} size={16} color="#2563eb" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#111827", fontSize: 14, fontWeight: "800", marginBottom: 2 }}>
                            {room.name}
                          </Text>
                          <Text style={{ color: "#64748b", fontSize: 13 }}>
                            {formatRoomCountLabel(room.quantity)}
                          </Text>
                        </View>
                        <Text style={{ color: "#2563eb", fontSize: 14, fontWeight: "900" }}>
                          {room.quantity}x
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={{ color: "#64748b", fontSize: 14, lineHeight: 20 }}>
                  Nenhum comodo informado para este endereco.
                </Text>
              )}
            </View>

            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#edf2ff",
                padding: 14,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 12 }}>
                Condicoes do servico
              </Text>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 14,
                  marginBottom: safeService.observations ? 12 : 0,
                }}
              >
                <Text
                  style={{
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 8,
                  }}
                >
                  Presenca de animais
                </Text>
                <Text style={{ color: "#111827", fontSize: 15, lineHeight: 21 }}>
                  {safeService.has_pets ? "Sim, ha animais no local." : "Nao ha animais informados."}
                </Text>
              </View>

              {safeService.observations ? (
                <View
                  style={{
                    borderRadius: 16,
                    backgroundColor: "#f8fbff",
                    borderWidth: 1,
                    borderColor: "#dbe7ff",
                    padding: 14,
                  }}
                >
                  <Text
                    style={{
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    Instrucoes e observacoes
                  </Text>
                  <Text style={{ color: "#111827", fontSize: 15, lineHeight: 22 }}>
                    "{safeService.observations}"
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#edf2ff",
                padding: 14,
                marginBottom: 18,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 12 }}>
                Avaliacoes do servico
              </Text>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800" }}>
                    Avaliacao do cliente
                  </Text>
                  <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "900" }}>
                    {clientReviewBadge}
                  </Text>
                </View>
                <Text style={{ color: "#111827", fontSize: 14, lineHeight: 20 }}>
                  {reviewData.client_comment ||
                    reviewData.ClientComment ||
                    "O cliente ainda nao deixou um feedback sobre a diarista."}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800" }}>
                    Avaliacao da diarista
                  </Text>
                  <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "900" }}>
                    {diaristReviewBadge}
                  </Text>
                </View>
                <Text style={{ color: "#111827", fontSize: 14, lineHeight: 20 }}>
                  {reviewData.diarist_comment ||
                    reviewData.DiaristComment ||
                    "A diarista ainda nao deixou um feedback sobre o cliente."}
                </Text>
              </View>
            </View>

            {onOpenClientProfile ? (
              <TouchableOpacity
                onPress={() => onOpenClientProfile?.(safeService)}
                style={{
                  minHeight: 44,
                  borderRadius: 14,
                  backgroundColor: "#eff6ff",
                  borderWidth: 1,
                  borderColor: "#bfdbfe",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <Feather name="user" size={15} color="#1d4ed8" />
                <Text style={{ color: "#1d4ed8", fontSize: 14, fontWeight: "800" }}>
                  {isClient ? "Ver perfil da diarista" : "Ver perfil da cliente"}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isDiarist && isPending ? (
              <View style={{ gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={() => onAccept?.(safeService)}
                  disabled={Boolean(busyAction)}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: "#111827",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busyAction ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "800" }}>
                    {busyAction === "accept" ? "Aceitando..." : "Aceitar servico"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isClient && isScheduledForToday && (isPending || isAccepted) ? (
              <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
                Cancelamento indisponivel no dia agendado do servico.
              </Text>
            ) : null}

            {isDiarist && isAccepted ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                  Digite os 4 ultimos digitos do telefone da cliente para iniciar o servico.
                </Text>
                <TextInput
                  value={pin}
                  onChangeText={(value) => setPin(String(value || "").replace(/\D/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="0000"
                  placeholderTextColor="#94a3b8"
                  style={{
                    minHeight: 48,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#dbe7ff",
                    backgroundColor: "#f8fbff",
                    paddingHorizontal: 14,
                    color: "#0f172a",
                    fontSize: 18,
                    letterSpacing: 6,
                    fontWeight: "800",
                    marginBottom: pinError ? 6 : 12,
                  }}
                />
                {pinError ? (
                  <Text style={{ color: "#b91c1c", fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
                    {pinError}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
              {isDiarist && isAccepted ? (
                <TouchableOpacity
                  onPress={submitPin}
                  disabled={Boolean(busyAction)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: "#111827",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busyAction ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "800" }}>
                    {busyAction === "start-with-pin" ? "Verificando..." : "Iniciar jornada com PIN"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {isDiarist && isInJourney ? (
                <TouchableOpacity
                  onPress={() => onComplete?.(safeService)}
                  disabled={Boolean(busyAction)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: "#111827",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busyAction ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "800" }}>
                    {busyAction === "complete" ? "Concluindo..." : "Concluir servico"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {canClientCancel ? (
                <TouchableOpacity
                  onPress={() => onCancel?.(safeService)}
                  disabled={Boolean(busyAction)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: "#fee2e2",
                    borderWidth: 1,
                    borderColor: "#fecaca",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busyAction ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "#b91c1c", fontSize: 14, fontWeight: "800" }}>
                    {busyAction === "cancel" ? "Cancelando..." : "Cancelar servico"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {isDiarist && isPending ? (
                <TouchableOpacity
                  onPress={() => onCancel?.(safeService)}
                  disabled={Boolean(busyAction)}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: "#fee2e2",
                    borderWidth: 1,
                    borderColor: "#fecaca",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busyAction ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "#b91c1c", fontSize: 14, fontWeight: "800" }}>
                    {busyAction === "cancel" ? "Salvando..." : "Recusar servico"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={onClose}
                style={{
                  flex: (isDiarist && (isAccepted || isInJourney)) || canClientCancel ? 1 : undefined,
                  minWidth: (isDiarist && (isAccepted || isInJourney)) || canClientCancel ? undefined : "100%",
                  minHeight: 46,
                  borderRadius: 14,
                  backgroundColor: "#eff6ff",
                  borderWidth: 1,
                  borderColor: "#bfdbfe",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 18,
                }}
              >
                <Text style={{ color: "#1d4ed8", fontSize: 14, fontWeight: "800" }}>
                  Fechar detalhes
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}




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

const formatReviewBadge = (rating, emptyText) => {
  const numeric = Number(rating || 0);
  if (!numeric) {
    return emptyText;
  }

  return {
    stars: `${"\u2605".repeat(Math.max(0, Math.min(5, Math.round(numeric))))}${"\u2606".repeat(
      Math.max(0, 5 - Math.round(numeric)),
    )}`,
    value: numeric.toFixed(1),
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

const getServiceBusinessState = (status) => {
  const normalizedStatus = normalizeServiceStatus(status);
  const isAccepted =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED) ||
    normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
  const isInJourney =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY) ||
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE);
  const isPending = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING);
  const isCompleted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);
  const canRevealPreciseLocation = isAccepted || isInJourney || isCompleted;

  return {
    isAccepted,
    isInJourney,
    isPending,
    isCompleted,
    canRevealPreciseLocation,
  };
};

const getNeighborhood = (service) =>
  service?.address?.neighborhood || service?.address?.Neighborhood || "Bairro nao informado";

const getFullAddress = (service) =>
  [
    service?.address?.street || service?.address?.Street,
    service?.address?.number || service?.address?.Number,
    service?.address?.complement || service?.address?.Complement,
    service?.address?.neighborhood || service?.address?.Neighborhood,
    service?.address?.city || service?.address?.City,
    service?.address?.state || service?.address?.State,
  ]
    .filter(Boolean)
    .join(", ") || "Endereco nao informado";

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
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const safeService = service || {};

  const { isAccepted, isInJourney, isPending, canRevealPreciseLocation } = getServiceBusinessState(
    safeService.status,
  );
  const displayStatus = getDisplayStatusLabel(safeService.status);
  const counterpart = role === "diarista" ? safeService.client : safeService.diarist;
  const counterpartName =
    counterpart?.name ||
    counterpart?.Name ||
    (role === "diarista"
      ? `Cliente #${safeService.client_id || "pendente"}`
      : `Diarista #${safeService.diarist_id || "pendente"}`);
  const counterpartPhoto =
    counterpart?.photo || counterpart?.Photo || counterpart?.avatar || counterpart?.Avatar || "";
  const counterpartInitial = String(counterpartName || "?").trim().charAt(0).toUpperCase() || "?";
  const addressText = canRevealPreciseLocation ? getFullAddress(safeService) : getNeighborhood(safeService);
  const referencePoint =
    safeService?.address?.reference_point || safeService?.address?.ReferencePoint || "";
  const residenceType =
    safeService?.address?.residence_type || safeService?.address?.ResidenceType || "";
  const zipcode = safeService?.address?.zipcode || safeService?.address?.Zipcode || "";
  const complement = safeService?.address?.complement || safeService?.address?.Complement || "";
  const completedAt = safeService?.completed_at || safeService?.CompletedAt || "";
  const cancelReason = safeService?.cancel_reason || safeService?.CancelReason || "";
  const rejectionReason = safeService?.rejection_reason || safeService?.RejectionReason || "";
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

  const googleMapsUrl = useMemo(() => {
    if (!canRevealPreciseLocation) {
      return "";
    }

    const address = safeService.address || {};
    const latitude = address.latitude || address.Latitude;
    const longitude = address.longitude || address.Longitude;

    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const rawAddress = getFullAddress(safeService);
    if (!rawAddress || rawAddress === "Endereco nao informado") {
      return "";
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`;
  }, [canRevealPreciseLocation, safeService]);

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

  const clientReviewBadge = formatReviewBadge(
    safeService?.review?.client_rating ||
      safeService?.Review?.ClientRating ||
      safeService?.reviews?.client_rating,
    "Ainda nao avaliada",
  );
  const diaristReviewBadge = formatReviewBadge(
    safeService?.review?.diarist_rating ||
      safeService?.Review?.DiaristRating ||
      safeService?.reviews?.diarist_rating,
    "Ainda nao avaliada",
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.52)", justifyContent: "flex-end" }}>
        <View
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: "#f8fafc",
            maxHeight: "94%",
            overflow: "hidden",
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 10 }}>
            <View style={{ width: 48, height: 5, borderRadius: 999, backgroundColor: "#cbd5e1" }} />
          </View>

          <View
            style={{
              paddingHorizontal: 18,
              paddingBottom: 16,
              backgroundColor: "#ffffff",
              borderBottomWidth: 1,
              borderBottomColor: "#e2e8f0",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flexDirection: "row", flex: 1, gap: 12 }}>
                <View
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: 18,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#dbe7ff",
                  }}
                >
                  {counterpartPhoto ? (
                    <Image source={{ uri: counterpartPhoto }} style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <Text style={{ color: "#2563eb", fontSize: 24, fontWeight: "900" }}>{counterpartInitial}</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    {safeService.service_type || "Detalhes do servico"}
                  </Text>
                  <Text style={{ color: "#111827", fontSize: 22, fontWeight: "900", marginBottom: 6 }}>
                    {counterpartName}
                  </Text>
                  <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginBottom: 10 }}>
                    {formatCurrency(safeService.total_price || 0)}
                  </Text>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#eef4ff",
                      }}
                    >
                      <Text style={{ color: "#2563eb", fontSize: 12, fontWeight: "800" }}>
                        {safeService.duration_hours || 0}h
                      </Text>
                    </View>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#111827",
                      }}
                    >
                      <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "800" }}>
                        {displayStatus}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#eef2f7",
                }}
              >
                <Feather name="x" size={18} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
            <View
              style={{
                borderRadius: 20,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#dbe7ff",
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
                Resumo
              </Text>
              <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                Data e hora do agendamento
              </Text>
              <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700", marginBottom: 12 }}>
                {formatDate(safeService.scheduled_at)}
              </Text>

              <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                Localizacao do trabalho
              </Text>
              <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700", lineHeight: 22, marginBottom: 8 }}>
                {addressText}
              </Text>

              {!canRevealPreciseLocation ? (
                <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                  O endereco completo so aparece depois que a diarista aceita o servico.
                </Text>
              ) : null}

              {canRevealPreciseLocation && referencePoint ? (
                <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                  Ponto de referencia: {referencePoint}
                </Text>
              ) : null}

              {canRevealPreciseLocation && complement ? (
                <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 8 }}>
                  Complemento: {complement}
                </Text>
              ) : null}

              {canRevealPreciseLocation && (residenceType || zipcode) ? (
                <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                  {[residenceType ? `Tipo: ${residenceType}` : "", zipcode ? `CEP: ${zipcode}` : ""]
                    .filter(Boolean)
                    .join("  •  ")}
                </Text>
              ) : null}

              {completedAt ? (
                <View
                  style={{
                    marginBottom: 10,
                    borderRadius: 12,
                    backgroundColor: "#f8fbff",
                    borderWidth: 1,
                    borderColor: "#dbe7ff",
                    padding: 12,
                  }}
                >
                  <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                    Data de conclusao
                  </Text>
                  <Text style={{ color: "#0f172a", fontSize: 14, fontWeight: "700" }}>
                    {formatDate(completedAt)}
                  </Text>
                </View>
              ) : null}

              {canRevealPreciseLocation && googleMapsUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(googleMapsUrl)}
                  style={{
                    minHeight: 42,
                    borderRadius: 12,
                    backgroundColor: "#eff6ff",
                    borderWidth: 1,
                    borderColor: "#bfdbfe",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Feather name="map" size={15} color="#1d4ed8" />
                  <Text style={{ color: "#1d4ed8", fontSize: 13, fontWeight: "800" }}>
                    Ver no Google Maps
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {canRevealPreciseLocation ? (
              <View
                style={{
                  borderRadius: 20,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
                >
                  <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
                    Detalhes da residencia
                  </Text>
                  <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800" }}>
                    {rooms.length} tipos de comodo
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: rooms.length > 0 ? 12 : 0 }}>
                  {Number(safeService.room_count || safeService.RoomCount || 0) > 0 ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#eef4ff",
                      }}
                    >
                      <Text style={{ color: "#2563eb", fontSize: 12, fontWeight: "800" }}>
                        {Number(safeService.room_count || safeService.RoomCount || 0)} quartos
                      </Text>
                    </View>
                  ) : null}
                  {Number(safeService.bathroom_count || safeService.BathroomCount || 0) > 0 ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#eefcf4",
                      }}
                    >
                      <Text style={{ color: "#166534", fontSize: 12, fontWeight: "800" }}>
                        {Number(safeService.bathroom_count || safeService.BathroomCount || 0)} banheiros
                      </Text>
                    </View>
                  ) : null}
                </View>

                {rooms.length > 0 ? (
                  rooms.map((room) => (
                    <View
                      key={room.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderRadius: 14,
                        backgroundColor: "#f8fbff",
                        borderWidth: 1,
                        borderColor: "#dbe7ff",
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: "#eef4ff",
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
                          {room.quantity} {room.quantity === 1 ? "ambiente" : "ambientes"}
                        </Text>
                      </View>
                      <View
                        style={{
                          minWidth: 40,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: "#ffffff",
                          borderWidth: 1,
                          borderColor: "#dbe7ff",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "#2563eb", fontSize: 12, fontWeight: "800" }}>
                          {room.quantity}x
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: "#64748b", fontSize: 14, lineHeight: 20 }}>
                    Nenhum comodo informado para este endereco.
                  </Text>
                )}
              </View>
            ) : null}

            <View
              style={{
                borderRadius: 20,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#dbe7ff",
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
                Condicoes do servico
              </Text>
              <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                Presenca de animais
              </Text>
              <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700", marginBottom: 12 }}>
                {safeService.has_pets ? "Sim, ha animais no local." : "Nao ha animais informados."}
              </Text>

              <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                Instrucoes e observacoes
              </Text>
              <Text style={{ color: "#0f172a", fontSize: 15, lineHeight: 22 }}>
                {safeService.observations || "Nenhuma observacao adicional foi enviada para este servico."}
              </Text>

              {cancelReason || rejectionReason ? (
                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 14,
                    backgroundColor: "#fff7f7",
                    borderWidth: 1,
                    borderColor: "#fecaca",
                    padding: 12,
                  }}
                >
                  <Text style={{ color: "#991b1b", fontSize: 12, fontWeight: "900", marginBottom: 8 }}>
                    Motivo registrado
                  </Text>
                  {cancelReason ? (
                    <Text style={{ color: "#7f1d1d", fontSize: 14, lineHeight: 20, marginBottom: rejectionReason ? 8 : 0 }}>
                      Cancelamento: {cancelReason}
                    </Text>
                  ) : null}
                  {rejectionReason ? (
                    <Text style={{ color: "#7f1d1d", fontSize: 14, lineHeight: 20 }}>
                      Recusa: {rejectionReason}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View
              style={{
                borderRadius: 20,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#dbe7ff",
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
                Avaliacoes do servico
              </Text>

              <View
                style={{
                  borderRadius: 14,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 6 }}>
                  Avaliacao do cliente
                </Text>
                {typeof clientReviewBadge === "string" ? (
                  <Text style={{ color: "#334155", fontSize: 14, fontWeight: "800", marginBottom: 8 }}>
                    {clientReviewBadge}
                  </Text>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Text style={{ color: "#f59e0b", fontSize: 24, fontWeight: "900", lineHeight: 26 }}>
                      {clientReviewBadge.stars}
                    </Text>
                    <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "900" }}>
                      {clientReviewBadge.value}
                    </Text>
                  </View>
                )}
                <Text style={{ color: "#0f172a", fontSize: 14, lineHeight: 20 }}>
                  {safeService?.review?.client_comment ||
                    safeService?.Review?.ClientComment ||
                    safeService?.reviews?.client_comment ||
                    "O cliente ainda nao deixou um feedback sobre a diarista."}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 14,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 12,
                }}
              >
                <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "800", marginBottom: 6 }}>
                  Avaliacao da diarista
                </Text>
                {typeof diaristReviewBadge === "string" ? (
                  <Text style={{ color: "#334155", fontSize: 14, fontWeight: "800", marginBottom: 8 }}>
                    {diaristReviewBadge}
                  </Text>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Text style={{ color: "#f59e0b", fontSize: 24, fontWeight: "900", lineHeight: 26 }}>
                      {diaristReviewBadge.stars}
                    </Text>
                    <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "900" }}>
                      {diaristReviewBadge.value}
                    </Text>
                  </View>
                )}
                <Text style={{ color: "#0f172a", fontSize: 14, lineHeight: 20 }}>
                  {safeService?.review?.diarist_comment ||
                    safeService?.Review?.DiaristComment ||
                    safeService?.reviews?.diarist_comment ||
                    "A diarista ainda nao deixou um feedback sobre o cliente."}
                </Text>
              </View>
            </View>

            {role === "diarista" ? (
              <View
                style={{
                  borderRadius: 20,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 16,
                }}
              >
                <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
                  Acoes da diarista
                </Text>

                <TouchableOpacity
                  onPress={() => onOpenClientProfile?.(safeService)}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    backgroundColor: "#eff6ff",
                    borderWidth: 1,
                    borderColor: "#bfdbfe",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Feather name="user" size={15} color="#1d4ed8" />
                  <Text style={{ color: "#1d4ed8", fontSize: 14, fontWeight: "800" }}>
                    Ver perfil da cliente
                  </Text>
                </TouchableOpacity>

                {isPending ? (
                  <View style={{ gap: 10 }}>
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

                    <TouchableOpacity
                      onPress={() => onCancel?.(safeService)}
                      disabled={Boolean(busyAction)}
                      style={{
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
                  </View>
                ) : null}

                {isAccepted ? (
                  <View>
                    <Text style={{ color: "#64748b", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
                      Digite os 4 ultimos digitos do telefone da cliente para iniciar a jornada.
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

                    <View style={{ gap: 10 }}>
                      <TouchableOpacity
                        onPress={submitPin}
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
                          {busyAction === "start-with-pin" ? "Verificando..." : "Iniciar jornada com PIN"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onCancel?.(safeService)}
                        disabled={Boolean(busyAction)}
                        style={{
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
                          Cancelar servico
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {isInJourney ? (
                  <TouchableOpacity
                    onPress={() => onComplete?.(safeService)}
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
                      {busyAction === "complete" ? "Concluindo..." : "Concluir servico"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

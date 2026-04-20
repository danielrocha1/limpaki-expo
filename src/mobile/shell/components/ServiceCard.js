import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  SERVICE_STATUS,
  isCompletedStatus,
  normalizeServiceStatus,
} from "../../../services/constants";
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
      bg: "#fff7e6",
      border: "#fde7bf",
      text: "#92400e",
    };
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED)) {
    return {
      bg: "#eaf2ff",
      border: "#c9dbff",
      text: "#1d4ed8",
    };
  }

  if (
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY) ||
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE)
  ) {
    return {
      bg: "#eefcf4",
      border: "#cbead7",
      text: "#166534",
    };
  }

  if (normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED)) {
    return {
      bg: "#ecfdf3",
      border: "#b7e4c7",
      text: "#166534",
    };
  }

  return {
    bg: "#fff1f1",
    border: "#f4c7c7",
    text: "#b91c1c",
  };
};

const formatShortSchedule = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Agenda nao informada";
  }

  return (
    date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    }) +
    "  " +
    date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
};

const buildStars = (rating) => {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return `${"\u2605".repeat(rounded)}${"\u2606".repeat(5 - rounded)}`;
};

const getServiceBusinessState = (status) => {
  const normalizedStatus = normalizeServiceStatus(status);
  const isPending = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.PENDING);
  const isAccepted =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.ACCEPTED) ||
    normalizedStatus === normalizeServiceStatus(legacyAcceptedStatus);
  const isInJourney =
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_JOURNEY) ||
    normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.IN_SERVICE);
  const isCompleted = normalizedStatus === normalizeServiceStatus(SERVICE_STATUS.COMPLETED);

  return {
    isPending,
    isAccepted,
    isInJourney,
    isCompleted,
    canRevealPreciseLocation: isAccepted || isInJourney || isCompleted,
  };
};

export default function ServiceCard({
  service,
  role = "diarista",
  activeTab,
  busyAction,
  disabled = false,
  onPress,
  onAccept,
  onCancel,
  onStart,
  onComplete,
  onOpenClientProfile,
  onOpenChat,
  chatLabel = "Abrir chat",
}) {
  const safeService = service || {};
  const { isPending, isAccepted, isInJourney, canRevealPreciseLocation } =
    getServiceBusinessState(safeService.status);
  const isHistoryCard = activeTab === "history";
  const displayStatus = getDisplayStatusLabel(safeService.status);
  const statusPresentation = getStatusPresentation(displayStatus);
  const serviceId = safeService?.id || safeService?.ID || "-";
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
  const neighborhood =
    safeService?.address?.neighborhood || safeService?.address?.Neighborhood || "Bairro nao informado";
  const street = safeService?.address?.street || safeService?.address?.Street || "";
  const number = safeService?.address?.number || safeService?.address?.Number || "";
  const locationText = canRevealPreciseLocation
    ? [street, number].filter(Boolean).join(", ") || neighborhood
    : neighborhood;
  const reviewData =
    safeService.review ||
    safeService.Review ||
    safeService.reviews ||
    safeService.Reviews ||
    {};
  const historyRating = role === "diarista"
    ? Number(reviewData.client_rating || reviewData.ClientRating || 0)
    : Number(reviewData.diarist_rating || reviewData.DiaristRating || 0);
  const nextStep = isHistoryCard
    ? ""
    : isPending
      ? "Aceite o servico para confirmar o atendimento."
      : isAccepted
        ? "Use o PIN da cliente para iniciar a jornada."
        : isInJourney
          ? "Finalize o servico quando a limpeza terminar."
          : "";

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      disabled={disabled}
      onPress={() => onPress?.(safeService)}
      style={{
        borderRadius: 22,
        backgroundColor: "#ffffff",
        padding: 16,
        marginBottom: 14,
        shadowColor: "#0f172a",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
        borderWidth: 1,
        borderColor: "rgba(219, 231, 255, 0.9)",
        opacity: disabled ? 0.58 : 1,
      }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 84, alignItems: "stretch" }}>
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#dbe7ff",
              alignSelf: "center",
            }}
          >
            {counterpartPhoto ? (
              <Image source={{ uri: counterpartPhoto }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text style={{ color: "#2563eb", fontSize: 24, fontWeight: "900" }}>{counterpartInitial}</Text>
            )}
          </View>

          {role === "diarista" ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onOpenClientProfile?.(safeService)}
              disabled={disabled}
              style={{
                minHeight: 34,
                marginTop: 8,
                paddingHorizontal: 8,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#eff6ff",
                borderWidth: 1,
                borderColor: "#bfdbfe",
                opacity: disabled ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#1d4ed8", fontSize: 11, fontWeight: "800", textAlign: "center" }}>
                Ver perfil
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
                {formatShortSchedule(safeService.scheduled_at)}
              </Text>
              <Text style={{ color: "#111827", fontSize: 17, fontWeight: "900", marginBottom: 4 }}>
                {role === "diarista" ? "Cliente: " : "Diarista: "}
                {counterpartName}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "700" }}>
                Servico #{serviceId}
              </Text>
            </View>

            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>
              {formatCurrency(safeService.total_price || 0)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Feather name="map-pin" size={14} color="#2563eb" />
            <Text style={{ color: "#374151", fontSize: 13, fontWeight: "700", flex: 1 }}>
              {locationText}
            </Text>
          </View>

          {!canRevealPreciseLocation && role === "diarista" && !isHistoryCard ? (
            <Text style={{ color: "#64748b", fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
              Endereco completo liberado somente apos a aceitacao do servico.
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: nextStep ? 10 : 0 }}>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: statusPresentation.bg,
                borderWidth: 1,
                borderColor: statusPresentation.border,
              }}
            >
              <Text style={{ color: statusPresentation.text, fontSize: 12, fontWeight: "800" }}>
                {displayStatus}
              </Text>
            </View>
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
          </View>

          {nextStep ? (
            <View
              style={{
                marginTop: 12,
                borderRadius: 14,
                backgroundColor: "#f8fbff",
                borderWidth: 1,
                borderColor: "#dbe7ff",
                padding: 12,
              }}
            >
              <Text
                style={{
                  color: "#2563eb",
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Proximo passo
              </Text>
              <Text style={{ color: "#334155", fontSize: 13, lineHeight: 18, fontWeight: "600" }}>
                {nextStep}
              </Text>
            </View>
          ) : null}

          {isHistoryCard ? (
            <View
              style={{
                marginTop: 12,
                borderRadius: 14,
                backgroundColor: "#f8fbff",
                borderWidth: 1,
                borderColor: "#dbe7ff",
                padding: 12,
              }}
            >
              <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "800", marginBottom: 6 }}>
                Avaliacao recebida
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={{ color: "#f59e0b", fontSize: 22, fontWeight: "900", lineHeight: 24 }}>
                  {buildStars(historyRating)}
                </Text>
                <Text style={{ color: "#334155", fontSize: 16, fontWeight: "900" }}>
                  {historyRating > 0 ? historyRating.toFixed(1) : "--"}
                </Text>
              </View>
              <Text style={{ color: "#334155", fontSize: 13, fontWeight: "700" }}>
                {historyRating > 0 ? "de 5,0" : "Ainda nao avaliado"}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
                {safeService.service_type || "Servico"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {role === "diarista" && isPending ? (
          <>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onAccept?.(safeService)}
              disabled={Boolean(busyAction) || disabled}
              style={{
                flex: 1,
                minWidth: 130,
                minHeight: 42,
                borderRadius: 12,
                backgroundColor: "#111827",
                alignItems: "center",
                justifyContent: "center",
                opacity: busyAction || disabled ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
                {busyAction === "accept" ? "Aceitando..." : "Aceitar"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onCancel?.(safeService)}
              disabled={Boolean(busyAction) || disabled}
              style={{
                flex: 1,
                minWidth: 130,
                minHeight: 42,
                borderRadius: 12,
                backgroundColor: "#fee2e2",
                borderWidth: 1,
                borderColor: "#fecaca",
                alignItems: "center",
                justifyContent: "center",
                opacity: busyAction || disabled ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#b91c1c", fontSize: 13, fontWeight: "800" }}>
                {busyAction === "cancel" ? "Salvando..." : "Recusar"}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {role === "diarista" && isAccepted ? (
          <>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onStart?.(safeService)}
              disabled={Boolean(busyAction) || disabled}
              style={{
                flex: 1,
                minWidth: 160,
                minHeight: 42,
                borderRadius: 12,
                backgroundColor: "#111827",
                alignItems: "center",
                justifyContent: "center",
                opacity: busyAction || disabled ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
                Iniciar jornada com PIN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onCancel?.(safeService)}
              disabled={Boolean(busyAction) || disabled}
              style={{
                minWidth: 110,
                minHeight: 42,
                borderRadius: 12,
                backgroundColor: "#fee2e2",
                borderWidth: 1,
                borderColor: "#fecaca",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 14,
                opacity: busyAction || disabled ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#b91c1c", fontSize: 13, fontWeight: "800" }}>Cancelar</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {role === "diarista" && isInJourney ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onComplete?.(safeService)}
            disabled={Boolean(busyAction) || disabled}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              backgroundColor: "#111827",
              alignItems: "center",
              justifyContent: "center",
              opacity: busyAction || disabled ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
              {busyAction === "complete" ? "Concluindo..." : "Concluir servico"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {onOpenChat ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onOpenChat?.(safeService)}
            disabled={Boolean(busyAction) || disabled}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              backgroundColor: "#2563eb",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: busyAction || disabled ? 0.7 : 1,
            }}
          >
            <Feather name="message-circle" size={16} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
              {chatLabel}
            </Text>
          </TouchableOpacity>
        ) : null}

        {role === "diarista" && isCompletedStatus(safeService.status) ? (
          <View
            style={{
              minHeight: 40,
              borderRadius: 12,
              backgroundColor: "#ecfdf3",
              borderWidth: 1,
              borderColor: "#bbf7d0",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: "#166534", fontSize: 13, fontWeight: "800" }}>
              Servico concluido
            </Text>
          </View>
        ) : null}

        <View
          style={{
            marginLeft: "auto",
            minHeight: 40,
            paddingHorizontal: 12,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
            backgroundColor: "#eff6ff",
          }}
        >
          <Text style={{ color: "#1d4ed8", fontSize: 12, fontWeight: "800" }}>Ver detalhes</Text>
          <Feather name="chevron-right" size={15} color="#1d4ed8" />
        </View>
      </View>

      <Text style={{ color: "#6b7280", fontSize: 12, lineHeight: 18, marginTop: 12 }}>
        {formatDate(safeService.scheduled_at)}
      </Text>
    </TouchableOpacity>
  );
}

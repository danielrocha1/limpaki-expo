import React from "react";
import { Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import LoadingState from "./LoadingState";
import { formatDate } from "../utils/shellUtils";

const buildStars = (rating) => {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return `${"\u2605".repeat(rounded)}${"\u2606".repeat(5 - rounded)}`;
};

const getReviewRating = (review) =>
  Number(review?.diarist_rating || review?.DiaristRating || review?.rating || review?.Rating || 0);

const getReviewComment = (review) =>
  String(
    review?.diarist_comment || review?.DiaristComment || review?.comment || review?.Comment || "",
  ).trim();

const getProfileRooms = (address = {}) => {
  const rooms = address?.rooms || address?.Rooms || [];
  if (!Array.isArray(rooms)) {
    return [];
  }

  return rooms
    .map((room, index) => ({
      id: room?.id || room?.ID || `${index}`,
      name: String(room?.name || room?.Name || "").trim(),
      quantity: Number(room?.quantity || room?.Quantity || 0),
    }))
    .filter((room) => room.name && room.quantity > 0);
};

const formatRoomCountLabel = (quantity) => `${quantity} ${quantity === 1 ? "ambiente" : "ambientes"}`;

export default function ClientProfileModal({
  visible,
  loading = false,
  error = "",
  profile = null,
  onClose,
}) {
  const safeProfile = profile || {};
  const reviews = Array.isArray(safeProfile.reviews) ? safeProfile.reviews : [];
  const addresses = Array.isArray(safeProfile.addresses) ? safeProfile.addresses : [];
  const primaryAddress = addresses[0] || {};
  const neighborhood =
    safeProfile?.neighborhood ||
    primaryAddress?.neighborhood ||
    primaryAddress?.Neighborhood ||
    "";
  const rooms = getProfileRooms(primaryAddress);
  const roomCount = Number(
    safeProfile?.roomCount ||
      safeProfile?.room_count ||
      primaryAddress?.room_count ||
      primaryAddress?.roomCount ||
      primaryAddress?.RoomCount ||
      0,
  );
  const bathroomCount = Number(
    safeProfile?.bathroomCount ||
      safeProfile?.bathroom_count ||
      primaryAddress?.bathroom_count ||
      primaryAddress?.bathroomCount ||
      primaryAddress?.BathroomCount ||
      0,
  );
  const profileInitial = String(safeProfile?.name || "C").trim().charAt(0).toUpperCase() || "C";

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.52)", justifyContent: "center", padding: 18 }}>
        <View
          style={{
            maxHeight: "90%",
            borderRadius: 28,
            backgroundColor: "#f8fafc",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 14,
              backgroundColor: "#ffffff",
              borderBottomWidth: 1,
              borderBottomColor: "#e2e8f0",
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", flex: 1, gap: 12 }}>
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 20,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#dbe7ff",
                }}
              >
                {safeProfile?.photo ? (
                  <Image source={{ uri: safeProfile.photo }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text style={{ color: "#2563eb", fontSize: 26, fontWeight: "900" }}>{profileInitial}</Text>
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
                  Perfil da cliente
                </Text>
                <Text style={{ color: "#111827", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
                  {safeProfile?.name || "Cliente"}
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: "#fff7e6",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Feather name="star" size={13} color="#f59e0b" />
                      <Text style={{ color: "#92400e", fontSize: 12, fontWeight: "800" }}>
                        {Number(safeProfile?.averageRating || 0).toFixed(1)}
                      </Text>
                    </View>
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
                      {Number(safeProfile?.totalReviews || reviews.length || 0)} avaliacoes
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: safeProfile?.emailVerified ? "#ecfdf3" : "#fff1f1",
                    }}
                  >
                    <Text
                      style={{
                        color: safeProfile?.emailVerified ? "#166534" : "#b91c1c",
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {safeProfile?.emailVerified ? "E-mail verificado" : "E-mail nao verificado"}
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

          {loading ? (
            <View style={{ padding: 28 }}>
              <LoadingState label="Carregando perfil da cliente..." />
            </View>
          ) : error && !safeProfile?.name ? (
            <View style={{ padding: 24 }}>
              <Text style={{ color: "#b91c1c", fontSize: 14, lineHeight: 20 }}>{error}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
              {error ? (
                <View
                  style={{
                    marginBottom: 14,
                    borderRadius: 14,
                    backgroundColor: "#fff7f7",
                    borderWidth: 1,
                    borderColor: "#fecaca",
                    padding: 12,
                  }}
                >
                  <Text style={{ color: "#991b1b", fontSize: 13, lineHeight: 19 }}>{error}</Text>
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
                  Resumo da cliente
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {neighborhood ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#f8fbff",
                        borderWidth: 1,
                        borderColor: "#dbe7ff",
                      }}
                    >
                      <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>
                        Bairro: {neighborhood}
                      </Text>
                    </View>
                  ) : null}
                  {safeProfile?.distance ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#eef4ff",
                      }}
                    >
                      <Text style={{ color: "#2563eb", fontSize: 12, fontWeight: "800" }}>
                        Distancia: {safeProfile.distance}
                      </Text>
                    </View>
                  ) : null}
                  {safeProfile?.desiredFrequency ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#f8fbff",
                        borderWidth: 1,
                        borderColor: "#dbe7ff",
                      }}
                    >
                      <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>
                        Frequencia: {safeProfile.desiredFrequency}
                      </Text>
                    </View>
                  ) : null}
                  {typeof safeProfile?.hasPets === "boolean" ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: safeProfile.hasPets ? "#fff7e6" : "#ecfdf3",
                      }}
                    >
                      <Text
                        style={{
                          color: safeProfile.hasPets ? "#92400e" : "#166534",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {safeProfile.hasPets ? "Possui pets" : "Sem pets informados"}
                      </Text>
                    </View>
                  ) : null}
                  {safeProfile?.residenceType ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#eefcf4",
                      }}
                    >
                      <Text style={{ color: "#166534", fontSize: 12, fontWeight: "800" }}>
                        Residencia: {safeProfile.residenceType}
                      </Text>
                    </View>
                  ) : null}
                </View>
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
                  Residencia
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: rooms.length > 0 ? 12 : 0 }}>
                  {roomCount > 0 ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#f8fbff",
                        borderWidth: 1,
                        borderColor: "#dbe7ff",
                      }}
                    >
                      <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>
                        {roomCount} comodos
                      </Text>
                    </View>
                  ) : null}
                  {bathroomCount > 0 ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#eefcf4",
                      }}
                    >
                      <Text style={{ color: "#166534", fontSize: 12, fontWeight: "800" }}>
                        {bathroomCount} banheiros
                      </Text>
                    </View>
                  ) : null}
                  {safeProfile?.residenceType ? (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: "#fff7e6",
                      }}
                    >
                      <Text style={{ color: "#92400e", fontSize: 12, fontWeight: "800" }}>
                        {safeProfile.residenceType}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {rooms.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {rooms.map((room) => (
                      <View
                        key={room.id}
                        style={{
                          borderRadius: 14,
                          backgroundColor: "#f8fbff",
                          borderWidth: 1,
                          borderColor: "#dbe7ff",
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#dbe7ff",
                            }}
                          >
                            <Feather name="home" size={15} color="#3167e3" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "#0f172a", fontSize: 14, fontWeight: "800" }}>
                              {room.name}
                            </Text>
                            <Text style={{ color: "#64748b", fontSize: 12 }}>
                              {formatRoomCountLabel(room.quantity)}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ color: "#2563eb", fontSize: 13, fontWeight: "900" }}>
                          {room.quantity}x
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: "#64748b", fontSize: 14, lineHeight: 20 }}>
                    Comodos nao informados.
                  </Text>
                )}
              </View>

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
                  Avaliacoes feitas por diaristas
                </Text>

                {reviews.length === 0 ? (
                  <Text style={{ color: "#64748b", fontSize: 14, lineHeight: 20 }}>
                    Nenhuma avaliacao de diarista encontrada para esta cliente.
                  </Text>
                ) : (
                  reviews.map((review, index) => {
                    const rating = getReviewRating(review);
                    const comment = getReviewComment(review);
                    return (
                      <View
                        key={review?.id || review?.ID || index}
                        style={{
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
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={{ color: "#f59e0b", fontSize: 22, fontWeight: "900", lineHeight: 24 }}>
                              {buildStars(rating)}
                            </Text>
                            <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "900" }}>
                              {rating > 0 ? rating.toFixed(1) : "--"}
                            </Text>
                          </View>
                          <Text style={{ color: "#64748b", fontSize: 12 }}>
                            {formatDate(review?.created_at || review?.CreatedAt)}
                          </Text>
                        </View>
                        <Text style={{ color: "#0f172a", fontSize: 14, lineHeight: 20 }}>
                          {comment || "Sem comentario informado."}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

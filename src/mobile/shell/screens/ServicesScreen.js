import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../../config/api";
import { styles } from "../AppShell.styles";
import EmptyState from "../components/EmptyState";
import SectionCard from "../components/SectionCard";
import ServiceCard from "../components/ServiceCard";
import ServiceDetailsModal from "../components/ServiceDetailsModal";
import ClientProfileModal from "../components/ClientProfileModal";
import LoadingState from "../components/LoadingState";
import { useMobileChatCenter } from "../../MobileChatCenter";
import { SERVICE_ACTIONS } from "../../../services/constants";
import {
  formatAverageRatingText,
  formatCurrency,
  formatShortDate,
  getEmailVerificationLabel,
  getSpecialtyPresentation,
  normalizeDiaristReview,
} from "../utils/shellUtils";

const DEFAULT_PAGINATION = {
  page: 1,
  page_size: 6,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_previous: false,
};

const formatOfferDistance = (distance) => {
  const numeric = Number(String(distance ?? "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toFixed(1)} km` : "";
};

const formatNeighborhood = (offer = {}) =>
  offer?.address?.neighborhood ||
  offer?.address?.Neighborhood ||
  offer?.address_neighborhood ||
  offer?.AddressNeighborhood ||
  "Bairro nao informado";

const getServiceOfferId = (service = {}) =>
  service?.offer_id ||
  service?.OfferID ||
  service?.offer?.id ||
  service?.offer?.ID ||
  service?.Offer?.id ||
  service?.Offer?.ID ||
  null;

const getInlineClientReviews = (service = {}) => {
  const reviewSources = [
    service?.review,
    service?.Review,
    service?.reviews,
    service?.Reviews,
  ].filter(Boolean);

  return reviewSources
    .map((review, index) => ({
      id: review?.id || review?.ID || `service-inline-${index}`,
      diarist_rating:
        review?.diarist_rating ??
        review?.DiaristRating ??
        review?.rating ??
        review?.Rating ??
        0,
      diarist_comment:
        review?.diarist_comment ??
        review?.DiaristComment ??
        review?.comment ??
        review?.Comment ??
        "",
      created_at: review?.created_at || review?.CreatedAt || service?.completed_at || service?.CompletedAt || null,
    }))
    .filter((review) => {
      const rating = Number(review?.diarist_rating || 0);
      const comment = String(review?.diarist_comment || "").trim();
      return rating > 0 || comment.length > 0;
    });
};

const formatProfileNeighborhood = (source = {}) =>
  source?.neighborhood ||
  source?.Neighborhood ||
  source?.address?.neighborhood ||
  source?.address?.Neighborhood ||
  source?.address_neighborhood ||
  source?.AddressNeighborhood ||
  "";

const normalizeStatus = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isServiceChatAvailable = (service) => {
  const status = normalizeStatus(service?.status || service?.Status || "");
  return status !== "cancelado" && status !== "concluido" && status !== "em servico";
};

function ServicesLoadingState({ switching = false, tabLabel = "ativos" }) {
  return (
    <View>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 12,
          paddingBottom: 20,
          paddingHorizontal: 18,
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "rgba(37,99,235,0.12)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <ActivityIndicator color="#2563eb" size="small" />
        </View>
        <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginBottom: 6 }}>
          {switching ? `Atualizando ${tabLabel}` : "Carregando seus servicos"}
        </Text>
        <Text
          style={{
            color: "#6b7280",
            fontSize: 13,
            lineHeight: 19,
            textAlign: "center",
            maxWidth: 280,
          }}
        >
          {switching
            ? "Os cards ficam pausados enquanto organizamos a nova lista para voce."
            : "Estamos separando os atendimentos ativos e o historico da sua agenda."}
        </Text>
      </View>

      {[0, 1, 2].map((item) => (
        <View
          key={item}
          style={{
            borderRadius: 22,
            backgroundColor: "#ffffff",
            padding: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: "#dbe7ff",
          }}
        >
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                backgroundColor: "#dbe7ff",
              }}
            />

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      width: "38%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "#dbe7ff",
                      marginBottom: 8,
                    }}
                  />
                  <View
                    style={{
                      width: "76%",
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: "#dbe7ff",
                      marginBottom: 8,
                    }}
                  />
                  <View
                    style={{
                      width: "30%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "#e7eefc",
                    }}
                  />
                </View>
                <View
                  style={{
                    width: 72,
                    height: 16,
                    borderRadius: 999,
                    backgroundColor: "#dbe7ff",
                  }}
                />
              </View>

              <View
                style={{
                  width: "64%",
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: "#dbe7ff",
                  marginBottom: 10,
                }}
              />

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <View
                  style={{
                    width: 86,
                    height: 30,
                    borderRadius: 999,
                    backgroundColor: "#edf2ff",
                  }}
                />
                <View
                  style={{
                    width: 52,
                    height: 30,
                    borderRadius: 999,
                    backgroundColor: "#edf2ff",
                  }}
                />
              </View>

              <View
                style={{
                  borderRadius: 14,
                  backgroundColor: "#f8fbff",
                  borderWidth: 1,
                  borderColor: "#dbe7ff",
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: "28%",
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: "#dbe7ff",
                    marginBottom: 8,
                  }}
                />
                <View
                  style={{
                    width: "90%",
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: "#dbe7ff",
                    marginBottom: 6,
                  }}
                />
                <View
                  style={{
                    width: "65%",
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: "#e7eefc",
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function ServicesCardsPaginationSkeleton() {
  return (
    <View style={{ marginTop: 4 }}>
      {[0, 1].map((item) => (
        <View
          key={item}
          style={{
            borderRadius: 22,
            backgroundColor: "#ffffff",
            padding: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: "#dbe7ff",
            opacity: 0.96,
          }}
        >
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                backgroundColor: "#dbe7ff",
              }}
            />

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      width: "34%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "#dbe7ff",
                      marginBottom: 8,
                    }}
                  />
                  <View
                    style={{
                      width: "74%",
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: "#dbe7ff",
                      marginBottom: 8,
                    }}
                  />
                  <View
                    style={{
                      width: "26%",
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "#e7eefc",
                    }}
                  />
                </View>
                <View
                  style={{
                    width: 66,
                    height: 16,
                    borderRadius: 999,
                    backgroundColor: "#dbe7ff",
                  }}
                />
              </View>

              <View
                style={{
                  width: "58%",
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: "#dbe7ff",
                  marginBottom: 10,
                }}
              />

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <View
                  style={{
                    width: 84,
                    height: 30,
                    borderRadius: 999,
                    backgroundColor: "#edf2ff",
                  }}
                />
                <View
                  style={{
                    width: 48,
                    height: 30,
                    borderRadius: 999,
                    backgroundColor: "#edf2ff",
                  }}
                />
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
                <View
                  style={{
                    width: "24%",
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: "#dbe7ff",
                    marginBottom: 8,
                  }}
                />
                <View
                  style={{
                    width: "88%",
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: "#dbe7ff",
                    marginBottom: 6,
                  }}
                />
                <View
                  style={{
                    width: "60%",
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: "#e7eefc",
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function ServiceFileTab({ label, active, disabled, loading, icon, onPress }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      activeOpacity={0.92}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 56,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 11,
        backgroundColor: active ? "#ffffff" : "#dbe7ff",
        borderWidth: 1,
        borderColor: active ? "#c9dbff" : "#b8cdfd",
        borderBottomColor: active ? "#ffffff" : "#b8cdfd",
        shadowColor: active ? "#0f172a" : "transparent",
        shadowOpacity: active ? 0.08 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: active ? 3 : 0,
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -8,
          left: 12,
          width: 34,
          height: 10,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          backgroundColor: active ? "#ffffff" : "#dbe7ff",
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: active ? "#c9dbff" : "#b8cdfd",
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? (
          <ActivityIndicator color={active ? "#1d4ed8" : "#4b6fb8"} size="small" />
        ) : (
          <Feather
            name={icon}
            size={15}
            color={active ? "#1d4ed8" : "#4b6fb8"}
          />
        )}
        <Text
          style={{
            color: active ? "#1d4ed8" : "#37517e",
            fontSize: 13,
            fontWeight: "800",
          }}
        >
          {loading ? "Carregando..." : label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ServicesScreen({ session }) {
  const { openChat } = useMobileChatCenter();
  const viewerRole = session?.role === "cliente" ? "cliente" : "diarista";
  const [cancelReasonModal, setCancelReasonModal] = useState({
    open: false,
    service: null,
  });
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [tab, setTab] = useState("active");
  const [pageByTab, setPageByTab] = useState({
    active: 1,
    history: 1,
  });
  const [selectedService, setSelectedService] = useState(null);
  const [clientProfileModal, setClientProfileModal] = useState({
    visible: false,
    loading: false,
    error: "",
    profile: null,
  });
  const [selectedDiaristProfile, setSelectedDiaristProfile] = useState(null);
  const [diaristProfileModalOpen, setDiaristProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [busyState, setBusyState] = useState({ serviceId: null, action: "" });
  const [transitioningTab, setTransitioningTab] = useState("");
  const [resourceState, setResourceState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    data: null,
  });
  const servicesCacheRef = useRef({});
  const currentPage = pageByTab[tab] || 1;
  const cacheKey = `${tab}:${currentPage}`;

  const requestPayload = async (targetTab, targetPage) => {
    const response = await apiFetch(`/services/my?status_group=${targetTab}&page=${targetPage}&page_size=6`, {
      authenticated: true,
    });
    if (!response.ok) {
      throw new Error("Nao foi possivel carregar os servicos.");
    }
    const data = await response.json().catch(() => ({}));
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      pagination: {
        page: data?.pagination?.page ?? targetPage,
        page_size: data?.pagination?.page_size ?? 6,
        total_items: data?.pagination?.total_items ?? 0,
        total_pages: data?.pagination?.total_pages ?? 1,
        has_next: Boolean(data?.pagination?.has_next),
        has_previous: Boolean(data?.pagination?.has_previous),
      },
    };
  };

  useEffect(() => {
    let cancelled = false;
    const cachedEntry = servicesCacheRef.current[cacheKey] || null;

    if (cachedEntry) {
      setResourceState({
        loading: false,
        refreshing: false,
        error: "",
        data: cachedEntry,
      });
      setTransitioningTab("");
      return () => {
        cancelled = true;
      };
    }

    setResourceState((current) => ({
      ...current,
      loading: true,
      refreshing: false,
      error: "",
    }));

    const load = async () => {
      try {
        const payload = await requestPayload(tab, currentPage);
        if (cancelled) {
          return;
        }
        servicesCacheRef.current[cacheKey] = payload;
        setResourceState({
          loading: false,
          refreshing: false,
          error: "",
          data: payload,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setResourceState({
          loading: false,
          refreshing: false,
          error: error.message || "Nao foi possivel carregar os servicos.",
          data: null,
        });
      } finally {
        if (!cancelled) {
          setTransitioningTab("");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, currentPage, tab]);

  const refreshCurrentPage = async () => {
    setResourceState((current) => ({
      ...current,
      refreshing: true,
      error: "",
    }));

    try {
      const payload = await requestPayload(tab, currentPage);
      servicesCacheRef.current[cacheKey] = payload;
      setResourceState({
        loading: false,
        refreshing: false,
        error: "",
        data: payload,
      });
      return payload;
    } catch (error) {
      setResourceState((current) => ({
        ...current,
        refreshing: false,
        error: error.message || "Nao foi possivel carregar os servicos.",
      }));
      throw error;
    } finally {
      setTransitioningTab("");
    }
  };

  const payload = resourceState.data || servicesCacheRef.current[cacheKey] || {
    items: [],
    pagination: DEFAULT_PAGINATION,
  };
  const services = payload.items || [];
  const pagination = payload.pagination || DEFAULT_PAGINATION;
  const isTabTransitionLoading = Boolean(transitioningTab);
  const hasCachedPage = Boolean(servicesCacheRef.current[cacheKey]);
  const isHistoryPaginating =
    tab === "history" &&
    !hasCachedPage &&
    (resourceState.loading || resourceState.refreshing) &&
    currentPage > 1;
  const isBackgroundRefreshingFromCache =
    hasCachedPage && resourceState.refreshing;
  const interactionsDisabled =
    resourceState.loading || resourceState.refreshing || isTabTransitionLoading || Boolean(busyState.action);
  const visibleServices = useMemo(
    () =>
      services.filter((service) =>
        viewerRole === "diarista"
          ? Boolean(service?.client || service?.client_id)
          : Boolean(service?.diarist || service?.diarist_id),
      ),
    [services, viewerRole],
  );
  const modalService = selectedService
    ? visibleServices.find((service) => {
        const currentId = service?.id || service?.ID;
        const selectedId = selectedService?.id || selectedService?.ID;
        return currentId === selectedId;
      }) || selectedService
    : null;

  useEffect(() => {
    if (!resourceState.loading && !resourceState.refreshing) {
      setTransitioningTab("");
    }
  }, [resourceState.loading, resourceState.refreshing]);

  const handleTabChange = (nextTab) => {
    if (nextTab === tab || interactionsDisabled) {
      return;
    }

    setSelectedService(null);
    setTransitioningTab(nextTab);
    setTab(nextTab);
  };

  const handleHistoryPageChange = (direction) => {
    if (tab !== "history" || interactionsDisabled) {
      return;
    }

    setSelectedService(null);
    setTransitioningTab("history");
    setPageByTab((current) => ({
      ...current,
      history: Math.max(1, current.history + direction),
    }));
  };

  const executeServiceAction = async (service, action, options = {}) => {
    const serviceId = service?.id || service?.ID;
    if (!serviceId) {
      return false;
    }

    setBusyState({ serviceId, action });
    try {
      let response = null;

      if (action === "start-with-pin") {
        response = await apiFetch(`/services/${serviceId}/start-with-pin`, {
          method: "POST",
          authenticated: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pin: options.pin }),
        });
      } else {
        response = await apiFetch(`/services/${serviceId}/${action}`, {
          method: "PUT",
          authenticated: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            action === SERVICE_ACTIONS.CANCEL
              ? { reason: options.reason || "Cancelado pela diarista no aplicativo mobile." }
              : {},
          ),
        });
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || payload?.message || "Nao foi possivel atualizar o servico.");
      }

      await refreshCurrentPage();
      return true;
    } catch (error) {
      Alert.alert("Erro", error.message || "Nao foi possivel concluir a acao.");
      return false;
    } finally {
      setBusyState({ serviceId: null, action: "" });
    }
  };

  const handleAccept = async (service) => {
    await executeServiceAction(service, SERVICE_ACTIONS.ACCEPT);
  };

  const openCancelReasonModal = (service) => {
    setCancelReasonText("");
    setCancelReasonModal({
      open: true,
      service,
    });
  };

  const closeCancelReasonModal = () => {
    setCancelReasonText("");
    setCancelReasonModal({
      open: false,
      service: null,
    });
  };

  const handleCancel = async (service) => {
    openCancelReasonModal(service);
  };

  const submitCancelReason = async () => {
    if (!cancelReasonText.trim()) {
      Alert.alert("Motivo obrigatorio", "Informe o motivo do cancelamento para continuar.");
      return;
    }

    const targetService = cancelReasonModal.service;
    if (!targetService) {
      return;
    }

    const success = await executeServiceAction(targetService, SERVICE_ACTIONS.CANCEL, {
      reason: cancelReasonText.trim(),
    });

    if (success && modalService && (modalService?.id || modalService?.ID) === (targetService?.id || targetService?.ID)) {
      setSelectedService(null);
    }
    if (success) {
      closeCancelReasonModal();
    }
  };

  const handleStartWithPin = async (service, pin) => {
    return executeServiceAction(service, "start-with-pin", { pin });
  };

  const handleComplete = async (service) => {
    const success = await executeServiceAction(service, SERVICE_ACTIONS.COMPLETE);
    if (success && modalService && (modalService?.id || modalService?.ID) === (service?.id || service?.ID)) {
      setSelectedService(null);
    }
  };

  const handleOpenClientProfile = async (service) => {
    const offerId = getServiceOfferId(service);
    const client = service?.client || service?.Client || {};
    const inlineReviews = getInlineClientReviews(service);
    const offerLike = {
      id: offerId,
      ID: offerId,
      client_id: service?.client_id || service?.ClientID || client?.id || client?.ID || null,
      client_name: client?.name || client?.Name || "Cliente",
      client_photo: client?.photo || client?.Photo || client?.avatar || client?.Avatar || "",
      client_rating:
        client?.average_rating ||
        client?.AverageRating ||
        service?.client_rating ||
        service?.ClientRating ||
        0,
      client_total_reviews:
        client?.total_reviews ||
        client?.TotalReviews ||
        service?.client_total_reviews ||
        service?.ClientTotalReviews ||
        0,
      observations: service?.observations || "",
      distance: service?.distance || service?.Distance || "",
      address: service?.address || service?.Address || null,
      address_neighborhood:
        service?.address_neighborhood ||
        service?.AddressNeighborhood ||
        service?.address?.neighborhood ||
        service?.address?.Neighborhood ||
        "",
    };
    const fallbackProfile = {
      id: offerLike?.client_id || null,
      name: offerLike?.client_name || "Cliente",
      photo: offerLike?.client_photo || "",
      emailVerified: false,
      averageRating: Number(offerLike?.client_rating || 0),
      totalReviews: Number(offerLike?.client_total_reviews || 0),
      observations: offerLike?.observations || "",
      neighborhood: formatNeighborhood(offerLike),
      distance: formatOfferDistance(offerLike?.distance),
      residenceType: "",
      desiredFrequency: "",
      hasPets: null,
      addresses: offerLike?.address ? [offerLike.address] : [],
      reviews: inlineReviews,
    };

    setClientProfileModal({
      visible: true,
      loading: true,
      error: "",
      profile: fallbackProfile,
    });

    if (!offerId) {
      setClientProfileModal({
        visible: true,
        loading: false,
        error: "",
        profile: fallbackProfile,
      });
      return;
    }

    try {
      const response = await apiFetch(`/offers/${offerId}/client-profile`, {
        authenticated: true,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Nao foi possivel carregar o perfil da cliente.");
      }

      const data = await response.json().catch(() => ({}));
      const userProfile = data?.user_profile || data?.UserProfile || {};
      const addresses = Array.isArray(data?.address)
        ? data.address
        : Array.isArray(data?.Address)
          ? data.Address
          : fallbackProfile.addresses;
      const reviews = Array.isArray(data?.reviews)
        ? data.reviews
        : Array.isArray(data?.Reviews)
          ? data.Reviews
          : [];
      const filteredReviews = reviews.filter((review) => {
        const rating = Number(review?.diarist_rating || review?.DiaristRating || review?.rating || 0);
        const comment = String(
          review?.diarist_comment || review?.DiaristComment || review?.comment || "",
        ).trim();
        return rating > 0 || comment.length > 0;
      });
      const mergedReviews = [...filteredReviews];
      inlineReviews.forEach((review) => {
        const alreadyIncluded = mergedReviews.some((item) => {
          const sameId = review?.id && item?.id && review.id === item.id;
          const samePayload =
            Number(item?.diarist_rating || 0) === Number(review?.diarist_rating || 0) &&
            String(item?.diarist_comment || "").trim() === String(review?.diarist_comment || "").trim();
          return sameId || samePayload;
        });

        if (!alreadyIncluded) {
          mergedReviews.push(review);
        }
      });

      setClientProfileModal({
        visible: true,
        loading: false,
        error: "",
        profile: {
          id: data?.id || data?.ID || fallbackProfile.id,
          name: data?.name || data?.Name || fallbackProfile.name,
          photo: data?.photo || data?.Photo || fallbackProfile.photo,
          emailVerified:
            typeof data?.email_verified === "boolean"
              ? data.email_verified
              : typeof data?.EmailVerified === "boolean"
                ? data.EmailVerified
                : false,
          averageRating: Number(data?.average_rating || fallbackProfile.averageRating || 0),
          totalReviews: Number(data?.total_reviews || mergedReviews.length || 0),
          observations: data?.observations || fallbackProfile.observations,
          neighborhood:
            addresses?.[0]?.neighborhood ||
            addresses?.[0]?.Neighborhood ||
            data?.neighborhood ||
            data?.Neighborhood ||
            fallbackProfile.neighborhood,
          distance:
            typeof data?.distance === "number"
              ? `${data.distance.toFixed(1)} km`
              : data?.distance || fallbackProfile.distance,
          residenceType:
            userProfile?.residence_type ||
            userProfile?.ResidenceType ||
            addresses?.[0]?.residence_type ||
            addresses?.[0]?.ResidenceType ||
            "",
          desiredFrequency: userProfile?.desired_frequency || userProfile?.DesiredFrequency || "",
          hasPets:
            typeof userProfile?.has_pets === "boolean"
              ? userProfile.has_pets
              : typeof userProfile?.HasPets === "boolean"
                ? userProfile.HasPets
                : null,
          addresses,
          reviews: mergedReviews,
        },
      });
    } catch (error) {
      setClientProfileModal({
        visible: true,
        loading: false,
        error: error.message || "Nao foi possivel carregar o perfil da cliente.",
        profile: fallbackProfile,
      });
    }
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
      const reviews = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setAllReviews(reviews.map(normalizeDiaristReview));
    } catch (_error) {
      setAllReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleOpenDiaristProfile = async (service) => {
    const diarist = service?.diarist || service?.Diarist || {};
    const embeddedDiaristProfile =
      service?.diarist_profile ||
      service?.DiaristProfile ||
      diarist?.diarist_profile ||
      diarist?.DiaristProfile ||
      {};
    const diaristId = service?.diarist_id || service?.DiaristID || diarist?.id || diarist?.ID;
    const diaristProfileId = embeddedDiaristProfile?.id || embeddedDiaristProfile?.ID || null;

    if (!diaristId) {
      return;
    }

    setProfileLoading(true);
    setSelectedDiaristProfile(null);
    setDiaristProfileModalOpen(true);
    setReviewsModalOpen(false);
    setAllReviews([]);

    try {
      const [profileResponse] = await Promise.all([
        diaristProfileId
          ? apiFetch(`/diarists/${diaristProfileId}`, { authenticated: true })
          : Promise.resolve({ ok: false }),
        loadDiaristReviews(diaristId),
      ]);

      const profile = profileResponse.ok ? await profileResponse.json().catch(() => ({})) : embeddedDiaristProfile;

      setSelectedDiaristProfile({
        id: diaristId,
        role: "diarista",
        name: diarist?.name || diarist?.Name || `Diarista #${diaristId}`,
        email: diarist?.email || diarist?.Email || "",
        email_verified:
          typeof diarist?.email_verified === "boolean"
            ? diarist.email_verified
            : typeof diarist?.EmailVerified === "boolean"
              ? diarist.EmailVerified
              : false,
        photo:
          diarist?.photo ||
          diarist?.Photo ||
          embeddedDiaristProfile?.photo ||
          embeddedDiaristProfile?.Photo ||
          "",
        bio: profile?.bio || profile?.Bio || "",
        averageRating: Number(
          diarist?.average_rating ||
            diarist?.AverageRating ||
            service?.diarist_rating ||
            service?.DiaristRating ||
            0,
        ),
        totalReviews: Number(
          diarist?.total_reviews ||
            diarist?.TotalReviews ||
            service?.diarist_total_reviews ||
            service?.DiaristTotalReviews ||
            0,
        ),
        city: diarist?.city || diarist?.City || "",
        neighborhood:
          formatProfileNeighborhood(profile) ||
          formatProfileNeighborhood(embeddedDiaristProfile) ||
          formatProfileNeighborhood(diarist) ||
          formatProfileNeighborhood(service),
        distance:
          service?.distance_text ||
          service?.distance ||
          diarist?.distance_text ||
          diarist?.distance ||
          "",
        experienceYears: Number(profile?.experience_years || profile?.ExperienceYears || 0),
        pricePerHour: Number(profile?.price_per_hour || profile?.PricePerHour || 0),
        pricePerDay: Number(profile?.price_per_day || profile?.PricePerDay || 0),
        available:
          typeof profile?.available === "boolean"
            ? profile.available
            : typeof profile?.Available === "boolean"
              ? profile.Available
              : null,
        specialties: Array.isArray(profile?.specialties)
          ? profile.specialties
          : Array.isArray(profile?.Specialties)
            ? profile.Specialties
            : [],
      });
    } catch (_error) {
      setSelectedDiaristProfile({
        id: diaristId,
        role: "diarista",
        name: diarist?.name || diarist?.Name || `Diarista #${diaristId}`,
        email: diarist?.email || diarist?.Email || "",
        email_verified:
          typeof diarist?.email_verified === "boolean"
            ? diarist.email_verified
            : typeof diarist?.EmailVerified === "boolean"
              ? diarist.EmailVerified
              : false,
        photo:
          diarist?.photo ||
          diarist?.Photo ||
          embeddedDiaristProfile?.photo ||
          embeddedDiaristProfile?.Photo ||
          "",
        bio: embeddedDiaristProfile?.bio || embeddedDiaristProfile?.Bio || "",
        averageRating: Number(
          diarist?.average_rating ||
            diarist?.AverageRating ||
            service?.diarist_rating ||
            service?.DiaristRating ||
            0,
        ),
        totalReviews: Number(
          diarist?.total_reviews ||
            diarist?.TotalReviews ||
            service?.diarist_total_reviews ||
            service?.DiaristTotalReviews ||
            0,
        ),
        city: diarist?.city || diarist?.City || "",
        neighborhood:
          formatProfileNeighborhood(embeddedDiaristProfile) ||
          formatProfileNeighborhood(diarist) ||
          formatProfileNeighborhood(service),
        distance:
          service?.distance_text ||
          service?.distance ||
          diarist?.distance_text ||
          diarist?.distance ||
          "",
        experienceYears: Number(
          embeddedDiaristProfile?.experience_years || embeddedDiaristProfile?.ExperienceYears || 0,
        ),
        pricePerHour: Number(
          embeddedDiaristProfile?.price_per_hour || embeddedDiaristProfile?.PricePerHour || 0,
        ),
        pricePerDay: Number(
          embeddedDiaristProfile?.price_per_day || embeddedDiaristProfile?.PricePerDay || 0,
        ),
        available:
          typeof embeddedDiaristProfile?.available === "boolean"
            ? embeddedDiaristProfile.available
            : typeof embeddedDiaristProfile?.Available === "boolean"
              ? embeddedDiaristProfile.Available
              : null,
        specialties: Array.isArray(embeddedDiaristProfile?.specialties)
          ? embeddedDiaristProfile.specialties
          : Array.isArray(embeddedDiaristProfile?.Specialties)
            ? embeddedDiaristProfile.Specialties
            : [],
      });
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={resourceState.refreshing} onRefresh={refreshCurrentPage} />}
    >
      <SectionCard
        title="Meus servicos"
        right={
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 8,
              flex: 1,
            }}
          >
            <ServiceFileTab
              label="Ativos"
              icon="inbox"
              active={tab === "active"}
              disabled={interactionsDisabled}
              loading={transitioningTab === "active"}
              onPress={() => handleTabChange("active")}
            />
            <ServiceFileTab
              label="Historico"
              icon="archive"
              active={tab === "history"}
              disabled={interactionsDisabled}
              loading={transitioningTab === "history"}
              onPress={() => handleTabChange("history")}
            />
          </View>
        }
      >
        {tab === "history" && visibleServices.length > 0 && !resourceState.loading ? (
          <View
            style={{
              marginBottom: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#dbe7ff",
              backgroundColor: "#f8fbff",
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <TouchableOpacity
              disabled={interactionsDisabled || !pagination.has_previous}
              onPress={() => handleHistoryPageChange(-1)}
              style={[
                styles.modalGhostButton,
                {
                  minWidth: 92,
                  opacity: interactionsDisabled || !pagination.has_previous ? 0.5 : 1,
                },
              ]}
            >
              <Text style={styles.modalGhostButtonText}>Anterior</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: "#111827", fontSize: 13, fontWeight: "800" }}>
                Pagina {pagination.page} de {pagination.total_pages}
              </Text>
              <Text style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                {pagination.total_items} servicos no historico
              </Text>
              {isBackgroundRefreshingFromCache ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <ActivityIndicator color="#2563eb" size="small" />
                  <Text style={{ color: "#2563eb", fontSize: 12, fontWeight: "700" }}>
                    Atualizando
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              disabled={interactionsDisabled || !pagination.has_next}
              onPress={() => handleHistoryPageChange(1)}
              style={[
                styles.modalGhostButton,
                {
                  minWidth: 92,
                  opacity: interactionsDisabled || !pagination.has_next ? 0.5 : 1,
                },
              ]}
            >
              <Text style={styles.modalGhostButtonText}>Proxima</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {resourceState.loading && !isHistoryPaginating && !hasCachedPage ? (
          <ServicesLoadingState
            switching={Boolean(transitioningTab) || Boolean(resourceState.data)}
            tabLabel={(transitioningTab || tab) === "history" ? "historico" : "ativos"}
          />
        ) : resourceState.error ? (
          <Text style={styles.errorText}>{resourceState.error}</Text>
        ) : visibleServices.length === 0 ? (
          <EmptyState
            title="Nenhum servico nesta aba"
            description="Quando houver servicos vinculados a sua conta, eles aparecerao aqui."
          />
        ) : isHistoryPaginating ? (
          <ServicesCardsPaginationSkeleton />
        ) : (
          <View>
            {visibleServices.map((service, index) => {
              const serviceId = service?.id || service?.ID || index;
              const busyAction =
                busyState.serviceId === (service?.id || service?.ID) ? busyState.action : "";

              return (
                <ServiceCard
                  key={serviceId}
                  service={service}
                  role={viewerRole}
                  activeTab={tab}
                  busyAction={busyAction}
                  disabled={interactionsDisabled}
                  onPress={setSelectedService}
                  onAccept={handleAccept}
                  onCancel={handleCancel}
                  onStart={setSelectedService}
                  onComplete={handleComplete}
                  onOpenClientProfile={viewerRole === "diarista" ? handleOpenClientProfile : handleOpenDiaristProfile}
                  onOpenChat={isServiceChatAvailable(service) ? openChat : null}
                  chatLabel={session?.role === "cliente" ? "Falar com a diarista" : "Falar com cliente"}
                />
              );
            })}
          </View>
        )}

      </SectionCard>

      <ServiceDetailsModal
        visible={Boolean(modalService)}
        service={modalService}
        role={viewerRole}
        busyAction={
          modalService && busyState.serviceId === (modalService?.id || modalService?.ID)
            ? busyState.action
            : ""
        }
        onClose={() => setSelectedService(null)}
        onAccept={handleAccept}
        onCancel={handleCancel}
        onComplete={handleComplete}
        onOpenClientProfile={viewerRole === "diarista" ? handleOpenClientProfile : handleOpenDiaristProfile}
        onStartWithPin={handleStartWithPin}
        onOpenChat={isServiceChatAvailable(modalService) ? openChat : null}
        chatLabel={session?.role === "cliente" ? "Falar com a diarista" : "Falar com cliente"}
      />

      <Modal
        visible={cancelReasonModal.open}
        transparent
        animationType="fade"
        onRequestClose={closeCancelReasonModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancelar servico</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Informe o motivo do cancelamento"
              multiline
              value={cancelReasonText}
              onChangeText={setCancelReasonText}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalGhostButton} onPress={closeCancelReasonModal}>
                <Text style={styles.modalGhostButtonText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerInlineButton} onPress={submitCancelReason}>
                <Text style={styles.dangerInlineButtonText}>
                  {busyState.action === SERVICE_ACTIONS.CANCEL ? "Salvando..." : "Cancelar servico"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ClientProfileModal
        visible={clientProfileModal.visible}
        loading={clientProfileModal.loading}
        error={clientProfileModal.error}
        profile={clientProfileModal.profile}
        onClose={() =>
          setClientProfileModal({
            visible: false,
            loading: false,
            error: "",
            profile: null,
          })
        }
      />

      <Modal
        visible={diaristProfileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDiaristProfileModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.mapProfileModalCard]}>
            {profileLoading ? (
              <LoadingState label="Carregando perfil..." />
            ) : selectedDiaristProfile ? (
              <>
                <TouchableOpacity
                  style={styles.mapModalClose}
                  onPress={() => setDiaristProfileModalOpen(false)}
                >
                  <Text style={styles.mapModalCloseText}>x</Text>
                </TouchableOpacity>

                <View style={styles.mapProfileHeader}>
                  <View style={styles.mapProfileAvatarWrapper}>
                    {selectedDiaristProfile.photo ? (
                      <Image source={{ uri: selectedDiaristProfile.photo }} style={styles.mapProfileAvatar} />
                    ) : (
                      <View style={styles.mapProfileAvatarFallback}>
                        <Text style={styles.mapProfileAvatarFallbackText}>
                          {String(selectedDiaristProfile?.name || "D").trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.mapProfileName}>
                    {selectedDiaristProfile.name || "Diarista"}
                  </Text>
                  <View style={styles.mapHeaderMetaRow}>
                    <View style={styles.mapRatingPillLarge}>
                      <Feather name="star" size={14} color="#f59e0b" />
                      <Text style={styles.mapRatingPillLargeText}>
                        {formatAverageRatingText(selectedDiaristProfile.averageRating || 0)}
                      </Text>
                      <Text style={styles.mapRatingPillLargeCount}>
                        ({Number(selectedDiaristProfile.totalReviews || allReviews.length || 0)} avaliacoes)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.mapVerificationPill,
                        selectedDiaristProfile.email_verified
                          ? styles.mapVerificationPillVerified
                          : styles.mapVerificationPillUnverified,
                      ]}
                    >
                      <Feather
                        name={selectedDiaristProfile.email_verified ? "check-circle" : "x-circle"}
                        size={13}
                        color={selectedDiaristProfile.email_verified ? "#16a34a" : "#dc2626"}
                      />
                      <Text
                        style={[
                          styles.mapVerificationPillText,
                          selectedDiaristProfile.email_verified
                            ? styles.mapVerificationPillTextVerified
                            : styles.mapVerificationPillTextUnverified,
                        ]}
                      >
                        {getEmailVerificationLabel(Boolean(selectedDiaristProfile.email_verified))}
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
                      <Feather name="user" size={16} color="#3167e3" />
                      <Text style={styles.mapProfileSectionTitle}>Sobre a Profissional</Text>
                    </View>
                    <Text style={styles.mapProfileSectionCopy}>
                      {selectedDiaristProfile.bio || "A diarista ainda nao cadastrou uma bio."}
                    </Text>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="award" size={16} color="#f59e0b" />
                      <Text style={styles.mapProfileSectionTitle}>Informacoes reais</Text>
                    </View>
                    <View style={styles.mapStatsGrid}>
                      <View style={styles.mapStatCard}>
                        <Feather name="map-pin" size={15} color="#3167e3" />
                        <Text style={styles.mapStatLabel}>Distancia</Text>
                        <Text style={styles.mapStatValue}>
                          {[selectedDiaristProfile.neighborhood, selectedDiaristProfile.distance]
                            .filter(Boolean)
                            .join(" • ") || "-"}
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="shield" size={15} color="#3167e3" />
                        <Text style={styles.mapStatLabel}>Experiencia</Text>
                        <Text style={styles.mapStatValue}>
                          {Number(selectedDiaristProfile.experienceYears || 0)} anos
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="star" size={15} color="#f59e0b" />
                        <Text style={styles.mapStatLabel}>Avaliacao</Text>
                        <Text style={styles.mapStatValue}>
                          {formatAverageRatingText(selectedDiaristProfile.averageRating || 0)}
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather
                          name="check-circle"
                          size={15}
                          color={selectedDiaristProfile.available ? "#10b981" : "#94a3b8"}
                        />
                        <Text style={styles.mapStatLabel}>Disponibilidade</Text>
                        <Text style={styles.mapStatValue}>
                          {selectedDiaristProfile.available === null
                            ? "Nao informada"
                            : selectedDiaristProfile.available
                              ? "Disponivel"
                              : "Indisponivel"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="dollar-sign" size={16} color="#f59e0b" />
                      <Text style={styles.mapProfileSectionTitle}>Valores informados</Text>
                    </View>
                    <View style={styles.mapDrawerPricing}>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por hora</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(selectedDiaristProfile.pricePerHour || 0)}
                        </Text>
                      </View>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por diaria</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(selectedDiaristProfile.pricePerDay || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="check-circle" size={16} color="#3167e3" />
                      <Text style={styles.mapProfileSectionTitle}>Especialidades</Text>
                    </View>
                    <View style={styles.mapSpecialtiesWrap}>
                      {Array.isArray(selectedDiaristProfile.specialties) && selectedDiaristProfile.specialties.length > 0 ? (
                        selectedDiaristProfile.specialties.map((specialty) => {
                          const presentation = getSpecialtyPresentation(specialty);
                          return (
                            <View key={specialty} style={styles.mapSpecialtyCard}>
                              <Feather name={presentation.icon} size={14} color="#3167e3" />
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
                      <Feather name="star" size={16} color="#f59e0b" />
                      <Text style={styles.mapProfileSectionTitle}>Avaliacoes</Text>
                    </View>
                    {reviewsLoading ? (
                      <Text style={styles.mapProfileSectionCopy}>Carregando avaliacoes...</Text>
                    ) : allReviews.length === 0 ? (
                      <Text style={styles.mapProfileSectionCopy}>Nenhuma avaliacao ainda.</Text>
                    ) : (
                      allReviews.slice(0, 3).map((review, index) => (
                        <View key={review?.id || review?.ID || index} style={styles.mapReviewCard}>
                          <View style={styles.mapReviewHeader}>
                            <Text style={styles.mapReviewStars}>
                              {"*".repeat(
                                Math.max(
                                  0,
                                  Math.min(5, Math.round(Number(review?.client_rating || review?.rating || 0))),
                                ),
                              )}
                            </Text>
                            <Text style={styles.mapReviewDate}>
                              {formatShortDate(review?.created_at || review?.CreatedAt)}
                            </Text>
                          </View>
                          <Text style={styles.mapReviewComment}>
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
                        <Text style={styles.profilePreviewButtonText}>
                          Ver todas as {allReviews.length} avaliacoes
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </ScrollView>
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




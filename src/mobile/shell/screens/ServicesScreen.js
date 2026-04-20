import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../../config/api";
import { styles } from "../AppShell.styles";
import EmptyState from "../components/EmptyState";
import SectionCard from "../components/SectionCard";
import ServiceCard from "../components/ServiceCard";
import ServiceDetailsModal from "../components/ServiceDetailsModal";
import ClientProfileModal from "../components/ClientProfileModal";
import { useMobileChatCenter } from "../../MobileChatCenter";
import { SERVICE_ACTIONS } from "../../../services/constants";

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
  const diaristServices = useMemo(
    () => services.filter((service) => Boolean(service?.client || service?.client_id)),
    [services],
  );
  const modalService = selectedService
    ? diaristServices.find((service) => {
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

  const handleCancel = async (service) => {
    const success = await executeServiceAction(service, SERVICE_ACTIONS.CANCEL, {
      reason: "Cancelado pela diarista no aplicativo mobile.",
    });

    if (success && modalService && (modalService?.id || modalService?.ID) === (service?.id || service?.ID)) {
      setSelectedService(null);
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
        {tab === "history" && diaristServices.length > 0 && !resourceState.loading ? (
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
        ) : diaristServices.length === 0 ? (
          <EmptyState
            title="Nenhum servico nesta aba"
            description="Quando houver servicos vinculados a sua conta, eles aparecerao aqui."
          />
        ) : isHistoryPaginating ? (
          <ServicesCardsPaginationSkeleton />
        ) : (
          <View>
            {diaristServices.map((service, index) => {
              const serviceId = service?.id || service?.ID || index;
              const busyAction =
                busyState.serviceId === (service?.id || service?.ID) ? busyState.action : "";

              return (
                <ServiceCard
                  key={serviceId}
                  service={service}
                  role="diarista"
                  activeTab={tab}
                  busyAction={busyAction}
                  disabled={interactionsDisabled}
                  onPress={setSelectedService}
                  onAccept={handleAccept}
                  onCancel={handleCancel}
                  onStart={setSelectedService}
                  onComplete={handleComplete}
                  onOpenClientProfile={handleOpenClientProfile}
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
        role="diarista"
        busyAction={
          modalService && busyState.serviceId === (modalService?.id || modalService?.ID)
            ? busyState.action
            : ""
        }
        onClose={() => setSelectedService(null)}
        onAccept={handleAccept}
        onCancel={handleCancel}
        onComplete={handleComplete}
        onOpenClientProfile={handleOpenClientProfile}
        onStartWithPin={handleStartWithPin}
        onOpenChat={isServiceChatAvailable(modalService) ? openChat : null}
        chatLabel={session?.role === "cliente" ? "Falar com a diarista" : "Falar com cliente"}
      />

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
    </ScrollView>
  );
}

import React, { useState } from "react";
import { Alert, Image, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch, getToken } from "../../../config/api";
import { styles } from "../AppShell.styles";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import ClientProfileModal from "../components/ClientProfileModal";
import useRemoteResource from "../hooks/useRemoteResource";
import {
  formatAddress,
  formatAverageRatingText,
  formatCurrency,
  formatDate,
  formatShortDate,
  getEmailVerificationLabel,
  getSpecialtyPresentation,
  normalizeAddress,
  normalizeDiaristReview,
} from "../utils/shellUtils";

function OffersLoadingState({ role = "cliente" }) {
  const isClient = role === "cliente";

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.screenContent}
      scrollEnabled={false}
    >
      <View style={styles.loadingHero}>
        <View style={styles.loadingPulseDot} />
        <Text style={styles.loadingHeroTitle}>
          {isClient ? "Carregando suas ofertas" : "Carregando oportunidades"}
        </Text>
        <Text style={styles.loadingHeroCopy}>
          {isClient
            ? "Estamos organizando suas publicacoes, contrapropostas e proximos passos."
            : "Estamos reunindo ofertas abertas e negociacoes recentes para voce."}
        </Text>
      </View>

      <View style={styles.loadingSectionCard}>
        <View style={styles.loadingToolbar}>
          <View style={styles.loadingToolbarCopy}>
            <View style={[styles.loadingLine, styles.loadingLineShorter]} />
            <View style={[styles.loadingLine, styles.loadingLineMedium]} />
          </View>
          <View style={styles.loadingFilterButton} />
        </View>

        <View style={[styles.inlineMeta, { marginBottom: 14 }]}>
          <View style={[styles.loadingLine, { width: 124, height: 36, marginBottom: 0 }]} />
          <View style={[styles.loadingLine, { width: 112, height: 36, marginBottom: 0 }]} />
        </View>

        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.loadingDiaristCard}>
            <View style={styles.loadingAvatar} />
            <View style={styles.loadingCardBody}>
              <View style={[styles.loadingLine, styles.loadingLineWide]} />
              <View style={[styles.loadingLine, styles.loadingLineMedium]} />
              <View style={[styles.loadingLine, { width: "56%" }]} />
              <View style={[styles.inlineMeta, { marginTop: 6 }]}>
                <View style={[styles.loadingLine, { width: 88, height: 28, marginBottom: 0 }]} />
                <View style={[styles.loadingLine, { width: 96, height: 28, marginBottom: 0 }]} />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.loadingSectionCard}>
        <View style={styles.loadingSectionHeader}>
          <View style={styles.loadingTitleBar} />
          <View style={styles.loadingCountDot} />
        </View>
        <View style={[styles.loadingLine, styles.loadingLineWide]} />
        <View style={[styles.loadingLine, styles.loadingLineMedium]} />
        <View style={[styles.loadingLine, { width: "72%" }]} />
      </View>
    </ScrollView>
  );
}

const getRoomIcon = (roomName) => {
  const normalizedName = String(roomName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedName.includes("banheiro") || normalizedName.includes("lavabo")) return "droplet";
  if (normalizedName.includes("quarto") || normalizedName.includes("suite")) return "hexagon";
  if (normalizedName.includes("cozinha")) return "search";
  if (normalizedName.includes("sala")) return "briefcase";
  if (normalizedName.includes("varanda")) return "home";
  if (normalizedName.includes("area") || normalizedName.includes("lavanderia")) return "wind";
  return "grid";
};

const getOfferRooms = (offer = {}) => {
  const rooms = offer?.address?.rooms || offer?.address?.Rooms || [];
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

const formatProfileNeighborhood = (source = {}) =>
  source?.neighborhood ||
  source?.Neighborhood ||
  source?.address?.neighborhood ||
  source?.address?.Neighborhood ||
  source?.address_neighborhood ||
  source?.AddressNeighborhood ||
  "";

export default function OffersScreen({ session }) {
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
  const [expandedDiaristOffers, setExpandedDiaristOffers] = useState({});
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [clientProfileModal, setClientProfileModal] = useState({
    visible: false,
    loading: false,
    error: "",
    profile: null,
  });

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
      const reviews = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setAllReviews(reviews.map(normalizeDiaristReview));
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

    const negotiationDiarist = negotiation?.diarist || {};
    const embeddedDiaristProfile =
      negotiation?.diarist_profile ||
      negotiation?.DiaristProfile ||
      negotiationDiarist?.diarist_profile ||
      negotiationDiarist?.DiaristProfile ||
      {};
    const diaristProfileId = embeddedDiaristProfile?.id || embeddedDiaristProfile?.ID || null;

    setProfileLoading(true);
    setSelectedProfile(null);
    setProfileModalOpen(true);
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

      setSelectedProfile({
        id: diaristId,
        role: "diarista",
        name:
          negotiationDiarist?.name ||
          negotiationDiarist?.Name ||
          `Diarista #${diaristId}`,
        email: negotiationDiarist?.email || negotiationDiarist?.Email || "",
        email_verified:
          typeof negotiationDiarist?.email_verified === "boolean"
            ? negotiationDiarist.email_verified
            : typeof negotiationDiarist?.EmailVerified === "boolean"
              ? negotiationDiarist.EmailVerified
              : false,
        photo:
          negotiationDiarist?.photo ||
          negotiationDiarist?.Photo ||
          embeddedDiaristProfile?.photo ||
          embeddedDiaristProfile?.Photo ||
          "",
        bio: profile?.bio || profile?.Bio || "",
        averageRating: Number(negotiation?.diarist_rating || 0),
        totalReviews: Number(negotiation?.diarist_total_reviews || 0),
        city: negotiationDiarist?.city || negotiationDiarist?.City || "",
        neighborhood:
          formatProfileNeighborhood(profile) ||
          formatProfileNeighborhood(embeddedDiaristProfile) ||
          formatProfileNeighborhood(negotiationDiarist) ||
          formatProfileNeighborhood(negotiation),
        distance:
          negotiation?.distance_text ||
          negotiation?.distance ||
          negotiationDiarist?.distance_text ||
          negotiationDiarist?.distance ||
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
      setSelectedProfile({
        id: diaristId,
        role: "diarista",
        name:
          negotiationDiarist?.name ||
          negotiationDiarist?.Name ||
          `Diarista #${diaristId}`,
        email: "",
        email_verified: false,
        photo:
          negotiationDiarist?.photo ||
          negotiationDiarist?.Photo ||
          embeddedDiaristProfile?.photo ||
          embeddedDiaristProfile?.Photo ||
          "",
        bio: embeddedDiaristProfile?.bio || embeddedDiaristProfile?.Bio || "",
        averageRating: Number(negotiation?.diarist_rating || 0),
        totalReviews: Number(negotiation?.diarist_total_reviews || 0),
        city: negotiationDiarist?.city || negotiationDiarist?.City || "",
        neighborhood:
          formatProfileNeighborhood(embeddedDiaristProfile) ||
          formatProfileNeighborhood(negotiationDiarist) ||
          formatProfileNeighborhood(negotiation),
        distance:
          negotiation?.distance_text ||
          negotiation?.distance ||
          negotiationDiarist?.distance_text ||
          negotiationDiarist?.distance ||
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

  const openClientProfile = async (offer) => {
    const clientName = offer?.client_name || `Cliente #${offer?.client_id || "pendente"}`;
    const clientPhoto = offer?.client_photo || "";
    const fallbackProfile = {
      id: offer?.client_id || null,
      name: clientName,
      photo: clientPhoto,
      emailVerified: false,
      averageRating: Number(offer?.client_rating || 0),
      totalReviews: Number(offer?.client_total_reviews || 0),
      observations: offer?.observations || "",
      neighborhood: formatNeighborhood(offer),
      distance: formatOfferDistance(offer?.distance),
      residenceType: "",
      desiredFrequency: "",
      hasPets: null,
      addresses: offer?.address ? [offer.address] : [],
      reviews: [],
    };

    setClientProfileModal({
      visible: true,
      loading: true,
      error: "",
      profile: fallbackProfile,
    });

    try {
      const response = await apiFetch(`/offers/${offer?.id || offer?.ID}/client-profile`, {
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
        const comment = String(review?.diarist_comment || review?.DiaristComment || review?.comment || "").trim();
        return rating > 0 || comment.length > 0;
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
          totalReviews: Number(data?.total_reviews || filteredReviews.length || 0),
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
          reviews: filteredReviews,
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
    return <OffersLoadingState role={session.role} />;
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
            const clientLocationLabel = [formatNeighborhood(item), formatOfferDistance(item?.distance)]
              .filter(Boolean)
              .join(" • ");
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
            const isExpanded = Boolean(expandedDiaristOffers[itemId]);

            return (
              session.role === "diarista" && diaristTab === "offers" ? (
                <View key={itemId} style={styles.diaristOfferCardMobile}>
                  <TouchableOpacity
                    activeOpacity={0.96}
                    onPress={() =>
                      setExpandedDiaristOffers((current) => ({
                        ...current,
                        [itemId]: !current[itemId],
                      }))
                    }
                  >
                    <View style={styles.diaristOfferTopRow}>
                      <View style={styles.diaristOfferIdentity}>
                        <View style={styles.diaristOfferPhotoFrame}>
                          {item?.client_photo ? (
                            <Image source={{ uri: item.client_photo }} style={styles.diaristOfferPhoto} />
                          ) : (
                            <View style={styles.diaristOfferPhotoFallback}>
                              <Text style={styles.diaristOfferPhotoFallbackText}>
                                {String(item?.client_name || "C").trim().charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.diaristOfferEyebrow}>Cliente</Text>
                          <Text style={styles.diaristOfferClientName}>
                            {item?.client_name || "Cliente"}
                          </Text>
                          <View style={styles.diaristOfferRatingRow}>
                            <Feather name="star" size={14} color="#f59e0b" />
                            <Text style={styles.diaristOfferRatingValue}>
                              {Number(item?.client_rating || 0).toFixed(1)}
                            </Text>
                            <Text style={styles.diaristOfferRatingText}>
                              ({Number(item?.client_total_reviews || 0)} avaliacoes)
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {hasPendingNegotiation ? (
                      <View style={styles.diaristOfferWarningChipInline}>
                        <Text style={styles.diaristOfferWarningChipText}>
                          Voce ja fez uma contraproposta
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.diaristOfferChipRowMobile}>
                      <View style={styles.diaristOfferInfoChip}>
                        <Text style={styles.diaristOfferInfoChipText}>{formatNeighborhood(item)}</Text>
                      </View>
                      {formatOfferDistance(item?.distance) ? (
                        <View style={styles.diaristOfferInfoChip}>
                          <Text style={styles.diaristOfferInfoChipText}>{formatOfferDistance(item?.distance)}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.diaristOfferMetricsGrid}>
                      <View style={styles.diaristOfferMetricCard}>
                        <Text style={styles.diaristOfferMetricLabel}>Horas</Text>
                        <Text style={styles.diaristOfferMetricValue}>
                          {Number(item?.duration_hours || 0)}h
                        </Text>
                      </View>
                      <View style={styles.diaristOfferMetricCard}>
                        <Text style={styles.diaristOfferMetricLabel}>Valor</Text>
                        <Text style={styles.diaristOfferMetricValue}>
                          {formatCurrency(item?.initial_value || 0)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.diaristOfferBottomActions}>
                      {isOfferAvailableForNegotiation ? (
                        !hasPendingNegotiation ? (
                          <TouchableOpacity
                            style={[styles.diaristOfferBottomAction, styles.diaristOfferCounterButton]}
                            onPress={() => openCounterModal(item)}
                          >
                            <Text style={styles.diaristOfferCounterButtonText}>
                              Fazer contraproposta
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.diaristOfferBottomActionSpacer} />
                        )
                      ) : (
                        <View style={styles.diaristOfferBottomActionSpacer} />
                      )}

                      {isOfferAvailableForNegotiation ? (
                        <TouchableOpacity
                          style={[styles.diaristOfferBottomAction, styles.diaristOfferAcceptButton]}
                          onPress={() => handleAcceptOffer(itemId)}
                        >
                          <Text style={styles.diaristOfferAcceptButtonText}>
                            {submittingKey === `accept-offer-${itemId}` ? "Aceitando..." : "Aceitar Oferta"}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.diaristOfferBottomAction, styles.diaristOfferProfileButton]}
                          onPress={() => openClientProfile(item)}
                        >
                          <Text style={styles.diaristOfferProfileButtonText}>Ver perfil</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isOfferAvailableForNegotiation ? (
                      <TouchableOpacity
                        style={styles.diaristOfferProfileButtonStandalone}
                        onPress={() => openClientProfile(item)}
                      >
                        <Text style={styles.diaristOfferProfileButtonText}>Ver perfil</Text>
                      </TouchableOpacity>
                    ) : null}

                    {isExpanded ? (
                      <View style={styles.diaristOfferExpandedPanel}>
                        {String(item?.observations || "").trim() ? (
                          <View style={styles.diaristOfferObservationsBox}>
                            <Text style={styles.diaristOfferSectionLabel}>Observacoes da cliente</Text>
                            <Text style={styles.diaristOfferObservationsText}>{item.observations}</Text>
                          </View>
                        ) : null}

                        <View style={styles.diaristOfferRoomsBox}>
                          <Text style={styles.diaristOfferSectionLabel}>
                            Comodos da residencia ({getOfferRooms(item).reduce((total, room) => total + room.quantity, 0)})
                          </Text>
                          <View style={styles.diaristOfferRoomsGrid}>
                            {getOfferRooms(item).length > 0 ? (
                              getOfferRooms(item).map((room) => (
                                <View key={room.id} style={styles.diaristOfferRoomCardMobile}>
                                  <View style={styles.diaristOfferRoomIconWrap}>
                                    <Feather name={getRoomIcon(room.name)} size={16} color="#3167e3" />
                                  </View>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.diaristOfferRoomName}>{room.name}</Text>
                                    <Text style={styles.diaristOfferRoomMeta}>
                                      {formatRoomCountLabel(room.quantity)}
                                    </Text>
                                  </View>
                                  <View style={styles.diaristOfferRoomBadge}>
                                    <Text style={styles.diaristOfferRoomBadgeText}>{room.quantity}x</Text>
                                  </View>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.secondaryLine}>Comodos nao informados.</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.diaristOfferFooterToggle}
                    onPress={() =>
                      setExpandedDiaristOffers((current) => ({
                        ...current,
                        [itemId]: !current[itemId],
                      }))
                    }
                  >
                    <Text style={styles.diaristOfferFooterToggleText}>
                      {isExpanded ? "Clique para recolher" : "Clique para mais informacoes"}
                    </Text>
                    <Feather
                      name={isExpanded ? "chevron-down" : "arrow-right"}
                      size={16}
                      color="#2563eb"
                    />
                  </TouchableOpacity>
                </View>
              ) : (
              <View key={itemId} style={styles.listCard}>
                <View style={styles.offerCardHeader}>
                  <View style={styles.offerCardHeaderMain}>
                    <Text style={styles.listTitle}>
                      {session.role === "cliente"
                        ? item?.service_type || "Oferta"
                        : diaristTab === "negotiations"
                          ? "Negociacao"
                          : "Oferta"}{" "}
                      #{itemId}
                    </Text>
                    <View style={styles.offerAddressRow}>
                      {item?.scheduled_at || item?.ScheduledAt ? (
                        <View style={styles.offerScheduleBadge}>
                          <Feather name="clock" size={12} color="#15803d" />
                          <Text style={styles.offerScheduleBadgeText}>
                            {formatDate(item?.scheduled_at || item?.ScheduledAt)}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.secondaryLine}>
                        {session.role === "cliente"
                          ? clientLocationLabel || formatNeighborhood(item)
                          : addressLabel}
                      </Text>
                    </View>
                  </View>

                  {session.role === "cliente" &&
                  (item?.status === "aberta" || item?.status === "negociacao") ? (
                    <TouchableOpacity
                      style={styles.offerHeaderDangerButton}
                      onPress={() => openReasonModal("cancel-offer", itemId)}
                    >
                      <Text style={styles.offerHeaderDangerButtonText}>Cancelar oferta</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

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
              </View>
              )
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
          <View style={[styles.modalCard, styles.offerCreateModalCard]}>
            <Text style={styles.offerCreateModalTitle}>Criar nova oferta</Text>
            <Text style={styles.offerCreateModalAddress}>
              Endereco selecionado: {formatAddress(normalizeAddress(payload.activeAddress || {})) || "Nao informado"}
            </Text>
            <TextInput
              style={[styles.modalInput, styles.offerCreateModalInput, styles.offerCreateModalPrimaryInput]}
              placeholder="Tipo de limpeza"
              value={createForm.serviceType}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, serviceType: value }))}
            />
            <TextInput
              style={[styles.modalInput, styles.offerCreateModalInput]}
              placeholder="YYYY-MM-DD"
              value={createForm.serviceDate}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, serviceDate: value }))}
            />
            <TextInput
              style={[styles.modalInput, styles.offerCreateModalInput]}
              placeholder="HH:mm"
              value={createForm.serviceTime}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, serviceTime: value }))}
            />
            <TextInput
              style={[styles.modalInput, styles.offerCreateModalInput]}
              placeholder="Duracao em horas"
              keyboardType="numeric"
              value={createForm.hours}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, hours: value }))}
            />
            <TextInput
              style={[styles.modalInput, styles.offerCreateModalInput]}
              placeholder="Valor inicial"
              keyboardType="numeric"
              value={createForm.value}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, value: value }))}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextarea, styles.offerCreateModalInput, styles.offerCreateModalTextarea]}
              placeholder="Observacoes"
              multiline
              value={createForm.observations}
              onChangeText={(value) => setCreateForm((current) => ({ ...current, observations: value }))}
            />
            <View style={[styles.modalActionRow, styles.offerCreateModalActions]}>
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
          <View style={[styles.modalCard, styles.mapProfileModalCard]}>
            {profileLoading ? (
              <LoadingState label="Carregando perfil..." />
            ) : selectedProfile ? (
              <>
                <TouchableOpacity
                  style={styles.mapModalClose}
                  onPress={() => setProfileModalOpen(false)}
                >
                  <Text style={styles.mapModalCloseText}>x</Text>
                </TouchableOpacity>

                <View style={styles.mapProfileHeader}>
                  <View style={styles.mapProfileAvatarWrapper}>
                    {selectedProfile.photo ? (
                      <Image source={{ uri: selectedProfile.photo }} style={styles.mapProfileAvatar} />
                    ) : (
                      <View style={styles.mapProfileAvatarFallback}>
                        <Text style={styles.mapProfileAvatarFallbackText}>
                          {String(selectedProfile?.name || "D").trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.mapProfileName}>
                    {selectedProfile.name || "Diarista"}
                  </Text>
                  <View style={styles.mapHeaderMetaRow}>
                    <View style={styles.mapRatingPillLarge}>
                      <Feather name="star" size={14} color="#f59e0b" />
                      <Text style={styles.mapRatingPillLargeText}>
                        {formatAverageRatingText(selectedProfile.averageRating || 0)}
                      </Text>
                      <Text style={styles.mapRatingPillLargeCount}>
                        ({Number(selectedProfile.totalReviews || allReviews.length || 0)} avaliacoes)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.mapVerificationPill,
                        selectedProfile.email_verified
                          ? styles.mapVerificationPillVerified
                          : styles.mapVerificationPillUnverified,
                      ]}
                    >
                      <Feather
                        name={selectedProfile.email_verified ? "check-circle" : "x-circle"}
                        size={13}
                        color={selectedProfile.email_verified ? "#16a34a" : "#dc2626"}
                      />
                      <Text
                        style={[
                          styles.mapVerificationPillText,
                          selectedProfile.email_verified
                            ? styles.mapVerificationPillTextVerified
                            : styles.mapVerificationPillTextUnverified,
                        ]}
                      >
                        {getEmailVerificationLabel(Boolean(selectedProfile.email_verified))}
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
                      {selectedProfile.bio || "A diarista ainda nao cadastrou uma bio."}
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
                          {[selectedProfile.neighborhood, selectedProfile.distance]
                            .filter(Boolean)
                            .join(" • ") || "-"}
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="shield" size={15} color="#3167e3" />
                        <Text style={styles.mapStatLabel}>Experiencia</Text>
                        <Text style={styles.mapStatValue}>
                          {Number(selectedProfile.experienceYears || 0)} anos
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="star" size={15} color="#f59e0b" />
                        <Text style={styles.mapStatLabel}>Avaliacao</Text>
                        <Text style={styles.mapStatValue}>
                          {formatAverageRatingText(selectedProfile.averageRating || 0)}
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather
                          name="check-circle"
                          size={15}
                          color={selectedProfile.available ? "#10b981" : "#94a3b8"}
                        />
                        <Text style={styles.mapStatLabel}>Disponibilidade</Text>
                        <Text style={styles.mapStatValue}>
                          {selectedProfile.available === null
                            ? "Nao informada"
                            : selectedProfile.available
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
                          {formatCurrency(selectedProfile.pricePerHour || 0)}
                        </Text>
                      </View>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por diaria</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(selectedProfile.pricePerDay || 0)}
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
                      {Array.isArray(selectedProfile.specialties) && selectedProfile.specialties.length > 0 ? (
                        selectedProfile.specialties.map((specialty) => {
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
                        {"?".repeat(Math.max(0, Math.min(5, Math.round(Number(review?.client_rating || review?.rating || 0)))))}
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


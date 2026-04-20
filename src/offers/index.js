import React, { startTransition, useEffect, useMemo, useState, useTransition } from "react";
import { useAddress } from "../context/address";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Slider,
  Space,
  Spin,
  Tabs,
  Tag,
  message,
} from "antd";
import {
  ArrowRightOutlined,
  FilterOutlined,
  StarFilled,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "./offers.css";
import "../diaristmap/drawer-styles.css";
import { apiFetch, buildApiPathUrl } from "../config/api";
import { createAuthenticatedWebSocket } from "../config/realtime";
import { useOnlinePresence } from "../context/onlinePresence";
import OnlineIndicator from "../components/OnlineIndicator";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const parseSpecialties = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const formatDistance = (distance) => {
  if (distance === null || distance === undefined) {
    return "Distância indisponível";
  }

  return `${Number(distance).toFixed(1)} km`;
};

const formatNeighborhood = (offer) =>
  offer.address_neighborhood ||
  offer.address?.neighborhood ||
  offer.address?.Neighborhood ||
  "Bairro não informado";

const formatOfferAddress = (address) => {
  if (!address) {
    return "Endereço não informado";
  }

  const street = address.street || address.Street;
  const number = address.number || address.Number;
  const neighborhood = address.neighborhood || address.Neighborhood;
  const city = address.city || address.City;

  return [street, number, neighborhood, city].filter(Boolean).join(", ");
};

const formatDrawerAddressSummary = (address) => {
  if (!address) {
    return "Endereço não informado";
  }

  const neighborhood = address.neighborhood || address.Neighborhood;
  const city = address.city || address.City;

  return [neighborhood, city].filter(Boolean).join(", ") || "Endereço não informado";
};

const getEmailVerificationLabel = (isVerified) =>
  isVerified ? "E-mail verificado" : "E-mail não verificado";

const getEmailVerificationTagStyle = (isVerified) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.03em",
  background: isVerified ? "rgba(34, 197, 94, 0.18)" : "rgba(248, 113, 113, 0.18)",
  border: `1px solid ${isVerified ? "rgba(187, 247, 208, 0.8)" : "rgba(254, 202, 202, 0.8)"}`,
  color: "#fff",
  width: "fit-content",
});

const getOfferRooms = (offer) => {
  const rooms = offer?.address?.rooms || offer?.address?.Rooms || [];

  if (!Array.isArray(rooms)) {
    return [];
  }

  return rooms
    .map((room, index) => ({
      id: room?.id || room?.ID || `room-${index}`,
      name: String(room?.name || room?.Name || "").trim(),
      quantity: Number(room?.quantity || room?.Quantity || 0),
    }))
    .filter((room) => room.name && room.quantity > 0);
};

const getRoomIcon = (roomName) => {
  const normalizedName = String(roomName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedName.includes("banheiro") || normalizedName.includes("lavabo")) return "\uD83D\uDEBF";
  if (normalizedName.includes("quarto") || normalizedName.includes("suite")) return "\uD83D\uDED1\uFE0F";
  if (normalizedName.includes("cozinha")) return "\uD83C\uDF73";
  if (normalizedName.includes("sala")) return "\uD83D\uDECB\uFE0F";
  if (normalizedName.includes("area") || normalizedName.includes("lavanderia")) return "\uD83E\uDDFA";
  if (normalizedName.includes("escritorio")) return "\uD83D\uDCBC";
  if (normalizedName.includes("garagem")) return "\uD83D\uDE97";

  return "\uD83C\uDFE0";
};

const formatRoomCountLabel = (quantity) =>
  `${quantity} ${quantity === 1 ? "ambiente" : "ambientes"}`;

const formatRating = (rating) => {
  const numericRating = Number(rating || 0);
  if (!numericRating) {
    return "Sem avaliação";
  }

  return `${numericRating.toFixed(1)} \u2605`;
};

const formatAverageRatingText = (rating) => {
  const numericRating = Number(rating || 0);
  return numericRating > 0 ? numericRating.toFixed(1) : "0";
};

const formatDesiredFrequency = (value) => {
  const labels = {
    once: "Uma vez",
    weekly: "Semanal",
    biweekly: "Quinzenal",
    monthly: "Mensal",
    occasional: "Eventual",
  };

  return labels[String(value || "").toLowerCase()] || "Não informada";
};

const formatResidenceType = (value) => {
  const labels = {
    apartment: "Apartamento",
    house: "Casa",
    office: "Escritório",
    studio: "Studio",
  };

  return labels[String(value || "").toLowerCase()] || "Não informado";
};

const getDisplayOrderStatus = (offer) => {
  const serviceStatus = String(offer?.service_status || "").trim();
  if (serviceStatus) {
    return serviceStatus;
  }

  if (offer?.status === "aceita") {
    return "aceito";
  }

  if (offer?.status === "aberta") {
    return "pendente";
  }

  if (offer?.status === "negociacao") {
    return "negociação";
  }

  if (offer?.status === "cancelada") {
    return "cancelado";
  }

  return String(offer?.status || "");
};

const getStatusColor = (status) => {
  if (status === "pendente") {
    return "orange";
  }

  if (status === "aceita") {
    return "green";
  }

  return "red";
};

const DEFAULT_PAGINATION = {
  page: 1,
  page_size: 6,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_previous: false,
};

const ACCEPTED_OFFERS_PAGINATION = {
  ...DEFAULT_PAGINATION,
  page_size: 4,
};

const DEFAULT_DIARIST_NEGOTIATION_FILTERS = {
  search: "",
  maxDistance: 50,
  minCounterValue: null,
  maxCounterValue: null,
  onlyPending: false,
  sortBy: "recent",
};

const DEFAULT_NEGOTIATION_FILTERS = {
  search: "",
  minRating: 0,
  maxDistance: 50,
  minCounterValue: null,
  maxCounterValue: null,
  onlyPending: false,
  sortBy: "recommended",
};

const REALTIME_REFRESHABLE_EVENTS = new Set([
  "offer.created",
  "offer.updated",
  "negotiation.created",
  "negotiation.updated",
  "service.updated",
]);

const getRealtimeEventMessage = (eventType) => {
  switch (eventType) {
    case "offer.created":
      return "Nova oferta recebida em tempo real.";
    case "offer.updated":
      return "Uma oferta foi atualizada.";
    case "negotiation.created":
      return "Nova contraproposta recebida.";
    case "negotiation.updated":
      return "Uma contraproposta foi atualizada.";
    case "service.updated":
      return "Um serviço relacionado foi atualizado.";
    default:
      return "Atualização em tempo real recebida.";
  }
};

const getDefaultOfferDateTime = () => {
  const now = dayjs();
  const todayAtEight = now.hour(8).minute(0).second(0).millisecond(0);

  if (now.isBefore(todayAtEight)) {
    return todayAtEight;
  }

  return todayAtEight.add(1, "day");
};

const getReviewFieldValue = (review, ...keys) => {
  for (const key of keys) {
    if (review?.[key] !== undefined && review?.[key] !== null) {
      return review[key];
    }
  }

  return undefined;
};

const hasRenderableReviewFeedback = (review, role) => {
  const isClient = role === "cliente";
  const rating = Number(
    getReviewFieldValue(
      review,
      isClient ? "diarist_rating" : "client_rating",
      isClient ? "DiaristRating" : "ClientRating",
      "rating",
      "Rating",
    ) || 0,
  );
  const comment = String(
    getReviewFieldValue(
      review,
      isClient ? "diarist_comment" : "client_comment",
      isClient ? "DiaristComment" : "ClientComment",
      "comment",
      "Comment",
    ) || "",
  ).trim();

  return rating > 0 || comment.length > 0;
};

const getReviewDisplayRating = (review, role) =>
  Number(
    getReviewFieldValue(
      review,
      role === "cliente" ? "diarist_rating" : "client_rating",
      role === "cliente" ? "DiaristRating" : "ClientRating",
      "rating",
      "Rating",
    ) || 0,
  );

const getReviewDisplayComment = (review, role) =>
  String(
    getReviewFieldValue(
      review,
      role === "cliente" ? "diarist_comment" : "client_comment",
      role === "cliente" ? "DiaristComment" : "ClientComment",
      "comment",
      "Comment",
    ) || "",
  ).trim();

const OFFER_START_HOUR = 8;
const OFFER_END_HOUR = 20;
const OFFER_SERVICE_TYPES = [
  "Limpeza padrão",
  "Limpeza pesada",
  "Pós-obra",
  "Passadoria",
];

const OFFER_TIME_OPTIONS = Array.from(
  { length: (OFFER_END_HOUR - OFFER_START_HOUR) * 2 + 1 },
  (_, index) => {
    const totalMinutes = OFFER_START_HOUR * 60 + index * 30;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minute = String(totalMinutes % 60).padStart(2, "0");
    return `${hour}:${minute}`;
  },
);

const formatDateInputValue = (value) => dayjs(value).format("YYYY-MM-DD");

const buildOfferSchedule = (serviceDate, serviceTime) => {
  const [hours, minutes] = String(serviceTime || "08:00")
    .split(":")
    .map((value) => Number(value));

  return dayjs(serviceDate)
    .hour(hours || 0)
    .minute(minutes || 0)
    .second(0)
    .millisecond(0);
};

const getApiErrorMessage = async (response, fallbackMessage) => {
  try {
    const jsonResponse = await response.clone().json();
    const validationErrors = Array.isArray(jsonResponse?.errors)
      ? jsonResponse.errors
      : [];

    if (validationErrors.length > 0) {
      const fieldMessages = validationErrors
        .map(({ field, reason }) => {
          if (typeof reason === "string" && reason.trim()) {
            if (
              reason !== "must be greater than zero" &&
              reason !== "is too long" &&
              reason !== "body is required"
            ) {
              return reason.trim();
            }
          }

          switch (field) {
            case "counter_value":
              return "Informe um valor de contraproposta maior que zero.";
            case "counter_duration_hours":
              return "Não foi possível identificar a duração da oferta. Atualize a página e tente novamente.";
            case "message":
              return reason === "is too long"
                ? "A mensagem da contraproposta ficou longa demais."
                : "Revise a mensagem da contraproposta.";
            case "body":
              return "Não conseguimos processar os dados enviados. Tente novamente.";
            default:
              return `${field}: ${reason}`;
          }
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

    if (Array.isArray(jsonMessage) && jsonMessage.length > 0) {
      return jsonMessage.join("\n");
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
};

const getApiErrorPayload = async (response, fallbackMessage) => {
  try {
    const jsonResponse = await response.clone().json();
    return {
      message:
        jsonResponse?.message ||
        jsonResponse?.error ||
        jsonResponse?.detail ||
        jsonResponse?.details ||
        jsonResponse?.Message ||
        jsonResponse?.Error ||
        fallbackMessage,
      errors: Array.isArray(jsonResponse?.errors) ? jsonResponse.errors : [],
    };
  } catch (_error) {
  }

  try {
    const textResponse = await response.clone().text();
    return {
      message: textResponse?.trim() || fallbackMessage,
      errors: [],
    };
  } catch (_error) {
  }

  return {
    message: fallbackMessage,
    errors: [],
  };
};

const OffersBoard = () => {
  const { userRole, selectedAddress, address } = useAddress();
  const { isDiaristOnline } = useOnlinePresence();
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [acceptedOffers, setAcceptedOffers] = useState([]);
  const [offersPagination, setOffersPagination] = useState(DEFAULT_PAGINATION);
  const [pendingOffersPagination, setPendingOffersPagination] =
    useState(DEFAULT_PAGINATION);
  const [acceptedOffersPagination, setAcceptedOffersPagination] = useState(
    ACCEPTED_OFFERS_PAGINATION,
  );
  const [diaristTab, setDiaristTab] = useState("offers");
  const [hasLoadedNegotiations, setHasLoadedNegotiations] = useState(false);
  const [hasLoadedAcceptedOffers, setHasLoadedAcceptedOffers] = useState(false);
  const [clientOffersTab, setClientOffersTab] = useState("pendentes");
  const [negotiations, setNegotiations] = useState([]);
  const [negotiationsPagination, setNegotiationsPagination] =
    useState(DEFAULT_PAGINATION);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [counterModal, setCounterModal] = useState({
    open: false,
    offerId: null,
    durationHours: null,
  });
  const [counterModalError, setCounterModalError] = useState("");
  const [actionErrorModal, setActionErrorModal] = useState({
    open: false,
    title: "",
    content: "",
  });
  const [loading, setLoading] = useState(false);
  const [profileDrawerVisible, setProfileDrawerVisible] = useState(false);
  const [reviewsDrawerVisible, setReviewsDrawerVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [allReviews, setAllReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [counterSubmitting, setCounterSubmitting] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [expandedNegotiations, setExpandedNegotiations] = useState({});
  const [expandedDiaristOffers, setExpandedDiaristOffers] = useState({});
  const [expandedClientOffers, setExpandedClientOffers] = useState({});
  const [
    diaristNegotiationFiltersVisible,
    setDiaristNegotiationFiltersVisible,
  ] = useState(false);
  const [diaristNegotiationFilters, setDiaristNegotiationFilters] = useState(
    DEFAULT_DIARIST_NEGOTIATION_FILTERS,
  );
  const [negotiationFiltersByOffer, setNegotiationFiltersByOffer] = useState(
    {},
  );
  const [openNegotiationFilters, setOpenNegotiationFilters] = useState({});
  const offersCacheRef = React.useRef({});
  const pendingOffersCacheRef = React.useRef({});
  const acceptedOffersCacheRef = React.useRef({});
  const negotiationsCacheRef = React.useRef({});
  const realtimeStateRef = React.useRef({
    userRole,
    diaristTab,
    clientOffersTab,
    offersPage: offersPagination.page,
    negotiationsPage: negotiationsPagination.page,
    pendingOffersPage: pendingOffersPagination.page,
    acceptedOffersPage: acceptedOffersPagination.page,
  });
  const [form] = Form.useForm();
  const [counterForm] = Form.useForm();
  const [isTabSwitchPending, startTabSwitchTransition] = useTransition();
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const hasRegisteredAddress = Array.isArray(address) && address.length > 0;
  const selectedOfferDate = Form.useWatch("serviceDate", form);
  const counterDurationLocked = Number(counterModal.durationHours || 0) >= 8;

  const showActionErrorModal = (title, content) => {
    setActionErrorModal({
      open: true,
      title,
      content: content || "Tivemos um problema ao concluir esta ação.",
    });
  };

  const offerTimeOptions = useMemo(() => {
    const now = dayjs();

    return OFFER_TIME_OPTIONS.map((timeValue) => {
      const scheduledAt = selectedOfferDate
        ? buildOfferSchedule(selectedOfferDate, timeValue)
        : null;

      return {
        value: timeValue,
        label: timeValue,
        disabled:
          !selectedOfferDate ||
          !scheduledAt ||
          scheduledAt.isBefore(now) ||
          scheduledAt.hour() < OFFER_START_HOUR ||
          scheduledAt.hour() > OFFER_END_HOUR,
      };
    });
  }, [selectedOfferDate]);

  const openCreateOfferModal = () => {
    const defaultDateTime = getDefaultOfferDateTime();

    form.resetFields();
    form.setFieldsValue({
      serviceType: "Limpeza padrão",
      serviceDate: formatDateInputValue(defaultDateTime),
      serviceTime: defaultDateTime.format("HH:mm"),
      observations: "",
    });
    setIsCreateOpen(true);
  };

  useEffect(() => {
    if (!selectedOfferDate) {
      return;
    }

    const currentTime = form.getFieldValue("serviceTime");
    const currentOption = offerTimeOptions.find(
      (option) => option.value === currentTime,
    );

    if (currentOption && !currentOption.disabled) {
      return;
    }

    const nextAvailableTime = offerTimeOptions.find(
      (option) => !option.disabled,
    )?.value;

    form.setFieldsValue({
      serviceTime: nextAvailableTime || undefined,
    });
  }, [form, offerTimeOptions, selectedOfferDate]);

  const clearOffersCache = React.useCallback((scope = "all") => {
    if (scope === "all" || scope === "offers") {
      offersCacheRef.current = {};
    }
    if (scope === "all" || scope === "pending") {
      pendingOffersCacheRef.current = {};
    }
    if (scope === "all" || scope === "accepted") {
      acceptedOffersCacheRef.current = {};
    }
    if (scope === "all" || scope === "negotiations") {
      negotiationsCacheRef.current = {};
    }
  }, []);

  const fetchOpenOffers = React.useCallback(async (page = 1, force = false) => {
    const cachedPayload = !force ? offersCacheRef.current[page] : null;
    if (cachedPayload) {
      setOffers(cachedPayload.items);
      setOffersPagination(cachedPayload.pagination);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch(`/offers?page=${page}&page_size=6`, {
        authenticated: true,
      });

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const pagination = data?.pagination || DEFAULT_PAGINATION;
        offersCacheRef.current[page] = { items, pagination };
        setOffers(items);
        setOffersPagination(pagination);
      }
    } catch (error) {
      console.error("Erro ao buscar ofertas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyOffers = React.useCallback(
    async (statusGroup = "pending", page = 1, force = false) => {
      const cacheRef =
        statusGroup === "accepted"
          ? acceptedOffersCacheRef
          : pendingOffersCacheRef;
      const cachedPayload = !force ? cacheRef.current[page] : null;
      if (cachedPayload) {
        if (statusGroup === "accepted") {
          setAcceptedOffers(cachedPayload.items);
          setAcceptedOffersPagination(cachedPayload.pagination);
          setHasLoadedAcceptedOffers(true);
        } else {
          setPendingOffers(cachedPayload.items);
          setPendingOffersPagination(cachedPayload.pagination);
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const pageSize = statusGroup === "accepted" ? 4 : 6;

        const response = await apiFetch(
          `/offers/my?status_group=${statusGroup}&page=${page}&page_size=${pageSize}`,
          {
            authenticated: true,
          },
        );

        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          if (statusGroup === "accepted") {
            const pagination = data?.pagination || ACCEPTED_OFFERS_PAGINATION;
            acceptedOffersCacheRef.current[page] = { items, pagination };
            setAcceptedOffers(items);
            setAcceptedOffersPagination(pagination);
          } else {
            const pagination = data?.pagination || DEFAULT_PAGINATION;
            pendingOffersCacheRef.current[page] = { items, pagination };
            setPendingOffers(items);
            setPendingOffersPagination(pagination);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar minhas ofertas:", error);
      } finally {
        if (statusGroup === "accepted") {
          setHasLoadedAcceptedOffers(true);
        }
        setLoading(false);
      }
    },
    [],
  );

  const fetchNegotiations = React.useCallback(
    async (page = 1, force = false) => {
      const cachedPayload = !force ? negotiationsCacheRef.current[page] : null;
      if (cachedPayload) {
        setNegotiations(cachedPayload.items);
        setNegotiationsPagination(cachedPayload.pagination);
        setHasLoadedNegotiations(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiFetch(
          `/negotiations/my?page=${page}&page_size=6`,
          {
            authenticated: true,
          },
        );

        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          const pagination = data?.pagination || DEFAULT_PAGINATION;
          negotiationsCacheRef.current[page] = { items, pagination };
          setNegotiations(items);
          setNegotiationsPagination(pagination);
        }
      } catch (error) {
        console.error("Erro ao buscar negociacoes:", error);
      } finally {
        setHasLoadedNegotiations(true);
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    realtimeStateRef.current = {
      userRole,
      diaristTab,
      clientOffersTab,
      offersPage: offersPagination.page,
      negotiationsPage: negotiationsPagination.page,
      pendingOffersPage: pendingOffersPagination.page,
      acceptedOffersPage: acceptedOffersPagination.page,
    };
  }, [
    userRole,
    diaristTab,
    clientOffersTab,
    offersPagination.page,
    negotiationsPagination.page,
    pendingOffersPagination.page,
    acceptedOffersPagination.page,
  ]);

  const refreshVisibleRealtimeData = React.useCallback(async () => {
    const state = realtimeStateRef.current;
    clearOffersCache("all");

    if (state.userRole === "diarista") {
      if (state.diaristTab === "negotiations") {
        await fetchNegotiations(state.negotiationsPage || 1, true);
        return;
      }

      if (!hasRegisteredAddress) {
        setOffers([]);
        setOffersPagination(DEFAULT_PAGINATION);
        return;
      }

      await fetchOpenOffers(state.offersPage || 1, true);
      return;
    }

    if (state.clientOffersTab === "aceitas") {
      await fetchMyOffers("accepted", state.acceptedOffersPage || 1, true);
      return;
    }

    await fetchMyOffers("pending", state.pendingOffersPage || 1, true);
  }, [clearOffersCache, fetchMyOffers, fetchNegotiations, fetchOpenOffers, hasRegisteredAddress]);

  useEffect(() => {
    if (userRole === "diarista") {
      if (diaristTab === "negotiations") {
        fetchNegotiations(negotiationsPagination.page);
      } else if (hasRegisteredAddress) {
        fetchOpenOffers(offersPagination.page);
      } else {
        setOffers([]);
        setOffersPagination(DEFAULT_PAGINATION);
        setLoading(false);
      }
    } else if (userRole === "cliente") {
      if (clientOffersTab === "aceitas") {
        fetchMyOffers("accepted", acceptedOffersPagination.page);
      } else {
        fetchMyOffers("pending", pendingOffersPagination.page);
      }
    }
  }, [
    userRole,
    diaristTab,
    clientOffersTab,
    offersPagination.page,
    negotiationsPagination.page,
    pendingOffersPagination.page,
    acceptedOffersPagination.page,
    fetchOpenOffers,
    fetchMyOffers,
    fetchNegotiations,
    hasRegisteredAddress,
  ]);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) {
        return;
      }

      socket = createAuthenticatedWebSocket("/api/ws/offers");
      if (!socket) {
        return;
      }

      socket.onopen = () => {
        reconnectAttempts = 0;
        socket.send(JSON.stringify({ type: "client.ping" }));
      };

      socket.onmessage = async (event) => {
        try {
          const parsedEvent = JSON.parse(event.data);
          if (!REALTIME_REFRESHABLE_EVENTS.has(parsedEvent?.type)) {
            return;
          }

          message.open({
            key: `offers-realtime-${parsedEvent.type}`,
            type: "info",
            content: getRealtimeEventMessage(parsedEvent.type),
            duration: 2,
          });

          await refreshVisibleRealtimeData();
        } catch (error) {
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (isUnmounted) {
          return;
        }

        reconnectAttempts += 1;
        const nextDelay = Math.min(
          5000,
          1000 * 2 ** Math.min(reconnectAttempts, 3),
        );
        reconnectTimer = setTimeout(connect, nextDelay);
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [refreshVisibleRealtimeData]);

  const handleCreate = async (values) => {
    try {
      setCreateSubmitting(true);
      const selectedAddressId = selectedAddress?.ID || selectedAddress?.id;
      const scheduledAt = buildOfferSchedule(
        values.serviceDate,
        values.serviceTime,
      );

      if (!selectedAddress || !selectedAddressId) {
        message.error("Por favor, selecione um endereço no topo da página.");
        return;
      }

      if (!scheduledAt.isValid() || scheduledAt.isBefore(dayjs())) {
        message.error("Selecione uma data e horário válidos.");
        return;
      }

      const offerData = {
        service_type: values.serviceType || "Limpeza padrão",
        scheduled_at: scheduledAt.toISOString(),
        duration_hours: values.hours,
        initial_value: values.value,
        address_id: selectedAddressId,
        observations: values.observations || "",
      };

      const response = await apiFetch("/offers", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(offerData),
      });

      if (response.ok) {
        message.success("Oferta criada com sucesso!");
        form.resetFields();
        setIsCreateOpen(false);
        clearOffersCache("pending");
        if (clientOffersTab === "aceitas") {
          setAcceptedOffersPagination((prev) => ({ ...prev, page: 1 }));
          fetchMyOffers("accepted", 1, true);
        } else {
          setPendingOffersPagination((prev) => ({ ...prev, page: 1 }));
          fetchMyOffers("pending", 1, true);
        }
      } else {
        message.error("Erro ao criar oferta");
      }
    } catch (error) {
      console.error("Erro:", error);
      message.error("Não foi possível criar a oferta.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    try {
      setActionLoadingKey(`accept-offer-${offerId}`);
      const response = await apiFetch(`/offers/${offerId}/accept`, {
        method: "POST",
        authenticated: true,
      });

      if (response.ok) {
        message.success("Oferta aceita com sucesso!");
        clearOffersCache("offers");
        setOffers((prev) => prev.filter((offer) => offer.id !== offerId));
        startTransition(() => {
          navigate("/services");
        });
      } else {
        const errorMessage = await getApiErrorMessage(
          response,
          "Não foi possível aceitar a oferta.",
        );
        showActionErrorModal("Erro ao aceitar oferta", errorMessage);
      }
    } catch (error) {
      console.error("Erro:", error);
      showActionErrorModal(
        "Erro ao aceitar oferta",
        error?.message || "Não foi possível aceitar a oferta.",
      );
    } finally {
      setActionLoadingKey("");
    }
  };

  const openCounterModal = (offerId) => {
    const selectedOffer = offers.find((offer) => offer.id === offerId);
    const defaultDurationHours = Number(selectedOffer?.duration_hours || 0);
    setCounterModalError("");
    counterForm.setFields([
      { name: "counterValue", errors: [] },
      { name: "counterDurationHours", errors: [] },
      { name: "message", errors: [] },
    ]);
    counterForm.setFieldsValue({
      counterValue: Number(selectedOffer?.initial_value || 0),
      counterDurationHours: defaultDurationHours > 0 ? defaultDurationHours : 1,
      message: "",
    });
    setCounterModal({
      open: true,
      offerId,
      durationHours: defaultDurationHours,
    });
  };

  const handleSendCounter = async () => {
    try {
      setCounterSubmitting(true);
      setCounterModalError("");
      counterForm.setFields([
        { name: "counterValue", errors: [] },
        { name: "counterDurationHours", errors: [] },
        { name: "message", errors: [] },
      ]);
      const values = await counterForm.validateFields();

      const response = await apiFetch(
        `/offers/${counterModal.offerId}/negotiate`,
        {
          method: "POST",
          authenticated: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            counter_value: values.counterValue,
            counter_duration_hours: Number(values.counterDurationHours || 0),
            message: values.message || "",
          }),
        },
      );

      if (response.ok) {
        message.success("Contraproposta enviada!");
        counterForm.resetFields();
        setCounterModalError("");
        setCounterModal({ open: false, offerId: null, durationHours: null });
        clearOffersCache("offers");
        clearOffersCache("negotiations");
        setOffersPagination((prev) => ({ ...prev, page: 1 }));
        fetchOpenOffers(1, true);
      } else {
        const errorPayload = await getApiErrorPayload(
          response,
          "Não foi possível enviar a contraproposta.",
        );
        const fieldNameMap = {
          counter_value: "counterValue",
          counter_duration_hours: "counterDurationHours",
          message: "message",
        };
        const fieldErrors = Array.isArray(errorPayload.errors)
          ? errorPayload.errors
              .map(({ field, reason }) => {
                const mappedName = fieldNameMap[field];
                if (!mappedName || !reason) {
                  return null;
                }

                return {
                  name: mappedName,
                  errors: [String(reason).trim()],
                };
              })
              .filter(Boolean)
          : [];

        if (fieldErrors.length > 0) {
          counterForm.setFields(fieldErrors);
        }

        const generalMessage = await getApiErrorMessage(
          response,
          "Não foi possível enviar a contraproposta.",
        );

        if (fieldErrors.length === 0) {
          const normalizedGeneralMessage = String(generalMessage || "").toLowerCase();
          const inferredFieldErrors = [];

          if (
            normalizedGeneralMessage.includes("valor da contraproposta") ||
            normalizedGeneralMessage.includes("valor maior que zero")
          ) {
            inferredFieldErrors.push({
              name: "counterValue",
              errors: [generalMessage],
            });
          }

          if (
            normalizedGeneralMessage.includes("duração") ||
            normalizedGeneralMessage.includes("duracao")
          ) {
            inferredFieldErrors.push({
              name: "counterDurationHours",
              errors: [generalMessage],
            });
          }

          if (normalizedGeneralMessage.includes("mensagem")) {
            inferredFieldErrors.push({
              name: "message",
              errors: [generalMessage],
            });
          }

          if (inferredFieldErrors.length > 0) {
            counterForm.setFields(inferredFieldErrors);
            setCounterModalError("");
            return;
          }
        }

        setCounterModalError(generalMessage);
      }
    } catch (error) {
      console.error("Erro:", error);
      if (Array.isArray(error?.errorFields) && error.errorFields.length > 0) {
        const validationMessage = error.errorFields[0]?.errors?.[0];
        setCounterModalError(
          validationMessage || "Revise os campos antes de enviar a contraproposta.",
        );
      } else {
        setCounterModalError(
          error?.message || "Não foi possível enviar a contraproposta.",
        );
      }
    } finally {
      setCounterSubmitting(false);
    }
  };

  const handleAcceptNegotiation = async (offerId, negotiationId) => {
    try {
      setActionLoadingKey(`accept-negotiation-${negotiationId}`);
      const response = await apiFetch(
        `/offers/${offerId}/negotiate/${negotiationId}/accept`,
        {
          method: "PUT",
          authenticated: true,
        },
      );

      if (response.ok) {
        message.success("Contraproposta aceita!");
        clearOffersCache("accepted");
        clearOffersCache("pending");
        startTransition(() => {
          navigate("/services");
        });
      } else {
        message.error("Erro ao aceitar contraproposta");
      }
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleRejectNegotiation = async (offerId, negotiationId) => {
    const reason = window.prompt("Informe o motivo da recusa:") || "";
    if (!reason.trim()) {
      return;
    }

    try {
      setActionLoadingKey(`reject-negotiation-${negotiationId}`);
      const response = await apiFetch(
        `/offers/${offerId}/negotiate/${negotiationId}/reject`,
        {
          method: "PUT",
          authenticated: true,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );

      if (response.ok) {
        message.success("Contraproposta recusada");
        clearOffersCache("pending");
        clearOffersCache("accepted");
        if (clientOffersTab === "aceitas") {
          setAcceptedOffersPagination((prev) => ({ ...prev, page: 1 }));
          fetchMyOffers("accepted", 1, true);
        } else {
          setPendingOffersPagination((prev) => ({ ...prev, page: 1 }));
          fetchMyOffers("pending", 1, true);
        }
      } else {
        message.error("Erro ao recusar contraproposta");
      }
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleCancelOffer = async (offerId) => {
    const reason = window.prompt("Informe o motivo do cancelamento:") || "";
    if (!reason.trim()) {
      return;
    }

    try {
      setActionLoadingKey(`cancel-offer-${offerId}`);
      const response = await apiFetch(`/offers/${offerId}/cancel`, {
        method: "PUT",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (response.ok) {
        message.success("Oferta cancelada");
        clearOffersCache("pending");
        setPendingOffersPagination((prev) => ({ ...prev, page: 1 }));
        fetchMyOffers("pending", 1, true);
      } else {
        message.error("Erro ao cancelar oferta");
      }
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setActionLoadingKey("");
    }
  };

  const renderReviewStars = (rating) =>
    Array.from({ length: 5 }, (_, i) => (
      <StarFilled
        key={i}
        style={{
          color: i < rating ? "#FFD700" : "#e5e7eb",
          fontSize: 14,
        }}
      />
    ));

  const loadDiaristReviews = async (diaristId) => {
    setReviewsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        buildApiPathUrl(`/diarist-reviews/${diaristId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setAllReviews(Array.isArray(data) ? data : []);
      } else {
        setAllReviews([]);
      }
    } catch (error) {
      console.error("Erro ao buscar avaliacoes da diarista:", error);
      setAllReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openDiaristProfileDrawer = async (negotiation) => {
    const negotiationDiarist =
      negotiation.diarist ||
      negotiation.Diarist ||
      {};
    const embeddedDiaristProfile =
      negotiation.diarist_profile ||
      negotiation.DiaristProfile ||
      negotiationDiarist.diarist_profile ||
      negotiationDiarist.DiaristProfile ||
      {};
    const diaristName =
      negotiationDiarist.name ||
      negotiationDiarist.Name ||
      `Diarista #${negotiation.diarist_id}`;
    const diaristPhoto =
      negotiationDiarist.photo ||
      negotiationDiarist.Photo ||
      "https://placehold.co/160x160?text=Diarista";
    const diaristProfileId =
      embeddedDiaristProfile.id ||
      embeddedDiaristProfile.ID ||
      null;

    let fetchedProfile = null;
    try {
      setProfileLoading(true);
      if (diaristProfileId) {
        const response = await apiFetch(`/diarists/${diaristProfileId}`, {
          authenticated: true,
        });

        if (response.ok) {
          fetchedProfile = await response.json();
        }
      }
    } catch (error) {
      console.error("Erro ao buscar perfil atualizado da diarista:", error);
    } finally {
      setProfileLoading(false);
    }

    const diaristProfile =
      fetchedProfile ||
      embeddedDiaristProfile ||
      {};

    const drawerProfile = {
      id: negotiation.diarist_id,
      name: diaristName,
      photo: diaristPhoto,
      emailVerified: Boolean(
        negotiationDiarist.EmailVerified ?? negotiationDiarist.email_verified,
      ),
      average_rating: Number(negotiation.diarist_rating || 0),
      total_reviews: Number(negotiation.diarist_total_reviews || 0),
      distance: formatDistance(negotiation.diarist_distance),
      bio: diaristProfile.Bio || diaristProfile.bio || "",
      experienceYears:
        diaristProfile.ExperienceYears ||
        diaristProfile.experience_years ||
        0,
      pricePerHour:
        diaristProfile.PricePerHour || diaristProfile.price_per_hour || 0,
      pricePerDay:
        diaristProfile.PricePerDay || diaristProfile.price_per_day || 0,
      available:
        typeof diaristProfile.Available === "boolean"
          ? diaristProfile.Available
          : typeof diaristProfile.available === "boolean"
            ? diaristProfile.available
            : null,
      specialties: parseSpecialties(
        diaristProfile.Specialties || diaristProfile.specialties,
      ),
      address: negotiationDiarist.Address || negotiationDiarist.address || [],
    };

    setSelectedProfile(drawerProfile);
    setProfileDrawerVisible(true);
    setReviewsDrawerVisible(false);
    loadDiaristReviews(negotiation.diarist_id);
  };

  const openClientProfileDrawer = async (offer) => {
    const clientName = offer.client_name || `Cliente #${offer.client_id}`;
    const clientPhoto =
      offer.client_photo || "https://placehold.co/160x160?text=Cliente";
    const fallbackProfile = {
      id: offer.client_id,
      role: "cliente",
      name: clientName,
      photo: clientPhoto,
      emailVerified: false,
      average_rating: Number(offer.client_rating || 0),
      total_reviews: Number(offer.client_total_reviews || 0),
      distance: formatDistance(offer.distance),
      bio: offer.observations || "",
      experienceYears: 0,
      pricePerHour: 0,
      pricePerDay: 0,
      available: null,
      specialties: [],
      address: offer.address ? [offer.address] : [],
      residenceType: "",
      desiredFrequency: "",
      hasPets: null,
    };

    setProfileLoading(true);
    setAllReviews([]);
    setReviewsDrawerVisible(false);

    let fetchedProfile = null;

    try {
      const response = await apiFetch(`/offers/${offer.id}/client-profile`, {
        authenticated: true,
      });

      if (response.ok) {
        fetchedProfile = await response.json();
      } else {
        fetchedProfile = null;
      }
    } catch (error) {
      console.error("Erro ao buscar perfil da cliente:", error);
      fetchedProfile = null;
    } finally {
      setProfileLoading(false);
    }

    const clientProfile =
      fetchedProfile?.user_profile ||
      fetchedProfile?.UserProfile ||
      {};

    const profileAddresses =
      fetchedProfile?.address ||
      fetchedProfile?.Address ||
      (offer.address ? [offer.address] : []);
    const primaryProfileAddress = Array.isArray(profileAddresses)
      ? profileAddresses[0]
      : profileAddresses;

    const drawerProfile = {
      ...fallbackProfile,
      name: fetchedProfile?.name || fetchedProfile?.Name || clientName,
      photo: fetchedProfile?.photo || fetchedProfile?.Photo || clientPhoto,
      emailVerified: Boolean(
        fetchedProfile?.email_verified ?? fetchedProfile?.EmailVerified,
      ),
      average_rating: Number(
        fetchedProfile?.average_rating || offer.client_rating || 0,
      ),
      total_reviews: Number(
        fetchedProfile?.total_reviews || offer.client_total_reviews || 0,
      ),
      distance: formatDistance(fetchedProfile?.distance ?? offer.distance),
      bio: fetchedProfile?.observations || offer.observations || "",
      experienceYears: 0,
      pricePerHour: 0,
      pricePerDay: 0,
      available: null,
      specialties: [],
      address: profileAddresses,
      residenceType:
        primaryProfileAddress?.residence_type ||
        primaryProfileAddress?.ResidenceType ||
        clientProfile.ResidenceType || clientProfile.residence_type || "",
      desiredFrequency:
        clientProfile.DesiredFrequency || clientProfile.desired_frequency || "",
      hasPets:
        typeof clientProfile.HasPets === "boolean"
          ? clientProfile.HasPets
          : typeof clientProfile.has_pets === "boolean"
            ? clientProfile.has_pets
            : null,
    };

    const fetchedReviews =
      fetchedProfile?.reviews ||
      fetchedProfile?.Reviews ||
      fetchedProfile?.user_reviews ||
      fetchedProfile?.UserReviews ||
      [];

    setAllReviews(
      Array.isArray(fetchedReviews)
        ? fetchedReviews.filter((review) =>
            hasRenderableReviewFeedback(review, "cliente"),
          )
        : [],
    );
    setSelectedProfile(drawerProfile);
    setProfileDrawerVisible(true);
  };

  const closeProfileDrawer = () => {
    setProfileDrawerVisible(false);
    setSelectedProfile(null);
  };

  const openReviewsDrawer = () => {
    setReviewsDrawerVisible(true);
  };

  const closeReviewsDrawer = () => {
    setReviewsDrawerVisible(false);
  };

  const toggleNegotiationDropdown = (negotiationId) => {
    setExpandedNegotiations((prev) => ({
      ...prev,
      [negotiationId]: !prev[negotiationId],
    }));
  };

  const toggleDiaristOfferDropdown = (offerId) => {
    setExpandedDiaristOffers((prev) => ({
      ...prev,
      [offerId]: !prev[offerId],
    }));
  };

  const toggleClientOfferDropdown = (offerId) => {
    setExpandedClientOffers((prev) => ({
      ...prev,
      [offerId]: !prev[offerId],
    }));
  };

  const getNegotiationFilterCount = (filters) => {
    let count = 0;
    if (filters.search) count += 1;
    if (filters.minRating > 0) count += 1;
    if (filters.maxDistance < DEFAULT_NEGOTIATION_FILTERS.maxDistance)
      count += 1;
    if (filters.minCounterValue !== DEFAULT_NEGOTIATION_FILTERS.minCounterValue)
      count += 1;
    if (filters.maxCounterValue !== DEFAULT_NEGOTIATION_FILTERS.maxCounterValue)
      count += 1;
    if (filters.onlyPending) count += 1;
    if (filters.sortBy !== DEFAULT_NEGOTIATION_FILTERS.sortBy) count += 1;
    return count;
  };

  const getOfferNegotiationFilters = (offerId) =>
    negotiationFiltersByOffer[offerId] || DEFAULT_NEGOTIATION_FILTERS;

  const updateNegotiationFilter = (offerId, key, value) => {
    setNegotiationFiltersByOffer((prev) => ({
      ...prev,
      [offerId]: {
        ...(prev[offerId] || DEFAULT_NEGOTIATION_FILTERS),
        [key]: value,
      },
    }));
  };

  const resetNegotiationFilters = (offerId) => {
    setNegotiationFiltersByOffer((prev) => ({
      ...prev,
      [offerId]: DEFAULT_NEGOTIATION_FILTERS,
    }));
  };

  const toggleNegotiationFilters = (offerId) => {
    setOpenNegotiationFilters((prev) => ({
      ...prev,
      [offerId]: !prev[offerId],
    }));
  };

  const currentClientOffers =
    clientOffersTab === "aceitas" ? acceptedOffers : pendingOffers;
  const currentClientPagination =
    clientOffersTab === "aceitas"
      ? acceptedOffersPagination
      : pendingOffersPagination;

  const filterOfferNegotiations = (offer, filters) => {
    const query = String(filters.search || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const sortNegotiations = (items) => {
      return [...items].sort((a, b) => {
        const ratingA = Number(a.diarist_rating || 0);
        const ratingB = Number(b.diarist_rating || 0);
        const distanceA =
          a.diarist_distance === null || a.diarist_distance === undefined
            ? Number.POSITIVE_INFINITY
            : Number(a.diarist_distance);
        const distanceB =
          b.diarist_distance === null || b.diarist_distance === undefined
            ? Number.POSITIVE_INFINITY
            : Number(b.diarist_distance);
        const valueA = Number(a.counter_value || 0);
        const valueB = Number(b.counter_value || 0);

        switch (filters.sortBy) {
          case "rating":
            return ratingB - ratingA;
          case "distance":
            return distanceA - distanceB;
          case "price_low":
            return valueA - valueB;
          case "price_high":
            return valueB - valueA;
          default:
            return (
              ratingB * 3 -
              distanceB / 5 -
              valueB / 50 -
              (ratingA * 3 - distanceA / 5 - valueA / 50)
            );
        }
      });
    };

    const negotiationsForOffer = Array.isArray(offer.negotiations)
      ? offer.negotiations
      : [];
    const filteredNegotiations = negotiationsForOffer.filter((neg) => {
      const diaristName = String(
        neg.diarist?.name ||
          neg.diarist?.Name ||
          `Diarista ${neg.diarist_id || ""}`,
      )
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const messageText = String(neg.message || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const rating = Number(neg.diarist_rating || 0);
      const hasDistance =
        neg.diarist_distance !== null && neg.diarist_distance !== undefined;
      const distance = hasDistance ? Number(neg.diarist_distance) : null;
      const counterValue = Number(neg.counter_value || 0);

      return (
        (!query ||
          diaristName.includes(query) ||
          messageText.includes(query)) &&
        rating >= filters.minRating &&
        (!hasDistance || distance <= filters.maxDistance) &&
        (filters.minCounterValue === null ||
          counterValue >= filters.minCounterValue) &&
        (filters.maxCounterValue === null ||
          counterValue <= filters.maxCounterValue) &&
        (!filters.onlyPending || neg.status === "pendente")
      );
    });

    return sortNegotiations(filteredNegotiations);
  };

  const diaristNegotiationFilterCount = useMemo(() => {
    let count = 0;
    if (diaristNegotiationFilters.search) count += 1;
    if (
      diaristNegotiationFilters.maxDistance <
      DEFAULT_DIARIST_NEGOTIATION_FILTERS.maxDistance
    )
      count += 1;
    if (
      diaristNegotiationFilters.minCounterValue !==
      DEFAULT_DIARIST_NEGOTIATION_FILTERS.minCounterValue
    )
      count += 1;
    if (
      diaristNegotiationFilters.maxCounterValue !==
      DEFAULT_DIARIST_NEGOTIATION_FILTERS.maxCounterValue
    )
      count += 1;
    if (diaristNegotiationFilters.onlyPending) count += 1;
    if (
      diaristNegotiationFilters.sortBy !==
      DEFAULT_DIARIST_NEGOTIATION_FILTERS.sortBy
    )
      count += 1;
    return count;
  }, [diaristNegotiationFilters]);

  const filteredDiaristNegotiations = useMemo(() => {
    const query = String(diaristNegotiationFilters.search || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const filteredItems = negotiations.filter((neg) => {
      const clientName = String(neg.client_name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const messageText = String(neg.message || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const neighborhood = String(neg.address_neighborhood || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const distance =
        neg.distance === null || neg.distance === undefined
          ? Number.POSITIVE_INFINITY
          : Number(neg.distance);
      const counterValue = Number(neg.counter_value || 0);

      return (
        (!query ||
          clientName.includes(query) ||
          messageText.includes(query) ||
          neighborhood.includes(query)) &&
        distance <= diaristNegotiationFilters.maxDistance &&
        (diaristNegotiationFilters.minCounterValue === null ||
          counterValue >= diaristNegotiationFilters.minCounterValue) &&
        (diaristNegotiationFilters.maxCounterValue === null ||
          counterValue <= diaristNegotiationFilters.maxCounterValue) &&
        (!diaristNegotiationFilters.onlyPending || neg.status === "pendente")
      );
    });

    return [...filteredItems].sort((a, b) => {
      const distanceA =
        a.distance === null || a.distance === undefined
          ? Number.POSITIVE_INFINITY
          : Number(a.distance);
      const distanceB =
        b.distance === null || b.distance === undefined
          ? Number.POSITIVE_INFINITY
          : Number(b.distance);
      const valueA = Number(a.counter_value || 0);
      const valueB = Number(b.counter_value || 0);
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;

      switch (diaristNegotiationFilters.sortBy) {
        case "distance":
          return distanceA - distanceB;
        case "price_low":
          return valueA - valueB;
        case "price_high":
          return valueB - valueA;
        default:
          return dateB - dateA;
      }
    });
  }, [negotiations, diaristNegotiationFilters]);

  const handleDiaristTabChange = (tab) => {
    startTabSwitchTransition(() => {
      setDiaristTab(tab);
      if (tab === "negotiations") {
        setNegotiationsPagination((prev) => ({ ...prev, page: 1 }));
        return;
      }
      setOffersPagination((prev) => ({ ...prev, page: 1 }));
    });
  };

  const handleClientOffersTabChange = (tab) => {
    startTabSwitchTransition(() => {
      setClientOffersTab(tab);
      if (tab === "aceitas") {
        setAcceptedOffersPagination((prev) => ({ ...prev, page: 1 }));
        return;
      }
      setPendingOffersPagination((prev) => ({ ...prev, page: 1 }));
    });
  };

  const renderOfferCardForDiarist = (offer) => {
    const hasPendingNegotiation = Boolean(offer.has_pending_negotiation);
    const isOfferAvailableForNegotiation =
      offer.status === "aberta" || offer.status === "negociacao";
    const offerRooms = getOfferRooms(offer);
    const offerObservations = String(offer.observations || "").trim();
    const clientRating = Number(offer.client_rating || 0);
    const clientTotalReviews = Number(offer.client_total_reviews || 0);
    const isExpanded = Boolean(expandedDiaristOffers[offer.id]);

    return (
      <Card
        key={offer.id}
        className={`offer-card diarist-offer-card ${isExpanded ? "open" : "collapsed"}`}
      >
        <div
          className="diarist-offer-summary diarist-offer-summary-toggle"
          role="button"
          tabIndex={0}
          onClick={() => toggleDiaristOfferDropdown(offer.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleDiaristOfferDropdown(offer.id);
            }
          }}
          aria-expanded={isExpanded}
        >
          <div className="diarist-offer-main">
            <div className="negotiation-card-header">
              <div className="diarist-offer-header-shell">
                <div className="diarist-offer-header-main">
                  <img
                    className="diarist-offer-photo"
                    src={
                      offer.client_photo || "https://placehold.co/96x96?text=Cliente"
                  }
                  alt={offer.client_name || "Cliente"}
                />
                <div>
                  <span className="negotiation-card-label">Cliente</span>
                  <h3>{offer.client_name || "Cliente"}</h3>
                    <div className="diarist-offer-client-meta">
                      <span>{formatRating(clientRating)}</span>
                      <span>({clientTotalReviews} avaliações)</span>
                    </div>
                  </div>
                </div>
                <div className="diarist-offer-header-side">
                  <div className="offer-actions diarist-offer-actions diarist-offer-actions-top">
                    {isOfferAvailableForNegotiation && !hasPendingNegotiation && (
                      <Space>
                        <Button
                          className="offer-cta-btn offer-cta-btn-warning"
                          loading={
                            counterModal.open &&
                            counterModal.offerId === offer.id &&
                            counterSubmitting
                          }
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openCounterModal(offer.id);
                          }}
                        >
                          Fazer contraproposta
                        </Button>
                        <Button
                          type="primary"
                          className="offer-cta-btn offer-cta-btn-primary"
                          loading={actionLoadingKey === `accept-offer-${offer.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleAcceptOffer(offer.id);
                          }}
                        >
                          Aceitar Oferta
                        </Button>
                      </Space>
                    )}

                    {isOfferAvailableForNegotiation && hasPendingNegotiation && (
                      <Tag color="warning">Voc\u00ea j\u00e1 fez uma contraproposta</Tag>
                    )}
                  </div>
                  <Button
                    className="offer-cta-btn offer-cta-btn-profile diarist-offer-profile-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void openClientProfileDrawer(offer);
                    }}
                  >
                    Ver perfil
                  </Button>
                </div>
              </div>
            </div>

            <div className="diarist-offer-main-content">
              <div className="diarist-offer-chip-row">
                <span className="diarist-offer-chip">
                  {formatNeighborhood(offer)}
                </span>
                <span className="diarist-offer-chip">
                  {formatDistance(offer.distance)}
                </span>
              </div>

              <div className="diarist-offer-metrics diarist-offer-metrics-layout-two">
                <div className="diarist-offer-metric">
                  <span className="metric-label">Horas</span>
                  <strong>{Number(offer.duration_hours || 0)}h</strong>
                </div>
                <div className="diarist-offer-metric">
                  <span className="metric-label">Valor</span>
                  <strong>{formatCurrency(offer.initial_value)}</strong>
                </div>
              </div>

              <div className="diarist-offer-details">
                {offerObservations && (
                  <div className="diarist-offer-detail-card diarist-offer-detail-card-full">
                    <span className="diarist-offer-detail-label">Observações da cliente</span>
                    <p>{offerObservations}</p>
                  </div>
                )}

                <div className="diarist-offer-detail-card diarist-offer-detail-card-full">
                  <span className="diarist-offer-detail-label">Cômodos da residência</span>
                  {offerRooms.length > 0 ? (
                    <div className="diarist-offer-rooms-list">
                      {offerRooms.map((room) => (
                        <div key={room.id} className="diarist-offer-room-card">
                          <span className="diarist-offer-room-icon" aria-hidden="true">
                            {getRoomIcon(room.name)}
                          </span>
                          <div className="diarist-offer-room-copy">
                            <strong>{room.name}</strong>
                            <span>{formatRoomCountLabel(room.quantity)}</span>
                          </div>
                          <span className="diarist-offer-room-badge">{room.quantity}x</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <strong>Cômodos não informados</strong>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="diarist-offer-accordion-hint"
          role="button"
          tabIndex={0}
          onClick={() => toggleDiaristOfferDropdown(offer.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleDiaristOfferDropdown(offer.id);
            }
          }}
        >
          <span>
            {isExpanded ? "Clique para recolher" : "Clique para mais informações"}
          </span>
          <span
            className={`diarist-offer-accordion-chevron ${isExpanded ? "open" : ""}`}
          >
            <ArrowRightOutlined />
          </span>
        </div>

        <div className="offer-actions diarist-offer-actions diarist-offer-actions-bottom">
          {isOfferAvailableForNegotiation && !hasPendingNegotiation && (
            <Space>
              <Button
                type="primary"
                className="offer-cta-btn offer-cta-btn-primary"
                loading={actionLoadingKey === `accept-offer-${offer.id}`}
                onClick={() => handleAcceptOffer(offer.id)}
              >
                Aceitar oferta
              </Button>
              <Button
                className="offer-cta-btn offer-cta-btn-warning"
                loading={
                  counterModal.open &&
                  counterModal.offerId === offer.id &&
                  counterSubmitting
                }
                onClick={() => openCounterModal(offer.id)}
              >
                Fazer contraproposta
              </Button>
            </Space>
          )}

          {isOfferAvailableForNegotiation && hasPendingNegotiation && (
          <Tag color="warning">Você já fez uma contraproposta</Tag>
          )}
        </div>
      </Card>
    );
  };

  const renderNegotiationCardForDiarist = (neg) => {
    const rejectionReason = String(
      neg.rejection_reason || neg.RejectionReason || "",
    ).trim();

    return (
      <Card key={neg.id} className="offer-card negotiation-card">
        <div className="negotiation-card-header">
          <div className="negotiation-card-client">
            <img
              className="negotiation-card-photo"
              src={
                neg.client_photo || "https://placehold.co/96x96?text=Cliente"
              }
              alt={neg.client_name || "Cliente"}
            />
            <div>
              <span className="negotiation-card-label">Cliente</span>
              <h3>{neg.client_name || "Cliente"}</h3>
            </div>
          </div>
          <Tag color={getStatusColor(neg.status)}>
            {neg.status.toUpperCase()}
          </Tag>
        </div>

        <div className="negotiation-card-body">
          <div className="negotiation-card-main">
            <div className="negotiation-card-hero">
              <div className="negotiation-card-hero-meta">
                <span className="negotiation-card-date">
                  {neg.scheduled_at
                    ? dayjs(neg.scheduled_at).format("DD/MM/YYYY HH:mm")
                  : "Data não informada"}
                </span>
                <div className="negotiation-card-values">
                  <div className="negotiation-card-value-item">
                    <span className="metric-label">Valor inicial</span>
                    <strong>{formatCurrency(neg.initial_value)}</strong>
                  </div>
                  <div className="negotiation-card-value-item is-highlight">
                    <span className="metric-label">Valor ofertado</span>
                    <strong>{formatCurrency(neg.counter_value)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="negotiation-card-chips">
              <span className="diarist-offer-chip">
                        {neg.address_neighborhood || "Bairro não informado"}
              </span>
              <span className="diarist-offer-chip">
                {formatDistance(neg.distance)}
              </span>
              <span className="diarist-offer-chip">
                        {Number(neg.duration_hours || 0)}h de serviço
              </span>
            </div>
          </div>

          {neg.message && (
            <p className="negotiation-card-message">{neg.message}</p>
          )}

          {neg.status === "recusada" && rejectionReason && (
            <p className="negotiation-card-message">
              <strong>Motivo da recusa:</strong> {rejectionReason}
            </p>
          )}
        </div>
      </Card>
    );
  };

  const isClientProfile = selectedProfile?.role === "cliente";
  const visibleReviews = allReviews.filter((review) =>
    hasRenderableReviewFeedback(review, selectedProfile?.role),
  );
  const profileReviewCount = visibleReviews.length;
  const profileRooms = getOfferRooms({
    address: Array.isArray(selectedProfile?.address)
      ? selectedProfile.address[0]
      : null,
  });

  const renderOfferCardForClient = (offer) => {
    const negotiationFilters = getOfferNegotiationFilters(offer.id);
    const negotiationFilterCount =
      getNegotiationFilterCount(negotiationFilters);
    const filteredNegotiations = filterOfferNegotiations(
      offer,
      negotiationFilters,
    );
    const showNegotiationFilters = Boolean(openNegotiationFilters[offer.id]);
    const displayOrderStatus = getDisplayOrderStatus(offer);
    const offerStatusColor =
      displayOrderStatus === "pendente"
        ? "blue"
        : displayOrderStatus === "negociação"
          ? "orange"
          : displayOrderStatus === "cancelado"
            ? "red"
            : "green";
    const isOfferExpanded = Boolean(expandedClientOffers[offer.id]);
    const negotiationCount = Array.isArray(offer.negotiations)
      ? offer.negotiations.length
      : 0;
    const canCancelOffer =
      offer.status === "aberta" || offer.status === "negociacao";

    return (
      <Card key={offer.id} className="offer-card client-offer-card">
        <div className="client-offer-card-shell">
          <button
            type="button"
            className={`client-offer-toggle ${isOfferExpanded ? "open" : ""}`}
            onClick={() => toggleClientOfferDropdown(offer.id)}
            aria-expanded={isOfferExpanded}
          >
            <div className="client-offer-header">
              <div className="client-offer-heading">
                <span className="client-offer-eyebrow">Oferta publicada</span>
                <h3>{offer.service_type || "Serviço não informado"}</h3>
                <p>{dayjs(offer.scheduled_at).format("DD/MM/YYYY [as] HH:mm")}</p>
                <div className="client-offer-summary-inline">
                  <span>{Number(offer.duration_hours || 0)}h</span>
                  <span>{negotiationCount} contraproposta(s)</span>
                </div>
              </div>

              <div className="client-offer-header-side">
                <Tag className="client-offer-status-tag" color={offerStatusColor}>
                  {displayOrderStatus.toUpperCase()}
                </Tag>

                <div className="client-offer-current-value">
                  <span>Valor atual</span>
                  <strong>{formatCurrency(offer.current_value)}</strong>
                </div>

                <span
                  className={`client-offer-chevron ${isOfferExpanded ? "open" : ""}`}
                >
                  <ArrowRightOutlined />
                </span>
              </div>
            </div>
          </button>

          {isOfferExpanded && (
            <>
              <div className="client-offer-info-grid">
                <div className="client-offer-info-card">
                  <span className="client-offer-info-label">Duração</span>
                  <strong>{Number(offer.duration_hours || 0)}h</strong>
                </div>

                <div className="client-offer-info-card client-offer-info-card-full">
                  <span className="client-offer-info-label">Endereço</span>
                  <strong>{formatOfferAddress(offer.address)}</strong>
                </div>

                {offer.observations && (
                  <div className="client-offer-info-card client-offer-info-card-full">
                    <span className="client-offer-info-label">Observações</span>
                    <strong>{offer.observations}</strong>
                  </div>
                )}
              </div>

              {offer.negotiations && offer.negotiations.length > 0 && (
                <>
                  <div className="client-offer-negotiations-head">
                    <h4>Contrapropostas</h4>
                    <span>
                      {filteredNegotiations.length}
                      {offer.negotiations.length
                        ? ` de ${offer.negotiations.length}`
                        : ""}{" "}
                      visiveis
                    </span>
                  </div>

                  <div className="offer-card-filter-box">
                    <div className="offer-card-filter-bar">
                      <div className="offer-card-filter-copy">
                        <p>
                          {negotiationFilterCount > 0
                            ? `${negotiationFilterCount} filtro(s) ativo(s)`
                            : "Sem filtros ativos"}
                        </p>
                      </div>
                      <Button
                        icon={<FilterOutlined />}
                        className="offers-filter-trigger offer-card-filter-trigger"
                        onClick={() => toggleNegotiationFilters(offer.id)}
                      >
                        Filtrar
                      </Button>
                    </div>

                    {negotiationFilterCount > 0 && (
                      <div className="offers-active-filters offer-card-active-filters">
                        {negotiationFilters.search ? (
                          <Tag
                            closable
                            onClose={() =>
                              updateNegotiationFilter(offer.id, "search", "")
                            }
                          >
                            Busca: {negotiationFilters.search}
                          </Tag>
                        ) : null}
                        {negotiationFilters.minRating > 0 ? (
                          <Tag
                            closable
                            onClose={() =>
                              updateNegotiationFilter(offer.id, "minRating", 0)
                            }
                          >
                            Nota: {negotiationFilters.minRating}+
                          </Tag>
                        ) : null}
                        {negotiationFilters.maxDistance <
                        DEFAULT_NEGOTIATION_FILTERS.maxDistance ? (
                          <Tag
                            closable
                            onClose={() =>
                              updateNegotiationFilter(
                                offer.id,
                                "maxDistance",
                                DEFAULT_NEGOTIATION_FILTERS.maxDistance,
                              )
                            }
                          >
                            Distância: até {negotiationFilters.maxDistance} km
                          </Tag>
                        ) : null}
                        {negotiationFilters.minCounterValue !==
                        DEFAULT_NEGOTIATION_FILTERS.minCounterValue ? (
                          <Tag
                            closable
                            onClose={() =>
                              updateNegotiationFilter(
                                offer.id,
                                "minCounterValue",
                                DEFAULT_NEGOTIATION_FILTERS.minCounterValue,
                              )
                            }
                          >
                            Mínimo:{" "}
                            {formatCurrency(negotiationFilters.minCounterValue)}
                          </Tag>
                        ) : null}
                        {negotiationFilters.maxCounterValue !==
                        DEFAULT_NEGOTIATION_FILTERS.maxCounterValue ? (
                          <Tag
                            closable
                            onClose={() =>
                              updateNegotiationFilter(
                                offer.id,
                                "maxCounterValue",
                                DEFAULT_NEGOTIATION_FILTERS.maxCounterValue,
                              )
                            }
                          >
                            Máximo:{" "}
                            {formatCurrency(negotiationFilters.maxCounterValue)}
                          </Tag>
                        ) : null}
                        {negotiationFilters.onlyPending ? (
                          <Tag
                            closable
                            onClose={() =>
                              updateNegotiationFilter(offer.id, "onlyPending", false)
                            }
                          >
                            Somente pendentes
                          </Tag>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <Drawer
                    title="Filtros"
                    open={showNegotiationFilters}
                    onClose={() => toggleNegotiationFilters(offer.id)}
                    placement={isMobile ? "bottom" : "right"}
                    width={isMobile ? "100%" : 420}
                    height={isMobile ? "88%" : undefined}
                    className="offers-filters-drawer"
                  >
                    <div className="offers-filters-panel">
                      <div className="offers-filter-field">
                        <label>Buscar</label>
                        <Input
                          placeholder="Nome ou mensagem"
                          value={negotiationFilters.search}
                          onChange={(event) =>
                            updateNegotiationFilter(
                              offer.id,
                              "search",
                              event.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="offers-filter-field">
                        <label>Ordenar por</label>
                        <Select
                          getPopupContainer={(triggerNode) =>
                            triggerNode.parentElement
                          }
                          value={negotiationFilters.sortBy}
                          onChange={(value) =>
                            updateNegotiationFilter(offer.id, "sortBy", value)
                          }
                          options={[
                            { value: "recommended", label: "Melhor equilibrio" },
                            { value: "rating", label: "Maior avaliação" },
                            { value: "distance", label: "Menor distância" },
                            { value: "price_low", label: "Menor valor" },
                            { value: "price_high", label: "Maior valor" },
                          ]}
                        />
                      </div>

                      <div className="offers-filter-field">
                        <label>
                          Nota mínima: {negotiationFilters.minRating.toFixed(1)}
                        </label>
                        <Slider
                          min={0}
                          max={5}
                          step={0.5}
                          value={negotiationFilters.minRating}
                          onChange={(value) =>
                            updateNegotiationFilter(offer.id, "minRating", value)
                          }
                        />
                      </div>

                      <div className="offers-filter-field">
                        <label>
                          Distância máxima: {negotiationFilters.maxDistance} km
                        </label>
                        <Slider
                          min={1}
                          max={50}
                          step={1}
                          value={negotiationFilters.maxDistance}
                          onChange={(value) =>
                            updateNegotiationFilter(offer.id, "maxDistance", value)
                          }
                        />
                      </div>

                      <div className="offers-filter-field">
                        <label>Faixa de valor</label>
                        <div className="offers-filter-range-grid">
                          <div className="offers-filter-range-box">
                            <span>Mínimo</span>
                            <InputNumber
                              style={{ width: "100%" }}
                              min={0}
                              max={negotiationFilters.maxCounterValue ?? 999999}
                              value={negotiationFilters.minCounterValue}
                              onChange={(value) =>
                                updateNegotiationFilter(
                                  offer.id,
                                  "minCounterValue",
                                  value === null
                                    ? null
                                    : Math.min(
                                        Number(value),
                                        negotiationFilters.maxCounterValue ??
                                          Number.MAX_SAFE_INTEGER,
                                      ),
                                )
                              }
                            />
                          </div>
                          <div className="offers-filter-range-box">
                            <span>Máximo</span>
                            <InputNumber
                              style={{ width: "100%" }}
                              min={negotiationFilters.minCounterValue ?? 0}
                              max={999999}
                              value={negotiationFilters.maxCounterValue}
                              onChange={(value) =>
                                updateNegotiationFilter(
                                  offer.id,
                                  "maxCounterValue",
                                  value === null
                                    ? null
                                    : Math.max(
                                        Number(value),
                                        negotiationFilters.minCounterValue ?? 0,
                                      ),
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="offers-filter-checkbox">
                        <Checkbox
                          checked={negotiationFilters.onlyPending}
                          onChange={(event) =>
                            updateNegotiationFilter(
                              offer.id,
                              "onlyPending",
                              event.target.checked,
                            )
                          }
                        >
                          Mostrar apenas pendentes
                        </Checkbox>
                      </div>

                      <div className="offers-filter-drawer-footer">
                        <Button onClick={() => resetNegotiationFilters(offer.id)}>
                          Limpar tudo
                        </Button>
                        <Button
                          type="primary"
                          onClick={() => toggleNegotiationFilters(offer.id)}
                        >
                          Ver {filteredNegotiations.length} resultado(s)
                        </Button>
                      </div>
                    </div>
                  </Drawer>

                  {filteredNegotiations.length > 0 ? (
                    filteredNegotiations.map((neg) => {
                      const isExpanded = Boolean(expandedNegotiations[neg.id]);

                      return (
                        <div
                          key={neg.id}
                          className={`negotiation-item negotiation-item-compact ${isExpanded ? "open" : ""}`}
                        >
                          <div
                            className="negotiation-dropdown-trigger"
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleNegotiationDropdown(neg.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleNegotiationDropdown(neg.id);
                              }
                            }}
                            aria-expanded={isExpanded}
                          >
                            <div className="negotiation-item-top">
                              <div className="negotiation-item-header">
                                <div>
                                  <p className="negotiation-diarist-name">
                                    {neg.diarist?.name ||
                                      neg.diarist?.Name ||
                                      `Diarista #${neg.diarist_id}`}
                                  </p>
                                  <OnlineIndicator
                                    isOnline={isDiaristOnline(neg.diarist_id)}
                                    label={isDiaristOnline(neg.diarist_id) ? "Online" : "Offline"}
                                    className="offer-online-indicator"
                                  />
                                </div>
                                <div className="negotiation-item-meta">
                                  <span>{formatDistance(neg.diarist_distance)}</span>
                                  <span>{formatRating(neg.diarist_rating)}</span>
                                </div>
                              </div>

                              <div className="negotiation-header-side">
                                <Tag
                                  className="negotiation-status-tag"
                                  color={
                                    neg.status === "pendente"
                                      ? "orange"
                                      : neg.status === "aceita"
                                        ? "green"
                                        : "red"
                                  }
                                >
                                  {neg.status.toUpperCase()}
                                </Tag>
                                <span
                                  className={`negotiation-chevron ${isExpanded ? "open" : ""}`}
                                >
                                  <ArrowRightOutlined />
                                </span>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="negotiation-dropdown-content">
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                  gap: "12px",
                                }}
                              >
                                <div className="negotiation-proposed-value">
                                  <span className="client-offer-info-label">
                                    Valor proposto
                                  </span>
                                  <strong>{formatCurrency(neg.counter_value)}</strong>
                                </div>
                                <div className="negotiation-proposed-value">
                                  <span className="client-offer-info-label">
                                    Horas solicitadas
                                  </span>
                                  <strong>{Number(neg.counter_duration_hours || neg.duration_hours || 0)}h</strong>
                                </div>
                              </div>

                              {neg.message && (
                                <p className="negotiation-message-text">
                                  {neg.message}
                                </p>
                              )}

                              <div className="negotiation-item-actions">
                                <Button
                                  size="small"
                                  className="negotiation-profile-btn"
                                  loading={profileLoading}
                                  onClick={() => openDiaristProfileDrawer(neg)}
                                >
                                  Ver perfil completo
                                </Button>

                                {neg.status === "pendente" && (
                                  <Space
                                    className="negotiation-item-cta-group"
                                    style={{ marginTop: "12px" }}
                                  >
                                    <Button
                                      type="primary"
                                      className="offer-cta-btn offer-cta-btn-primary"
                                      size="small"
                                      loading={
                                        actionLoadingKey ===
                                        `accept-negotiation-${neg.id}`
                                      }
                                      onClick={() =>
                                        handleAcceptNegotiation(offer.id, neg.id)
                                      }
                                    >
                                      Aceitar contraproposta
                                    </Button>
                                    <Button
                                      size="small"
                                      className="offer-cta-btn offer-cta-btn-danger negotiation-reject-btn"
                                      loading={
                                        actionLoadingKey ===
                                        `reject-negotiation-${neg.id}`
                                      }
                                      onClick={() =>
                                        handleRejectNegotiation(offer.id, neg.id)
                                      }
                                    >
                                      Recusar contraproposta
                                    </Button>
                                  </Space>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="offer-card-filter-empty">
                      Nenhuma contraproposta corresponde aos filtros desta proposta.
                    </div>
                  )}
                </>
              )}

              <Divider />

              <div className="client-offer-footer-actions">
                <div className="client-offer-footer-copy">
                  <span className="client-offer-footer-label">Próximo passo</span>
                  <p>
                    {canCancelOffer
                      ? "Você ainda pode analisar contrapropostas ou encerrar esta publicação."
                      : "Esta oferta já avançou para a próxima etapa do fluxo."}
                  </p>
                </div>

                <div className="offer-actions client-offer-actions-row">
                  {canCancelOffer && (
                    <Button
                      className="offer-cta-btn offer-cta-btn-danger offer-cancel-btn"
                      loading={actionLoadingKey === `cancel-offer-${offer.id}`}
                      onClick={() => handleCancelOffer(offer.id)}
                    >
                      Cancelar publicação
                    </Button>
                  )}
                  {offer.status === "aceita" && (
                    <Tag color="success">{getDisplayOrderStatus(offer)}</Tag>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    );
  };

  if (userRole === "diarista") {
    return (
      <div className="offers-page">
        <div className="offers-page-hero">
          <h2>Mural de Ofertas</h2>

          <div className="offers-filter-toolbar">
            <div className="offers-filter-summary">
              <span className="offers-filter-kicker">Resumo</span>
              <p>
                {diaristTab === "negotiations"
                  ? `${negotiations.length} contraproposta(s) na tela atual`
                    : `${offers.length} oferta(s) disponíveis nesta página`}
              </p>
            </div>
          </div>

          <Tabs
            activeKey={diaristTab}
            onChange={handleDiaristTabChange}
            items={[
              {
                key: "offers",
                  label: "Ofertas disponíveis",
                children: (
                  <Spin spinning={loading || isTabSwitchPending}>
                    {!hasRegisteredAddress ? (
                      <Empty description="Cadastre um endereço no seu perfil para visualizar ofertas próximas." />
                    ) : offers.length > 0 ? (
                      <div className="offer-list">
                        {offers.map((offer) =>
                          renderOfferCardForDiarist(offer),
                        )}
                      </div>
                    ) : (
                      <Empty description="Nenhuma oferta disponível" />
                    )}
                  </Spin>
                ),
              },
              {
                key: "negotiations",
                label: hasLoadedNegotiations
                  ? `Minhas negociações (${negotiations.length})`
                  : "Minhas negociações",
                children: (
                  <Spin spinning={loading || isTabSwitchPending}>
                    {negotiations.length > 0 ? (
                      <>
                        <div className="offers-filter-toolbar offers-filter-toolbar-client">
                          <div className="offers-filter-summary offers-filter-summary-client">
                            <span className="offers-filter-label">
                              Contrapropostas
                            </span>
                            <p>
                              {diaristNegotiationFilterCount > 0
                                ? `${diaristNegotiationFilterCount} filtro(s) ativo(s)`
                                : "Sem filtros ativos"}
                            </p>
                          </div>
                          <Button
                            icon={<FilterOutlined />}
                            className="offers-filter-trigger"
                            onClick={() =>
                              setDiaristNegotiationFiltersVisible(true)
                            }
                          >
                            Filtrar
                          </Button>
                        </div>

                        {diaristNegotiationFilterCount > 0 && (
                          <div className="offers-active-filters">
                            {diaristNegotiationFilters.search ? (
                              <Tag
                                closable
                                onClose={() =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    search: "",
                                  }))
                                }
                              >
                                Busca: {diaristNegotiationFilters.search}
                              </Tag>
                            ) : null}
                            {diaristNegotiationFilters.maxDistance <
                            DEFAULT_DIARIST_NEGOTIATION_FILTERS.maxDistance ? (
                              <Tag
                                closable
                                onClose={() =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    maxDistance:
                                      DEFAULT_DIARIST_NEGOTIATION_FILTERS.maxDistance,
                                  }))
                                }
                              >
                                Distância: até{" "}
                                {diaristNegotiationFilters.maxDistance} km
                              </Tag>
                            ) : null}
                            {diaristNegotiationFilters.minCounterValue !==
                            DEFAULT_DIARIST_NEGOTIATION_FILTERS.minCounterValue ? (
                              <Tag
                                closable
                                onClose={() =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    minCounterValue:
                                      DEFAULT_DIARIST_NEGOTIATION_FILTERS.minCounterValue,
                                  }))
                                }
                              >
                                Mínimo:{" "}
                                {formatCurrency(
                                  diaristNegotiationFilters.minCounterValue,
                                )}
                              </Tag>
                            ) : null}
                            {diaristNegotiationFilters.maxCounterValue !==
                            DEFAULT_DIARIST_NEGOTIATION_FILTERS.maxCounterValue ? (
                              <Tag
                                closable
                                onClose={() =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    maxCounterValue:
                                      DEFAULT_DIARIST_NEGOTIATION_FILTERS.maxCounterValue,
                                  }))
                                }
                              >
                                Máximo:{" "}
                                {formatCurrency(
                                  diaristNegotiationFilters.maxCounterValue,
                                )}
                              </Tag>
                            ) : null}
                            {diaristNegotiationFilters.onlyPending ? (
                              <Tag
                                closable
                                onClose={() =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    onlyPending: false,
                                  }))
                                }
                              >
                                Somente pendentes
                              </Tag>
                            ) : null}
                          </div>
                        )}

                        <Drawer
                          title="Filtros"
                          open={diaristNegotiationFiltersVisible}
                          onClose={() =>
                            setDiaristNegotiationFiltersVisible(false)
                          }
                          placement={isMobile ? "bottom" : "right"}
                          width={isMobile ? "100%" : 420}
                          height={isMobile ? "88%" : undefined}
                          className="offers-filters-drawer"
                        >
                          <div className="offers-filters-panel">
                            <div className="offers-filter-field">
                              <label>Buscar</label>
                              <Input
                                placeholder="Cliente, bairro ou mensagem"
                                value={diaristNegotiationFilters.search}
                                onChange={(event) =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    search: event.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div className="offers-filter-field">
                              <label>Ordenar por</label>
                              <Select
                                getPopupContainer={(triggerNode) =>
                                  triggerNode.parentElement
                                }
                                value={diaristNegotiationFilters.sortBy}
                                onChange={(value) =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    sortBy: value,
                                  }))
                                }
                                options={[
                                  { value: "recent", label: "Mais recentes" },
                                  {
                                    value: "distance",
                                    label: "Menor distância",
                                  },
                                  { value: "price_low", label: "Menor valor" },
                                  { value: "price_high", label: "Maior valor" },
                                ]}
                              />
                            </div>

                            <div className="offers-filter-field">
                              <label>
                                Distância máxima:{" "}
                                {diaristNegotiationFilters.maxDistance} km
                              </label>
                              <Slider
                                min={1}
                                max={50}
                                step={1}
                                value={diaristNegotiationFilters.maxDistance}
                                onChange={(value) =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    maxDistance: value,
                                  }))
                                }
                              />
                            </div>

                            <div className="offers-filter-field">
                              <label>Faixa de valor</label>
                              <div className="offers-filter-range-grid">
                                <div className="offers-filter-range-box">
                                  <span>Mínimo</span>
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    min={0}
                                    max={
                                      diaristNegotiationFilters.maxCounterValue ??
                                      999999
                                    }
                                    value={
                                      diaristNegotiationFilters.minCounterValue
                                    }
                                    onChange={(value) =>
                                      setDiaristNegotiationFilters((prev) => ({
                                        ...prev,
                                        minCounterValue:
                                          value === null
                                            ? null
                                            : Math.min(
                                                Number(value),
                                                prev.maxCounterValue ??
                                                  Number.MAX_SAFE_INTEGER,
                                              ),
                                      }))
                                    }
                                  />
                                </div>
                                <div className="offers-filter-range-box">
                                  <span>Máximo</span>
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    min={
                                      diaristNegotiationFilters.minCounterValue ??
                                      0
                                    }
                                    max={999999}
                                    value={
                                      diaristNegotiationFilters.maxCounterValue
                                    }
                                    onChange={(value) =>
                                      setDiaristNegotiationFilters((prev) => ({
                                        ...prev,
                                        maxCounterValue:
                                          value === null
                                            ? null
                                            : Math.max(
                                                Number(value),
                                                prev.minCounterValue ?? 0,
                                              ),
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="offers-filter-checkbox">
                              <Checkbox
                                checked={diaristNegotiationFilters.onlyPending}
                                onChange={(event) =>
                                  setDiaristNegotiationFilters((prev) => ({
                                    ...prev,
                                    onlyPending: event.target.checked,
                                  }))
                                }
                              >
                                Mostrar apenas pendentes
                              </Checkbox>
                            </div>

                            <div className="offers-filter-drawer-footer">
                              <Button
                                onClick={() =>
                                  setDiaristNegotiationFilters(
                                    DEFAULT_DIARIST_NEGOTIATION_FILTERS,
                                  )
                                }
                              >
                                Limpar tudo
                              </Button>
                              <Button
                                type="primary"
                                onClick={() =>
                                  setDiaristNegotiationFiltersVisible(false)
                                }
                              >
                                Ver {filteredDiaristNegotiations.length}{" "}
                                resultado(s)
                              </Button>
                            </div>
                          </div>
                        </Drawer>

                        <div className="offer-list">
                          {filteredDiaristNegotiations.map((neg) =>
                            renderNegotiationCardForDiarist(neg),
                          )}
                        </div>
                      </>
                    ) : (
            <Empty description="Você ainda não fez nenhuma negociação." />
                    )}
                  </Spin>
                ),
              },
            ]}
          />

          <div className="offers-pagination">
            <button
              type="button"
              className="offers-pagination-btn"
              onClick={() =>
                startTabSwitchTransition(() => {
                  if (diaristTab === "negotiations") {
                    setNegotiationsPagination((prev) => ({
                      ...prev,
                      page: Math.max(prev.page - 1, 1),
                    }));
                    return;
                  }

                  setOffersPagination((prev) => ({
                    ...prev,
                    page: Math.max(prev.page - 1, 1),
                  }));
                })
              }
              disabled={
                loading ||
                isTabSwitchPending ||
                (diaristTab === "offers" && !hasRegisteredAddress) ||
                !(diaristTab === "negotiations"
                  ? negotiationsPagination.has_previous
                  : offersPagination.has_previous)
              }
            >
              Anterior
            </button>

            <div className="offers-pagination-status">
              Página{" "}
              {diaristTab === "negotiations"
                ? negotiationsPagination.page
                : hasRegisteredAddress
                  ? offersPagination.page
                  : 1}{" "}
              de{" "}
              {diaristTab === "negotiations"
                ? negotiationsPagination.total_pages
                : hasRegisteredAddress
                  ? offersPagination.total_pages
                  : 1}
            </div>

            <button
              type="button"
              className="offers-pagination-btn"
              onClick={() =>
                startTabSwitchTransition(() => {
                  if (diaristTab === "negotiations") {
                    setNegotiationsPagination((prev) => ({
                      ...prev,
                      page: prev.page + 1,
                    }));
                    return;
                  }

                  setOffersPagination((prev) => ({
                    ...prev,
                    page: prev.page + 1,
                  }));
                })
              }
              disabled={
                loading ||
                isTabSwitchPending ||
                (diaristTab === "offers" && !hasRegisteredAddress) ||
                !(diaristTab === "negotiations"
                  ? negotiationsPagination.has_next
                  : offersPagination.has_next)
              }
            >
            Próxima
            </button>
          </div>
        </div>

        <Modal
          title="Fazer contraproposta"
          open={counterModal.open}
          zIndex={6100}
          okText="Enviar"
          cancelText="Cancelar"
          confirmLoading={counterSubmitting}
          onOk={handleSendCounter}
          onCancel={() => {
            counterForm.resetFields();
            setCounterModalError("");
            setCounterModal({ open: false, offerId: null, durationHours: null });
          }}
        >
          <Form layout="vertical" form={counterForm}>
            <Form.Item
              label="Valor proposto (R$)"
              name="counterValue"
              rules={[
                { required: true, message: "Informe o valor" },
                { type: "number", min: 0, message: "Valor inválido" },
              ]}
            >
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="Horas propostas"
              name="counterDurationHours"
              extra={
                counterDurationLocked
                  ? "Esta oferta já tem 8 horas ou mais, então não é possível pedir mais tempo na contraproposta."
                  : null
              }
              rules={[
                { required: true, message: "Informe a duração" },
                { type: "number", min: 0.5, message: "Informe uma duração maior que zero" },
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                min={0.5}
                max={24}
                step={0.5}
                disabled={counterDurationLocked}
              />
            </Form.Item>
            <Form.Item label="Mensagem (opcional)" name="message">
              <Input.TextArea rows={3} placeholder="Deixe uma mensagem..." />
            </Form.Item>
            {counterModalError ? (
              <div
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#fff1f0",
                  border: "1px solid #ffccc7",
                  color: "#cf1322",
                  lineHeight: 1.5,
                  whiteSpace: "pre-line",
                }}
              >
                {counterModalError}
              </div>
            ) : null}
          </Form>
        </Modal>
        <Modal
          title={actionErrorModal.title || "Erro"}
          open={actionErrorModal.open}
          zIndex={6200}
          footer={null}
          centered
          onCancel={() =>
            setActionErrorModal({
              open: false,
              title: "",
              content: "",
            })
          }
        >
          <div style={{ color: "#1f2937", lineHeight: 1.6 }}>
            {actionErrorModal.content || "Tivemos um problema ao concluir esta ação."}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <Button
              type="primary"
              onClick={() =>
                setActionErrorModal({
                  open: false,
                  title: "",
                  content: "",
                })
              }
            >
              Fechar
            </Button>
          </div>
        </Modal>
        {profileLoading && !profileDrawerVisible && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483646,
              background: "rgba(15, 23, 42, 0.34)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(2px)",
            }}
          >
            <div
              style={{
                minWidth: "140px",
                minHeight: "140px",
                borderRadius: "28px",
                background: "rgba(255, 255, 255, 0.96)",
                boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
              }}
            >
              <Spin size="large" />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                Carregando perfil...
              </span>
            </div>
          </div>
        )}
        {profileDrawerVisible &&
          selectedProfile && (
            <div
              className="offers-profile-rebuild-overlay"
              onClick={closeProfileDrawer}
              style={{
                position: "fixed",
                top: isMobile ? 0 : "64px",
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 2147483647,
                background: "rgba(15, 23, 42, 0.52)",
                display: "flex",
                justifyContent: isMobile ? "center" : "flex-end",
                alignItems: isMobile ? "flex-end" : "stretch",
                padding: isMobile ? "0" : "0",
              }}
            >
              <section
                className="offers-profile-rebuild-panel"
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: isMobile ? "100vw" : "min(620px, 100vw)",
                  height: isMobile ? "90dvh" : "calc(100dvh - 64px)",
                  maxHeight: isMobile ? "90dvh" : "calc(100dvh - 64px)",
                  background: "#f8fafc",
                  borderRadius: isMobile ? "24px 24px 0 0" : "24px 0 0 24px",
                  boxShadow: "-24px 0 48px rgba(15, 23, 42, 0.28)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    padding: isMobile ? "18px 18px 16px" : "16px 18px 14px",
                    background: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
                    color: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <img
                        src={selectedProfile.photo}
                        alt={selectedProfile.name}
                        style={{
                          width: isMobile ? "72px" : "64px",
                          height: isMobile ? "72px" : "64px",
                          borderRadius: isMobile ? "22px" : "18px",
                          objectFit: "cover",
                          border: "3px solid rgba(255,255,255,0.88)",
                          boxShadow: "0 10px 22px rgba(15, 23, 42, 0.2)",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.84 }}>
                          {isClientProfile ? "Cliente" : "Profissional"}
                        </div>
                        <h2 style={{ margin: "4px 0 6px", fontSize: isMobile ? "28px" : "24px", lineHeight: 1.02, color: "#fff" }}>
                          {selectedProfile.name}
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px" }}>
                          <StarFilled style={{ color: "#fbbf24", fontSize: "14px" }} />
                          <span>{formatAverageRatingText(selectedProfile.average_rating)}</span>
                          <span style={{ opacity: 0.84 }}>({profileReviewCount} avaliações)</span>
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <span style={getEmailVerificationTagStyle(selectedProfile.emailVerified)}>
                            {getEmailVerificationLabel(selectedProfile.emailVerified)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={closeProfileDrawer}
                      style={{
                        border: "none",
                        width: "38px",
                        height: "38px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.16)",
                        color: "#fff",
                        fontSize: "16px",
                        cursor: "pointer",
                      }}
                    >
                      {"\u2715"}
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "18px" : "16px" }}>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
                        Sobre
                      </div>
                      <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55, fontSize: "14px" }}>
                        {selectedProfile.bio || (isClientProfile ? "Cliente sem observações adicionais." : "Bio profissional não informada.")}
                      </p>
                    </div>

                    {isClientProfile && (
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
                          Cômodos da residência
                        </div>
                        {profileRooms.length > 0 ? (
                          <div className="diarist-offer-rooms-list">
                            {profileRooms.map((room) => (
                              <div key={room.id} className="diarist-offer-room-card">
                                <span className="diarist-offer-room-icon" aria-hidden="true">
                                  {getRoomIcon(room.name)}
                                </span>
                                <div className="diarist-offer-room-copy">
                                  <strong>{room.name}</strong>
                                  <span>{formatRoomCountLabel(room.quantity)}</span>
                                </div>
                                <span className="diarist-offer-room-badge">{room.quantity}x</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                            Nenhum cômodo informado.
                          </p>
                        )}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>Distancia</div>
                        <strong style={{ fontSize: "16px", color: "#0f172a" }}>{selectedProfile.distance}</strong>
                      </div>
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                          {isClientProfile ? "Residência" : "Experiência"}
                        </div>
                        <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                          {isClientProfile
                            ? formatResidenceType(selectedProfile.residenceType)
                            : `${selectedProfile.experienceYears || 0} anos`}
                        </strong>
                      </div>
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>Avaliação</div>
                        <strong style={{ fontSize: "16px", color: "#0f172a" }}>{formatAverageRatingText(selectedProfile.average_rating)}</strong>
                      </div>
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                          {isClientProfile ? "Frequência" : "Disponibilidade"}
                        </div>
                        <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                          {isClientProfile
                            ? formatDesiredFrequency(selectedProfile.desiredFrequency)
                            : selectedProfile.available === null
                              ? "Não informada"
                              : selectedProfile.available
                                ? "Disponível"
                                : "Indisponível"}
                        </strong>
                      </div>
                    </div>

                    {isClientProfile && Array.isArray(selectedProfile.address) && selectedProfile.address.length > 0 && (
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
                          Endereço da cliente
                        </div>
                        <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55, fontSize: "14px" }}>
                          {formatDrawerAddressSummary(selectedProfile.address[0])}
                        </p>
                        <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.5, fontSize: "12px" }}>
                          Endereço completo disponível após a aceitação do pedido.
                        </p>
                      </div>
                    )}

                    {!isClientProfile && (
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "10px" }}>
                          Valores informados
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                          <div style={{ background: "#f8fbff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "12px 14px" }}>
                            <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                              Por hora
                            </div>
                            <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                              {formatCurrency(selectedProfile.pricePerHour || 0)}
                            </strong>
                          </div>
                          <div style={{ background: "#f8fbff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "12px 14px" }}>
                            <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                              Diária
                            </div>
                            <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                              {formatCurrency(selectedProfile.pricePerDay || 0)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isClientProfile && (
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "10px" }}>
                          Especialidades
                        </div>
                        {Array.isArray(selectedProfile.specialties) && selectedProfile.specialties.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {selectedProfile.specialties.map((specialty) => (
                              <span
                                key={specialty}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  minHeight: "32px",
                                  padding: "0 12px",
                                  borderRadius: "999px",
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  color: "#1d4ed8",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                }}
                              >
                                {specialty}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5, fontSize: "14px" }}>
                            Nenhuma especialidade informada.
                          </p>
                        )}
                      </div>
                    )}

                    
                      <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>
                            Avaliações
                          </div>
                          <div style={{ color: "#1d4ed8", fontSize: "11px", fontWeight: 700 }}>
                            {profileReviewCount} no total
                          </div>
                        </div>

                        {reviewsLoading ? (
                          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>Carregando avaliações...</p>
                        ) : visibleReviews.length === 0 ? (
                          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>Nenhuma avaliação ainda.</p>
                        ) : (
                          <div style={{ display: "grid", gap: "12px" }}>
                            {visibleReviews.slice(0, 3).map((review, index) => (
                              <div
                                key={index}
                                style={{
                                  padding: isMobile ? "13px 14px" : "12px 14px",
                                  borderRadius: "14px",
                                  background: "#f8fbff",
                                  border: "1px solid #dbeafe",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {renderReviewStars(getReviewDisplayRating(review, selectedProfile?.role))}
                                  </div>
                                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600 }}>
                                    {new Date(review.created_at || review.CreatedAt).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                                <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55, fontSize: "14px" }}>
                                  {getReviewDisplayComment(review, selectedProfile?.role) || "Sem comentário."}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {!reviewsLoading && visibleReviews.length > 3 && (
                          <button
                            onClick={openReviewsDrawer}
                            style={{
                              marginTop: "12px",
                              width: "100%",
                              minHeight: "40px",
                              borderRadius: "12px",
                              border: "1px solid #bfdbfe",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            Ver todas as {profileReviewCount} avaliações
                          </button>
                        )}
                      </div>
                    
                  </div>
                </div>

                <div
                  style={{
                    padding: isMobile ? "16px 18px 18px" : "14px 16px 16px",
                    borderTop: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <button
                    onClick={closeProfileDrawer}
                    style={{
                      width: "100%",
                      minHeight: "46px",
                      border: "none",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    Fechar perfil
                  </button>
                </div>
              </section>
            </div>
          )}

        <Drawer
          title={null}
          placement={isMobile ? "bottom" : "right"}
          onClose={closeReviewsDrawer}
          open={reviewsDrawerVisible}
          width={isMobile ? "100%" : 600}
          height={isMobile ? "90%" : "100%"}
          className="reviews-drawer"
          bodyStyle={{
            padding: "0",
            background: "#f8fafc",
          }}
          headerStyle={{ display: "none" }}
        >
          <div className="reviews-drawer-content">
            <div className="reviews-drawer-header">
              <button className="drawer-close-btn" onClick={closeReviewsDrawer}>
                {"\u2715"}
              </button>
              <h2 className="reviews-drawer-title">Todas as avaliações</h2>
              <p className="reviews-drawer-subtitle">
                {selectedProfile?.name} - {profileReviewCount} avaliações
              </p>
            </div>

            <div className="reviews-drawer-body">
              {reviewsLoading ? (
                <p className="loading-reviews-text">Carregando avaliações...</p>
              ) : visibleReviews.length === 0 ? (
                <p className="no-reviews-text">Nenhuma avaliação ainda.</p>
              ) : (
                visibleReviews.map((review, index) => (
                  <div key={index} className="review-card-full">
                    <div className="review-header-full">
                      <div className="review-stars-full">
                        {renderReviewStars(getReviewDisplayRating(review, selectedProfile?.role))}
                      </div>
                      <span className="review-date-full">
                        {new Date(review.created_at || review.CreatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="review-comment-full">
                      {getReviewDisplayComment(review, selectedProfile?.role)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="offers-page">
      <div className="offers-page-hero">
        <h2>Mural de Ofertas</h2>

        <Button
          type="primary"
          size="large"
          onClick={openCreateOfferModal}
          style={{ marginBottom: currentClientOffers.length > 0 ? "24px" : 0 }}
        >
          + Criar nova oferta
        </Button>

        <div
          className="offers-file-tabs"
          role="tablist"
          aria-label="Filtro de ofertas do cliente"
        >
          <button
            type="button"
            className={`offers-file-tab ${clientOffersTab === "pendentes" ? "active" : ""}`}
            onClick={() => handleClientOffersTabChange("pendentes")}
          >
            Pendentes
            <span className="offers-file-count">{pendingOffers.length}</span>
          </button>
          <button
            type="button"
            className={`offers-file-tab ${clientOffersTab === "aceitas" ? "active" : ""}`}
            onClick={() => handleClientOffersTabChange("aceitas")}
          >
            Aceitas
            {hasLoadedAcceptedOffers && (
              <span className="offers-file-count">{acceptedOffers.length}</span>
            )}
          </button>
        </div>
      </div>

      <Modal
        title="Criar nova oferta"
        open={isCreateOpen}
        zIndex={6100}
        className="offers-create-modal"
        wrapClassName="offers-create-modal-wrap"
        destroyOnHidden
        okText="Publicar"
        cancelText="Cancelar"
        confirmLoading={createSubmitting}
        onOk={() => form.submit()}
        onCancel={() => {
          form.resetFields();
          setIsCreateOpen(false);
        }}
      >
        <div className="offers-create-modal-intro">
          <div>
            <span className="offers-create-modal-kicker">Nova oportunidade</span>
            <p>
              Monte a oferta com data, hora e valor em um fluxo mais estável.
            </p>
          </div>
          <div className="offers-create-modal-address">
            <span>Endereço selecionado</span>
            <strong>{formatOfferAddress(selectedAddress)}</strong>
          </div>
        </div>
        <Form
          layout="vertical"
          form={form}
          className="offers-create-form"
          onFinish={handleCreate}
          onFinishFailed={() => {
            message.error("Preencha os campos obrigatórios da oferta.");
          }}
        >
          <div className="offers-create-section">
            <div className="offers-create-section-header">
              <h3>Tipo de serviço</h3>
              <p>Escolha a categoria principal da limpeza.</p>
            </div>
          <Form.Item
            label="Tipo de limpeza"
            name="serviceType"
            rules={[{ required: true, message: "Selecione o tipo" }]}
          >
            <select className="offers-native-select">
              <option value="" disabled>
                Selecione o tipo de limpeza
              </option>
              {OFFER_SERVICE_TYPES.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </Form.Item>
          </div>
          <div className="offers-create-section">
            <div className="offers-create-section-header">
              <h3>Agenda</h3>
              <p>Horários disponíveis entre 08:00 e 20:00.</p>
            </div>
          <div className="offers-create-grid">
            <Form.Item
              label="Data"
              name="serviceDate"
              rules={[{ required: true, message: "Selecione a data" }]}
            >
              <Input type="date" min={dayjs().format("YYYY-MM-DD")} />
            </Form.Item>
            <Form.Item
              label="Hora"
              name="serviceTime"
              rules={[{ required: true, message: "Selecione a hora" }]}
            >
              <select className="offers-native-select">
                <option value="" disabled>
                  Selecione a hora
                </option>
                {offerTimeOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={Boolean(option.disabled)}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </Form.Item>
          </div>
          </div>
          <div className="offers-create-section">
            <div className="offers-create-section-header">
              <h3>Escopo e preço</h3>
              <p>Defina a duração estimada e o valor inicial da oferta.</p>
            </div>
          <div className="offers-create-grid">
          <Form.Item
            label="Duração (horas)"
            name="hours"
            rules={[
              { required: true, message: "Informe as horas" },
              { type: "number", min: 1, message: "Mínimo de 1 hora" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} min={1} max={12} />
          </Form.Item>
          <Form.Item
            label="Valor (R$)"
            name="value"
            rules={[
              { required: true, message: "Informe o valor" },
              { type: "number", min: 0, message: "Valor inválido" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
          </div>
          </div>
          <div className="offers-create-section">
            <div className="offers-create-section-header">
              <h3>Observações</h3>
              <p>Adicione contexto para a diarista chegar preparada.</p>
            </div>
          <Form.Item label="Observações (opcional)" name="observations">
            <Input.TextArea
              rows={4}
              placeholder="Ex.: apartamento com pets, foco na cozinha, levar escada pequena..."
            />
          </Form.Item>
          </div>
        </Form>
      </Modal>

      <div className="offers-pagination">
        <button
          type="button"
          className="offers-pagination-btn"
          onClick={() => {
            startTabSwitchTransition(() => {
              if (clientOffersTab === "aceitas") {
                setAcceptedOffersPagination((prev) => ({
                  ...prev,
                  page: Math.max(prev.page - 1, 1),
                }));
                return;
              }

              setPendingOffersPagination((prev) => ({
                ...prev,
                page: Math.max(prev.page - 1, 1),
              }));
            });
          }}
          disabled={loading || isTabSwitchPending || !currentClientPagination.has_previous}
        >
          Anterior
        </button>

        <div className="offers-pagination-status">
          Página {currentClientPagination.page} de{" "}
          {currentClientPagination.total_pages}
        </div>

        <button
          type="button"
          className="offers-pagination-btn"
          onClick={() => {
            startTabSwitchTransition(() => {
              if (clientOffersTab === "aceitas") {
                setAcceptedOffersPagination((prev) => ({
                  ...prev,
                  page: prev.page + 1,
                }));
                return;
              }

              setPendingOffersPagination((prev) => ({
                ...prev,
                page: prev.page + 1,
              }));
            });
          }}
          disabled={loading || isTabSwitchPending || !currentClientPagination.has_next}
        >
          Próxima
        </button>
      </div>

      <Spin spinning={loading || isTabSwitchPending}>
        {currentClientOffers.length > 0 ? (
          <>
            <div className="offer-list offer-list-client">
              {currentClientOffers.map((offer) =>
                renderOfferCardForClient(offer),
              )}
            </div>
          </>
        ) : (
          <div className="offers-empty-state">
            <Empty
              description={
                clientOffersTab === "aceitas"
                  ? "Nenhuma oferta aceita ainda"
                  : "Nenhuma oferta pendente no momento"
              }
            />
          </div>
        )}
      </Spin>

      {profileDrawerVisible &&
        selectedProfile && (
          <div
            className="offers-profile-rebuild-overlay"
            onClick={closeProfileDrawer}
            style={{
              position: "fixed",
              top: isMobile ? 0 : "64px",
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 2147483647,
              background: "rgba(15, 23, 42, 0.52)",
              display: "flex",
              justifyContent: isMobile ? "center" : "flex-end",
              alignItems: isMobile ? "flex-end" : "stretch",
              padding: isMobile ? "0" : "0",
            }}
          >
            <section
              className="offers-profile-rebuild-panel"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: isMobile ? "100vw" : "min(620px, 100vw)",
                height: isMobile ? "90dvh" : "calc(100dvh - 64px)",
                maxHeight: isMobile ? "90dvh" : "calc(100dvh - 64px)",
                background: "#f8fafc",
                borderRadius: isMobile ? "24px 24px 0 0" : "24px 0 0 24px",
                boxShadow: "-24px 0 48px rgba(15, 23, 42, 0.28)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: isMobile ? "18px 18px 16px" : "16px 18px 14px",
                  background: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
                  color: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <img
                      src={selectedProfile.photo}
                      alt={selectedProfile.name}
                      style={{
                        width: isMobile ? "72px" : "64px",
                        height: isMobile ? "72px" : "64px",
                        borderRadius: isMobile ? "22px" : "18px",
                        objectFit: "cover",
                        border: "3px solid rgba(255,255,255,0.88)",
                        boxShadow: "0 10px 22px rgba(15, 23, 42, 0.2)",
                      }}
                    />
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.84 }}>
                        {isClientProfile ? "Cliente" : "Profissional"}
                      </div>
                      <h2 style={{ margin: "4px 0 6px", fontSize: isMobile ? "28px" : "24px", lineHeight: 1.02, color: "#fff" }}>
                        {selectedProfile.name}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px" }}>
                        <StarFilled style={{ color: "#fbbf24", fontSize: "14px" }} />
                        <span>{formatAverageRatingText(selectedProfile.average_rating)}</span>
                        <span style={{ opacity: 0.84 }}>({profileReviewCount} avaliações)</span>
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span style={getEmailVerificationTagStyle(selectedProfile.emailVerified)}>
                          {getEmailVerificationLabel(selectedProfile.emailVerified)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeProfileDrawer}
                    style={{
                      border: "none",
                      width: "38px",
                      height: "38px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.16)",
                      color: "#fff",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    {"\u2715"}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "18px" : "16px" }}>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
                      Sobre
                    </div>
                    <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55, fontSize: "14px" }}>
                      {selectedProfile.bio || (isClientProfile ? "Cliente sem observações adicionais." : "Bio profissional não informada.")}
                    </p>
                  </div>

                  {isClientProfile && Array.isArray(selectedProfile.address) && selectedProfile.address.length > 0 && (
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
                        Endereço da cliente
                      </div>
                      <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55, fontSize: "14px" }}>
                        {formatDrawerAddressSummary(selectedProfile.address[0])}
                      </p>
                      <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.5, fontSize: "12px" }}>
                        Endereço completo disponível após a aceitação do pedido.
                      </p>
                    </div>
                  )}

                  {isClientProfile && (
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "8px" }}>
                        Cômodos da residência
                      </div>
                      {profileRooms.length > 0 ? (
                        <div className="diarist-offer-rooms-list">
                          {profileRooms.map((room) => (
                            <div key={room.id} className="diarist-offer-room-card">
                              <span className="diarist-offer-room-icon" aria-hidden="true">
                                {getRoomIcon(room.name)}
                              </span>
                              <div className="diarist-offer-room-copy">
                                <strong>{room.name}</strong>
                                <span>{formatRoomCountLabel(room.quantity)}</span>
                              </div>
                              <span className="diarist-offer-room-badge">{room.quantity}x</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                          Nenhum cômodo informado.
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>Distancia</div>
                      <strong style={{ fontSize: "16px", color: "#0f172a" }}>{selectedProfile.distance}</strong>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                        {isClientProfile ? "Residência" : "Experiência"}
                      </div>
                      <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                        {isClientProfile
                          ? formatResidenceType(selectedProfile.residenceType)
                          : `${selectedProfile.experienceYears || 0} anos`}
                      </strong>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>Avaliação</div>
                      <strong style={{ fontSize: "16px", color: "#0f172a" }}>{formatAverageRatingText(selectedProfile.average_rating)}</strong>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "16px", padding: isMobile ? "14px" : "12px 14px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                        {isClientProfile ? "Frequência" : "Disponibilidade"}
                      </div>
                      <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                        {isClientProfile
                          ? formatDesiredFrequency(selectedProfile.desiredFrequency)
                          : selectedProfile.available === null
                              ? "Não informada"
                            : selectedProfile.available
                                ? "Disponível"
                                : "Indisponível"}
                      </strong>
                    </div>
                  </div>

                  {!isClientProfile && (
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "10px" }}>
                        Valores informados
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                        <div style={{ background: "#f8fbff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "12px 14px" }}>
                          <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                            Por hora
                          </div>
                          <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                            {formatCurrency(selectedProfile.pricePerHour || 0)}
                          </strong>
                        </div>
                        <div style={{ background: "#f8fbff", border: "1px solid #dbeafe", borderRadius: "14px", padding: "12px 14px" }}>
                          <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                            Diária
                          </div>
                          <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                            {formatCurrency(selectedProfile.pricePerDay || 0)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isClientProfile && (
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "10px" }}>
                        Especialidades
                      </div>
                      {Array.isArray(selectedProfile.specialties) && selectedProfile.specialties.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {selectedProfile.specialties.map((specialty) => (
                            <span
                              key={specialty}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                minHeight: "32px",
                                padding: "0 12px",
                                borderRadius: "999px",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                color: "#1d4ed8",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5, fontSize: "14px" }}>
                          Nenhuma especialidade informada.
                        </p>
                      )}
                    </div>
                  )}

                  
                    <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: "18px", padding: isMobile ? "16px" : "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>
                          Avaliações
                        </div>
                        <div style={{ color: "#1d4ed8", fontSize: "11px", fontWeight: 700 }}>
                          {profileReviewCount} no total
                        </div>
                      </div>

                      {reviewsLoading ? (
                        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>Carregando avaliações...</p>
                      ) : visibleReviews.length === 0 ? (
                        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>Nenhuma avaliação ainda.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {visibleReviews.slice(0, 3).map((review, index) => (
                            <div
                              key={index}
                              style={{
                                padding: isMobile ? "13px 14px" : "12px 14px",
                                borderRadius: "14px",
                                background: "#f8fbff",
                                border: "1px solid #dbeafe",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  {renderReviewStars(getReviewDisplayRating(review, selectedProfile?.role))}
                                </div>
                                <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600 }}>
                                  {new Date(review.created_at || review.CreatedAt).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                              <p style={{ margin: 0, color: "#1e293b", lineHeight: 1.55, fontSize: "14px" }}>
                                {getReviewDisplayComment(review, selectedProfile?.role) || "Sem comentário."}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {!reviewsLoading && visibleReviews.length > 3 && (
                        <button
                          onClick={openReviewsDrawer}
                          style={{
                            marginTop: "12px",
                            width: "100%",
                            minHeight: "40px",
                            borderRadius: "12px",
                            border: "1px solid #bfdbfe",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          Ver todas as {profileReviewCount} avaliações
                        </button>
                      )}
                    </div>
                  
                </div>
              </div>

              <div
                style={{
                  padding: isMobile ? "16px 18px 18px" : "14px 16px 16px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              >
                <button
                  onClick={closeProfileDrawer}
                  style={{
                    width: "100%",
                    minHeight: "46px",
                    border: "none",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Fechar perfil
                </button>
              </div>
            </section>
          </div>
        )}


      <Drawer
        title={null}
        placement={isMobile ? "bottom" : "right"}
        onClose={closeReviewsDrawer}
        open={reviewsDrawerVisible}
        width={isMobile ? "100%" : 600}
        height={isMobile ? "90%" : "100%"}
        className="reviews-drawer"
        bodyStyle={{
          padding: "0",
          background: "#f8fafc",
        }}
        headerStyle={{ display: "none" }}
      >
        <div className="reviews-drawer-content">
          <div className="reviews-drawer-header">
            <button className="drawer-close-btn" onClick={closeReviewsDrawer}>
              {"\u2715"}
            </button>
            <h2 className="reviews-drawer-title">Todas as avaliações</h2>
            <p className="reviews-drawer-subtitle">
              {selectedProfile?.name} - {profileReviewCount} avaliações
            </p>
          </div>

          <div className="reviews-drawer-body">
            {reviewsLoading ? (
              <p className="loading-reviews-text">Carregando avaliações...</p>
            ) : visibleReviews.length === 0 ? (
              <p className="no-reviews-text">Nenhuma avaliação ainda.</p>
            ) : (
              visibleReviews.map((review, index) => (
                <div key={index} className="review-card-full">
                  <div className="review-header-full">
                    <div className="review-stars-full">
                      {renderReviewStars(getReviewDisplayRating(review, selectedProfile?.role))}
                    </div>
                    <span className="review-date-full">
                      {new Date(review.created_at || review.CreatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="review-comment-full">
                      {getReviewDisplayComment(review, selectedProfile?.role)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default OffersBoard;










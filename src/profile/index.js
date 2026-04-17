import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircleFilled,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HomeOutlined,
  IdcardOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAddress } from "../context/address";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import "./profile.css";
import { apiFetch } from "../config/api";
import MapModal from "../forms/MapModal";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const onlyDigits = (value) => (value || "").replace(/\D/g, "");
const formatCep = (digits) =>
  digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;

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

const getCurrentBrowserPosition = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

const createRoom = (index = 0) => ({
  id: `${Date.now()}-${index}`,
  name: "",
  quantity: "",
});

const normalizeRoom = (room = {}, index = 0) => ({
  id: room.id || room.ID || `room-${index}`,
  name: room.name || room.Name || "",
  quantity: room.quantity || room.Quantity || "",
});

const residenceTypeLabels = {
  apartment: "Apartamento",
  house: "Casa",
  office: "Escritório",
  studio: "Studio",
};

const frequencyLabels = {
  once: "Uma vez",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  occasional: "Eventual",
};

const specialtyPresentationMap = {
  basic_cleaning: { label: "Limpeza Basica", icon: "\uD83E\uDDF9" },
  heavy_cleaning: { label: "Limpeza Pesada", icon: "\uD83E\uDEA3" },
  ironing: { label: "Passar Roupa", icon: "\uD83D\uDC55" },
  post_work: { label: "Pos-obra", icon: "\uD83D\uDEA7" },
  organization: { label: "Organizacao", icon: "\uD83D\uDCC1" },
  window_cleaning: { label: "Janelas", icon: "\uD83E\uDE9F" },
  carpet_cleaning: { label: "Tapetes", icon: "\uD83E\uDDFD" },
  cooking: { label: "Cozinhar", icon: "\uD83C\uDF73" },
};

const normalizeAddress = (address = {}) => {
  const normalized = {
    id: address.id || address.ID || null,
    street: address.street || address.Street || "",
    number: address.number || address.Number || "",
    residence_type: address.residence_type || address.ResidenceType || "",
    complement: address.complement || address.Complement || "",
    neighborhood: address.neighborhood || address.Neighborhood || "",
    reference_point:
      address.reference_point || address.referencePoint || address.ReferencePoint || "",
    city: address.city || address.City || "",
    state: address.state || address.State || "",
    zipcode: address.zipcode || address.Zipcode || "",
    latitude: address.latitude || address.Latitude || null,
    longitude: address.longitude || address.Longitude || null,
    rooms: Array.isArray(address.rooms || address.Rooms)
      ? (address.rooms || address.Rooms).map(normalizeRoom)
      : [],
  };

  return {
    ...normalized,
    ID: normalized.id,
    Street: normalized.street,
    Number: normalized.number,
    ResidenceType: normalized.residence_type,
    Complement: normalized.complement,
    Neighborhood: normalized.neighborhood,
    ReferencePoint: normalized.reference_point,
    City: normalized.city,
    State: normalized.state,
    Zipcode: normalized.zipcode,
    Latitude: normalized.latitude,
    Longitude: normalized.longitude,
    Rooms: normalized.rooms,
  };
};

const normalizeProfileResponse = (data = {}) => {
  const diaristProfile = data.diarist_profile || data.DiaristProfile || {};
  const userProfile = data.user_profile || data.UserProfile || {};
  const addresses = Array.isArray(data.address || data.Address)
    ? (data.address || data.Address).map(normalizeAddress)
    : [];

  return {
    id: data.id || data.ID || null,
    name: data.name || data.Name || "",
    email: data.email || data.Email || "",
    email_verified: Boolean(data.email_verified ?? data.EmailVerified),
    email_verified_at: data.email_verified_at || data.EmailVerifiedAt || null,
    phone: data.phone || data.Phone || "",
    cpf: data.cpf || data.Cpf || "",
    role: data.role || data.Role || "",
    is_test_user: Boolean(data.is_test_user ?? data.IsTestUser),
    created_at: data.created_at || data.CreatedAt || "",
    photo: data.photo || data.Photo || "",
    address: addresses,
    user_profile: {
      id: userProfile.id || userProfile.ID || null,
      user_id: userProfile.user_id || userProfile.UserID || null,
      desired_frequency: userProfile.desired_frequency || userProfile.DesiredFrequency || "weekly",
      has_pets: Boolean(
        typeof userProfile.has_pets === "boolean" ? userProfile.has_pets : userProfile.HasPets
      ),
    },
    diarist_profile: {
      id: diaristProfile.id || diaristProfile.ID || null,
      user_id: diaristProfile.user_id || diaristProfile.UserID || null,
      bio: diaristProfile.bio || diaristProfile.Bio || "",
      experience_years:
        diaristProfile.experience_years || diaristProfile.ExperienceYears || 0,
      price_per_hour: diaristProfile.price_per_hour || diaristProfile.PricePerHour || 0,
      price_per_day: diaristProfile.price_per_day || diaristProfile.PricePerDay || 0,
      specialties: diaristProfile.specialties || diaristProfile.Specialties || [],
      available:
        typeof diaristProfile.available === "boolean"
          ? diaristProfile.available
          : typeof diaristProfile.Available === "boolean"
          ? diaristProfile.Available
          : true,
    },
  };
};

const buildProfileForm = (data = {}) => ({
  name: data.name || "",
  email: data.email || "",
  phone: data.phone ? String(data.phone) : "",
  bio: data.diarist_profile?.bio || "",
  experience_years: data.diarist_profile?.experience_years || 0,
  desired_frequency: data.user_profile?.desired_frequency || "weekly",
  has_pets: Boolean(data.user_profile?.has_pets),
  price_per_hour: data.diarist_profile?.price_per_hour || 0,
  price_per_day: data.diarist_profile?.price_per_day || 0,
  specialties: parseSpecialties(data.diarist_profile?.specialties).join(", "),
  available:
    typeof data.diarist_profile?.available === "boolean" ? data.diarist_profile.available : true,
});

const buildAddressForm = (address = {}) => ({
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
  rooms: Array.isArray(address.rooms) ? address.rooms.map(normalizeRoom) : [],
});

const formatRoomSummary = (rooms = []) => {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return "Nenhum cômodo cadastrado";
  }

  return `${rooms.length} cômodo(s) cadastrado(s)`;
};

const formatRole = (role) => (role === "diarista" ? "Diarista" : "Cliente");

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return amount > 0
    ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "Não informado";
};

const formatBoolean = (value, positive = "Sim", negative = "Não") =>
  value ? positive : negative;

const formatSubscriptionPlan = (plan, hasValidSubscription) => {
  if (!plan && !hasValidSubscription) {
    return "Sem assinatura";
  }

  if (plan === "premium") {
    return "Premium";
  }

  if (plan === "free") {
    return "Plano gratuito";
  }

  if (!plan) {
    return hasValidSubscription ? "Assinatura ativa" : "Sem assinatura";
  }

  const normalizedPlan = String(plan)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return hasValidSubscription ? `${normalizedPlan} ativa` : normalizedPlan;
};

const formatDate = (value) => {
  if (!value) {
    return "Não informado";
  }

  return new Date(value).toLocaleDateString("pt-BR");
};

const maskCpf = (cpf) => {
  if (!cpf) {
    return "Não informado";
  }

  const digits = String(cpf).replace(/\D/g, "");
  if (digits.length !== 11) {
    return cpf;
  }

  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
};

const formatAddress = (address) => {
  const street = address.street || address.Street;
  const number = address.number || address.Number;
  const neighborhood = address.neighborhood || address.Neighborhood;
  const city = address.city || address.City;
  const state = address.state || address.State;

  return [street, number, neighborhood, city, state].filter(Boolean).join(", ");
};

const formatCoordinates = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return "Não informado";
  }

  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
};

function parseSpecialties(specialties) {
  if (!specialties) {
    return [];
  }

  if (Array.isArray(specialties)) {
    return specialties;
  }

  try {
    const parsed = JSON.parse(specialties);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

const getSpecialtyPresentation = (specialty) => {
  const key = String(specialty || "").trim();
  return specialtyPresentationMap[key] || {
    label: key.replace(/_/g, " ") || "Especialidade",
    icon: "\u2728",
  };
};

const pageStagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const SidebarButton = ({ active, label, description, icon, onClick }) => (
  <button
    type="button"
    className={`profile-sidebar-button ${active ? "active" : ""}`}
    onClick={onClick}
  >
    <span className="profile-sidebar-button__icon" aria-hidden="true">
      {icon}
    </span>
    <span className="profile-sidebar-button__copy">
      <strong>{label}</strong>
      <small>{description}</small>
    </span>
  </button>
);

const SectionCard = ({ icon, title, description, children, className = "" }) => (
  <motion.article className={`profile-card profile-feature-card ${className}`.trim()} variants={cardReveal}>
    <div className="profile-card-headline">
      <div className="profile-card-headline__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="profile-card-headline__copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
    {children}
  </motion.article>
);

const SecurityBadge = ({ icon, label, tone = "default", tooltip }) => (
  <span className={`profile-security-badge is-${tone}`} title={tooltip || label}>
    {icon}
    {label}
  </span>
);

const ProfileHeroSkeleton = () => (
  <header className="profile-hero is-skeleton">
    <div className="profile-hero-main">
      <div className="profile-skeleton profile-skeleton-avatar" />

      <div className="profile-hero-copy">
        <div className="profile-skeleton profile-skeleton-kicker" />
        <div className="profile-skeleton profile-skeleton-title" />
        <div className="profile-skeleton profile-skeleton-text" />
        <div className="profile-skeleton profile-skeleton-text short" />
        <div className="profile-skeleton profile-skeleton-pill-row" />
      </div>

      <div className="profile-hero-actions">
        <div className="profile-skeleton profile-skeleton-button" />
        <div className="profile-skeleton profile-skeleton-button secondary" />
      </div>
    </div>

    <div className="profile-highlight-grid">
      <div className="profile-skeleton profile-skeleton-highlight" />
      <div className="profile-skeleton profile-skeleton-highlight" />
      <div className="profile-skeleton profile-skeleton-highlight" />
    </div>
  </header>
);

const ProfilePanelSkeleton = () => (
  <div className="profile-panel">
    <div className="profile-panel-head">
      <div className="profile-panel-head-copy">
        <div className="profile-skeleton profile-skeleton-kicker" />
        <div className="profile-skeleton profile-skeleton-section-title" />
      </div>
    </div>

    <div className="profile-section-grid">
      <div className="profile-card">
        <div className="profile-skeleton profile-skeleton-card-title" />
        <div className="profile-info-list">
          <div className="profile-skeleton profile-skeleton-row" />
          <div className="profile-skeleton profile-skeleton-row" />
          <div className="profile-skeleton profile-skeleton-row" />
          <div className="profile-skeleton profile-skeleton-row" />
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-skeleton profile-skeleton-card-title" />
        <div className="profile-info-list">
          <div className="profile-skeleton profile-skeleton-block" />
          <div className="profile-skeleton profile-skeleton-row" />
          <div className="profile-skeleton profile-skeleton-row" />
          <div className="profile-skeleton profile-skeleton-chip-row" />
        </div>
      </div>
    </div>
  </div>
);

const ProfilePage = () => {
  const location = useLocation();
  const { setLogged, setAddress, setSelectedAddress, setEmailVerified } = useAddress();
  const [activeSection, setActiveSection] = useState("personal");
  const [user, setUser] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [hover, setHover] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ show: false, success: false, message: "" });
  const [emailResendLoading, setEmailResendLoading] = useState(false);
  const [subscriptionSummary, setSubscriptionSummary] = useState({
    hasValidSubscription: false,
    plan: "",
    status: "",
  });
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState({
    uploadPhoto: false,
    saveProfile: false,
    saveAddress: false,
    deleteAddressId: null,
  });

  const isDiarist = user.role === "diarista";
  const handleUnauthorized = useCallback(() => setLogged(false), [setLogged]);
  const focusQuery = useMemo(() => new URLSearchParams(location.search).get("focus"), [location.search]);

  const syncAddresses = useCallback((nextAddresses) => {
    setAddresses(nextAddresses);
    setAddress(nextAddresses);
    setSelectedAddress(nextAddresses[0] || {});
  }, [setAddress, setSelectedAddress]);

  const fetchProfile = useCallback(async () => {
    const response = await apiFetch("/profile", {
      method: "GET",
      authenticated: true,
      headers: {
        "Content-Type": "application/json",
      },
      onUnauthorized: handleUnauthorized,
    });

    if (!response.ok) {
      throw new Error("Falha ao carregar perfil");
    }

    const data = normalizeProfileResponse(await response.json());
    setUser(data);
    setEmailVerified(Boolean(data.email_verified));
    setProfileForm(buildProfileForm(data));
    if (Array.isArray(data.address) && data.address.length > 0) {
      syncAddresses(data.address);
    }
  }, [handleUnauthorized, setEmailVerified, syncAddresses]);

  const fetchAddresses = useCallback(async () => {
    const response = await apiFetch("/addresses", {
      method: "GET",
      authenticated: true,
      onUnauthorized: handleUnauthorized,
    });

    if (response.status === 404) {
      syncAddresses([]);
      return;
    }

    if (!response.ok) {
      throw new Error("Falha ao carregar endereços.");
    }

    const data = await response.json();
    syncAddresses(Array.isArray(data) ? data.map(normalizeAddress) : []);
  }, [handleUnauthorized, syncAddresses]);

  useEffect(() => {
    if (focusQuery !== "email") {
      return;
    }

    setActiveSection("personal");
    setEditMode(false);

    const timer = window.setTimeout(() => {
      const emailBlock = document.getElementById("profile-email-block");
      emailBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [focusQuery]);

  const fetchSubscriptionSummary = useCallback(async () => {
    const response = await apiFetch("/subscriptions/access-status", {
      method: "GET",
      authenticated: true,
      onUnauthorized: handleUnauthorized,
    });

    if (!response.ok) {
      throw new Error("Falha ao carregar assinatura");
    }

    const data = await response.json().catch(() => ({}));
    setSubscriptionSummary({
      hasValidSubscription: Boolean(data?.has_valid_subscription),
      plan: data?.subscription?.plan || "",
      status: data?.subscription?.status || "",
    });
  }, [handleUnauthorized]);

  useEffect(() => {
    const loadPage = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchProfile(), fetchAddresses(), fetchSubscriptionSummary()]);
      } catch (error) {
        console.error("Erro ao carregar perfil:", error.message);
        setStatus({
          show: true,
          success: false,
          message: "Não foi possível carregar os dados do perfil.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [fetchAddresses, fetchProfile, fetchSubscriptionSummary]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("photo", file);

    try {
      setActionLoading((prev) => ({ ...prev, uploadPhoto: true }));
      const response = await apiFetch("/upload-photo", {
        method: "POST",
        authenticated: true,
        body: uploadData,
        onUnauthorized: handleUnauthorized,
      });

      if (!response.ok) {
        let errorMessage = "Falha no upload";

        try {
          const responseText = await response.text();

          if (responseText) {
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.detail || errorData.error || responseText || errorMessage;
            } catch {
              errorMessage = responseText;
            }
          }
        } catch (parseError) {
          console.error("Erro ao ler resposta do upload:", parseError.message);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setUser((prevUser) => ({ ...prevUser, photo: data.url || prevUser.photo }));
      setStatus({ show: true, success: true, message: "Foto atualizada com sucesso." });
    } catch (error) {
      console.error("Erro no upload da foto:", error.message);
      setStatus({
        show: true,
        success: false,
        message: error.message || "Erro ao atualizar a foto.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, uploadPhoto: false }));
      event.target.value = "";
    }
  };

  const handleProfileChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddressChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === "zipcode" ? onlyDigits(value).slice(0, 8) : value;
    const affectsLocation = ["zipcode", "street", "number", "neighborhood", "city", "state"].includes(name);

    setAddressForm((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(affectsLocation ? { latitude: 0, longitude: 0 } : {}),
    }));

    if (affectsLocation) {
      setShowAddressMap(false);
      setAddressMapCoords(null);
      if (name !== "zipcode") {
        setAddressNotice({
          type: "warning",
          text: "Endereço alterado. Confirme novamente a localização no mapa.",
        });
      }
    }

    if (name === "zipcode" && nextValue.length === 8) {
      handleAddressZipCode(nextValue);
    }
  };

  const handleAddressCoordsChange = ({ latitude, longitude }) => {
    setAddressForm((prev) => ({
      ...prev,
      latitude: Number(latitude || 0),
      longitude: Number(longitude || 0),
    }));
    setAddressNotice({
      type: "success",
      text: "Localização confirmada com sucesso.",
    });
  };

  const handleUseCurrentLocationForNewAddress = useCallback(async () => {
    try {
      const position = await getCurrentBrowserPosition();
      const latitude = Number(position.coords.latitude || 0);
      const longitude = Number(position.coords.longitude || 0);

      if (!latitude || !longitude) {
        throw new Error("invalid");
      }

      setAddressForm((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));
      setAddressMapCoords({ lat: latitude, lon: longitude });
      setAddressNotice({
        type: "info",
        text: "Usamos sua localiza\u00e7\u00e3o atual como ponto de partida. Ajuste o pino no mapa para confirmar o endere\u00e7o.",
      });
      setShowAddressMap(true);
    } catch {
      setAddressNotice({
        type: "info",
        text: "Permita sua localiza\u00e7\u00e3o atual ou preencha o CEP para posicionar o endere\u00e7o no mapa.",
      });
    }
  }, []);

  const handleOpenAddressMap = () => {
    if (!addressForm.latitude || !addressForm.longitude) {
      setAddressNotice({
        type: "warning",
        text: "Preencha o CEP ou o endereço e confirme a localização antes de abrir o mapa.",
      });
      return;
    }

    setAddressMapCoords({
      lat: Number(addressForm.latitude),
      lon: Number(addressForm.longitude),
    });
    setShowAddressMap(true);
  };

  const handleAddressZipCode = async (zipcode) => {
    setAddressCepLoading(true);
    setAddressNotice(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`);
      const data = await response.json();

      if (data?.erro) {
        setAddressNotice({
          type: "error",
          text: "CEP não encontrado. Confira os dígitos informados.",
        });
        return;
      }

      const neighborhood = data.bairro || "";
      const nextAddress = {
        street: data.logradouro || "",
        neighborhood,
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      };

      setAddressForm((prev) => ({
        ...prev,
        ...nextAddress,
        latitude: 0,
        longitude: 0,
      }));

      setAddressNotice({
        type: "info",
        text: "CEP encontrado. Buscando a localização no mapa...",
      });

      const params = new URLSearchParams({
        q: [nextAddress.street, neighborhood, nextAddress.city, nextAddress.state, "Brasil"]
          .filter(Boolean)
          .join(", "),
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
      });

      const nominatimResponse = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`);
      const nominatimData = await nominatimResponse.json();
      const match = Array.isArray(nominatimData) ? nominatimData[0] : null;

      if (!match) {
        setAddressNotice({
          type: "warning",
          text: "Não consegui localizar esse endereço. Abra o mapa manualmente depois de preencher os dados.",
        });
        return;
      }

      const latitude = Number(match.lat);
      const longitude = Number(match.lon);

      setAddressForm((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));
      setAddressMapCoords({ lat: latitude, lon: longitude });
      setAddressNotice({
        type: "success",
        text: "Localização encontrada. Confirme no mapa para continuar.",
      });
      setShowAddressMap(true);
    } catch (_error) {
      setAddressNotice({
        type: "error",
        text: "Erro ao consultar o CEP. Tente novamente.",
      });
    } finally {
      setAddressCepLoading(false);
    }
  };

  const handleAddressRoomChange = (roomId, field, value) => {
    setAddressForm((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]:
                field === "quantity" ? value.replace(/\D/g, "").slice(0, 2) : value,
            }
          : room
      ),
    }));
  };

  const handleAddAddressRoom = () => {
    setAddressForm((prev) => ({
      ...prev,
      rooms: [...prev.rooms, createRoom(prev.rooms.length)],
    }));
    setIsAddressRoomsOpen(true);
  };

  const handleRemoveAddressRoom = (roomId) => {
    setAddressForm((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((room) => room.id !== roomId),
    }));
  };

  const handleProfileSave = async () => {
    try {
      setActionLoading((prev) => ({ ...prev, saveProfile: true }));
      const normalizedProfileForm = {
        ...profileForm,
        experience_years: Number(profileForm.experience_years || 0),
        price_per_hour: Number(profileForm.price_per_hour || 0),
        price_per_day: Number(profileForm.price_per_day || 0),
        specialties: profileForm.specialties
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };

      const response = await apiFetch("/profile", {
        method: "PUT",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedProfileForm),
        onUnauthorized: handleUnauthorized,
      });

      if (!response.ok) {
        throw new Error("Falha na atualizacao");
      }

      const data = normalizeProfileResponse(await response.json());
      setUser(data);
      setEmailVerified(Boolean(data.email_verified));
      setProfileForm(buildProfileForm(data));
      setEditMode(false);
      setStatus({ show: true, success: true, message: "Perfil atualizado com sucesso!" });
    } catch (error) {
      setStatus({ show: true, success: false, message: "Erro ao atualizar perfil." });
    } finally {
      setActionLoading((prev) => ({ ...prev, saveProfile: false }));
    }
  };

  const handleEditToggle = () => {
    if (editMode) {
      setProfileForm(buildProfileForm(user));
    }

    setEditMode((prev) => !prev);
  };

  const openEditAddressForm = (address) => {
    setEditingAddressId(address.ID || address.id);
    setEditingRoomsAddressId(null);
    setAddressForm(buildAddressForm(address));
    if (address.latitude && address.longitude) {
      setAddressMapCoords({
        lat: Number(address.latitude),
        lon: Number(address.longitude),
      });
    } else {
      setAddressMapCoords(null);
    }
    setAddressNotice(null);
    setIsAddressFormOpen(true);
    setIsAddressRoomsOpen(false);
    setActiveSection("addresses");
  };

  const handleResendVerificationEmail = async () => {
    try {
      setEmailResendLoading(true);
      const response = await apiFetch("/auth/email-verification/resend", {
        method: "POST",
        authenticated: true,
        onUnauthorized: handleUnauthorized,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível reenviar o e-mail de ativação.");
      }

      setStatus({
        show: true,
        success: true,
        message: data?.message || "E-mail de ativação reenviado com sucesso.",
      });
    } catch (error) {
      setStatus({
        show: true,
        success: false,
        message: error.message || "Não foi possível reenviar o e-mail de ativação.",
      });
    } finally {
      setEmailResendLoading(false);
    }
  };

  const openInlineRoomsEditor = (address) => {
    const addressId = address.ID || address.id;
    setEditingAddressId(addressId);
    setEditingRoomsAddressId(addressId);
    const nextForm = buildAddressForm(address);
    if (!Array.isArray(nextForm.rooms) || nextForm.rooms.length === 0) {
      nextForm.rooms = [createRoom(0)];
    }
    setAddressForm(nextForm);
    setExpandedAddressRooms((prev) => ({ ...prev, [addressId]: true }));
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
    setShowAddressMap(false);
  };

  const handleAddressSave = async () => {
    try {
      if (!addressForm.latitude || !addressForm.longitude) {
        setAddressNotice({
          type: "warning",
          text: "Confirme a localização do endereço no mapa antes de salvar.",
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
          latitude: Number(addressForm.latitude || 0),
          longitude: Number(addressForm.longitude || 0),
          rooms: normalizedRooms,
        }),
        onUnauthorized: handleUnauthorized,
      });

      if (!response.ok) {
      throw new Error("Falha ao salvar o endereço.");
      }

      await fetchAddresses();
      closeAddressForm();
      setStatus({
        show: true,
        success: true,
        message: editingAddressId
          ? "Endereço atualizado com sucesso."
          : "Endereço adicionado com sucesso.",
      });
    } catch (error) {
      setStatus({ show: true, success: false, message: "Erro ao salvar o endereço." });
    } finally {
      setActionLoading((prev) => ({ ...prev, saveAddress: false }));
    }
  };

  const handleDeleteAddress = async (addressId) => {
    try {
      setActionLoading((prev) => ({ ...prev, deleteAddressId: addressId }));
      const response = await apiFetch(`/addresses/${addressId}`, {
        method: "DELETE",
        authenticated: true,
        onUnauthorized: handleUnauthorized,
      });

      if (!response.ok) {
      throw new Error("Falha ao excluir o endereço.");
      }

      await fetchAddresses();
      setStatus({ show: true, success: true, message: "Endereço removido com sucesso." });
    } catch (error) {
      setStatus({ show: true, success: false, message: "Erro ao excluir o endereço." });
    } finally {
      setActionLoading((prev) => ({ ...prev, deleteAddressId: null }));
    }
  };

  const closeModal = () => setStatus((prev) => ({ ...prev, show: false }));
  const openPhotoPicker = () => setPhotoPickerOpen(true);
  const closePhotoPicker = () => setPhotoPickerOpen(false);

  const triggerPhotoInput = (inputId) => {
    closePhotoPicker();
    document.getElementById(inputId)?.click();
  };

  const subscriptionLabel = formatSubscriptionPlan(
    subscriptionSummary.plan,
    subscriptionSummary.hasValidSubscription
  );
  const subscriptionStatusLabel = subscriptionSummary.status
    ? String(subscriptionSummary.status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : subscriptionSummary.hasValidSubscription
    ? "Ativa"
    : "Sem assinatura";
  const diaristSpecialties = parseSpecialties(user.diarist_profile?.specialties);
  const heroBadges = [
    { key: "role", tone: "primary", icon: <UserOutlined />, label: formatRole(user.role) },
    {
      key: "subscription",
      tone: subscriptionSummary.hasValidSubscription ? "success" : "muted",
      icon: <SafetyCertificateOutlined />,
      label: user.is_test_user ? "Usuário de teste" : subscriptionLabel,
    },
    {
      key: "email",
      tone: "default",
      icon: <CheckCircleFilled />,
      label: user.email ? "E-mail cadastrado" : "E-mail pendente",
      tooltip: user.email || "Adicione um e-mail para completar sua conta",
    },
  ];
  const heroMetrics = [
    {
      label: "Membro desde",
      value: formatDate(user.created_at),
    },
    {
      label: "Endereços",
      value: `${addresses.length || 0} cadastrado(s)`,
    },
    ...(isDiarist
      ? [
          {
            label: "Experiência",
            value: `${user.diarist_profile?.experience_years || 0} anos`,
          },
        ]
      : [
          {
            label: "Frequencia favorita",
            value:
              frequencyLabels[user.user_profile?.desired_frequency] || "Não informado",
          },
        ]),
  ];

  return (
    <motion.main
      className="profile-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {loading ? (
        <ProfileHeroSkeleton />
      ) : (
      <motion.header className="profile-hero" variants={cardReveal} initial="hidden" animate="show">
        <input
          type="file"
          id="photoGalleryInput"
          style={{ display: "none" }}
          accept="image/*"
          onChange={handlePhotoChange}
        />
        <input
          type="file"
          id="photoCameraInput"
          style={{ display: "none" }}
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
        />

        <div className="profile-hero-main">
          <div className="profile-avatar-shell">
            <div
              className="profile-avatar-container"
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onClick={() => {
                if (!actionLoading.uploadPhoto) {
                  openPhotoPicker();
                }
              }}
              title="Atualizar foto do perfil"
            >
              <img
                src={user.photo}
                alt={user.name}
                className="profile-avatar"
                style={{ cursor: "pointer" }}
              />
              {(hover || actionLoading.uploadPhoto) && (
                <div className="overlay">
                  {actionLoading.uploadPhoto ? "Enviando foto..." : "Trocar foto"}
                </div>
              )}
            </div>
            <button
              type="button"
              className={`profile-edit-fab ${editMode ? "is-active" : ""}`}
              onClick={handleEditToggle}
              aria-label={editMode ? "Cancelar edição" : "Editar informações"}
              title={editMode ? "Cancelar edição" : "Editar informações"}
            >
              <EditOutlined />
            </button>
          </div>

          <div className="profile-hero-copy">
            <span className="profile-kicker">Meu perfil</span>
            <h1>{user.name || "Carregando perfil..."}</h1>

            <div className="profile-identity-row">
              {heroBadges.map((badge) => (
                <SecurityBadge
                  key={badge.key}
                  icon={badge.icon}
                  label={badge.label}
                  tone={badge.tone}
                  tooltip={badge.tooltip}
                />
              ))}
            </div>

            <div className="profile-hero-metrics">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="profile-hero-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {photoPickerOpen && (
            <motion.div
              className="photo-picker-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePhotoPicker}
            >
              <motion.div
                className="photo-picker-drawer"
                initial={{ opacity: 0, y: -48 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -32 }}
                transition={{ duration: 0.18 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="photo-picker-handle" />
                <span className="photo-picker-kicker">Foto de perfil</span>
                <h3>Escolha como enviar sua foto</h3>
                <p className="photo-picker-description">Selecione a câmera para tirar uma foto agora ou abra a galeria do aparelho.</p>
                <div className="photo-picker-actions">
                  <button
                    type="button"
                    className="photo-picker-option"
                    onClick={() => triggerPhotoInput("photoCameraInput")}
                    disabled={actionLoading.uploadPhoto}
                  >
                    <strong>Câmera</strong>
                    <span>Tirar uma foto agora</span>
                  </button>
                  <button
                    type="button"
                    className="photo-picker-option"
                    onClick={() => triggerPhotoInput("photoGalleryInput")}
                    disabled={actionLoading.uploadPhoto}
                  >
                    <strong>Galeria</strong>
                    <span>Escolher uma imagem do aparelho</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="photo-picker-cancel"
                  onClick={closePhotoPicker}
                  disabled={actionLoading.uploadPhoto}
                >
                  {actionLoading.uploadPhoto ? "Enviando..." : "Cancelar"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      )}

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-sidebar-card">
            <span className="profile-sidebar-title">Painel</span>
            <p className="profile-sidebar-copy">
              Navegue entre seus dados, preferências e endereços com edição inline.
            </p>
            <SidebarButton
              active={activeSection === "personal"}
              label="Informações"
              description="Conta, preferências e segurança"
              icon={<IdcardOutlined />}
              onClick={() => setActiveSection("personal")}
            />
            <SidebarButton
              active={activeSection === "addresses"}
              label="Endereços"
              description="Residências e cômodos"
              icon={<EnvironmentOutlined />}
              onClick={() => setActiveSection("addresses")}
            />
          </div>
        </aside>

        <section className="profile-content">
          {loading ? (
            <ProfilePanelSkeleton />
          ) : activeSection === "personal" ? (
            <motion.div
              className="profile-panel"
              variants={pageStagger}
              initial="hidden"
              animate="show"
            >
              <div className="profile-panel-head">
                <div>
                  <span className="profile-panel-kicker">Informações pessoais</span>
                  <h2>Dados da conta e perfil</h2>
                  <p className="profile-panel-description">
                    Edite seus dados sem sair da tela e acompanhe o status da sua conta em tempo real.
                  </p>
                </div>
                <button
                  className={`profile-edit-icon-button ${editMode ? "is-active" : ""}`}
                  onClick={handleEditToggle}
                  aria-label={editMode ? "Cancelar edição" : "Editar informações"}
                  type="button"
                >
                  <EditOutlined />
                </button>
              </div>

              <div className="profile-section-grid">
                <SectionCard
                  icon={<IdcardOutlined />}
                  title="Conta"
                  description="Dados essenciais da sua conta, contato e identificação."
                  className={`profile-account-card ${isDiarist ? "is-diarist" : ""}`}
                >
                  {editMode ? (
                    <div className="profile-stack">
                      <div className="profile-form-grid">
                        <div className="field">
                          <label>Nome</label>
                          <input name="name" value={profileForm.name} onChange={handleProfileChange} />
                        </div>

                        <div className="field">
                          <label>E-mail</label>
                          <input name="email" value={profileForm.email} onChange={handleProfileChange} />
                        </div>

                        <div className="field">
                          <label>Telefone</label>
                          <input name="phone" value={profileForm.phone} onChange={handleProfileChange} />
                        </div>

                        <div className="field">
                          <label>CPF</label>
                          <input value={maskCpf(user.cpf)} disabled />
                        </div>
                      </div>

                      {!isDiarist && (
                        <div className="profile-inline-subsection">
                          <div className="profile-inline-subsection__head">
                            <span className="profile-inline-subsection__title">
                              Preferências do serviço
                            </span>
                            <small>Ajuste como sua residência e sua rotina devem aparecer.</small>
                          </div>

                          <div className="profile-form-grid">
                            <div className="field">
                              <label>Frequência desejada</label>
                              <select
                                name="desired_frequency"
                                value={profileForm.desired_frequency}
                                onChange={handleProfileChange}
                              >
                                <option value="once">Uma vez</option>
                                <option value="weekly">Semanal</option>
                                <option value="biweekly">Quinzenal</option>
                                <option value="monthly">Mensal</option>
                                <option value="occasional">Eventual</option>
                              </select>
                            </div>

                            <div className="field field-full">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  name="has_pets"
                                  checked={profileForm.has_pets}
                                  onChange={handleProfileChange}
                                />
                                Possui pets na residência
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="profile-stack">
                      <div className="profile-info-list">
                        <div className="profile-info-row">
                          <span>ID da conta</span>
                          <strong>#{user.id || "Não informado"}</strong>
                        </div>
                        <div className="profile-info-row">
                          <span>Nome</span>
                          <strong>{user.name || "Não informado"}</strong>
                        </div>
                        <div className="profile-info-row" id="profile-email-block">
                          <span>Email</span>
                          <div className="profile-email-row">
                            <strong>{user.email || "Não informado"}</strong>
                            {user.email && !user.email_verified ? (
                              <button
                                type="button"
                                className="ghost-button profile-email-action"
                                onClick={handleResendVerificationEmail}
                                disabled={emailResendLoading}
                              >
                                {emailResendLoading ? "Enviando..." : "Ativar e-mail"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="profile-info-row">
                          <span>Telefone</span>
                          <strong>{user.phone || "Não informado"}</strong>
                        </div>
                        <div className="profile-info-row">
                          <span>CPF</span>
                          <strong>{maskCpf(user.cpf)}</strong>
                        </div>
                        <div className="profile-info-row">
                          <span>Papel</span>
                          <strong>{formatRole(user.role)}</strong>
                        </div>
                      </div>

                      <div className="profile-inline-subsection">
                        <div className="profile-inline-subsection__head">
                          <span className="profile-inline-subsection__title">
                            Cadastro
                          </span>
                          <small>Metadados principais da sua conta no sistema.</small>
                        </div>
                        <div className="profile-info-list compact">
                          <div className="profile-info-row">
                            <span>Criado em</span>
                            <strong>{formatDate(user.created_at)}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Tipo de conta</span>
                            <strong>{user.is_test_user ? "Usuário de teste" : "Conta principal"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Total de endereços</span>
                            <strong>{addresses.length || 0}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>
                              {isDiarist ? "ID do perfil profissional" : "ID do perfil cliente"}
                            </span>
                            <strong>
                              #
                              {isDiarist
                                ? user.diarist_profile?.id || "Não informado"
                                : user.user_profile?.id || "Não informado"}
                            </strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Vinculado ao usuário</span>
                            <strong>
                              #
                              {isDiarist
                                ? user.diarist_profile?.user_id || user.id || "Não informado"
                                : user.user_profile?.user_id || user.id || "Não informado"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {!isDiarist && (
                        <div className="profile-inline-subsection">
                          <div className="profile-inline-subsection__head">
                            <span className="profile-inline-subsection__title">
                              Preferências do serviço
                            </span>
                            <small>Como você prefere contratar e receber serviços.</small>
                          </div>
                          <div className="profile-info-list compact">
                            <div className="profile-info-row">
                              <span>Frequência desejada</span>
                              <strong>
                                {frequencyLabels[user.user_profile?.desired_frequency] || "Não informado"}
                              </strong>
                            </div>
                            <div className="profile-info-row">
                              <span>Possui pets</span>
                              <strong>{user.user_profile?.has_pets ? "Sim" : "Não"}</strong>
                            </div>
                            <div className="profile-info-row">
                              <span>ID do perfil cliente</span>
                              <strong>#{user.user_profile?.id || "Não informado"}</strong>
                            </div>
                            <div className="profile-info-row">
                              <span>Perfil vinculado ao usuário</span>
                              <strong>#{user.user_profile?.user_id || user.id || "Não informado"}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>

                {isDiarist && (
                  <SectionCard
                    icon={<FileTextOutlined />}
                    title="Perfil profissional"
                  description="Resumo da sua apresentação, experiência, precificação e disponibilidade."
                    className="profile-professional-card"
                  >
                    {editMode ? (
                      <div className="profile-form-grid">
                        <div className="field field-full">
                          <label>Bio profissional</label>
                          <textarea
                            name="bio"
                            value={profileForm.bio}
                            onChange={handleProfileChange}
                        placeholder="Descreva sua experiência, perfil de atendimento e diferencial."
                          />
                        </div>

                        <div className="field">
                          <label>Anos de experiência</label>
                          <input
                            name="experience_years"
                            type="number"
                            min="0"
                            value={profileForm.experience_years}
                            onChange={handleProfileChange}
                          />
                        </div>

                        <div className="field">
                          <label>Status profissional</label>
                          <select
                            name="available"
                            value={profileForm.available ? "true" : "false"}
                            onChange={(event) =>
                              setProfileForm((prev) => ({
                                ...prev,
                                available: event.target.value === "true",
                              }))
                            }
                          >
                            <option value="true">Disponivel</option>
                            <option value="false">Indisponivel</option>
                          </select>
                        </div>

                        <div className="field">
                          <label>Preco por hora</label>
                          <input
                            name="price_per_hour"
                            type="number"
                            min="0"
                            step="0.01"
                            value={profileForm.price_per_hour}
                            onChange={handleProfileChange}
                          />
                        </div>

                        <div className="field">
                          <label>Preço por diária</label>
                          <input
                            name="price_per_day"
                            type="number"
                            min="0"
                            step="0.01"
                            value={profileForm.price_per_day}
                            onChange={handleProfileChange}
                          />
                        </div>

                        <div className="field field-full">
                          <label>Especialidades</label>
                          <input
                            name="specialties"
                            value={profileForm.specialties}
                            onChange={handleProfileChange}
                            placeholder="Ex.: Pos obra, passadoria, limpeza pesada"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="profile-stack">
                        <div className="profile-inline-subsection">
                          <div className="profile-inline-subsection__head">
                            <span className="profile-inline-subsection__title">
                              Apresentacao
                            </span>
                            <small>Descrição pública exibida para clientes.</small>
                          </div>
                          <p className="profile-bio-copy">
                            {user.diarist_profile?.bio || "Nenhuma bio profissional cadastrada ainda."}
                          </p>
                        </div>

                        <div className="profile-info-list compact">
                          <div className="profile-info-row">
                            <span>ID do perfil profissional</span>
                          <strong>#{user.diarist_profile?.id || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Perfil vinculado ao usuario</span>
                          <strong>#{user.diarist_profile?.user_id || user.id || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                          <span>Anos de experiência</span>
                            <strong>{`${user.diarist_profile?.experience_years || 0} anos`}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Preco por hora</span>
                            <strong>{formatCurrency(user.diarist_profile?.price_per_hour)}</strong>
                          </div>
                          <div className="profile-info-row">
                          <span>Preço por diária</span>
                            <strong>{formatCurrency(user.diarist_profile?.price_per_day)}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Disponibilidade</span>
                            <strong>
                              {formatBoolean(
                                user.diarist_profile?.available,
                            "Disponível para serviços",
                                "Indisponivel no momento"
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="profile-inline-subsection">
                          <div className="profile-inline-subsection__head">
                            <span className="profile-inline-subsection__title">
                              Especialidades
                            </span>
                          <small>Serviços e contextos em que você atua melhor.</small>
                          </div>
                          {diaristSpecialties.length > 0 ? (
                            <div className="profile-specialty-grid">
                              {diaristSpecialties.map((specialty) => (
                                <div key={specialty} className="profile-specialty-card">
                                  <span className="profile-specialty-card__icon" aria-hidden="true">
                                    {getSpecialtyPresentation(specialty).icon}
                                  </span>
                                  <span className="profile-specialty-card__label">
                                    {getSpecialtyPresentation(specialty).label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="profile-note-copy">
                              Nenhuma especialidade cadastrada ainda.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </SectionCard>
                )}

                <SectionCard
                  icon={<SafetyCertificateOutlined />}
                  title="Seguranca e status"
                  description="Sinais de confiança da sua conta, validação e contexto operacional."
                  className="profile-security-card"
                >
                  <div className="profile-security-grid">
                    <div className="profile-security-row">
                      <span>Email principal</span>
                      <strong>{user.email || "Não informado"}</strong>
                    </div>
                    <div className="profile-security-row">
                      <span>Status do email</span>
                      <SecurityBadge
                        icon={<CheckCircleFilled />}
                        label={
                          !user.email
                            ? "Pendente"
                            : user.email_verified
                            ? "Verificado"
                            : "Não verificado"
                        }
                        tone={
                          !user.email
                            ? "muted"
                            : user.email_verified
                            ? "success"
                            : "default"
                        }
                        tooltip={
                          user.email
                            ? user.email_verified
                              ? "E-mail verificado"
                              : "Use o botão ao lado do e-mail para reenviar a ativação"
                            : "Cadastre um email para fortalecer sua conta"
                        }
                      />
                    </div>
                    <div className="profile-security-row">
                      <span>Plano</span>
                      <strong>{subscriptionLabel}</strong>
                    </div>
                    <div className="profile-security-row">
                      <span>Status da assinatura</span>
                      <strong>{subscriptionStatusLabel}</strong>
                    </div>
                    <div className="profile-security-row">
                      <span>{isDiarist ? "Diarista desde" : "Cliente desde"}</span>
                      <strong>{formatDate(user.created_at)}</strong>
                    </div>
                    <div className="profile-security-row">
                      <span>Ambiente</span>
                      <strong>{user.is_test_user ? "Usuario teste" : "Conta principal"}</strong>
                    </div>
                  </div>

                  {editMode && (
                    <div className="profile-inline-actions">
                      <button
                        className="save-button"
                        onClick={handleProfileSave}
                        disabled={actionLoading.saveProfile}
                      >
                        {actionLoading.saveProfile ? "Salvando..." : "Salvar alteracoes"}
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="profile-panel"
              variants={pageStagger}
              initial="hidden"
              animate="show"
            >
              <div className="profile-panel-head">
                <div>
                  <span className="profile-panel-kicker">Endereços</span>
          <h2>Gerencie seus endereços cadastrados</h2>
                  <p className="profile-panel-description">
            Organize residências, complemente as informações e ajuste os cômodos com edição inline.
                  </p>
                </div>
                {!isAddressFormOpen ? (
                    <button
                      className="profile-panel-add-button"
                      onClick={() => {
                        setEditingAddressId(null);
                        setAddressForm(defaultAddressForm);
                        setAddressMapCoords(null);
                        setAddressNotice(null);
                        setIsAddressFormOpen(true);
                        setIsAddressRoomsOpen(false);
                        handleUseCurrentLocationForNewAddress();
                      }}
            aria-label="Adicionar endereço"
                    type="button"
                  >
                    <PlusOutlined />
            <span>Adicionar endereço</span>
                  </button>
                ) : (
                  <button
                    className="profile-icon-action-button is-active"
                    onClick={closeAddressForm}
                    disabled={actionLoading.saveAddress}
                    aria-label="Fechar formulario"
                    type="button"
                  >
                    <DownOutlined />
                  </button>
                )}
              </div>

                {isAddressFormOpen && (
                  <motion.div className="profile-card address-form-card" variants={cardReveal}>
                    <div className="address-card-head">
                      <div>
                        <span className="address-card-kicker">Endereço cadastrado</span>
                    <h3>{editingAddressId ? "Editar endereço" : "Adicionar endereço"}</h3>
                      </div>
                    </div>

                    {addressNotice && (
                      <div className={`status-card status-card--${addressNotice.type || "info"}`}>
                        {addressNotice.text}
                      </div>
                    )}

                    <div className="profile-form-grid">
                      <div className="field">
                        <label>CEP</label>
                        <input
                          name="zipcode"
                          value={formatCep(addressForm.zipcode || "")}
                          onChange={handleAddressChange}
                          maxLength={9}
                        />
                      </div>

                      <div className="field field-full">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            const zipcode = onlyDigits(addressForm.zipcode);
                            if (zipcode.length !== 8) {
                              setAddressNotice({
                                type: "warning",
                                text: "Informe um CEP válido com 8 dígitos.",
                              });
                              return;
                            }
                            handleAddressZipCode(zipcode);
                          }}
                          disabled={addressCepLoading}
                        >
                          {addressCepLoading ? "Buscando CEP..." : "Buscar endereço pelo CEP"}
                        </button>
                      </div>

                      <div className="field field-full">
                        <label>Rua</label>
                        <input name="street" value={addressForm.street} onChange={handleAddressChange} />
                    </div>

                    <div className="field">
                      <label>Número</label>
                      <input name="number" value={addressForm.number} onChange={handleAddressChange} />
                    </div>

                    <div className="field">
                      <label>Tipo de residência</label>
                      <select
                        name="residence_type"
                        value={addressForm.residence_type}
                        onChange={handleAddressChange}
                      >
                        <option value="apartment">Apartamento</option>
                        <option value="house">Casa</option>
                        <option value="office">Escritório</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Complemento</label>
                      <input name="complement" value={addressForm.complement} onChange={handleAddressChange} />
                    </div>

                    <div className="field">
                      <label>Bairro</label>
                      <input name="neighborhood" value={addressForm.neighborhood} onChange={handleAddressChange} />
                    </div>

                    <div className="field">
                      <label>Ponto de referência</label>
                      <input
                        name="reference_point"
                        value={addressForm.reference_point}
                        onChange={handleAddressChange}
                      />
                    </div>

                    <div className="field">
                      <label>Cidade</label>
                      <input name="city" value={addressForm.city} onChange={handleAddressChange} />
                    </div>

                      <div className="field">
                        <label>Estado</label>
                        <input name="state" value={addressForm.state} onChange={handleAddressChange} />
                      </div>

                      <div className="field field-full">
                        <label>Coordenadas atuais</label>
                        <input
                          value={formatCoordinates(addressForm.latitude, addressForm.longitude)}
                          readOnly
                        />
                      </div>

                      <div className="field field-full">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={handleOpenAddressMap}
                        >
                          Confirmar localização no mapa
                        </button>
                      </div>
                    </div>

                  {!isDiarist && (
                    <div className="profile-address-rooms">
                      <button
                        type="button"
                        className={`profile-rooms-toggle ${isAddressRoomsOpen ? "is-open" : ""}`}
                        onClick={() => setIsAddressRoomsOpen((prev) => !prev)}
                        aria-expanded={isAddressRoomsOpen}
                      >
                        <div className="profile-rooms-toggle__copy">
                          <span className="profile-rooms-toggle__title">Cômodos</span>
                          <span className="profile-rooms-toggle__subtitle">
                            Mostre os ambientes da residência e ajuste quando necessário.
                          </span>
                        </div>
                        <div className="profile-rooms-toggle__meta">
                          <span className="profile-rooms-count">
                            {formatRoomSummary(addressForm.rooms)}
                          </span>
                          <span className="profile-rooms-toggle__icon" aria-hidden="true">
                            <DownOutlined />
                          </span>
                        </div>
                      </button>

                      <div className={`profile-rooms-panel ${isAddressRoomsOpen ? "is-open" : ""}`}>
                        <button
                          type="button"
                          className="profile-room-add-button"
                          onClick={handleAddAddressRoom}
                        >
                          <PlusOutlined />
                          Adicionar cômodo
                        </button>

                        {addressForm.rooms.length > 0 ? (
                          <div className="profile-room-list">
                            {addressForm.rooms.map((room, index) => (
                              <div className="profile-room-row" key={room.id}>
                                <div className="profile-room-row__fields">
                                  <div className="field">
                                    <label>Nome do cômodo {index + 1}</label>
                                    <input
                                      value={room.name}
                                      placeholder="Ex.: Banheiro"
                                      onChange={(event) =>
                                        handleAddressRoomChange(room.id, "name", event.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="field profile-room-row__quantity">
                                    <label>Quantidade</label>
                                    <input
                                      value={room.quantity}
                                      placeholder="1"
                                      onChange={(event) =>
                                        handleAddressRoomChange(
                                          room.id,
                                          "quantity",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="profile-room-row__remove"
                                  onClick={() => handleRemoveAddressRoom(room.id)}
                                  aria-label={`Remover cômodo ${index + 1}`}
                                >
                                  <DeleteOutlined />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="profile-rooms-empty">
                            Nenhum cômodo cadastrado ainda para este endereço.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="address-form-actions">
                    <button
                      className="save-button inline"
                      onClick={handleAddressSave}
                      disabled={actionLoading.saveAddress}
                    >
                      {actionLoading.saveAddress
                        ? "Salvando..."
                        : editingAddressId
                        ? "Salvar endereço"
                        : "Adicionar endereço"}
                    </button>
                    <button
                      className="ghost-button"
                      onClick={closeAddressForm}
                      disabled={actionLoading.saveAddress}
                    >
                      {actionLoading.saveAddress ? "Aguarde..." : "Cancelar"}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="addresses-grid">
                {addresses.length > 0 ? (
                  addresses.map((address) => {
                    const addressId = address.ID || address.id;
                    return (
                      <motion.article
                        key={addressId}
                        className="profile-card address-card"
                        variants={cardReveal}
                      >
                        <div className="address-card-head">
                          <div>
                            <span className="address-card-kicker">Endereço cadastrado</span>
                            <h3>{formatAddress(address)}</h3>
                          </div>
                          <button
                            className="address-card-edit-icon"
                            onClick={() => openEditAddressForm(address)}
                            disabled={actionLoading.deleteAddressId === addressId}
                            aria-label="Editar endereço"
                            type="button"
                          >
                            <EditOutlined />
                          </button>
                        </div>

                        <div className="profile-info-list compact">
                          <div className="profile-info-row">
                            <span>ID do endereço</span>
                            <strong>#{addressId}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Tipo do endereço</span>
                            <strong>{residenceTypeLabels[address.residence_type || address.ResidenceType] || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Complemento</span>
                            <strong>{address.complement || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Bairro</span>
                            <strong>{address.neighborhood || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Cidade / Estado</span>
                            <strong>
                              {[address.city, address.state].filter(Boolean).join(" / ") || "Não informado"}
                            </strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Ponto de referência</span>
                            <strong>{address.reference_point || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>CEP</span>
                            <strong>{address.zipcode || "Não informado"}</strong>
                          </div>
                          <div className="profile-info-row">
                            <span>Coordenadas</span>
                            <strong>{formatCoordinates(address.latitude, address.longitude)}</strong>
                          </div>
                        </div>

                        {!isDiarist && (
                          <div className="profile-address-rooms profile-address-rooms--card">
                            <button
                              type="button"
                              className={`profile-rooms-toggle ${
                                expandedAddressRooms[addressId] ? "is-open" : ""
                              }`}
                              onClick={() =>
                                setExpandedAddressRooms((prev) => ({
                                  ...prev,
                                  [addressId]: !prev[addressId],
                                }))
                              }
                              aria-expanded={Boolean(expandedAddressRooms[addressId])}
                            >
                              <div className="profile-rooms-toggle__copy">
                                <span className="profile-rooms-toggle__title">Cômodos</span>
                                <span className="profile-rooms-toggle__subtitle">
                                  Veja os ambientes cadastrados para este endereço.
                                </span>
                              </div>
                              <div className="profile-rooms-toggle__meta">
                                <span className="profile-rooms-count">
                                  {formatRoomSummary(address.rooms)}
                                </span>
                                <span className="profile-rooms-toggle__icon" aria-hidden="true">
                                  <DownOutlined />
                                </span>
                              </div>
                            </button>

                            <div
                              className={`profile-rooms-panel ${
                                expandedAddressRooms[addressId] ? "is-open" : ""
                              }`}
                            >
                              {editingRoomsAddressId === addressId ? (
                                <div className="profile-inline-rooms-editor">
                                  <button
                                    type="button"
                                    className="profile-room-add-button"
                                    onClick={handleAddAddressRoom}
                                  >
                                    <PlusOutlined />
                                    Adicionar cômodo
                                  </button>

                                  {addressForm.rooms.length > 0 ? (
                                    <div className="profile-room-list">
                                      {addressForm.rooms.map((room, index) => (
                                        <div className="profile-room-row" key={room.id}>
                                          <div className="profile-room-row__fields">
                                            <div className="field">
                                              <label>Nome do cômodo {index + 1}</label>
                                              <input
                                                value={room.name}
                                                placeholder="Ex.: Banheiro"
                                                onChange={(event) =>
                                                  handleAddressRoomChange(
                                                    room.id,
                                                    "name",
                                                    event.target.value
                                                  )
                                                }
                                              />
                                            </div>

                                            <div className="field profile-room-row__quantity">
                                              <label>Quantidade</label>
                                              <input
                                                value={room.quantity}
                                                placeholder="1"
                                                onChange={(event) =>
                                                  handleAddressRoomChange(
                                                    room.id,
                                                    "quantity",
                                                    event.target.value
                                                  )
                                                }
                                              />
                                            </div>
                                          </div>

                                          <button
                                            type="button"
                                            className="profile-room-row__remove"
                                            onClick={() => handleRemoveAddressRoom(room.id)}
                                            aria-label={`Remover cômodo ${index + 1}`}
                                          >
                                            <DeleteOutlined />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="profile-rooms-empty">
                                      Nenhum cômodo cadastrado neste endereço.
                                    </p>
                                  )}

                                  <div className="address-form-actions profile-inline-rooms-actions">
                                    <button
                                      className="save-button inline"
                                      onClick={handleAddressSave}
                                      disabled={actionLoading.saveAddress}
                                    >
                                      {actionLoading.saveAddress ? "Salvando..." : "Salvar cômodos"}
                                    </button>
                                    <button
                                      className="ghost-button"
                                      onClick={closeInlineRoomsEditor}
                                      disabled={actionLoading.saveAddress}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="profile-room-add-button"
                                    onClick={() => openInlineRoomsEditor(address)}
                                  >
                                    <PlusOutlined />
                                    Adicionar cômodo
                                  </button>

                                  {Array.isArray(address.rooms) && address.rooms.length > 0 ? (
                                    <div className="profile-room-summary-list">
                                      {address.rooms.map((room, index) => (
                                        <div className="profile-room-summary" key={room.id || index}>
                                          <div className="profile-room-summary__main">
                                            <HomeOutlined />
                                            <span>{room.name || "Cômodo sem nome"}</span>
                                          </div>
                                          <strong>{room.quantity || 0}x</strong>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="profile-rooms-empty">
                                      Nenhum cômodo cadastrado neste endereço.
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="address-card-actions">
                          <button
                            className="danger-button small"
                            onClick={() => handleDeleteAddress(addressId)}
                            disabled={actionLoading.deleteAddressId === addressId}
                          >
                            {actionLoading.deleteAddressId === addressId ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      </motion.article>
                    );
                  })
                ) : (
                  <motion.div className="profile-card profile-empty-state-card" variants={cardReveal}>
                    <p className="profile-empty-copy">
                      Nenhum endereço cadastrado ainda. Adicione o primeiro endereço para completar seu perfil.
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </section>
      </div>

      <MapModal
        visible={showAddressMap}
        coords={addressMapCoords}
        onCoordsChange={handleAddressCoordsChange}
        onClose={() => setShowAddressMap(false)}
      />

      <AnimatePresence>
        {status.show && (
          <motion.div
            className="status-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`status-modal ${status.success ? "success" : "error"}`}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2>{status.success ? "Sucesso" : "Erro"}</h2>
              <p>{status.message}</p>
              <button onClick={closeModal}>Fechar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
};

export default ProfilePage;

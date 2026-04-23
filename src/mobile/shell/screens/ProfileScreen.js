import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../../../config/api";
import MapConfirmModal from "../../MapConfirmModal";
import { palette, styles } from "../AppShell.styles";
import EmptyState from "../components/EmptyState";
import SectionCard from "../components/SectionCard";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "LimpaeExpo/1.0 (+https://limpae.app; contato: suporte@limpae.app)";
const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent": NOMINATIM_USER_AGENT,
};

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

const diaristSpecialtyMeta = {
  basic_cleaning: { label: "Limpeza Basica", icon: "wind" },
  heavy_cleaning: { label: "Limpeza Pesada", icon: "droplet" },
  ironing: { label: "Passar Roupa", icon: "shopping-bag" },
  post_work: { label: "Pos-obra", icon: "tool" },
  organization: { label: "Organizacao", icon: "folder" },
  window_cleaning: { label: "Janelas", icon: "layout" },
  carpet_cleaning: { label: "Tapetes", icon: "grid" },
  cooking: { label: "Cozinhar", icon: "coffee" },
};

const residenceTypeLabels = {
  apartment: "Apartamento",
  house: "Casa",
  office: "Escritorio",
  studio: "Studio",
};

const frequencyLabels = {
  once: "Uma vez",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  occasional: "Eventual",
};

function onlyDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function formatCep(value = "") {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function normalizeRoom(room = {}, index = 0) {
  return {
    id: room?.id || room?.ID || `room-${index}`,
    name: room?.name || room?.Name || "",
    quantity: String(room?.quantity || room?.Quantity || ""),
  };
}

function createRoom(index = 0) {
  return {
    id: `${Date.now()}-${index}`,
    name: "",
    quantity: "",
  };
}

function parseSpecialties(value) {
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

function getProfilePhoto(profile = {}) {
  return (
    profile?.photo ||
    profile?.Photo ||
    profile?.profile_photo ||
    profile?.profilePhoto ||
    profile?.avatar ||
    profile?.Avatar ||
    ""
  );
}

function normalizeAddress(address = {}) {
  return {
    id: address.id || address.ID || null,
    street: address.street || address.Street || "",
    number: address.number || address.Number || "",
    residence_type: address.residence_type || address.ResidenceType || "apartment",
    complement: address.complement || address.Complement || "",
    neighborhood: address.neighborhood || address.Neighborhood || "",
    reference_point:
      address.reference_point || address.referencePoint || address.ReferencePoint || "",
    city: address.city || address.City || "",
    state: address.state || address.State || "",
    zipcode: address.zipcode || address.Zipcode || "",
    latitude: Number(address.latitude || address.Latitude || 0),
    longitude: Number(address.longitude || address.Longitude || 0),
    rooms: Array.isArray(address.rooms || address.Rooms)
      ? (address.rooms || address.Rooms).map(normalizeRoom)
      : [],
  };
}

function formatAddress(address = {}) {
  return [address?.street, address?.number, address?.neighborhood, address?.city, address?.state]
    .filter(Boolean)
    .join(", ");
}

function formatAddressWithComplement(address = {}) {
  return [
    address?.street,
    address?.number,
    address?.complement,
    address?.neighborhood,
    address?.city,
    address?.state,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatAddressStreetLine(address = {}) {
  return [address?.street, address?.number, address?.complement].filter(Boolean).join(", ");
}

function formatAddressDistrictLine(address = {}) {
  const district = [address?.neighborhood, address?.city].filter(Boolean).join(" • ");
  return [district, address?.state].filter(Boolean).join(" - ");
}

function formatCoordinates(latitude, longitude) {
  if (!latitude || !longitude) return "Localizacao ainda nao confirmada";
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

function formatDate(value) {
  if (!value) return "Nao informado";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Nao informado";
  return parsedDate.toLocaleDateString("pt-BR");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getAddressRooms(address = {}) {
  return Array.isArray(address?.rooms || address?.Rooms) ? address.rooms || address.Rooms : [];
}

function getTotalRoomCount(address = {}) {
  return getAddressRooms(address).reduce((total, room) => {
    return total + Math.max(0, Number(room?.quantity || room?.Quantity || 0));
  }, 0);
}

function buildProfileForm(profile = {}) {
  const diaristProfile = profile?.diarist_profile || profile?.DiaristProfile || {};
  const userProfile = profile?.user_profile || profile?.UserProfile || {};

  return {
    name: profile?.name || profile?.Name || "",
    email: profile?.email || profile?.Email || "",
    phone: profile?.phone ? String(profile.phone) : String(profile?.Phone || ""),
    bio: diaristProfile?.bio || diaristProfile?.Bio || "",
    experience_years: String(diaristProfile?.experience_years || diaristProfile?.ExperienceYears || 0),
    desired_frequency: userProfile?.desired_frequency || userProfile?.DesiredFrequency || "weekly",
    has_pets: Boolean(userProfile?.has_pets ?? userProfile?.HasPets),
    price_per_hour: String(diaristProfile?.price_per_hour || diaristProfile?.PricePerHour || 0),
    price_per_day: String(diaristProfile?.price_per_day || diaristProfile?.PricePerDay || 0),
    specialties: parseSpecialties(diaristProfile?.specialties || diaristProfile?.Specialties).join(", "),
    available:
      typeof diaristProfile?.available === "boolean"
        ? diaristProfile.available
        : typeof diaristProfile?.Available === "boolean"
          ? diaristProfile.Available
          : true,
  };
}

function buildAddressForm(address = {}) {
  return {
    street: address.street || "",
    number: address.number || "",
    residence_type: address.residence_type || address.ResidenceType || "apartment",
    complement: address.complement || "",
    neighborhood: address.neighborhood || "",
    reference_point: address.reference_point || "",
    city: address.city || "",
    state: address.state || "",
    zipcode: onlyDigits(address.zipcode || ""),
    latitude: Number(address.latitude || 0),
    longitude: Number(address.longitude || 0),
    rooms: Array.isArray(address.rooms) ? address.rooms.map(normalizeRoom) : [],
  };
}

function SkeletonBlock({ style, animatedStyle }) {
  return <Animated.View style={[profileStyles.skeletonBlock, animatedStyle, style]} />;
}

function ProfileLoadingSkeleton() {
  const shimmer = React.useRef(new Animated.Value(0.56)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.92,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.56,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const animatedStyle = { opacity: shimmer };

  return (
    <ScrollView style={styles.screenScroll} contentContainerStyle={styles.screenContent}>
      <SectionCard title="Meu perfil">
        <View style={profileStyles.heroRow}>
          <View style={profileStyles.avatarShell}>
            <SkeletonBlock style={profileStyles.skeletonAvatar} animatedStyle={animatedStyle} />
            <SkeletonBlock style={profileStyles.skeletonAvatarBadge} animatedStyle={animatedStyle} />
          </View>

          <View style={profileStyles.heroCopy}>
            <View style={profileStyles.heroHeadRow}>
              <View style={profileStyles.heroHeadMain}>
                <SkeletonBlock style={profileStyles.skeletonKicker} animatedStyle={animatedStyle} />
                <SkeletonBlock style={profileStyles.skeletonHeroTitle} animatedStyle={animatedStyle} />
              </View>
            </View>

            <SkeletonBlock style={profileStyles.skeletonHeroEmail} animatedStyle={animatedStyle} />

            <View style={profileStyles.skeletonBadgeRow}>
              <SkeletonBlock style={profileStyles.skeletonBadgeShort} animatedStyle={animatedStyle} />
              <SkeletonBlock style={profileStyles.skeletonBadgeLong} animatedStyle={animatedStyle} />
              <SkeletonBlock style={profileStyles.skeletonBadgeMedium} animatedStyle={animatedStyle} />
            </View>

            <View style={profileStyles.metricRow}>
              <View style={profileStyles.metricCard}>
                <SkeletonBlock style={profileStyles.skeletonMetricLabel} animatedStyle={animatedStyle} />
                <SkeletonBlock style={profileStyles.skeletonMetricValue} animatedStyle={animatedStyle} />
              </View>
              <View style={profileStyles.metricCard}>
                <SkeletonBlock style={profileStyles.skeletonMetricLabel} animatedStyle={animatedStyle} />
                <SkeletonBlock style={profileStyles.skeletonMetricValueShort} animatedStyle={animatedStyle} />
              </View>
            </View>
          </View>
        </View>

        <SkeletonBlock style={profileStyles.skeletonSecondaryButton} animatedStyle={animatedStyle} />

        <View style={profileStyles.sectionTabs}>
          <SkeletonBlock style={profileStyles.skeletonTabActive} animatedStyle={animatedStyle} />
          <SkeletonBlock style={profileStyles.skeletonTab} animatedStyle={animatedStyle} />
        </View>
      </SectionCard>

      <SectionCard title="Resumo da conta">
        {[0, 1, 2].map((item) => (
          <View key={item} style={profileStyles.infoRow}>
            <SkeletonBlock style={profileStyles.skeletonInfoLabel} animatedStyle={animatedStyle} />
            <SkeletonBlock style={profileStyles.skeletonInfoValue} animatedStyle={animatedStyle} />
          </View>
        ))}
      </SectionCard>

      <SectionCard
        title="Dados do perfil"
        right={<SkeletonBlock style={profileStyles.skeletonSectionAction} animatedStyle={animatedStyle} />}
      >
        <View style={profileStyles.formGroup}>
          <SkeletonBlock style={profileStyles.skeletonFieldLabel} animatedStyle={animatedStyle} />
          <SkeletonBlock style={profileStyles.skeletonInput} animatedStyle={animatedStyle} />
        </View>

        <View style={profileStyles.formGroup}>
          <SkeletonBlock style={profileStyles.skeletonFieldLabelShort} animatedStyle={animatedStyle} />
          <SkeletonBlock style={profileStyles.skeletonInput} animatedStyle={animatedStyle} />
        </View>

        <View style={profileStyles.inlineFields}>
          <View style={profileStyles.inlineField}>
            <SkeletonBlock style={profileStyles.skeletonFieldLabel} animatedStyle={animatedStyle} />
            <SkeletonBlock style={profileStyles.skeletonInput} animatedStyle={animatedStyle} />
          </View>
          <View style={profileStyles.inlineField}>
            <SkeletonBlock style={profileStyles.skeletonFieldLabelShort} animatedStyle={animatedStyle} />
            <SkeletonBlock style={profileStyles.skeletonInput} animatedStyle={animatedStyle} />
          </View>
        </View>

        <View style={profileStyles.formGroup}>
          <SkeletonBlock style={profileStyles.skeletonFieldLabelMedium} animatedStyle={animatedStyle} />
          <SkeletonBlock style={profileStyles.skeletonTextarea} animatedStyle={animatedStyle} />
        </View>

        <View style={profileStyles.actionRow}>
          <SkeletonBlock style={profileStyles.skeletonPrimaryButton} animatedStyle={animatedStyle} />
          <SkeletonBlock style={profileStyles.skeletonSecondaryBlockButton} animatedStyle={animatedStyle} />
        </View>
      </SectionCard>
    </ScrollView>
  );
}

export default function ProfileScreen({ session, profileIntent }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("personal");
  const [editMode, setEditMode] = useState(false);
  const [user, setUser] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [emailVerified, setEmailVerified] = useState(Boolean(session.emailVerified));
  const [subscriptionSummary, setSubscriptionSummary] = useState({
    hasValidSubscription: Boolean(session.hasValidSubscription || session.isTestUser),
    plan: "",
    status: "",
  });
  const [profileForm, setProfileForm] = useState(defaultProfileForm);
  const [addressForm, setAddressForm] = useState(defaultAddressForm);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editingRoomsAddressId, setEditingRoomsAddressId] = useState(null);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [addressMapCoords, setAddressMapCoords] = useState(null);
  const [addressNotice, setAddressNotice] = useState(null);
  const [addressCepLoading, setAddressCepLoading] = useState(false);
  const [expandedAddressRooms, setExpandedAddressRooms] = useState({});
  const [emailResendLoading, setEmailResendLoading] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [status, setStatus] = useState({ show: false, success: false, message: "" });
  const [actionLoading, setActionLoading] = useState({
    uploadPhoto: false,
    saveProfile: false,
    saveAddress: false,
    deleteAddressId: null,
  });

  const isDiarist = session.role === "diarista";
  const diaristProfile = user?.diarist_profile || user?.DiaristProfile || {};
  const userProfile = user?.user_profile || user?.UserProfile || {};
  const diaristSpecialties = parseSpecialties(profileForm.specialties);
  const profilePhoto = getProfilePhoto(user);
  const profileName = user?.name || user?.Name || "Usuario";
  const profileEmail = user?.email || user?.Email || "E-mail nao informado";

  async function loadProfile(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [profileResponse, subscriptionResponse] = await Promise.all([
        apiFetch("/profile", { authenticated: true }),
        apiFetch("/subscriptions/access-status", { authenticated: true }),
      ]);

      if (!profileResponse.ok) {
        throw new Error("Nao foi possivel carregar o perfil.");
      }

      const profile = await profileResponse.json().catch(() => ({}));
      const subscription = subscriptionResponse.ok
        ? await subscriptionResponse.json().catch(() => ({}))
        : {};

      const normalizedAddresses = Array.isArray(profile?.address || profile?.Address)
        ? (profile.address || profile.Address).map(normalizeAddress)
        : [];

      setUser(profile || {});
      setAddresses(normalizedAddresses);
      setEmailVerified(Boolean(profile?.email_verified ?? profile?.EmailVerified ?? session.emailVerified));
      setProfileForm(buildProfileForm(profile || {}));
      setSubscriptionSummary({
        hasValidSubscription: Boolean(
          subscription?.has_valid_subscription ||
            subscription?.is_test_user ||
            session.hasValidSubscription ||
            session.isTestUser,
        ),
        plan: subscription?.subscription_plan || subscription?.plan || "",
        status: subscription?.status || "",
      });
    } catch (loadError) {
      setError(loadError.message || "Nao foi possivel carregar o perfil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadProfile(false);
  }, []);

  function closeStatusModal() {
    setStatus((prev) => ({ ...prev, show: false }));
  }

  function handleProfileChange(name, value) {
    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleAddressChange(name, value) {
    const nextValue = name === "zipcode" ? onlyDigits(value).slice(0, 8) : value;
    const affectsLocation = ["zipcode", "street", "number", "neighborhood", "city", "state"].includes(name);

    setAddressForm((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(affectsLocation ? { latitude: 0, longitude: 0 } : {}),
    }));

    if (affectsLocation) {
      setAddressMapCoords(null);
      if (name !== "zipcode") {
        setAddressNotice({
          type: "warning",
          text: "Endereco alterado. Confirme novamente a localizacao no mapa.",
        });
      }
    }
  }

  function handleAddressRoomChange(roomId, field, value) {
    setAddressForm((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]: field === "quantity" ? value.replace(/\D/g, "").slice(0, 2) : value,
            }
          : room,
      ),
    }));
  }

  function handleAddAddressRoom() {
    setAddressForm((prev) => ({
      ...prev,
      rooms: [...prev.rooms, createRoom(prev.rooms.length)],
    }));
  }

  function handleRemoveAddressRoom(roomId) {
    setAddressForm((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((room) => room.id !== roomId),
    }));
  }

  function adjustAddressRoomQuantity(roomId, delta) {
    setAddressForm((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) => {
        if (room.id !== roomId) {
          return room;
        }

        const currentQuantity = Number(room.quantity || 0);
        const nextQuantity = Math.max(0, currentQuantity + delta);
        return {
          ...room,
          quantity: String(nextQuantity),
        };
      }),
    }));
  }

  function handleEditToggle() {
    if (editMode) {
      setProfileForm(buildProfileForm(user));
    }
    setEditMode((prev) => !prev);
  }

  async function handleProfileSave() {
    try {
      setActionLoading((prev) => ({ ...prev, saveProfile: true }));

      const response = await apiFetch("/profile", {
        method: "PUT",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...profileForm,
          experience_years: Number(profileForm.experience_years || 0),
          price_per_hour: Number(profileForm.price_per_hour || 0),
          price_per_day: Number(profileForm.price_per_day || 0),
          specialties: parseSpecialties(profileForm.specialties),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao atualizar perfil.");
      }

      setUser(data || {});
      setProfileForm(buildProfileForm(data || {}));
      setEmailVerified(Boolean(data?.email_verified ?? data?.EmailVerified ?? emailVerified));
      setEditMode(false);
      setStatus({ show: true, success: true, message: "Perfil atualizado com sucesso." });
    } catch (saveError) {
      setStatus({
        show: true,
        success: false,
        message: saveError.message || "Erro ao atualizar perfil.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, saveProfile: false }));
    }
  }

  async function handleResendVerificationEmail() {
    try {
      setEmailResendLoading(true);
      const response = await apiFetch("/auth/email-verification/resend", {
        method: "POST",
        authenticated: true,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel reenviar o e-mail.");
      }

      setStatus({
        show: true,
        success: true,
        message: data?.message || "E-mail de ativacao reenviado com sucesso.",
      });
    } catch (resendError) {
      setStatus({
        show: true,
        success: false,
        message: resendError.message || "Nao foi possivel reenviar o e-mail.",
      });
    } finally {
      setEmailResendLoading(false);
    }
  }

  async function handlePhotoSelection(file) {
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("photo", file);

    try {
      setActionLoading((prev) => ({ ...prev, uploadPhoto: true }));
      const response = await apiFetch("/upload-photo", {
        method: "POST",
        authenticated: true,
        body: uploadData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "Erro ao atualizar a foto.");
      }

      setUser((prev) => ({ ...prev, photo: data?.url || prev?.photo || "" }));
      setStatus({ show: true, success: true, message: "Foto atualizada com sucesso." });
    } catch (uploadError) {
      setStatus({
        show: true,
        success: false,
        message: uploadError.message || "Erro ao atualizar a foto.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, uploadPhoto: false }));
      setPhotoPickerOpen(false);
    }
  }

  function openFilePicker(useCamera = false) {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setStatus({
        show: true,
        success: false,
        message: "Envio de foto disponivel apenas no web por enquanto.",
      });
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (useCamera) {
      input.setAttribute("capture", "environment");
    }
    input.onchange = (event) => {
      const file = event?.target?.files?.[0];
      void handlePhotoSelection(file);
    };
    input.click();
  }

  function handleUseCurrentLocationForNewAddress() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude),
          lon: Number(position.coords.longitude),
        };
        setAddressMapCoords(coords);
        setAddressForm((prev) => ({
          ...prev,
          latitude: coords.lat,
          longitude: coords.lon,
        }));
        setAddressNotice({
          type: "success",
          text: "Localizacao atual capturada. Ajuste no mapa se precisar.",
        });
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 7000,
      },
    );
  }

  async function handleCepSearch() {
    const zipcode = onlyDigits(addressForm.zipcode).slice(0, 8);
    if (zipcode.length !== 8) {
      setAddressNotice({
        type: "warning",
        text: "Informe um CEP com 8 digitos para localizar o endereco.",
      });
      return false;
    }

    try {
      setAddressCepLoading(true);
      setAddressNotice(null);

      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`);
      const viaCepData = await viaCepResponse.json();

      if (viaCepData?.erro) {
        throw new Error("CEP nao encontrado.");
      }

      const nextAddress = {
        street: viaCepData.logradouro || addressForm.street,
        neighborhood: viaCepData.bairro || addressForm.neighborhood,
        city: viaCepData.localidade || addressForm.city,
        state: (viaCepData.uf || addressForm.state || "").toUpperCase(),
      };

      setAddressForm((prev) => ({
        ...prev,
        ...nextAddress,
        zipcode,
        latitude: 0,
        longitude: 0,
      }));

      const params = new URLSearchParams({
        q: [nextAddress.street, nextAddress.neighborhood, nextAddress.city, nextAddress.state, "Brasil"]
          .filter(Boolean)
          .join(", "),
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
      });

      const geoResponse = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
        headers: NOMINATIM_HEADERS,
      });
      const geoData = await geoResponse.json().catch(() => []);
      const match = Array.isArray(geoData) ? geoData[0] : null;

      if (!match) {
        setAddressNotice({
          type: "warning",
          text: "CEP encontrado. Complete os dados e confirme a localizacao manualmente no mapa.",
        });
        return false;
      }

      const coords = {
        lat: Number(match.lat),
        lon: Number(match.lon),
      };

      setAddressMapCoords(coords);
      setAddressForm((prev) => ({
        ...prev,
        ...nextAddress,
        zipcode,
        latitude: coords.lat,
        longitude: coords.lon,
      }));
      setAddressNotice({
        type: "success",
        text: "Localizacao encontrada. Confirme o ponto no mapa antes de salvar.",
      });
      return true;
    } catch (cepError) {
      setAddressNotice({
        type: "error",
        text: cepError.message || "Erro ao consultar o CEP.",
      });
      return false;
    } finally {
      setAddressCepLoading(false);
    }
  }

  function openAddressForm() {
    setActiveSection("addresses");
    setEditingAddressId(null);
    setEditingRoomsAddressId(null);
    setAddressForm(defaultAddressForm);
    setAddressMapCoords(null);
    setAddressNotice(null);
    setIsAddressFormOpen(true);
    handleUseCurrentLocationForNewAddress();
  }

  function openEditAddressForm(address) {
    setActiveSection("addresses");
    setEditingAddressId(address.id);
    setEditingRoomsAddressId(null);
    setAddressForm(buildAddressForm(address));
    setAddressMapCoords(
      address.latitude && address.longitude
        ? { lat: Number(address.latitude), lon: Number(address.longitude) }
        : null,
    );
    setAddressNotice(null);
    setIsAddressFormOpen(true);
  }

  function openInlineRoomsEditor(address) {
    const nextForm = buildAddressForm(address);
    if (!Array.isArray(nextForm.rooms) || nextForm.rooms.length === 0) {
      nextForm.rooms = [createRoom(0)];
    }

    setEditingAddressId(address.id);
    setEditingRoomsAddressId(address.id);
    setAddressForm(nextForm);
    setExpandedAddressRooms((prev) => ({ ...prev, [address.id]: true }));
  }

  function closeAddressForm() {
    setEditingAddressId(null);
    setEditingRoomsAddressId(null);
    setAddressForm(defaultAddressForm);
    setAddressMapCoords(null);
    setAddressNotice(null);
    setShowAddressMap(false);
    setIsAddressFormOpen(false);
  }

  function closeInlineRoomsEditor() {
    setEditingRoomsAddressId(null);
    setEditingAddressId(null);
    setAddressForm(defaultAddressForm);
    setAddressMapCoords(null);
    setAddressNotice(null);
    setShowAddressMap(false);
  }

  function toggleAddressRooms(addressId) {
    setExpandedAddressRooms((prev) => ({ ...prev, [addressId]: !prev[addressId] }));
  }

  useEffect(() => {
    if (!profileIntent?.stamp) {
      return;
    }

    if (profileIntent.section) {
      setActiveSection(profileIntent.section);
    }

    if (profileIntent.section === "addresses" && profileIntent.openAddressForm) {
      setEditingAddressId(null);
      setEditingRoomsAddressId(null);
      setAddressForm(defaultAddressForm);
      setAddressMapCoords(null);
      setAddressLookupFeedback({ show: false, success: false, message: "" });
      setIsAddressFormOpen(true);
      return;
    }

    if (profileIntent.section === "addresses") {
      setIsAddressFormOpen(false);
    }
  }, [profileIntent]);

  function handleAddressCoordsChange(coords) {
    const lat = Number(coords?.lat ?? coords?.latitude ?? 0);
    const lon = Number(coords?.lon ?? coords?.longitude ?? 0);

    setAddressMapCoords({ lat, lon });
    setAddressForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
    }));
    setAddressNotice({
      type: "success",
      text: "Localizacao confirmada. Agora voce pode salvar o endereco.",
    });
    setShowAddressMap(false);
  }

  async function handleOpenAddressMap() {
    if (addressMapCoords?.lat && addressMapCoords?.lon) {
      setShowAddressMap(true);
      return;
    }

    const found = await handleCepSearch();
    if (found || addressMapCoords?.lat || addressForm.latitude) {
      setShowAddressMap(true);
    }
  }

  async function handleAddressSave() {
    try {
      if (!addressForm.latitude || !addressForm.longitude) {
        setAddressNotice({
          type: "warning",
          text: "Confirme a localizacao do endereco no mapa antes de salvar.",
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
          zipcode: onlyDigits(addressForm.zipcode),
          latitude: Number(addressForm.latitude || 0),
          longitude: Number(addressForm.longitude || 0),
          rooms: normalizedRooms,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel salvar o endereco.");
      }

      await loadProfile(false);
      closeAddressForm();
      setStatus({
        show: true,
        success: true,
        message: editingAddressId ? "Endereco atualizado com sucesso." : "Endereco adicionado com sucesso.",
      });
    } catch (addressError) {
      setStatus({
        show: true,
        success: false,
        message: addressError.message || "Nao foi possivel salvar o endereco.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, saveAddress: false }));
    }
  }

  function handleDeleteAddress(addressId) {
    const runDelete = async () => {
      try {
        setActionLoading((prev) => ({ ...prev, deleteAddressId: addressId }));
        const response = await apiFetch(`/addresses/${addressId}`, {
          method: "DELETE",
          authenticated: true,
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel excluir o endereco.");
        }

        await loadProfile(false);
        setStatus({ show: true, success: true, message: "Endereco removido com sucesso." });
      } catch (deleteError) {
        setStatus({
          show: true,
          success: false,
          message: deleteError.message || "Nao foi possivel excluir o endereco.",
        });
      } finally {
        setActionLoading((prev) => ({ ...prev, deleteAddressId: null }));
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm("Deseja excluir este endereco?")) {
        void runDelete();
      }
      return;
    }

    Alert.alert("Excluir endereco", "Deseja excluir este endereco?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void runDelete() },
    ]);
  }

  function renderProfileInfoRow(label, value) {
    return (
      <View style={profileStyles.infoRow} key={label}>
        <Text style={profileStyles.infoLabel}>{label}</Text>
        <Text style={profileStyles.infoValue}>{value || "Nao informado"}</Text>
      </View>
    );
  }

  if (loading && !user?.id && !user?.ID) {
    return <ProfileLoadingSkeleton />;
  }

  return (
    <>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfile(true)} />}
      >
        <SectionCard title="Meu perfil">
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={profileStyles.heroRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={profileStyles.avatarShell}
              onPress={() => {
                if (!actionLoading.uploadPhoto) {
                  setPhotoPickerOpen(true);
                }
              }}
            >
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={profileStyles.avatarImage} />
              ) : (
                <View style={profileStyles.avatarFallback}>
                  <Text style={profileStyles.avatarFallbackText}>
                    {String(profileName).trim().charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              <View style={profileStyles.avatarOverlay}>
                <Feather name="camera" size={14} color="#ffffff" />
              </View>
            </TouchableOpacity>

            <View style={profileStyles.heroCopy}>
              <View style={profileStyles.heroHeadRow}>
                <View style={profileStyles.heroHeadMain}>
                  <Text style={profileStyles.kicker}>Conta</Text>
                  <Text style={profileStyles.heroName}>{profileName}</Text>
                </View>
              </View>

              <Text style={profileStyles.heroEmail}>{profileEmail}</Text>

              <View style={styles.inlineMeta}>
                <Text style={styles.metaBadge}>{isDiarist ? "Diarista" : "Cliente"}</Text>
                <Text style={styles.metaBadge}>
                  {subscriptionSummary.hasValidSubscription || session.isTestUser ? "Assinatura ativa" : "Sem assinatura"}
                </Text>
                <Text style={styles.metaBadge}>{emailVerified ? "E-mail verificado" : "E-mail pendente"}</Text>
              </View>

              <View style={profileStyles.metricRow}>
                <View style={profileStyles.metricCard}>
                  <Text style={profileStyles.metricLabel}>Membro desde</Text>
                  <Text style={profileStyles.metricValue}>{formatDate(user?.created_at || user?.CreatedAt)}</Text>
                </View>
                <View style={profileStyles.metricCard}>
                  <Text style={profileStyles.metricLabel}>Enderecos</Text>
                  <Text style={profileStyles.metricValue}>{addresses.length}</Text>
                </View>
              </View>
            </View>
          </View>

          {!emailVerified && profileEmail ? (
            <TouchableOpacity
              style={profileStyles.secondaryButton}
              onPress={handleResendVerificationEmail}
              disabled={emailResendLoading}
            >
              <Feather name="mail" size={15} color={palette.accent} />
              <Text style={profileStyles.secondaryButtonText}>
                {emailResendLoading ? "Enviando..." : "Ativar e-mail"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={profileStyles.sectionTabs}>
            <TouchableOpacity
              style={[profileStyles.sectionTab, activeSection === "personal" ? profileStyles.sectionTabActive : null]}
              onPress={() => setActiveSection("personal")}
            >
              <Text
                style={[
                  profileStyles.sectionTabText,
                  activeSection === "personal" ? profileStyles.sectionTabTextActive : null,
                ]}
              >
                Informacoes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[profileStyles.sectionTab, activeSection === "addresses" ? profileStyles.sectionTabActive : null]}
              onPress={() => setActiveSection("addresses")}
            >
              <Text
                style={[
                  profileStyles.sectionTabText,
                  activeSection === "addresses" ? profileStyles.sectionTabTextActive : null,
                ]}
              >
                Enderecos
              </Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {activeSection === "personal" ? (
          <>
            <SectionCard title="Resumo da conta">
              {renderProfileInfoRow("Telefone", user?.phone || user?.Phone || "Nao informado")}
              {renderProfileInfoRow("Plano", subscriptionSummary.plan || (subscriptionSummary.hasValidSubscription ? "Ativo" : "Sem assinatura"))}
              {isDiarist
                ? renderProfileInfoRow(
                    "Experiencia",
                    `${diaristProfile?.experience_years || diaristProfile?.ExperienceYears || 0} anos`,
                  )
                : renderProfileInfoRow(
                    "Frequencia favorita",
                    frequencyLabels[userProfile?.desired_frequency || userProfile?.DesiredFrequency] || "Nao informado",
                  )}
            </SectionCard>

            <SectionCard
              title={editMode ? "Editar perfil" : "Dados do perfil"}
              right={
                <TouchableOpacity style={profileStyles.iconButton} onPress={handleEditToggle}>
                  <Feather name={editMode ? "x" : "edit-2"} size={16} color={palette.accent} />
                </TouchableOpacity>
              }
            >
              <View style={profileStyles.formGroup}>
                <Text style={profileStyles.fieldLabel}>Nome</Text>
                {editMode ? (
                  <TextInput
                    value={profileForm.name}
                    onChangeText={(value) => handleProfileChange("name", value)}
                    style={profileStyles.input}
                    placeholder="Seu nome"
                    placeholderTextColor="#9ca3af"
                  />
                ) : (
                  <Text style={profileStyles.fieldValue}>{profileForm.name || "Nao informado"}</Text>
                )}
              </View>

              <View style={profileStyles.formGroup}>
                <Text style={profileStyles.fieldLabel}>E-mail</Text>
                {editMode ? (
                  <TextInput
                    value={profileForm.email}
                    onChangeText={(value) => handleProfileChange("email", value)}
                    style={profileStyles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="email@exemplo.com"
                    placeholderTextColor="#9ca3af"
                  />
                ) : (
                  <Text style={profileStyles.fieldValue}>{profileForm.email || "Nao informado"}</Text>
                )}
              </View>

              <View style={profileStyles.formGroup}>
                <Text style={profileStyles.fieldLabel}>Telefone</Text>
                {editMode ? (
                  <TextInput
                    value={profileForm.phone}
                    onChangeText={(value) => handleProfileChange("phone", value)}
                    style={profileStyles.input}
                    keyboardType="phone-pad"
                    placeholder="(00) 00000-0000"
                    placeholderTextColor="#9ca3af"
                  />
                ) : (
                  <Text style={profileStyles.fieldValue}>{profileForm.phone || "Nao informado"}</Text>
                )}
              </View>

              {isDiarist ? (
                <>
                  {editMode ? (
                    <>
                      <View style={profileStyles.formGroup}>
                        <Text style={profileStyles.fieldLabel}>Bio</Text>
                        <TextInput
                          value={profileForm.bio}
                          onChangeText={(value) => handleProfileChange("bio", value)}
                          style={[profileStyles.input, profileStyles.textarea]}
                          multiline
                          textAlignVertical="top"
                          placeholder="Conte um pouco sobre voce"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>

                      <View style={profileStyles.inlineFields}>
                        <View style={profileStyles.inlineField}>
                          <Text style={profileStyles.fieldLabel}>Experiencia (anos)</Text>
                          <TextInput
                            value={profileForm.experience_years}
                            onChangeText={(value) => handleProfileChange("experience_years", value.replace(/\D/g, ""))}
                            style={profileStyles.input}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={profileStyles.inlineField}>
                          <Text style={profileStyles.fieldLabel}>Disponivel</Text>
                          <View style={profileStyles.switchRow}>
                            <Switch
                              value={Boolean(profileForm.available)}
                              onValueChange={(value) => handleProfileChange("available", value)}
                              trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                              thumbColor={profileForm.available ? palette.accent : "#f8fafc"}
                            />
                            <Text style={profileStyles.switchText}>{profileForm.available ? "Sim" : "Nao"}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={profileStyles.inlineFields}>
                        <View style={profileStyles.inlineField}>
                          <Text style={profileStyles.fieldLabel}>Valor por hora</Text>
                          <TextInput
                            value={profileForm.price_per_hour}
                            onChangeText={(value) => handleProfileChange("price_per_hour", value.replace(/[^\d.,]/g, ""))}
                            style={profileStyles.input}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>

                        <View style={profileStyles.inlineField}>
                          <Text style={profileStyles.fieldLabel}>Valor por dia</Text>
                          <TextInput
                            value={profileForm.price_per_day}
                            onChangeText={(value) => handleProfileChange("price_per_day", value.replace(/[^\d.,]/g, ""))}
                            style={profileStyles.input}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                      </View>

                      <View style={profileStyles.formGroup}>
                        <Text style={profileStyles.fieldLabel}>Especialidades</Text>
                        <TextInput
                          value={profileForm.specialties}
                          onChangeText={(value) => handleProfileChange("specialties", value)}
                          style={[profileStyles.input, profileStyles.textarea]}
                          multiline
                          textAlignVertical="top"
                          placeholder="Ex.: basic_cleaning, heavy_cleaning"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </>
                  ) : (
                    <View style={profileStyles.proProfileCard}>
                      <View style={profileStyles.proProfileHeader}>
                        <View style={profileStyles.proProfileHeaderIcon}>
                          <Feather name="briefcase" size={16} color={palette.accent} />
                        </View>
                        <View style={profileStyles.proProfileHeaderCopy}>
                          <Text style={profileStyles.proProfileTitle}>Perfil profissional</Text>
                          <Text style={profileStyles.proProfileSubtitle}>
                            Resumo da sua apresentacao, experiencia, precificacao e disponibilidade.
                          </Text>
                        </View>
                      </View>

                      <View style={profileStyles.proProfileSection}>
                        <Text style={profileStyles.proProfileSectionTitle}>Apresentacao</Text>
                        <Text style={profileStyles.proProfileBody}>
                          {profileForm.bio || "Nenhuma apresentacao preenchida ainda."}
                        </Text>
                      </View>

                      <View style={profileStyles.proProfileStats}>
                        <View style={profileStyles.proProfileStatRow}>
                          <Text style={profileStyles.proProfileStatLabel}>Anos de experiencia</Text>
                          <Text style={profileStyles.proProfileStatValue}>{`${profileForm.experience_years || 0} anos`}</Text>
                        </View>
                        <View style={profileStyles.proProfileStatRow}>
                          <Text style={profileStyles.proProfileStatLabel}>Preco por hora</Text>
                          <Text style={profileStyles.proProfileStatValue}>{formatCurrency(profileForm.price_per_hour || 0)}</Text>
                        </View>
                        <View style={profileStyles.proProfileStatRow}>
                          <Text style={profileStyles.proProfileStatLabel}>Preco por diaria</Text>
                          <Text style={profileStyles.proProfileStatValue}>{formatCurrency(profileForm.price_per_day || 0)}</Text>
                        </View>
                        <View style={profileStyles.proProfileStatRow}>
                          <Text style={profileStyles.proProfileStatLabel}>Disponibilidade</Text>
                          <Text style={profileStyles.proProfileStatValue}>
                            {profileForm.available ? "Disponivel para servicos" : "Indisponivel no momento"}
                          </Text>
                        </View>
                      </View>

                      <View style={profileStyles.proProfileSection}>
                        <Text style={profileStyles.proProfileSectionTitle}>Especialidades</Text>
                        <Text style={profileStyles.proProfileSectionHint}>
                          Servicos e contextos em que voce atua melhor.
                        </Text>
                        <View style={profileStyles.proProfileTags}>
                          {diaristSpecialties.length ? (
                            diaristSpecialties.map((specialty, index) => (
                              <View key={`${specialty}-${index}`} style={profileStyles.proProfileTag}>
                                <View style={profileStyles.proProfileTagIcon}>
                                  <Feather
                                    name={diaristSpecialtyMeta[specialty]?.icon || "star"}
                                    size={14}
                                    color={palette.accent}
                                  />
                                </View>
                                <Text style={profileStyles.proProfileTagText}>
                                  {diaristSpecialtyMeta[specialty]?.label || specialty}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={profileStyles.proProfileEmptyText}>Nenhuma especialidade cadastrada.</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={profileStyles.formGroup}>
                    <Text style={profileStyles.fieldLabel}>Frequencia desejada</Text>
                    {editMode ? (
                      <View style={profileStyles.choiceRow}>
                        {Object.entries(frequencyLabels).map(([key, label]) => (
                          <TouchableOpacity
                            key={key}
                            style={[
                              profileStyles.choiceChip,
                              profileForm.desired_frequency === key ? profileStyles.choiceChipActive : null,
                            ]}
                            onPress={() => handleProfileChange("desired_frequency", key)}
                          >
                            <Text
                              style={[
                                profileStyles.choiceChipText,
                                profileForm.desired_frequency === key ? profileStyles.choiceChipTextActive : null,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <Text style={profileStyles.fieldValue}>
                        {frequencyLabels[profileForm.desired_frequency] || "Nao informado"}
                      </Text>
                    )}
                  </View>

                  <View style={profileStyles.formGroup}>
                    <Text style={profileStyles.fieldLabel}>Possui pets?</Text>
                    {editMode ? (
                      <View style={profileStyles.switchRow}>
                        <Switch
                          value={Boolean(profileForm.has_pets)}
                          onValueChange={(value) => handleProfileChange("has_pets", value)}
                          trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                          thumbColor={profileForm.has_pets ? palette.accent : "#f8fafc"}
                        />
                        <Text style={profileStyles.switchText}>{profileForm.has_pets ? "Sim" : "Nao"}</Text>
                      </View>
                    ) : (
                      <Text style={profileStyles.fieldValue}>{profileForm.has_pets ? "Sim" : "Nao"}</Text>
                    )}
                  </View>
                </>
              )}

              {editMode ? (
                <View style={profileStyles.actionRow}>
                  <TouchableOpacity
                    style={profileStyles.primaryButton}
                    onPress={handleProfileSave}
                    disabled={actionLoading.saveProfile}
                  >
                    <Text style={profileStyles.primaryButtonText}>
                      {actionLoading.saveProfile ? "Salvando..." : "Salvar alteracoes"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={profileStyles.secondaryBlockButton}
                    onPress={handleEditToggle}
                    disabled={actionLoading.saveProfile}
                  >
                    <Text style={profileStyles.secondaryBlockButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </SectionCard>
          </>
        ) : (
          <>
            <SectionCard title="Enderecos" right={<Text style={styles.sectionMeta}>{addresses.length}</Text>}>
              <View style={profileStyles.addressHeaderRow}>
                <Text style={profileStyles.addressHeaderCopy}>Gerencie seus enderecos cadastrados</Text>
                {!isAddressFormOpen ? (
                  <TouchableOpacity style={profileStyles.addButton} onPress={openAddressForm}>
                    <Feather name="plus" size={15} color="#ffffff" />
                    <Text style={profileStyles.addButtonText}>Novo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isAddressFormOpen ? (
                <View style={profileStyles.addressFormCard}>
                  <View style={profileStyles.inlineFields}>
                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>CEP</Text>
                      <TextInput
                        value={formatCep(addressForm.zipcode)}
                        onChangeText={(value) => handleAddressChange("zipcode", value)}
                        style={profileStyles.input}
                        keyboardType="numeric"
                        placeholder="00000-000"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>

                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Tipo</Text>
                      <View style={profileStyles.choiceRow}>
                        {Object.entries(residenceTypeLabels).map(([key, label]) => (
                          <TouchableOpacity
                            key={key}
                            style={[
                              profileStyles.choiceChip,
                              addressForm.residence_type === key ? profileStyles.choiceChipActive : null,
                            ]}
                            onPress={() => handleAddressChange("residence_type", key)}
                          >
                            <Text
                              style={[
                                profileStyles.choiceChipText,
                                addressForm.residence_type === key ? profileStyles.choiceChipTextActive : null,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={profileStyles.inlineActionRow}>
                    <TouchableOpacity
                      style={profileStyles.secondaryButton}
                      onPress={() => void handleCepSearch()}
                      disabled={addressCepLoading}
                    >
                      <Feather name="search" size={15} color={palette.accent} />
                      <Text style={profileStyles.secondaryButtonText}>
                        {addressCepLoading ? "Buscando CEP..." : "Buscar CEP"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={profileStyles.secondaryButton} onPress={() => void handleOpenAddressMap()}>
                      <Feather name="map" size={15} color={palette.accent} />
                      <Text style={profileStyles.secondaryButtonText}>Confirmar no mapa</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={profileStyles.formGroup}>
                    <Text style={profileStyles.fieldLabel}>Rua</Text>
                    <TextInput
                      value={addressForm.street}
                      onChangeText={(value) => handleAddressChange("street", value)}
                      style={profileStyles.input}
                      placeholder="Rua"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View style={profileStyles.inlineFields}>
                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Numero</Text>
                      <TextInput
                        value={addressForm.number}
                        onChangeText={(value) => handleAddressChange("number", value)}
                        style={profileStyles.input}
                        placeholder="Numero"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>

                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Complemento</Text>
                      <TextInput
                        value={addressForm.complement}
                        onChangeText={(value) => handleAddressChange("complement", value)}
                        style={profileStyles.input}
                        placeholder="Apto, bloco, casa..."
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>

                  <View style={profileStyles.inlineFields}>
                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Bairro</Text>
                      <TextInput
                        value={addressForm.neighborhood}
                        onChangeText={(value) => handleAddressChange("neighborhood", value)}
                        style={profileStyles.input}
                        placeholder="Bairro"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>

                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Referencia</Text>
                      <TextInput
                        value={addressForm.reference_point}
                        onChangeText={(value) => handleAddressChange("reference_point", value)}
                        style={profileStyles.input}
                        placeholder="Ponto de referencia"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>

                  <View style={profileStyles.inlineFields}>
                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Cidade</Text>
                      <TextInput
                        value={addressForm.city}
                        onChangeText={(value) => handleAddressChange("city", value)}
                        style={profileStyles.input}
                        placeholder="Cidade"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>

                    <View style={profileStyles.inlineField}>
                      <Text style={profileStyles.fieldLabel}>Estado</Text>
                      <TextInput
                        value={addressForm.state}
                        onChangeText={(value) => handleAddressChange("state", value.toUpperCase().slice(0, 2))}
                        style={profileStyles.input}
                        placeholder="UF"
                        placeholderTextColor="#9ca3af"
                        maxLength={2}
                      />
                    </View>
                  </View>

                  <View style={profileStyles.coordinatesBox}>
                    <Text style={profileStyles.coordinatesText}>
                      {formatCoordinates(addressForm.latitude, addressForm.longitude)}
                    </Text>
                  </View>

                  {addressNotice ? (
                    <View
                      style={[
                        profileStyles.noticeBox,
                        addressNotice.type === "success"
                          ? profileStyles.noticeSuccess
                          : addressNotice.type === "warning"
                            ? profileStyles.noticeWarning
                            : addressNotice.type === "error"
                              ? profileStyles.noticeError
                              : profileStyles.noticeInfo,
                      ]}
                    >
                      <Text style={profileStyles.noticeText}>{addressNotice.text}</Text>
                    </View>
                  ) : null}

                  {!isDiarist ? (
                    <View style={profileStyles.roomsBox}>
                      <View style={profileStyles.roomsHeader}>
                        <Text style={profileStyles.roomsTitle}>Comodos da residencia</Text>
                        <TouchableOpacity style={profileStyles.secondaryMiniButton} onPress={handleAddAddressRoom}>
                          <Feather name="plus" size={14} color={palette.accent} />
                          <Text style={profileStyles.secondaryMiniButtonText}>Adicionar</Text>
                        </TouchableOpacity>
                      </View>

                      {(addressForm.rooms || []).length > 0 ? (
                        (addressForm.rooms || []).map((room) => (
                          <View key={room.id} style={profileStyles.roomEditorRow}>
                            <TextInput
                              value={room.name}
                              onChangeText={(value) => handleAddressRoomChange(room.id, "name", value)}
                              style={[profileStyles.input, profileStyles.roomNameInput]}
                              placeholder="Nome do comodo"
                              placeholderTextColor="#9ca3af"
                            />
                            <TouchableOpacity
                              style={profileStyles.roomAdjustButton}
                              onPress={() => adjustAddressRoomQuantity(room.id, -1)}
                            >
                              <Text style={profileStyles.roomAdjustButtonText}>-</Text>
                            </TouchableOpacity>
                            <TextInput
                              value={String(room.quantity || "")}
                              onChangeText={(value) => handleAddressRoomChange(room.id, "quantity", value)}
                              style={[profileStyles.input, profileStyles.roomQtyInput]}
                              keyboardType="numeric"
                              placeholder="Qtd"
                              placeholderTextColor="#9ca3af"
                            />
                            <TouchableOpacity
                              style={profileStyles.roomAdjustButton}
                              onPress={() => adjustAddressRoomQuantity(room.id, 1)}
                            >
                              <Text style={profileStyles.roomAdjustButtonText}>+</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={profileStyles.deleteRoomButton}
                              onPress={() => handleRemoveAddressRoom(room.id)}
                            >
                              <Feather name="trash-2" size={14} color="#b91c1c" />
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={profileStyles.helperText}>Nenhum comodo adicionado ainda.</Text>
                      )}
                    </View>
                  ) : null}

                  <View style={profileStyles.actionRow}>
                    <TouchableOpacity
                      style={profileStyles.primaryButton}
                      onPress={() => void handleAddressSave()}
                      disabled={actionLoading.saveAddress}
                    >
                      <Text style={profileStyles.primaryButtonText}>
                        {actionLoading.saveAddress
                          ? "Salvando..."
                          : editingAddressId
                            ? "Salvar endereco"
                            : "Adicionar endereco"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={profileStyles.secondaryBlockButton}
                      onPress={closeAddressForm}
                      disabled={actionLoading.saveAddress}
                    >
                      <Text style={profileStyles.secondaryBlockButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {addresses.length === 0 ? (
                <EmptyState
                  title="Nenhum endereco cadastrado"
                  description="Adicione o primeiro endereco para completar seu perfil no app."
                />
              ) : (
                addresses.map((address) => {
                  const isEditingRooms = editingRoomsAddressId === address.id;
                  const totalRooms = getTotalRoomCount(address);
                  const hasRooms = getAddressRooms(address).length > 0;
                  const isRoomsExpanded = Boolean(expandedAddressRooms[address.id]);

                  return (
                    <View key={address.id} style={profileStyles.addressCard}>
                      <View style={profileStyles.addressCardHead}>
                        <View style={profileStyles.addressCardHeadCopy}>
                          <Text style={profileStyles.addressCardKicker}>Endereco cadastrado</Text>
                          <Text style={profileStyles.addressCardTitle}>Detalhes do endereco</Text>
                        </View>

                        <View style={profileStyles.addressActionGroup}>
                          <TouchableOpacity
                            style={profileStyles.iconButton}
                            onPress={() => openEditAddressForm(address)}
                          >
                            <Feather name="edit-2" size={15} color={palette.accent} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={profileStyles.iconButton}
                            onPress={() => handleDeleteAddress(address.id)}
                            disabled={actionLoading.deleteAddressId === address.id}
                          >
                            <Feather name="trash-2" size={15} color="#b91c1c" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {renderProfileInfoRow("Rua", address.street || "Nao informado")}
                      {renderProfileInfoRow("Numero", address.number || "Nao informado")}
                      {renderProfileInfoRow("Complemento", address.complement || "Nao informado")}
                      {renderProfileInfoRow("Bairro", address.neighborhood || "Nao informado")}
                      {renderProfileInfoRow("Cidade", address.city || "Nao informado")}
                      {renderProfileInfoRow("Estado", address.state || "Nao informado")}
                      {renderProfileInfoRow("Tipo", residenceTypeLabels[address.residence_type] || "Nao informado")}
                      {renderProfileInfoRow("CEP", formatCep(address.zipcode || ""))}
                      {renderProfileInfoRow("Referencia", address.reference_point || "Nao informado")}
                      {renderProfileInfoRow("Localizacao", formatCoordinates(address.latitude, address.longitude))}

                      {!isDiarist ? (
                        <View style={profileStyles.roomsSummaryBox}>
                          <View style={profileStyles.roomsHeader}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              style={profileStyles.roomsDropdownButton}
                              onPress={() => toggleAddressRooms(address.id)}
                            >
                              <Text style={profileStyles.roomsTitle}>Comodos da residencia</Text>
                              <View style={profileStyles.roomsHeaderMeta}>
                                <Text style={profileStyles.roomsCounter}>{totalRooms}</Text>
                                <Feather
                                  name={isRoomsExpanded ? "chevron-up" : "chevron-down"}
                                  size={16}
                                  color={palette.accent}
                                />
                              </View>
                            </TouchableOpacity>
                          </View>

                          {isEditingRooms ? (
                            <>
                              {(addressForm.rooms || []).map((room) => (
                                <View key={room.id} style={profileStyles.roomEditorRow}>
                                  <TextInput
                                    value={room.name}
                                    onChangeText={(value) => handleAddressRoomChange(room.id, "name", value)}
                                    style={[profileStyles.input, profileStyles.roomNameInput]}
                                    placeholder="Nome do comodo"
                                    placeholderTextColor="#9ca3af"
                                  />
                                  <TouchableOpacity
                                    style={profileStyles.roomAdjustButton}
                                    onPress={() => adjustAddressRoomQuantity(room.id, -1)}
                                  >
                                    <Text style={profileStyles.roomAdjustButtonText}>-</Text>
                                  </TouchableOpacity>
                                  <TextInput
                                    value={String(room.quantity || "")}
                                    onChangeText={(value) => handleAddressRoomChange(room.id, "quantity", value)}
                                    style={[profileStyles.input, profileStyles.roomQtyInput]}
                                    keyboardType="numeric"
                                    placeholder="Qtd"
                                    placeholderTextColor="#9ca3af"
                                  />
                                  <TouchableOpacity
                                    style={profileStyles.roomAdjustButton}
                                    onPress={() => adjustAddressRoomQuantity(room.id, 1)}
                                  >
                                    <Text style={profileStyles.roomAdjustButtonText}>+</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={profileStyles.deleteRoomButton}
                                    onPress={() => handleRemoveAddressRoom(room.id)}
                                  >
                                    <Feather name="trash-2" size={14} color="#b91c1c" />
                                  </TouchableOpacity>
                                </View>
                              ))}

                              <TouchableOpacity style={profileStyles.secondaryMiniButton} onPress={handleAddAddressRoom}>
                                <Feather name="plus" size={14} color={palette.accent} />
                                <Text style={profileStyles.secondaryMiniButtonText}>Adicionar comodo</Text>
                              </TouchableOpacity>

                              <View style={profileStyles.actionRow}>
                                <TouchableOpacity
                                  style={profileStyles.primaryButton}
                                  onPress={() => void handleAddressSave()}
                                  disabled={actionLoading.saveAddress}
                                >
                                  <Text style={profileStyles.primaryButtonText}>
                                    {actionLoading.saveAddress ? "Salvando..." : "Salvar comodos"}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={profileStyles.secondaryBlockButton}
                                  onPress={closeInlineRoomsEditor}
                                  disabled={actionLoading.saveAddress}
                                >
                                  <Text style={profileStyles.secondaryBlockButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                              </View>
                            </>
                          ) : isRoomsExpanded ? (
                            <>
                              {hasRooms ? (
                                getAddressRooms(address).map((room, index) => (
                                  <View key={room.id || index} style={profileStyles.roomSummaryRow}>
                                    <View style={profileStyles.roomSummaryMain}>
                                      <Feather name="home" size={14} color={palette.accent} />
                                      <Text style={profileStyles.roomSummaryText}>
                                        {room.name || "Comodo sem nome"}
                                      </Text>
                                    </View>
                                    <Text style={profileStyles.roomSummaryQty}>{room.quantity || 0}x</Text>
                                  </View>
                                ))
                              ) : (
                                <Text style={profileStyles.helperText}>Nenhum comodo cadastrado neste endereco.</Text>
                              )}

                              <TouchableOpacity
                                style={[profileStyles.secondaryMiniButton, profileStyles.secondaryMiniButtonFull]}
                                onPress={() => openInlineRoomsEditor(address)}
                              >
                                <Feather name="plus" size={14} color={palette.accent} />
                                <Text style={profileStyles.secondaryMiniButtonText}>Editar comodos</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <Text style={profileStyles.roomsCollapsedHint}>Toque para visualizar os comodos deste endereco.</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>

      <Modal visible={photoPickerOpen} transparent animationType="fade" onRequestClose={() => setPhotoPickerOpen(false)}>
        <View style={profileStyles.modalBackdrop}>
          <View style={profileStyles.sheetCard}>
            <View style={profileStyles.sheetHandle} />
            <Text style={profileStyles.sheetKicker}>Foto de perfil</Text>
            <Text style={profileStyles.sheetTitle}>Escolha como enviar sua foto</Text>
            <Text style={profileStyles.sheetDescription}>
              Selecione camera ou galeria para atualizar seu perfil.
            </Text>

            <TouchableOpacity
              style={profileStyles.sheetOption}
              onPress={() => openFilePicker(true)}
              disabled={actionLoading.uploadPhoto}
            >
              <Text style={profileStyles.sheetOptionTitle}>Camera</Text>
              <Text style={profileStyles.sheetOptionText}>Tirar uma foto agora</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={profileStyles.sheetOption}
              onPress={() => openFilePicker(false)}
              disabled={actionLoading.uploadPhoto}
            >
              <Text style={profileStyles.sheetOptionTitle}>Galeria</Text>
              <Text style={profileStyles.sheetOptionText}>Escolher imagem do aparelho</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={profileStyles.sheetCancel}
              onPress={() => setPhotoPickerOpen(false)}
              disabled={actionLoading.uploadPhoto}
            >
              <Text style={profileStyles.sheetCancelText}>
                {actionLoading.uploadPhoto ? "Enviando..." : "Cancelar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={status.show} transparent animationType="fade" onRequestClose={closeStatusModal}>
        <View style={profileStyles.modalBackdrop}>
          <View style={profileStyles.statusCard}>
            <View
              style={[
                profileStyles.statusIcon,
                status.success ? profileStyles.statusIconSuccess : profileStyles.statusIconError,
              ]}
            >
              <Feather name={status.success ? "check" : "x"} size={18} color="#ffffff" />
            </View>
            <Text style={profileStyles.statusTitle}>{status.success ? "Sucesso" : "Erro"}</Text>
            <Text style={profileStyles.statusMessage}>{status.message}</Text>
            <TouchableOpacity style={profileStyles.primaryButton} onPress={closeStatusModal}>
              <Text style={profileStyles.primaryButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MapConfirmModal
        visible={showAddressMap}
        coords={addressMapCoords}
        onClose={() => setShowAddressMap(false)}
        onConfirm={handleAddressCoordsChange}
      />
    </>
  );
}

const profileStyles = StyleSheet.create({
  skeletonBlock: {
    backgroundColor: "#dfe8f5",
    overflow: "hidden",
  },
  skeletonAvatar: {
    width: 78,
    height: 78,
    borderRadius: 20,
    alignSelf: "center",
  },
  skeletonAvatarBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginTop: -18,
    alignSelf: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#c9daf7",
  },
  skeletonKicker: {
    width: 52,
    height: 10,
    borderRadius: 999,
    marginBottom: 8,
  },
  skeletonHeroTitle: {
    width: "72%",
    height: 22,
    borderRadius: 10,
  },
  skeletonHeroEmail: {
    width: "82%",
    height: 14,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 12,
  },
  skeletonIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e4edfb",
  },
  skeletonBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skeletonBadgeShort: {
    width: 78,
    height: 24,
    borderRadius: 999,
  },
  skeletonBadgeMedium: {
    width: 112,
    height: 24,
    borderRadius: 999,
  },
  skeletonBadgeLong: {
    width: 138,
    height: 24,
    borderRadius: 999,
  },
  skeletonMetricLabel: {
    width: "58%",
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  skeletonMetricValue: {
    width: "72%",
    height: 15,
    borderRadius: 999,
  },
  skeletonMetricValueShort: {
    width: "34%",
    height: 15,
    borderRadius: 999,
  },
  skeletonSecondaryButton: {
    width: 140,
    height: 42,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: "#e4edfb",
  },
  skeletonSectionAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e4edfb",
  },
  skeletonTabActive: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#cddfff",
  },
  skeletonTab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
  },
  skeletonInfoLabel: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    maxWidth: "42%",
  },
  skeletonInfoValue: {
    width: "38%",
    height: 12,
    borderRadius: 999,
  },
  skeletonFieldLabel: {
    width: 96,
    height: 10,
    borderRadius: 999,
    marginBottom: 8,
  },
  skeletonFieldLabelShort: {
    width: 68,
    height: 10,
    borderRadius: 999,
    marginBottom: 8,
  },
  skeletonFieldLabelMedium: {
    width: 120,
    height: 10,
    borderRadius: 999,
    marginBottom: 8,
  },
  skeletonInput: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#eef3fb",
  },
  skeletonTextarea: {
    minHeight: 104,
    borderRadius: 12,
    backgroundColor: "#eef3fb",
  },
  skeletonPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#cddfff",
  },
  skeletonSecondaryBlockButton: {
    width: 120,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#e7edf6",
  },
  heroRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  avatarShell: {
    width: 86,
    alignItems: "center",
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 20,
    backgroundColor: "#dbe7ff",
  },
  avatarFallback: {
    width: 78,
    height: 78,
    borderRadius: 20,
    backgroundColor: "#dbe7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 28,
    fontWeight: "900",
  },
  avatarOverlay: {
    marginTop: -18,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  heroHeadMain: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroName: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  heroEmail: {
    color: palette.muted,
    fontSize: 14,
    marginBottom: 10,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef4ff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    padding: 12,
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  secondaryButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  sectionTabs: {
    flexDirection: "row",
    gap: 10,
  },
  sectionTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTabActive: {
    backgroundColor: palette.accent,
  },
  sectionTabText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTabTextActive: {
    color: "#ffffff",
  },
  formGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  fieldValue: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  proProfileCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    padding: 14,
    gap: 12,
  },
  proProfileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5edf8",
  },
  proProfileHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  proProfileHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  proProfileTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  proProfileSubtitle: {
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 15,
  },
  proProfileSection: {
    gap: 6,
  },
  proProfileSectionTitle: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  proProfileSectionHint: {
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 15,
  },
  proProfileBody: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 19,
  },
  proProfileStats: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5edf8",
  },
  proProfileStatRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef3fb",
  },
  proProfileStatLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  proProfileStatValue: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
    flexShrink: 1,
  },
  proProfileTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  proProfileTag: {
    minWidth: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  proProfileTagIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  proProfileTagText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
    flex: 1,
  },
  proProfileEmptyText: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 17,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7e1ef",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
    fontSize: 14,
  },
  textarea: {
    minHeight: 104,
  },
  inlineFields: {
    flexDirection: "row",
    gap: 12,
  },
  inlineField: {
    flex: 1,
    minWidth: 0,
  },
  switchRow: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7e1ef",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#ffffff",
  },
  choiceChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  choiceChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  choiceChipTextActive: {
    color: "#ffffff",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryBlockButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBlockButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  infoValue: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
    flex: 1.2,
    textAlign: "right",
  },
  addressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  addressHeaderCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  addButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  addressFormCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  inlineActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  coordinatesBox: {
    borderRadius: 12,
    backgroundColor: "#eef6ff",
    padding: 12,
  },
  coordinatesText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  noticeBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeSuccess: {
    backgroundColor: "#dcfce7",
  },
  noticeWarning: {
    backgroundColor: "#fef3c7",
  },
  noticeError: {
    backgroundColor: "#fee2e2",
  },
  noticeInfo: {
    backgroundColor: "#dbeafe",
  },
  noticeText: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  roomsBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  roomsSummaryBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    padding: 12,
  },
  roomsHeader: {
    marginBottom: 10,
  },
  roomsDropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  roomsHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roomsTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  roomsCounter: {
    minWidth: 30,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#e0e7ff",
    color: palette.accent,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    overflow: "hidden",
  },
  roomsCollapsedHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryMiniButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryMiniButtonFull: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  secondaryMiniButtonText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  roomEditorRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  roomNameInput: {
    width: "50%",
    flexGrow: 0,
    flexShrink: 1,
  },
  roomQtyInput: {
    width: 50,
    textAlign: "center",
  },
  roomAdjustButton: {
    width: 34,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eef4ff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  roomAdjustButtonText: {
    color: palette.accent,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  deleteRoomButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  addressCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#fbfdff",
    padding: 14,
    marginTop: 12,
  },
  addressCardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  addressCardHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  addressCardKicker: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  addressCardTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  addressActionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  roomSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5edff",
  },
  roomSummaryMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  roomSummaryText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  roomSummaryQty: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.54)",
    justifyContent: "center",
    padding: 20,
  },
  sheetCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 20,
  },
  sheetHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#dbe7ff",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetKicker: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
    textAlign: "center",
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  sheetDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 16,
  },
  sheetOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#f8fbff",
    padding: 14,
    marginBottom: 10,
  },
  sheetOptionTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  sheetOptionText: {
    color: palette.muted,
    fontSize: 13,
  },
  sheetCancel: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  sheetCancelText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  statusCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statusIconSuccess: {
    backgroundColor: "#16a34a",
  },
  statusIconError: {
    backgroundColor: "#dc2626",
  },
  statusTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  statusMessage: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
});




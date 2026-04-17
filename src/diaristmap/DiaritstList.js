import React, { useEffect, useMemo, useState } from "react";
import { Button, Drawer, Input, Select, Skeleton, Slider, Switch, Tag } from "antd";
import { useAddress } from "../context/address";
import {
  FilterOutlined,
  StarFilled, 
  EnvironmentOutlined, 
  SafetyCertificateOutlined,
  UserOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  ThunderboltFilled,
  TrophyFilled
} from "@ant-design/icons";
import "./drawer-styles.css";
import { buildApiPathUrl } from "../config/api";
import { useOnlinePresence } from "../context/onlinePresence";
import OnlineIndicator from "../components/OnlineIndicator";

const DEFAULT_FILTERS = {
  search: "",
  minRating: 0,
  maxDistance: 30,
  minHourlyRate: null,
  maxHourlyRate: null,
  specialty: "all",
  onlyVerified: false,
  onlyAvailable: false,
  sortBy: "recommended",
};

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

const formatSpecialtyLabel = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getSpecialtyPresentation = (value = "") => {
  const key = String(value || "").trim();
  return specialtyPresentationMap[key] || {
    label: formatSpecialtyLabel(key) || "Especialidade",
    icon: "\u2728",
  };
};

const getDiaristProfile = (diarista = {}) =>
  diarista.diarist_profile || diarista.diaristas?.[0] || {};

const getDiaristPricePerHour = (diarista = {}) => {
  const profile = getDiaristProfile(diarista);
  return Number(profile.price_per_hour || profile.PricePerHour || 0);
};

const getDiaristPricePerDay = (diarista = {}) => {
  const profile = getDiaristProfile(diarista);
  return Number(profile.price_per_day || profile.PricePerDay || 0);
};

const getDiaristExperienceYears = (diarista = {}) => {
  const profile = getDiaristProfile(diarista);
  return Number(profile.experience_years || profile.ExperienceYears || 0);
};

const getDiaristAvailable = (diarista = {}) => {
  const profile = getDiaristProfile(diarista);

  if (typeof profile.available === "boolean") {
    return profile.available;
  }

  if (typeof profile.Available === "boolean") {
    return profile.Available;
  }

  return true;
};

const getDiaristSpecialties = (diarista = {}) => {
  const profile = getDiaristProfile(diarista);
  return parseSpecialties(profile.specialties || profile.Specialties);
};

const formatAverageRatingText = (rating) => {
  const numericRating = Number(rating || 0);
  return numericRating > 0 ? numericRating.toFixed(1) : "0";
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

const formatPriceValue = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const normalizeReview = (review = {}) => ({
  id: review.id || review.ID || null,
  client_rating: Number(review.client_rating || review.ClientRating || 0),
  client_comment: review.client_comment || review.ClientComment || "",
  created_at: review.created_at || review.CreatedAt || "",
});

const normalizeDiarista = (diarista = {}) => {
  const profile = getDiaristProfile(diarista);
  const coordinates = diarista.coordinates || diarista.coordenadas || {};

  return {
    ...diarista,
    diarist_profile: {
      ...profile,
      price_per_hour: getDiaristPricePerHour(diarista),
      price_per_day: getDiaristPricePerDay(diarista),
      experience_years: getDiaristExperienceYears(diarista),
      specialties: getDiaristSpecialties(diarista),
      available: getDiaristAvailable(diarista),
    },
    coordinates: {
      latitude: coordinates.latitude ?? coordinates.Latitude ?? null,
      longitude: coordinates.longitude ?? coordinates.Longitude ?? null,
    },
  };
};

export default function DiaristsList({ diaristas, loading, onHireClick, className = "" }) {
  const { setSelectedDiarista } = useAddress();
  const { isDiaristOnline } = useOnlinePresence();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [reviewsDrawerVisible, setReviewsDrawerVisible] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  useEffect(() => {
    console.log("[limpae-front] diaristas prop", diaristas);
    console.log("[limpae-front] diaristas loading", loading);
  }, [diaristas, loading]);

  const specialtyOptions = useMemo(() => {
    const specialties = diaristas.flatMap((diarista) =>
      getDiaristSpecialties(diarista)
    );

    return Array.from(new Set(specialties.map((item) => String(item)))).sort();
  }, [diaristas]);

  const filteredDiaristas = useMemo(() => {
    const query = normalizeText(filters.search);
    const result = diaristas.filter((diarista) => {
      const name = normalizeText(diarista.name);
      const distance = Number(String(diarista.distance || "0").replace(",", ".")) || 0;
      const rating = Number(diarista.average_rating || 0);
      const hourlyRate = getDiaristPricePerHour(diarista);
      const specialties = getDiaristSpecialties(diarista);
      const verified = rating >= 4.5;
      const available = getDiaristAvailable(diarista);

      const matchesSearch =
        !query ||
        name.includes(query) ||
        specialties.some((item) => normalizeText(item).includes(query));

      return (
        matchesSearch &&
        rating >= filters.minRating &&
        distance <= filters.maxDistance &&
        (filters.minHourlyRate === null || hourlyRate >= filters.minHourlyRate) &&
        (filters.maxHourlyRate === null || hourlyRate <= filters.maxHourlyRate) &&
        (filters.specialty === "all" || specialties.includes(filters.specialty)) &&
        (!filters.onlyVerified || verified) &&
        (!filters.onlyAvailable || available)
      );
    });

    return result.sort((a, b) => {
      const ratingA = Number(a.average_rating || 0);
      const ratingB = Number(b.average_rating || 0);
      const distanceA = Number(String(a.distance || "0").replace(",", ".")) || 0;
      const distanceB = Number(String(b.distance || "0").replace(",", ".")) || 0;
      const hourlyRateA = getDiaristPricePerHour(a);
      const hourlyRateB = getDiaristPricePerHour(b);
      const experienceA = getDiaristExperienceYears(a);
      const experienceB = getDiaristExperienceYears(b);

      switch (filters.sortBy) {
        case "rating":
          return ratingB - ratingA;
        case "distance":
          return distanceA - distanceB;
        case "price_low":
          return hourlyRateA - hourlyRateB;
        case "price_high":
          return hourlyRateB - hourlyRateA;
        case "experience":
          return experienceB - experienceA;
        default:
          return ratingB * 4 - distanceB - hourlyRateB / 20 - (ratingA * 4 - distanceA - hourlyRateA / 20);
      }
    });
  }, [diaristas, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count += 1;
    if (filters.minRating > DEFAULT_FILTERS.minRating) count += 1;
    if (filters.maxDistance < DEFAULT_FILTERS.maxDistance) count += 1;
    if (filters.minHourlyRate !== DEFAULT_FILTERS.minHourlyRate) count += 1;
    if (filters.maxHourlyRate !== DEFAULT_FILTERS.maxHourlyRate) count += 1;
    if (filters.specialty !== DEFAULT_FILTERS.specialty) count += 1;
    if (filters.onlyVerified) count += 1;
    if (filters.onlyAvailable) count += 1;
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy) count += 1;
    return count;
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const showDrawer = (diarista) => {
    setSelectedProfile(normalizeDiarista(diarista));
    setDrawerVisible(true);
    loadReviews(diarista.id);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setSelectedProfile(null);
  };

  const loadReviews = async (diaristId) => {
    setReviewsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(buildApiPathUrl(`/diarist-reviews/${diaristId}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllReviews(Array.isArray(data) ? data.map(normalizeReview) : []);
      }
    } catch (error) {
      console.error("Erro ao buscar avaliacoes:", error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openReviewsDrawer = () => {
    setReviewsDrawerVisible(true);
  };

  const closeReviewsDrawer = () => {
    setReviewsDrawerVisible(false);
  };

  const renderRatingStars = (rating) => {
    return (
      <div className="rating-stars-container">
        <StarFilled style={{ color: "#FFD700", fontSize: 16 }} />
        <span className="rating-number">{formatAverageRatingText(rating)}</span>
      </div>
    );
  };

  const renderReviewStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarFilled
        key={i}
        style={{
          color: i < rating ? "#FFD700" : "#e5e7eb",
          fontSize: 14,
        }}
      />
    ));
  };

  return (
    <div className={`map-list-container ${className}`}>
      <div className="map-list-hero">
        <div className="list-header-section">
          <h2 className="map-list-title">Diaristas disponíveis</h2>
          <p className="map-list-subtitle">{filteredDiaristas.length} profissionais prontos para te atender</p>
          <div className="map-filter-toolbar">
            <div className="map-filter-toolbar-copy">
              <span className="map-filter-kicker">Filtros</span>
              <p>{activeFilterCount > 0 ? `${activeFilterCount} filtro(s) ativo(s)` : "Sem filtros ativos"}</p>
            </div>
            <Button
              icon={<FilterOutlined />}
              className="map-filter-trigger"
              onClick={() => setFiltersVisible(true)}
            >
              {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : "Filtrar"}
            </Button>
          </div>
          {activeFilterCount > 0 && (
            <div className="map-active-filters">
              {filters.search ? <Tag closable onClose={() => updateFilter("search", "")}>Busca: {filters.search}</Tag> : null}
              {filters.minRating > 0 ? (
                <Tag closable onClose={() => updateFilter("minRating", 0)}>Nota: {filters.minRating}+</Tag>
              ) : null}
              {filters.maxDistance < DEFAULT_FILTERS.maxDistance ? (
                <Tag closable onClose={() => updateFilter("maxDistance", DEFAULT_FILTERS.maxDistance)}>Distância: até {filters.maxDistance} km</Tag>
              ) : null}
              {filters.minHourlyRate !== DEFAULT_FILTERS.minHourlyRate ? (
                <Tag closable onClose={() => updateFilter("minHourlyRate", DEFAULT_FILTERS.minHourlyRate)}>Mínimo: R$ {filters.minHourlyRate}/h</Tag>
              ) : null}
              {filters.maxHourlyRate !== DEFAULT_FILTERS.maxHourlyRate ? (
                <Tag closable onClose={() => updateFilter("maxHourlyRate", DEFAULT_FILTERS.maxHourlyRate)}>Máximo: R$ {filters.maxHourlyRate}/h</Tag>
              ) : null}
              {filters.specialty !== "all" ? (
                <Tag closable onClose={() => updateFilter("specialty", "all")}>Especialidade: {formatSpecialtyLabel(filters.specialty)}</Tag>
              ) : null}
              {filters.onlyVerified ? (
                <Tag closable onClose={() => updateFilter("onlyVerified", false)}>Verificadas</Tag>
              ) : null}
              {filters.onlyAvailable ? (
                <Tag closable onClose={() => updateFilter("onlyAvailable", false)}>Disponíveis</Tag>
              ) : null}
            </div>
          )}
        </div>
      </div>
      
      <div className="map-list">
        {loading ? (
          Array(3).fill(0).map((_, index) => (
            <div key={`skeleton-${index}`} className="professional-card skeleton-card">
              <div className="card-main-content">
                <div className="card-left">
                  <Skeleton.Avatar active size={80} shape="square" />
                </div>
                <div className="card-right">
                  <Skeleton active paragraph={{ rows: 2 }} />
                </div>
              </div>
              <div className="card-actions">
                <Skeleton.Button active block />
                <Skeleton.Button active block />
              </div>
            </div>
          ))
        ) : filteredDiaristas.length > 0 ? (
          filteredDiaristas.map((diarista) => {
            const normalizedDiarista = normalizeDiarista(diarista);
            return (
            <div key={normalizedDiarista.id} className="professional-card">
            <div className="card-main-content">
              <div className="card-left">
                <div className="photo-wrapper">
                  <img src={normalizedDiarista.photo} alt={normalizedDiarista.name} className="professional-photo" />
                  {normalizedDiarista.average_rating >= 4.5 && (
                    <div className="top-rated-badge">
                      <SafetyCertificateOutlined />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="card-right">
                <div className="card-header-info">
                  <div className="name-rating-row">
                    <div className="professional-name-block">
                      <h3 className="professional-name">{normalizedDiarista.name}</h3>
                      <OnlineIndicator
                        isOnline={isDiaristOnline(normalizedDiarista.id)}
                        label={isDiaristOnline(normalizedDiarista.id) ? "Online" : "Offline"}
                        className="diarist-presence-indicator"
                      />
                    </div>
                    {renderRatingStars(normalizedDiarista.average_rating)}
                  </div>
                  <div className="location-badge">
                    <EnvironmentOutlined />
                    <span>{normalizedDiarista.distance} de distância</span>
                  </div>
                </div>

                <div className="experience-tag">
                  <UserOutlined />
                  <span>{getDiaristExperienceYears(normalizedDiarista)} anos de experiência</span>
                </div>

                <div className="price-grid">
                  <div className="price-item">
                    <span className="price-label">Por Hora</span>
                    <span className="price-value">R$ {getDiaristPricePerHour(normalizedDiarista)}</span>
                  </div>
                  <div className="price-divider"></div>
                  <div className="price-item">
                            <span className="price-label">Diária</span>
                    <span className="price-value">R$ {getDiaristPricePerDay(normalizedDiarista)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-actions">
              <button className="secondary-action-btn" onClick={() => showDrawer(normalizedDiarista)}>
                Ver Perfil Completo
              </button>
              <button
                className="primary-action-btn"
                onClick={() => {
                  setSelectedDiarista(normalizedDiarista);
                  onHireClick();
                }}
              >
                Contratar Agora
              </button>
            </div>
          </div>
        )})) : (
          <div className="map-filter-empty">
            <h3>Nenhuma diarista encontrada</h3>
            <p>Tente ampliar a distância, reduzir a nota mínima ou limpar os filtros ativos.</p>
            <Button onClick={resetFilters}>Limpar filtros</Button>
          </div>
        )}
      </div>

      <Drawer
        title="Filtros"
        placement={isMobile ? "bottom" : "right"}
        onClose={() => setFiltersVisible(false)}
        open={filtersVisible}
        height={isMobile ? "88%" : undefined}
        width={isMobile ? "100%" : 420}
        className="map-filters-drawer"
      >
        <div className="map-filters-panel">
          <div className="map-filter-field">
            <label>Buscar</label>
            <Input
              placeholder="Nome ou especialidade"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </div>

          <div className="map-filter-field">
            <label>Ordenar por</label>
            <Select
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
              value={filters.sortBy}
              onChange={(value) => updateFilter("sortBy", value)}
              options={[
                { value: "recommended", label: "Recomendadas primeiro" },
                { value: "rating", label: "Melhor avaliação" },
                { value: "distance", label: "Mais próximas" },
                { value: "price_low", label: "Menor preço" },
                { value: "price_high", label: "Maior preço" },
                { value: "experience", label: "Mais experiência" },
              ]}
            />
          </div>

          <div className="map-filter-field">
            <label>Nota mínima: {filters.minRating.toFixed(1)}</label>
            <Slider min={0} max={5} step={0.5} value={filters.minRating} onChange={(value) => updateFilter("minRating", value)} />
          </div>

          <div className="map-filter-field">
            <label>Distância máxima: {filters.maxDistance} km</label>
            <Slider min={1} max={30} step={1} value={filters.maxDistance} onChange={(value) => updateFilter("maxDistance", value)} />
          </div>

          <div className="map-filter-field">
            <label>Faixa de preço por hora</label>
            <div className="map-filter-range-grid">
              <div className="map-filter-range-box">
                <span>Mínimo</span>
                <Input
                  type="number"
                  min={0}
                  max={filters.maxHourlyRate ?? 999999}
                  value={filters.minHourlyRate ?? ""}
                  onChange={(event) =>
                    updateFilter(
                      "minHourlyRate",
                      event.target.value === ""
                        ? null
                        : Math.min(Number(event.target.value), filters.maxHourlyRate ?? Number.MAX_SAFE_INTEGER)
                    )
                  }
                />
              </div>
              <div className="map-filter-range-box">
                <span>Máximo</span>
                <Input
                  type="number"
                  min={filters.minHourlyRate ?? 0}
                  max={999999}
                  value={filters.maxHourlyRate ?? ""}
                  onChange={(event) =>
                    updateFilter(
                      "maxHourlyRate",
                      event.target.value === ""
                        ? null
                        : Math.max(Number(event.target.value), filters.minHourlyRate ?? 0)
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="map-filter-field">
            <label>Especialidade</label>
            <Select
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
              value={filters.specialty}
              onChange={(value) => updateFilter("specialty", value)}
              options={[
                { value: "all", label: "Todas as especialidades" },
                ...specialtyOptions.map((specialty) => ({
                  value: specialty,
                  label: formatSpecialtyLabel(specialty),
                })),
              ]}
            />
          </div>

          <div className="map-filter-switch-row">
            <div>
              <strong>Apenas verificadas</strong>
              <p>Mostra perfis com nota alta.</p>
            </div>
            <Switch checked={filters.onlyVerified} onChange={(checked) => updateFilter("onlyVerified", checked)} />
          </div>

          <div className="map-filter-switch-row">
            <div>
              <strong>Apenas disponíveis</strong>
              <p>Mostra perfis prontos para novos serviços.</p>
            </div>
            <Switch checked={filters.onlyAvailable} onChange={(checked) => updateFilter("onlyAvailable", checked)} />
          </div>

          <div className="map-filter-drawer-footer">
            <Button onClick={resetFilters}>Limpar tudo</Button>
            <Button type="primary" onClick={() => setFiltersVisible(false)}>
              Ver {filteredDiaristas.length} resultado(s)
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Drawer do Perfil Principal */}
      <Drawer
        title={null}
        placement={isMobile ? "bottom" : "right"}
        onClose={closeDrawer}
        open={drawerVisible}
        width={isMobile ? "100%" : 600}
        height={isMobile ? "90%" : "100%"}
        className="professional-drawer"
        bodyStyle={{
          padding: "0",
          background: "#f8fafc",
        }}
        headerStyle={{ display: "none" }}
      >
        {selectedProfile && (
          <div className="drawer-content">
            <div className="drawer-header">
              <button className="drawer-close-btn" onClick={closeDrawer}>{"\u2715"}</button>
              <div className="drawer-cover-premium"></div>
              
              <div className="drawer-profile-main">
                <div className="drawer-avatar-wrapper">
                  <img
                    src={selectedProfile.photo}
                    alt={selectedProfile.name}
                    className="drawer-avatar-premium"
                  />
                </div>
                
                <div className="drawer-name-online-row">
                  <h2 className="drawer-name-premium">{selectedProfile.name}</h2>
                  <OnlineIndicator
                    isOnline={isDiaristOnline(selectedProfile.id)}
                    label={isDiaristOnline(selectedProfile.id) ? "Online agora" : "Offline"}
                    className="drawer-online-indicator"
                  />
                </div>
                <div className="drawer-rating-pill">
                  <StarFilled style={{ color: "#f59e0b" }} />
                  <span className="rating-val">{formatAverageRatingText(selectedProfile.average_rating)}</span>
                  <span className="rating-count">({allReviews.length || selectedProfile.total_reviews || 0} avaliações)</span>
                </div>
                <div style={{ marginTop: "10px" }}>
                  <span
                    style={getEmailVerificationTagStyle(
                      Boolean(
                        selectedProfile.email_verified ??
                          selectedProfile.EmailVerified,
                      ),
                    )}
                  >
                    {getEmailVerificationLabel(
                      Boolean(
                        selectedProfile.email_verified ??
                          selectedProfile.EmailVerified,
                      ),
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="drawer-body-premium">
              <div className="premium-section">
                <h4 className="premium-section-title">
                  <UserOutlined /> Sobre a Profissional
                </h4>
                <p className="bio-text">
                  {selectedProfile.diarist_profile?.bio || "Bio profissional nao informada."}
                </p>
              </div>

              <div className="premium-section">
                <h4 className="premium-section-title">
                  <TrophyFilled /> Informacoes reais
                </h4>
                <div className="stats-grid-premium">
                  <div className="stat-card-premium">
                    <EnvironmentOutlined className="stat-icon" />
                    <span className="stat-label-premium">Distância</span>
                    <span className="stat-value-premium">{selectedProfile.distance}</span>
                  </div>
                  <div className="stat-card-premium">
                    <SafetyCertificateOutlined className="stat-icon" />
                    <span className="stat-label-premium">Experiência</span>
                    <span className="stat-value-premium">{getDiaristExperienceYears(selectedProfile)} anos</span>
                  </div>
                  <div className="stat-card-premium">
                    <StarFilled className="stat-icon" style={{ color: "#f59e0b" }} />
                    <span className="stat-label-premium">Avaliacao</span>
                    <span className="stat-value-premium">{formatAverageRatingText(selectedProfile.average_rating)}</span>
                  </div>
                  <div className="stat-card-premium">
                    <CheckCircleOutlined
                      className="stat-icon"
                      style={{ color: getDiaristAvailable(selectedProfile) ? "#10b981" : "#94a3b8" }}
                    />
                    <span className="stat-label-premium">Disponibilidade</span>
                    <span className="stat-value-premium">
                      {getDiaristAvailable(selectedProfile) ? "Disponivel" : "Indisponivel"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="premium-section">
                <h4 className="premium-section-title">
                  <ThunderboltFilled /> Valores informados
                </h4>
                <div className="pricing-container-premium">
                  <div className="price-card-premium">
                    <div className="price-info-main">
                      <span className="price-title-premium">Preco por hora</span>
                    </div>
                    <div className="price-val-premium">{formatPriceValue(getDiaristPricePerHour(selectedProfile))}</div>
                  </div>
                  
                  <div className="price-card-premium">
                    <div className="price-info-main">
                      <span className="price-title-premium">Preco por diaria</span>
                    </div>
                    <div className="price-val-premium">{formatPriceValue(getDiaristPricePerDay(selectedProfile))}</div>
                  </div>
                </div>
              </div>

              <div className="premium-section">
                <h4 className="premium-section-title">
                  <CheckCircleOutlined /> Especialidades
                </h4>
                <div className="skills-flex">
                  {getDiaristSpecialties(selectedProfile).length > 0 ? (
                    getDiaristSpecialties(selectedProfile).map((specialty) => (
                      <div key={specialty} className="drawer-specialty-card">
                        <span className="drawer-specialty-card__icon">
                          {getSpecialtyPresentation(specialty).icon}
                        </span>
                        <span className="drawer-specialty-card__label">
                          {getSpecialtyPresentation(specialty).label}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="skill-pill-premium">Nenhuma especialidade informada</span>
                  )}
                </div>
              </div>

              <div className="premium-section">
                <div className="reviews-section-header">
                  <h4 className="premium-section-title">
                    <StarFilled style={{ color: "#FFD700" }} /> Avaliações
                  </h4>
                </div>
                <div className="reviews-list-preview">
                  {reviewsLoading ? (
                    <p className="loading-reviews-text">Carregando avaliações...</p>
                  ) : allReviews.length === 0 ? (
                    <p className="no-reviews-text">Nenhuma avaliação ainda.</p>
                  ) : (
                    allReviews.slice(0, 5).map((review, index) => (
                      <div key={index} className="review-card-preview">
                        <div className="review-header-preview">
                          <div className="review-stars-preview">
                            {renderReviewStars(review.client_rating)}
                          </div>
                          <span className="review-date-preview">
                            {new Date(review.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="review-comment-preview">{review.client_comment}</p>
                      </div>
                    ))
                  )}
                </div>
                {allReviews.length > 5 && (
                  <button
                    className="view-more-reviews-btn"
                    onClick={openReviewsDrawer}
                  >
                    Ver todas as {allReviews.length} avaliações
                  </button>
                )}
              </div>
            </div>

            <div className="drawer-footer-fixed">
              <button
                className="footer-action-btn"
                onClick={() => {
                  setSelectedDiarista(selectedProfile);
                  closeDrawer();
                  onHireClick();
                }}
              >
                Reservar agora <ArrowRightOutlined />
              </button>
              <div className="footer-disclaimer">
                <InfoCircleOutlined /> O pagamento é feito com a diarista no local, após o serviço, de forma segura e garantida.
              </div>
              <div className="footer-disclaimer">
                <InfoCircleOutlined /> Cancelamento gratuito até 24h antes do serviço.
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Drawer de Todas as Avaliacoes */}
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
            <button className="drawer-close-btn" onClick={closeReviewsDrawer}>{"\u2715"}</button>
            <h2 className="reviews-drawer-title">Todas as avaliações</h2>
            <p className="reviews-drawer-subtitle">
              {selectedProfile?.name} - {allReviews.length} avaliações
            </p>
          </div>

          <div className="reviews-drawer-body">
            {reviewsLoading ? (
              <p className="loading-reviews-text">Carregando avaliações...</p>
            ) : allReviews.length === 0 ? (
              <p className="no-reviews-text">Nenhuma avaliação ainda.</p>
            ) : (
              allReviews.map((review, index) => (
                <div key={index} className="review-card-full">
                  <div className="review-header-full">
                    <div className="review-stars-full">
                      {renderReviewStars(review.client_rating)}
                    </div>
                    <span className="review-date-full">
                      {new Date(review.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="review-comment-full">{review.client_comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

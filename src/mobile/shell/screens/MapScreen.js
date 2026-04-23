import React, { useState } from "react";
import { Image, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch, buildApiPathUrl } from "../../../config/api";
import { palette, styles } from "../AppShell.styles";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import useRemoteResource from "../hooks/useRemoteResource";
import HireOrderModal from "../components/HireOrderModal";
import {
  formatAverageRatingText,
  formatCurrency,
  formatShortDate,
  getDiaristAvailable,
  getDiaristExperienceYears,
  getDiaristPricePerDay,
  getDiaristPricePerHour,
  getDiaristProfile,
  getDiaristSpecialties,
  getEmailVerificationLabel,
  getSpecialtyPresentation,
  normalizeAddress,
  normalizeDiaristReview,
  normalizeMapDiarist,
} from "../utils/shellUtils";
function MapLoadingState() {
  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={[styles.screenContent, styles.mapScreenContent]}
      scrollEnabled={false}
    >
      <View style={styles.loadingHero}>
        <View style={styles.loadingPulseDot} />
        <Text style={styles.loadingHeroTitle}>Buscando diaristas proximas</Text>
        <Text style={styles.loadingHeroCopy}>
          Estamos localizando profissionais perto do endereco ativo.
        </Text>
      </View>
      <View style={styles.loadingSectionCard}>
        <View style={styles.loadingSectionHeader}>
          <View style={styles.loadingTitleBar} />
          <View style={styles.loadingCountDot} />
        </View>
        <View style={styles.loadingToolbar}>
          <View style={styles.loadingToolbarCopy}>
            <View style={[styles.loadingLine, styles.loadingLineShorter]} />
            <View style={[styles.loadingLine, styles.loadingLineMedium]} />
          </View>
          <View style={styles.loadingFilterButton} />
        </View>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.loadingDiaristCard}>
            <View style={styles.loadingAvatar} />
            <View style={styles.loadingCardBody}>
              <View style={[styles.loadingLine, styles.loadingLineWide]} />
              <View style={[styles.loadingLine, styles.loadingLineMedium]} />
              <View style={[styles.loadingLine, styles.loadingLineShort]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
export default function MapScreen({ session }) {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [allReviews, setAllReviews] = useState([]);
  const [selectedDiaristForHire, setSelectedDiaristForHire] = useState(null);
  const [hireModalOpen, setHireModalOpen] = useState(false);

  const resource = useRemoteResource(async () => {
    const profileResponse = await apiFetch("/profile", { authenticated: true });
    if (!profileResponse.ok) {
      throw new Error("Nao foi possivel carregar o perfil.");
    }

    const profile = await profileResponse.json().catch(() => ({}));
    const addresses = Array.isArray(profile?.address || profile?.Address)
      ? (profile.address || profile.Address).map(normalizeAddress)
      : [];

    const primaryAddress =
      addresses.find((address) => address.latitude && address.longitude) || addresses[0];

    if (!primaryAddress?.latitude || !primaryAddress?.longitude) {
      return { diarists: [], selectedAddress: null };
    }

    const nearbyResponse = await fetch(
      `${buildApiPathUrl("/diarists-nearby")}?latitude=${primaryAddress.latitude}&longitude=${primaryAddress.longitude}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        credentials: "include",
      },
    );

    const diarists = nearbyResponse.ok ? await nearbyResponse.json().catch(() => []) : [];
    return {
      diarists: Array.isArray(diarists) ? diarists : [],
      selectedAddress: primaryAddress,
    };
  }, [session.token]);

  const payload = resource.data || { diarists: [], selectedAddress: null };

  const loadReviews = async (diaristId) => {
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

  const openProfile = async (diarist) => {
    setSelectedProfile(normalizeMapDiarist(diarist));
    setProfileModalOpen(true);
    setReviewsModalOpen(false);
    setAllReviews([]);
    await loadReviews(diarist?.id || diarist?.ID);
  };

  const openHireModal = (diarist) => {
    setSelectedDiaristForHire(normalizeMapDiarist(diarist));
    setHireModalOpen(true);
  };

  const closeHireModal = () => {
    setHireModalOpen(false);
    setSelectedDiaristForHire(null);
  };

  if (resource.loading && !resource.data) {
    return <MapLoadingState />;
  }

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={[styles.screenContent, styles.mapScreenContent]}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} />}
    >
      <View style={styles.mapHero}>
        <Text style={styles.mapHeroTitle}>Diaristas disponiveis</Text>
        <Text style={styles.mapHeroSubtitle}>
          {payload.diarists.length} profissionais prontos para te atender
        </Text>
        <View style={styles.mapFilterToolbar}>
          <View style={styles.mapFilterToolbarCopy}>
            <Text style={styles.mapFilterKicker}>Resumo</Text>
            <Text style={styles.mapFilterToolbarText}>Profissionais proximas ao endereco ativo</Text>
          </View>
          <View style={styles.mapFilterTrigger}>
            <Feather name="filter" size={14} color="#ffffff" />
            <Text style={styles.mapFilterTriggerText}>Lista</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapList}>
        {resource.error ? (
          <SectionCard title="Diaristas disponiveis" right={<Text style={styles.sectionMeta}>0</Text>}>
            <Text style={styles.errorText}>{resource.error}</Text>
          </SectionCard>
        ) : payload.diarists.length === 0 ? (
          <SectionCard title="Diaristas disponiveis" right={<Text style={styles.sectionMeta}>0</Text>}>
            <EmptyState
              title="Nenhuma diarista encontrada"
              description="Tente ampliar a distancia ou atualizar o endereco ativo para encontrar mais profissionais."
            />
          </SectionCard>
        ) : (
          payload.diarists.map((diarist, index) => {
            const normalizedDiarist = normalizeMapDiarist(diarist);
            const name = normalizedDiarist.name;
            const distance = normalizedDiarist.distance || "Distancia nao informada";
            const rating = formatAverageRatingText(normalizedDiarist.average_rating);
            const experienceYears = getDiaristExperienceYears(normalizedDiarist);
            const isAvailable = getDiaristAvailable(normalizedDiarist);
            const profileInitial = String(name).trim().charAt(0).toUpperCase() || "D";

            return (
              <View key={normalizedDiarist?.id || index} style={styles.mapProfessionalCard}>
                <View style={styles.mapProfessionalMain}>
                  <View style={styles.mapPhotoWrapper}>
                    {normalizedDiarist?.photo ? (
                      <Image source={{ uri: normalizedDiarist.photo }} style={styles.mapPhotoFrameImage} />
                    ) : (
                      <View style={styles.mapPhotoFrame}>
                        <Text style={styles.mapPhotoInitial}>{profileInitial}</Text>
                      </View>
                    )}
                    {Number(normalizedDiarist?.average_rating || 0) >= 4.5 ? (
                      <View style={styles.mapTopRatedBadge}>
                        <Feather name="shield" size={12} color={palette.accentAlt} />
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.mapPhotoStatusBadge,
                        isAvailable ? styles.mapPhotoStatusBadgeOn : styles.mapPhotoStatusBadgeOff,
                      ]}
                    >
                      <View
                        style={[
                          styles.mapPhotoStatusDot,
                          isAvailable ? styles.mapAvailabilityDotOn : styles.mapAvailabilityDotOff,
                        ]}
                      />
                      <Text
                        style={[
                          styles.mapPhotoStatusText,
                          isAvailable ? styles.mapPhotoStatusTextOn : styles.mapPhotoStatusTextOff,
                        ]}
                      >
                        {isAvailable ? "Disponivel" : "Indisponivel"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapProfessionalContent}>
                    <View style={styles.mapProfessionalHeader}>
                      <View style={styles.mapProfessionalNameBlock}>
                        <Text style={styles.mapProfessionalName}>{name}</Text>
                      </View>
                      <View style={styles.mapRatingBadge}>
                        <Feather name="star" size={13} color={palette.accentAlt} />
                        <Text style={styles.mapRatingBadgeText}>{rating}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.mapProfessionalBottom}>
                  <View style={styles.mapMetaRow}>
                    <View style={styles.mapDistanceBadge}>
                      <Feather name="map-pin" size={13} color={palette.accent} />
                      <Text style={styles.mapDistanceBadgeText}>{distance} de distancia</Text>
                    </View>

                    <View style={styles.mapExperienceBadge}>
                      <Feather name="user" size={13} color={palette.accent} />
                      <Text style={styles.mapExperienceBadgeText}>
                        {experienceYears} anos de experiencia
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapPriceGrid}>
                    <View style={styles.mapPriceItem}>
                      <Text style={styles.mapPriceLabel}>Por Hora</Text>
                      <Text style={styles.mapPriceValue}>
                        {formatCurrency(getDiaristPricePerHour(normalizedDiarist))}
                      </Text>
                    </View>
                    <View style={styles.mapPriceDivider} />
                    <View style={styles.mapPriceItem}>
                      <Text style={styles.mapPriceLabel}>Diaria</Text>
                      <Text style={styles.mapPriceValue}>
                        {formatCurrency(getDiaristPricePerDay(normalizedDiarist))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapCardActions}>
                    <TouchableOpacity
                      style={styles.mapSecondaryAction}
                      onPress={() => void openProfile(normalizedDiarist)}
                    >
                      <Text style={styles.mapSecondaryActionText}>Ver Perfil Completo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mapPrimaryAction}
                      onPress={() => openHireModal(normalizedDiarist)}
                    >
                      <Text style={styles.mapPrimaryActionText}>Contratar Agora</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Modal
        visible={profileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.mapProfileModalCard]}>
            {selectedProfile ? (
              <>
                <TouchableOpacity
                  style={styles.mapModalClose}
                  onPress={() => setProfileModalOpen(false)}
                >
                  <Text style={styles.mapModalCloseText}>x</Text>
                </TouchableOpacity>

                <View style={styles.mapProfileHeader}>
                  <View style={styles.mapProfileAvatarWrapper}>
                    {selectedProfile?.photo || selectedProfile?.Photo ? (
                      <Image
                        source={{ uri: selectedProfile?.photo || selectedProfile?.Photo }}
                        style={styles.mapProfileAvatar}
                      />
                    ) : (
                      <View style={styles.mapProfileAvatarFallback}>
                        <Text style={styles.mapProfileAvatarFallbackText}>
                          {String(selectedProfile?.name || "D").trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.mapProfileName}>
                    {selectedProfile?.name || selectedProfile?.Name || "Diarista"}
                  </Text>
                  <View style={styles.mapHeaderMetaRow}>
                    <View style={styles.mapRatingPillLarge}>
                      <Feather name="star" size={14} color={palette.accentAlt} />
                      <Text style={styles.mapRatingPillLargeText}>
                        {formatAverageRatingText(selectedProfile?.average_rating || 0)}
                      </Text>
                      <Text style={styles.mapRatingPillLargeCount}>
                        ({allReviews.length || selectedProfile?.total_reviews || 0} avaliacoes)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.mapVerificationPill,
                        selectedProfile?.email_verified
                          ? styles.mapVerificationPillVerified
                          : styles.mapVerificationPillUnverified,
                      ]}
                    >
                      <Feather
                        name={selectedProfile?.email_verified ? "check-circle" : "x-circle"}
                        size={13}
                        color={selectedProfile?.email_verified ? "#16a34a" : "#dc2626"}
                      />
                      <Text
                        style={[
                          styles.mapVerificationPillText,
                          selectedProfile?.email_verified
                            ? styles.mapVerificationPillTextVerified
                            : styles.mapVerificationPillTextUnverified,
                        ]}
                      >
                        {getEmailVerificationLabel(Boolean(selectedProfile?.email_verified))}
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
                      <Feather name="user" size={16} color={palette.accent} />
                      <Text style={styles.mapProfileSectionTitle}>Sobre a Profissional</Text>
                    </View>
                    <Text style={styles.mapProfileSectionCopy}>
                      {getDiaristProfile(selectedProfile)?.bio ||
                        getDiaristProfile(selectedProfile)?.Bio ||
                        selectedProfile?.bio ||
                        selectedProfile?.Bio ||
                        "Bio profissional nao informada."}
                    </Text>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="award" size={16} color={palette.accentAlt} />
                      <Text style={styles.mapProfileSectionTitle}>Informacoes reais</Text>
                    </View>
                    <View style={styles.mapStatsGrid}>
                      <View style={styles.mapStatCard}>
                        <Feather name="map-pin" size={15} color={palette.accent} />
                        <Text style={styles.mapStatLabel}>Distancia</Text>
                        <Text style={styles.mapStatValue}>{selectedProfile?.distance || "-"}</Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="shield" size={15} color={palette.accent} />
                        <Text style={styles.mapStatLabel}>Experiencia</Text>
                        <Text style={styles.mapStatValue}>
                          {getDiaristExperienceYears(selectedProfile)} anos
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather name="star" size={15} color={palette.accentAlt} />
                        <Text style={styles.mapStatLabel}>Avaliacao</Text>
                        <Text style={styles.mapStatValue}>
                          {formatAverageRatingText(selectedProfile?.average_rating || 0)}
                        </Text>
                      </View>
                      <View style={styles.mapStatCard}>
                        <Feather
                          name="check-circle"
                          size={15}
                          color={getDiaristAvailable(selectedProfile) ? "#10b981" : "#94a3b8"}
                        />
                        <Text style={styles.mapStatLabel}>Disponibilidade</Text>
                        <Text style={styles.mapStatValue}>
                          {getDiaristAvailable(selectedProfile) ? "Disponivel" : "Indisponivel"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="dollar-sign" size={16} color={palette.accentAlt} />
                      <Text style={styles.mapProfileSectionTitle}>Valores informados</Text>
                    </View>
                    <View style={styles.mapDrawerPricing}>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por hora</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(getDiaristPricePerHour(selectedProfile))}
                        </Text>
                      </View>
                      <View style={styles.mapDrawerPriceCard}>
                        <Text style={styles.mapDrawerPriceLabel}>Preco por diaria</Text>
                        <Text style={styles.mapDrawerPriceValue}>
                          {formatCurrency(getDiaristPricePerDay(selectedProfile))}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mapProfileSection}>
                    <View style={styles.mapProfileSectionHeading}>
                      <Feather name="check-circle" size={16} color={palette.accent} />
                      <Text style={styles.mapProfileSectionTitle}>Especialidades</Text>
                    </View>
                    <View style={styles.mapSpecialtiesWrap}>
                      {getDiaristSpecialties(selectedProfile).length > 0 ? (
                        getDiaristSpecialties(selectedProfile).map((specialty) => {
                          const presentation = getSpecialtyPresentation(specialty);
                          return (
                            <View key={specialty} style={styles.mapSpecialtyCard}>
                              <Feather name={presentation.icon} size={14} color={palette.accent} />
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
                      <Feather name="star" size={16} color={palette.accentAlt} />
                      <Text style={styles.mapProfileSectionTitle}>Avaliacoes</Text>
                    </View>
                    {reviewsLoading ? (
                      <Text style={styles.mapProfileSectionCopy}>Carregando avaliacoes...</Text>
                    ) : allReviews.length === 0 ? (
                      <Text style={styles.mapProfileSectionCopy}>Nenhuma avaliacao ainda.</Text>
                    ) : (
                      allReviews.slice(0, 5).map((review, index) => (
                        <View key={review?.id || review?.ID || index} style={styles.mapReviewCard}>
                          <View style={styles.mapReviewHeader}>
                            <Text style={styles.mapReviewStars}>
                              {"*".repeat(
                                Math.max(
                                  0,
                                  Math.min(
                                    5,
                                    Math.round(Number(review?.client_rating || review?.ClientRating || 0)),
                                  ),
                                ),
                              )}
                            </Text>
                            <Text style={styles.mapReviewDate}>
                              {formatShortDate(review?.created_at || review?.CreatedAt)}
                            </Text>
                          </View>
                          <Text style={styles.mapReviewComment}>
                            {review?.client_comment ||
                              review?.ClientComment ||
                              "Sem comentario informado."}
                          </Text>
                        </View>
                      ))
                    )}
                    {!reviewsLoading && allReviews.length > 5 ? (
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

                <View style={styles.mapProfileFooter}>
                  <TouchableOpacity
                    style={styles.mapReserveButton}
                    onPress={() => {
                      setProfileModalOpen(false);
                      openHireModal(selectedProfile);
                    }}
                  >
                    <Text style={styles.mapReserveButtonText}>Reservar agora</Text>
                  </TouchableOpacity>
                  <Text style={styles.mapFooterNote}>
                    O pagamento e feito com a diarista no local, apos o servico.
                  </Text>
                  <Text style={styles.mapFooterNote}>
                    Cancelamento gratuito ate 24h antes do servico.
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <HireOrderModal
        visible={hireModalOpen}
        diarist={selectedDiaristForHire}
        selectedAddress={payload.selectedAddress}
        onClose={closeHireModal}
        onSuccess={resource.refresh}
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
            <Text style={styles.modalCopy}>
              {selectedProfile?.name || "Profissional"} - {allReviews.length} avaliacoes
            </Text>
            <ScrollView style={styles.reviewsScroll}>
              {allReviews.map((review, index) => (
                <View key={review?.id || review?.ID || index} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewStars}>
                      {"*".repeat(
                        Math.max(
                          0,
                          Math.min(
                            5,
                            Math.round(Number(review?.client_rating || review?.ClientRating || 0)),
                          ),
                        ),
                      )}
                    </Text>
                    <Text style={styles.reviewDate}>
                      {formatShortDate(review?.created_at || review?.CreatedAt)}
                    </Text>
                  </View>
                  <Text style={styles.secondaryLine}>
                    {review?.client_comment || review?.ClientComment || "Sem comentario informado."}
                  </Text>
                </View>
              ))}
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




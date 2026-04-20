import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { apiFetch } from "../../../config/api";
import { styles } from "../AppShell.styles";
import EmptyState from "../components/EmptyState";
import SectionCard from "../components/SectionCard";
import LoadingState from "../components/LoadingState";
import useRemoteResource from "../hooks/useRemoteResource";

function normalizeAddress(address = {}) {
  return {
    id: address.id || address.ID || null,
    street: address.street || address.Street || "",
    number: address.number || address.Number || "",
    neighborhood: address.neighborhood || address.Neighborhood || "",
    city: address.city || address.City || "",
    state: address.state || address.State || "",
    zipcode: address.zipcode || address.Zipcode || "",
    latitude: Number(address.latitude || address.Latitude || 0),
    longitude: Number(address.longitude || address.Longitude || 0),
  };
}

function formatAddress(address) {
  return [address?.street, address?.number, address?.neighborhood, address?.city]
    .filter(Boolean)
    .join(", ");
}

export default function ProfileScreen({ session }) {
  const resource = useRemoteResource(async () => {
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

    return { profile, subscription };
  }, [session.token]);

  if (resource.loading && !resource.data) {
    return <LoadingState label="Carregando perfil..." />;
  }

  const payload = resource.data || { profile: {}, subscription: {} };
  const profile = payload.profile || {};
  const addresses = Array.isArray(profile?.address || profile?.Address)
    ? (profile.address || profile.Address).map(normalizeAddress)
    : [];

  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} />}
    >
      <SectionCard title="Conta">
        {resource.error ? (
          <Text style={styles.errorText}>{resource.error}</Text>
        ) : (
          <>
            <Text style={styles.primaryLine}>{profile?.name || profile?.Name || "Usuario"}</Text>
            <Text style={styles.secondaryLine}>{profile?.email || profile?.Email || "E-mail nao informado"}</Text>
            <View style={styles.inlineMeta}>
              <Text style={styles.metaBadge}>{session.role === "diarista" ? "Diarista" : "Cliente"}</Text>
              <Text style={styles.metaBadge}>
                {payload.subscription?.has_valid_subscription || payload.subscription?.is_test_user
                  ? "Assinatura ativa"
                  : "Sem assinatura"}
              </Text>
            </View>
          </>
        )}
      </SectionCard>

      <SectionCard title="Enderecos" right={<Text style={styles.sectionMeta}>{addresses.length}</Text>}>
        {addresses.length === 0 ? (
          <EmptyState
            title="Nenhum endereco"
            description="Adicione ou complete um endereco para usar mapa e ofertas."
          />
        ) : (
          addresses.map((address, index) => (
            <View key={address.id || index} style={styles.listCard}>
              <Text style={styles.listTitle}>{formatAddress(address) || "Endereco sem detalhes"}</Text>
              <Text style={styles.secondaryLine}>{address.zipcode || "CEP nao informado"}</Text>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}


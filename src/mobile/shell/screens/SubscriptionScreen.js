import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../../config/api";
import { palette as shellPalette, styles as shellStyles } from "../AppShell.styles";

const palette = {
  surface: "#ffffff",
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  accentSoft: "#dbeafe",
  border: "#d9dee8",
  error: "#dc2626",
  errorBg: "#fef2f2",
  success: "#166534",
  successBg: "#edfdf3",
  info: "#1d4ed8",
  infoBg: "#eff6ff",
};

const planOptions = [
  {
    id: "monthly",
    name: "Mensal",
    price: 15.0,
    originalPrice: 19.9,
    description: "Ideal para quem quer testar",
    features: ["Acesso total", "Suporte prioritário", "Sem fidelidade"],
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: 37.0,
    originalPrice: 45.0,
    description: "O melhor custo-benefício",
    features: ["Acesso total", "Suporte prioritário", "Economize 20%"],
    popular: true,
  },
  {
    id: "yearly",
    name: "Anual",
    price: 150.0,
    originalPrice: 180.0,
    description: "Para quem quer economizar de verdade",
    features: ["Acesso total", "Suporte prioritário", "Economize 45%"],
    bestValue: true,
  },
];

function StatusCard({ type, text }) {
  const variantStyle =
    type === "error"
      ? styles.statusError
      : type === "success"
        ? styles.statusSuccess
        : styles.statusInfo;

  const textStyle =
    type === "error"
      ? styles.statusErrorText
      : type === "success"
        ? styles.statusSuccessText
        : styles.statusInfoText;

  return (
    <View style={[styles.statusCard, variantStyle]}>
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

export default function SubscriptionScreen({ session }) {
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [error, setError] = useState(null);

  const hasAccess = session.hasValidSubscription || session.isTestUser;

  const handlePlanSelected = async (plan) => {
    setProcessingPlanId(plan.id);
    setError(null);

    try {
      const response = await apiFetch("/subscriptions/checkout-session", {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ plan: plan.id }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível iniciar o checkout.");
      }

      if (payload?.url) {
        await Linking.openURL(payload.url);
      } else {
        throw new Error("URL de checkout não recebida.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingPlanId(null);
    }
  };

  if (hasAccess) {
    return (
      <ScrollView style={shellStyles.screenScroll} contentContainerStyle={shellStyles.screenContent}>
        <View style={styles.roleHeader}>
          <Text style={styles.roleTitle}>Assinatura Ativa</Text>
          <Text style={styles.roleCopy}>
            Sua conta já possui acesso premium liberado. Aproveite todos os recursos do Limpae!
          </Text>
        </View>
        <StatusCard type="success" text="Você tem acesso total ao aplicativo." />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={shellStyles.screenScroll} contentContainerStyle={shellStyles.screenContent}>
      <View style={styles.roleHeader}>
        <Text style={styles.roleTitle}>Escolha seu plano</Text>
        <Text style={styles.roleCopy}>
          Selecione a melhor opção para você e siga para o checkout para liberar seu acesso.
        </Text>
      </View>

      {error ? <StatusCard type="error" text={error} /> : null}

      {planOptions.map((plan) => {
        const processing = processingPlanId === plan.id;
        return (
          <View key={plan.id} style={styles.planCard}>
            {plan.popular ? <Text style={styles.planBadge}>Mais popular</Text> : null}
            {plan.bestValue ? <Text style={styles.planBadge}>Melhor valor</Text> : null}
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>
              R$ {plan.price.toFixed(2)} <Text style={styles.planPeriod}>/período</Text>
            </Text>
            <Text style={styles.planOriginal}>de R$ {plan.originalPrice.toFixed(2)}</Text>
            <Text style={styles.planDescription}>{plan.description}</Text>
            {plan.features.map((feature) => (
              <Text key={feature} style={styles.planFeature}>• {feature}</Text>
            ))}
            <TouchableOpacity
              disabled={Boolean(processingPlanId)}
              onPress={() => handlePlanSelected(plan)}
              style={[
                styles.primaryButton,
                { marginTop: 16 },
                Boolean(processingPlanId) && styles.primaryButtonDisabled,
              ]}
            >
              {processing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Assinar</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  roleHeader: {
    marginBottom: 24,
    alignItems: "center",
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  roleCopy: {
    fontSize: 16,
    color: palette.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  statusCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  statusError: {
    backgroundColor: palette.errorBg,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  statusSuccess: {
    backgroundColor: palette.successBg,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusInfo: {
    backgroundColor: palette.infoBg,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  statusErrorText: {
    color: palette.error,
    fontSize: 13,
    lineHeight: 18,
  },
  statusSuccessText: {
    color: palette.success,
    fontSize: 13,
    lineHeight: 18,
  },
  statusInfoText: {
    color: palette.info,
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#ffffff",
    padding: 18,
    marginBottom: 12,
  },
  planBadge: {
    alignSelf: "flex-start",
    marginBottom: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: palette.accentSoft,
    color: palette.accent,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  planName: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  planPrice: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 10,
  },
  planPeriod: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  planOriginal: {
    color: palette.muted,
    fontSize: 13,
    textDecorationLine: "line-through",
    marginTop: 3,
  },
  planDescription: {
    color: palette.ink,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  planFeature: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});

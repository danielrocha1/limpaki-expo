import React, { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../../config/api";
import { styles as shellStyles } from "../AppShell.styles";

const palette = {
  ink: "#1f2937",
  muted: "#6b7280",
  body: "#4b5563",
  blue: "#3b82f6",
  bronze: "#92400e",
  gold: "#10b981",
  goldDark: "#065f46",
  border: "#e5e7eb",
  error: "#dc2626",
  errorBg: "#fef2f2",
  success: "#166534",
  successBg: "#edfdf3",
  info: "#1d4ed8",
  infoBg: "#eff6ff",
};

const checkIcon = "\u2714\uFE0F";
const STRIPE_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLIC_KEY ||
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_STRIPE_PUBLIC_KEY ||
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ||
  process.env.STRIPE_PUBLISHABLE_KEY ||
  "";

const planOptions = [
  {
    id: "monthly",
    name: "Mensal",
    price: 15.0,
    originalPrice: 19.9,
    description: "Ideal para quem quer testar",
    features: ["Acesso total", "Suporte prioritário", "Sem fidelidade"],
    color: "bronze",
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: 37.0,
    originalPrice: 45.0,
    description: "O melhor custo-benefício",
    features: ["Acesso total", "Suporte prioritário", "Economize 20%"],
    popular: true,
    color: "silver",
  },
  {
    id: "yearly",
    name: "Anual",
    price: 150.0,
    originalPrice: 180.0,
    description: "Para quem quer economizar de verdade",
    features: ["Acesso total", "Suporte prioritário", "Economize 45%"],
    bestValue: true,
    color: "gold",
  },
];

const planTheme = {
  bronze: {
    title: palette.bronze,
    amount: palette.bronze,
    button: palette.bronze,
    border: palette.border,
    gradient: ["#ffffff", "#ffffff"],
    shadow: "#000000",
    shadowOpacity: 0.1,
  },
  silver: {
    title: "#1e40af",
    amount: "#1e40af",
    button: palette.blue,
    border: palette.blue,
    badge: palette.blue,
    gradient: ["#ffffff", "#f0f7ff"],
    shadow: palette.blue,
    shadowOpacity: 0.15,
  },
  gold: {
    title: palette.goldDark,
    amount: palette.goldDark,
    button: palette.gold,
    border: palette.gold,
    badge: palette.gold,
    gradient: ["#ffffff", "#f0fdf4"],
    shadow: palette.gold,
    shadowOpacity: 0.15,
  },
};

function splitPrice(price) {
  const [amount, cents] = price.toFixed(2).split(".");
  return { amount, cents };
}

function maskStripeKey(value = "") {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.length <= 12) {
    return `${normalizedValue.slice(0, 4)}...`;
  }

  return `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-4)}`;
}

function logSubscriptionDebug(message, details = {}) {
  console.log(`[mobile-subscription] ${message}`, details);
}

async function redirectToCheckout(payload) {
  const publishableKey = payload?.publishable_key || STRIPE_PUBLIC_KEY;

  logSubscriptionDebug("redirect payload received", {
    hasUrl: Boolean(payload?.url),
    hasSessionId: Boolean(payload?.session_id),
    hasBackendPublishableKey: Boolean(payload?.publishable_key),
    hasBundledPublishableKey: Boolean(STRIPE_PUBLIC_KEY),
    publishableKeyPreview: maskStripeKey(publishableKey),
    platform: Platform.OS,
  });

  if (payload?.url) {
    logSubscriptionDebug("redirecting with checkout url", {
      platform: Platform.OS,
    });

    if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.assign) {
      window.location.assign(payload.url);
      return;
    }

    await Linking.openURL(payload.url);
    return;
  }

  if (payload?.session_id && Platform.OS === "web" && publishableKey) {
    logSubscriptionDebug("redirecting with stripe session id", {
      sessionId: payload.session_id,
      publishableKeyPreview: maskStripeKey(publishableKey),
    });

    const { loadStripe } = await import("@stripe/stripe-js");
    const stripe = await loadStripe(publishableKey);
    const result = stripe
      ? await stripe.redirectToCheckout({ sessionId: payload.session_id })
      : null;

    if (result?.error) {
      logSubscriptionDebug("stripe redirect failed", {
        message: result.error.message,
      });
      throw new Error(result.error.message || "Falha ao redirecionar para o Stripe.");
    }

    return;
  }
  if (payload?.session_id && Platform.OS === "web" && !publishableKey) {
    logSubscriptionDebug("missing publishable key for stripe session", {
      sessionId: payload.session_id,
      payloadKeys: Object.keys(payload || {}),
    });
    throw new Error("Chave pública do Stripe não recebida do backend.");
  }

  logSubscriptionDebug("checkout payload missing redirect data", {
    payloadKeys: Object.keys(payload || {}),
  });
  throw new Error("Checkout do Stripe não retornou URL nem session id.");
}

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
    logSubscriptionDebug("checkout request start", {
      planId: plan?.id,
      planName: plan?.name,
      hasBundledPublishableKey: Boolean(STRIPE_PUBLIC_KEY),
      bundledPublishableKeyPreview: maskStripeKey(STRIPE_PUBLIC_KEY),
    });
    setProcessingPlanId(plan.id);
    setError(null);

    try {
      const response = await apiFetch("/subscriptions/checkout-session", {
        method: "POST",
        authenticated: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: plan.id }),
      });

      const payload = await response.json().catch(() => ({}));
      logSubscriptionDebug("checkout response received", {
        planId: plan?.id,
        status: response.status,
        ok: response.ok,
        hasUrl: Boolean(payload?.url),
        hasSessionId: Boolean(payload?.session_id),
        hasPublishableKey: Boolean(payload?.publishable_key),
        publishableKeyPreview: maskStripeKey(payload?.publishable_key),
        payloadKeys: Object.keys(payload || {}),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível iniciar o checkout.");
      }

      await redirectToCheckout(payload);
    } catch (err) {
      logSubscriptionDebug("checkout request failed", {
        planId: plan?.id,
        message: err?.message,
      });
      setError(err.message);
    } finally {
      logSubscriptionDebug("checkout request finished", {
        planId: plan?.id,
      });
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
        <Text style={styles.roleTitle}>Escolha seu Plano</Text>
        <Text style={styles.roleCopy}>
          Selecione a melhor opção para você e siga para o Stripe Checkout.
        </Text>
      </View>

      {error ? <StatusCard type="error" text={error} /> : null}

      {planOptions.map((plan) => {
        const processing = processingPlanId === plan.id;
        const theme = planTheme[plan.color] || planTheme.bronze;
        const { amount, cents } = splitPrice(plan.price);

        return (
          <LinearGradient
            key={plan.id}
            colors={theme.gradient}
            style={[
              styles.planCard,
              {
                borderColor: theme.border,
                shadowColor: theme.shadow,
                shadowOpacity: theme.shadowOpacity,
              },
            ]}
          >
            {plan.popular ? (
              <View style={[styles.planBadge, { backgroundColor: theme.badge }]}>
                <Text style={styles.planBadgeText}>MAIS POPULAR</Text>
              </View>
            ) : null}
            {plan.bestValue ? (
              <View style={[styles.planBadge, { backgroundColor: theme.badge }]}>
                <Text style={styles.planBadgeText}>MELHOR VALOR</Text>
              </View>
            ) : null}

            <Text style={[styles.planName, { color: theme.title }]}>{plan.name}</Text>

            <View style={styles.planPriceContainer}>
              <Text style={styles.planOriginal}>R$ {plan.originalPrice.toFixed(2)}</Text>
              <View style={styles.currentPrice}>
                <Text style={styles.planCurrency}>R$</Text>
                <Text style={[styles.planAmount, { color: theme.amount }]}>{amount}</Text>
                <Text style={styles.planCents}>,{cents}</Text>
                <Text style={styles.planPeriod}>/período</Text>
              </View>
            </View>

            <Text style={styles.planDescription}>{plan.description}</Text>

            <View style={styles.planFeatures}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.planFeatureRow}>
                  <Text style={styles.checkIcon}>{checkIcon}</Text>
                  <Text style={styles.planFeature}>{feature}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              disabled={Boolean(processingPlanId)}
              onPress={() => handlePlanSelected(plan)}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.button },
                Boolean(processingPlanId) && styles.primaryButtonDisabled,
              ]}
            >
              {processing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Assinar com Stripe</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        );
      })}

      <View style={styles.planFooter}>
        <Text style={styles.footerNote}>
          {checkIcon} Cobrança recorrente segura {checkIcon} Cancelamento imediato {checkIcon} Acesso controlado por webhook
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  roleHeader: {
    marginBottom: 40,
    alignItems: "center",
  },
  roleTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
  },
  roleCopy: {
    fontSize: 18,
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 24,
  },
  statusCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 24,
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
    position: "relative",
    borderRadius: 24,
    borderWidth: 2,
    padding: 32,
    marginBottom: 24,
    minHeight: 430,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 20 },
    elevation: 4,
  },
  planBadge: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 2,
  },
  planBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  planName: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  planPriceContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  planOriginal: {
    color: "#9ca3af",
    fontSize: 16,
    textDecorationLine: "line-through",
    marginBottom: 4,
  },
  currentPrice: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  planCurrency: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "600",
    marginRight: 2,
  },
  planAmount: {
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 56,
  },
  planCents: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  planPeriod: {
    color: palette.muted,
    fontSize: 14,
    marginLeft: 4,
  },
  planDescription: {
    color: palette.body,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    minHeight: 40,
    marginBottom: 24,
  },
  planFeatures: {
    flexGrow: 1,
    marginBottom: 32,
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkIcon: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "800",
    marginRight: 12,
  },
  planFeature: {
    flex: 1,
    color: palette.body,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  planFooter: {
    alignItems: "center",
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  footerNote: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0.5,
  },
});

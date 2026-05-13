import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../../config/api";
import { SUBSCRIPTION_PLAN_PRICE_BRL } from "../../../config/subscriptionPlans";
import { formatCheckoutSessionError, getCheckoutRedirectUrl } from "../../../config/subscriptionCheckout";
import { styles as shellStyles } from "../AppShell.styles";

const palette = {
  ink: "#1f2937",
  muted: "#6b7280",
  body: "#4b5563",
  pageBg: "#f3f4f6",
  cardBg: "#ffffff",
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

const planOptions = [
  {
    id: "monthly",
    name: "Mensal",
    price: SUBSCRIPTION_PLAN_PRICE_BRL.monthly,
    originalPrice: 19.9,
    description: "Ideal para quem quer testar",
    features: ["Acesso total", "Suporte prioritário", "Sem fidelidade"],
    color: "bronze",
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: SUBSCRIPTION_PLAN_PRICE_BRL.quarterly,
    originalPrice: 45.0,
    description: "O melhor custo-benefício",
    features: ["Acesso total", "Suporte prioritário", "Economize 20%"],
    popular: true,
    color: "silver",
  },
  {
    id: "yearly",
    name: "Anual",
    price: SUBSCRIPTION_PLAN_PRICE_BRL.yearly,
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

function logSubscriptionDebug(message, details = {}) {
  console.log(`[mobile-subscription] ${message}`, details);
}

/** Marca regresso do checkout MP (nativo) para mostrar modal de sucesso/insucesso. */
const MP_CHECKOUT_PENDING_KEY = "limpae_subscription_mp_checkout_pending_ts";
const MP_CHECKOUT_MAX_AGE_MS = 45 * 60 * 1000;
const MP_POLL_ATTEMPTS = 10;
const MP_POLL_INTERVAL_MS = 1600;

async function redirectToCheckout(payload) {
  const redirectUrl = getCheckoutRedirectUrl(payload);

  logSubscriptionDebug("redirect payload received", {
    hasRedirectUrl: Boolean(redirectUrl),
    platform: Platform.OS,
  });

  if (!redirectUrl) {
    throw new Error("O servidor não retornou um link de pagamento (url ou init_point).");
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.assign) {
    window.location.assign(redirectUrl);
    return;
  }

  try {
    await AsyncStorage.setItem(MP_CHECKOUT_PENDING_KEY, String(Date.now()));
  } catch (_e) {
    /* ignore */
  }
  await Linking.openURL(redirectUrl);
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

function SubscriptionPaymentResultModal({ visible, variant, onDismiss }) {
  const isSuccess = variant === "success";
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onDismiss}>
      <View style={styles.paymentModalOverlay}>
        <View style={styles.paymentModalCard}>
          <View
            style={[
              styles.paymentModalIconWrap,
              { backgroundColor: isSuccess ? palette.successBg : palette.errorBg },
            ]}
          >
            <Ionicons
              name={isSuccess ? "checkmark-circle" : "close-circle"}
              size={112}
              color={isSuccess ? palette.gold : palette.error}
            />
          </View>
          <Text style={styles.paymentModalTitle}>
            {isSuccess ? "Pagamento confirmado" : "Pagamento não concluído"}
          </Text>
          <Text style={styles.paymentModalBody}>
            {isSuccess
              ? "Sua assinatura foi ativada. Aproveite o acesso premium no Limpae."
              : "Não encontramos a assinatura ativa. Se você acabou de pagar, aguarde alguns instantes e tente de novo no Mercado Pago ou escolha um plano outra vez."}
          </Text>
          <TouchableOpacity style={styles.paymentModalButton} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.paymentModalButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function SubscriptionScreen({ session, onSessionUpdate, onAccessGranted }) {
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [error, setError] = useState(null);
  const [paymentFeedback, setPaymentFeedback] = useState(null);
  const pollingRef = useRef(false);
  const [statusState, setStatusState] = useState({
    loading: true,
    hasAccess: Boolean(session?.hasValidSubscription || session?.isTestUser),
    message: "",
  });

  const hasAccess = statusState.hasAccess;

  const pollAfterMpReturn = useCallback(async () => {
    if (Platform.OS === "web" || pollingRef.current) {
      return;
    }
    let raw;
    try {
      raw = await AsyncStorage.getItem(MP_CHECKOUT_PENDING_KEY);
    } catch (_e) {
      return;
    }
    if (!raw) {
      return;
    }
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > MP_CHECKOUT_MAX_AGE_MS) {
      try {
        await AsyncStorage.removeItem(MP_CHECKOUT_PENDING_KEY);
      } catch (_e2) {
        /* ignore */
      }
      return;
    }

    pollingRef.current = true;
    try {
      for (let i = 0; i < MP_POLL_ATTEMPTS; i += 1) {
        const response = await apiFetch("/subscriptions/access-status", {
          authenticated: true,
        });
        const payload = await response.json().catch(() => ({}));
        const hasValid = Boolean(payload?.has_valid_subscription);
        const isTestUser = Boolean(payload?.is_test_user);
        if (hasValid || isTestUser) {
          try {
            await AsyncStorage.removeItem(MP_CHECKOUT_PENDING_KEY);
          } catch (_e3) {
            /* ignore */
          }
          setPaymentFeedback("success");
          onSessionUpdate?.((currentSession) => ({
            ...currentSession,
            hasValidSubscription: hasValid,
            isTestUser,
          }));
          setStatusState({
            loading: false,
            hasAccess: true,
            message: "",
          });
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, MP_POLL_INTERVAL_MS);
        });
      }
      try {
        await AsyncStorage.removeItem(MP_CHECKOUT_PENDING_KEY);
      } catch (_e4) {
        /* ignore */
      }
      setPaymentFeedback("failed");
    } finally {
      pollingRef.current = false;
    }
  }, [onSessionUpdate]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return undefined;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void pollAfterMpReturn();
      }
    });
    return () => sub.remove();
  }, [pollAfterMpReturn]);

  const handleDismissPaymentModal = () => {
    if (paymentFeedback === "success") {
      onAccessGranted?.();
    }
    setPaymentFeedback(null);
  };

  useEffect(() => {
    let active = true;

    const loadAccessStatus = async () => {
      setStatusState((current) => ({
        ...current,
        loading: true,
        message: "",
      }));

      try {
        const response = await apiFetch("/subscriptions/access-status", {
          authenticated: true,
        });
        const payload = await response.json().catch(() => ({}));

        if (!active) {
          return;
        }

        const hasValidSubscription = Boolean(payload?.has_valid_subscription);
        const isTestUser = Boolean(payload?.is_test_user) || Boolean(session?.isTestUser);
        const hasEffectiveAccess = hasValidSubscription || isTestUser;

        setStatusState({
          loading: false,
          hasAccess: hasEffectiveAccess,
          message: "",
        });

        if (hasEffectiveAccess) {
          onSessionUpdate?.((currentSession) => ({
            ...currentSession,
            hasValidSubscription: hasValidSubscription,
            isTestUser,
          }));
          onAccessGranted?.();
        }
      } catch (_error) {
        if (!active) {
          return;
        }

        setStatusState({
          loading: false,
          hasAccess: Boolean(session?.hasValidSubscription || session?.isTestUser),
          message: "Não foi possível carregar o status da assinatura.",
        });
      }
    };

    void loadAccessStatus();

    return () => {
      active = false;
    };
  }, [onAccessGranted, onSessionUpdate, session?.hasValidSubscription, session?.isTestUser]);

  const handlePlanSelected = async (plan) => {
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
      logSubscriptionDebug("checkout response", {
        planId: plan?.id,
        ok: response.ok,
        status: response.status,
        error: payload?.error,
        code: payload?.code,
      });

      if (!response.ok) {
        throw new Error(formatCheckoutSessionError(payload, "Não foi possível iniciar o checkout."));
      }

      await redirectToCheckout(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingPlanId(null);
    }
  };

  if (statusState.loading) {
    return (
      <>
        <SubscriptionPaymentResultModal
          visible={paymentFeedback !== null}
          variant={paymentFeedback === "success" ? "success" : "failed"}
          onDismiss={handleDismissPaymentModal}
        />
        <ScrollView
          style={[shellStyles.screenScroll, styles.screenSurface]}
          contentContainerStyle={styles.screenContent}
        >
          <View style={styles.pageContainer}>
            <View style={styles.roleHeader}>
              <Text style={styles.roleTitle}>Escolha seu Plano</Text>
              <Text style={styles.roleCopy}>Consultando o status atual da assinatura...</Text>
            </View>
            <StatusCard type="info" text="Consultando o status atual da assinatura..." />
          </View>
        </ScrollView>
      </>
    );
  }

  if (hasAccess) {
    return (
      <>
        <SubscriptionPaymentResultModal
          visible={paymentFeedback !== null}
          variant={paymentFeedback === "success" ? "success" : "failed"}
          onDismiss={handleDismissPaymentModal}
        />
        <ScrollView
          style={[shellStyles.screenScroll, styles.screenSurface]}
          contentContainerStyle={styles.screenContent}
        >
          <View style={styles.pageContainer}>
            <View style={styles.roleHeader}>
              <Text style={styles.roleTitle}>Assinatura Ativa</Text>
              <Text style={styles.roleCopy}>
                Sua conta já possui acesso premium liberado. Aproveite todos os recursos do Limpae!
              </Text>
            </View>
            <StatusCard type="success" text="Você tem acesso total ao aplicativo." />
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <SubscriptionPaymentResultModal
        visible={paymentFeedback !== null}
        variant={paymentFeedback === "success" ? "success" : "failed"}
        onDismiss={handleDismissPaymentModal}
      />
      <ScrollView
        style={[shellStyles.screenScroll, styles.screenSurface]}
        contentContainerStyle={styles.screenContent}
      >
      <View style={styles.pageContainer}>
        <View style={styles.roleHeader}>
          <Text style={styles.roleTitle}>Escolha seu Plano</Text>
          <Text style={styles.roleCopy}>
            Selecione a melhor opção para você e siga para o pagamento seguro (Mercado Pago).
          </Text>
        </View>

        {error ? <StatusCard type="error" text={error} /> : null}
        {statusState.message ? <StatusCard type="error" text={statusState.message} /> : null}

        <View style={styles.planGrid}>
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
                    <Text style={styles.primaryButtonText}>Assinar agora</Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            );
          })}
        </View>

        <View style={styles.planFooter}>
          <Text style={styles.footerNote}>
            {checkIcon} Cobrança recorrente segura {checkIcon} Cancelamento imediato {checkIcon} Acesso controlado por webhook
          </Text>
        </View>
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screenSurface: {
    backgroundColor: palette.pageBg,
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: palette.pageBg,
  },
  pageContainer: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  roleHeader: {
    marginBottom: 32,
    alignItems: "center",
  },
  roleTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: palette.ink,
    textAlign: "center",
    marginBottom: 12,
  },
  roleCopy: {
    fontSize: 18,
    color: palette.muted,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 680,
  },
  planGrid: {
    gap: 24,
    marginBottom: 16,
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
    padding: 24,
    minHeight: 430,
    backgroundColor: palette.cardBg,
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
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  footerNote: {
    color: palette.body,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  paymentModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: palette.cardBg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  paymentModalIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  paymentModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  paymentModalBody: {
    fontSize: 15,
    color: palette.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  paymentModalButton: {
    minWidth: "100%",
    backgroundColor: palette.blue,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  paymentModalButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

/**
 * Assinatura via backend (ex.: Mercado Pago Checkout Pro / Preferências).
 * O cliente redireciona para a URL devolvida pela API — sem SDK de gateway no app.
 *
 * Para desativar o fluxo de planos após o cadastro:
 * REACT_APP_SUBSCRIPTION_CHECKOUT_ENABLED=false ou EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED=false
 */
function readCheckoutEnabled() {
  const value =
    process.env.REACT_APP_SUBSCRIPTION_CHECKOUT_ENABLED ??
    process.env.EXPO_PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED;
  if (value === undefined || value === "") {
    return true;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "no";
}

export const isSubscriptionCheckoutEnabled = readCheckoutEnabled();

/**
 * URL de redirecionamento para o checkout MP.
 * Com credenciais de TESTE, a API costuma preencher init_point (produção) e sandbox_init_point; abrir
 * init_point com cartão/PIX de teste impede concluir o pagamento. Por isso: sandbox_init_point primeiro.
 * Em produção, sandbox_init_point costuma vir vazio — usa-se init_point.
 */
export function getCheckoutRedirectUrl(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  return (
    payload.url ||
    payload.sandbox_init_point ||
    payload.init_point ||
    ""
  );
}

/** Mensagem amigável a partir do JSON de erro do POST /subscriptions/checkout-session. */
export function formatCheckoutSessionError(payload, fallbackMessage) {
  const base =
    (payload && typeof payload === "object" && payload.error) || fallbackMessage || "Não foi possível iniciar o checkout.";
  if (payload?.code === "mp_token_missing") {
    return `${base} Configure MERCADO_PAGO_ACCESS_TOKEN no servidor da API.`;
  }
  if (payload?.code === "subscription_persist_failed") {
    return `${base} Verifique os logs do servidor e a migração das colunas Mercado Pago (mp_*).`;
  }
  return base;
}

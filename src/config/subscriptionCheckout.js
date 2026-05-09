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

/** URL de redirecionamento: API própria, Mercado Pago (init_point) ou ambiente de testes (sandbox_init_point). */
export function getCheckoutRedirectUrl(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  return (
    payload.url ||
    payload.init_point ||
    payload.sandbox_init_point ||
    ""
  );
}

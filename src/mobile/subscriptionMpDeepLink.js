/**
 * Deep links de retorno do Checkout Pro (Mercado Pago).
 * URLs configuradas no backend: limpae://subscription/success|failure|pending
 * O MP acrescenta query params (payment_id, status, etc.).
 */

export const MP_SUBSCRIPTION_DEEP_LINK_SCHEME = "limpae";

export function parseMercadoPagoSubscriptionReturnUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }
  const trimmed = url.trim();
  const prefix = `${MP_SUBSCRIPTION_DEEP_LINK_SCHEME}://`;
  if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return null;
  }
  const rest = trimmed.slice(prefix.length);
  const [beforeHash] = rest.split("#");
  const qIndex = beforeHash.indexOf("?");
  const pathPart = (qIndex >= 0 ? beforeHash.slice(0, qIndex) : beforeHash).replace(/^\/+/, "");
  const queryString = qIndex >= 0 ? beforeHash.slice(qIndex + 1) : "";
  const params = {};
  if (queryString) {
    const sp = new URLSearchParams(queryString);
    sp.forEach((value, key) => {
      params[key] = value;
    });
  }
  const pathNorm = pathPart.toLowerCase();
  if (pathNorm === "subscription/success" || pathNorm === "assinatura/success") {
    return { kind: "success", params };
  }
  if (
    pathNorm === "subscription/failure" ||
    pathNorm === "subscription/denied" ||
    pathNorm === "assinatura/denied" ||
    pathNorm === "assinatura/failure"
  ) {
    return { kind: "failure", params };
  }
  if (pathNorm === "subscription/pending" || pathNorm === "assinatura/pending") {
    return { kind: "pending", params };
  }
  return null;
}

export const DEFERRED_MP_RETURN_STORAGE_KEY = "limpae_deferred_mp_subscription_url";

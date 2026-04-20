import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { apiFetch } from "../config/api";
import "./PlanSelection.css";

const checkEmoji = "\u2714\uFE0F";

const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY || "";
const stripePromise = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null;

function logSubscriptionDebug(message, details = {}) {
  console.log(`[subscription] ${message}`, details);
}

function logSubscriptionError(message, details = {}) {
  console.error(`[subscription] ${message}`, details);
}

export const isStripeConfigured =
  !!STRIPE_PUBLIC_KEY && STRIPE_PUBLIC_KEY !== "SUA_CHAVE_PUBLICA_AQUI";

const plans = [
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

async function defaultStartCheckout(plan) {
  logSubscriptionDebug("checkout request start", {
    planId: plan?.id,
    planName: plan?.name,
    stripeConfigured: Boolean(stripePromise),
  });

  const response = await apiFetch("/subscriptions/checkout-session", {
    method: "POST",
    authenticated: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan: plan.id }),
  });

  const payload = await response.json().catch(() => ({}));
  logSubscriptionDebug("checkout request response", {
    planId: plan?.id,
    status: response.status,
    ok: response.ok,
    payload,
  });

  if (!response.ok) {
    logSubscriptionError("checkout request failed", {
      planId: plan?.id,
      status: response.status,
      payload,
    });
    throw new Error(payload?.error || "Não foi possível iniciar o checkout da assinatura.");
  }

  if (payload?.session_id && stripePromise) {
    logSubscriptionDebug("stripe redirect start", {
      planId: plan?.id,
      sessionId: payload.session_id,
    });
    const stripe = await stripePromise;
    if (stripe) {
      const result = await stripe.redirectToCheckout({ sessionId: payload.session_id });
      if (result?.error) {
        logSubscriptionError("stripe redirect failed", {
          planId: plan?.id,
          sessionId: payload.session_id,
          error: result.error.message,
        });
        throw new Error(result.error.message || "Falha ao redirecionar para o Stripe.");
      }
      logSubscriptionDebug("stripe redirect handed off", {
        planId: plan?.id,
        sessionId: payload.session_id,
      });
      return;
    }
    logSubscriptionError("stripe object unavailable", {
      planId: plan?.id,
      sessionId: payload.session_id,
    });
  }

  if (payload?.url) {
    logSubscriptionDebug("checkout fallback url redirect", {
      planId: plan?.id,
      url: payload.url,
    });
    if (typeof window !== "undefined" && window.location?.assign) {
      window.location.assign(payload.url);
      return;
    }
    throw new Error("Redirecionamento web indisponivel neste ambiente.");
    return;
  }

  logSubscriptionError("checkout response missing redirect data", {
    planId: plan?.id,
    payload,
  });
  throw new Error("Checkout do Stripe não retornou URL nem session id.");
}

const PlanSelection = ({ onBack, onPlanSelected, title = "Escolha seu Plano" }) => {
  const [processingPlanId, setProcessingPlanId] = useState("");
  const [error, setError] = useState("");

  const handlePlanSelect = async (plan) => {
    logSubscriptionDebug("plan selected", {
      planId: plan?.id,
      planName: plan?.name,
      price: plan?.price,
    });
    setProcessingPlanId(plan.id);
    setError("");

    try {
      const startCheckout = onPlanSelected || defaultStartCheckout;
      await startCheckout(plan);
    } catch (requestError) {
      logSubscriptionError("plan checkout failed", {
        planId: plan?.id,
        error: requestError?.message,
      });
      setError(requestError.message || "Não foi possível iniciar a assinatura.");
    } finally {
      logSubscriptionDebug("plan checkout finished", {
        planId: plan?.id,
      });
      setProcessingPlanId("");
    }
  };

  return (
    <div className="plan-selection-container">
      <div className="plan-header">
        <h2>{title}</h2>
        <p>Selecione a melhor opção para você e siga para o Stripe Checkout.</p>
      </div>

      {error && <div className="stripe-error">{error}</div>}

      <div className="plans-grid">
        {plans.map((plan) => {
          const isProcessing = processingPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`plan-card ${plan.popular ? "popular" : ""} ${plan.bestValue ? "best-value" : ""} color-${plan.color}`}
            >
              {plan.popular && <div className="popular-badge">MAIS POPULAR</div>}
              {plan.bestValue && <div className="best-value-badge">MELHOR VALOR</div>}
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price-container">
                <div className="original-price">R$ {plan.originalPrice.toFixed(2)}</div>
                <div className="current-price">
                  <span className="currency">R$</span>
                  <span className="amount">{plan.price.toFixed(2).split(".")[0]}</span>
                  <span className="cents">,{plan.price.toFixed(2).split(".")[1]}</span>
                  <span className="period">/período</span>
                </div>
              </div>
              <p className="plan-description">{plan.description}</p>
              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index}>
                    <span className="check-icon">{checkEmoji}</span> {feature}
                  </li>
                ))}
              </ul>
              <button
                className="select-plan-button"
                onClick={() => handlePlanSelect(plan)}
                disabled={Boolean(processingPlanId)}
              >
                {isProcessing ? "Redirecionando..." : "Assinar com Stripe"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="plan-footer">
        <p className="footer-note">
          {checkEmoji} Cobrança recorrente segura {checkEmoji} Cancelamento imediato {checkEmoji} Acesso controlado por webhook
        </p>
        {typeof onBack === "function" && (
          <button className="back-link" onClick={onBack} disabled={Boolean(processingPlanId)}>
            Voltar
          </button>
        )}
      </div>
    </div>
  );
};

export default PlanSelection;

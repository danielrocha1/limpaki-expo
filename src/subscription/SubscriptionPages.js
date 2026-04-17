import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PlanSelection from "../forms/PlanSelection";
import { apiFetch } from "../config/api";

function SubscriptionStatusCard({ title, description, children, maxWidth = "760px", hideHeader = false }) {
  return (
    <main className="body register-root">
      <div className="container" style={{ maxWidth }}>
        {!hideHeader && (
          <div className="form-header">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}

export function SubscriptionPlansPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ loading: true, subscription: null, message: "" });

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const response = await apiFetch("/subscriptions/access-status", {
          authenticated: true,
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) {
          return;
        }

        if (payload?.has_valid_subscription) {
          navigate("/services", { replace: true });
          return;
        }

        setStatus({
          loading: false,
          subscription: payload?.subscription || null,
          message: "",
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setStatus({
          loading: false,
          subscription: null,
          message: "Não foi possível carregar o status da assinatura.",
        });
      }
    };

    loadStatus();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <SubscriptionStatusCard
      maxWidth="1120px"
      hideHeader
    >
      {status.message && <div className="stripe-error">{status.message}</div>}
      <PlanSelection />
    </SubscriptionStatusCard>
  );
}

export function SubscriptionSuccessPage() {
  const [state, setState] = useState({ loading: true, hasAccess: false, status: "" });

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const response = await apiFetch("/subscriptions/access-status", {
          authenticated: true,
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) {
          return;
        }

        setState({
          loading: false,
          hasAccess: Boolean(payload?.has_valid_subscription),
          status: payload?.subscription?.status || "",
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setState({ loading: false, hasAccess: false, status: "" });
      }
    };

    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SubscriptionStatusCard
      title="Retorno do Stripe recebido"
      description="A liberação real depende da confirmação do webhook do Stripe."
    >
      {state.loading ? (
        <p>Consultando o status atual da assinatura...</p>
      ) : state.hasAccess ? (
        <>
          <p>Sua assinatura está válida e o acesso premium foi liberado.</p>
          <p>Status atual: <strong>{state.status}</strong></p>
          <Link className="select-plan-button" to="/services">
            Ir para serviços
          </Link>
        </>
      ) : (
        <>
          <p>O pagamento retornou para a plataforma, mas a assinatura ainda não foi confirmada como válida.</p>
          <p>Status atual: <strong>{state.status || "pendente"}</strong></p>
          <Link className="back-link" to="/assinatura/planos">
            Tentar novamente
          </Link>
        </>
      )}
    </SubscriptionStatusCard>
  );
}

export function SubscriptionDeniedPage() {
  return (
    <SubscriptionStatusCard
      title="Assinatura não concluída"
      description="Você pode tentar novamente quando quiser. O acesso premium continua bloqueado até que uma assinatura válida seja confirmada."
    >
      <Link className="select-plan-button" to="/assinatura/planos">
        Escolher um plano
      </Link>
    </SubscriptionStatusCard>
  );
}

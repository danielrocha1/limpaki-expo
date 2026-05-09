import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { message } from "antd";
import RegisterClient from "./RegisterClient";
import RegisterDiarist from "./RegisterDiarist";
import PlanSelection from "./PlanSelection";
import "./multiform.css";
import { buildApiPathUrl, buildApiUrl, getToken, setToken } from "../config/api";
import { getCheckoutRedirectUrl, isSubscriptionCheckoutEnabled } from "../config/subscriptionCheckout";

const clientEmoji = "\uD83D\uDC64";
const diaristEmoji = "\uD83E\uDDF9";

function logSubscriptionDebug(messageText, details = {}) {
  console.log(`[subscription] ${messageText}`, details);
}

function logSubscriptionError(messageText, details = {}) {
  console.error(`[subscription] ${messageText}`, details);
}

const RegisterForm = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [showPlans, setShowPlans] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRoleSelection = (selectedRole) => {
    setRole(selectedRole);
  };

  const handleBackToRoleSelection = () => {
    setRole(null);
    setShowPlans(false);
    setIsRegistering(false);
  };

  const registerUser = async (userData) => {
    const response = await fetch(buildApiUrl("/register"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Erro ao realizar registro");
    }

    return payload;
  };

  const handleRegistrationComplete = async (data) => {
    logSubscriptionDebug("registration complete start", {
      email: data?.email,
      role: data?.role,
      subscriptionCheckoutEnabled: isSubscriptionCheckoutEnabled,
    });
    setIsRegistering(true);

    try {
      const registerPayload = await registerUser(data);
      logSubscriptionDebug("registration api success", {
        email: data?.email,
        role: data?.role,
        verificationEmailSent: registerPayload?.verification_email_sent,
      });

      if (isSubscriptionCheckoutEnabled) {
        await authenticateAfterRegister(data);
        logSubscriptionDebug("post-registration auth success", {
          email: data?.email,
        });
        message.success(
          registerPayload?.message ||
            "Cadastro concluído. Confira seu e-mail e depois escolha seu plano."
        );
        setShowPlans(true);
        return;
      }

      message.success(
        registerPayload?.message ||
          "Registro concluído com sucesso! Confira seu e-mail para confirmar a conta."
      );
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      logSubscriptionError("registration flow failed", {
        email: data?.email,
        role: data?.role,
        error: error?.message,
      });
      console.error("Erro no registro:", error);
      message.error(`Falha no registro: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePlanSelected = async (planData) => {
    try {
      logSubscriptionDebug("post-registration plan selected", {
        planId: planData?.id,
        planName: planData?.name,
      });
      await startSubscriptionCheckout(planData);
    } catch (error) {
      logSubscriptionError("post-registration checkout failed", {
        planId: planData?.id,
        error: error?.message,
      });
      console.error("Erro ao iniciar checkout:", error);
      message.error(`Falha ao iniciar checkout: ${error.message}`);
      throw error;
    }
  };

  const authenticateAfterRegister = async (userData) => {
    logSubscriptionDebug("post-registration auth start", {
      email: userData?.email,
    });
    const loginResponse = await fetch(buildApiUrl("/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
      }),
    });

    const loginPayload = await loginResponse.json().catch(() => ({}));
    logSubscriptionDebug("post-registration auth response", {
      status: loginResponse.status,
      ok: loginResponse.ok,
      hasToken: Boolean(loginPayload?.token),
    });
    if (!loginResponse.ok || !loginPayload?.token) {
      throw new Error(loginPayload.error || "Registro concluído, mas o login automático falhou.");
    }

    await setToken(loginPayload.token);
    return loginPayload.token;
  };

  const startSubscriptionCheckout = async (plan) => {
    const token = getToken();
    logSubscriptionDebug("post-registration checkout request start", {
      planId: plan?.id,
      planName: plan?.name,
      hasToken: Boolean(token),
    });
    const response = await fetch(buildApiPathUrl("/subscriptions/checkout-session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ plan: plan.id }),
    });

    const payload = await response.json().catch(() => ({}));
    logSubscriptionDebug("post-registration checkout response", {
      status: response.status,
      ok: response.ok,
      planId: plan?.id,
      payload,
    });
    if (!response.ok) {
      throw new Error(payload.error || "Não foi possível iniciar o checkout da assinatura.");
    }

    const redirectUrl = getCheckoutRedirectUrl(payload);
    if (redirectUrl) {
      logSubscriptionDebug("post-registration checkout redirect", {
        planId: plan?.id,
        url: redirectUrl,
      });
      if (typeof window !== "undefined" && window.location?.assign) {
        window.location.assign(redirectUrl);
        return;
      }
      throw new Error("Redirecionamento web indisponivel neste ambiente.");
    }

    logSubscriptionError("post-registration checkout response missing redirect data", {
      planId: plan?.id,
      payload,
    });
    throw new Error("O servidor não retornou um link de pagamento (url ou init_point).");
  };

  if (showPlans) {
    return (
      <div className="body multiform-root register-root">
        <div className="container" style={{ maxWidth: "1000px" }}>
          <PlanSelection
            title="Conta criada. Escolha seu plano"
            onPlanSelected={handlePlanSelected}
          />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="body multiform-root register-root">
        <div className="container">
          <div className="form-header">
            <h2>Bem-vindo ao Limpae</h2>
            <p>Escolha como você deseja usar nossa plataforma</p>
          </div>

          <div className="role-selection">
            <div className="role-card client-card">
              <div className="role-icon">{clientEmoji}</div>
              <h3>Sou Cliente</h3>
              <p>Procuro contratar serviços de limpeza profissional</p>
              <button
                className="role-button"
                onClick={() => handleRoleSelection("cliente")}
              >
                Registrar como Cliente
              </button>
            </div>

            <div className="role-card diarist-card">
              <div className="role-icon">{diaristEmoji}</div>
              <h3>Sou Diarista</h3>
              <p>Quero oferecer meus serviços de limpeza</p>
              <button
                className="role-button"
                onClick={() => handleRoleSelection("diarista")}
              >
                Registrar como Diarista
              </button>
            </div>
          </div>

          <div className="login-redirect">
            <p>Já tem conta? <Link to="/login">Faça login aqui</Link></p>
          </div>
        </div>
      </div>
    );
  }

  if (role === "cliente") {
    return (
      <RegisterClient
        onBack={handleBackToRoleSelection}
        onComplete={handleRegistrationComplete}
        isSubmitting={isRegistering}
      />
    );
  }

  if (role === "diarista") {
    return (
      <RegisterDiarist
        onBack={handleBackToRoleSelection}
        onComplete={handleRegistrationComplete}
        isSubmitting={isRegistering}
      />
    );
  }

  return null;
};

export default RegisterForm;

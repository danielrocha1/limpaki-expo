import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "../config/api";
import { useAddress } from "../context/address";

const EmailVerificationBanner = () => {
  const { Logged, emailVerified, refreshSessionBootstrap } = useAddress();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!Logged || emailVerified || location.pathname === "/verify-email") {
    return null;
  }

  const handleResend = async () => {
    try {
      setIsSubmitting(true);
      setFeedback("");

      const response = await apiFetch("/auth/email-verification/resend", {
        method: "POST",
        authenticated: true,
      });

      const data = await response.json().catch(() => ({}));
      setFeedback(
        data?.message ||
          data?.error ||
          "Não foi possível reenviar o e-mail agora.",
      );
      await refreshSessionBootstrap({ force: true });
    } catch (_error) {
      setFeedback("Não foi possível reenviar o e-mail agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="email-verification-overlay" role="presentation">
      <div
        className="email-verification-banner"
        role="status"
        aria-live="polite"
      >
        <div className="email-verification-banner__copy">
          <strong>Seu e-mail ainda não foi confirmado.</strong>
          <span>
            Confirme para manter sua conta protegida e garantir que você
            receba avisos importantes.
          </span>
        </div>
        <div className="email-verification-banner__actions">
          <button type="button" onClick={handleResend} disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Reenviar e-mail"}
          </button>
        </div>
        {feedback ? (
          <p className="email-verification-banner__feedback">{feedback}</p>
        ) : null}
      </div>
    </div>
  );
};

export default EmailVerificationBanner;

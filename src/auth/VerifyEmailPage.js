import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buildApiUrl } from "../config/api";
import "./verify-email.css";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState(
    "Validando seu link de verificação...",
  );

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(
        "Link de verificação inválido. Abra novamente o e-mail e tente de novo.",
      );
      return;
    }

    let isCancelled = false;

    const verify = async () => {
      try {
        const response = await fetch(
          buildApiUrl(`/verify-email?token=${encodeURIComponent(token)}`),
          {
            method: "GET",
          },
        );
        const data = await response.json().catch(() => ({}));

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setStatus("error");
          setMessage(data?.error || "Não foi possível confirmar seu e-mail agora.");
          return;
        }

        setStatus("success");
        setMessage(data?.message || "E-mail confirmado com sucesso.");
      } catch (_error) {
        if (isCancelled) {
          return;
        }
        setStatus("error");
        setMessage(
          "Não foi possível validar o link agora. Tente novamente em instantes.",
        );
      }
    };

    void verify();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <span className={`verify-email-badge verify-email-badge--${status}`}>
          {status === "loading"
            ? "Verificando"
            : status === "success"
              ? "Confirmado"
              : "Falha"}
        </span>
        <h1>Verificação de e-mail</h1>
        <p>{message}</p>
        <div className="verify-email-actions">
          <Link to="/login" className="verify-email-primary-link">
            Ir para login
          </Link>
          <Link to="/profile" className="verify-email-secondary-link">
            Abrir perfil
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;

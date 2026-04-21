import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buildApiUrl } from "../config/api";
import "./reset-password.css";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Link de recuperacao invalido. Solicite um novo e-mail.");
      return;
    }
    if (password.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl("/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: password,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel redefinir sua senha agora.");
      }

      setSuccess(data.message || "Senha atualizada com sucesso.");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <span className="reset-password-badge">Nova senha</span>
        <h1>Redefinir senha</h1>
        <p>Crie uma senha nova para voltar a acessar sua conta com seguranca.</p>

        {error ? <div className="reset-password-feedback reset-password-feedback--error">{error}</div> : null}
        {success ? <div className="reset-password-feedback reset-password-feedback--success">{success}</div> : null}

        <form className="reset-password-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua nova senha"
            disabled={isLoading}
          />

          <label htmlFor="confirm-password">Confirmar senha</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita sua nova senha"
            disabled={isLoading}
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Atualizando..." : "Salvar nova senha"}
          </button>
        </form>

        <div className="reset-password-actions">
          <Link to="/login">Voltar para login</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

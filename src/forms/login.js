import { startTransition, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.css";
import { useAddress } from "../context/address";
import { buildApiPathUrl, buildApiUrl, setToken } from "../config/api";

export default function Login() {
  const { setLogged, setEmailVerified, setIsTestUser, refreshSessionBootstrap } = useAddress();
  
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = "E-mail é obrigatório.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "E-mail inválido.";
    }
    
    if (!formData.password) {
      newErrors.password = "Senha é obrigatória.";
    } else if (formData.password.length < 4) {
      newErrors.password = "A senha deve ter pelo menos 6 caracteres.";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpaê erro do campo quando usurio comea a digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  async function handleLogin(e) {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch(buildApiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Credenciais inválidas.");
      }
      
      await setToken(data.token);
      setEmailVerified(Boolean(data.email_verified));
      
      // Busca o papel do usurio para decidir o redirecionamento
      let redirectPath = "/map";
      try {
        const roleResponse = await fetch(buildApiPathUrl("/users-role/"), {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`,
          },
        });
        if (roleResponse.ok) {
          const roleData = await roleResponse.json();
          setIsTestUser(Boolean(roleData?.is_test_user));
          if (!roleData?.email_verified && !roleData?.is_test_user) {
            redirectPath = "/profile?focus=email";
          } else if (roleData?.role === "diarista") {
            redirectPath = "/offers";
          }
        } else if (!data.email_verified) {
          redirectPath = "/profile?focus=email";
        }
      } catch (roleError) {
        console.error("Erro ao buscar papel do usurio:", roleError);
        if (!data.email_verified) {
          redirectPath = "/profile?focus=email";
        }
      }

      // Mostra mensagem de sucesso antes de redirecionar
      setShowSuccess(true);
      setTimeout(() => {
        setLogged(true);
        void refreshSessionBootstrap({ force: true });
        startTransition(() => {
          navigate(redirectPath, { replace: true });
        });
      }, 2000);
      
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
   <div className="body">
    <div className="login-container">
      {showSuccess && (
        <div className="success-message">
          <div className="success-content">
            <div className="success-icon">{"\u2705"}</div>
            <h3>Login realizado com sucesso!</h3>
            <p>Redirecionando...</p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleLogin} className="login-form">
        <div className="form-header">
          <h2>Bem-vindo de volta!</h2>
          <p>Faça login para acessar sua conta.</p>
        </div>
        
        {errors.general && (
          <div className="error-message">
            <span className="error-icon">{"\u26A0\uFE0F"}</span>
            {errors.general}
          </div>
        )}

        <div className="input-group">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="Digite seu e-mail"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? "error" : ""}
            disabled={isLoading}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="input-group">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Digite sua senha"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? "error" : ""}
            disabled={isLoading}
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>
        
        <button 
          type="submit" 
          className={isLoading ? "loading" : ""}
          disabled={isLoading}
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>

        <div className="form-footer">
          <p>Não tem uma conta? <Link to="/register">Cadastre-se</Link></p>
        </div>
      </form>
    </div>
   </div>
  );
}

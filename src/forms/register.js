import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./register.css";
import { buildApiUrl } from "../config/api";

const PaymentForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    plan: "basic",
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório.";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Nome deve ter pelo menos 2 caracteres";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "E-mail é obrigatório.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "E-mail inválido.";
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = "Telefone é obrigatório.";
    } else if (formData.phone.length < 10) {
      newErrors.phone = "O telefone deve ter pelo menos 10 dígitos.";
    }
    
    if (!formData.cpf.trim()) {
      newErrors.cpf = "CPF é obrigatório.";
    } else if (formData.cpf.length !== 11) {
      newErrors.cpf = "O CPF deve ter 11 dígitos.";
    }
    
    if (!formData.street.trim()) {
      newErrors.street = "Rua é obrigatória.";
    }
    
    if (!formData.city.trim()) {
      newErrors.city = "Cidade é obrigatória.";
    }
    
    if (!formData.state.trim()) {
      newErrors.state = "Estado é obrigatório.";
    }
    
    if (!formData.zip.trim()) {
      newErrors.zip = "CEP é obrigatório.";
    } else if (formData.zip.length !== 8) {
      newErrors.zip = "O CEP deve ter 8 dígitos.";
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
    
    // Limpaê erro do campo quando usuario comeca a digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch(buildApiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar assinatura");
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
      
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanInfo = (plan) => {
    const plans = {
      basic: { name: "Básico", price: "R$ 19,90", features: ["Limpeza básica", "Suporte por e-mail"] },
      premium: { name: "Premium", price: "R$ 49,90", features: ["Limpeza completa", "Suporte prioritário", "Agendamento flexível"] },
      free: { name: "Gratuito", price: "R$ 0,00", features: ["Acesso limitado", "Suporte básico"] }
    };
    return plans[plan];
  };

  const selectedPlan = getPlanInfo(formData.plan);

  return (
    <div className="body register-root">
      <div className="container">
        {showSuccess && (
          <div className="success-overlay">
            <div className="success-modal">
              <div className="success-icon">OK</div>
              <h2>Assinatura confirmada!</h2>
              <p>Sua assinatura foi processada com sucesso. Redirecionando para o login...</p>
            </div>
          </div>
        )}

        <div className="form-header">
          <h2>Plano de Assinatura</h2>
          <p>Escolha o plano ideal para as suas necessidades.</p>
        </div>

        {errors.general && (
          <div className="error-message">
            <span className="error-icon">!</span>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Dados Pessoais</h3>
          
          <div className="input-group">
            <label htmlFor="name">Nome Completo</label>
            <input 
              type="text" 
              id="name"
              name="name" 
              placeholder="Digite seu nome completo" 
              className={`input-field ${errors.name ? "error" : ""}`}
              onChange={handleChange}
              value={formData.name}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input 
              type="email" 
              id="email"
              name="email" 
              placeholder="Digite seu e-mail" 
              className={`input-field ${errors.email ? "error" : ""}`}
              onChange={handleChange}
              value={formData.email}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="phone">Telefone</label>
            <input 
              type="tel" 
              id="phone"
              name="phone" 
              placeholder="Digite seu telefone" 
              className={`input-field ${errors.phone ? "error" : ""}`}
              onChange={handleChange}
              value={formData.phone}
              maxLength={11}
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="cpf">CPF</label>
            <input 
              type="text" 
              id="cpf"
              name="cpf" 
              placeholder="Digite seu CPF" 
              className={`input-field ${errors.cpf ? "error" : ""}`}
              onChange={handleChange}
              value={formData.cpf}
              maxLength={11}
            />
            {errors.cpf && <span className="field-error">{errors.cpf}</span>}
          </div>
        </div>

        <div className="form-section">
          <h3>Endereço</h3>
          
          <div className="input-group">
            <label htmlFor="street">Rua</label>
            <input 
              type="text" 
              id="street"
              name="street" 
              placeholder="Digite sua rua" 
              className={`input-field ${errors.street ? "error" : ""}`}
              onChange={handleChange}
              value={formData.street}
            />
            {errors.street && <span className="field-error">{errors.street}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="city">Cidade</label>
            <input 
              type="text" 
              id="city"
              name="city" 
              placeholder="Digite sua cidade" 
              className={`input-field ${errors.city ? "error" : ""}`}
              onChange={handleChange}
              value={formData.city}
            />
            {errors.city && <span className="field-error">{errors.city}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="state">Estado</label>
            <input 
              type="text" 
              id="state"
              name="state" 
              placeholder="Digite seu estado" 
              className={`input-field ${errors.state ? "error" : ""}`}
              onChange={handleChange}
              value={formData.state}
            />
            {errors.state && <span className="field-error">{errors.state}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="zip">CEP</label>
            <input 
              type="text" 
              id="zip"
              name="zip" 
              placeholder="Digite seu CEP" 
              className={`input-field ${errors.zip ? "error" : ""}`}
              onChange={handleChange}
              value={formData.zip}
              maxLength={8}
            />
            {errors.zip && <span className="field-error">{errors.zip}</span>}
          </div>
        </div>

        <div className="form-section">
          <h3>Escolha o Plano</h3>
          
          <div className="plan-selector">
            <div className="plan-options">
              <label className={`plan-option ${formData.plan === 'free' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="plan" 
                  value="free" 
                  onChange={handleChange}
                  checked={formData.plan === 'free'}
                />
                <div className="plan-content">
                  <h4>Gratuito</h4>
                  <p className="price">R$ 0,00/mês</p>
                  <ul>
                    <li>Acesso limitado</li>
                    <li>Suporte básico</li>
                  </ul>
                </div>
              </label>

              <label className={`plan-option ${formData.plan === 'basic' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="plan" 
                  value="basic" 
                  onChange={handleChange}
                  checked={formData.plan === 'basic'}
                />
                <div className="plan-content">
                  <h4>Básico</h4>
                  <p className="price">R$ 19,90/mês</p>
                  <ul>
                    <li>Limpeza básica</li>
                    <li>Suporte por e-mail</li>
                  </ul>
                </div>
              </label>

              <label className={`plan-option ${formData.plan === 'premium' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="plan" 
                  value="premium" 
                  onChange={handleChange}
                  checked={formData.plan === 'premium'}
                />
                <div className="plan-content">
                  <h4>Premium</h4>
                  <p className="price">R$ 49,90/mês</p>
                  <ul>
                    <li>Limpeza completa</li>
                    <li>Suporte prioritário</li>
                    <li>Agendamento flexível</li>
                  </ul>
                </div>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className={`button-pay ${isLoading ? "loading" : ""}`}
          disabled={isLoading}
        >
          {isLoading ? "Processando..." : `Confirmar assinatura - ${selectedPlan.price}/mês`}
        </button>
      </form>
      </div>
    </div>
  );
};

export default PaymentForm;

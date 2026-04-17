import React, { useState } from "react";
import {
  BankOutlined,
  CheckCircleFilled,
  CompassOutlined,
  DownOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  HomeOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  PushpinOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import "./register.css";
import MapModal from "./MapModal";

const specialtyIcons = {
  basic: "\uD83E\uDDF9",
  heavy: "\uD83E\uDEA3",
  ironing: "\uD83D\uDC55",
  postWork: "\uD83D\uDEA7",
  organization: "\uD83D\uDCC1",
  windows: "\uD83E\uDE9F",
  carpets: "\uD83E\uDDFD",
  cooking: "\uD83C\uDF73",
};

const RegisterDiarist = ({ onBack, onComplete }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openSection, setOpenSection] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    zip: "",
    street: "",
    number: "",
    neighborhood: "",
    complement: "",
    referencePoint: "",
    city: "",
    state: "",
    bio: "",
    experienceYears: "",
    pricePerHour: "",
    pricePerDay: "",
    specialties: [],
    available: true,
    password: "",
    confirmPassword: "",
    latitude: 0,
    longitude: 0,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState(null);

  const specialtiesOptions = [
    { id: "basic_cleaning", label: "Limpeza Básica", icon: specialtyIcons.basic },
    { id: "heavy_cleaning", label: "Limpeza Pesada", icon: specialtyIcons.heavy },
    { id: "ironing", label: "Passar Roupa", icon: specialtyIcons.ironing },
    { id: "post_work", label: "Pós-obra", icon: specialtyIcons.postWork },
    { id: "organization", label: "Organização", icon: specialtyIcons.organization },
    { id: "window_cleaning", label: "Janelas", icon: specialtyIcons.windows },
    { id: "carpet_cleaning", label: "Tapetes", icon: specialtyIcons.carpets },
    { id: "cooking", label: "Cozinhar", icon: specialtyIcons.cooking },
  ];

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório";
    else if (formData.name.trim().length < 2) newErrors.name = "Nome deve ter pelo menos 2 caracteres";
    if (!formData.email.trim()) newErrors.email = "E-mail é obrigatório";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "E-mail inválido";
    if (!formData.phone.trim()) newErrors.phone = "Telefone é obrigatório";
    else if (formData.phone.replace(/\D/g, "").length < 10) newErrors.phone = "Telefone deve ter pelo menos 10 dígitos";
    if (!formData.cpf.trim()) newErrors.cpf = "CPF é obrigatório";
    else if (formData.cpf.replace(/\D/g, "").length !== 11) newErrors.cpf = "CPF deve ter 11 dígitos";
    if (!formData.zip.trim()) newErrors.zip = "CEP é obrigatório";
    else if (formData.zip.replace(/\D/g, "").length !== 8) newErrors.zip = "CEP deve ter 8 dígitos";
    if (!formData.street.trim()) newErrors.street = "Rua é obrigatória";
    if (!formData.number.trim()) newErrors.number = "Número é obrigatório";
    if (!formData.city.trim()) newErrors.city = "Cidade é obrigatória";
    if (!formData.state.trim()) newErrors.state = "Estado é obrigatório";
    if (formData.latitude === 0 || formData.longitude === 0) newErrors.location = "Localize seu endereço no mapa antes de prosseguir";
    if (!formData.bio.trim()) newErrors.bio = "Bio/resumo profissional é obrigatório";
    else if (formData.bio.trim().length < 10) newErrors.bio = "Bio deve ter pelo menos 10 caracteres";
    if (!formData.experienceYears) newErrors.experienceYears = "Anos de experiência é obrigatório";
    else if (isNaN(formData.experienceYears) || formData.experienceYears < 0) newErrors.experienceYears = "Insira um número válido";
    if (!formData.pricePerHour) newErrors.pricePerHour = "Preço por hora é obrigatório";
    else if (isNaN(formData.pricePerHour) || formData.pricePerHour <= 0) newErrors.pricePerHour = "Insira um valor válido (maior que 0)";
    if (!formData.pricePerDay) newErrors.pricePerDay = "Preço por diária é obrigatório";
    else if (isNaN(formData.pricePerDay) || formData.pricePerDay <= 0) newErrors.pricePerDay = "Insira um valor válido (maior que 0)";
    if (formData.specialties.length === 0) newErrors.specialties = "Selecione pelo menos uma especialidade";
    if (!formData.password.trim()) newErrors.password = "Senha é obrigatória";
    else if (formData.password.length < 6) newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "Confirmação de senha é obrigatória";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "As senhas não correspondem";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const cleanValue = name === "zip" ? value.replace(/\D/g, "").slice(0, 8) : value;
    const affectsLocation = ["zip", "street", "number", "neighborhood", "city", "state"].includes(name);

    setFormData((prev) => ({
      ...prev,
      [name]: cleanValue,
      ...(affectsLocation ? { latitude: 0, longitude: 0 } : {}),
    }));

    if (affectsLocation) {
      setShowMap(false);
      setMapCoords(null);
      if (name !== "zip") {
        setCepMessage({
          type: "warning",
          text: "Endereço alterado. Confirme novamente a localização no mapa.",
        });
      }
    }

    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "zip" && cleanValue.length === 8) handleZipCode(cleanValue);
  };

  const handleZipCode = async (zip) => {
    setCepLoading(true);
    setCepMessage(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();
      if (data?.erro) {
        setCepMessage({ type: "error", text: "CEP não encontrado. Confira os dígitos." });
        setCepLoading(false);
        return;
      }
      setFormData((prev) => ({
        ...prev,
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      }));
      setCepMessage({ type: "info", text: "CEP encontrado! Buscando localização no mapa..." });
      const neighborhood = data.bairro || "";
      const params = new URLSearchParams({
        q: [data.logradouro, neighborhood, data.localidade, data.uf, "Brasil"]
          .filter(Boolean)
          .join(", "),
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
      });
      const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      const nominatimData = await nominatimRes.json();
      if (Array.isArray(nominatimData) && nominatimData.length > 0) {
        const match = nominatimData[0];
        const lat = Number(match.lat);
        const lon = Number(match.lon);
        setMapCoords({ lat, lon });
        setCepMessage({ type: "success", text: "Localização encontrada! Abra o mapa para confirmar." });
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }));
        setTimeout(() => setShowMap(true), 500);
      } else {
        setCepMessage({ type: "warning", text: "Não consegui localizar no mapa. Abra o mapa manualmente para confirmar." });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setCepMessage({ type: "error", text: "Erro ao buscar CEP. Tente novamente." });
    } finally {
      setCepLoading(false);
    }
  };

  const handleOpenMap = () => {
    if (formData.latitude && formData.longitude) setShowMap(true);
    else setErrors((prev) => ({ ...prev, location: "Preencha o CEP primeiro para localizar no mapa" }));
  };

  const handleSpecialtyChange = (specialtyId) => {
    setFormData((prev) => {
      const isSelected = prev.specialties.includes(specialtyId);
      return {
        ...prev,
        specialties: isSelected ? prev.specialties.filter((id) => id !== specialtyId) : [...prev.specialties, specialtyId],
      };
    });
    if (errors.specialties) setErrors((prev) => ({ ...prev, specialties: "" }));
  };

  const handleAvailabilityChange = (e) => {
    setFormData((prev) => ({ ...prev, available: e.target.checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setErrors({});
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: parseInt(formData.phone.replace(/\D/g, ""), 10),
        cpf: formData.cpf,
        password: formData.password,
        role: "diarista",
        address: {
          street: formData.street,
          number: formData.number,
          neighborhood: formData.neighborhood,
          complement: formData.complement,
          referencePoint: formData.referencePoint,
          city: formData.city,
          state: formData.state,
          zipcode: formData.zip,
          latitude: formData.latitude,
          longitude: formData.longitude,
        },
        diarist_profile: {
          bio: formData.bio,
          experience_years: parseInt(formData.experienceYears, 10),
          price_per_hour: parseFloat(formData.pricePerHour),
          price_per_day: parseFloat(formData.pricePerDay),
          specialties: formData.specialties,
          available: formData.available,
        },
      };
      onComplete(payload);
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const canEditAddressFields = cepMessage?.type === "error";
  const personalInfoComplete =
    formData.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    formData.phone.replace(/\D/g, "").length >= 10 &&
    formData.cpf.replace(/\D/g, "").length === 11;
  const addressComplete =
    formData.zip.replace(/\D/g, "").length === 8 &&
    Boolean(formData.street.trim()) &&
    Boolean(formData.number.trim()) &&
    Boolean(formData.neighborhood.trim()) &&
    Boolean(formData.city.trim()) &&
    Boolean(formData.state.trim()) &&
    formData.latitude !== 0 &&
    formData.longitude !== 0;
  const professionalComplete =
    formData.bio.trim().length >= 10 &&
    String(formData.experienceYears).trim() !== "" &&
    Number(formData.experienceYears) >= 0 &&
    Number(formData.pricePerHour) > 0 &&
    Number(formData.pricePerDay) > 0 &&
    formData.specialties.length > 0;
  const securityComplete =
    formData.password.length >= 6 &&
    formData.confirmPassword.length >= 6 &&
    formData.password === formData.confirmPassword;

  const sectionStatus = {
    personal: personalInfoComplete,
    address: addressComplete,
    professional: professionalComplete,
    security: securityComplete,
  };

  const renderSectionHeader = (key, title, hint) => (
    <button
      type="button"
      className={`section-toggle ${openSection === key ? "is-open" : ""}`}
      onClick={() => setOpenSection((prev) => (prev === key ? "" : key))}
      aria-expanded={openSection === key}
    >
      <div className="section-toggle__copy">
        <h3>{title}</h3>
        <p className="section-hint">{hint}</p>
      </div>
      <div className="section-toggle__meta">
        <span className={`section-status ${sectionStatus[key] ? "is-complete" : "is-pending"}`}>
          {sectionStatus[key] ? (
            <>
              <CheckCircleFilled />
              Completo
            </>
          ) : (
            "Pendente"
          )}
        </span>
        <span className="section-toggle__icon" aria-hidden="true">
          <DownOutlined />
        </span>
      </div>
    </button>
  );

  return (
    <div className="body register-root">
      <div className="container register-diarist-container">
        <div className="form-header">
          <button className="back-button" onClick={onBack} type="button">Voltar</button>
          <h2>Registre-se como Diarista</h2>
          <p>Comece a oferecer seus serviços de limpeza</p>
        </div>

        {errors.general && (
          <div className="error-message">
            <span className="error-icon">{"\u26A0\uFE0F"}</span>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            {renderSectionHeader(
              "personal",
              "Dados Pessoais",
              "Preencha seus dados principais para criar o seu perfil profissional."
            )}
            <div className={`section-panel ${openSection === "personal" ? "is-open" : ""}`}>
              <div className="register-grid register-grid--two">
                <div className="input-group">
                  <label htmlFor="name">Nome Completo</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><UserOutlined /></span>
                    <input type="text" id="name" name="name" placeholder="Digite seu nome completo" className={`input-field ${errors.name ? "error" : ""}`} onChange={handleChange} value={formData.name} />
                  </div>
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="email">E-mail</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><MailOutlined /></span>
                    <input type="email" id="email" name="email" placeholder="Digite seu e-mail" className={`input-field ${errors.email ? "error" : ""}`} onChange={handleChange} value={formData.email} />
                  </div>
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="phone">Telefone</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><PhoneOutlined /></span>
                    <input type="tel" id="phone" name="phone" placeholder="(11) 99999-9999" className={`input-field ${errors.phone ? "error" : ""}`} onChange={handleChange} value={formData.phone} />
                  </div>
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="cpf">CPF</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><IdcardOutlined /></span>
                    <input type="text" id="cpf" name="cpf" placeholder="000.000.000-00" className={`input-field ${errors.cpf ? "error" : ""}`} onChange={handleChange} value={formData.cpf} />
                  </div>
                  {errors.cpf && <span className="field-error">{errors.cpf}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            {renderSectionHeader(
              "address",
              "Endereço",
              "Use o CEP para preencher o endereço automaticamente e depois confirme a localização no mapa."
            )}
            <div className={`section-panel ${openSection === "address" ? "is-open" : ""}`}>
              <div className="input-group">
                <label htmlFor="zip">CEP <span style={{ color: "#ef4444" }}>*</span></label>
                <div className="input-shell">
                  <span className="input-shell__icon" aria-hidden="true"><EnvironmentOutlined /></span>
                  <input type="text" id="zip" name="zip" placeholder="00000-000" className={`input-field ${errors.zip ? "error" : ""}`} onChange={handleChange} value={formData.zip.length > 5 ? `${formData.zip.slice(0, 5)}-${formData.zip.slice(5)}` : formData.zip} disabled={cepLoading} />
                </div>
                {errors.zip && <span className="field-error">{errors.zip}</span>}
                {cepLoading && <span className="field-info">Buscando...</span>}
              </div>
              {cepMessage && <div className={`status-card status-card--${cepMessage.type}`}>{cepMessage.text}</div>}
              <div className="register-grid register-grid--address">
                <div className="input-group register-grid__span-2">
                  <label htmlFor="street">Rua</label>
                  <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                    <span className="input-shell__icon" aria-hidden="true"><HomeOutlined /></span>
                    <input type="text" id="street" name="street" placeholder="Digite sua rua" className={`input-field ${errors.street ? "error" : ""}`} onChange={handleChange} value={formData.street} readOnly={!canEditAddressFields} />
                  </div>
                  {errors.street && <span className="field-error">{errors.street}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="number">Número</label>
                  <div className="input-shell">
                    <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">N</span>
                    <input type="text" id="number" name="number" placeholder="Digite o número" className={`input-field ${errors.number ? "error" : ""}`} onChange={handleChange} value={formData.number} />
                  </div>
                  {errors.number && <span className="field-error">{errors.number}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="neighborhood">Bairro</label>
                  <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                    <span className="input-shell__icon" aria-hidden="true"><CompassOutlined /></span>
                    <input type="text" id="neighborhood" name="neighborhood" placeholder="Digite seu bairro" className="input-field" onChange={handleChange} value={formData.neighborhood} readOnly={!canEditAddressFields} />
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="complement">Complemento</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><BankOutlined /></span>
                    <input type="text" id="complement" name="complement" placeholder="Apto, bloco, etc." className="input-field" onChange={handleChange} value={formData.complement} />
                  </div>
                </div>
                <div className="input-group register-grid__span-2">
                  <label htmlFor="referencePoint">Ponto de Referência</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><PushpinOutlined /></span>
                    <input type="text" id="referencePoint" name="referencePoint" placeholder="Próximo a..." className="input-field" onChange={handleChange} value={formData.referencePoint} />
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="city">Cidade</label>
                  <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                    <span className="input-shell__icon" aria-hidden="true"><BankOutlined /></span>
                    <input type="text" id="city" name="city" placeholder="Digite sua cidade" className={`input-field ${errors.city ? "error" : ""}`} onChange={handleChange} value={formData.city} readOnly={!canEditAddressFields} />
                  </div>
                  {errors.city && <span className="field-error">{errors.city}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="state">Estado</label>
                  <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                    <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">UF</span>
                    <input type="text" id="state" name="state" placeholder="SP" className={`input-field ${errors.state ? "error" : ""}`} onChange={handleChange} value={formData.state} maxLength={2} readOnly={!canEditAddressFields} />
                  </div>
                  {errors.state && <span className="field-error">{errors.state}</span>}
                </div>
              </div>
              {formData.latitude !== 0 && formData.longitude !== 0 && (
                <button type="button" onClick={handleOpenMap} className="map-action-button">Ajustar Localização no Mapa</button>
              )}
              {errors.location && <span className="field-error">{errors.location}</span>}
            </div>
          </div>

          <div className="form-section">
            {renderSectionHeader(
              "professional",
              "Perfil Profissional",
              "Mostre sua experiência e defina seus valores para transmitir mais confiança logo no cadastro."
            )}
            <div className={`section-panel ${openSection === "professional" ? "is-open" : ""}`}>
              <div className="input-group">
                <label htmlFor="bio">Bio / Resumo Profissional</label>
                <div className="input-shell input-shell--textarea">
                  <span className="input-shell__icon" aria-hidden="true"><FileTextOutlined /></span>
                  <textarea id="bio" name="bio" placeholder="Descreva sua experiência, seus diferenciais e os serviços que mais realiza" className={`input-field ${errors.bio ? "error" : ""}`} onChange={handleChange} value={formData.bio} rows="4" />
                </div>
                {errors.bio && <span className="field-error">{errors.bio}</span>}
              </div>
              <div className="register-grid register-grid--three">
                <div className="input-group">
                  <label htmlFor="experienceYears">Anos de Experiência</label>
                  <div className="input-shell">
                    <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">XP</span>
                    <input type="number" id="experienceYears" name="experienceYears" placeholder="Ex.: 5" className={`input-field ${errors.experienceYears ? "error" : ""}`} onChange={handleChange} value={formData.experienceYears} min="0" />
                  </div>
                  {errors.experienceYears && <span className="field-error">{errors.experienceYears}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="pricePerHour">Preço por Hora (R$)</label>
                  <div className="input-shell">
                    <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">R$</span>
                    <input type="number" id="pricePerHour" name="pricePerHour" placeholder="Ex.: 50.00" className={`input-field ${errors.pricePerHour ? "error" : ""}`} onChange={handleChange} value={formData.pricePerHour} min="0" step="0.01" />
                  </div>
                  {errors.pricePerHour && <span className="field-error">{errors.pricePerHour}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="pricePerDay">Preço por Diária (R$)</label>
                  <div className="input-shell">
                    <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">R$</span>
                    <input type="number" id="pricePerDay" name="pricePerDay" placeholder="Ex.: 200.00" className={`input-field ${errors.pricePerDay ? "error" : ""}`} onChange={handleChange} value={formData.pricePerDay} min="0" step="0.01" />
                  </div>
                  {errors.pricePerDay && <span className="field-error">{errors.pricePerDay}</span>}
                </div>
              </div>
              <div className="input-group">
                <label>Especialidades</label>
                <p className="section-hint">Selecione os serviços que você oferece:</p>
                <div className="specialties-grid-premium">
                  {specialtiesOptions.map((specialty) => (
                    <div key={specialty.id} className={`specialty-card ${formData.specialties.includes(specialty.id) ? "selected" : ""}`} onClick={() => handleSpecialtyChange(specialty.id)}>
                      <div className="specialty-icon-wrapper">{specialty.icon}</div>
                      <span className="specialty-label-premium">{specialty.label}</span>
                    </div>
                  ))}
                </div>
                {errors.specialties && <span className="field-error">{errors.specialties}</span>}
              </div>
              <div className="input-group">
                <label className="availability-toggle">
                  <input type="checkbox" checked={formData.available} onChange={handleAvailabilityChange} />
                  <span>
                    <strong>Disponível para novos serviços</strong>
                    <small>Seu perfil pode receber novas solicitações assim que a conta for ativada.</small>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-section">
            {renderSectionHeader(
              "security",
              "Segurança",
              "Use uma senha com pelo menos 6 caracteres. Você pode visualizar o conteúdo antes de enviar."
            )}
            <div className={`section-panel ${openSection === "security" ? "is-open" : ""}`}>
              <div className="register-grid register-grid--two">
                <div className="input-group">
                  <label htmlFor="password">Senha</label>
                  <div className="input-shell input-shell--password">
                    <span className="input-shell__icon" aria-hidden="true"><SafetyCertificateOutlined /></span>
                    <input type={showPassword ? "text" : "password"} id="password" name="password" placeholder="Digite uma senha segura" className={`input-field ${errors.password ? "error" : ""}`} onChange={handleChange} value={formData.password} />
                    <button type="button" className="input-shell__toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}</button>
                  </div>
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="confirmPassword">Confirmar Senha</label>
                  <div className="input-shell input-shell--password">
                    <span className="input-shell__icon" aria-hidden="true"><SafetyCertificateOutlined /></span>
                    <input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" placeholder="Confirme sua senha" className={`input-field ${errors.confirmPassword ? "error" : ""}`} onChange={handleChange} value={formData.confirmPassword} />
                    <button type="button" className="input-shell__toggle" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}>{showConfirmPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}</button>
                  </div>
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className={`button-pay ${isLoading ? "loading" : ""}`} disabled={isLoading}>
            {isLoading ? "Criando conta..." : "Criar conta e escolher plano"}
          </button>
        </form>
      </div>

      <MapModal
        visible={showMap}
        coords={mapCoords}
        onClose={() => setShowMap(false)}
        onCoordsChange={({ latitude, longitude }) => {
          setFormData((prev) => ({ ...prev, latitude, longitude }));
          setCepMessage({ type: "success", text: "Localização confirmada! Você pode prosseguir com o registro." });
        }}
      />
    </div>
  );
};

export default RegisterDiarist;


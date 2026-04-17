import React, { useState } from "react";
import {
  BankOutlined,
  CheckCircleFilled,
  CompassOutlined,
  DeleteOutlined,
  DownOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HeartOutlined,
  HomeOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  PushpinOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import "./register.css";
import MapModal from "./MapModal";

const RegisterClient = ({ onBack, onComplete }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openSection, setOpenSection] = useState("");
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
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
    rooms: [],
    residenceType: "",
    hasPets: "",
    desiredFrequency: "",
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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Nome Ã© obrigatÃ³rio";
    else if (formData.name.trim().length < 2) newErrors.name = "Nome deve ter pelo menos 2 caracteres";

    if (!formData.email.trim()) newErrors.email = "E-mail Ã© obrigatÃ³rio";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "E-mail invÃ¡lido";

    if (!formData.phone.trim()) newErrors.phone = "Telefone Ã© obrigatÃ³rio";
    else if (formData.phone.replace(/\D/g, "").length < 10) newErrors.phone = "Telefone deve ter pelo menos 10 dÃ­gitos";

    if (!formData.cpf.trim()) newErrors.cpf = "CPF Ã© obrigatÃ³rio";
    else if (formData.cpf.replace(/\D/g, "").length !== 11) newErrors.cpf = "CPF deve ter 11 dÃ­gitos";

    if (!formData.zip.trim()) newErrors.zip = "CEP Ã© obrigatÃ³rio";
    else if (formData.zip.replace(/\D/g, "").length !== 8) newErrors.zip = "CEP deve ter 8 dÃ­gitos";

    if (!formData.street.trim()) newErrors.street = "Rua Ã© obrigatÃ³ria";
    if (!formData.number.trim()) newErrors.number = "NÃºmero Ã© obrigatÃ³rio";
    if (!formData.city.trim()) newErrors.city = "Cidade Ã© obrigatÃ³ria";
    if (!formData.state.trim()) newErrors.state = "Estado Ã© obrigatÃ³rio";
    if (
      formData.rooms.length === 0 ||
      formData.rooms.some((room) => !room.name.trim() || !Number(room.quantity) || Number(room.quantity) <= 0)
    ) {
      newErrors.rooms = "Adicione pelo menos um cÃ´modo com nome e quantidade vÃ¡lidos";
    }

    if (formData.latitude === 0 || formData.longitude === 0) {
      newErrors.location = "Localize seu endereÃ§o no mapa antes de prosseguir";
    }

    if (!formData.password.trim()) newErrors.password = "Senha Ã© obrigatÃ³ria";
    else if (formData.password.length < 6) newErrors.password = "Senha deve ter pelo menos 6 caracteres";

    if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "ConfirmaÃ§Ã£o de senha Ã© obrigatÃ³ria";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "As senhas nÃ£o correspondem";

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
          text: "EndereÃ§o alterado. Confirme novamente a localizaÃ§Ã£o no mapa.",
        });
      }
    }

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    if (name === "zip" && cleanValue.length === 8) {
      handleZipCode(cleanValue);
    }
  };

  const handleZipCode = async (zip) => {
    setCepLoading(true);
    setCepMessage(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();

      if (data?.erro) {
        setCepMessage({ type: "error", text: "CEP nÃ£o encontrado. Confira os dÃ­gitos." });
        setCepLoading(false);
        return;
      }

      const updatedFormData = {
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      };

      setFormData((prev) => ({
        ...prev,
        ...updatedFormData,
      }));

      setCepMessage({ type: "info", text: "CEP encontrado! Buscando localizaÃ§Ã£o no mapa..." });

      const neighborhood = data.bairro || "";
      const params = new URLSearchParams({
        q: [data.logradouro, neighborhood, data.localidade, data.uf, "Brasil"]
          .filter(Boolean)
          .join(", "),
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
      });
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );
      const nominatimData = await nominatimRes.json();

      if (Array.isArray(nominatimData) && nominatimData.length > 0) {
        const match = nominatimData[0];
        const lat = Number(match.lat);
        const lon = Number(match.lon);
        setMapCoords({ lat, lon });
        setCepMessage({ type: "success", text: "LocalizaÃ§Ã£o encontrada! Abra o mapa para confirmar." });

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
        }));

        setTimeout(() => {
          setShowMap(true);
        }, 500);
      } else {
        setCepMessage({
          type: "warning",
          text: "NÃ£o consegui localizar no mapa. Abra o mapa manualmente para confirmar.",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setCepMessage({ type: "error", text: "Erro ao buscar CEP. Tente novamente." });
    } finally {
      setCepLoading(false);
    }
  };

  const handleOpenMap = () => {
    if (formData.latitude && formData.longitude) {
      setShowMap(true);
    } else {
      setErrors((prev) => ({
        ...prev,
        location: "Preencha o CEP primeiro para localizar no mapa",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setIsRoomsOpen(true);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: parseInt(formData.phone.replace(/\D/g, ""), 10),
        cpf: formData.cpf,
        password: formData.password,
        role: "cliente",
        address: {
          street: formData.street,
          number: formData.number,
          residence_type: formData.residenceType,
          neighborhood: formData.neighborhood,
          complement: formData.complement,
          referencePoint: formData.referencePoint,
          city: formData.city,
          state: formData.state,
          zipcode: formData.zip,
          latitude: formData.latitude,
          longitude: formData.longitude,
          rooms: formData.rooms
            .map((room) => ({
              name: room.name.trim(),
              quantity: Number(room.quantity),
            }))
            .filter((room) => room.name && Number.isFinite(room.quantity) && room.quantity > 0),
        },
        client_preferences: {
          has_pets: formData.hasPets === "yes",
          desired_frequency: formData.desiredFrequency,
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
    Boolean(formData.residenceType) &&
    Boolean(formData.neighborhood.trim()) &&
    Boolean(formData.city.trim()) &&
    Boolean(formData.state.trim()) &&
    formData.rooms.length > 0 &&
    formData.rooms.every((room) => room.name.trim() && Number(room.quantity) > 0) &&
    formData.latitude !== 0 &&
    formData.longitude !== 0;
  const preferencesComplete = Boolean(formData.hasPets && formData.desiredFrequency);
  const securityComplete =
    formData.password.length >= 6 &&
    formData.confirmPassword.length >= 6 &&
    formData.password === formData.confirmPassword;

  const sectionStatus = {
    personal: personalInfoComplete,
    address: addressComplete,
    preferences: preferencesComplete,
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

  const handleAddRoom = () => {
    setFormData((prev) => ({
      ...prev,
      rooms: [...prev.rooms, { id: `${Date.now()}-${prev.rooms.length}`, name: "", quantity: "" }],
    }));
    setIsRoomsOpen(true);
    if (errors.rooms) {
      setErrors((prev) => ({
        ...prev,
        rooms: "",
      }));
    }
  };

  const handleRoomChange = (roomId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]: field === "quantity" ? value.replace(/\D/g, "").slice(0, 2) : value,
            }
          : room
      ),
    }));
    if (errors.rooms) {
      setErrors((prev) => ({
        ...prev,
        rooms: "",
      }));
    }
  };

  const handleRemoveRoom = (roomId) => {
    setFormData((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((room) => room.id !== roomId),
    }));
  };

  return (
    <div className="body register-root">
      <div className="container register-client-container">
        <div className="form-header">
          <button className="back-button" onClick={onBack} type="button">
            Voltar
          </button>
          <h2>Registre-se como Cliente</h2>
          <p>Encontre profissionais de limpeza com mais rapidez e organize sua rotina com mais facilidade.</p>
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
              "Preencha seus dados principais para criar sua conta e comeÃ§ar a solicitar serviÃ§os."
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
              "EndereÃ§o",
              "Use o CEP para preencher o endereÃ§o automaticamente e depois confirme a localizaÃ§Ã£o no mapa."
            )}
            <div className={`section-panel ${openSection === "address" ? "is-open" : ""}`}>
              <div className="input-group">
                <label htmlFor="zip">
                  CEP <span style={{ color: "#ef4444" }}>*</span>
                </label>
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
                  <label htmlFor="number">NÃºmero</label>
                  <div className="input-shell">
                    <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">N</span>
                    <input type="text" id="number" name="number" placeholder="Digite o nÃºmero" className={`input-field ${errors.number ? "error" : ""}`} onChange={handleChange} value={formData.number} />
                  </div>
                  {errors.number && <span className="field-error">{errors.number}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="residenceType">Tipo do Endereço</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><HomeOutlined /></span>
                    <select id="residenceType" name="residenceType" className="input-field" onChange={handleChange} value={formData.residenceType}>
                      <option value="" disabled>Selecione</option>
                      <option value="apartment">Apartamento</option>
                      <option value="house">Casa</option>
                      <option value="office">Escritório</option>
                    </select>
                  </div>
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
                  <label htmlFor="referencePoint">Ponto de ReferÃªncia</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><PushpinOutlined /></span>
                    <input type="text" id="referencePoint" name="referencePoint" placeholder="PrÃ³ximo a..." className="input-field" onChange={handleChange} value={formData.referencePoint} />
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

              <div className="rooms-accordion">
                <button
                  type="button"
                  className={`rooms-accordion__toggle ${isRoomsOpen ? "is-open" : ""}`}
                  onClick={() => setIsRoomsOpen((prev) => !prev)}
                  aria-expanded={isRoomsOpen}
                >
                  <div className="rooms-accordion__copy">
                    <span className="rooms-accordion__title">CÃ´modos</span>
                    <span className="rooms-accordion__subtitle">
                      Adicione banheiro, quarto, cozinha e outros ambientes com suas quantidades.
                    </span>
                  </div>
                  <div className="rooms-accordion__meta">
                    <span className="rooms-accordion__count">
                      {formData.rooms.length > 0 ? `${formData.rooms.length} item(ns)` : "ObrigatÃ³rio"}
                    </span>
                    <span className="rooms-accordion__icon" aria-hidden="true">
                      <DownOutlined />
                    </span>
                  </div>
                </button>

                <div className={`rooms-accordion__panel ${isRoomsOpen ? "is-open" : ""}`}>
                  <button type="button" className="rooms-add-button" onClick={handleAddRoom}>
                    <PlusOutlined />
                    Adicionar cÃ´modo
                  </button>

                  {formData.rooms.length === 0 ? (
                    <div className="rooms-empty-state">
                      Nenhum cÃ´modo adicionado ainda. Use o botÃ£o acima para informar os ambientes da residÃªncia.
                    </div>
                  ) : (
                    <div className="rooms-list">
                      {formData.rooms.map((room, index) => (
                        <div className="room-row" key={room.id}>
                          <div className="room-row__fields">
                            <div className="input-group">
                              <label htmlFor={`room-name-${room.id}`}>Nome do cÃ´modo {index + 1}</label>
                              <div className="input-shell">
                                <span className="input-shell__icon" aria-hidden="true"><HomeOutlined /></span>
                                <input
                                  type="text"
                                  id={`room-name-${room.id}`}
                                  placeholder="Ex.: Banheiro"
                                  className="input-field"
                                  value={room.name}
                                  onChange={(e) => handleRoomChange(room.id, "name", e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="input-group room-row__quantity">
                              <label htmlFor={`room-quantity-${room.id}`}>Quantidade</label>
                              <div className="input-shell">
                                <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">Qtd</span>
                                <input
                                  type="text"
                                  id={`room-quantity-${room.id}`}
                                  placeholder="1"
                                  className="input-field"
                                  value={room.quantity}
                                  onChange={(e) => handleRoomChange(room.id, "quantity", e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="room-row__remove"
                            onClick={() => handleRemoveRoom(room.id)}
                            aria-label={`Remover cÃ´modo ${index + 1}`}
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.rooms && <span className="field-error">{errors.rooms}</span>}
                </div>
              </div>

              {formData.latitude !== 0 && formData.longitude !== 0 && (
                <button type="button" onClick={handleOpenMap} className="map-action-button">
                  Ajustar LocalizaÃ§Ã£o no Mapa
                </button>
              )}

              {errors.location && <span className="field-error">{errors.location}</span>}
            </div>
          </div>

          <div className="form-section">
            {renderSectionHeader(
              "preferences",
              "PreferÃªncias do ServiÃ§o",
              "Defina a frequência e o contexto do atendimento."
            )}
            <div className={`section-panel ${openSection === "preferences" ? "is-open" : ""}`}>
              <div className="register-grid register-grid--two">
                <div className="input-group">
                  <label htmlFor="hasPets">Possui Animais?</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><HeartOutlined /></span>
                    <select id="hasPets" name="hasPets" className="input-field" onChange={handleChange} value={formData.hasPets}>
                      <option value="" disabled>Selecione</option>
                      <option value="no">NÃ£o</option>
                      <option value="yes">Sim</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="desiredFrequency">FrequÃªncia Desejada</label>
                  <div className="input-shell">
                    <span className="input-shell__icon" aria-hidden="true"><ScheduleOutlined /></span>
                    <select id="desiredFrequency" name="desiredFrequency" className="input-field" onChange={handleChange} value={formData.desiredFrequency}>
                      <option value="" disabled>Selecione</option>
                      <option value="once">Uma Ãºnica vez</option>
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            {renderSectionHeader(
              "security",
              "SeguranÃ§a",
              "Crie uma senha segura e confirme os dados antes de seguir para a escolha do plano."
            )}
            <div className={`section-panel ${openSection === "security" ? "is-open" : ""}`}>
              <div className="register-grid register-grid--two">
                <div className="input-group">
                  <label htmlFor="password">Senha</label>
                  <div className="input-shell input-shell--password">
                    <span className="input-shell__icon" aria-hidden="true"><SafetyCertificateOutlined /></span>
                    <input type={showPassword ? "text" : "password"} id="password" name="password" placeholder="Digite uma senha segura" className={`input-field ${errors.password ? "error" : ""}`} onChange={handleChange} value={formData.password} />
                    <button type="button" className="input-shell__toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                      {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    </button>
                  </div>
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>
                <div className="input-group">
                  <label htmlFor="confirmPassword">Confirmar Senha</label>
                  <div className="input-shell input-shell--password">
                    <span className="input-shell__icon" aria-hidden="true"><SafetyCertificateOutlined /></span>
                    <input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" placeholder="Confirme sua senha" className={`input-field ${errors.confirmPassword ? "error" : ""}`} onChange={handleChange} value={formData.confirmPassword} />
                    <button type="button" className="input-shell__toggle" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? "Ocultar confirmaÃ§Ã£o de senha" : "Mostrar confirmaÃ§Ã£o de senha"}>
                      {showConfirmPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    </button>
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
          setCepMessage({
            type: "success",
            text: "LocalizaÃ§Ã£o confirmada! VocÃª pode prosseguir com o registro.",
          });
        }}
      />
    </div>
  );
};

export default RegisterClient;


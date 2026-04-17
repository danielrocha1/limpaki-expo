import React, { useEffect, useMemo, useState } from "react";
import {
  BankOutlined,
  CheckCircleFilled,
  CompassOutlined,
  DeleteOutlined,
  DownOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  PlusOutlined,
  PushpinOutlined,
} from "@ant-design/icons";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./multiform.css";
import "./register.css";
import MapModal from "./MapModal";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const onlyDigits = (value) => (value || "").replace(/\D/g, "");
const formatCep = (digits) =>
  digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;

const UF_TO_STATE = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapa",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceara",
  DF: "Distrito Federal",
  ES: "Espirito Santo",
  GO: "Goias",
  MA: "Maranhao",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Para",
  PB: "Paraiba",
  PR: "Parana",
  PE: "Pernambuco",
  PI: "Piaui",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondonia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "Sao Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

const createRoom = (index = 0) => ({
  id: `${Date.now()}-${index}`,
  name: "",
  quantity: "",
});

const getCurrentBrowserPosition = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

const AddressForm = () => {
  const [address, setAddress] = useState({
    zipcode: "",
    street: "",
    number: "",
    residenceType: "apartment",
    complement: "",
    neighborhood: "",
    referencePoint: "",
    city: "",
    state: "",
    latitude: 0,
    longitude: 0,
    rooms: [],
  });
  const [addressData, setAddressData] = useState({
    zipcode: "",
    street: "",
    number: "",
    residence_type: "apartment",
    complement: "",
    neighborhood: "",
    referencePoint: "",
    city: "",
    state: "",
    latitude: 0,
    longitude: 0,
    rooms: [],
  });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [openSection, setOpenSection] = useState("");
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setAddressData({
      zipcode: address.zipcode,
      street: address.street,
      number: address.number,
      residence_type: address.residenceType,
      complement: address.complement,
      neighborhood: address.neighborhood,
      referencePoint: address.referencePoint,
      city: address.city,
      state: address.state,
      latitude: address.latitude,
      longitude: address.longitude,
      rooms: address.rooms
        .map((room) => ({
          name: room.name.trim(),
          quantity: Number(room.quantity),
        }))
        .filter((room) => room.name && Number.isFinite(room.quantity) && room.quantity > 0),
    });
  }, [address]);

  useEffect(() => {
    let active = true;

    const seedCurrentLocation = async () => {
      try {
        const position = await getCurrentBrowserPosition();
        if (!active) {
          return;
        }

        const latitude = Number(position.coords.latitude || 0);
        const longitude = Number(position.coords.longitude || 0);

        if (!latitude || !longitude) {
          return;
        }

        setAddress((prev) => ({
          ...prev,
          latitude,
          longitude,
        }));
        setNotice({
          type: "info",
          source: "map",
          text: "Usamos sua localização atual como ponto de partida. Ajuste o pino no mapa para confirmar o endereço.",
        });
        setShowMap(true);
      } catch {
        if (!active) {
          return;
        }

        setNotice({
          type: "info",
          source: "map",
          text: "Permita sua localização atual ou preencha o CEP para posicionar o endereço no mapa.",
        });
      }
    };

    seedCurrentLocation();

    return () => {
      active = false;
    };
  }, []);

  const markerIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      }),
    []
  );

  const hasCoords =
    typeof address.latitude === "number" &&
    typeof address.longitude === "number" &&
    address.latitude !== 0 &&
    address.longitude !== 0;
  const canEditAddressFields = notice?.type === "error" && notice?.source === "zip";
  const roomsValid =
    address.rooms.length > 0 &&
    address.rooms.every(
      (room) => room.name.trim() && Number(room.quantity) > 0
    );
  const addressMainComplete =
    onlyDigits(address.zipcode).length === 8 &&
    Boolean(address.street.trim()) &&
    Boolean(address.number.trim()) &&
    Boolean(address.neighborhood.trim()) &&
    Boolean(address.city.trim()) &&
    Boolean(address.state.trim());
  const detailsComplete = roomsValid && hasCoords;
  const sectionStatus = {
    address: addressMainComplete,
    details: detailsComplete,
  };

  const buildFullAddressFrom = (addrObj) => {
    const parts = [
      addrObj.street,
      addrObj.number,
      addrObj.complement,
      addrObj.neighborhood,
      addrObj.referencePoint,
      addrObj.city,
      addrObj.state,
      onlyDigits(addrObj.zipcode),
      "Brasil",
    ]
      .map((item) => (item || "").toString().trim())
      .filter(Boolean);

    return parts.join(", ");
  };

  const getCityBounds = async (city, uf) => {
    if (!city || !uf) return null;

    try {
      const query = `${city}, ${UF_TO_STATE[uf] || uf}, Brasil`;
      const params = new URLSearchParams({ q: query, limit: "1", lang: "en" });
      params.set("format", "jsonv2");
      params.set("countrycodes", "br");
      const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

            const data = await response.json();
      const match = Array.isArray(data) ? data[0] : null;
      if (!match) return null;

      const bbox = Array.isArray(match.boundingbox)
        ? [
            Number(match.boundingbox[2]),
            Number(match.boundingbox[0]),
            Number(match.boundingbox[3]),
            Number(match.boundingbox[1]),
          ]
        : null;
      const center =
        match.lat && match.lon
          ? { lon: Number(match.lon), lat: Number(match.lat) }
          : null;

      return center ? { bbox, center } : null;
    } catch {
      return null;
    }
  };

  const handleNominatimSearch = async (addressOverride = null) => {
    const currentAddress = addressOverride || address;

    if (!currentAddress.street || !currentAddress.city || !currentAddress.state) {
      setNotice({
        type: "error",
        source: "map",
        text: "Preencha Rua, Cidade e UF antes de buscar no mapa.",
      });
      return;
    }

    setLoading(true);
    setNotice({ type: "info", source: "map", text: "Localizando no mapa..." });
    setShowMap(false);

    try {
      const bounds = await getCityBounds(currentAddress.city, currentAddress.state);
      const query = buildFullAddressFrom(currentAddress);
      const params = new URLSearchParams({ q: query, limit: "1", lang: "en" });

      if (bounds?.bbox?.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = bounds.bbox;
        params.set("bbox", `${minLon},${minLat},${maxLon},${maxLat}`);
      } else if (bounds?.center) {
        params.set("lat", String(bounds.center.lat));
        params.set("lon", String(bounds.center.lon));
      }

      params.set("format", "jsonv2");
      params.set("countrycodes", "br");
      const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        setNotice({
          type: "error",
          source: "map",
          text: "Não foi possível localizar no mapa agora. Tente novamente.",
        });
        return;
      }

            const data = await response.json();
      const match = Array.isArray(data) ? data[0] : null;

      if (!match) {
        setNotice({
          type: "error",
          source: "map",
          text: "Não encontrei esse endereço. Ajuste a rua, o número ou o bairro e tente novamente.",
        });
        return;
      }

      const latitude = Number(match.lat);
      const longitude = Number(match.lon);
      setAddress((prev) => ({
        ...prev,
        latitude: Number(latitude),
        longitude: Number(longitude),
      }));
      setShowMap(true);
      setNotice({
        type: "success",
        source: "map",
        text: "Localização pronta. Você pode ajustar o pino no mapa.",
      });

      if (errors.location) {
        setErrors((prev) => ({ ...prev, location: "" }));
      }
    } catch {
      setNotice({
        type: "error",
        source: "map",
        text: "Erro ao acessar o serviço de mapas. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleZipChange = async (value) => {
    const zipcode = onlyDigits(value).slice(0, 8);
    setAddress((prev) => ({ ...prev, zipcode }));
    setShowMap(false);

    if (errors.zipcode) {
      setErrors((prev) => ({ ...prev, zipcode: "" }));
    }

    if (zipcode.length !== 8) {
      setNotice(null);
      return;
    }

    setLoading(true);
    setNotice({ type: "info", source: "zip", text: "Buscando endereço pelo CEP..." });

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`);
      const data = await response.json();

      if (data?.erro) {
        setNotice({
          type: "error",
          source: "zip",
          text: "CEP não encontrado. Agora você pode preencher o endereço manualmente.",
        });
        return;
      }

      const mergedAddress = {
        ...address,
        zipcode,
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: (data.uf || "").toUpperCase(),
      };

      setAddress((prev) => ({
        ...prev,
        street: mergedAddress.street,
        neighborhood: mergedAddress.neighborhood,
        city: mergedAddress.city,
        state: mergedAddress.state,
      }));

      setNotice({
        type: "success",
        source: "zip",
        text: "Endereço preenchido pelo CEP. Agora confirme a localização.",
      });

      Promise.resolve().then(() => handleNominatimSearch(mergedAddress));
    } catch {
      setNotice({
        type: "error",
        source: "zip",
        text: "Falha ao consultar o CEP. Preencha o endereço manualmente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (name, value) => {
    setAddress((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddRoom = () => {
    setAddress((prev) => ({
      ...prev,
      rooms: [...prev.rooms, createRoom(prev.rooms.length)],
    }));
    setIsRoomsOpen(true);

    if (errors.rooms) {
      setErrors((prev) => ({ ...prev, rooms: "" }));
    }
  };

  const handleRoomChange = (roomId, field, value) => {
    setAddress((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              [field]:
                field === "quantity" ? value.replace(/\D/g, "").slice(0, 2) : value,
            }
          : room
      ),
    }));

    if (errors.rooms) {
      setErrors((prev) => ({ ...prev, rooms: "" }));
    }
  };

  const handleRemoveRoom = (roomId) => {
    setAddress((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((room) => room.id !== roomId),
    }));
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
        <span
          className={`section-status ${sectionStatus[key] ? "is-complete" : "is-pending"}`}
        >
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

  const validateForm = () => {
    const nextErrors = {};

    if (onlyDigits(address.zipcode).length !== 8) nextErrors.zipcode = "Informe um CEP válido.";
    if (!address.street.trim()) nextErrors.street = "Informe a rua.";
    if (!address.number.trim()) nextErrors.number = "Informe o número.";
    if (!address.neighborhood.trim()) nextErrors.neighborhood = "Informe o bairro.";
    if (!address.city.trim()) nextErrors.city = "Informe a cidade.";
    if (!address.state.trim()) nextErrors.state = "Informe o estado.";
    if (!roomsValid) {
      nextErrors.rooms = "Adicione pelo menos um cômodo com nome e quantidade válidos.";
    }
    if (!hasCoords) {
      nextErrors.location = "Confirme a localização no mapa antes de salvar.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      setOpenSection("address");
      setIsRoomsOpen(true);
      return;
    }

    setNotice({
      type: "success",
      source: "save",
      text: "Endereço pronto para envio.",
    });
    console.log("address payload ready", addressData);
  };

  return (
    <div className="body register-root">
      <div className="container register-client-container address-form-container">
        <div className="form-header">
          <h2>Novo endereço</h2>
          <p>
            Preencha o endereço com CEP, confirme a localização no mapa e informe os
            cômodos da residência.
          </p>
        </div>

        {notice && (
          <div className={`status-card status-card--${notice.type}`}>
            {notice.text}
          </div>
        )}

        <div className="form-section">
          {renderSectionHeader(
            "address",
            "Endereço principal",
            "Use o CEP para preencher automaticamente e ajuste os campos manualmente quando necessário."
          )}
          <div className={`section-panel ${openSection === "address" ? "is-open" : ""}`}>
            <div className="input-group">
              <label htmlFor="zipcode">CEP</label>
              <div className="input-shell">
                <span className="input-shell__icon" aria-hidden="true">
                  <EnvironmentOutlined />
                </span>
                <input
                  id="zipcode"
                  type="text"
                  inputMode="numeric"
                  className={`input-field ${errors.zipcode ? "error" : ""}`}
                  placeholder="00000-000"
                  value={formatCep(address.zipcode)}
                  onChange={(event) => handleZipChange(event.target.value)}
                  maxLength={9}
                />
              </div>
              {errors.zipcode && <span className="field-error">{errors.zipcode}</span>}
            </div>

            <div className="register-grid register-grid--address">
              <div className="input-group register-grid__span-2">
                <label htmlFor="street">Rua</label>
                <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                  <span className="input-shell__icon" aria-hidden="true">
                    <HomeOutlined />
                  </span>
                  <input
                    id="street"
                    type="text"
                    className={`input-field ${errors.street ? "error" : ""}`}
                    placeholder="Rua / Avenida"
                    value={address.street}
                    onChange={(event) => handleFieldChange("street", event.target.value)}
                    readOnly={!canEditAddressFields}
                  />
                </div>
                {errors.street && <span className="field-error">{errors.street}</span>}
              </div>

              <div className="input-group">
                    <label htmlFor="number">Número</label>
                <div className="input-shell">
                  <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">
                    N
                  </span>
                  <input
                    id="number"
                    type="text"
                    className={`input-field ${errors.number ? "error" : ""}`}
                    placeholder="Ex.: 123"
                    value={address.number}
                    onChange={(event) => handleFieldChange("number", event.target.value)}
                  />
                </div>
                {errors.number && <span className="field-error">{errors.number}</span>}
              </div>

              <div className="input-group">
                <label htmlFor="residenceType">Tipo do endereço</label>
                <div className="input-shell">
                  <span className="input-shell__icon" aria-hidden="true">
                    <HomeOutlined />
                  </span>
                  <select
                    id="residenceType"
                    className="input-field"
                    value={address.residenceType}
                    onChange={(event) => handleFieldChange("residenceType", event.target.value)}
                  >
                    <option value="apartment">Apartamento</option>
                    <option value="house">Casa</option>
                    <option value="office">Escritório</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="neighborhood">Bairro</label>
                <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                  <span className="input-shell__icon" aria-hidden="true">
                    <CompassOutlined />
                  </span>
                  <input
                    id="neighborhood"
                    type="text"
                    className={`input-field ${errors.neighborhood ? "error" : ""}`}
                    placeholder="Bairro"
                    value={address.neighborhood}
                    onChange={(event) => handleFieldChange("neighborhood", event.target.value)}
                    readOnly={!canEditAddressFields}
                  />
                </div>
                {errors.neighborhood && <span className="field-error">{errors.neighborhood}</span>}
              </div>

              <div className="input-group">
                <label htmlFor="city">Cidade</label>
                <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                  <span className="input-shell__icon" aria-hidden="true">
                    <BankOutlined />
                  </span>
                  <input
                    id="city"
                    type="text"
                    className={`input-field ${errors.city ? "error" : ""}`}
                    placeholder="Cidade"
                    value={address.city}
                    onChange={(event) => handleFieldChange("city", event.target.value)}
                    readOnly={!canEditAddressFields}
                  />
                </div>
                {errors.city && <span className="field-error">{errors.city}</span>}
              </div>

              <div className="input-group">
                <label htmlFor="state">Estado</label>
                <div className={`input-shell ${canEditAddressFields ? "" : "input-shell--readonly"}`.trim()}>
                  <span className="input-shell__icon input-shell__icon--text" aria-hidden="true">
                    UF
                  </span>
                  <input
                    id="state"
                    type="text"
                    className={`input-field ${errors.state ? "error" : ""}`}
                    placeholder="SP"
                    value={address.state}
                    onChange={(event) => handleFieldChange("state", event.target.value.toUpperCase())}
                    readOnly={!canEditAddressFields}
                    maxLength={2}
                  />
                </div>
                {errors.state && <span className="field-error">{errors.state}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          {renderSectionHeader(
            "details",
            "Detalhes do imóvel",
            "Informe complementos, cômodos e confirme onde o local aparece no mapa."
          )}
          <div className={`section-panel ${openSection === "details" ? "is-open" : ""}`}>
            <div className="register-grid register-grid--two">
              <div className="input-group">
                <label htmlFor="complement">Complemento</label>
                <div className="input-shell">
                  <span className="input-shell__icon" aria-hidden="true">
                    <BankOutlined />
                  </span>
                  <input
                    id="complement"
                    type="text"
                    className="input-field"
                    placeholder="Apto, bloco, casa, etc."
                    value={address.complement}
                    onChange={(event) => handleFieldChange("complement", event.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="referencePoint">Ponto de referência</label>
                <div className="input-shell">
                  <span className="input-shell__icon" aria-hidden="true">
                    <PushpinOutlined />
                  </span>
                  <input
                    id="referencePoint"
                    type="text"
                    className="input-field"
                    placeholder="Próximo a..."
                    value={address.referencePoint}
                    onChange={(event) => handleFieldChange("referencePoint", event.target.value)}
                  />
                </div>
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
                  <span className="rooms-accordion__title">Cômodos</span>
                  <span className="rooms-accordion__subtitle">
                    Adicione banheiro, quarto, cozinha e outros ambientes com suas quantidades.
                  </span>
                </div>
                <div className="rooms-accordion__meta">
                  <span className="rooms-accordion__count">
                    {address.rooms.length > 0
                      ? `${address.rooms.length} item(ns)`
                      : "Obrigatório"}
                  </span>
                  <span className="rooms-accordion__icon" aria-hidden="true">
                    <DownOutlined />
                  </span>
                </div>
              </button>

              <div className={`rooms-accordion__panel ${isRoomsOpen ? "is-open" : ""}`}>
                <button type="button" className="rooms-add-button" onClick={handleAddRoom}>
                  <PlusOutlined />
                  Adicionar cômodo
                </button>

                {address.rooms.length === 0 ? (
                  <div className="rooms-empty-state">
                    Informe pelo menos um cômodo para descrever melhor a residência.
                  </div>
                ) : (
                  <div className="rooms-list">
                    {address.rooms.map((room, index) => (
                      <div className="room-row" key={room.id}>
                        <div className="room-row__fields">
                          <div className="input-group">
                            <label htmlFor={`room-name-${room.id}`}>
                              Nome do cômodo {index + 1}
                            </label>
                            <div className="input-shell">
                              <span className="input-shell__icon" aria-hidden="true">
                                <HomeOutlined />
                              </span>
                              <input
                                id={`room-name-${room.id}`}
                                type="text"
                                className="input-field"
                                placeholder="Ex.: Banheiro"
                                value={room.name}
                                onChange={(event) =>
                                  handleRoomChange(room.id, "name", event.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="input-group room-row__quantity">
                            <label htmlFor={`room-quantity-${room.id}`}>Quantidade</label>
                            <div className="input-shell">
                              <span
                                className="input-shell__icon input-shell__icon--text"
                                aria-hidden="true"
                              >
                                Qtd
                              </span>
                              <input
                                id={`room-quantity-${room.id}`}
                                type="text"
                                className="input-field"
                                placeholder="1"
                                value={room.quantity}
                                onChange={(event) =>
                                  handleRoomChange(room.id, "quantity", event.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="room-row__remove"
                          onClick={() => handleRemoveRoom(room.id)}
                          aria-label={`Remover cômodo ${index + 1}`}
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

            {hasCoords ? (
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="map-action-button"
              >
                Ajustar localização no mapa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNominatimSearch()}
                className="map-action-button"
                disabled={loading}
              >
                Buscar localização no mapa
              </button>
            )}
            {errors.location && <span className="field-error">{errors.location}</span>}

            {showMap && hasCoords && (
              <div className="map-container" style={{ marginTop: 16 }}>
                <MapContainer
                  center={[address.latitude, address.longitude]}
                  zoom={18}
                  style={{ height: "320px", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker
                    draggable
                    position={[address.latitude, address.longitude]}
                    icon={markerIcon}
                    eventHandlers={{
                      dragend: (event) => {
                        const { lat, lng } = event.target.getLatLng();
                        setAddress((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                        setNotice({
                          type: "info",
                          source: "map",
                          text: "Pino atualizado no mapa.",
                        });
                      },
                    }}
                  />
                </MapContainer>
              </div>
            )}
          </div>
        </div>

        <button type="button" className="button-pay" onClick={handleSave} disabled={loading}>
          Salvar endereço
        </button>
      </div>

      <MapModal
        visible={showMap}
        coords={hasCoords ? { lat: address.latitude, lon: address.longitude } : null}
        onCoordsChange={({ latitude, longitude }) => {
          setAddress((prev) => ({ ...prev, latitude, longitude }));
          setNotice({
            type: "success",
            source: "map",
            text: "Localização confirmada com sucesso.",
          });
        }}
        onClose={() => setShowMap(false)}
      />
    </div>
  );
};

export default AddressForm;



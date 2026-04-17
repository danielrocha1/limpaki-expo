import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.58)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 9999,
};

const panelStyle = {
  background: "#ffffff",
  width: "min(680px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  borderRadius: "20px",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
  padding: "24px",
};

const mapShellStyle = {
  height: "380px",
  width: "100%",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #e5e7eb",
  marginBottom: "20px",
};

const buttonRowStyle = {
  display: "flex",
  gap: "12px",
  justifyContent: "flex-end",
};

const secondaryButtonStyle = {
  padding: "10px 20px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: "600",
};

const primaryButtonStyle = {
  padding: "10px 20px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "600",
};

const ChangeView = ({ center, visible }) => {
  const map = useMap();

  useEffect(() => {
    if (!visible || !center) {
      return undefined;
    }

    map.setView(center, 18, { animate: false });

    const timers = [
      window.setTimeout(() => map.invalidateSize(), 0),
      window.setTimeout(() => map.invalidateSize(), 150),
      window.setTimeout(() => map.invalidateSize(), 350),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [center, map, visible]);

  return null;
};

const MapModal = ({ visible, coords, onCoordsChange, onClose }) => {
  const [localCoords, setLocalCoords] = useState(coords);

  useEffect(() => {
    if (visible && coords) {
      setLocalCoords(coords);
    }
  }, [coords, visible]);

  const markerIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      }),
    []
  );

  if (!visible || !localCoords) {
    return null;
  }

  const center = [localCoords.lat, localCoords.lon];

  const handleConfirm = () => {
    onCoordsChange({
      latitude: Number(localCoords.lat),
      longitude: Number(localCoords.lon),
    });
    onClose();
  };

  const content = (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px" }}>Confirme sua localização</h2>
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#475569" }}>
              Arraste o pino para a posição exata da sua residência no mapa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "24px",
              lineHeight: 1,
              cursor: "pointer",
              color: "#64748b",
            }}
            aria-label="Fechar mapa"
          >
            x
          </button>
        </div>

        <div style={mapShellStyle}>
          <MapContainer center={center} zoom={18} style={{ height: "100%", width: "100%" }} preferCanvas>
            <ChangeView center={center} visible={visible} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              draggable
              position={center}
              icon={markerIcon}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  setLocalCoords({ lat, lon: lng });
                },
              }}
            />
          </MapContainer>
        </div>

        <div style={buttonRowStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} style={primaryButtonStyle}>
            Confirmar localização
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default MapModal;

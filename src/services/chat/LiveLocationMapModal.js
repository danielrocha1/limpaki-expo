import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const buildFallbackAvatar = (name, background = "#1d4ed8") => {
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="100%" height="100%" rx="40" fill="${background}" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="32" font-weight="700">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const escapeHtmlAttribute = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const resolvePinPhoto = (photo, name, accentColor) =>
  String(photo || "").trim() || buildFallbackAvatar(name, accentColor);

const createPhotoPinIcon = (photo, name, accentColor) => {
  const safeName = escapeHtmlAttribute(name || "Usuario");
  const fallbackPhoto = buildFallbackAvatar(name, accentColor);
  const safeFallbackPhoto = escapeHtmlAttribute(fallbackPhoto);
  const safePhoto = escapeHtmlAttribute(resolvePinPhoto(photo, name, accentColor));

  return (
  L.divIcon({
    html: `
      <div class="chat-location-pin-wrapper">
        <div class="chat-location-pin" style="--pin-accent:${accentColor}">
          <img
            src="${safePhoto}"
            alt="${safeName}"
            class="chat-location-pin-photo"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='${safeFallbackPhoto}';"
          />
          <span class="chat-location-pin-pulse"></span>
        </div>
      </div>
    `,
    className: "chat-location-pin-icon",
    iconSize: [91, 103],
    iconAnchor: [45, 97],
    popupAnchor: [0, -84],
  }));
};

const MapBoundsController = ({ isOpen, markers }) => {
  const map = useMap();
  const lastMarkerKeyRef = useRef("");
  const hasAppliedInitialViewRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasAppliedInitialViewRef.current = false;
      lastMarkerKeyRef.current = "";
      return;
    }

    if (!Array.isArray(markers) || markers.length === 0) {
      return;
    }

    const markerKey = markers
      .map((marker) => `${marker.id}:${marker.position?.[0]}:${marker.position?.[1]}`)
      .join("|");

    if (!hasAppliedInitialViewRef.current) {
      hasAppliedInitialViewRef.current = true;
      lastMarkerKeyRef.current = markerKey;

      if (markers.length === 1) {
        map.setView(markers[0].position, 15, { animate: false });
        return;
      }

      const bounds = L.latLngBounds(markers.map((marker) => marker.position));
      map.fitBounds(bounds, { padding: [40, 40] });
      return;
    }

    const previousIds = lastMarkerKeyRef.current
      .split("|")
      .map((item) => item.split(":")[0])
      .filter(Boolean)
      .join("|");
    const nextIds = markers.map((marker) => marker.id).join("|");

    if (previousIds !== nextIds) {
      lastMarkerKeyRef.current = markerKey;

      if (markers.length === 1) {
        map.setView(markers[0].position, 15, { animate: true });
        return;
      }

      const bounds = L.latLngBounds(markers.map((marker) => marker.position));
      map.fitBounds(bounds, { padding: [40, 40] });
      return;
    }

    lastMarkerKeyRef.current = markerKey;
  }, [isOpen, map, markers]);

  return null;
};

const LiveLocationMapModal = ({ isOpen, markers, onClose }) => {
  const availableMarkers = useMemo(
    () => (Array.isArray(markers) ? markers.filter((marker) => Array.isArray(marker?.position)) : []),
    [markers],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="chat-location-modal-backdrop" onClick={onClose}>
      <div className="chat-location-modal" onClick={(event) => event.stopPropagation()}>
        <div className="chat-location-modal-header">
          <div>
            <strong>Localização em tempo real</strong>
            <span>Veja cliente e diarista no mapa em tempo real.</span>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose}>
            {"\u2715"}
          </button>
        </div>

        <div className="chat-location-modal-body">
          {availableMarkers.length === 0 ? (
            <div className="service-chat-empty">
          <p>Nenhuma localização disponível ainda.</p>
              <span>Assim que a diarista compartilhar a posicao, ela aparece aqui.</span>
            </div>
          ) : (
            <div className="chat-location-map-shell">
              <MapContainer
                center={availableMarkers[0].position}
                zoom={14}
                className="chat-location-map"
                scrollWheelZoom
              >
                <MapBoundsController isOpen={isOpen} markers={availableMarkers} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {availableMarkers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={marker.position}
                    icon={createPhotoPinIcon(marker.photo, marker.name, marker.accentColor)}
                  >
                    <Popup>
                      <div className="chat-location-popup">
                        <strong>{marker.name}</strong>
                        <span>{marker.label}</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          <div className="chat-location-legend">
            {markers.map((marker) => (
              <div key={marker.id} className="chat-location-legend-item">
                <span
                  className="chat-location-legend-dot"
                  style={{ background: marker.accentColor }}
                />
                <div>
                  <strong>{marker.name}</strong>
                  <span>{marker.statusText}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveLocationMapModal;

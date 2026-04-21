import React, { useEffect, useMemo, useRef } from "react";

const leafletCss = `
.limpae-live-map, .limpae-live-map * { box-sizing: border-box; }
.limpae-live-map { position: relative; overflow: hidden; width: 100%; height: 100%; }
.limpae-live-map .leaflet-pane,
.limpae-live-map .leaflet-tile,
.limpae-live-map .leaflet-marker-icon,
.limpae-live-map .leaflet-marker-shadow,
.limpae-live-map .leaflet-tile-container,
.limpae-live-map .leaflet-pane > svg,
.limpae-live-map .leaflet-pane > canvas,
.limpae-live-map .leaflet-zoom-box,
.limpae-live-map .leaflet-image-layer,
.limpae-live-map .leaflet-layer { position: absolute; left: 0; top: 0; }
.limpae-live-map .leaflet-control { position: relative; z-index: 800; pointer-events: auto; }
.limpae-live-map .leaflet-top,
.limpae-live-map .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; }
.limpae-live-map .leaflet-top { top: 0; }
.limpae-live-map .leaflet-bottom { bottom: 0; }
.limpae-live-map .leaflet-right { right: 0; }
.limpae-live-map .leaflet-left { left: 0; }
.limpae-live-map .leaflet-control-zoom { margin: 12px; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18); }
.limpae-live-map .leaflet-control-zoom a { width: 34px; height: 34px; line-height: 34px; display: block; text-align: center; text-decoration: none; background: #fff; color: #1f2937; font-weight: 700; font-size: 18px; border-bottom: 1px solid #e5e7eb; }
.limpae-live-map .leaflet-control-zoom a:last-child { border-bottom: none; }
.limpae-live-map .leaflet-control-attribution { margin: 0 10px 10px 0; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,0.92); font-size: 11px; color: #475569; }
`;

const ensureLeafletCss = () => {
  if (typeof document === "undefined" || document.getElementById("limpae-live-map-css")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "limpae-live-map-css";
  style.textContent = leafletCss;
  document.head.appendChild(style);
};

const buildFallbackAvatar = (name, background = "#2563eb") => {
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="84" height="84">
      <rect width="100%" height="100%" rx="42" fill="${background}" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function LiveLocationMapCanvas({ markers }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const availableMarkers = useMemo(
    () =>
      Array.isArray(markers)
        ? markers.filter(
            (marker) => Number.isFinite(marker?.latitude) && Number.isFinite(marker?.longitude),
          )
        : [],
    [markers],
  );

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") {
      return undefined;
    }

    let mounted = true;

    const boot = async () => {
      ensureLeafletCss();
      const leafletModule = await import("leaflet");
      const L = leafletModule.default || leafletModule;

      if (!mounted || !mapRef.current) {
        return;
      }

      if (mapRef.current.classList && !mapRef.current.classList.contains("limpae-live-map")) {
        mapRef.current.classList.add("limpae-live-map");
      }

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: availableMarkers[0]
            ? [availableMarkers[0].latitude, availableMarkers[0].longitude]
            : [-12.9777, -38.5016],
          zoom: availableMarkers.length > 1 ? 13 : 15,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);

        layerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      }

      if (!layerGroupRef.current) {
        layerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      }

      layerGroupRef.current.clearLayers();

      availableMarkers.forEach((marker) => {
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:60px;height:74px;display:flex;justify-content:center;align-items:flex-start;">
              <span style="position:absolute;top:14px;left:50%;width:30px;height:30px;margin-left:-15px;border-radius:999px;background:${marker.accentColor}33;"></span>
              <div style="position:relative;width:52px;height:52px;border-radius:999px;border:3px solid ${marker.accentColor};overflow:hidden;background:#fff;box-shadow:0 10px 22px rgba(15,23,42,.24);">
                <img src="${String(marker.photo || "").trim() || buildFallbackAvatar(marker.name, marker.accentColor)}" alt="${marker.name || "Usuario"}" style="width:100%;height:100%;object-fit:cover;display:block;" />
              </div>
            </div>
          `,
          iconSize: [60, 74],
          iconAnchor: [30, 60],
          popupAnchor: [0, -42],
        });

        L.marker([marker.latitude, marker.longitude], { icon })
          .addTo(layerGroupRef.current)
          .bindPopup(`<strong>${marker.name || "Usuario"}</strong><br/>${marker.label || "Ponto"}`);
      });

      if (availableMarkers.length > 1) {
        const bounds = L.latLngBounds(
          availableMarkers.map((marker) => [marker.latitude, marker.longitude]),
        );
        mapInstanceRef.current.fitBounds(bounds, { padding: [32, 32] });
      } else if (availableMarkers[0]) {
        mapInstanceRef.current.setView(
          [availableMarkers[0].latitude, availableMarkers[0].longitude],
          15,
          { animate: false },
        );
      }

      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
    };

    void boot();

    return () => {
      mounted = false;
    };
  }, [availableMarkers]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove?.();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  if (!availableMarkers.length) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "8px",
          color: "#475569",
          textAlign: "center",
          padding: "20px",
          background: "#dbeafe",
        }}
      >
        <strong style={{ color: "#1f2937" }}>Nenhuma localizacao disponivel</strong>
        <span>Assim que a diarista compartilhar a posicao, ela aparece aqui.</span>
      </div>
    );
  }

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}

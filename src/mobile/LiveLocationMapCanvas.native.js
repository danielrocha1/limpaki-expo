import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildFallbackAvatar = (name, background = "#2563eb") => {
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="84" height="84">
      <rect width="100%" height="100%" rx="42" fill="${background}" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeHtml(initial)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const buildMapHtml = (markers) => {
  const normalizedMarkers = Array.isArray(markers)
    ? markers.map((marker) => ({
        id: marker?.id || `marker-${Math.random()}`,
        name: marker?.name || "Usuario",
        label: marker?.label || "Ponto",
        statusText: marker?.statusText || "",
        accentColor: marker?.accentColor || "#2563eb",
        latitude: Number(marker?.latitude || 0),
        longitude: Number(marker?.longitude || 0),
        photo: String(marker?.photo || "").trim() || buildFallbackAvatar(marker?.name, marker?.accentColor),
      }))
    : [];

  const markerJson = JSON.stringify(normalizedMarkers);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #dbeafe;
      }
      .leaflet-container {
        font-family: Arial, sans-serif;
        background: #dbeafe;
      }
      .leaflet-control-attribution {
        font-size: 10px;
      }
      .limpae-pin-shell {
        position: relative;
        width: 60px;
        height: 74px;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      .limpae-pin-pulse {
        position: absolute;
        top: 14px;
        left: 50%;
        width: 30px;
        height: 30px;
        margin-left: -15px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--accent) 28%, transparent);
        animation: pulse 1.8s ease-out infinite;
      }
      .limpae-pin {
        position: relative;
        width: 52px;
        height: 52px;
        border-radius: 999px;
        border: 3px solid var(--accent);
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.24);
        z-index: 2;
      }
      .limpae-pin::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -15px;
        width: 16px;
        height: 16px;
        margin-left: -8px;
        transform: rotate(45deg);
        background: #ffffff;
        border-right: 3px solid var(--accent);
        border-bottom: 3px solid var(--accent);
        box-sizing: border-box;
      }
      .limpae-pin img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .limpae-popup strong {
        display: block;
        margin-bottom: 4px;
        color: #111827;
      }
      .limpae-popup span {
        display: block;
        color: #475569;
        font-size: 12px;
        line-height: 16px;
      }
      @keyframes pulse {
        0% { transform: scale(0.92); opacity: 0.55; }
        100% { transform: scale(1.65); opacity: 0; }
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const markers = ${markerJson};
      const fallbackCenter = markers[0] || { latitude: -12.9777, longitude: -38.5016 };
      const map = L.map("map", { zoomControl: true }).setView(
        [fallbackCenter.latitude, fallbackCenter.longitude],
        markers.length > 1 ? 13 : 15
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19
      }).addTo(map);

      const leafletMarkers = markers.map((marker) => {
        const icon = L.divIcon({
          className: "",
          html: \`
            <div class="limpae-pin-shell" style="--accent:\${marker.accentColor}">
              <span class="limpae-pin-pulse"></span>
              <div class="limpae-pin">
                <img src="\${marker.photo}" alt="\${marker.name}" />
              </div>
            </div>
          \`,
          iconSize: [60, 74],
          iconAnchor: [30, 68],
          popupAnchor: [0, -54],
        });

        return L.marker([marker.latitude, marker.longitude], { icon })
          .addTo(map)
          .bindPopup(
            \`<div class="limpae-popup"><strong>\${marker.name}</strong><span>\${marker.label}</span><span>\${marker.statusText || ""}</span></div>\`
          );
      });

      if (leafletMarkers.length > 1) {
        const group = L.featureGroup(leafletMarkers);
        map.fitBounds(group.getBounds(), { padding: [32, 32] });
      }
    </script>
  </body>
</html>`;
};

export default function LiveLocationMapCanvas({ markers }) {
  const availableMarkers = useMemo(
    () =>
      Array.isArray(markers)
        ? markers.filter(
            (marker) => Number.isFinite(marker?.latitude) && Number.isFinite(marker?.longitude),
          )
        : [],
    [markers],
  );

  if (!availableMarkers.length) {
    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>Nenhuma localizacao disponivel</Text>
        <Text style={styles.emptyCopy}>
          Assim que a diarista compartilhar a posicao, ela aparece aqui.
        </Text>
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html: buildMapHtml(availableMarkers) }}
      style={styles.webview}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "#dbeafe",
  },
  emptyShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#dbeafe",
  },
  emptyTitle: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyCopy: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});

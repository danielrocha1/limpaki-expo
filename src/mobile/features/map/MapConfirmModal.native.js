import React, { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

const palette = {
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  border: "#d9dee8",
};

const buildMapHtml = ({ lat, lon }) => `<!DOCTYPE html>
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
      .limpae-home-pin {
        position: relative;
        width: 52px;
        height: 52px;
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
        border: 3px solid #2563eb;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.22);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .limpae-home-pin::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -14px;
        width: 16px;
        height: 16px;
        margin-left: -8px;
        transform: rotate(45deg);
        background: #ffffff;
        border-right: 3px solid #2563eb;
        border-bottom: 3px solid #2563eb;
        box-sizing: border-box;
      }
      .limpae-home-pin-house {
        position: relative;
        width: 22px;
        height: 16px;
        background: #2563eb;
        border-radius: 4px 4px 5px 5px;
        box-shadow: inset 0 -2px 0 rgba(255,255,255,0.14);
      }
      .limpae-home-pin-house::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -8px;
        width: 16px;
        height: 16px;
        margin-left: -8px;
        background: #2563eb;
        transform: rotate(45deg);
        border-radius: 3px;
      }
      .limpae-home-pin-house::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 6px;
        height: 9px;
        margin-left: -3px;
        background: #ffffff;
        border-radius: 2px 2px 0 0;
      }
      .limpae-home-pin-window {
        position: absolute;
        top: 3px;
        width: 4px;
        height: 4px;
        background: #bfdbfe;
        border-radius: 1px;
      }
      .limpae-home-pin-window.left {
        left: 4px;
      }
      .limpae-home-pin-window.right {
        right: 4px;
      }
      .limpae-map-hint {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 999;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18);
        color: #334155;
        font-size: 12px;
        line-height: 16px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="limpae-map-hint">Arraste o pin ou toque no mapa para marcar a localizacao exata da casa.</div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const initialCoords = {
        lat: Number(${JSON.stringify(Number(lat))}),
        lon: Number(${JSON.stringify(Number(lon))})
      };

      const postCoords = (payload) => {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "coords",
            latitude: payload.lat,
            longitude: payload.lon,
          }));
        }
      };

      const icon = L.divIcon({
        className: "",
        html: '<div class="limpae-home-pin"><div class="limpae-home-pin-house"><span class="limpae-home-pin-window left"></span><span class="limpae-home-pin-window right"></span></div></div>',
        iconSize: [52, 68],
        iconAnchor: [26, 62],
      });

      const map = L.map("map", {
        zoomControl: true,
        center: [initialCoords.lat, initialCoords.lon],
        zoom: 18,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialCoords.lat, initialCoords.lon], {
        draggable: true,
        icon,
      }).addTo(map);

      const syncCoords = (lat, lon) => {
        marker.setLatLng([lat, lon]);
        postCoords({ lat, lon });
      };

      marker.on("dragend", () => {
        const point = marker.getLatLng();
        syncCoords(point.lat, point.lng);
      });

      map.on("click", (event) => {
        syncCoords(event.latlng.lat, event.latlng.lng);
      });

      postCoords(initialCoords);
    </script>
  </body>
</html>`;

export default function MapConfirmModal({ visible, coords, onClose, onConfirm }) {
  const [localCoords, setLocalCoords] = useState(coords);
  const [initialMapCoords, setInitialMapCoords] = useState(coords);

  useEffect(() => {
    if (visible) {
      setLocalCoords(coords);
      setInitialMapCoords(coords);
    }
  }, [coords, visible]);

  const mapHtml = useMemo(() => {
    if (!initialMapCoords) {
      return "";
    }

    return buildMapHtml(initialMapCoords);
  }, [initialMapCoords]);

  if (!visible || !localCoords) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalPanel}>
          <View style={styles.inlineBetween}>
            <View style={styles.copyBlock}>
              <Text style={styles.modalTitle}>Confirme sua localizacao</Text>
              <Text style={styles.modalCopy}>
                Arraste o pin ou toque no ponto exato da casa para ajustar a marcacao.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.mapShell}>
            <WebView
              originWhitelist={["*"]}
              source={{ html: mapHtml }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              setSupportMultipleWindows={false}
              onMessage={(event) => {
                try {
                  const payload = JSON.parse(event.nativeEvent.data || "{}");
                  if (payload?.type === "coords") {
                    setLocalCoords({
                      lat: Number(payload.latitude),
                      lon: Number(payload.longitude),
                    });
                  }
                } catch (_error) {
                }
              }}
            />
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onConfirm({
                  latitude: Number(localCoords.lat),
                  longitude: Number(localCoords.lon),
                });
                onClose();
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Confirmar localizacao</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    justifyContent: "center",
    padding: 20,
  },
  modalPanel: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 16,
  },
  inlineBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  copyBlock: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  mapShell: {
    height: 360,
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#dbeafe",
  },
  webview: {
    flex: 1,
    backgroundColor: "#dbeafe",
  },
  modalButtons: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
});




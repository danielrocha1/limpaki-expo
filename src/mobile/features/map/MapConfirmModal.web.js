import React, { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const palette = {
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  border: "#d9dee8",
};

const leafletCss = `
.limpae-leaflet-map, .limpae-leaflet-map * { box-sizing: border-box; }
.limpae-leaflet-map { position: relative; overflow: hidden; }
.limpae-leaflet-map .leaflet-pane,
.limpae-leaflet-map .leaflet-tile,
.limpae-leaflet-map .leaflet-marker-icon,
.limpae-leaflet-map .leaflet-marker-shadow,
.limpae-leaflet-map .leaflet-tile-container,
.limpae-leaflet-map .leaflet-pane > svg,
.limpae-leaflet-map .leaflet-pane > canvas,
.limpae-leaflet-map .leaflet-zoom-box,
.limpae-leaflet-map .leaflet-image-layer,
.limpae-leaflet-map .leaflet-layer { position: absolute; left: 0; top: 0; }
.limpae-leaflet-map .leaflet-tile,
.limpae-leaflet-map .leaflet-marker-icon,
.limpae-leaflet-map .leaflet-marker-shadow { user-select: none; -webkit-user-drag: none; }
.limpae-leaflet-map .leaflet-pane { z-index: 400; }
.limpae-leaflet-map .leaflet-tile-pane { z-index: 200; }
.limpae-leaflet-map .leaflet-overlay-pane { z-index: 400; }
.limpae-leaflet-map .leaflet-shadow-pane { z-index: 500; }
.limpae-leaflet-map .leaflet-marker-pane { z-index: 600; }
.limpae-leaflet-map .leaflet-tooltip-pane { z-index: 650; }
.limpae-leaflet-map .leaflet-popup-pane { z-index: 700; }
.limpae-leaflet-map .leaflet-control { position: relative; z-index: 800; pointer-events: auto; }
.limpae-leaflet-map .leaflet-top,
.limpae-leaflet-map .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; }
.limpae-leaflet-map .leaflet-top { top: 0; }
.limpae-leaflet-map .leaflet-right { right: 0; }
.limpae-leaflet-map .leaflet-bottom { bottom: 0; }
.limpae-leaflet-map .leaflet-left { left: 0; }
.limpae-leaflet-map .leaflet-control-zoom { margin: 12px; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18); }
.limpae-leaflet-map .leaflet-control-zoom a { width: 34px; height: 34px; line-height: 34px; display: block; text-align: center; text-decoration: none; background: #fff; color: #1f2937; font-weight: 700; font-size: 18px; border-bottom: 1px solid #e5e7eb; }
.limpae-leaflet-map .leaflet-control-zoom a:last-child { border-bottom: none; }
.limpae-leaflet-map .leaflet-control-attribution { margin: 0 10px 10px 0; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,0.92); font-size: 11px; color: #475569; }
`;

function ensureLeafletCss() {
  if (typeof document === "undefined" || document.getElementById("limpae-leaflet-css")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "limpae-leaflet-css";
  style.textContent = leafletCss;
  document.head.appendChild(style);
}

export default function MapConfirmModal({ visible, coords, onClose, onConfirm }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [localCoords, setLocalCoords] = useState(coords);

  useEffect(() => {
    setLocalCoords(coords);
  }, [coords]);

  useEffect(() => {
    if (!visible || !localCoords || !mapRef.current || typeof window === "undefined") {
      return undefined;
    }

    let mounted = true;
    ensureLeafletCss();

    const boot = async () => {
      const leafletModule = await import("leaflet");
      const L = leafletModule.default || leafletModule;

      if (!mounted || !mapRef.current) {
        return;
      }

      if (mapRef.current.classList && !mapRef.current.classList.contains("limpae-leaflet-map")) {
        mapRef.current.classList.add("limpae-leaflet-map");
      }

      const icon = new L.Icon({
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          center: [localCoords.lat, localCoords.lon],
          zoom: 18,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        const marker = L.marker([localCoords.lat, localCoords.lon], {
          draggable: true,
          icon,
        }).addTo(map);

        marker.on("dragend", () => {
          const point = marker.getLatLng();
          setLocalCoords({ lat: point.lat, lon: point.lng });
        });

        map.on("click", (event) => {
          const { lat, lng } = event.latlng;
          marker.setLatLng([lat, lng]);
          setLocalCoords({ lat, lon: lng });
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } else {
        mapInstanceRef.current.setView([localCoords.lat, localCoords.lon], 18, { animate: false });
        markerRef.current?.setLatLng([localCoords.lat, localCoords.lon]);
      }

      window.setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
    };

    void boot();

    return () => {
      mounted = false;
    };
  }, [localCoords, visible]);

  useEffect(() => {
    if (!visible && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [visible]);

  if (!visible || !localCoords) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalPanel}>
          <View style={styles.inlineBetween}>
            <View style={styles.copyBlock}>
              <Text style={styles.modalTitle}>Confirme sua localização</Text>
              <Text style={styles.modalCopy}>
                Arraste o pin no mapa ou clique no ponto exato para ajustar sua localização.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View ref={mapRef} style={styles.mapShell} />

          <View style={styles.coordsCard}>
            <Text style={styles.coordsText}>Latitude: {Number(localCoords.lat).toFixed(6)}</Text>
            <Text style={styles.coordsText}>Longitude: {Number(localCoords.lon).toFixed(6)}</Text>
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
              <Text style={styles.primaryButtonText}>Confirmar localização</Text>
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
    height: 340,
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#e5e7eb",
  },
  coordsCard: {
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 14,
    gap: 6,
  },
  coordsText: {
    color: palette.ink,
    fontSize: 14,
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




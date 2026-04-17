import React from "react";
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const palette = {
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  border: "#d9dee8",
};

export default function MapConfirmModal({ visible, coords, onClose, onConfirm }) {
  if (!visible || !coords) {
    return null;
  }

  const mapUrl = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=18/${coords.lat}/${coords.lon}`;

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalPanel}>
          <View style={styles.inlineBetween}>
            <View style={styles.copyBlock}>
              <Text style={styles.modalTitle}>Confirme sua localização</Text>
              <Text style={styles.modalCopy}>
                No app nativo, por enquanto, abrimos o mapa externo para confirmação.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.coordsCard}>
            <Text style={styles.coordsText}>Latitude: {Number(coords.lat).toFixed(6)}</Text>
            <Text style={styles.coordsText}>Longitude: {Number(coords.lon).toFixed(6)}</Text>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={() => Linking.openURL(mapUrl)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Abrir mapa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onConfirm({
                  latitude: Number(coords.lat),
                  longitude: Number(coords.lon),
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

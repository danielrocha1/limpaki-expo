import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../../config/api";
import { styles } from "../AppShell.styles";

export default function EmailVerificationBanner({ visible, onSessionRefresh }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!visible) {
    return null;
  }

  const handleResend = async () => {
    try {
      setIsSubmitting(true);
      setFeedback("");

      const response = await apiFetch("/auth/email-verification/resend", {
        method: "POST",
        authenticated: true,
      });

      const data = await response.json().catch(() => ({}));
      setFeedback(
        data?.message ||
          data?.error ||
          "Nao foi possivel reenviar o e-mail agora.",
      );

      await onSessionRefresh?.();
    } catch (_error) {
      setFeedback("Nao foi possivel reenviar o e-mail agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.emailVerificationOverlay}>
        <View style={styles.emailVerificationBanner}>
          <View style={styles.emailVerificationCopy}>
            <Text style={styles.emailVerificationTitle}>Seu e-mail ainda nao foi confirmado.</Text>
            <Text style={styles.emailVerificationText}>
              Confirme para manter sua conta protegida e garantir que voce receba avisos importantes.
              Abra o link enviado para o seu e-mail ou reenvie abaixo.
            </Text>
          </View>

          <View style={styles.emailVerificationActions}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isSubmitting}
              onPress={handleResend}
              style={[
                styles.emailVerificationPrimaryButton,
                isSubmitting && styles.emailVerificationButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.emailVerificationPrimaryButtonText}>Reenviar e-mail</Text>
              )}
            </TouchableOpacity>
          </View>

          {feedback ? <Text style={styles.emailVerificationFeedback}>{feedback}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

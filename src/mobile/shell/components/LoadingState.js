import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { palette, styles } from "../AppShell.styles";

export default function LoadingState({ label = "Carregando..." }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={palette.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}


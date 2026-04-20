import React from "react";
import { Text, View } from "react-native";
import { styles } from "../AppShell.styles";

export default function EmptyState({ title, description }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateCopy}>{description}</Text>
    </View>
  );
}


import React from "react";
import { Text, View } from "react-native";
import { styles } from "../AppShell.styles";

export default function SectionCard({ title, children, right, style }) {
  return (
    <View style={[styles.sectionCard, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}


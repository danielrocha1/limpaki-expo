import React from "react";
import { ScrollView, Text } from "react-native";
import { styles } from "../AppShell.styles";
import SectionCard from "../components/SectionCard";

export default function SubscriptionScreen({ session }) {
  return (
    <ScrollView style={styles.screenScroll} contentContainerStyle={styles.screenContent}>
      <SectionCard title="Assinatura">
        <Text style={styles.primaryLine}>
          {session.hasValidSubscription || session.isTestUser ? "Acesso liberado" : "Acesso pendente"}
        </Text>
        <Text style={styles.secondaryLine}>
          {session.hasValidSubscription || session.isTestUser
            ? "Sua conta ja possui acesso premium liberado."
            : "Seu login foi concluido, mas ainda falta uma assinatura valida para liberar todo o fluxo."}
        </Text>
      </SectionCard>
    </ScrollView>
  );
}


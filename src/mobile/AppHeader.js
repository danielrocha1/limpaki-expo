import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const palette = {
  background: "#2f5fe0",
  border: "rgba(255, 255, 255, 0.10)",
  text: "rgba(255, 255, 255, 0.92)",
  accent: "#fbbf24",
  textDark: "#1f2937",
};

export const MOBILE_HEADER_HEIGHT = 64;

export default function AppHeader({
  session,
  activeAddressLabel,
  isAddressLoading,
  onLoginPress,
  onRegisterPress,
  onProfilePress,
  onLogoutPress,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuTitle = useMemo(() => {
    if (!session) return "";
    return session.role === "diarista" ? "Conta diarista" : "Conta cliente";
  }, [session]);

  const handleProfilePress = () => {
    setMenuOpen(false);
    onProfilePress?.();
  };

  const handleLogoutPress = () => {
    setMenuOpen(false);
    onLogoutPress?.();
  };

  return (
    <View style={styles.header}>
      <View style={styles.logoWrapper}>
        <Image
          source={require("../../public/limpae-logo.png")}
          resizeMode="contain"
          style={styles.logo}
        />
      </View>

      {session && session.role !== "diarista" ? (
        <View style={styles.headerCenterSlot}>
          <View style={styles.addressContainer}>
            <View style={styles.addressButton}>
              {isAddressLoading ? (
                <Text style={styles.addressText}>Carregando...</Text>
              ) : (
                <>
                  <Text numberOfLines={1} style={styles.addressText}>
                    {activeAddressLabel || "Selecione um endereco"}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#ffffff" />
                </>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {session ? (
        <View style={styles.menuWrapper}>
          <Pressable
            onPress={() => setMenuOpen((current) => !current)}
            style={({ hovered, pressed }) => [
              styles.menuTrigger,
              hovered && styles.menuTriggerHover,
              pressed && styles.menuTriggerPressed,
            ]}
          >
            <Feather name="user" size={16} color="#ffffff" />
            <Feather
              name={menuOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color="#ffffff"
            />
          </Pressable>

          {menuOpen ? (
            <View style={styles.menuPanel}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>{menuTitle}</Text>
                <Text style={styles.menuSubtitle}>
                  {session.emailVerified || session.isTestUser
                    ? "Conta ativa"
                    : "Confirmacao pendente"}
                </Text>
              </View>

              <Pressable
                onPress={handleProfilePress}
                style={({ hovered, pressed }) => [
                  styles.menuItem,
                  hovered && styles.menuItemHover,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <Feather name="user" size={15} color={palette.textDark} />
                <Text style={styles.menuItemText}>Meu perfil</Text>
              </Pressable>

              <Pressable
                onPress={handleLogoutPress}
                style={({ hovered, pressed }) => [
                  styles.menuItem,
                  hovered && styles.menuItemHover,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <Feather name="log-out" size={15} color="#dc2626" />
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.loginTextRow}>
          <Text style={styles.loginText}>Faca </Text>
          <Pressable
            onPress={onLoginPress}
            style={({ hovered }) => [
              styles.linkPressable,
              hovered && styles.linkPressableHover,
            ]}
          >
            {({ hovered }) => (
              <Text style={[styles.loginLink, hovered && styles.linkTextHover]}>
                Login
              </Text>
            )}
          </Pressable>
          <Text style={styles.loginText}> ou </Text>
          <Pressable
            onPress={onRegisterPress}
            style={({ hovered }) => [
              styles.linkPressable,
              hovered && styles.linkPressableHover,
            ]}
          >
            {({ hovered }) => (
              <Text style={[styles.registerLink, hovered && styles.linkTextHover]}>
                Registre-se
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: MOBILE_HEADER_HEIGHT,
    zIndex: 9999,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 0,
    paddingRight: 12,
    backgroundColor: palette.background,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  logoWrapper: {
    zIndex: 2,
    flexShrink: 0,
    marginLeft: -22,
  },
  logo: {
    width: 119,
    height: 45,
  },
  headerCenterSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 1,
  },
  addressContainer: {
    maxWidth: 170,
    width: "100%",
    paddingHorizontal: 12,
  },
  addressButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addressText: {
    flexShrink: 1,
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "500",
  },
  loginText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "500",
  },
  loginTextRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  linkPressable: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  linkPressableHover: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    transform: [{ translateY: -1 }],
  },
  loginLink: {
    color: palette.accent,
    fontWeight: "700",
  },
  registerLink: {
    color: palette.accent,
    fontWeight: "700",
  },
  linkTextHover: {
    color: "#ffffff",
  },
  menuWrapper: {
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 2,
  },
  menuTrigger: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  menuTriggerHover: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  menuTriggerPressed: {
    opacity: 0.92,
  },
  menuTriggerText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  menuPanel: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 182,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9dee8",
    padding: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  menuHeader: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f5",
    marginBottom: 4,
  },
  menuTitle: {
    color: palette.textDark,
    fontSize: 14,
    fontWeight: "800",
  },
  menuSubtitle: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  menuItemHover: {
    backgroundColor: "#f4f7fb",
  },
  menuItemPressed: {
    opacity: 0.85,
  },
  menuItemText: {
    color: palette.textDark,
    fontSize: 14,
    fontWeight: "700",
  },
  logoutText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
});

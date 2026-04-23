import React, { useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
  topInset = 0,
  session,
  addressOptions = [],
  activeAddressId = null,
  activeAddressLabel,
  isAddressLoading,
  onAddressSelect,
  onAddAddressPress,
  onLoginPress,
  onRegisterPress,
  onProfilePress,
  onLogoutPress,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addressMenuOpen, setAddressMenuOpen] = useState(false);

  const menuTitle = useMemo(() => {
    if (!session) return "";
    return session.role === "diarista" ? "Conta diarista" : "Conta cliente";
  }, [session]);

  const handleProfilePress = () => {
    setMenuOpen(false);
    setAddressMenuOpen(false);
    onProfilePress?.();
  };

  const handleLogoutPress = () => {
    setMenuOpen(false);
    setAddressMenuOpen(false);
    onLogoutPress?.();
  };

  const handleToggleAddressMenu = () => {
    setMenuOpen(false);
    setAddressMenuOpen((current) => !current);
  };

  const handleAddressSelect = (address) => {
    setAddressMenuOpen(false);
    onAddressSelect?.(address);
  };

  const handleAddAddressPress = () => {
    setAddressMenuOpen(false);
    onAddAddressPress?.();
  };

  return (
    <View
      style={[
        styles.header,
        {
          height: MOBILE_HEADER_HEIGHT + topInset,
          paddingTop: topInset,
        },
      ]}
    >
      <View style={styles.logoWrapper}>
        <Image
          source={require("../../../public/limpae-logo.png")}
          resizeMode="contain"
          style={styles.logo}
        />
      </View>

      {session ? (
        <View style={styles.headerCenterSlot}>
          <View style={styles.addressContainer}>
            <Pressable
              onPress={handleToggleAddressMenu}
              style={({ pressed }) => [styles.addressButton, pressed && styles.addressButtonPressed]}
            >
              {isAddressLoading ? (
                <Text style={styles.addressText}>Carregando...</Text>
              ) : (
                <>
                  <Text numberOfLines={1} style={styles.addressText}>
                    {activeAddressLabel || "Adicionar endereco"}
                  </Text>
                  <Feather
                    name={addressMenuOpen ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#ffffff"
                  />
                </>
              )}
            </Pressable>

            {addressMenuOpen ? (
              <View style={styles.addressMenuPanel}>
                {Array.isArray(addressOptions) && addressOptions.length > 0 ? (
                  addressOptions.map((address) => {
                    const addressId = address?.id || address?.ID || null;
                    const isActive = activeAddressId && addressId === activeAddressId;
                    const title =
                      [address?.street || address?.Street, address?.number || address?.Number]
                        .filter(Boolean)
                        .join(", ") ||
                      address?.neighborhood ||
                      address?.Neighborhood ||
                      "Endereco";
                    const subtitle =
                      [address?.neighborhood || address?.Neighborhood, address?.city || address?.City]
                        .filter(Boolean)
                        .join(" • ") || "Endereco cadastrado";

                    return (
                      <Pressable
                        key={addressId || title}
                        onPress={() => handleAddressSelect(address)}
                        style={({ pressed }) => [
                          styles.addressMenuItem,
                          isActive && styles.addressMenuItemActive,
                          pressed && styles.addressMenuItemPressed,
                        ]}
                      >
                        <View style={styles.addressMenuItemCopy}>
                          <Text
                            numberOfLines={1}
                            style={[styles.addressMenuItemTitle, isActive && styles.addressMenuItemTitleActive]}
                          >
                            {title}
                          </Text>
                          <Text numberOfLines={1} style={styles.addressMenuItemSubtitle}>
                            {subtitle}
                          </Text>
                        </View>
                        {isActive ? <Feather name="check" size={15} color="#2563eb" /> : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.addressEmptyState}>
                    <Text style={styles.addressEmptyStateText}>Nenhum endereco cadastrado.</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleAddAddressPress}
                  style={({ pressed }) => [
                    styles.addressAddButton,
                    pressed && styles.addressMenuItemPressed,
                  ]}
                >
                  <Feather name="plus" size={15} color="#2563eb" />
                  <Text style={styles.addressAddButtonText}>Adicionar endereco</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {session ? (
        <View style={styles.menuWrapper}>
          <Pressable
            onPress={() => {
              setAddressMenuOpen(false);
              setMenuOpen((current) => !current);
            }}
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
    position: Platform.OS === "web" ? "fixed" : "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
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
    marginLeft: -10,
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
    zIndex: 1,
  },
  addressContainer: {
    maxWidth: 170,
    width: "100%",
    paddingHorizontal: 12,
    marginTop: 40,
    zIndex: 3,
    position: "relative",
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
  addressButtonPressed: {
    opacity: 0.92,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  addressMenuPanel: {
    position: "absolute",
    top: 48,
    left: "50%",
    minWidth: 220,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9dee8",
    padding: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 20,
    transform: [{ translateX: -110 }],
  },
  addressMenuItem: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addressMenuItemActive: {
    backgroundColor: "#eff6ff",
  },
  addressMenuItemPressed: {
    opacity: 0.88,
  },
  addressMenuItemCopy: {
    flex: 1,
  },
  addressMenuItemTitle: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  addressMenuItemTitleActive: {
    color: "#2563eb",
  },
  addressMenuItemSubtitle: {
    color: "#6b7280",
    fontSize: 11,
  },
  addressEmptyState: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  addressEmptyStateText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
  },
  addressAddButton: {
    minHeight: 44,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addressAddButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
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





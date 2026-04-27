import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { palette, styles } from "../AppShell.styles";

const routeLabels = {
  map: "Diaristas",
  offers: "Ofertas",
  services: "Servicos",
  profile: "Perfil",
  subscription: "Assinatura",
};

const routeIcons = {
  map: "map-pin",
  offers: "tag",
  services: "list",
  profile: "user",
  subscription: "credit-card",
};

export default function MobileBottomNavigation({
  currentRoute,
  onNavigate,
  role,
  bottomOffset = 0,
  isPaywallActive = false,
  allowedRoutes = [],
}) {
  const routes = role === "diarista" ? ["offers", "services"] : ["map", "offers", "services"];
  const visibleRoutes = isPaywallActive
    ? routes.filter((route) => allowedRoutes.includes(route))
    : routes;

  return (
    <View style={[styles.bottomNavigation, { bottom: bottomOffset }]}>
      <View style={styles.bottomNavContainer}>
        {visibleRoutes.map((route) => {
          const active = route === currentRoute;
          const isDisabled = isPaywallActive && !allowedRoutes.includes(route);
          return (
            <TouchableOpacity
              key={route}
              onPress={() => !isDisabled && onNavigate(route)}
              disabled={isDisabled}
              style={[
                styles.navItem,
                active && styles.navItemActive,
                isDisabled && styles.navItemDisabled,
              ]}
            >
              <Feather
                name={routeIcons[route]}
                size={20}
                color={
                  isDisabled
                    ? "rgba(255,255,255,0.35)"
                    : active
                      ? palette.accentAlt
                      : "rgba(255,255,255,0.75)"
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  active && styles.navLabelActive,
                  isDisabled && styles.navLabelDisabled,
                ]}
              >
                {routeLabels[route]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}




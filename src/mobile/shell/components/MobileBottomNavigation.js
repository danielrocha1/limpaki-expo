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

export default function MobileBottomNavigation({ currentRoute, onNavigate, role, bottomOffset = 0 }) {
  const routes = role === "diarista" ? ["offers", "services"] : ["map", "offers", "services"];

  return (
    <View style={[styles.bottomNavigation, { bottom: bottomOffset }]}>
      <View style={styles.bottomNavContainer}>
        {routes.map((route) => {
          const active = route === currentRoute;
          return (
            <TouchableOpacity
              key={route}
              onPress={() => onNavigate(route)}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <Feather
                name={routeIcons[route]}
                size={20}
                color={active ? palette.accentAlt : "rgba(255,255,255,0.75)"}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {routeLabels[route]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}




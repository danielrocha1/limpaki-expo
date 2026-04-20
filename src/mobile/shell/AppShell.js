import React, { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_NAV_HEIGHT, styles } from "./AppShell.styles";
import MobileBottomNavigation from "./components/MobileBottomNavigation";
import MapScreen from "./screens/MapScreen";
import OffersScreen from "./screens/OffersScreen";
import ServicesScreen from "./screens/ServicesScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SubscriptionScreen from "./screens/SubscriptionScreen";
import { MobileChatCenterProvider } from "../MobileChatCenter";

export default function AppShell({ forcedRoute, session, onRouteChange, onSessionUpdate, onLogout }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? Math.max(insets.bottom, 0) : 0;
  const screenBottomPadding = BOTTOM_NAV_HEIGHT + bottomOffset + 8;

  const initialRoute = useMemo(() => {
    if (!session.emailVerified && !session.isTestUser) return "profile";
    if (!session.hasValidSubscription && !session.isTestUser) return "subscription";
    return session.role === "diarista" ? "offers" : "map";
  }, [session]);

  const [currentRoute, setCurrentRoute] = useState(initialRoute);

  useEffect(() => {
    setCurrentRoute(initialRoute);
  }, [initialRoute]);

  useEffect(() => {
    if (!forcedRoute) {
      return;
    }

    setCurrentRoute(forcedRoute);
  }, [forcedRoute]);

  useEffect(() => {
    onRouteChange?.(currentRoute);
  }, [currentRoute, onRouteChange]);

  let screen = null;
  switch (currentRoute) {
    case "map":
      screen = <MapScreen session={session} onSessionUpdate={onSessionUpdate} onLogout={onLogout} />;
      break;
    case "offers":
      screen = <OffersScreen session={session} onSessionUpdate={onSessionUpdate} onLogout={onLogout} />;
      break;
    case "services":
      screen = <ServicesScreen session={session} />;
      break;
    case "subscription":
      screen = <SubscriptionScreen session={session} />;
      break;
    case "profile":
    default:
      screen = <ProfileScreen session={session} />;
      break;
  }

  return (
    <MobileChatCenterProvider session={session}>
      <View style={styles.shell}>
        <View style={[styles.screenArea, { paddingBottom: screenBottomPadding }]}>{screen}</View>
        <MobileBottomNavigation
          currentRoute={currentRoute}
          onNavigate={setCurrentRoute}
          role={session.role}
          bottomOffset={bottomOffset}
        />
      </View>
    </MobileChatCenterProvider>
  );
}

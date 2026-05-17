import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_NAV_HEIGHT, styles } from "./AppShell.styles";
import EmailVerificationBanner from "./components/EmailVerificationBanner";
import MobileBottomNavigation from "./components/MobileBottomNavigation";
import MapScreen from "./screens/MapScreen";
import OffersScreen from "./screens/OffersScreen";
import ServicesScreen from "./screens/ServicesScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HelpScreen from "./screens/HelpScreen";
import SubscriptionScreen from "./screens/SubscriptionScreen";
import { MobileChatCenterProvider } from "../MobileChatCenter";
import { refreshSessionFlags } from "./utils/sessionUtils";

const ALLOWED_ROUTES_FOR_EMAIL_GATE = ["profile", "help"];
const ALLOWED_ROUTES_FOR_PAYWALL = ["subscription", "profile", "help"];

export default function AppShell({
  forcedRoute,
  profileIntent,
  session,
  onRouteChange,
  onSessionUpdate,
  onLogout,
  mpReturnHint,
  onConsumeMpReturnHint,
}) {
  const insets = useSafeAreaInsets();
  const bottomOffset = (Platform.OS === "ios" ? Math.max(insets.bottom, 0) : 0) + 5;
  const screenBottomPadding = BOTTOM_NAV_HEIGHT + bottomOffset + 8;

  const isEmailVerificationGateActive = !session.emailVerified;
  const isPaywallActive =
    session.emailVerified && !session.hasValidSubscription && !session.isTestUser;

  const initialRoute = useMemo(() => {
    if (isEmailVerificationGateActive) return "profile";
    if (isPaywallActive) return "subscription";
    return session.role === "diarista" ? "offers" : "map";
  }, [isEmailVerificationGateActive, isPaywallActive, session.role]);

  const allowedRoutes = isEmailVerificationGateActive
    ? ALLOWED_ROUTES_FOR_EMAIL_GATE
    : isPaywallActive
      ? ALLOWED_ROUTES_FOR_PAYWALL
      : null;

  const isNavigationRestricted = Boolean(allowedRoutes);
  const [currentRoute, setCurrentRoute] = useState(initialRoute);

  const navigateToDefaultRoute = useCallback(() => {
    const fallback = session.role === "diarista" ? "offers" : "map";
    setCurrentRoute(fallback);
    onRouteChange?.(fallback);
  }, [onRouteChange, session.role]);

  const navigateFromHelp = useCallback(() => {
    if (isEmailVerificationGateActive) {
      setCurrentRoute("profile");
      onRouteChange?.("profile");
      return;
    }

    if (isPaywallActive) {
      setCurrentRoute("subscription");
      onRouteChange?.("subscription");
      return;
    }

    navigateToDefaultRoute();
  }, [isEmailVerificationGateActive, isPaywallActive, navigateToDefaultRoute, onRouteChange]);

  const syncSessionFlags = useCallback(async () => {
    const nextSession = await refreshSessionFlags(session);
    onSessionUpdate?.(nextSession);
    return nextSession;
  }, [onSessionUpdate, session]);

  useEffect(() => {
    setCurrentRoute((route) => (route === initialRoute ? route : initialRoute));
  }, [initialRoute]);

  useEffect(() => {
    if (!forcedRoute) {
      return;
    }

    if (allowedRoutes && !allowedRoutes.includes(forcedRoute)) {
      return;
    }

    setCurrentRoute((route) => (route === forcedRoute ? route : forcedRoute));
  }, [allowedRoutes, forcedRoute]);

  useEffect(() => {
    if (!isEmailVerificationGateActive) {
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncSessionFlags();
      }
    });

    return () => subscription.remove();
  }, [isEmailVerificationGateActive, syncSessionFlags]);

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
      screen = (
        <SubscriptionScreen
          session={session}
          onSessionUpdate={onSessionUpdate}
          mpReturnHint={mpReturnHint}
          onConsumeMpReturnHint={onConsumeMpReturnHint}
          onAccessGranted={() => {
            setCurrentRoute("services");
          }}
        />
      );
      break;
    case "help":
      screen = <HelpScreen session={session} onBack={navigateFromHelp} />;
      break;
    case "profile":
    default:
      screen = (
        <ProfileScreen
          session={session}
          profileIntent={profileIntent}
          onSessionUpdate={onSessionUpdate}
        />
      );
      break;
  }

  return (
    <MobileChatCenterProvider session={session}>
      <View style={styles.shell}>
        <View style={[styles.screenArea, { paddingBottom: screenBottomPadding }]}>{screen}</View>
        <MobileBottomNavigation
          currentRoute={currentRoute}
          onNavigate={(route) => {
            if (allowedRoutes && !allowedRoutes.includes(route)) {
              return;
            }
            setCurrentRoute((current) => (current === route ? current : route));
          }}
          role={session.role}
          bottomOffset={bottomOffset}
          isPaywallActive={isNavigationRestricted}
          allowedRoutes={allowedRoutes || []}
        />
        <EmailVerificationBanner
          visible={isEmailVerificationGateActive}
          onSessionRefresh={syncSessionFlags}
        />
      </View>
    </MobileChatCenterProvider>
  );
}

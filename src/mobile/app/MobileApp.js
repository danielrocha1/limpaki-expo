import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader, { MOBILE_HEADER_HEIGHT } from "../layout/AppHeader";
import {
  apiFetch,
  buildApiPathUrl,
  buildApiUrl,
  clearToken,
  getToken,
  setToken,
} from "../../config/api";
import RegisterFlow from "../features/auth/RegisterFlow";
import AppShell from "../shell/AppShell";
import { formatAddress, normalizeAddress } from "../shell/utils/shellUtils";

const palette = {
  bgTop: "#2f5fe0",
  surface: "#ffffff",
  ink: "#1f2937",
  muted: "#6b7280",
  accent: "#2563eb",
  border: "#d9dee8",
  inputText: "#111827",
  placeholder: "#9ca3af",
};

function MobileAppContent() {
  const insets = useSafeAreaInsets();
  const headerHeight = MOBILE_HEADER_HEIGHT + insets.top;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrappingSession, setIsBootstrappingSession] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [session, setSession] = useState(null);
  const [appRoute, setAppRoute] = useState(null);
  const [profileIntent, setProfileIntent] = useState(null);
  const [addressOptions, setAddressOptions] = useState([]);
  const [activeAddressId, setActiveAddressId] = useState(null);
  const [activeAddressLabel, setActiveAddressLabel] = useState("");
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const shouldShowHeader = isBootstrappingSession || authMode !== "login";

  const resetSessionState = () => {
    setSession(null);
    setAppRoute(null);
    setProfileIntent(null);
    setAddressOptions([]);
    setActiveAddressId(null);
    setActiveAddressLabel("");
    setIsAddressLoading(false);
    setSuccessMessage("");
    setEmail("");
    setPassword("");
    setErrors({});
    setAuthMode("login");
  };

  const validateLoginForm = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = "E-mail e obrigatorio.";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      nextErrors.email = "E-mail invalido.";
    }

    if (!password) {
      nextErrors.password = "Senha e obrigatoria.";
    } else if (password.length < 4) {
      nextErrors.password = "A senha deve ter pelo menos 6 caracteres.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const getStoredToken = async () => {
    const currentToken = getToken();
    if (currentToken) {
      return currentToken;
    }

    if (Platform.OS !== "web") {
      const nativeToken = await AsyncStorage.getItem("token");
      return nativeToken || null;
    }

    return null;
  };

  const buildSessionFromToken = async (token) => {
    let nextMessage = "Login realizado com sucesso.";
    let nextSession = {
      token,
      role: "cliente",
      emailVerified: true,
      isTestUser: false,
      hasValidSubscription: false,
    };

    try {
      const roleResponse = await fetch(buildApiPathUrl("/users-role/"), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (roleResponse.ok) {
        const roleData = await roleResponse.json().catch(() => ({}));
        nextSession = {
          ...nextSession,
          role: roleData?.role || "cliente",
          emailVerified: Boolean(roleData?.email_verified),
          isTestUser: Boolean(roleData?.is_test_user),
        };

        if (!roleData?.email_verified && !roleData?.is_test_user) {
          nextMessage = "Login realizado. Sua conta ainda precisa confirmar o e-mail.";
        } else if (roleData?.role === "diarista") {
          nextMessage = "Login realizado como diarista.";
        } else {
          nextMessage = "Login realizado como cliente.";
        }
      }
    } catch (roleError) {
      console.error("Erro ao buscar papel do usuario:", roleError);
    }

    try {
      const subscriptionResponse = await fetch(
        buildApiPathUrl("/subscriptions/access-status"),
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json().catch(() => ({}));
        nextSession = {
          ...nextSession,
          hasValidSubscription: Boolean(subscriptionData?.has_valid_subscription),
          isTestUser: Boolean(subscriptionData?.is_test_user) || nextSession.isTestUser,
        };
      }
    } catch (subscriptionError) {
      console.error("Erro ao buscar status da assinatura:", subscriptionError);
    }

    return { nextMessage, nextSession };
  };

  const handleLogin = async () => {
    if (!validateLoginForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSuccessMessage("");

    try {
      const response = await fetch(buildApiUrl("/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.token) {
        throw new Error(data?.error || "Credenciais invalidas.");
      }

      await setToken(data.token);
      const { nextMessage, nextSession } = await buildSessionFromToken(data.token);

      setSuccessMessage(nextMessage);
      setSession(nextSession);
      setAppRoute(null);
      setAuthMode("app");
    } catch (error) {
      setErrors({ general: error.message || "Nao foi possivel entrar agora." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      setIsBootstrappingSession(true);

      try {
        const storedToken = await getStoredToken();

        if (!storedToken) {
          if (!cancelled) {
            setIsBootstrappingSession(false);
          }
          return;
        }

        const { nextSession } = await buildSessionFromToken(storedToken);

        if (!cancelled) {
          setSession(nextSession);
          setAuthMode("app");
        }
      } catch (_error) {
        await clearToken();

        if (!cancelled) {
          resetSessionState();
        }
      } finally {
        if (!cancelled) {
          setIsBootstrappingSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadActiveAddress = async () => {
      if (!session || authMode !== "app") {
        setActiveAddressLabel("");
        setIsAddressLoading(false);
        return;
      }

      setIsAddressLoading(true);

      try {
        const response = await apiFetch("/addresses", { authenticated: true });
        const data = response.ok ? await response.json().catch(() => []) : [];
        const addresses = (Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : [])
          .map((address) => normalizeAddress(address));
        const activeAddress =
          addresses.find((address) => address?.active || address?.Active) || addresses[0] || null;
        const label =
          formatAddress(activeAddress) ||
          activeAddress?.street ||
          activeAddress?.neighborhood ||
          activeAddress?.city ||
          "Adicionar endereco";

        if (!cancelled) {
          setAddressOptions(addresses);
          setActiveAddressId(activeAddress?.id || null);
          setActiveAddressLabel(label);
        }
      } catch (_error) {
        if (!cancelled) {
          setAddressOptions([]);
          setActiveAddressId(null);
          setActiveAddressLabel("Adicionar endereco");
        }
      } finally {
        if (!cancelled) {
          setIsAddressLoading(false);
        }
      }
    };

    void loadActiveAddress();

    return () => {
      cancelled = true;
    };
  }, [authMode, session]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" backgroundColor={palette.bgTop} />
      {shouldShowHeader ? (
        <AppHeader
          topInset={insets.top}
          session={session}
          addressOptions={addressOptions}
          activeAddressId={activeAddressId}
          activeAddressLabel={activeAddressLabel}
          isAddressLoading={isAddressLoading}
          onAddressSelect={(address) => {
            const normalizedAddress = normalizeAddress(address);
            setActiveAddressId(normalizedAddress?.id || null);
            setActiveAddressLabel(
              formatAddress(normalizedAddress) ||
                normalizedAddress?.street ||
                normalizedAddress?.neighborhood ||
                "Adicionar endereco",
            );
          }}
          onAddAddressPress={() => {
            if (!session) {
              return;
            }

            setAuthMode("app");
            setAppRoute("profile");
            setProfileIntent({
              section: "addresses",
              openAddressForm: !activeAddressLabel || activeAddressLabel === "Adicionar endereco",
              stamp: Date.now(),
            });
          }}
          onLoginPress={() => setAuthMode(session ? "app" : "login")}
          onRegisterPress={() => setAuthMode("register")}
          onProfilePress={() => {
            if (!session) {
              return;
            }
            setAuthMode("app");
            setAppRoute("profile");
            setProfileIntent({
              section: "personal",
              openAddressForm: false,
              stamp: Date.now(),
            });
          }}
          onLogoutPress={async () => {
            await clearToken();
            resetSessionState();
          }}
        />
      ) : null}
      <View
        style={StyleSheet.flatten([
          styles.container,
          { marginTop: shouldShowHeader ? headerHeight : 0 },
        ])}
      >
        {isBootstrappingSession ? (
          <View style={styles.bootSplash}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
        ) : authMode === "app" && session ? (
          <AppShell
            forcedRoute={appRoute}
            profileIntent={profileIntent}
            session={session}
            onSessionUpdate={setSession}
            onRouteChange={setAppRoute}
            onLogout={async () => {
              await clearToken();
              resetSessionState();
            }}
          />
        ) : authMode === "register" ? (
          <RegisterFlow
            onBackToLogin={() => setAuthMode("login")}
            onRegistrationSuccess={(message) => {
              setSuccessMessage(message);
              setAuthMode("login");
            }}
          />
        ) : (
          <View style={styles.authShell}>
            <View style={styles.authBrandBlock}>
              <Image
                source={require("../../../public/limpae-logo.png")}
                resizeMode="contain"
                style={styles.authLogo}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>Bem-vindo de volta!</Text>
                <Text style={styles.subtitle}>Faca login para acessar sua conta.</Text>
              </View>

              {errors.general ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{errors.general}</Text>
                </View>
              ) : null}

              {successMessage ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>{successMessage}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Digite seu e-mail"
                  placeholderTextColor={palette.placeholder}
                  style={[styles.input, errors.email && styles.inputError]}
                  value={email}
                  editable={!isLoading}
                />
                {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setPassword}
                  placeholder="Digite sua senha"
                  placeholderTextColor={palette.placeholder}
                  secureTextEntry
                  style={[styles.input, errors.password && styles.inputError]}
                  value={password}
                  editable={!isLoading}
                />
                {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={isLoading}
                onPress={handleLogin}
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Nao tem uma conta? <Text style={styles.footerLink}>Cadastre-se</Text>
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function MobileApp() {
  return (
    <SafeAreaProvider>
      <MobileAppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bgTop,
  },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    backgroundColor: palette.bgTop,
    overflow: Platform.OS === "web" ? "visible" : "hidden",
  },
  bootSplash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  authShell: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 24,
  },
  authBrandBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  authLogo: {
    width: 238,
    height: 96,
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 22,
    gap: 6,
  },
  title: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f2b8b5",
    borderRadius: 12,
    backgroundColor: "#fff1f1",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: "#c0392b",
    fontSize: 13,
    lineHeight: 18,
  },
  successBanner: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#b7e4c7",
    borderRadius: 12,
    backgroundColor: "#edfdf3",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successBannerText: {
    color: "#146c43",
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "#ffffff",
    color: palette.inputText,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#e57373",
  },
  fieldError: {
    color: "#c0392b",
    fontSize: 12,
    lineHeight: 16,
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: palette.accent,
    shadowColor: palette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  footer: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#edf0f5",
    alignItems: "center",
  },
  footerText: {
    color: palette.muted,
    fontSize: 13,
  },
  footerLink: {
    color: palette.accent,
    fontWeight: "700",
  },
});

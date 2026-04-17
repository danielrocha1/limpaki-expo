import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, clearToken, getToken } from "../config/api";

const AddressContext = createContext();

export const AddressProvider = ({ children }) => {
  const [address, setAddress] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState({});
  const [selectedDiarista, setSelectedDiarista] = useState({});
  const [userRole, setUserRole] = useState("cliente");
  const [emailVerified, setEmailVerified] = useState(true);
  const [isTestUser, setIsTestUser] = useState(false);
  const [Logged, setLogged] = useState(() => Boolean(getToken()));
  const [hasValidSubscription, setHasValidSubscription] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(() => Boolean(getToken()));
  const [addressLoading, setAddressLoading] = useState(false);
  const initializedTokenRef = useRef(null);

  const resetSessionState = useCallback(() => {
    initializedTokenRef.current = null;
    setLogged(false);
    setUserRole("cliente");
    setEmailVerified(true);
    setIsTestUser(false);
    setAddress([]);
    setSelectedAddress({});
    setSelectedDiarista({});
    setHasValidSubscription(false);
    setSessionLoading(false);
    setAddressLoading(false);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    resetSessionState();
  }, [resetSessionState]);

  const fetchUserRole = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return "cliente";
    }

    try {
      const response = await apiFetch("/users-role/", {
        authenticated: true,
        onUnauthorized: handleUnauthorized,
      });

      if (!response.ok) {
        return "cliente";
      }

      const data = await response.json();
      const nextRole = data?.role || "cliente";
      const nextEmailVerified = Boolean(data?.email_verified);
      const nextIsTestUser = Boolean(data?.is_test_user);
      setUserRole(nextRole);
      setEmailVerified(nextEmailVerified);
      setIsTestUser(nextIsTestUser);
      return nextRole;
    } catch (error) {
      console.error("Erro ao buscar papel do usuario:", error);
      return "cliente";
    }
  }, [handleUnauthorized]);

  const refreshAddresses = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setAddress([]);
      setSelectedAddress({});
      return [];
    }

    try {
      setAddressLoading(true);
      const response = await apiFetch("/addresses", {
        authenticated: true,
        onUnauthorized: handleUnauthorized,
      });

      if (response.status === 404) {
        setAddress([]);
        setSelectedAddress({});
        return [];
      }

      if (!response.ok) {
        return address;
      }

      const data = await response.json();
      const nextAddresses = Array.isArray(data) ? data : [];
      setAddress(nextAddresses);
      setSelectedAddress((currentSelectedAddress) => {
        const currentSelectedId = currentSelectedAddress?.ID ?? currentSelectedAddress?.id;
        const matchingAddress = nextAddresses.find((entry) => {
          const entryId = entry?.ID ?? entry?.id;
          return currentSelectedId && entryId === currentSelectedId;
        });

        if (matchingAddress) {
          return matchingAddress;
        }

        return nextAddresses[0] || {};
      });

      return nextAddresses;
    } catch (error) {
      console.error("Erro ao buscar enderecos:", error);
      return address;
    } finally {
      setAddressLoading(false);
    }
  }, [address, handleUnauthorized]);

  const refreshSubscriptionAccess = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setHasValidSubscription(false);
      return false;
    }

    try {
      const response = await apiFetch("/subscriptions/access-status", {
        authenticated: true,
        onUnauthorized: handleUnauthorized,
      });

      if (!response.ok) {
        setHasValidSubscription(false);
        return false;
      }

      const data = await response.json().catch(() => ({}));
      const nextHasValidSubscription = Boolean(data?.has_valid_subscription);
      const nextIsTestUser = Boolean(data?.is_test_user);
      setHasValidSubscription(nextHasValidSubscription);
      setIsTestUser(nextIsTestUser);
      return nextHasValidSubscription;
    } catch (error) {
      console.error("Erro ao buscar assinatura:", error);
      setHasValidSubscription(false);
      return false;
    }
  }, [handleUnauthorized]);

  const refreshSessionBootstrap = useCallback(
    async ({ force = false } = {}) => {
      const token = getToken();

      if (!token || !Logged) {
        initializedTokenRef.current = null;
        setSessionLoading(false);
        setAddressLoading(false);
        setHasValidSubscription(false);
        return;
      }

      if (!force && initializedTokenRef.current === token) {
        return;
      }

      initializedTokenRef.current = token;
      setSessionLoading(true);

      try {
        await Promise.all([
          fetchUserRole(),
          refreshSubscriptionAccess(),
          refreshAddresses(),
        ]);
      } finally {
        setSessionLoading(false);
      }
    },
    [Logged, fetchUserRole, refreshAddresses, refreshSubscriptionAccess]
  );

  useEffect(() => {
    const token = getToken();

    if (token && !Logged) {
      setLogged(true);
      return;
    }

    if (!token || !Logged) {
      initializedTokenRef.current = null;
      if (!token && Logged) {
        setLogged(false);
      }
      setUserRole("cliente");
      setEmailVerified(true);
      setIsTestUser(false);
      setAddress([]);
      setSelectedAddress({});
      setHasValidSubscription(false);
      setSessionLoading(false);
      setAddressLoading(false);
      return;
    }

    void refreshSessionBootstrap();
  }, [Logged, refreshSessionBootstrap]);

  const value = useMemo(
    () => ({
      address,
      setAddress,
      userRole,
      emailVerified,
      setEmailVerified,
      isTestUser,
      setIsTestUser,
      setUserRole,
      selectedAddress,
      setSelectedAddress,
      selectedDiarista,
      setSelectedDiarista,
      Logged,
      setLogged,
      hasValidSubscription,
      sessionLoading,
      addressLoading,
      refreshAddresses,
      refreshSessionBootstrap,
      refreshSubscriptionAccess,
      resetSessionState,
    }),
    [
      Logged,
      address,
      addressLoading,
      hasValidSubscription,
      refreshAddresses,
      refreshSessionBootstrap,
      refreshSubscriptionAccess,
      resetSessionState,
      selectedAddress,
      selectedDiarista,
      sessionLoading,
      userRole,
      emailVerified,
      isTestUser,
    ]
  );

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
};

export const useAddress = () => useContext(AddressContext);

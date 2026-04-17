import { useState, useEffect, useCallback, useRef } from 'react';
import { createAuthenticatedWebSocket } from '../../config/realtime';
import {
  API_CONFIG,
  ERROR_MESSAGES,
  SERVICE_STATUS,
} from '../constants';

const DEFAULT_PAGINATION = {
  page: 1,
  page_size: 6,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_previous: false,
};

const SERVICES_REALTIME_EVENTS = new Set(['service.updated']);

const getServiceId = (service) => Number(service?.ID ?? service?.id ?? 0);

const getStatusGroupFromStatus = (status) => {
  const normalizedStatus = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (
    normalizedStatus === SERVICE_STATUS.COMPLETED ||
    normalizedStatus === SERVICE_STATUS.CANCELLED
  ) {
    return 'history';
  }

  return 'active';
};

const mergeServicePayload = (currentService, nextService) => ({
  ...currentService,
  ...nextService,
  diarist: nextService?.diarist ?? currentService?.diarist,
  client: nextService?.client ?? currentService?.client,
  address: nextService?.address ?? currentService?.address,
  reviews: nextService?.reviews ?? currentService?.reviews,
});

export const useServices = (statusGroup = 'active', page = 1) => {
  const [services, setServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({
    serviceId: null,
    action: '',
  });
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const token = localStorage.getItem('token');
  const servicesCacheRef = useRef({});
  const activeRequestControllerRef = useRef(null);
  const prefetchingKeysRef = useRef(new Set());
  const realtimeRefreshTimeoutRef = useRef(null);
  const visibleSnapshotRef = useRef({
    key: '',
    services: [],
    pagination: DEFAULT_PAGINATION,
  });

  const getCacheKey = useCallback(
    (targetStatusGroup, targetPage) => `${targetStatusGroup}:${targetPage}`,
    []
  );

  const buildPagination = useCallback(
    (data, fallbackPage) => ({
      page: data?.pagination?.page ?? fallbackPage,
      page_size: data?.pagination?.page_size ?? 6,
      total_items: data?.pagination?.total_items ?? 0,
      total_pages: data?.pagination?.total_pages ?? 1,
      has_next: Boolean(data?.pagination?.has_next),
      has_previous: Boolean(data?.pagination?.has_previous),
    }),
    []
  );

  const setVisiblePayload = useCallback(
    (cacheKey, payload) => {
      setServices(payload.items);
      setPagination(payload.pagination);
      visibleSnapshotRef.current = {
        key: cacheKey,
        services: payload.items,
        pagination: payload.pagination,
      };
    },
    []
  );

  const readCachedPayload = useCallback(
    (targetStatusGroup, targetPage) =>
      servicesCacheRef.current[getCacheKey(targetStatusGroup, targetPage)] || null,
    [getCacheKey]
  );

  const storeCachedPayload = useCallback(
    (targetStatusGroup, targetPage, payload) => {
      servicesCacheRef.current[getCacheKey(targetStatusGroup, targetPage)] = payload;
    },
    [getCacheKey]
  );

  const requestServicesPayload = useCallback(
    async ({ targetStatusGroup, targetPage, signal }) => {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SERVICES}?status_group=${targetStatusGroup}&page=${targetPage}&page_size=6`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            items: [],
            pagination: {
              ...DEFAULT_PAGINATION,
              page: targetPage,
            },
          };
        }

        throw new Error(ERROR_MESSAGES.FETCH_SERVICES);
      }

      const data = await response.json();

      return {
        items: Array.isArray(data?.items) ? data.items : [],
        pagination: buildPagination(data, targetPage),
      };
    },
    [buildPagination, token]
  );

  const prefetchServicesPage = useCallback(
    async (targetStatusGroup, targetPage) => {
      if (!token) {
        return;
      }

      const cacheKey = getCacheKey(targetStatusGroup, targetPage);
      if (servicesCacheRef.current[cacheKey] || prefetchingKeysRef.current.has(cacheKey)) {
        return;
      }

      prefetchingKeysRef.current.add(cacheKey);

      try {
        const payload = await requestServicesPayload({
          targetStatusGroup,
          targetPage,
        });
        storeCachedPayload(targetStatusGroup, targetPage, payload);
      } catch (_error) {
        // Prefetch failures should not affect visible state.
      } finally {
        prefetchingKeysRef.current.delete(cacheKey);
      }
    },
    [getCacheKey, requestServicesPayload, storeCachedPayload, token]
  );

  const prefetchLikelyTargets = useCallback(
    (targetStatusGroup, targetPage, payload) => {
      const backgroundJobs = [];
      const alternateStatusGroup = targetStatusGroup === 'active' ? 'history' : 'active';

      backgroundJobs.push(prefetchServicesPage(alternateStatusGroup, 1));

      if (payload?.pagination?.has_next) {
        backgroundJobs.push(prefetchServicesPage(targetStatusGroup, targetPage + 1));
      }

      void Promise.allSettled(backgroundJobs);
    },
    [prefetchServicesPage]
  );

  const mutateCaches = useCallback(
    (updatedService) => {
      if (!updatedService) {
        return;
      }

      const serviceId = getServiceId(updatedService);
      if (!serviceId) {
        return;
      }

      const targetStatusGroup = getStatusGroupFromStatus(updatedService.status);
      let serviceFoundInCache = false;

      Object.entries(servicesCacheRef.current).forEach(([cacheKey, payload]) => {
        const [cacheStatusGroup] = cacheKey.split(':');
        let changed = false;
        let removedFromThisGroup = false;

        const nextItems = payload.items.flatMap((serviceItem) => {
          if (getServiceId(serviceItem) !== serviceId) {
            return [serviceItem];
          }

          serviceFoundInCache = true;
          changed = true;
          const mergedService = mergeServicePayload(serviceItem, updatedService);

          if (targetStatusGroup !== cacheStatusGroup) {
            removedFromThisGroup = true;
            return [];
          }

          return [mergedService];
        });

        if (!changed) {
          return;
        }

        const nextPagination = removedFromThisGroup
          ? {
              ...payload.pagination,
              total_items: Math.max(0, (payload.pagination?.total_items ?? nextItems.length) - 1),
            }
          : payload.pagination;

        servicesCacheRef.current[cacheKey] = {
          items: nextItems,
          pagination: nextPagination,
        };
      });

      const firstPageTargetKey = getCacheKey(targetStatusGroup, 1);
      const targetCache = servicesCacheRef.current[firstPageTargetKey];

      if (targetCache) {
        const alreadyInTargetCache = targetCache.items.some(
          (serviceItem) => getServiceId(serviceItem) === serviceId
        );

        if (!alreadyInTargetCache) {
          const nextItems = [updatedService, ...targetCache.items].slice(
            0,
            targetCache.pagination?.page_size ?? 6
          );

          servicesCacheRef.current[firstPageTargetKey] = {
            items: nextItems,
            pagination: {
              ...targetCache.pagination,
              total_items: serviceFoundInCache
                ? targetCache.pagination?.total_items ?? nextItems.length
                : (targetCache.pagination?.total_items ?? nextItems.length) + 1,
            },
          };
        }
      }

      const currentCacheKey = getCacheKey(statusGroup, page);
      const currentPayload = servicesCacheRef.current[currentCacheKey];

      if (currentPayload) {
        setVisiblePayload(currentCacheKey, currentPayload);
      }
    },
    [getCacheKey, page, setVisiblePayload, statusGroup]
  );

  const clearServicesCache = useCallback(() => {
    servicesCacheRef.current = {};
  }, []);

  const fetchServices = useCallback(
    async ({ force = false, background = false } = {}) => {
      const cacheKey = getCacheKey(statusGroup, page);
      const cachedPayload = readCachedPayload(statusGroup, page);
      const hasVisibleData = visibleSnapshotRef.current.services.length > 0;

      if (!token) {
        setError(ERROR_MESSAGES.UNAUTHORIZED);
        setInitialLoading(false);
        setIsRefreshing(false);
        setIsPaginating(false);
        return null;
      }

      if (!force && cachedPayload) {
        setVisiblePayload(cacheKey, cachedPayload);
        setError(null);
        setInitialLoading(false);
        setIsRefreshing(false);
        setIsPaginating(false);
        return cachedPayload;
      }

      if (background) {
        setIsRefreshing(true);
      } else if (hasVisibleData) {
        setIsPaginating(true);
      } else {
        setInitialLoading(true);
      }

      activeRequestControllerRef.current?.abort();
      const controller = new AbortController();
      activeRequestControllerRef.current = controller;

      try {
        const payload = await requestServicesPayload({
          targetStatusGroup: statusGroup,
          targetPage: page,
          signal: controller.signal,
        });

        storeCachedPayload(statusGroup, page, payload);
        setVisiblePayload(cacheKey, payload);
        setError(null);
        prefetchLikelyTargets(statusGroup, page, payload);
        return payload;
      } catch (err) {
        if (err.name === 'AbortError') {
          return null;
        }

        if (!hasVisibleData) {
          setError(err.message);
        }

        throw err;
      } finally {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null;
        }

        setInitialLoading(false);
        setIsRefreshing(false);
        setIsPaginating(false);
      }
    },
    [
      getCacheKey,
      page,
      prefetchLikelyTargets,
      readCachedPayload,
      requestServicesPayload,
      setVisiblePayload,
      statusGroup,
      storeCachedPayload,
      token,
    ]
  );

  const updateVisibleWithCacheThenRefresh = useCallback(() => {
    const cacheKey = getCacheKey(statusGroup, page);
    const cachedPayload = readCachedPayload(statusGroup, page);

    if (cachedPayload) {
      setVisiblePayload(cacheKey, cachedPayload);
      setInitialLoading(false);
      setIsPaginating(false);
      setError(null);
      void fetchServices({ force: true, background: true }).catch(() => {});
      return;
    }

    void fetchServices({ force: true }).catch(() => {});
  }, [fetchServices, getCacheKey, page, readCachedPayload, setVisiblePayload, statusGroup]);

  const updateServiceStatus = async (id, action, reason = '') => {
    setActionLoading({
      serviceId: id,
      action,
    });

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SERVICE_ACTION(id, action)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            action === 'cancel'
              ? { reason: String(reason || '').trim() }
              : {}
          ),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || ERROR_MESSAGES.UPDATE_SERVICE(action));
      }

      const updatedServicePayload = await response.json();
      const updatedService = updatedServicePayload?.service || updatedServicePayload;

      mutateCaches(updatedService);
      return updatedService;
    } catch (err) {
      console.error(err.message);
      throw err;
    } finally {
      setActionLoading({
        serviceId: null,
        action: '',
      });
    }
  };

  const startServiceWithPin = async (id, pin) => {
    setActionLoading({
      serviceId: id,
      action: 'start-with-pin',
    });

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/services/${id}/start-with-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Erro ao iniciar o serviço.';

        if (response.status === 401) {
          throw new Error('PIN incorreto. Tente novamente.');
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      const updatedService = data.service || data;

      mutateCaches(updatedService);
      return updatedService;
    } catch (err) {
      console.error(err.message);
      throw err;
    } finally {
      setActionLoading({
        serviceId: null,
        action: '',
      });
    }
  };

  useEffect(() => {
    updateVisibleWithCacheThenRefresh();

    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, [updateVisibleWithCacheThenRefresh]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let isUnmounted = false;

    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
      }

      realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
        clearServicesCache();
        void fetchServices({ force: true, background: true }).catch(() => {});
      }, 150);
    };

    const connect = () => {
      if (isUnmounted) {
        return;
      }

      socket = createAuthenticatedWebSocket('/api/ws/offers');
      if (!socket) {
        return;
      }

      socket.onopen = () => {
        reconnectAttempts = 0;
        socket.send(JSON.stringify({ type: 'client.ping' }));
      };

      socket.onmessage = (event) => {
        try {
          const parsedEvent = JSON.parse(event.data);
          if (!SERVICES_REALTIME_EVENTS.has(parsedEvent?.type)) {
            return;
          }

          scheduleRealtimeRefresh();
        } catch (error) {
          console.error('Erro ao processar evento realtime de serviços:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('Erro na conexao realtime de serviços:', error);
        socket?.close();
      };

      socket.onclose = () => {
        if (isUnmounted) {
          return;
        }

        reconnectAttempts += 1;
        const retryDelay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 15000);
        reconnectTimer = window.setTimeout(connect, retryDelay);
      };
    };

    connect();

    return () => {
      isUnmounted = true;

      if (realtimeRefreshTimeoutRef.current) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close(1000, 'services-unmount');
      }
    };
  }, [clearServicesCache, fetchServices, token]);

  return {
    services,
    initialLoading,
    isRefreshing,
    isPaginating,
    error,
    pagination,
    actionLoading,
    updateServiceStatus,
    startServiceWithPin,
    clearServicesCache,
    refetchServices: () => fetchServices({ force: true, background: true }),
  };
};

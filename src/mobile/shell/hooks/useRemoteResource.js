import { useEffect, useState } from "react";

export default function useRemoteResource(loader, deps = []) {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    data: null,
  });

  const run = async (refreshing = false) => {
    setState((current) => {
      const nextLoading = refreshing ? current.loading : true;
      const nextRefreshing = refreshing;
      const nextError = current.error ? "" : current.error;

      if (
        current.loading === nextLoading &&
        current.refreshing === nextRefreshing &&
        current.error === nextError
      ) {
        return current;
      }

      return {
        ...current,
        loading: nextLoading,
        refreshing: nextRefreshing,
        error: nextError,
      };
    });

    try {
      const data = await loader();
      setState({
        loading: false,
        refreshing: false,
        error: "",
        data,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: error.message || "Nao foi possivel carregar os dados.",
      }));
    }
  };

  useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ...state,
    refresh: () => run(true),
  };
}

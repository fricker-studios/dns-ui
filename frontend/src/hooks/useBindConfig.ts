/**
 * React hooks for bind config API
 */

import { useState, useEffect } from "react";
import { api, ApiError } from "../api/client";
import type { BindConfig } from "../api/types";

export function useBindConfig() {
  const [config, setConfig] = useState<BindConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<BindConfig>("/config");
      setConfig(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to fetch configuration",
      );
      console.error("Error fetching config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, loading, error, refetch: fetchConfig };
}

export function useUpdateBindConfig() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = async (
    payload: BindConfig,
  ): Promise<BindConfig | null> => {
    try {
      setLoading(true);
      setError(null);
      const config = await api.put<BindConfig>("/config", payload);
      return config;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to update configuration";
      setError(message);
      console.error("Error updating config:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updateConfig, loading, error };
}

export function useReloadBindConfig() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadConfig = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await api.post("/config/reload", {});
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to reload configuration";
      setError(message);
      console.error("Error reloading config:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { reloadConfig, loading, error };
}

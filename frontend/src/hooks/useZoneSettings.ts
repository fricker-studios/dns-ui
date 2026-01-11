import { useState } from "react";
import type { ZoneDetail, ZoneSettingsUpdate } from "../types/zone-settings";
import { api } from "../api/client";

export function useZoneSettings(zoneName: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getZoneDetails = async (): Promise<ZoneDetail | null> => {
    if (!zoneName) return null;

    setLoading(true);
    setError(null);
    try {
      const encodedName = encodeURIComponent(zoneName.replace(/\.$/, ""));
      const response = await api.get<ZoneDetail>(`/zones/${encodedName}`);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateZoneSettings = async (
    settings: ZoneSettingsUpdate,
  ): Promise<ZoneDetail | null> => {
    if (!zoneName) return null;

    setLoading(true);
    setError(null);
    try {
      const encodedName = encodeURIComponent(zoneName.replace(/\.$/, ""));
      const response = await api.put<ZoneDetail>(
        `/zones/${encodedName}`,
        settings,
      );
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteZone = async (): Promise<boolean> => {
    if (!zoneName) return false;

    setLoading(true);
    setError(null);
    try {
      const encodedName = encodeURIComponent(zoneName.replace(/\.$/, ""));
      await api.delete(`/zones/${encodedName}`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    getZoneDetails,
    updateZoneSettings,
    deleteZone,
    loading,
    error,
  };
}

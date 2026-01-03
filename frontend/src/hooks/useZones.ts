/**
 * React hooks for zones API
 */

import { useState, useEffect } from "react";
import { zonesApi, type ApiZone, type ApiZoneCreate, ApiError } from "../api";

export function useZones() {
  const [zones, setZones] = useState<ApiZone[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await zonesApi.list();
      setZones(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch zones");
      console.error("Error fetching zones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  return { zones, loading, error, refetch: fetchZones };
}

export function useCreateZone() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createZone = async (payload: ApiZoneCreate): Promise<ApiZone | null> => {
    try {
      setLoading(true);
      setError(null);
      const zone = await zonesApi.create(payload);
      return zone;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create zone";
      setError(message);
      console.error("Error creating zone:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createZone, loading, error };
}

export function useDeleteZone() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteZone = async (zoneName: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await zonesApi.delete(zoneName);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete zone";
      setError(message);
      console.error("Error deleting zone:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteZone, loading, error };
}

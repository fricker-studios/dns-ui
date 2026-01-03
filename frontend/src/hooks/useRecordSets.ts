/**
 * React hooks for recordsets API
 */

import { useState, useEffect } from "react";
import { recordsetsApi, type ApiRecordSet, ApiError } from "../api";

export function useRecordSets(zoneName: string | null) {
  const [recordsets, setRecordsets] = useState<ApiRecordSet[] | null>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordSets = async () => {
    if (!zoneName) {
      setRecordsets([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await recordsetsApi.list(zoneName);
      setRecordsets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch recordsets");
      console.error("Error fetching recordsets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneName]);

  return { recordsets, loading, error, refetch: fetchRecordSets };
}

export function useReplaceRecordSets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replaceRecordSets = async (
    zoneName: string,
    recordsets: ApiRecordSet[]
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await recordsetsApi.replace(zoneName, recordsets);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update recordsets";
      setError(message);
      console.error("Error updating recordsets:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { replaceRecordSets, loading, error };
}

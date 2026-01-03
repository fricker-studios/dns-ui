/**
 * React hooks for exports API
 */

import { useState } from "react";
import { exportsApi, type ApiZoneFileExport, type ApiRecordSetsExport, ApiError } from "../api";

export function useZoneFileExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportZoneFile = async (zoneName: string): Promise<ApiZoneFileExport | null> => {
    try {
      setLoading(true);
      setError(null);
      const data = await exportsApi.zoneFile(zoneName);
      return data;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to export zone file";
      setError(message);
      console.error("Error exporting zone file:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { exportZoneFile, loading, error };
}

export function useRecordSetsExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportRecordSets = async (zoneName: string): Promise<ApiRecordSetsExport | null> => {
    try {
      setLoading(true);
      setError(null);
      const data = await exportsApi.recordsets(zoneName);
      return data;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to export recordsets";
      setError(message);
      console.error("Error exporting recordsets:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { exportRecordSets, loading, error };
}

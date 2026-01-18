/**
 * React hooks for recordsets API
 */

import { useState, useEffect } from "react";
import { recordsetsApi, type ApiRecordSet, type ApiPaginatedRecordSets, ApiError } from "../api";

export function useRecordSets(
  zoneName: string | null,
  page: number = 1,
  pageSize: number = 50
) {
  const [data, setData] = useState<ApiPaginatedRecordSets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordSets = async () => {
    if (!zoneName) {
      setData({
        items: [],
        total: 0,
        page: 1,
        page_size: pageSize,
        total_pages: 0,
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await recordsetsApi.list(zoneName, page, pageSize);
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to fetch recordsets",
      );
      console.error("Error fetching recordsets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneName, page, pageSize]);

  return {
    recordsets: data?.items ?? [],
    pagination: data
      ? {
          total: data.total,
          page: data.page,
          pageSize: data.page_size,
          totalPages: data.total_pages,
        }
      : null,
    loading,
    error,
    refetch: fetchRecordSets,
  };
}

export function useReplaceRecordSets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replaceRecordSets = async (
    zoneName: string,
    recordsets: ApiRecordSet[],
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await recordsetsApi.replace(zoneName, recordsets);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update recordsets";
      setError(message);
      console.error("Error updating recordsets:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { replaceRecordSets, loading, error };
}

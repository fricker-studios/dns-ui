/**
 * RecordSets API endpoints
 */

import { api } from "./client";
import type { ApiRecordSet, ApiPaginatedRecordSets } from "./types";

export const recordsetsApi = {
  /**
   * List recordsets for a zone with pagination
   */
  list: (zoneName: string, page: number = 1, pageSize: number = 50) => {
    const encoded = encodeURIComponent(zoneName);
    return api.get<ApiPaginatedRecordSets>(
      `/zones/${encoded}/recordsets?page=${page}&page_size=${pageSize}`
    );
  },

  /**
   * Replace all recordsets for a zone
   */
  replace: (zoneName: string, recordsets: ApiRecordSet[]) => {
    const encoded = encodeURIComponent(zoneName);
    return api.put<{ ok: boolean; count: number }>(
      `/zones/${encoded}/recordsets`,
      recordsets,
    );
  },
};

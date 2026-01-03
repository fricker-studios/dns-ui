/**
 * RecordSets API endpoints
 */

import { api } from "./client";
import type { ApiRecordSet } from "./types";

export const recordsetsApi = {
  /**
   * List all recordsets for a zone
   */
  list: (zoneName: string) => {
    const encoded = encodeURIComponent(zoneName);
    return api.get<ApiRecordSet[]>(`/zones/${encoded}/recordsets`);
  },

  /**
   * Replace all recordsets for a zone
   */
  replace: (zoneName: string, recordsets: ApiRecordSet[]) => {
    const encoded = encodeURIComponent(zoneName);
    return api.put<{ ok: boolean; count: number }>(
      `/zones/${encoded}/recordsets`,
      recordsets
    );
  },
};

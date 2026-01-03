/**
 * Exports API endpoints
 */

import { api } from "./client";
import type { ApiZoneFileExport, ApiRecordSetsExport } from "./types";

export const exportsApi = {
  /**
   * Export zone file as text
   */
  zoneFile: (zoneName: string) => {
    const encoded = encodeURIComponent(zoneName);
    return api.get<ApiZoneFileExport>(`/zones/${encoded}/exports/zonefile`);
  },

  /**
   * Export recordsets as JSON
   */
  recordsets: (zoneName: string) => {
    const encoded = encodeURIComponent(zoneName);
    return api.get<ApiRecordSetsExport>(`/zones/${encoded}/exports/recordsets`);
  },
};

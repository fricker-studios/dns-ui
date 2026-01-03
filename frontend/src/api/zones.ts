/**
 * Zones API endpoints
 */

import { api } from "./client";
import type { ApiZone, ApiZoneCreate } from "./types";

export const zonesApi = {
  /**
   * List all zones
   */
  list: () => api.get<ApiZone[]>("/zones"),

  /**
   * Create a new zone
   */
  create: (payload: ApiZoneCreate) => api.post<ApiZone>("/zones", payload),

  /**
   * Delete a zone
   */
  delete: (zoneName: string) => {
    const encoded = encodeURIComponent(zoneName);
    return api.delete<{ ok: boolean }>(`/zones/${encoded}`);
  },
};

/**
 * Type converters between API models and frontend models
 */

import type { Zone, RecordSet, RecordValue } from "../types/dns";
import type {
  ApiZone,
  ApiRecordSet,
  ApiRecordValue,
  ApiZoneCreate,
  ApiNameServer,
} from "../api/types";
import { uid, nowIso, normalizeFqdn } from "../lib/bind";

/**
 * Convert API zone to frontend zone
 */
export function apiZoneToZone(apiZone: ApiZone): Zone {
  return {
    id: uid(),
    name: apiZone.name,
    type: apiZone.type,
    comment: undefined,
    tags: [],
    createdAt: nowIso(),
    dnssecEnabled: false,
    defaultTtl: 300,
    allowTransferTo: [],
    notifyTargets: [],
    soa: {
      primaryNs: "ns1.example.com.",
      adminEmail: "hostmaster.example.com.",
      refresh: 3600,
      retry: 600,
      expire: 604800,
      minimum: 300,
    },
    nameServers: [],
  };
}

/**
 * Convert frontend zone to API zone create
 */
export function zoneToApiZoneCreate(
  zone: Partial<Zone>,
  nameservers: ApiNameServer[],
): ApiZoneCreate {
  return {
    name: normalizeFqdn(zone.name || ""),
    type: zone.type || "forward",
    default_ttl: zone.defaultTtl || 300,
    allow_transfer: zone.allowTransferTo || [],
    also_notify: zone.notifyTargets || [],
    primary_ns:
      zone.soa?.primaryNs || nameservers[0]?.hostname || "ns1.example.com.",
    nameservers: nameservers,
  };
}

/**
 * Convert API recordset to frontend recordset
 */
export function apiRecordSetToRecordSet(
  apiRs: ApiRecordSet,
  zoneId: string,
): RecordSet {
  return {
    id: uid(),
    zoneId,
    name: apiRs.name,
    type: apiRs.type,
    ttl: apiRs.ttl,
    values: apiRs.values.map(apiRecordValueToRecordValue),
    comment: apiRs.comment,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/**
 * Convert frontend recordset to API recordset
 */
export function recordSetToApiRecordSet(rs: RecordSet): ApiRecordSet {
  return {
    name: normalizeFqdn(rs.name),
    type: rs.type,
    ttl: rs.ttl,
    values: rs.values.map(recordValueToApiRecordValue),
    comment: rs.comment,
  };
}

/**
 * Convert API record value to frontend record value
 */
function apiRecordValueToRecordValue(apiValue: ApiRecordValue): RecordValue {
  return {
    id: uid(),
    value: apiValue.value,
    priority: apiValue.priority,
    weight: apiValue.weight,
    port: apiValue.port,
  };
}

/**
 * Convert frontend record value to API record value
 */
function recordValueToApiRecordValue(value: RecordValue): ApiRecordValue {
  const apiValue: ApiRecordValue = {
    value: value.value,
  };

  if (value.priority !== undefined) apiValue.priority = value.priority;
  if (value.weight !== undefined) apiValue.weight = value.weight;
  if (value.port !== undefined) apiValue.port = value.port;

  return apiValue;
}

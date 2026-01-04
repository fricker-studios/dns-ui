/**
 * API types matching backend models
 */

export type ZoneType = "public" | "private";
export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV" | "NS" | "PTR" | "CAA";

export interface ApiZone {
  name: string; // FQDN with trailing dot
  type: ZoneType;
  file_path: string;
  options: Record<string, any>;
}

export interface ApiNameServer {
  hostname: string;
  ipv4: string;
}

export interface ApiZoneCreate {
  name: string;
  type?: ZoneType;
  default_ttl?: number;
  allow_transfer?: string[];
  also_notify?: string[];
  primary_ns: string;
  nameservers?: ApiNameServer[];
}

export interface ApiRecordValue {
  value: string;
  priority?: number;
  weight?: number;
  port?: number;
}

export interface ApiRecordSet {
  name: string; // FQDN with trailing dot
  type: RecordType;
  ttl?: number;
  values: ApiRecordValue[];
  comment?: string;
}

export interface ApiZoneFileExport {
  zone: string;
  text: string;
}

export interface ApiRecordSetsExport {
  zone: string;
  recordsets: ApiRecordSet[];
}

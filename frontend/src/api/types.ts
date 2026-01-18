/**
 * API types matching backend models
 */

import type { RecordType, ZoneType } from "../types/dns";

export interface ApiZone {
  name: string; // FQDN with trailing dot
  type: ZoneType;
  role?: "primary" | "secondary";
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
  role?: "primary" | "secondary";
  default_ttl?: number;
  allow_transfer?: string[];
  also_notify?: string[];
  primary_ns?: string;
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

export interface ApiPaginatedRecordSets {
  items: ApiRecordSet[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiZoneFileExport {
  zone: string;
  text: string;
}

export interface ApiRecordSetsExport {
  zone: string;
  recordsets: ApiRecordSet[];
}

export interface BindConfig {
  directory?: string;
  forwarders?: string[];
  recursion?: boolean;
  dnssec_validation?: string;
  listen_on?: string;
  listen_on_v6?: string;
  acls?: Record<string, string[]>;
  allow_query?: string[];
  allow_transfer?: string[];
  server_role?: "primary" | "secondary" | "both";
  primary_servers?: string[];
  transfer_source?: string;
}

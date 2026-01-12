import type { ZoneType } from "./dns";

export interface SOA {
  primary_ns: string;
  admin_email: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minimum: number;
}

export interface ZoneDetail {
  name: string;
  type: ZoneType;
  role?: "primary" | "secondary";
  file_path: string;
  options: Record<string, unknown>;
  default_ttl: number;
  soa: SOA | null;
  allow_transfer: string[];
  also_notify: string[];
}

export interface ZoneSettingsUpdate {
  default_ttl?: number;
  soa_refresh?: number;
  soa_retry?: number;
  soa_expire?: number;
  soa_minimum?: number;
  allow_transfer?: string[];
  also_notify?: string[];
}

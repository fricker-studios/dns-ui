import type { ApiNameServer } from "../api/types";

export type ZoneType = "forward" | "reverse";
export type RecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "TXT"
  | "SRV"
  | "NS"
  | "PTR"
  | "CAA";

export type Zone = {
  id: string;
  name: string; // FQDN ending with '.'
  type: ZoneType;
  role?: "primary" | "secondary";
  comment?: string;
  tags: string[];
  createdAt: string;

  dnssecEnabled: boolean;
  defaultTtl: number;

  // BIND-ish knobs
  allowTransferTo: string[];
  notifyTargets: string[];

  soa: {
    primaryNs: string; // ns1.example.com.
    adminEmail: string; // hostmaster.example.com.
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
  };

  // authoritative NS list for the zone
  nameServers: ApiNameServer[];
};

export type RecordValue = {
  id: string;
  value: string;
  priority?: number; // MX/SRV
  weight?: number; // SRV
  port?: number; // SRV
};

export type RecordSet = {
  id: string;
  zoneId: string;
  name: string; // FQDN ending with '.'
  type: RecordType;
  ttl?: number;
  values: RecordValue[];
  comment?: string;

  routing?: {
    policy: "simple" | "weighted" | "failover";
    weight?: number;
  };

  createdAt: string;
  updatedAt: string;
};

export type ChangeRequest = {
  id: string;
  zoneId: string;
  status: "PENDING" | "APPLIED" | "FAILED";
  summary: string;
  submittedAt: string;
  appliedAt?: string;
  details: string[];
};

export type AuditEvent = {
  id: string;
  zoneId: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

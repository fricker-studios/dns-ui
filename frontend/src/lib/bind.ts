import type { RecordSet, RecordType, Zone } from "../types/dns";

export const uid = () =>
  Math.random().toString(16).slice(2) + Date.now().toString(16);
export const nowIso = () => new Date().toISOString();

export function normalizeFqdn(s: string) {
  const t = s.trim();
  if (!t) return "";
  return t.endsWith(".") ? t : t + ".";
}

export function humanizeZoneName(z: string) {
  return z.endsWith(".") ? z.slice(0, -1) : z;
}

export function fqdnJoin(label: string, zoneName: string) {
  const z = normalizeFqdn(zoneName);
  const l = (label || "@").trim();
  if (l === "@" || l === "") return z;
  if (l.endsWith(".")) return l;
  return normalizeFqdn(`${l}.${z}`);
}

/**
 * Validate if a string is a valid IPv4 address
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * Validate if a string is a valid IPv6 address (basic check)
 */
function isValidIPv6(ip: string): boolean {
  // Basic IPv6 validation
  if (!ip.includes(":")) return false;
  const parts = ip.split(":");
  if (parts.length < 3 || parts.length > 8) return false;

  // Check for valid hex groups
  for (const part of parts) {
    if (part.length > 4) return false;
    if (part && !/^[0-9a-fA-F]+$/.test(part)) return false;
  }
  return true;
}

export function validateRecordInput(args: {
  type: RecordType;
  name: string;
  values: any[];
}) {
  const errors: string[] = [];
  if (!args.name.trim()) errors.push("Name is required.");
  if (!args.values.length) errors.push("At least one value is required.");

  for (const v of args.values) {
    const raw = String(v.value ?? "").trim();
    if (!raw) errors.push("Record value cannot be empty.");

    // Validate IPv4 addresses
    if (args.type === "A") {
      if (!isValidIPv4(raw)) {
        errors.push(
          `Invalid IPv4 address: "${raw}". Each octet must be 0-255.`,
        );
      }
    }

    // Validate IPv6 addresses
    if (args.type === "AAAA") {
      if (!isValidIPv6(raw)) {
        errors.push(`Invalid IPv6 address: "${raw}"`);
      }
    }

    const needsFqdn = ["CNAME", "NS", "PTR", "MX", "SRV"].includes(args.type);
    if (needsFqdn && !raw.endsWith("."))
      errors.push(`${args.type} targets should end in "." (FQDN).`);

    if (args.type === "MX" && (v.priority === undefined || v.priority === null))
      errors.push("MX requires priority.");
    if (args.type === "SRV") {
      if (
        v.priority === undefined ||
        v.weight === undefined ||
        v.port === undefined
      ) {
        errors.push("SRV requires priority, weight, and port.");
      }
    }
    if (args.type === "CAA" && !/^\d+\s+(issue|issuewild|iodef)\s+/.test(raw)) {
      errors.push('CAA should look like: 0 issue "letsencrypt.org"');
    }
  }
  return errors;
}

export function computeZoneFile(zone: Zone, recordsets: RecordSet[]) {
  const lines: string[] = [];
  lines.push(`$TTL ${zone.defaultTtl}`);
  lines.push(
    `@ IN SOA ${zone.soa.primaryNs} ${zone.soa.adminEmail} (`,
    `    2026010201 ; serial`,
    `    ${zone.soa.refresh} ; refresh`,
    `    ${zone.soa.retry} ; retry`,
    `    ${zone.soa.expire} ; expire`,
    `    ${zone.soa.minimum} ; minimum`,
    `)`,
  );

  for (const ns of zone.nameServers) lines.push(`@ IN NS ${ns}`);
  lines.push("");

  const sorted = [...recordsets].sort((a, b) =>
    (a.name + a.type).localeCompare(b.name + b.type),
  );

  for (const rs of sorted) {
    const owner =
      rs.name === zone.name
        ? "@"
        : rs.name.replace(zone.name, "").replace(/\.$/, "");
    const ttl = rs.ttl ?? zone.defaultTtl;

    for (const v of rs.values) {
      if (rs.type === "MX")
        lines.push(`${owner}\t${ttl}\tIN\tMX\t${v.priority ?? 10}\t${v.value}`);
      else if (rs.type === "SRV")
        lines.push(
          `${owner}\t${ttl}\tIN\tSRV\t${v.priority ?? 10}\t${v.weight ?? 5}\t${v.port ?? 443}\t${v.value}`,
        );
      else if (rs.type === "TXT") {
        const txt = String(v.value).startsWith('"') ? v.value : `"${v.value}"`;
        lines.push(`${owner}\t${ttl}\tIN\tTXT\t${txt}`);
      } else if (rs.type === "CAA")
        lines.push(`${owner}\t${ttl}\tIN\tCAA\t${v.value}`);
      else lines.push(`${owner}\t${ttl}\tIN\t${rs.type}\t${v.value}`);
    }
  }

  return lines.join("\n");
}

export function computeNamedConfSnippet(zone: Zone) {
  const zName = humanizeZoneName(zone.name);
  const file = `/etc/bind/zones/db.${zName}`;
  const allow = zone.allowTransferTo.length
    ? `allow-transfer { ${zone.allowTransferTo.join("; ")}; };`
    : "";
  const notify = zone.notifyTargets.length
    ? `also-notify { ${zone.notifyTargets.join("; ")}; };`
    : "";
  const dnssec = zone.dnssecEnabled
    ? `dnssec-policy default;`
    : `dnssec-validation no;`;

  return `// named.conf.local snippet
zone "${zName}" {
  type master;
  file "${file}";
  ${allow}
  ${notify}
  ${dnssec}
};`;
}

from __future__ import annotations

import os
import tempfile
import fcntl
from datetime import datetime, timezone

import dns.name
import dns.rdatatype
import dns.zone

from backend.models import NameServer, RecordSet, RecordValue, normalize_fqdn
from backend.settings import settings


def _lock_path(path: str):
    # lock a sidecar file to coordinate writers
    lock_path = path + ".lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o644)
    fcntl.flock(fd, fcntl.LOCK_EX)
    return fd


def read_zone_file(zone_name: str, zone_file: str) -> list[RecordSet]:
    """
    Parse an on-disk zone into recordsets.
    """
    origin = dns.name.from_text(zone_name)
    z = dns.zone.from_file(zone_file, origin=origin, relativize=False)

    recordsets: list[RecordSet] = []
    for name, node in z.nodes.items():
        fqdn = name.to_text()
        for rdataset in node.rdatasets:
            rtype = dns.rdatatype.to_text(rdataset.rdtype)
            if rtype == "SOA":
                continue  # UI can manage SOA separately later
            ttl = rdataset.ttl

            values: list[RecordValue] = []
            for rdata in rdataset:
                # rdata.to_text() gives canonical representation
                txt = rdata.to_text()
                if rtype == "MX":
                    # "10 mail.example.com."
                    parts = txt.split()
                    if len(parts) >= 2:
                        values.append(
                            RecordValue(
                                value=normalize_fqdn(parts[1]), priority=int(parts[0])
                            )
                        )
                    else:
                        values.append(RecordValue(value=txt))
                elif rtype == "SRV":
                    # "10 5 443 target.example.com."
                    parts = txt.split()
                    if len(parts) >= 4:
                        values.append(
                            RecordValue(
                                value=normalize_fqdn(parts[3]),
                                priority=int(parts[0]),
                                weight=int(parts[1]),
                                port=int(parts[2]),
                            )
                        )
                    else:
                        values.append(RecordValue(value=txt))
                else:
                    # For CNAME/NS/PTR prefer fqdn trailing dot, but don't enforce here
                    values.append(RecordValue(value=txt))

            recordsets.append(
                RecordSet(
                    name=fqdn,
                    type=rtype,  # type: ignore
                    ttl=ttl,
                    values=values,
                )
            )

    # sort stable
    recordsets.sort(key=lambda r: (r.name, r.type))
    return recordsets


def _bump_soa_serial(zone_text: str) -> str:
    """
    Basic serial bump: if it finds something like "YYYYMMDDNN", bump NN else set to today+01.
    This is intentionally simple. For best results, keep SOA in canonical format.
    """
    import re
    from datetime import datetime

    today = datetime.utcnow().strftime("%Y%m%d")
    # match a serial inside SOA parens
    m = re.search(r"(\b\d{10}\b)\s*;\s*serial", zone_text)
    if not m:
        return zone_text

    serial = m.group(1)
    if serial.startswith(today):
        nn = int(serial[-2:]) + 1
        new_serial = f"{today}{nn:02d}"
    else:
        new_serial = f"{today}01"

    return zone_text.replace(serial, new_serial, 1)


def write_zone_file(
    zone_name: str,
    zone_file: str,
    recordsets: list[RecordSet],
    default_ttl: int,
    primary_ns: str,
    nameservers: list[NameServer],
    serial: int | None = None,
) -> None:
    """
    Rewrite entire zone file (UI-managed style).
    Keeps a minimal SOA + NS. (You can expand later.)
    """
    serial = serial or int(datetime.now(timezone.utc).strftime("%Y%m%d01"))
    lines: list[str] = []
    lines.append(f"$TTL {default_ttl}")

    # Detect if this is a reverse zone
    is_reverse = ".in-addr.arpa" in zone_name or ".ip6.arpa" in zone_name

    # Minimal SOA (serial will be bumped on rewrite)
    # For reverse zones, use FQDN nameservers and get admin domain from first NS
    if is_reverse:
        # Nameservers should be FQDNs for reverse zones
        admin_domain = nameservers[0].hostname if nameservers else zone_name
        # Extract base domain from FQDN (e.g., ns1.example.com -> example.com)
        parts = admin_domain.rstrip(".").split(".")
        if len(parts) >= 2:
            admin_domain = ".".join(parts[-2:]) + "."
        else:
            admin_domain = zone_name
        lines.append(
            f"@ IN SOA {normalize_fqdn(nameservers[0].hostname)} hostmaster.{admin_domain} ("
        )
    else:
        # For forward zones, append hostname to zone name
        lines.append(f"@ IN SOA {primary_ns}.{zone_name} hostmaster.{zone_name} (")

    lines.append(f"    {serial} ; serial")
    lines.append("    3600 ; refresh")
    lines.append("    600 ; retry")
    lines.append("    1209600 ; expire")
    lines.append(f"    {default_ttl} ; minimum")
    lines.append(")")

    # Default NS records
    for ns in nameservers:
        if is_reverse:
            # Use FQDN for reverse zones
            lines.append(f"@ IN NS {normalize_fqdn(ns.hostname)}")
        else:
            # Append to zone name for forward zones
            lines.append(f"@ IN NS {ns.hostname}.{zone_name}")
    lines.append("")

    # A records for nameservers (only for forward zones)
    if not is_reverse:
        for ns in nameservers:
            lines.append(f"{ns.hostname} IN A {ns.ipv4}")
        lines.append("")

    # Records
    for rs in sorted(recordsets, key=lambda r: (r.name, r.type)):
        owner = (
            "@"
            if normalize_fqdn(rs.name) == normalize_fqdn(zone_name)
            else rs.name.replace(zone_name, "").rstrip(".")
        )
        ttl = rs.ttl or default_ttl

        for v in rs.values:
            if rs.type == "TXT":
                # Quote TXT if not already
                val = v.value
                if not (val.startswith('"') and val.endswith('"')):
                    val = f'"{val}"'
                lines.append(f"{owner}\t{ttl}\tIN\tTXT\t{val}")
            elif rs.type == "MX":
                pref = v.priority if v.priority is not None else 10
                lines.append(
                    f"{owner}\t{ttl}\tIN\tMX\t{pref}\t{normalize_fqdn(v.value)}"
                )
            elif rs.type == "SRV":
                pr = v.priority if v.priority is not None else 10
                w = v.weight if v.weight is not None else 5
                p = v.port if v.port is not None else 443
                lines.append(
                    f"{owner}\t{ttl}\tIN\tSRV\t{pr}\t{w}\t{p}\t{normalize_fqdn(v.value)}"
                )
            else:
                # CNAME/NS/PTR should usually be FQDN in zone text; enforce dot for those
                val = v.value
                if rs.type in ("CNAME", "NS", "PTR"):
                    val = normalize_fqdn(val)
                lines.append(f"{owner}\t{ttl}\tIN\t{rs.type}\t{val}")

    text = "\n".join(lines).rstrip() + "\n"
    if settings.auto_bump_serial:
        text = _bump_soa_serial(text)

    os.makedirs(os.path.dirname(zone_file), exist_ok=True)

    # lock + atomic replace
    lock_fd = _lock_path(zone_file)
    try:
        d = os.path.dirname(zone_file)
        with tempfile.NamedTemporaryFile("w", delete=False, dir=d) as tf:
            tf.write(text)
            tf.flush()
            os.fsync(tf.fileno())
            tmp = tf.name
        os.chmod(tmp, 0o644)
        os.replace(tmp, zone_file)
    finally:
        os.close(lock_fd)


def write_zone_recordsets(
    zone_name: str,
    zone_file: str,
    recordsets: list[RecordSet],
) -> None:
    """
    Update only the records in a zone file, leaving SOA and header intact.
    Reads the existing zone, preserves $TTL, SOA, and NS records, then replaces all other records.
    """
    # Read the existing zone file
    with open(zone_file, "r") as f:
        original_lines = f.readlines()

    # Extract header section (everything up to and including SOA)
    header_lines: list[str] = []
    soa_found = False
    in_soa = False
    default_ttl = 3600

    for line in original_lines:
        stripped = line.strip()

        # Capture $TTL
        if stripped.startswith("$TTL"):
            try:
                default_ttl = int(stripped.split()[1])
            except (IndexError, ValueError):
                pass
            header_lines.append(line)
            continue

        # Detect SOA start
        if "SOA" in line and not soa_found:
            in_soa = True
            header_lines.append(line)
            continue

        # If we're in SOA, keep appending until we find the closing paren
        if in_soa:
            header_lines.append(line)
            if ")" in line:
                in_soa = False
                soa_found = True
            continue

        # After SOA, keep NS records
        if soa_found and stripped and not stripped.startswith(";"):
            if (
                "\tNS\t" in line
                or "\tIN\tNS\t" in line
                or " NS " in line
                or " IN NS " in line
            ):
                header_lines.append(line)
            else:
                # Stop at first non-NS record after SOA
                break

    # Build new record lines
    record_lines: list[str] = []
    for rs in sorted(recordsets, key=lambda r: (r.name, r.type)):
        # Skip NS records since they're already preserved in the header
        if rs.type == "NS":
            continue

        owner = (
            "@"
            if normalize_fqdn(rs.name) == normalize_fqdn(zone_name)
            else rs.name.replace(zone_name, "").rstrip(".")
        )
        ttl = rs.ttl or default_ttl

        for v in rs.values:
            if rs.type == "TXT":
                val = v.value
                if not (val.startswith('"') and val.endswith('"')):
                    val = f'"{val}"'
                record_lines.append(f"{owner}\t{ttl}\tIN\tTXT\t{val}\n")
            elif rs.type == "MX":
                pref = v.priority if v.priority is not None else 10
                record_lines.append(
                    f"{owner}\t{ttl}\tIN\tMX\t{pref}\t{normalize_fqdn(v.value)}\n"
                )
            elif rs.type == "SRV":
                pr = v.priority if v.priority is not None else 10
                w = v.weight if v.weight is not None else 5
                p = v.port if v.port is not None else 443
                record_lines.append(
                    f"{owner}\t{ttl}\tIN\tSRV\t{pr}\t{w}\t{p}\t{normalize_fqdn(v.value)}\n"
                )
            else:
                val = v.value
                if rs.type in ("CNAME", "NS", "PTR"):
                    val = normalize_fqdn(val)
                record_lines.append(f"{owner}\t{ttl}\tIN\t{rs.type}\t{val}\n")

    # Combine header + records
    text = "".join(header_lines)
    if not text.endswith("\n\n"):
        text += "\n"
    text += "".join(record_lines)

    # Bump serial if configured
    if settings.auto_bump_serial:
        text = _bump_soa_serial(text)

    os.makedirs(os.path.dirname(zone_file), exist_ok=True)

    # lock + atomic replace
    lock_fd = _lock_path(zone_file)
    try:
        d = os.path.dirname(zone_file)
        with tempfile.NamedTemporaryFile("w", delete=False, dir=d) as tf:
            tf.write(text)
            tf.flush()
            os.fsync(tf.fileno())
            tmp = tf.name
        os.chmod(tmp, 0o644)
        os.replace(tmp, zone_file)
    finally:
        os.close(lock_fd)

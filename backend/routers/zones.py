from __future__ import annotations

import os
from fastapi import APIRouter, HTTPException

from backend.settings import settings
from backend.models import Zone, ZoneCreate, ZoneDetail, SOA, ZoneSettingsUpdate
from backend.bind_files import (
    read_managed_include,
    parse_managed_zones,
    upsert_zone_stanza,
    delete_zone_stanza,
    validate_named_conf,
    validate_zone,
    rndc_reconfig,
)
from backend.dns_zone import write_zone_file, read_zone_file
from backend.soa_parser import parse_soa_from_zone, parse_default_ttl

router = APIRouter(prefix="/zones", tags=["zones"])


@router.get("", response_model=list[Zone])
def list_zones():
    text = read_managed_include()
    zones = parse_managed_zones(text)
    out: list[Zone] = []
    for zname, stanza in zones.items():
        # Determine zone type based on name
        zone_type = (
            "reverse"
            if (".in-addr.arpa" in zname or ".ip6.arpa" in zname)
            else "forward"
        )
        out.append(
            Zone(name=zname, type=zone_type, file_path=stanza.file_path, options={})
        )
    return sorted(out, key=lambda z: z.name)


@router.get("/{zone_name}", response_model=ZoneDetail)
def get_zone(zone_name: str):
    """Get detailed zone information including SOA and TTL"""
    zone_name = zone_name.rstrip(".")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zone_name)
    if not stanza:
        raise HTTPException(404, "Zone not found")

    # Read zone file to get SOA and TTL
    try:
        with open(stanza.file_path, "r") as f:
            zone_text = f.read()
    except FileNotFoundError:
        raise HTTPException(404, "Zone file not found")

    soa = parse_soa_from_zone(zone_text)
    if not soa:
        raise HTTPException(500, "Could not parse SOA from zone file")

    default_ttl = parse_default_ttl(zone_text)

    # Determine zone type
    zone_type = (
        "reverse"
        if (".in-addr.arpa" in zone_name or ".ip6.arpa" in zone_name)
        else "forward"
    )

    return ZoneDetail(
        name=zone_name + ".",
        type=zone_type,
        file_path=stanza.file_path,
        options={},
        default_ttl=default_ttl,
        soa=soa,
        allow_transfer=stanza.allow_transfer,
        also_notify=stanza.also_notify,
    )


@router.post("", response_model=Zone)
def create_zone(payload: ZoneCreate):
    zone_name = payload.name  # already normalized in model
    zone_file = os.path.join(settings.managed_zone_dir, f"db.{zone_name.rstrip('.')}")
    # Create an empty zone file (with minimal SOA/NS)
    write_zone_file(
        zone_name,
        zone_file,
        recordsets=[],
        default_ttl=payload.default_ttl,
        primary_ns=payload.primary_ns,
        nameservers=payload.nameservers,
    )

    # Add/replace stanza in managed include
    upsert_zone_stanza(
        zone_name=zone_name.rstrip("."),  # BIND zone name does not require trailing dot
        file_path=zone_file,
        allow_transfer=payload.allow_transfer,
        also_notify=payload.also_notify,
    )

    # Validate config + zone, then reconfig to pick up the new stanza
    validate_named_conf()
    validate_zone(zone_name.rstrip("."), zone_file)
    rndc_reconfig()

    return Zone(name=zone_name, type=payload.type, file_path=zone_file, options={})


@router.put("/{zone_name}", response_model=ZoneDetail)
def update_zone_settings(zone_name: str, payload: ZoneSettingsUpdate):
    """Update zone settings (SOA timers, TTL, transfer settings)"""
    zone_name = zone_name.rstrip(".")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zone_name)
    if not stanza:
        raise HTTPException(404, "Zone not found")

    # Read current zone file
    try:
        with open(stanza.file_path, "r") as f:
            zone_text = f.read()
    except FileNotFoundError:
        raise HTTPException(404, "Zone file not found")

    # Update zone file with new settings
    lines = zone_text.split("\n")
    new_lines = []
    in_soa = False

    for line in lines:
        # Update $TTL
        if line.startswith("$TTL") and payload.default_ttl is not None:
            new_lines.append(f"$TTL {payload.default_ttl}")
        # Update SOA timers
        elif "refresh" in line and payload.soa_refresh is not None and in_soa:
            new_lines.append(f"    {payload.soa_refresh} ; refresh")
        elif "retry" in line and payload.soa_retry is not None and in_soa:
            new_lines.append(f"    {payload.soa_retry} ; retry")
        elif "expire" in line and payload.soa_expire is not None and in_soa:
            new_lines.append(f"    {payload.soa_expire} ; expire")
        elif "minimum" in line and payload.soa_minimum is not None and in_soa:
            new_lines.append(f"    {payload.soa_minimum} ; minimum")
        else:
            new_lines.append(line)

        # Track SOA block
        if "SOA" in line:
            in_soa = True
        if in_soa and ")" in line:
            in_soa = False

    # Write updated zone file
    updated_text = "\n".join(new_lines)
    with open(stanza.file_path, "w") as f:
        f.write(updated_text)

    # Update stanza if transfer settings changed
    if payload.allow_transfer is not None or payload.also_notify is not None:
        upsert_zone_stanza(
            zone_name=zone_name,
            file_path=stanza.file_path,
            allow_transfer=payload.allow_transfer or stanza.allow_transfer,
            also_notify=payload.also_notify or stanza.also_notify,
        )

    # Validate and reload
    validate_named_conf()
    validate_zone(zone_name, stanza.file_path)
    rndc_reconfig()

    # Return updated zone details
    return get_zone(zone_name)


@router.delete("/{zone_name}")
def delete_zone(zone_name: str):
    # accept with or without trailing dot
    zone_name = zone_name.rstrip(".")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zone_name)
    if not stanza:
        raise HTTPException(404, "Zone not found (managed)")

    # Remove stanza first
    delete_zone_stanza(zone_name)

    # Validate + reconfig
    validate_named_conf()
    rndc_reconfig()

    # Then remove the zone file
    try:
        os.remove(stanza.file_path)
    except FileNotFoundError:
        pass

    return {"ok": True}

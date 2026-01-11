from __future__ import annotations

import os
from fastapi import APIRouter, HTTPException

from backend.settings import settings
from backend.models import Zone, ZoneCreate
from backend.bind_files import (
    read_managed_include,
    parse_managed_zones,
    upsert_zone_stanza,
    delete_zone_stanza,
    validate_named_conf,
    validate_zone,
    rndc_reconfig,
)
from backend.dns_zone import write_zone_file

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
            else "public"
        )
        out.append(
            Zone(name=zname, type=zone_type, file_path=stanza.file_path, options={})
        )
    return sorted(out, key=lambda z: z.name)


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

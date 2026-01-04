from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models import RecordSet
from backend.bind_files import read_managed_include, parse_managed_zones, validate_zone, rndc_reload
from backend.dns_zone import read_zone_file, write_zone_recordsets
from backend.settings import settings

router = APIRouter(prefix="/zones/{zone_name}/recordsets", tags=["recordsets"])


def _resolve(zone_name: str):
    zn = zone_name.rstrip(".")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zn)
    if not stanza:
        raise HTTPException(404, "Zone not found (managed)")
    return zn + ".", stanza.file_path


@router.get("", response_model=list[RecordSet])
def list_recordsets(zone_name: str):
    zone_fqdn, zone_file = _resolve(zone_name)
    return read_zone_file(zone_fqdn, zone_file)


@router.put("")
def replace_recordsets(zone_name: str, recordsets: list[RecordSet]):
    """
    Replace ALL recordsets for a zone (rewrite file).
    This maps cleanly to file-backed zones.
    """
    zone_fqdn, zone_file = _resolve(zone_name)

    # Normalize: ensure all names are fqdn
    # (Your frontend should send fqdn already; keep it simple here)
    write_zone_recordsets(zone_fqdn, zone_file, recordsets)

    # Validate zone + reload it
    validate_zone(zone_fqdn.rstrip("."), zone_file)
    rndc_reload(zone_fqdn.rstrip("."))

    return {"ok": True, "count": len(recordsets)}

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.logging import getLogger
from backend.models import RecordSet

logger = getLogger()
from backend.bind_files import (
    read_managed_include,
    parse_managed_zones,
    validate_zone,
    rndc_reload,
)
from backend.dns_zone import read_zone_file, write_zone_recordsets
from backend.settings import settings

router = APIRouter(prefix="/zones/{zone_name}/recordsets", tags=["recordsets"])


def _resolve(zone_name: str):
    zn = zone_name.rstrip(".")
    logger.debug(f"Resolving zone: {zn}")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zn)
    if not stanza:
        logger.warning(f"Zone not found: {zn}")
        raise HTTPException(404, "Zone not found (managed)")
    
    # Check if this is a secondary zone
    is_secondary = "type slave" in stanza.raw or "type secondary" in stanza.raw
    logger.debug(f"Zone {zn} is {'secondary' if is_secondary else 'primary'}")
    
    return zn + ".", stanza.file_path, is_secondary


@router.get("", response_model=list[RecordSet])
def list_recordsets(zone_name: str):
    logger.info(f"Listing recordsets for zone: {zone_name}")
    zone_fqdn, zone_file, is_secondary = _resolve(zone_name)
    
    # For secondary zones, return empty list with a note
    # (we can't edit secondary zones, and the file is in binary format)
    if is_secondary:
        logger.info(f"Zone {zone_name} is secondary, returning empty recordsets")
        return []
    
    recordsets = read_zone_file(zone_fqdn, zone_file)
    logger.debug(f"Found {len(recordsets)} recordsets in zone {zone_name}")
    return recordsets


@router.put("")
def replace_recordsets(zone_name: str, recordsets: list[RecordSet]):
    """
    Replace ALL recordsets for a zone (rewrite file).
    This maps cleanly to file-backed zones.
    """
    zone_fqdn, zone_file, is_secondary = _resolve(zone_name)
    
    # Cannot edit secondary zones
    if is_secondary:
        raise HTTPException(400, "Cannot edit recordsets on secondary zones. Edit on the primary server.")

    # Normalize: ensure all names are fqdn
    # (Your frontend should send fqdn already; keep it simple here)
    write_zone_recordsets(zone_fqdn, zone_file, recordsets)

    # Validate zone + reload it
    validate_zone(zone_fqdn.rstrip("."), zone_file)
    rndc_reload(zone_fqdn.rstrip("."))

    return {"ok": True, "count": len(recordsets)}

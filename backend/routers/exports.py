from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.logging import getLogger
from backend.bind_files import read_managed_include, parse_managed_zones, build_zone_stanza

logger = getLogger()
from backend.dns_zone import read_zone_file

router = APIRouter(prefix="/zones/{zone_name}/exports", tags=["exports"])


def _resolve(zone_name: str):
    zn = zone_name.rstrip(".")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zn)
    if not stanza:
        raise HTTPException(404, "Zone not found (managed)")
    # Check if this is a secondary zone
    is_secondary = "type slave" in stanza.raw or "type secondary" in stanza.raw
    return zn + ".", stanza, is_secondary


@router.get("/zonefile")
def export_zone_file(zone_name: str):
    logger.info(f"Exporting zone file for {zone_name}")
    zone_fqdn, stanza, is_secondary = _resolve(zone_name)
    if is_secondary:
        logger.warning(f"Cannot export zone file for secondary zone {zone_name}")
        raise HTTPException(400, "Cannot export zone file for secondary zones (data is in binary format)")
    with open(stanza.file_path, "r") as f:
        content = f.read()
        logger.debug(f"Exported zone file for {zone_name}, size: {len(content)} bytes")
        return {"zone": zone_fqdn, "text": content}


@router.get("/stanza")
def export_zone_stanza(zone_name: str):
    """Export the named.conf zone stanza"""
    logger.info(f"Exporting zone stanza for {zone_name}")
    zone_fqdn, stanza, is_secondary = _resolve(zone_name)
    stanza_text = build_zone_stanza(
        zone_name=stanza.zone,
        file_path=stanza.file_path,
        allow_transfer=stanza.allow_transfer,
        also_notify=stanza.also_notify,
    )
    logger.debug(f"Exported stanza for {zone_name}, length: {len(stanza_text)} bytes")
    return {"zone": zone_fqdn, "text": stanza_text}


@router.get("/recordsets")
def export_recordsets(zone_name: str):
    logger.info(f"Exporting recordsets for zone: {zone_name}")
    zone_fqdn, stanza, is_secondary = _resolve(zone_name)
    if is_secondary:
        logger.info(f"Zone {zone_name} is secondary, returning empty recordsets")
        return {"zone": zone_fqdn, "recordsets": []}
    rs = read_zone_file(zone_fqdn, stanza.file_path)
    logger.debug(f"Exported {len(rs)} recordsets for {zone_name}")
    return {"zone": zone_fqdn, "recordsets": [r.model_dump() for r in rs]}

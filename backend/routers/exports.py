from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.bind_files import read_managed_include, parse_managed_zones, build_zone_stanza
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
    zone_fqdn, stanza, is_secondary = _resolve(zone_name)
    if is_secondary:
        raise HTTPException(400, "Cannot export zone file for secondary zones (data is in binary format)")
    with open(stanza.file_path, "r") as f:
        return {"zone": zone_fqdn, "text": f.read()}


@router.get("/stanza")
def export_zone_stanza(zone_name: str):
    """Export the named.conf zone stanza"""
    zone_fqdn, stanza, is_secondary = _resolve(zone_name)
    stanza_text = build_zone_stanza(
        zone_name=stanza.zone,
        file_path=stanza.file_path,
        allow_transfer=stanza.allow_transfer,
        also_notify=stanza.also_notify,
    )
    return {"zone": zone_fqdn, "text": stanza_text}


@router.get("/recordsets")
def export_recordsets(zone_name: str):
    zone_fqdn, stanza, is_secondary = _resolve(zone_name)
    if is_secondary:
        return {"zone": zone_fqdn, "recordsets": []}
    rs = read_zone_file(zone_fqdn, stanza.file_path)
    return {"zone": zone_fqdn, "recordsets": [r.model_dump() for r in rs]}

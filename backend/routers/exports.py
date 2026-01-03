from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.bind_files import read_managed_include, parse_managed_zones
from backend.dns_zone import read_zone_file

router = APIRouter(prefix="/zones/{zone_name}/exports", tags=["exports"])


def _resolve(zone_name: str):
    zn = zone_name.rstrip(".")
    text = read_managed_include()
    zones = parse_managed_zones(text)
    stanza = zones.get(zn)
    if not stanza:
        raise HTTPException(404, "Zone not found (managed)")
    return zn + ".", stanza.file_path


@router.get("/zonefile")
def export_zone_file(zone_name: str):
    zone_fqdn, zone_file = _resolve(zone_name)
    with open(zone_file, "r") as f:
        return {"zone": zone_fqdn, "text": f.read()}


@router.get("/recordsets")
def export_recordsets(zone_name: str):
    zone_fqdn, zone_file = _resolve(zone_name)
    rs = read_zone_file(zone_fqdn, zone_file)
    return {"zone": zone_fqdn, "recordsets": [r.model_dump() for r in rs]}

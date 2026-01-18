from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.logging import getLogger
from backend.models import RecordSet, PaginatedRecordSets

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


@router.get("", response_model=PaginatedRecordSets)
def list_recordsets(
    zone_name: str,
    page: int = 1,
    page_size: int = 50,
):
    logger.info(
        f"Listing recordsets for zone: {zone_name} (page={page}, page_size={page_size})"
    )
    zone_fqdn, zone_file, is_secondary = _resolve(zone_name)

    # For secondary zones, return empty paginated response
    # (we can't edit secondary zones, and the file is in binary format)
    if is_secondary:
        logger.info(f"Zone {zone_name} is secondary, returning empty recordsets")
        return PaginatedRecordSets(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0,
        )

    # Get all recordsets
    all_recordsets = read_zone_file(zone_fqdn, zone_file)
    total = len(all_recordsets)

    # Calculate pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_recordsets = all_recordsets[start_idx:end_idx]

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    logger.debug(
        f"Returning {len(paginated_recordsets)} of {total} recordsets "
        f"(page {page}/{total_pages})"
    )

    return PaginatedRecordSets(
        items=paginated_recordsets,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/batch")
def batch_upsert_recordsets(zone_name: str, recordsets: list[RecordSet]):
    """
    Add or update multiple recordsets at once.
    This merges the provided recordsets with existing ones.
    """
    zone_fqdn, zone_file, is_secondary = _resolve(zone_name)

    # Cannot edit secondary zones
    if is_secondary:
        raise HTTPException(
            400,
            "Cannot edit recordsets on secondary zones. Edit on the primary server.",
        )

    # Read existing recordsets
    existing = read_zone_file(zone_fqdn, zone_file)

    # Create a dict of existing recordsets by (name, type)
    existing_map = {(rs.name, rs.type): rs for rs in existing}

    # Merge: update existing or add new
    for rs in recordsets:
        key = (rs.name, rs.type)
        existing_map[key] = rs

    # Write back all recordsets
    all_recordsets = list(existing_map.values())
    write_zone_recordsets(zone_fqdn, zone_file, all_recordsets)

    # Validate zone + reload it
    validate_zone(zone_fqdn.rstrip("."), zone_file)
    rndc_reload(zone_fqdn.rstrip("."))

    return {"ok": True, "added": len(recordsets), "total": len(all_recordsets)}


@router.put("")
def replace_recordsets(zone_name: str, recordsets: list[RecordSet]):
    """
    Replace ALL recordsets for a zone (rewrite file).
    This maps cleanly to file-backed zones.
    """
    zone_fqdn, zone_file, is_secondary = _resolve(zone_name)

    # Cannot edit secondary zones
    if is_secondary:
        raise HTTPException(
            400,
            "Cannot edit recordsets on secondary zones. Edit on the primary server.",
        )

    # Normalize: ensure all names are fqdn
    # (Your frontend should send fqdn already; keep it simple here)
    write_zone_recordsets(zone_fqdn, zone_file, recordsets)

    # Validate zone + reload it
    validate_zone(zone_fqdn.rstrip("."), zone_file)
    rndc_reload(zone_fqdn.rstrip("."))

    return {"ok": True, "count": len(recordsets)}

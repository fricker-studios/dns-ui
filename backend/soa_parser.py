from __future__ import annotations

import re

from backend.models import SOA


def parse_soa_from_zone(zone_text: str) -> SOA | None:
    """
    Parse SOA record from zone file text.
    Returns None if SOA not found or can't be parsed.
    """
    # Match SOA record across multiple lines
    # Format: @ IN SOA primary_ns admin_email ( serial refresh retry expire minimum )
    pattern = r"@\s+IN\s+SOA\s+(\S+)\s+(\S+)\s+\(\s*(\d+)\s*;[^\n]*\n\s*(\d+)\s*;[^\n]*\n\s*(\d+)\s*;[^\n]*\n\s*(\d+)\s*;[^\n]*\n\s*(\d+)\s*;[^\n]*\n\s*\)"

    match = re.search(pattern, zone_text, re.MULTILINE | re.DOTALL)
    if not match:
        return None

    return SOA(
        primary_ns=match.group(1),
        admin_email=match.group(2),
        serial=int(match.group(3)),
        refresh=int(match.group(4)),
        retry=int(match.group(5)),
        expire=int(match.group(6)),
        minimum=int(match.group(7)),
    )


def parse_default_ttl(zone_text: str) -> int:
    """Extract $TTL value from zone file"""
    match = re.search(r"\$TTL\s+(\d+)", zone_text)
    return int(match.group(1)) if match else 300

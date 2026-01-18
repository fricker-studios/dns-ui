from __future__ import annotations

import os
import re
import tempfile
import fcntl
import subprocess
from dataclasses import dataclass
from typing import Dict, List, Tuple

from backend.settings import settings
from backend.logging import getLogger

logger = getLogger()


# More robust regex that handles nested braces
def parse_zone_stanza(text: str, start_pos: int = 0):
    """Parse a single zone stanza starting at start_pos, handling nested braces."""
    zone_match = re.match(r'zone\s+"([^"]+)"\s*\{', text[start_pos:])
    if not zone_match:
        return None

    zone_name = zone_match.group(1)
    brace_start = start_pos + zone_match.end() - 1  # Position of opening {

    # Count braces to find the matching closing brace
    brace_count = 1
    pos = brace_start + 1
    while pos < len(text) and brace_count > 0:
        if text[pos] == "{":
            brace_count += 1
        elif text[pos] == "}":
            brace_count -= 1
        pos += 1

    if brace_count != 0:
        return None  # Unmatched braces

    # Extract the full stanza
    stanza_end = pos + 1 if pos < len(text) and text[pos] == ";" else pos
    full_stanza = text[start_pos:stanza_end]
    body = text[brace_start + 1 : pos - 1]

    return {"zone": zone_name, "body": body, "raw": full_stanza, "end_pos": stanza_end}


ZONE_STANZA_RE = re.compile(r'zone\s+"(?P<zone>[^"]+)"\s*\{', re.MULTILINE)

FILE_RE = re.compile(r'file\s+"(?P<file>[^"]+)";')
TYPE_RE = re.compile(r"type\s+(?P<type>\w+);")


@dataclass
class ManagedZoneStanza:
    zone: str
    body: str
    file_path: str
    allow_transfer: list[str]
    also_notify: list[str]
    raw: str  # The full raw zone stanza text


def _atomic_write(path: str, content: str, mode: int = 0o644) -> None:
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)

    with tempfile.NamedTemporaryFile("w", delete=False, dir=directory) as tf:
        tf.write(content)
        tf.flush()
        os.fsync(tf.fileno())
        tmp = tf.name

    os.chmod(tmp, mode)
    os.replace(tmp, path)


def _lock_file(fd):
    fcntl.flock(fd, fcntl.LOCK_EX)


def require_managed_include_ready():
    if settings.require_managed_include_present:
        if not os.path.exists(settings.managed_include):
            raise FileNotFoundError(
                f"managed include missing: {settings.managed_include}"
            )
    if not os.path.exists(settings.managed_zone_dir):
        raise FileNotFoundError(f"zone dir missing: {settings.managed_zone_dir}")


def read_managed_include() -> str:
    require_managed_include_ready()
    with open(settings.managed_include, "r") as f:
        return f.read()


def parse_managed_zones(text: str) -> Dict[str, ManagedZoneStanza]:
    logger.debug("Parsing managed zones from include file")
    zones: Dict[str, ManagedZoneStanza] = {}

    pos = 0
    zone_count = 0
    while pos < len(text):
        stanza = parse_zone_stanza(text, pos)
        if not stanza:
            # Move forward to find next zone keyword
            next_zone = text.find("zone", pos + 1)
            if next_zone == -1:
                break
            pos = next_zone
            continue

        zone_count += 1
        zone = stanza["zone"]
        body = stanza["body"]
        raw = stanza["raw"]

        fmatch = FILE_RE.search(body)
        if not fmatch:
            pos = stanza["end_pos"]
            continue

        file_path = fmatch.group("file")

        # Parse allow-transfer and also-notify
        allow_transfer: list[str] = []
        also_notify: list[str] = []

        # Match: allow-transfer { ip1; ip2; };
        allow_match = re.search(r"allow-transfer\s*\{\s*([^}]+)\s*\}", body)
        if allow_match:
            entries = allow_match.group(1).strip()
            allow_transfer = [e.strip() for e in entries.split(";") if e.strip()]

        # Match: also-notify { ip1; ip2; };
        notify_match = re.search(r"also-notify\s*\{\s*([^}]+)\s*\}", body)
        if notify_match:
            entries = notify_match.group(1).strip()
            also_notify = [e.strip() for e in entries.split(";") if e.strip()]

        zones[zone] = ManagedZoneStanza(
            zone=zone,
            body=body,
            file_path=file_path,
            allow_transfer=allow_transfer,
            also_notify=also_notify,
            raw=raw,
        )
        pos = stanza["end_pos"]

    logger.debug(f"Parsed {zone_count} zones from managed include")
    return zones


def build_zone_stanza(
    zone_name: str,
    file_path: str,
    allow_transfer: List[str],
    also_notify: List[str],
    zone_role: str = "primary",
) -> str:
    if zone_role == "secondary":
        # Secondary zone stanza - references masters, not a local file
        # Note: BIND uses "slave" keyword for compatibility
        return (
            f'zone "{zone_name}" {{\n'
            f"  type slave;\n"
            f"  masters {{ primary-servers; }};\n"
            f'  file "{file_path}";\n'
            f"}};\n"
        )
    else:
        # Primary zone stanza
        allow = (
            f"allow-transfer {{ {'; '.join(allow_transfer)}; }};"
            if allow_transfer
            else ""
        )
        notify = f"also-notify {{ {'; '.join(also_notify)}; }};" if also_notify else ""
        return (
            f'zone "{zone_name}" {{\n'
            f"  type master;\n"
            f'  file "{file_path}";\n'
            f"  {allow}\n"
            f"  {notify}\n"
            f"}};\n"
        )


def upsert_zone_stanza(
    zone_name: str,
    file_path: str,
    allow_transfer: List[str],
    also_notify: List[str],
    zone_role: str = "primary",
) -> None:
    logger.debug(f"Upserting zone stanza for {zone_name} (role={zone_role})")
    require_managed_include_ready()

    # lock include file while editing
    with open(settings.managed_include, "r+") as f:
        _lock_file(f.fileno())
        text = f.read()
        zones = parse_managed_zones(text)

        stanza = build_zone_stanza(
            zone_name, file_path, allow_transfer, also_notify, zone_role
        )

        if zone_name in zones:
            # replace existing stanza
            def repl(match: re.Match):
                if match.group("zone").strip() == zone_name:
                    return stanza
                return match.group(0)

            new_text = ZONE_STANZA_RE.sub(repl, text)
        else:
            new_text = (text.rstrip() + "\n\n" + stanza).lstrip()

        f.seek(0)
        f.truncate(0)
        f.write(new_text)
        f.flush()
        os.fsync(f.fileno())


def delete_zone_stanza(zone_name: str) -> None:
    require_managed_include_ready()
    with open(settings.managed_include, "r+") as f:
        _lock_file(f.fileno())
        text = f.read()

        def repl(match: re.Match):
            if match.group("zone").strip() == zone_name:
                return ""
            return match.group(0)

        new_text = ZONE_STANZA_RE.sub(repl, text)
        new_text = re.sub(r"\n{3,}", "\n\n", new_text).strip() + "\n"

        f.seek(0)
        f.truncate(0)
        f.write(new_text)
        f.flush()
        os.fsync(f.fileno())


def run_cmd(args: list[str]) -> Tuple[int, str, str]:
    p = subprocess.run(args, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def validate_named_conf() -> None:
    logger.debug("Validating BIND configuration with named-checkconf")
    rc, out, err = run_cmd([settings.named_checkconf, settings.named_conf])
    if rc != 0:
        logger.error(f"named-checkconf failed: {err.strip() or out.strip()}")
        raise RuntimeError(f"named-checkconf failed: {err.strip() or out.strip()}")
    logger.debug("BIND configuration validation successful")


def validate_zone(zone_name: str, zone_file: str) -> None:
    logger.debug(f"Validating zone file {zone_file} for zone {zone_name}")
    rc, out, err = run_cmd([settings.named_checkzone, zone_name.rstrip("."), zone_file])
    if rc != 0:
        logger.error(
            f"named-checkzone failed for {zone_name}: {err.strip() or out.strip()}"
        )
        raise RuntimeError(f"named-checkzone failed: {err.strip() or out.strip()}")
    logger.debug(f"Zone file validation successful for {zone_name}")


def rndc_reload(zone_name: str) -> None:
    logger.info(f"Reloading zone {zone_name} via rndc")
    rc, out, err = run_cmd([settings.rndc, "reload", zone_name.rstrip(".")])
    if rc != 0:
        logger.error(
            f"rndc reload failed for {zone_name}: {err.strip() or out.strip()}"
        )
        raise RuntimeError(f"rndc reload failed: {err.strip() or out.strip()}")
    logger.info(f"Zone {zone_name} reloaded successfully")


def rndc_reconfig() -> None:
    logger.info("Executing rndc reconfig")
    rc, out, err = run_cmd([settings.rndc, "reconfig"])
    if rc != 0:
        logger.error(f"rndc reconfig failed: {err.strip() or out.strip()}")
        raise RuntimeError(f"rndc reconfig failed: {err.strip() or out.strip()}")
    logger.info("rndc reconfig completed successfully")

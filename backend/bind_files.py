from __future__ import annotations

import os
import re
import tempfile
import fcntl
import subprocess
from dataclasses import dataclass
from typing import Dict, List, Tuple

from backend.settings import settings


ZONE_STANZA_RE = re.compile(
    r'zone\s+"(?P<zone>[^"]+)"\s*\{\s*(?P<body>.*?)\s*\};', re.DOTALL | re.MULTILINE
)

FILE_RE = re.compile(r'file\s+"(?P<file>[^"]+)";')
TYPE_RE = re.compile(r"type\s+(?P<type>\w+);")


@dataclass
class ManagedZoneStanza:
    zone: str
    body: str
    file_path: str


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
    zones: Dict[str, ManagedZoneStanza] = {}
    for m in ZONE_STANZA_RE.finditer(text):
        zone = m.group("zone").strip()
        body = m.group("body")
        fmatch = FILE_RE.search(body)
        if not fmatch:
            continue
        file_path = fmatch.group("file")
        zones[zone] = ManagedZoneStanza(zone=zone, body=body, file_path=file_path)
    return zones


def build_zone_stanza(
    zone_name: str, file_path: str, allow_transfer: List[str], also_notify: List[str]
) -> str:
    allow = (
        f"allow-transfer {{ {'; '.join(allow_transfer)}; }};" if allow_transfer else ""
    )
    notify = f"also-notify {{ {'; '.join(also_notify)}; }};" if also_notify else ""
    # keep it minimal; you can add more knobs later
    return (
        f'zone "{zone_name}" {{\n'
        f"  type master;\n"
        f'  file "{file_path}";\n'
        f"  {allow}\n"
        f"  {notify}\n"
        f"}};\n"
    )


def upsert_zone_stanza(
    zone_name: str, file_path: str, allow_transfer: List[str], also_notify: List[str]
) -> None:
    require_managed_include_ready()

    # lock include file while editing
    with open(settings.managed_include, "r+") as f:
        _lock_file(f.fileno())
        text = f.read()
        zones = parse_managed_zones(text)

        stanza = build_zone_stanza(zone_name, file_path, allow_transfer, also_notify)

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
    rc, out, err = run_cmd([settings.named_checkconf, settings.named_conf])
    if rc != 0:
        raise RuntimeError(f"named-checkconf failed: {err.strip() or out.strip()}")


def validate_zone(zone_name: str, zone_file: str) -> None:
    rc, out, err = run_cmd([settings.named_checkzone, zone_name.rstrip("."), zone_file])
    if rc != 0:
        raise RuntimeError(f"named-checkzone failed: {err.strip() or out.strip()}")


def rndc_reload(zone_name: str) -> None:
    rc, out, err = run_cmd([settings.rndc, "reload", zone_name.rstrip(".")])
    if rc != 0:
        raise RuntimeError(f"rndc reload failed: {err.strip() or out.strip()}")


def rndc_reconfig() -> None:
    rc, out, err = run_cmd([settings.rndc, "reconfig"])
    if rc != 0:
        raise RuntimeError(f"rndc reconfig failed: {err.strip() or out.strip()}")

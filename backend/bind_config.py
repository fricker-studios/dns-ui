"""Parse and manage BIND's named.conf.options file."""

from __future__ import annotations

import re
from typing import Any


def parse_acls(content: str) -> dict[str, list[str]]:
    """
    Parse ACL blocks from the config file.
    Returns a dictionary of ACL name to list of entries.
    """
    acls: dict[str, list[str]] = {}

    # Find all ACL blocks
    acl_pattern = r"acl\s+([a-zA-Z0-9_-]+)\s*\{([^}]+)\}"
    for match in re.finditer(acl_pattern, content):
        acl_name = match.group(1)
        acl_content = match.group(2)

        # Extract entries (split by semicolon, remove comments and whitespace)
        entries = []
        for line in acl_content.split(";"):
            # Remove comments
            line = re.sub(r"//.*$", "", line, flags=re.MULTILINE)
            line = re.sub(r"/\*.*?\*/", "", line, flags=re.DOTALL)
            line = line.strip()
            if line:
                entries.append(line)

        acls[acl_name] = entries

    return acls


def parse_list_field(content: str, field_name: str) -> list[str]:
    """
    Parse a field that contains a list of values in braces.
    E.g., 'allow-query { localhost; internal-network; };'
    """
    pattern = rf"{field_name}\s*\{{\s*([^}}]+)\s*\}}"
    match = re.search(pattern, content)
    if not match:
        return []

    values_str = match.group(1)
    # Split by semicolon and clean up
    values = []
    for val in values_str.split(";"):
        # Remove comments
        val = re.sub(r"//.*$", "", val, flags=re.MULTILINE)
        val = val.strip()
        if val:
            values.append(val)

    return values


def parse_named_options(content: str) -> dict[str, Any]:
    """
    Parse the options block from named.conf.options.
    Returns a dictionary of configuration values.
    """
    config: dict[str, Any] = {}

    # Parse ACLs first (they appear before options block)
    config["acls"] = parse_acls(content)

    # Extract the options block - need to handle nested braces
    options_match = re.search(r"options\s*\{(.*)\};?\s*$", content, re.DOTALL)
    if not options_match:
        return config

    options_content = options_match.group(1)

    # Parse directory
    directory_match = re.search(r'directory\s+"([^"]+)"', options_content)
    if directory_match:
        config["directory"] = directory_match.group(1)

    # Parse forwarders
    forwarders_match = re.search(r"forwarders\s*\{\s*([^}]+)\s*\}", options_content)
    if forwarders_match:
        forwarders_str = forwarders_match.group(1)
        # Extract IPs (remove semicolons and split)
        forwarders = [
            ip.strip() for ip in forwarders_str.replace(";", "").split() if ip.strip()
        ]
        config["forwarders"] = forwarders
    else:
        config["forwarders"] = []

    # Parse listen-on
    listen_on_match = re.search(r"listen-on\s*\{\s*([^}]+)\s*\}", options_content)
    if listen_on_match:
        config["listen_on"] = listen_on_match.group(1).strip().rstrip(";")

    # Parse listen-on-v6
    listen_on_v6_match = re.search(r"listen-on-v6\s*\{\s*([^}]+)\s*\}", options_content)
    if listen_on_v6_match:
        config["listen_on_v6"] = listen_on_v6_match.group(1).strip().rstrip(";")

    # Parse allow-query (now a list)
    config["allow_query"] = parse_list_field(options_content, "allow-query")

    # Parse recursion
    recursion_match = re.search(r"recursion\s+(yes|no)", options_content)
    if recursion_match:
        config["recursion"] = recursion_match.group(1) == "yes"

    # Parse dnssec-validation
    dnssec_match = re.search(r"dnssec-validation\s+(yes|no|auto)", options_content)
    if dnssec_match:
        config["dnssec_validation"] = dnssec_match.group(1)

    # Parse allow-transfer (now a list)
    config["allow_transfer"] = parse_list_field(options_content, "allow-transfer")

    return config


def build_named_options(config: dict[str, Any]) -> str:
    """
    Build a named.conf.options file content from config dictionary.
    """
    lines = []

    # Build ACLs first
    if "acls" in config and config["acls"]:
        for acl_name, entries in config["acls"].items():
            lines.append(f"acl {acl_name} {{")
            for entry in entries:
                lines.append(f"\t{entry};")
            lines.append("};")
            lines.append("")  # Empty line after each ACL

    lines.append("options {")

    # Directory
    if "directory" in config:
        lines.append(f'\tdirectory "{config["directory"]}";')

    # Allow-query (now a list)
    if "allow_query" in config and config["allow_query"]:
        entries_str = "; ".join(config["allow_query"]) + ";"
        lines.append(f"\tallow-query {{ {entries_str} }};")

    # Allow-transfer (now a list)
    if "allow_transfer" in config and config["allow_transfer"]:
        entries_str = "; ".join(config["allow_transfer"]) + ";"
        lines.append(f"\tallow-transfer {{ {entries_str} }};")

    # Forwarders
    if "forwarders" in config and config["forwarders"]:
        forwarders_str = "; ".join(config["forwarders"]) + ";"
        lines.append(f"\tforwarders {{ {forwarders_str} }};")

    # Recursion
    if "recursion" in config:
        recursion_val = "yes" if config["recursion"] else "no"
        lines.append(f"\trecursion {recursion_val};")

    # DNSSEC validation
    if "dnssec_validation" in config:
        lines.append(f'\tdnssec-validation {config["dnssec_validation"]};')

    # Listen-on
    if "listen_on" in config:
        lines.append(f'\tlisten-on {{ {config["listen_on"]}; }};')

    # Listen-on-v6
    if "listen_on_v6" in config:
        lines.append(f'\tlisten-on-v6 {{ {config["listen_on_v6"]}; }};')

    lines.append("};")
    return "\n".join(lines) + "\n"


def read_named_options(file_path: str) -> dict[str, Any]:
    """Read and parse named.conf.options file."""
    with open(file_path, "r") as f:
        content = f.read()
    return parse_named_options(content)


def write_named_options(file_path: str, config: dict[str, Any]) -> None:
    """Write config to named.conf.options file."""
    content = build_named_options(config)
    with open(file_path, "w") as f:
        f.write(content)

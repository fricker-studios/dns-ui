from __future__ import annotations

import ipaddress
from typing import Literal
from pydantic import (
    BaseModel,
    Field,
    field_validator,
    ValidationError as PydanticValidationError,
)


ZoneType = Literal["forward", "reverse"]
ZoneRole = Literal["primary", "secondary"]
RecordType = Literal["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "PTR", "CAA"]


def normalize_fqdn(s: str) -> str:
    s = s.strip()
    if not s:
        return s
    return s if s.endswith(".") else s + "."


class Zone(BaseModel):
    name: str  # example.com.
    type: ZoneType = "forward"  # forward or reverse
    role: ZoneRole = "primary"  # primary or secondary
    file_path: str
    options: dict = Field(default_factory=dict)  # allow-transfer, also-notify, etc.

    @field_validator("name")
    @classmethod
    def _norm(cls, v: str) -> str:
        return normalize_fqdn(v)


class RecordValue(BaseModel):
    value: str
    priority: int | None = None
    weight: int | None = None
    port: int | None = None


class RecordSet(BaseModel):
    name: str  # fqdn, or relative label (we’ll normalize to fqdn for storage)
    type: RecordType
    ttl: int | None = None
    values: list[RecordValue]
    comment: str | None = None

    @field_validator("name")
    @classmethod
    def _norm_name(cls, v: str) -> str:
        return normalize_fqdn(v)

    @field_validator("values")
    @classmethod
    def _validate_values(cls, v: list[RecordValue], info) -> list[RecordValue]:
        """Validate record values based on record type"""
        record_type = info.data.get("type")
        if not record_type:
            return v

        for value in v:
            val = value.value.strip()

            # Validate A records (IPv4)
            if record_type == "A":
                try:
                    ipaddress.IPv4Address(val)
                except ValueError:
                    raise ValueError(
                        f"Invalid IPv4 address for A record: '{val}'. Each octet must be 0-255."
                    )

            # Validate AAAA records (IPv6)
            elif record_type == "AAAA":
                try:
                    ipaddress.IPv6Address(val)
                except ValueError:
                    raise ValueError(f"Invalid IPv6 address for AAAA record: '{val}'")

        return v


class NameServer(BaseModel):
    hostname: str
    ipv4: str

    @field_validator("ipv4")
    @classmethod
    def _validate_ipv4(cls, v: str) -> str:
        """Validate that ipv4 is a valid IPv4 address"""
        try:
            ipaddress.IPv4Address(v.strip())
        except ValueError:
            raise ValueError(f"Invalid IPv4 address: '{v}'. Each octet must be 0-255.")
        return v.strip()


class ZoneCreate(BaseModel):
    name: str
    type: ZoneType = "forward"
    role: ZoneRole = "primary"  # primary or secondary
    default_ttl: int = 300

    # zone-level config in stanza
    allow_transfer: list[str] = Field(default_factory=list)
    also_notify: list[str] = Field(default_factory=list)

    # SOA (only used for master zones)
    primary_ns: str = ""
    nameservers: list[NameServer] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _norm(cls, v: str) -> str:
        return normalize_fqdn(v)


class SOA(BaseModel):
    primary_ns: str
    admin_email: str
    serial: int
    refresh: int
    retry: int
    expire: int
    minimum: int


class ZoneDetail(BaseModel):
    """Extended zone info with SOA and TTL"""

    name: str
    type: ZoneType
    role: ZoneRole = "primary"
    file_path: str
    options: dict
    default_ttl: int
    soa: SOA | None = None  # None for secondary zones
    allow_transfer: list[str]
    also_notify: list[str]

    @field_validator("name")
    @classmethod
    def _norm(cls, v: str) -> str:
        return normalize_fqdn(v)


class ZoneUpdate(BaseModel):
    allow_transfer: list[str] | None = None
    also_notify: list[str] | None = None


class ZoneSettingsUpdate(BaseModel):
    """Update zone settings (SOA and TTL)"""

    default_ttl: int | None = None
    soa_refresh: int | None = None
    soa_retry: int | None = None
    soa_expire: int | None = None
    soa_minimum: int | None = None
    allow_transfer: list[str] | None = None
    also_notify: list[str] | None = None


class PaginatedRecordSets(BaseModel):
    """Paginated recordsets response"""

    items: list[RecordSet]
    total: int
    page: int
    page_size: int
    total_pages: int

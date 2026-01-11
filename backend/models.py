from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, field_validator


ZoneType = Literal["forward", "reverse"]
RecordType = Literal["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "PTR", "CAA"]


def normalize_fqdn(s: str) -> str:
    s = s.strip()
    if not s:
        return s
    return s if s.endswith(".") else s + "."


class Zone(BaseModel):
    name: str  # example.com.
    type: ZoneType = "forward"  # forward or reverse
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


class NameServer(BaseModel):
    hostname: str
    ipv4: str


class ZoneCreate(BaseModel):
    name: str
    type: ZoneType = "forward"
    default_ttl: int = 300

    # zone-level config in stanza
    allow_transfer: list[str] = Field(default_factory=list)
    also_notify: list[str] = Field(default_factory=list)

    # SOA
    primary_ns: str
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
    file_path: str
    options: dict
    default_ttl: int
    soa: SOA
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

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, field_validator


ZoneType = Literal["public", "private"]
RecordType = Literal["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "PTR", "CAA"]


def normalize_fqdn(s: str) -> str:
    s = s.strip()
    if not s:
        return s
    return s if s.endswith(".") else s + "."


class Zone(BaseModel):
    name: str  # example.com.
    type: ZoneType = "public"  # UI concept; BIND doesn't care unless "view" setup
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


class ZoneCreate(BaseModel):
    name: str
    type: ZoneType = "public"
    default_ttl: int = 300

    # zone-level config in stanza
    allow_transfer: list[str] = Field(default_factory=list)
    also_notify: list[str] = Field(default_factory=list)

    # SOA
    primary_ns: str | None = None
    admin_email: str | None = None

    @field_validator("name")
    @classmethod
    def _norm(cls, v: str) -> str:
        return normalize_fqdn(v)


class ZoneUpdate(BaseModel):
    allow_transfer: list[str] | None = None
    also_notify: list[str] | None = None

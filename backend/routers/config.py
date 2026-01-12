"""Router for managing BIND server configuration."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.settings import settings
from backend.bind_config import read_named_options, write_named_options
from backend.bind_files import validate_named_conf, rndc_reconfig


router = APIRouter(prefix="/config", tags=["config"])


class BindConfig(BaseModel):
    """BIND server configuration model."""

    directory: str | None = None
    forwarders: list[str] = []
    listen_on: str | None = None
    listen_on_v6: str | None = None
    allow_query: list[str] = []
    recursion: bool = True
    dnssec_validation: str | None = None
    allow_transfer: list[str] = []
    acls: dict[str, list[str]] = {}
    server_role: str | None = "primary"
    primary_servers: list[str] = []
    transfer_source: str | None = None


@router.get("", response_model=BindConfig)
def get_config():
    """Get current BIND server configuration."""
    try:
        config = read_named_options(settings.named_conf_options)
        return BindConfig(**config)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Configuration file not found")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read configuration: {str(e)}"
        )


@router.put("", response_model=BindConfig)
def update_config(config: BindConfig):
    """Update BIND server configuration."""
    try:
        # Convert to dict and filter None values
        config_dict = {k: v for k, v in config.model_dump().items() if v is not None}

        # Write the configuration
        write_named_options(settings.named_conf_options, config_dict)

        # Validate the configuration
        validate_named_conf()

        # Reload BIND configuration
        try:
            rndc_reconfig()
        except Exception as e:
            # If reload fails, we should still return the config but warn
            # In production, you might want to rollback the change
            raise HTTPException(
                status_code=500,
                detail=f"Configuration saved but reload failed: {str(e)}",
            )

        # Return the updated configuration
        return config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update configuration: {str(e)}"
        )


@router.post("/reload")
def reload_config():
    """Reload BIND configuration without making changes."""
    try:
        rndc_reconfig()
        return {"ok": True, "message": "Configuration reloaded successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to reload configuration: {str(e)}"
        )

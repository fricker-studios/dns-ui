from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DNS_", extra="ignore")

    # sentry configuration
    sentry_dsn: str | None = None
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 1.0
    sentry_profiles_sample_rate: float = 1.0

    # logging
    log_level: str = "INFO"

    # bind locations
    named_conf: str = "/etc/bind/named.conf"
    named_conf_local: str = "/etc/bind/named.conf.local"
    named_conf_options: str = "/etc/bind/named.conf.options"

    # file the API manages (included by named.conf.local)
    managed_include: str = "/etc/bind/managed-zones.conf"
    managed_zone_dir: str = "/etc/bind/managed-zones"

    # commands
    named_checkconf: str = "/usr/bin/named-checkconf"
    named_checkzone: str = "/usr/bin/named-checkzone"
    rndc: str = "/usr/sbin/rndc"

    # behavior
    default_ttl: int = 300
    auto_bump_serial: bool = True
    require_managed_include_present: bool = True  # safer default


settings = Settings()

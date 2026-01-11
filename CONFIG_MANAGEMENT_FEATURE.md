# BIND Configuration Management Feature

This update adds the ability to manage BIND server configuration through the DNS UI backend and frontend.

## Backend Changes

### New Files
- **`backend/bind_config.py`** - Module for parsing and writing `named.conf.options` files
- **`backend/routers/config.py`** - FastAPI router with endpoints for configuration management

### Modified Files
- **`backend/settings.py`** - Added `named_conf_options` setting
- **`backend/main.py`** - Registered the config router

### API Endpoints
- `GET /api/config` - Get current BIND configuration
- `PUT /api/config` - Update BIND configuration and reload
- `POST /api/config/reload` - Reload BIND without making changes

### Configuration Properties
- `directory` - BIND working directory
- `forwarders` - List of DNS forwarder IPs
- `listen_on` - IPv4 addresses to listen on
- `listen_on_v6` - IPv6 addresses to listen on
- `allow_query` - ACL for queries
- `recursion` - Enable/disable recursive queries
- `dnssec_validation` - DNSSEC validation mode (yes/no/auto)
- `allow_transfer` - ACL for zone transfers

## Frontend Changes

### New Files
- **`frontend/src/hooks/useBindConfig.ts`** - React hooks for config API
- **`frontend/src/components/settings/SettingsPage.tsx`** - Settings UI page

### Modified Files
- **`frontend/src/App.tsx`** - Added Settings tab with gear icon
- **`frontend/src/hooks/index.ts`** - Exported config hooks

### UI Features
- View and edit BIND server configuration
- Manage forwarders list (add/remove DNS servers)
- Control recursion and DNSSEC validation
- Configure access control (listen-on, allow-query, allow-transfer)
- Reload configuration without changes
- Save and apply configuration changes

## Configuration

### Docker Compose
The `named.conf.options` file is now mounted as a read-write volume:
```yaml
volumes:
  - ./bind/named.conf.options:/etc/bind/named.conf.options:rw
```

### Environment Variable
```bash
DNS_NAMED_CONF_OPTIONS=/etc/bind/named.conf.options
```

## Usage

1. Navigate to the "Settings" tab in the UI
2. Edit configuration values as needed
3. Add/remove DNS forwarders using the forwarders section
4. Click "Save Changes" to apply and reload BIND
5. Use "Reload Config" button to reload without making changes

## Notes

- Configuration changes are validated before being applied
- BIND is automatically reloaded after successful configuration updates
- The configuration file is parsed and regenerated to maintain consistent formatting
- All changes are persisted to the mounted `named.conf.options` file

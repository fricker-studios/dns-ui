# DNS Container

1. Disable `systemd-resolved`:
  - `sudo systemctl disable systemd-resolved.service`
  - `sudo systemctl stop systemd-resolved.service`

2. Copy config files:
  - `cp bind/.example/managed-zones.conf bind/managed-zones.conf`
  - `cp bind/.example/rndc.key bind/rndc.key` or `rndc-confgen -a -c ./bind/rndc.key`

3. Start services:
  - `sudo docker compose up -d`

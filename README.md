# DNS Console
This repository/project serves to ease in the creation and management of:
  - bind (DNS) & server configuration
  - zones & recordsets
  - delegation & replication

The default application provides an unauthenticated UI on port 8080 (http://localhost:8080). To run the default master DNS server:

1. Disable `systemd-resolved`:
  - `sudo systemctl disable systemd-resolved.service`
  - `sudo systemctl stop systemd-resolved.service`

2. Set up environment:
  - `cp bind/.example/managed-zones.conf bind/managed-zones.conf`
  - `cp bind/.example/rndc.key bind/rndc.key` or `rndc-confgen -a -c ./bind/rndc.key`

3. Start services:
  - `sudo docker compose up -d`

# DNS Console
[![Release to Production](https://github.com/fricker-studios/dns-ui/actions/workflows/release.yml/badge.svg)](https://github.com/fricker-studios/dns-ui/actions/workflows/release.yml)
[![Release](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2Ffricker-studios%2Fdns-ui%2Freleases%2Flatest&query=%24.tag_name&label=release&cacheSeconds=60)](https://github.com/fricker-studios/dns-ui/releases/latest)


This repository/project serves to ease in the creation and management of:
  - bind (DNS) & server configuration
  - zones & recordsets
  - delegation & replication

The default application provides an unauthenticated UI on port 8080 (http://localhost:8080).

<img width="1512" height="756" alt="image" src="https://github.com/user-attachments/assets/92c67f59-e205-402b-a010-688c5f53cbc0" />

To run the default master DNS server:

1. Set up environment:
  - `cp bind/.example/managed-zones.conf bind/managed-zones.conf`
  - `cp bind/.example/rndc.key bind/rndc.key` or `rndc-confgen -a -c ./bind/rndc.key`

2. Start services:
  - `sudo docker compose up -d`

To run on port 53, update the [docker-compose.yaml](/docker-compose.yaml) file and disable any services running on port 53 (like `systemd-resolved`)

## Managing Zones & Recordsets
To get started, access the UI (http://localhost:8080) and create a new hosted zone. By default the server is configured as a primary, if you want this to be a replica/secondary node you can adjust the server level settings.

After creating a hosted zone, select the zone and choose "Create record" to create a new recordset. Choose the appropriate option (A/AAAA/CNAME/etc) and fill out the details. To actually apply the changes to the DNS server click on "Apply Changes" (otherwise changes will be lost after leaving the page).
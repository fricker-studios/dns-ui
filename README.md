docker run --rm -it \
  --name dns-console \
  --network host \
  -e DNS_NAMED_CONF=/etc/bind/named.conf \
  -e DNS_MANAGED_INCLUDE=/etc/bind/managed-zones.conf \
  -e DNS_MANAGED_ZONE_DIR=/etc/bind/managed-zones \
  -e DNS_RNDC=/usr/sbin/rndc \
  -e DNS_NAMED_CHECKCONF=/usr/sbin/named-checkconf \
  -e DNS_NAMED_CHECKZONE=/usr/sbin/named-checkzone \
  -v /etc/bind/managed-zones.conf:/etc/bind/managed-zones.conf:rw \
  -v /etc/bind/managed-zones:/etc/bind/managed-zones:rw \
  -v /etc/bind/named.conf:/etc/bind/named.conf:ro \
  -v /etc/bind/named.conf.local:/etc/bind/named.conf.local:ro \
  -v /etc/bind/rndc.key:/etc/bind/rndc.key:ro \
  dns-console:latest

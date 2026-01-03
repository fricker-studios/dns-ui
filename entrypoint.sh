#! /bin/bash
set -e

# Start bind9 (named) service
/usr/sbin/named -u bind -c /etc/bind/named.conf

# Start nginx in the background
nginx

# Execute the main command (passed as arguments to this script)
exec "$@"
#! /bin/bash
set -e

# Start bind9 (named) service in background with -g flag as appuser
/usr/sbin/named -c /etc/bind/named.conf -g &

# Start nginx in the background
nginx

# Execute the main command (passed as arguments to this script)
exec "$@"
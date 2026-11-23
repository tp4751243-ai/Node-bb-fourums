#!/usr/bin/env bash
# Installs the test forum on a fresh server (called by the Hetzner setup script in server/README.md).
#   bash server/install.sh <admin email> <admin password> [domain]
# Without a domain it uses <server-ip>.sslip.io, a free name that points at this server.
# Safe to run again: keeps the existing settings and data.
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN_EMAIL=${1:?admin email missing}
ADMIN_PASSWORD=${2:?admin password missing}

if [ ! -f local/.env ]; then
	domain=${3:-}
	if [ -z "$domain" ]; then
		ip=$(curl -sf --max-time 5 http://169.254.169.254/hetzner/v1/metadata/public-ipv4 || hostname -I | awk '{print $1}')
		domain="$(echo "$ip" | tr . -).sslip.io"
	fi
	db_password=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
	cat > local/.env <<EOF
COMPOSE_FILE=docker-compose.yml:../server/compose.server.yml
DOMAIN=$domain
NODEBB_URL=https://$domain
NODEBB_ADMIN_USERNAME=admin
NODEBB_ADMIN_EMAIL=$ADMIN_EMAIL
NODEBB_ADMIN_PASSWORD=$ADMIN_PASSWORD
DB_PASSWORD=$db_password
EOF
	chmod 600 local/.env
fi

bash local/setup.sh
(cd local && docker compose up -d caddy)

domain=$(grep '^DOMAIN=' local/.env | cut -d= -f2-)
echo "Done: forum at https://$domain  (test inbox: https://mail.$domain)"

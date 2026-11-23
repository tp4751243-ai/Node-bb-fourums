#!/usr/bin/env bash
# Runs every time the codespace starts: works out the forum's public https address and runs local/setup.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${CODESPACE_NAME:-}" ]; then
	url="https://${CODESPACE_NAME}-4567.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
	[ -f local/.env ] || cp local/.env.example local/.env
	# keep it in local/.env so every later "docker compose" command uses the same address
	if grep -q '^NODEBB_URL=' local/.env; then
		sed -i "s#^NODEBB_URL=.*#NODEBB_URL=$url#" local/.env
	else
		echo "NODEBB_URL=$url" >> local/.env
	fi
	export NODEBB_URL="$url"
fi

bash local/setup.sh

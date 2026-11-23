#!/usr/bin/env bash
# Builds a clean local בית העורכים forum: NodeBB + Postgres + test inbox, our plugin activated,
# categories and tier privileges created, NodeBB's sample content removed. Safe to run again.
#
#   cd local && ./setup.sh
#
# Needs Docker (Docker Desktop on Mac/Windows). On Windows run it from WSL or Git Bash.
set -euo pipefail
cd "$(dirname "$0")"

URL=http://127.0.0.1:4567
dc() { docker compose "$@"; }

wait_for_forum() {
	printf 'Waiting for the forum to start (the first start builds the site and takes a few minutes)'
	for _ in $(seq 1 200); do
		if curl -sf -o /dev/null "$URL/api/config"; then echo ' ready.'; return 0; fi
		printf '.'; sleep 3
	done
	echo; echo 'The forum did not start. See: docker compose logs nodebb'; exit 1
}

[ -f .env ] || cp .env.example .env
if ! grep -qE '^NODEBB_ADMIN_PASSWORD=.+' .env; then
	# head reads a fixed amount, so nothing in this pipeline is cut off early
	password=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-20)
	sed -i.bak "s/^NODEBB_ADMIN_PASSWORD=.*/NODEBB_ADMIN_PASSWORD=$password/" .env && rm -f .env.bak
	echo "Saved a random admin password in local/.env"
fi

dc up -d db mail

if ! dc run --rm --no-deps --entrypoint test nodebb -f /opt/config/config.json; then
	echo 'First run: creating the forum database and admin account...'
	dc run --rm -e SETUP=1 nodebb
	# A brand-new install is already current: record that, so the first start doesn't run NodeBB's
	# upgrade step (which needs packages.nodebb.org and crash-loops if that site can't be reached).
	dc run --rm --no-deps --entrypoint sh nodebb -c 'md5sum install/package.json | head -c 32 > /opt/config/install_hash.md5'
fi

dc up -d nodebb
wait_for_forum

if ! curl -sf -o /dev/null "$URL/api/v3/plugins/trust-tiers"; then
	echo 'Activating the trust tiers plugin...'
	dc exec -T nodebb /usr/src/app/nodebb activate nodebb-plugin-trust-tiers --config=/opt/config/config.json
	dc restart nodebb
	sleep 5
	wait_for_forum
fi

echo 'Creating categories and permissions...'
dc run --rm tools sh scripts/local-bootstrap.sh

admin_user=$(grep '^NODEBB_ADMIN_USERNAME=' .env | cut -d= -f2-)
admin_pass=$(grep '^NODEBB_ADMIN_PASSWORD=' .env | cut -d= -f2-)
cat <<EOF

Your local forum is ready.
  Forum:       ${NODEBB_URL:-http://localhost:4567}
  Admin login: $admin_user / $admin_pass   (stored in local/.env)
  Test inbox:  port 8025                    (every email the forum sends lands here)
EOF

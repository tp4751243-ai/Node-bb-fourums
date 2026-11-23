#!/bin/bash
# Paste this whole file into Hetzner's "Cloud config" box when creating the server (see server/README.md).
# ===================== fill in these three lines =====================
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="ChooseALongPassword2026"   # letters and numbers only
GITHUB_TOKEN=""                            # read-only token; leave empty if the repository is public
# =====================================================================

exec > /var/log/beit-install.log 2>&1
set -ex
REPO="github.com/tp4751243-ai/Node-bb-fourums.git"

apt-get update -y
apt-get install -y git curl
curl -fsSL https://get.docker.com | sh

if [ -n "$GITHUB_TOKEN" ]; then
	git clone --depth 1 "https://token:${GITHUB_TOKEN}@${REPO}" /opt/beit-haorchim
	git -C /opt/beit-haorchim remote set-url origin "https://${REPO}"   # don't keep the token on disk
else
	git clone --depth 1 "https://${REPO}" /opt/beit-haorchim
fi

bash /opt/beit-haorchim/server/install.sh "$ADMIN_EMAIL" "$ADMIN_PASSWORD"

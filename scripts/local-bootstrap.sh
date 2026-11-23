#!/bin/sh
# Runs inside the "tools" container of local/docker-compose.yml (called by local/setup.sh and setup.ps1).
# Logs in as the admin from local/.env, makes a temporary token, applies the forum structure, deletes the token.
set -e
export NODEBB_URL=http://localhost:4567
NODEBB_TOKEN=$(node scripts/make-token.mjs)
export NODEBB_TOKEN
REMOVE_NODEBB_SAMPLES=1 SMTP_HOST=mail SMTP_PORT=1025 DELETE_TOKEN=1 node scripts/bootstrap.mjs

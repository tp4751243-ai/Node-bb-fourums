# Run בית העורכים on your own computer

A private copy of the real forum for testing and tweaking. It starts **clean**: no NodeBB sample categories,
no welcome post, no test users. You get only your own category tree, the trust tiers and your admin account.

## Start

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Linux, Docker Engine is enough).
2. In a terminal (on Windows use WSL or Git Bash):

   ```bash
   cd local
   ./setup.sh
   ```

   The first run takes a few minutes. At the end it prints your admin login.

| What | Where |
|---|---|
| Forum | http://localhost:4567 |
| Admin panel | http://localhost:4567/admin |
| Test inbox: every email the forum sends (account confirmations, notifications) | http://localhost:8025 |
| Admin username and password | `local/.env` |

Nothing is reachable from outside your computer, and no email leaves it.

## Everyday commands (run inside `local/`)

| To… | Run |
|---|---|
| Stop the forum (data is kept) | `docker compose stop` |
| Start it again | `docker compose start` |
| Apply changes to the trust-tiers plugin | `docker compose restart nodebb` (takes about a minute, because it rebuilds) |
| Re-apply categories and permissions after editing `scripts/bootstrap.mjs` | `./setup.sh` |
| Watch the forum's log | `docker compose logs -f nodebb` |
| **Wipe everything and start from zero** | `docker compose down -v && ./setup.sh` |

## Testing the trust tiers

1. Register a second account in another browser (or a private window).
2. Confirm its email from the test inbox at http://localhost:8025.
3. Its first post waits for approval. Approve it in Admin → Manage → Post Queue.
4. After 5 posts it reaches **אות** (Letter): the badge appears and the jobs board opens to it.
   Its job posts then wait in the post queue.

To skip ahead, pin the account to a tier in Admin → Plugins → Trust tiers → *Manual overrides*
(for example `testuser = 3`).

## Tweaking the look

Start in Admin → Appearance → Custom Content → *Custom CSS*, and switch the site language to Hebrew in
Admin → Settings → Languages. Changes show after a page refresh, with no restart needed.

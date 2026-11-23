# Run בית העורכים on your own computer

A private copy of the real forum for testing and tweaking. It starts **clean**: no NodeBB sample categories,
no welcome post, no test users. You get only your own category tree, the trust tiers and your admin account.

## Start in the cloud with GitHub Codespaces (no install, nothing on your computer)

1. Open the repository on GitHub, click **Code → Codespaces → Create codespace**.
2. Wait. The first start takes about 10 minutes (it builds the forum). The *Terminal* panel shows progress and,
   at the end, prints the forum address and your admin login (also saved in `local/.env`).
3. Open the **Ports** tab and click the globe icon next to **Forum (4567)**. **Test inbox (8025)** shows every email.

Good to know:
- The addresses are **private**: only you, logged in to GitHub, can open them. To let a tester in, right-click
  the port → *Port Visibility* → *Public* (anyone with the link can then see it).
- A codespace stops itself after 30 minutes without use; reopen it from github.com/codespaces and the forum
  starts again with all its data. Deleting the codespace deletes the forum's data.
- Free accounts get a monthly allowance of usage hours (about 60 hours on this machine size). Stop the codespace
  when you're done (github.com/codespaces → … → *Stop codespace*) to save them.

## Start on Windows

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), open it, and wait until it shows
   *Engine running*. (The first time, it may ask to install WSL and restart Windows.)
2. Download the project. While logged in to GitHub, open
   <https://github.com/tp4751243-ai/Node-bb-fourums/archive/refs/heads/ccr-cb5c03ed-aduxo6.zip>.
   Right-click the ZIP → *Extract All…* → extract to `C:\Users\<you>\beit-haorchim`.
3. Open PowerShell and run (adjust the path if you extracted elsewhere):

   ```powershell
   cd C:\Users\<you>\beit-haorchim\Node-bb-fourums-ccr-cb5c03ed-aduxo6\local
   powershell -ExecutionPolicy Bypass -File .\setup.ps1
   ```

   The first run takes a few minutes. At the end it prints your admin login.

## Start on Mac or Linux

Install Docker, get the project (`git clone`), then:

```bash
cd local
./setup.sh
```

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
| Re-apply categories and permissions after editing `scripts/bootstrap.mjs` | run the setup script again |
| Watch the forum's log | `docker compose logs -f nodebb` |
| **Wipe everything and start from zero** | `docker compose down -v`, then run the setup script again |

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

# Deploying בית העורכים (NodeBB + Supabase)

NodeBB runs in Docker on your server, the database lives on Supabase, and Caddy provides HTTPS.
Everything here was tested against NodeBB 4.16.9 with a TLS-only Postgres 16, a private CA certificate,
and a database role that has only the rights listed below.

## 1. Supabase (one time)

1. **Create a project just for the forum.** Pick the region closest to your members, for example Frankfurt
   (`eu-central-1`) for Israel and Europe. Use the Pro plan for the live site: it adds daily backups and
   projects don't get paused.
2. **Create the NodeBB database role.** Open SQL Editor and run [`supabase/01-nodebb-role.sql`](supabase/01-nodebb-role.sql)
   after putting a long random password in it.
3. **Turn off the Data API** (Project Settings → Data API). The forum never uses it, and NodeBB keeps password hashes
   and emails in the `public` schema that this API exposes.
4. **Require SSL.** Database settings → SSL configuration: enable *Enforce SSL on incoming connections* and
   *Download certificate*. Save the certificate as `docker/certs/supabase-ca.crt`.
5. **Copy the connection details.** Connect → **Session pooler** (port **5432**). The user name is the role plus your
   project ref, for example `nodebb.abcdefghijklmnop`.
   Don't use the transaction pooler (port 6543): NodeBB uses prepared statements, and that mode breaks them.

> **Keep the server close to the database.** NodeBB runs many small queries per page. Rent the server in the same
> region as the Supabase project (a few milliseconds apart). An ocean in between makes every page slow.

## 2. Server

A VPS with 2 vCPU and 4 GB RAM is plenty to start. Install Docker, then point your domain's DNS `A` record at the server.

```bash
git clone <this repository> beit-haorchim && cd beit-haorchim/docker
cp .env.example .env        # fill in the domain, admin and Supabase values
```

**First run.** This creates the tables and the admin user, writes NodeBB's config, then exits. It takes a few minutes
because it also builds the front end.

```bash
docker compose run --rm -e SETUP=1 nodebb
```

Then delete the `NODEBB_ADMIN_PASSWORD` line from `.env` and start the site:

```bash
docker compose up -d
docker compose logs -f nodebb      # wait for "NodeBB Ready"
```

Open `https://your-domain` and log in as the admin.

## 3. Turn on the trust tiers and build the forum structure

1. **Activate the plugin.** ACP → Extend → Plugins → *Trust tiers* → Activate, then **Rebuild & Restart**.
2. **Set up email.** ACP → Settings → Email: configure SMTP (any transactional email provider) and send a test email.
   **This is required:** tier 2, which unlocks job posting, needs a confirmed email address.
3. **Create an API token.** ACP → Settings → API Access → Create token, with your admin's uid (normally `1`).
   Copy the **secret** shown, because it's displayed only once.
4. **Run the bootstrap** from the repository root. It turns ActivityPub off, creates every category and wires
   the tier privileges. It's safe to run again.

   ```bash
   # with Node 18+ installed
   NODEBB_URL=https://your-domain NODEBB_TOKEN=<secret> node scripts/bootstrap.mjs

   # or without Node, using Docker
   docker run --rm -e NODEBB_URL=https://your-domain -e NODEBB_TOKEN=<secret> \
     -v "$PWD/scripts:/scripts:ro" node:22-alpine node /scripts/bootstrap.mjs
   ```

5. Delete the token afterwards (ACP → Settings → API Access).
6. NodeBB's sample categories (Announcements, General Discussion, …) are left alone. Disable or delete them in
   ACP → Manage → Categories.

## Day to day

| Task | How |
|---|---|
| Update NodeBB | Change the image tag in `docker-compose.yml`, then `docker compose pull && docker compose up -d` (the container upgrades itself) |
| Change tier thresholds or badge names | ACP → Plugins → Trust tiers |
| Pin a member to a tier (verified publisher) | Same page → *Manual overrides* |
| Approve job posts from tier-2 members | ACP → Manage → Post Queue, or the queue icon in the forum header |
| Backups | Supabase backs up the database (Pro plan). Back up the `nodebb-uploads` volume separately, or move uploads to S3 storage with a plugin |

## What the settings in `docker-compose.yml` do

| Setting | Why |
|---|---|
| `NODE_EXTRA_CA_CERTS` | Supabase signs its certificate with its own CA. Trusting that CA keeps TLS *verified* (tested: without it, the connection is refused with "unable to verify the first certificate") |
| `NODEBB_DB_SSL=true` | Encrypts the database connection |
| `postgres__options__max=10` | Keeps NodeBB's connection pool below Supabase's session-pooler limit |
| `trust_proxy=uniquelocal` | Shows real visitor IPs to NodeBB (bans, rate limits) by trusting only the Caddy proxy on the private Docker network |
| `NODEBB_ADDITIONAL_PLUGINS` | Installs `plugins/nodebb-plugin-trust-tiers` from this repository on every start |

# בית העורכים · Beit HaOrchim

A NodeBB community for Hebrew, Yiddish, Lashon HaKodesh and English typesetters, designers, proofreaders and editors.

| What | Where |
|---|---|
| The plan: features, decisions, roadmap | [PLAN.md](PLAN.md) |
| Clickable UI prototype (open in a browser; switch tiers in the demo bar) | [mockup/index.html](mockup/index.html) |
| Deploying on a server with Supabase Postgres | [docker/README.md](docker/README.md) |
| 5-tier trust ladder plugin (badges, job-posting rules) | [plugins/nodebb-plugin-trust-tiers](plugins/nodebb-plugin-trust-tiers/README.md) |
| Contest scoring, 70% judges / 30% public | [plugins/nodebb-plugin-contests](plugins/nodebb-plugin-contests/README.md) |
| One-time setup: categories, privileges, ActivityPub off | [scripts/bootstrap.mjs](scripts/bootstrap.mjs) |

Decisions so far:

- PostgreSQL on Supabase
- Job posting from trust tier 2 (5 posts and a confirmed email), moderated until tier 3
- Contests judged 70/30
- ActivityPub off

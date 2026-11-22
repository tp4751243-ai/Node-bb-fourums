# nodebb-plugin-trust-tiers · דרגות אמון

A five-step trust ladder for בית העורכים. Members climb from a dot to a book as they post, earn reputation and stay
around. Each step is a NodeBB group, so it shows as a **badge** next to the member's name and unlocks **privileges**
through ordinary category permissions.

| Tier | Badge | Needs (all of them, plus every lower tier's) | Unlocks |
|---|---|---|---|
| 1 | נקודה · Dot | registered, not banned | post in the forum, enter contests |
| 2 | אות · Letter | **5 posts**, confirmed email, reputation ≥ 0 | **post jobs** (held for a moderator), upload PDFs, vote in contests |
| 3 | שורה · Line | 30 posts, reputation 15, 14 days | job posts publish instantly, signature with links |
| 4 | עמוד · Page | 100 posts, reputation 60, 60 days | professionals' lounge, eligible to judge contests |
| 5 | ספר · Book | 300 posts, reputation 200, 180 days | moderator/mentor candidate, featured "available for work" listing |

Every number and badge name can be changed in **ACP → Plugins → Trust tiers**. Admins can also pin a member to a tier,
for example a publisher verified by phone.

## How it works

- **Groups `trust-tier-1` … `trust-tier-5`** are created on start-up. A member belongs to exactly one. On promotion
  the badge is swapped in place, and badges the member chose themselves are kept.
- **Privileges** are ordinary NodeBB category or global privileges given to those groups. `scripts/bootstrap.mjs`
  sets them up: jobs boards (`Create topics`: tiers 2–5), contest voting, PDF uploads, signatures and the lounge.
- **Post queue:** new topics in the jobs categories from members below tier 3 wait for a moderator. From tier 2 up,
  members skip NodeBB's new-member queue in the rest of the forum.
- **When tiers update:** immediately on new or deleted posts, votes, login, email confirmation, ban and unban, plus an
  hourly sweep that catches age-based promotions. The tier is stored on the user as `trustTier`.
- **Notifications:** a member gets one when they move up (not on the first assignment, so installing the plugin on an
  existing forum doesn't flood anyone).
- **Bans:** banned members lose all tier groups and get them back when unbanned.

## API (`/api/v3/plugins/…`)

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/trust-tiers` | anyone | the ladder: names, requirements, perks |
| GET | `/trust-tiers/me` | logged in | your tier and what's missing for the next one |
| GET | `/trust-tiers/users/:uid` | logged in | the same for any member |
| POST | `/trust-tiers/recalculate` | admin | re-ranks everyone now |
| PUT | `/trust-tiers/settings` | admin | changes settings (used by the bootstrap script) |

Other plugins (for example a future contests plugin) can read `trustTier` from the user record, or listen to
`action:trust-tiers.changed` (`{ uid, from, to }`).

## Tests

```bash
npm test        # tier rules, settings parsing, badge swapping (no NodeBB needed)
```

The plugin and `scripts/bootstrap.mjs` were also run against a live NodeBB 4.16.9 on Postgres 16. That end-to-end
scenario covered new member → first post queued → 5 posts → email confirmed → tier 2 → job post queued → tier 3 job
post published, plus badges, contest voting, lounge access, ban/unban, global privileges and ActivityPub off.
All 38 checks passed.

You can re-run it with `test/e2e/scenario.mjs`. Only do this against a **throwaway** NodeBB, because it creates
users and topics and bans someone. Instructions are at the top of the file.

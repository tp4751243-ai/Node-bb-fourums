# בית העורכים: plan for a NodeBB community of Hebrew and Yiddish typesetters and designers

## 1. Vision

A professional home for people who **set, design, proofread and publish** Jewish-language text:
seforim, journals, weekly alonim, Yiddish newspapers, children's books, academic Hebrew, English Torah books.

The site has three pillars:

| Pillar | What it is | Why people come back |
|---|---|---|
| **Forum** (פורום) | Q&A and discussion, split by language "world" | Daily problem-solving: nikud, fonts, InDesign, spelling rules |
| **Contests** (תחרויות) | Design and typesetting challenges with a brief, a deadline, blind submissions and judging | Portfolio building, recognition, fun |
| **Jobs** (לוח משרות) | Job posts and "available for work" listings | Income, the strongest reason to register |

Everything is built on **open-source NodeBB (v4.x, GPLv3)**. Built-in features come first, and custom plugins
are written only where NodeBB has no answer.

## Decisions

| Topic | Decision | Where it lives |
|---|---|---|
| Database | **PostgreSQL on Supabase**, through the session pooler with verified TLS, using a dedicated `nodebb` role, with the Data API off | [`docker/`](docker/README.md) |
| Who can post jobs | **A 5-tier trust ladder.** Tier 2 (5 posts and a confirmed email) can post jobs, but a moderator approves them. From tier 3 they publish instantly | [`plugins/nodebb-plugin-trust-tiers`](plugins/nodebb-plugin-trust-tiers/README.md) |
| Contest judging | **70% judges, 30% public vote.** Both are put on the same 0–100 scale first. Voting is open from tier 2 | [`plugins/nodebb-plugin-contests`](plugins/nodebb-plugin-contests/README.md) |
| ActivityPub (federation) | **Off.** The community stays on this site | [`scripts/bootstrap.mjs`](scripts/bootstrap.mjs) |
| Monetization | Still open (see §9) | |

---

## 2. Information architecture (NodeBB categories)

[`scripts/bootstrap.mjs`](scripts/bootstrap.mjs) creates this tree, with its privileges, on a fresh install:

```
📜 לשון הקודש
   ├─ עימוד ספרי קודש (צורת הדף, כתב רש"י, mefarshim around the text)
   ├─ הגהה ומראי מקומות
   ├─ פענוח כתבי יד וראשי תיבות
   └─ ניקוד וטעמים
📖 אידיש
   ├─ כתיב: חסידיש וייווא
   ├─ עלונים וצייטונגען
   └─ איבערזעצונגען · תרגום
✒️ עברית
   ├─ עריכה לשונית, ספרותית ואקדמית
   ├─ ניקוד לספרי ילדים
   └─ כללי האקדמיה ללשון
🔤 English
   ├─ Transliteration standards
   └─ Translating Torah works
🛠 כלים ומקצוע (shared by all languages)
   ├─ InDesign ותוכנות עימוד
   ├─ פונטים עבריים
   ├─ דפוס והפקה
   ├─ תיק עבודות
   └─ עסקים ותמחור
🏆 תחרויות                staff open contests; upvotes (= public vote) from tier 2, no downvotes
💼 לוח משרות              staff-only topics (posting guide)
   ├─ דרושים               new topics from tier 2; tier 2 posts wait for approval
   └─ זמינים לעבודה         same rule
☕ חדר המקצוענים          visible only from tier 4
📣 הכרזות והנהלה          staff-only topics
```

Jobs and Contests are **global**, with the language as a field or tag, rather than duplicated in each language
world. The audience is small, and splitting it would make the boards look empty.

---

## 3. What NodeBB gives you out of the box

- **RTL and Hebrew UI.** NodeBB ships a Hebrew translation (`he`) and flips the layout to RTL.
- **Harmony theme** (the default). Modern and mobile-friendly; copy it for the custom look.
- **Groups and badges.** Used for the trust tiers, and later for "מגיה מוסמך", "זוכה תחרות", "Employer".
- **Reputation and upvotes.** These feed the trust tiers.
- **Post queue.** The bootstrap sets `postQueueReputationThreshold` to 0, so only a member's **first** post (and links
  from brand-new members) waits for approval. NodeBB's default would hold every post until someone upvotes the author.
- **Tags, chat, uploads, custom profile fields** (ACP → Manage → Custom user fields): languages, software,
  portfolio URL, "open for work".
- **Webhooks and the Write API**, for later integrations (newsletter, WhatsApp/Telegram digests).
- **ActivityPub is turned off** by the bootstrap (`activitypubEnabled = 0`).

> NodeBB also has built-in *Rewards* (for example "50 posts → join a group"). It can't combine conditions (posts **and**
> reputation **and** account age), demote people, or moderate job posts, which is why the trust tiers are a plugin.

### Recommended plugins

| Plugin | Use |
|---|---|
| `nodebb-plugin-markdown`, `nodebb-plugin-composer-default`, `nodebb-plugin-mentions`, `nodebb-plugin-emoji` | Bundled with NodeBB |
| `nodebb-plugin-dbsearch` | Search. Test Hebrew search early, because prefixes (ו/ה/ב/ל/מ/ש) hurt matching |
| `nodebb-plugin-question-and-answer` | Mark a reply as "solved" in help categories |
| `nodebb-plugin-calendar` | Contest deadlines, webinars, meetups |
| `nodebb-plugin-2factor`, `nodebb-plugin-sso-google` | Security and easy login |
| An S3 uploads plugin | Keeps large PDF and image uploads off the server |
| `nodebb-plugin-spam-be-gone` | Anti-spam |

> Check each plugin's compatibility with your exact NodeBB version in the ACP before installing.

---

## 4. Custom plugins

### 4.1 `nodebb-plugin-trust-tiers` · דרגות אמון (**built and tested**)

| Tier | Badge | Needs (plus every lower tier's needs) | Unlocks |
|---|---|---|---|
| 1 | נקודה · Dot | registered | post in the forum, enter contests |
| 2 | אות · Letter | **5 posts or answers**, confirmed email, reputation ≥ 0 | **post jobs** (moderated), upload PDFs, vote in contests |
| 3 | שורה · Line | 30 posts, reputation 15, 14 days | jobs publish instantly, signature with links |
| 4 | עמוד · Page | 100 posts, reputation 60, 60 days | professionals' lounge, eligible to judge |
| 5 | ספר · Book | 300 posts, reputation 200, 180 days | moderator or mentor candidate, featured listing |

How it works:

- Each tier is a NodeBB group, so the badge appears next to every post.
- Tiers update immediately on posts, votes, logins, email confirmation and bans, and an hourly sweep catches age-based promotions.
- Members get a notification when they move up. Banned members lose their tier and get it back on unban.
- All the numbers, badge names and manual overrides (for example, a publisher you verified) are set in the ACP.

Tested end to end on NodeBB 4.16.9 + Postgres: all 38 checks passed. Details in its [README](plugins/nodebb-plugin-trust-tiers/README.md).

### 4.2 `nodebb-plugin-contests` · תחרויות (scoring engine **built**, the rest is phase 2)

**Why custom:** NodeBB permissions can't express "everyone can submit, but only you and the judges see your entry
until the deadline", and blind submission is what makes a contest fair.

```
Draft → Open for submissions → Judging → Public vote → Results → Archived
```

- **Contest page:** brief, sample text to set (for example "set this Mishnah with Bartenura around it"), rules, file types
  (PDF/PNG/IDML), prizes, sponsor, countdown.
- **Blind submissions** stored by the plugin, visible only to the author and the judges. Judges see "Entry #7", not names.
- **Judging rubric** (1–10 each): readability 30%, typographic hierarchy 25%, accuracy (nikud, text) 25%, creativity 20%.
- **Scoring, 70/30 (done):** judge points and public points are each scaled so the best entry gets 100 and the
  weakest 0. Then **final = 0.7 × judges + 0.3 × public**. Without the scaling, the public's 30% would outweigh
  the judges, because vote counts spread much more than judges' averages. In practice the judges' pick wins a
  head-to-head disagreement, and the public decides close calls.
- **Who votes:** tier 2+, not for yourself, judges don't vote, at most 3 entries per voter.
- **Reveal** at the deadline: each entry becomes a topic, so comments and votes work normally.
- **Results:** a winners page, a "זוכה תחרות" badge, and entries that feed into profiles.
- **Sponsored contests:** publishers and printers fund prizes, which is a revenue stream.

### 4.3 Jobs board · לוח משרות

**Now (no extra code):** the דרושים / זמינים לעבודה boards, gated by trust tier and moderated for tier 2, with a pinned
posting guide (language, role, budget, deadline, required software).

**Phase 2, `nodebb-plugin-jobs`:**

- structured fields (language, role, job type, remote/location, budget per page/word/project, deadline)
- a filter page
- **Apply**, which opens a private chat with the poster and includes the applicant's portfolio
- auto-expiry after 30 days and a "Filled" button
- alerts ("notify me of new Yiddish proofreading jobs")
- a "report scam" button
- two-way reviews after a job
- optional paid featured posts

### 4.4 Smaller pieces (phase 3)

- **Toolbox · ארגז כלים:** Yiddish spelling converter (YIVO ↔ Hasidic), roshei-teivos lookup, Hebrew font list with
  licensing notes, InDesign GREP/script library, price calculator.
- **Font preview** blocks in posts, **PDF preview** on upload, and a **weekly digest** email.

---

## 5. UI / UX direction

The prototype in [`mockup/index.html`](mockup/index.html) shows the direction, including tier badges, the
"your progress to the next tier" card, the locked job-post button and the 70/30 results card.

- **Typographic identity:** headings in a classical Hebrew serif (Frank Ruhl Libre), body in a clean sans (Heebo).
  The site should itself look *well typeset*, which is the best marketing for this audience.
- **Palette:** ink navy, paper cream, printer's red and gold. Full dark mode.
- **Language worlds** as filters on one "what's new" feed, so nobody is trapped in one language.
- **One header:** Forum · Contests · Jobs · Toolbox, plus search, notifications and avatar. A bottom tab bar on phones.
- **Mixed direction:** `dir="auto"` on titles and posts, so English renders left to right.
- **Accessibility:** real buttons and links, visible focus, AA contrast.

To implement it in NodeBB, copy `nodebb-theme-harmony` into `nodebb-theme-beit-haorchim` and override its SCSS and templates.
Small changes can start in ACP → Appearance → Custom CSS.

---

## 6. Technical setup

Full walkthrough: [`docker/README.md`](docker/README.md).

- **App:** NodeBB 4.16 in Docker (`ghcr.io/nodebb/nodebb:4.16`) on a 2 vCPU / 4 GB VPS, with Caddy for automatic HTTPS.
- **Database: Supabase Postgres.**
  - Use the **session pooler (port 5432)**. NodeBB uses prepared statements, which the transaction pooler (6543) breaks.
  - Connect as a **dedicated `nodebb` role** ([SQL](docker/supabase/01-nodebb-role.sql)). Supabase automatically exposes tables
    made by the default `postgres` role to its REST API. NodeBB must use the `public` schema (it hard-codes it) and
    stores password hashes and emails there.
  - **Turn the Data API off** in Supabase.
  - **Verified TLS:** trust Supabase's CA certificate through `NODE_EXTRA_CA_CERTS`.
  - **Pool size:** keep it under the pooler limit (`postgres__options__max=10`).
  - **Region:** put the server in the **same region** as the database, because NodeBB runs many small queries per page.
- **Email (SMTP) is required**, because tier 2 needs a confirmed email address.
- **Backups:** Supabase daily backups (Pro plan), plus the uploads volume (or S3 uploads).
- **Repository layout:**
  ```
  local/                          one-command local test forum (setup.sh)
  docker/                         compose file, Caddy, Supabase SQL, deploy guide
  plugins/nodebb-plugin-trust-tiers   the 5-tier ladder (done)
  plugins/nodebb-plugin-contests      scoring engine (done), plugin (phase 2)
  scripts/bootstrap.mjs           categories, privileges, ActivityPub off
  mockup/                         static UI prototype
  ```

---

## 7. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0 · Setup** | Supabase + Docker, trust tiers, categories and privileges, ActivityPub off | **Ready to deploy** (`docker/README.md`) |
| **1 · Soft launch** (weeks 2–4) | Invite 30–50 known typesetters, seed content, first contest run by hand (the 70/30 scoring engine is ready) | next |
| **2 · Plugins** (months 2–3) | Contests plugin (blind submissions, judging UI, reveal), jobs plugin (fields, apply-by-chat, expiry, alerts) | |
| **3 · Theme and tools** (months 3–4) | Custom theme from the mockup, toolbox, font preview, digest email | |
| **4 · Growth** | Sponsored contests, featured jobs, reviews, mentorship, webinars | |

---

## 8. Community and policy notes

- **Write clear rules:**
  - No copyrighted fonts or pirated software.
  - Credit original designers.
  - Contest entries stay the designer's property unless a sponsored contest says otherwise.
- **Moderation standards for images:** decide early. Many members will expect a clean, "kosher" visual environment.
- **Review the tier thresholds after the first month.** If tier 2 attracts spam, add an account-age requirement
  (for example 2 days) in the ACP. If honest members wait too long, lower the tier 3 numbers.
- **Seed content before launch:** 20–30 strong Q&A threads, a font guide and a pricing-survey thread.
- **Launch with a contest.** It brings designers in and creates showcase content.

---

## 9. Still open

1. **Monetization:** none at first, sponsored contests, or featured job posts?
2. **Email provider** for SMTP (needed before launch).
3. **Domain**, and the **Supabase region and plan** (Pro is recommended for the live site).
4. **"Available for work" listings:** they currently follow the same tier-2 rule as job posts. Should freelancers be able to list themselves from day one?

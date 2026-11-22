# בית העורכים — Plan for a NodeBB community for Hebrew & Yiddish typesetters and designers

## 1. Vision

A professional home for people who **set, design, proofread and publish** Jewish-language text:
seforim, journals, weekly alonim, Yiddish newspapers, kids' books, academic Hebrew, English Torah books.

The site has three pillars:

| Pillar | What it is | Why people come back |
|---|---|---|
| **Forum** (פורום) | Q&A and discussion, split by language "world" | Daily problem-solving: nikud, fonts, InDesign, spelling rules |
| **Contests** (תחרויות) | Design/typesetting challenges with a brief, deadline, blind submissions and judging | Portfolio-building, recognition, fun |
| **Jobs** (לוח משרות) | Job posts + "available for work" listings | Income — the strongest reason to register |

Everything is built on **open-source NodeBB (v4.x, GPLv3)**, using built-in features first and
custom plugins only where NodeBB has no answer.

---

## 2. Information architecture (NodeBB categories)

NodeBB categories can be nested, have their own icon/color/background, and have per-group privileges.
Map your four language "cubes" to top-level categories:

```
📜 לשון הקודש
   ├─ עימוד ספרי קודש (layout of seforim: tzuras hadaf, Rashi script, mefarshim around text)
   ├─ הגהה ומראי מקומות
   ├─ פענוח כתבי יד וראשי תיבות
   └─ ניקוד וטעמים
📖 אידיש
   ├─ כתיב: חסידיש vs. ייווא (spelling conventions)
   ├─ עלונים וצייטונגען
   └─ איבערזעצונגען (translation)
✒️ עברית
   ├─ עריכה לשונית / ספרותית / אקדמית
   ├─ ניקוד לספרי ילדים
   └─ כללי האקדמיה ללשון
🔤 English
   ├─ Transliteration standards
   └─ Translating Torah works
🛠 Cross-language (shared)
   ├─ InDesign / Affinity / QuarkXPress (RTL, ME edition, scripts, GREP)
   ├─ פונטים עבריים (font identification, licensing, kerning)
   ├─ דפוס והפקה (prepress, paper, binding, printers' specs)
   ├─ Portfolio / show your work
   └─ עסקים ותמחור (pricing, contracts, getting paid)
🏆 תחרויות           ← powered by the contests plugin
💼 לוח משרות         ← powered by the jobs plugin
📣 הכרזות והנהלה
```

Tip: keep **"Jobs" and "Contests" global** (a filter by language inside them), rather than duplicating
them in each language world — the audience is small and splitting it makes boards look empty.

---

## 3. Features — what NodeBB gives you out of the box

Turn these on and configure them before writing any code:

- **RTL & Hebrew UI** — NodeBB ships a Hebrew translation (`he`) and flips the layout to RTL automatically.
- **Harmony theme** (default in v3/v4) — modern, mobile-friendly; fork it for the custom look.
- **Groups + badges** — e.g. "מגיה מוסמך", "Verified Typesetter", "Contest Winner 5786", "Employer".
  Groups can be shown as badges next to usernames and can gate categories.
- **Reputation / upvotes** — reward good answers; set minimum reputation for posting in Jobs (anti-spam).
- **Tags** — `nikud`, `indesign`, `rashi-script`, `kerning`, `yivo`, `footnotes`…
- **Chat** (private + group rooms) — used for "Apply to job" and contest judges' room.
- **Topic thumbnails & uploads** — portfolio images, PDF samples.
- **Post queue / moderation** — queue first posts of new users.
- **Custom profile fields** (ACP → Manage → Custom user fields in v4) — languages, software, years of experience,
  portfolio URL, "open for work" toggle.
- **Webhooks / Write API** — for later integrations (newsletter, WhatsApp/Telegram digests).
- **ActivityPub** (v4) — consider *disabling* federation if the community prefers to stay private.

### Recommended official / well-maintained plugins

| Plugin | Use |
|---|---|
| `nodebb-plugin-markdown` + `nodebb-plugin-composer-default` | Posting (default) |
| `nodebb-plugin-mentions`, `nodebb-plugin-emoji` | Default social features |
| `nodebb-plugin-dbsearch` | Search — test Hebrew search quality early (prefixes ו/ה/ב/ל/מ/ש hurt matching) |
| `nodebb-plugin-reactions` | Lightweight reactions on posts and contest entries |
| `nodebb-plugin-poll` | Public-vote rounds in contests, community polls |
| `nodebb-plugin-question-and-answer` | Mark a reply as "solved" in help categories |
| `nodebb-plugin-calendar` | Contest deadlines, webinars, meetups |
| `nodebb-plugin-2factor`, `nodebb-plugin-sso-google` | Security & easy login |
| `nodebb-plugin-s3-uploads` (or similar) | Store large PDF/image uploads off-server |
| `nodebb-plugin-spam-be-gone` | Anti-spam |

> Always check each plugin's compatibility with your exact NodeBB version in the ACP plugin list before installing.

---

## 4. Custom plugins you will need to build

NodeBB plugins are Node.js packages (`nodebb-plugin-*`) that hook into the core (`plugin.json` → hooks,
routes, templates, ACP pages). Two custom plugins make this site unique.

### 4.1 `nodebb-plugin-contests` — תחרויות

**Why custom:** NodeBB privileges cannot do "everyone can post, but only you and judges see your post until the deadline".
Blind submission is the core of a fair contest, so it needs its own storage.

**Lifecycle**

```
Draft → Open for submissions → Judging (closed) → Public vote (optional) → Results → Archived
```

**Features**
- Contest page: brief, sample text to set (e.g. "set this daf of Mishnah with Bartenura around it"),
  rules, allowed file types (PDF/PNG/IDML), prizes, sponsor, deadline countdown.
- **Blind submissions**: stored in the plugin's own DB keys (`contest:<id>:entries`), visible only to the
  author + `contest-judges` group. Optional anonymous mode (judges see "Entry #7", not names).
- **Judging rubric**: per-criterion scores (readability, typographic hierarchy, nikud accuracy, creativity).
- **Reveal**: at the deadline, the plugin auto-publishes each entry as a topic in the contest category,
  so normal comments/reactions work.
- **Public vote** (optional): one vote per verified account, account age ≥ N days, no voting for yourself.
- **Results**: winners page; auto-award a group badge ("זוכה תחרות") + reputation bonus; entries feed into profiles.
- Categories of contests: cover design, page layout (צורת הדף), Hebrew lettering/logo, Yiddish newspaper front page,
  nikud accuracy speed-challenge, "fix this bad layout" challenge.
- Sponsored contests: publishers/printers sponsor prizes and get the winning design → a revenue stream.

**Data model sketch**
```
contest:<cid>            hash  { title, brief, lang, type, opensAt, closesAt, voteEndsAt, status, rubric, prizes, sponsor }
contests:sorted          zset  score = closesAt
contest:<cid>:entries    zset  uid → submittedAt
contest:<cid>:entry:<uid> hash { files, note, tid (after reveal), scores, votes }
```

### 4.2 `nodebb-plugin-jobs` — לוח משרות

**Why custom:** a plain category works for v1, but jobs need structured fields, filters, expiry and an "apply" flow.

**Two listing types**
1. **דרושים** — employer posts a job.
2. **זמין לעבודה** — freelancer posts availability + portfolio.

**Structured fields**: language (לה"ק / אידיש / עברית / English), role (typesetter, designer, proofreader,
nikud, translator, editor), job type (one-off / ongoing / full-time), remote/location, budget range or
"per page / per word", deadline, required software, sample required (yes/no).

**Features**
- Filter + search page (`/jobs`) with chips for language and role.
- **Apply** button → opens a NodeBB private chat with the poster, pre-filled with the applicant's profile & portfolio
  (no public bidding wars in comments).
- Auto-expiry after 30 days; poster can mark **"נמצא מועמד / Filled"**.
- Email/push **alerts**: "notify me of new Yiddish proofreading jobs".
- Trust & safety: only users with verified email + min reputation, or the `Employer` group, can post;
  first job of each poster goes to moderation queue; "report scam" button.
- **Reviews after the job** (both sides, 1–5 + text) — builds the reputation that makes the board valuable.
- Optional paid "featured" job posts — another revenue stream.

**v1 shortcut (no code):** create a "Jobs" category with a **topic template** (pinned how-to + required tags
like `lang-yiddish`, `role-proofreader`) and use `question-and-answer` "solved" as "filled". Move to the plugin in phase 2.

### 4.3 Smaller custom pieces (phase 3)
- **ארגז כלים / Toolbox** pages (custom pages via `nodebb-widget-*` or a small plugin):
  - Gematria & roshei-teivos lookup, Yiddish spelling converter (YIVO ↔ Hasidic), Hebrew font list with
    licensing notes, InDesign GREP/script library, price calculator (per page / per word / per hour).
- **Font preview widget** — in posts, render ` ```font:Frank Ruhl Libre ``` ` blocks with that font.
- **PDF preview** in posts (render first page as image on upload).
- **Weekly digest** — "best answers + new jobs + contest deadlines" email.

---

## 5. UI / UX direction

The prototype in [`mockup/index.html`](mockup/index.html) shows the direction. Key decisions:

- **Typographic identity**: headings in a classical Hebrew serif (Frank Ruhl Libre), body in a clean sans
  (Heebo/Assistant). The site itself should look *well typeset* — that is the best marketing for this audience.
- **Palette**: ink-navy, paper-cream, and a printer's-red / gold accent. Full dark mode.
- **Language worlds** stay as the landing experience (your 4 cubes), but the forum home also shows a unified
  "what's new" feed so a user isn't trapped in one language.
- **One global header**: Forum · Contests · Jobs · Toolbox · search · notifications · avatar.
  The language switcher becomes a pill/segment control, not a full-screen detour.
- **Mixed-direction text**: set `dir="auto"` on titles/posts so English topics render LTR inside the RTL site.
- **Mobile first**: many users will browse on phones; bottom tab bar on mobile.
- **Accessibility**: real buttons/links (not `div onclick`), visible focus, AA contrast.

Implementing the design in NodeBB: fork `nodebb-theme-harmony` → `nodebb-theme-beit-haorchim`,
override SCSS variables and templates (`.tpl` Benchpress files). Small changes can be done with ACP → Appearance → Custom CSS first.

---

## 6. Technical setup

- **Stack**: NodeBB v4 · Node.js LTS · **PostgreSQL** or **MongoDB** (both fine; Redis additionally for sessions/pubsub if you scale) · nginx reverse proxy with TLS · Docker Compose (NodeBB's repo ships a `docker-compose.yml` to start from).
- **Hosting**: a 2 vCPU / 4 GB VPS is plenty for the first few thousand users. Uploads to S3-compatible storage.
- **Backups**: nightly DB dump + uploads sync, tested restore.
- **Email**: transactional provider (SMTP plugin) — needed for verification, job alerts, digests.
- **Repo layout** (suggested):
  ```
  /docker            compose files, nginx config
  /plugins/nodebb-plugin-contests
  /plugins/nodebb-plugin-jobs
  /themes/nodebb-theme-beit-haorchim
  /mockup            static UI prototype
  ```
  Develop plugins locally with `npm link` into the NodeBB install, then `./nodebb build && ./nodebb restart`.

---

## 7. Roadmap

| Phase | Scope | Rough effort |
|---|---|---|
| **0 — Setup** (week 1) | Install NodeBB + DB in Docker, Hebrew language, categories, groups, core plugins, custom CSS | days |
| **1 — Soft launch** (weeks 2–4) | Invite 30–50 known typesetters; Jobs as a templated category; first contest run manually (submissions by chat to an admin) | low |
| **2 — Plugins** (months 2–3) | `nodebb-plugin-jobs` (fields, filters, apply-by-chat, expiry, alerts); `nodebb-plugin-contests` (blind submissions, judging, reveal, badges) | main dev work |
| **3 — Theme & tools** (months 3–4) | Custom theme from the mockup, toolbox pages, font preview, digest email | medium |
| **4 — Growth** | Sponsored contests, featured jobs, reviews, mentorship program, webinars | ongoing |

---

## 8. Community & policy notes

- Write clear rules: no posting of copyrighted fonts or pirated software; credit original designers in contests;
  contest entries' rights stay with the designer unless a sponsored contest states otherwise.
- Decide early on moderation standards for images (many members will expect a clean, "kosher" visual environment).
- Seed content before launch: 20–30 high-quality Q&A threads, a font guide, and a pricing survey thread.
- Launch with a contest — it's the fastest way to bring designers in and generate showcase content.

---

## 9. Open decisions

1. Database: PostgreSQL vs. MongoDB?
2. Language worlds as top-level categories (recommended) or separate sub-sites?
3. Who can post jobs: anyone verified, or only approved `Employer` group?
4. Contest judging: judges only, public vote only, or hybrid (recommended: 70% judges / 30% public)?
5. Monetization: none at first, sponsored contests, featured jobs?

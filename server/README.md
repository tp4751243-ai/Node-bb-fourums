# Test forum on a Hetzner server

About €4–5 a month. Everything installs itself; you never need a command window.
You get an address like `https://1-2-3-4.sslip.io` (your server's number with dashes), with a real HTTPS lock.

## 1. GitHub key (only while the repository is private)

The server has to download this repository. Create a read-only key for it:

1. GitHub → your picture (top right) → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. Name: `hetzner`, Expiration: 30 days.
3. **Repository access** → *Only select repositories* → `Node-bb-fourums`.
4. **Permissions** → *Repository permissions* → **Contents: Read-only**.
5. **Generate token**, and copy it (it starts with `github_pat_`).

## 2. Create the server

1. Sign up at <https://console.hetzner.cloud> (they ask for ID or a payment method), then **New project**.
2. In the project: **Add Server**, and choose:

| Setting | Choose |
|---|---|
| Location | Falkenstein, Nuremberg or Helsinki |
| Image | **Ubuntu 24.04** |
| Type | **x86 (Intel/AMD)**, the cheapest type with **at least 4 GB RAM** (not the 1 GB ones) |
| Networking | keep **Public IPv4** switched on |
| SSH keys | skip (Hetzner emails you a root password instead) |
| **Cloud config** | paste all of [`hetzner-setup.sh`](hetzner-setup.sh), then fill in its three lines |

In the three lines: your email, an admin password (**letters and numbers only**, 12 or more), and the GitHub key
from step 1 between the quotes.

3. **Create & Buy now**.

## 3. Open it (after about 15 minutes)

The server's page shows its **IP address**, for example `5.75.180.12`. Replace the dots with dashes and open:

| What | Address |
|---|---|
| Forum | `https://5-75-180-12.sslip.io` |
| Admin panel | `https://5-75-180-12.sslip.io/admin` |
| Test inbox (all emails the forum sends) | `https://mail.5-75-180-12.sslip.io` |

Log in as **admin** with the password you chose (the test inbox asks for the same).

> **Your filter:** Techloq has to allow the `sslip.io` address. If it's blocked, ask them to allow it, or
> we connect your own domain instead.

> **Emails stay in the test inbox:** confirmation emails don't reach people's real mailboxes. To let a tester
> post jobs (tier 2 needs a confirmed email), confirm their email from Admin → Manage → Users, or turn off
> *"Tier 2 and up require a confirmed email"* in Admin → Plugins → Trust tiers.

## If it doesn't come up after 20 minutes

In Hetzner: open the server → **Console** (top right) → log in as `root` with the password Hetzner emailed →
type `tail -40 /var/log/beit-install.log` and Enter. Send me what it shows.

## Later: install updates from GitHub

In the same console:

```bash
cd /opt/beit-haorchim && git pull && bash server/install.sh x x
```

(The `x x` are ignored once the forum exists; your settings and data are kept.)
If the repository is private, `git pull` asks for a username (anything) and a password (a GitHub key).

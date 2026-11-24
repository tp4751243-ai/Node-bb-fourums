# Test forum on Oracle Cloud (free)

Oracle's "Always Free" tier includes an Arm server with up to 4 cores and 24 GB of memory. It's free for as long
as you use it. The same setup script as on Hetzner installs everything.

## 1. Account

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**. A credit card is needed to verify you;
   free resources aren't charged.
2. **Home region**: you pick this once and can't change it. Free Arm servers are often "out of capacity" in busy
   regions. Choose a region near you (for example *Israel Central (Jerusalem)* or a European one).
3. Wait for the "your account is ready" email (minutes to an hour).

## 2. GitHub key

Same as for Hetzner (needed while the repository is private): see step 1 in [README.md](README.md).

## 3. Create the server

Menu (☰) → **Compute** → **Instances** → **Create instance**.

| Section | Choose |
|---|---|
| Name | `beit-haorchim` |
| **Image and shape** → Image | **Change image** → **Canonical Ubuntu** → **24.04** |
| **Image and shape** → Shape | **Change shape** → **Ampere** → **VM.Standard.A1.Flex**, **2 OCPUs, 12 GB memory** (look for the *Always Free-eligible* label) |
| Networking | keep **Create new virtual cloud network** and **Assign a public IPv4 address** |
| Add SSH keys | **Generate a key pair for me** → **Save private key** (keep the file; you may need it later) |
| **Advanced options** (bottom) → **Management** | **Paste cloud-init script**, then paste all of [`hetzner-setup.sh`](hetzner-setup.sh) with its three lines filled in |

Click **Create**. If you see **"Out of capacity"**, try again later or pick another *Availability domain* at the top
of the Placement section. This is normal on Oracle's free tier.

## 4. Open the web ports in Oracle's network firewall

The installer opens the server's own firewall. Oracle's network has a second firewall that only you can change:

1. Open the instance → **Primary VNIC** → click the **Subnet** name → **Security** (or *Security Lists*) →
   **Default Security List** → **Add Ingress Rules**.
2. Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port Range `80,443` → **Add Ingress Rules**.

## 5. Open the forum (about 15 minutes after creating)

The instance page shows the **Public IP address**, for example `141.145.1.2`. Replace the dots with dashes and open
`https://141-145-1-2.sslip.io` (the test inbox is `https://mail.141-145-1-2.sslip.io`). Log in as **admin**.

## If it doesn't come up

Instance page → **Console connection** → **Launch Cloud Shell connection**. Log in, then run
`sudo tail -40 /var/log/beit-install.log` and send the output.

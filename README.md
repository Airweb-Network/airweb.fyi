# AirWeb

Expose `localhost` to the internet over a reverse SSH tunnel — and earn credits while you do.

One Node.js process runs an **SSH server** (accepts `ssh -R`), an **HTTP reverse proxy** (routes `*.your-domain` to the matching tunnel), and a **dashboard** at `/dashboard` for accounts, credits, handles and the lease marketplace.

No usernames or passwords. Your Ed25519 key (generated and downloaded at sign-up) **is** your account. Address = `aw_` + base32 of `sha256(ssh_public_key)[0:10]` (19 chars total).

---

## Use it (tunnel owner)

1. Open `https://airweb.fyi/dashboard` → **Create account** → save the downloaded key file (named after the server's domain and your account id, e.g. `airweb.fyi_<your account id>_key.txt`).
2. `chmod 600 ./airweb.fyi_<your account id>_key.txt`
3. Tunnel `localhost:3000` out as `mysub.airweb.fyi`:
   ```sh
   ssh -i ./airweb.fyi_<your account id>_key.txt -p 2222 -o IdentitiesOnly=yes \
       -N -R 80:localhost:3000 mysub@airweb.fyi
   ```
4. Watch credits accrue on the dashboard (1/min per online tunnel by default).

Convenience wrapper: `node client/airweb.js --key ./airweb.fyi_<your account id>_key.txt --sub mysub --local 3000`.

Lost the key = lost the account. Re-import on another machine at `/login`.

---

## Run the server locally

Requires Node.js ≥ 18.

```sh
npm install
npm start
```

Defaults: SSH `:2222`, HTTP `:8080`, state in `./data/airweb.sqlite`, SSH host key auto-generated into `./keys/` on first run. Drop a `config.json` next to `config.default.json` to override any field.

The admin UI is the regular dashboard — it shows an extra panel when you sign in as admin. **First account to register is auto-promoted.** Promote others from that panel.

---

## Deploy on CentOS / RHEL / Rocky / Alma

Fresh box, one-time setup. Replace `airweb.fyi` everywhere.

### 1. DNS
Two A records pointing at the VPS:
- `airweb.fyi   → <vps-ip>`
- `*.airweb.fyi → <vps-ip>`

### 2. Install + clone + start
```sh
sudo dnf install -y git nginx certbot
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

sudo firewall-cmd --permanent --add-service={http,https} --add-port=2222/tcp
sudo firewall-cmd --reload

sudo git clone https://github.com/YOU/airweb.git /opt/airweb
sudo npm --prefix /opt/airweb install
```

### 3. Config

The public domain and scheme are read from environment variables (or a `.env`
file in the project root). Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Production `.env`:
```
AIRWEB_PUBLIC_DOMAIN=airweb.fyi
AIRWEB_PUBLIC_SCHEME=https
```

Local development uses `lvh.me` (which resolves `*.lvh.me` to `127.0.0.1`):
```
AIRWEB_PUBLIC_DOMAIN=lvh.me:8080
AIRWEB_PUBLIC_SCHEME=http
```

Anything else (ports, credit rates, etc.) can still be overridden by creating
`config.json` next to `config.default.json`:
```json
{
  "http": { "host": "127.0.0.1" }
}
```

### 4. systemd service
`/etc/systemd/system/airweb.service`:
```ini
[Unit]
Description=AirWeb
After=network.target

[Service]
WorkingDirectory=/opt/airweb
ExecStart=/usr/bin/node server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
```sh
sudo systemctl enable --now airweb
```

### 5. nginx + TLS
```sh
sudo tee /etc/nginx/conf.d/airweb.conf >/dev/null <<'EOF'
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 80;
    server_name airweb.fyi *.airweb.fyi;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
EOF

sudo setsebool -P httpd_can_network_connect 1
sudo nginx -t && sudo systemctl enable --now nginx
```

Wildcard cert (Let's Encrypt needs DNS-01 — pick your DNS plugin from [certbot docs](https://eff-certbot.readthedocs.io/en/stable/using.html#dns-plugins)):
```sh
sudo dnf install -y python3-certbot-dns-cloudflare
echo 'dns_cloudflare_api_token = YOUR_TOKEN' | sudo tee /etc/letsencrypt/cloudflare.ini
sudo chmod 600 /etc/letsencrypt/cloudflare.ini
sudo certbot --nginx \
  --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d 'airweb.fyi' -d '*.airweb.fyi' \
  --agree-tos -m you@example.com --non-interactive
```

### 6. Verify
```sh
curl -s https://airweb.fyi/api/config
```
Sign up at `https://airweb.fyi/dashboard` — the first account is the admin.

### Ops
- **Update:** `sudo git -C /opt/airweb pull && sudo npm --prefix /opt/airweb install && sudo systemctl restart airweb`
- **Logs:** `journalctl -u airweb -f`
- **Backup:** `sqlite3 /opt/airweb/data/airweb.sqlite ".backup '/var/backups/airweb-$(date +%F).db'"`

---

## API

Session cookie `airweb_sid` set on register/login. All JSON.

| Method | Path                                       | Notes |
|--------|--------------------------------------------|-------|
| POST   | `/api/register`                            | Generates keypair, returns `privateKey` once. |
| POST   | `/api/login`                               | `{ privateKey, passphrase? }` |
| POST   | `/api/logout`                              | |
| GET    | `/api/me`                                  | Account summary. |
| GET    | `/api/config`                              | Public limits/prices. |
| POST   | `/api/handles`                             | `{ handle }` — claim a permanent subdomain. |
| GET    | `/api/listings`                            | Browse marketplace. |
| POST   | `/api/listings`                            | `{ title, description, pricePerMinute }` |
| DELETE | `/api/listings/:id`                        | |
| POST   | `/api/listings/:id/lease`                  | |
| POST   | `/api/leases/:id/end`                      | |
| GET    | `/api/admin/overview`                      | **admin** — tunnels + accounts + listings. |
| GET    | `/api/admin/tunnels`                       | **admin** |
| GET    | `/api/admin/events`                        | **admin** — SSE stream. |
| POST   | `/api/admin/tunnels/:id/disconnect`        | **admin** |
| POST   | `/api/admin/accounts/:address/role`        | **admin** — `{ isAdmin }` |

---

## Not in scope

Real-money top-ups, KYC, escrow, clustering, on-chain settlement (the `aw_…` address is derived from an Ed25519 SSH key and is not a blockchain wallet).

## License

MIT.

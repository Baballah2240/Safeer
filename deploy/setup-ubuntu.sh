#!/usr/bin/env bash
# Safeer on a fresh Ubuntu 24.04 VPS (e.g. Namecheap). Run as root:
#   OWNER_EMAIL=you@example.com DOMAIN=safeer.mohbaba.online bash deploy/setup-ubuntu.sh
# Installs Node 24, PostgreSQL 16, Nginx and a Let's Encrypt certificate, then runs
# Safeer as the unprivileged "safeer" user under systemd. Safe to re-run for updates.
set -euo pipefail
: "${OWNER_EMAIL:?Set OWNER_EMAIL to the first owner account email}"
DOMAIN="${DOMAIN:-safeer.mohbaba.online}"
REPO="${REPO:-https://github.com/Baballah2240/Safeer.git}"
APP=/opt/safeer
ENV_FILE=/etc/safeer.env

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

# Firewall: SSH and web only. PostgreSQL stays on localhost.
ufw allow OpenSSH; ufw allow 'Nginx Full'; ufw --force enable

id safeer >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/safeer --shell /usr/sbin/nologin safeer

# Secrets are generated once and kept in a root-readable env file.
if [ ! -f "$ENV_FILE" ]; then
  OWNER_DB_PASSWORD=$(openssl rand -hex 32)
  APP_DB_PASSWORD=$(openssl rand -hex 32)
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=4320
SAFEER_PUBLIC_ORIGIN=https://$DOMAIN
SAFEER_OWNER_LOGIN=$OWNER_EMAIL
SAFEER_APP_DB_PASSWORD=$APP_DB_PASSWORD
DATABASE_URL=postgresql://safeer_owner:$OWNER_DB_PASSWORD@127.0.0.1:5432/safeer
EOF
  chmod 600 "$ENV_FILE"
  # Migration owner: owns the database and may create the limited safeer_app role, nothing more.
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
CREATE ROLE safeer_owner LOGIN CREATEROLE PASSWORD '$OWNER_DB_PASSWORD';
CREATE DATABASE safeer OWNER safeer_owner;
EOF
fi

# Code: clone or update, then build as the safeer user.
if [ -d "$APP/.git" ]; then git -C "$APP" fetch --quiet origin main && git -C "$APP" reset --quiet --hard origin/main
else git clone --quiet --branch main "$REPO" "$APP"; fi
chown -R safeer:safeer "$APP"
sudo -u safeer -H bash -c "cd $APP && npm ci --omit=optional && npm run build"

cat > /etc/systemd/system/safeer.service <<EOF
[Unit]
Description=Safeer
After=network-online.target postgresql.service
Requires=postgresql.service

[Service]
User=safeer
WorkingDirectory=$APP
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node scripts/production.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Nginx: port 4320 is closed by the firewall, so traffic arrives only through Nginx. Safeer reads the LAST X-Forwarded-For entry,
# which $proxy_add_x_forwarded_for sets to the real client address.
cat > /etc/nginx/sites-available/safeer <<EOF
server {
  listen 80;
  server_name $DOMAIN;
  client_max_body_size 2m;
  location / {
    proxy_pass http://127.0.0.1:4320;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
ln -sf /etc/nginx/sites-available/safeer /etc/nginx/sites-enabled/safeer
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

systemctl daemon-reload
systemctl enable --now safeer
systemctl restart safeer

# HTTPS (needs the DNS A record to point here already).
certbot --nginx --non-interactive --agree-tos --redirect -m "$OWNER_EMAIL" -d "$DOMAIN" || \
  echo "Certificate not issued yet. Check the DNS A record for $DOMAIN, then run: certbot --nginx -d $DOMAIN"

sleep 5
journalctl -u safeer -n 30 --no-pager
echo "Done. The first owner's temporary password is in the log above (journalctl -u safeer | grep 'Temporary password')."

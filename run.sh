#!/usr/bin/env bash
# One-command local setup and dev server.
#
#   ./run.sh              start services, load the database if it is empty, run Next.js
#   ./run.sh --reset      drop and reload the sample data first
#   ./run.sh --port 3001  use another port
#
# Needs: node, npm, mariadb, mongosh, and sudo (for systemctl and the DB user).

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

RESET=false
PORT="${PORT:-3000}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) RESET=true; shift ;;
    --port) PORT="${2:?--port needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

say() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
for cmd in node npm mariadb mongosh; do command -v "$cmd" >/dev/null || die "missing required command: $cmd"; done

say "Starting MariaDB and MongoDB"
sudo systemctl enable --now mariadb
sudo systemctl enable --now mongod

# --- .env.local -------------------------------------------------------------
[[ -f .env.local ]] || cp .env.example .env.local
env_get() { grep -E "^$1=" .env.local | tail -n1 | cut -d= -f2-; }
env_set() {
  if grep -q "^$1=" .env.local; then sed -i "s|^$1=.*|$1=$2|" .env.local; else printf '%s=%s\n' "$1" "$2" >> .env.local; fi
}
secret="$(env_get AUTH_SECRET)"
if [[ -z "$secret" || "$secret" == replace-with-* ]]; then env_set AUTH_SECRET "$(openssl rand -base64 32)"; fi
pass="$(env_get DB_PASSWORD)"
if [[ -z "$pass" || "$pass" == change-me ]]; then env_set DB_PASSWORD "$(openssl rand -hex 12)"; fi
env_set NEXTAUTH_URL "http://localhost:${PORT}"

DB_USER="$(env_get DB_USER)"; DB_PASSWORD="$(env_get DB_PASSWORD)"
MONGODB_URI="$(env_get MONGODB_URI)"; MONGODB_DB="$(env_get MONGODB_DB)"

# --- MariaDB ---------------------------------------------------------------
tables="$(sudo mariadb -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='hotel_crs'")"
if [[ "$RESET" == true || "$tables" == 0 ]]; then
  say "Loading schema and sample data"
  sudo mariadb < SQL/hotel_crs_ddl.sql
  sudo mariadb < SQL/hotel_crs_dml.sql > /dev/null
  RESET=true
else
  say "Keeping existing hotel_crs data (use --reset for a fresh demo)"
fi

say "Creating database user ${DB_USER}"
sudo mariadb <<SQL
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON hotel_crs.* TO '${DB_USER}'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON hotel_crs.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# --- MongoDB ---------------------------------------------------------------
if [[ "$RESET" == true ]] || [[ "$(mongosh --quiet "${MONGODB_URI}/${MONGODB_DB}" --eval 'db.hotel_features.countDocuments()')" == 0 ]]; then
  say "Seeding MongoDB amenities"
  mongosh --quiet "${MONGODB_URI}/${MONGODB_DB}" --eval 'db.hotel_features.deleteMany({})' > /dev/null
  mongosh --quiet "${MONGODB_URI}/${MONGODB_DB}" --file mongo/hotel_features_seed.js
fi

# --- App ---------------------------------------------------------------------
[[ -d node_modules ]] || { say "Installing dependencies"; npm install --no-audit --no-fund; }

say "Starting Next.js on http://localhost:${PORT}  (Ctrl+C to stop)"
printf '\nDemo logins (password Demo@1234):\n  guest  arjun.mehta@example.com\n  staff  staff.koramangala@example.com\n  admin  admin@example.com\n\n'
exec npm run dev -- --port "${PORT}"

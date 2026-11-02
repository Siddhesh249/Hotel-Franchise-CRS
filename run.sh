#!/usr/bin/env bash
# Hotel Franchise CRS — one-command local setup and dev server.
#
#   ./run.sh                 keep existing data, seed only if the DB is empty
#   ./run.sh --reset         drop and reload the sample database (fresh demo)
#   ./run.sh --no-browser    do not open the browser
#   ./run.sh --port 3001     use a different port
#
# The script asks for sudo once, starts MariaDB/MongoDB, creates the app DB
# user, seeds demo data when needed, starts Next.js, and opens the site.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

RESET=false
OPEN_BROWSER=true
PORT="${PORT:-3000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) RESET=true; shift ;;
    --no-browser) OPEN_BROWSER=false; shift ;;
    --port) PORT="${2:-3000}"; shift 2 ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

c_reset=$'\033[0m'
c_bold=$'\033[1m'
c_green=$'\033[32m'
c_yellow=$'\033[33m'
c_red=$'\033[31m'
c_cyan=$'\033[36m'

say()  { printf '%s\n' "${c_cyan}==>${c_reset} $*"; }
ok()   { printf '%s\n' "${c_green}  ✓${c_reset} $*"; }
warn() { printf '%s\n' "${c_yellow}  !${c_reset} $*"; }
die()  { printf '%s\n' "${c_red}  ✗${c_reset} $*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require node
require npm
require curl
require mariadb

say "Requesting sudo (needed to start database services and create the DB user)"
sudo -v || die "sudo is required"

say "Starting database services"
if command -v systemctl >/dev/null 2>&1; then
  if sudo systemctl enable --now mariadb >/dev/null 2>&1; then
    ok "MariaDB is running"
  else
    warn "Could not start MariaDB via systemctl; assuming it is already running"
  fi
  if sudo systemctl enable --now mongod >/dev/null 2>&1; then
    ok "MongoDB is running"
  elif sudo systemctl enable --now mongodb >/dev/null 2>&1; then
    ok "MongoDB is running"
  else
    warn "Could not start MongoDB via systemctl; the app will fall back to SQL-only mode"
  fi
else
  warn "systemctl not found; assuming MariaDB and MongoDB are already running"
fi

say "Waiting for MariaDB"
for _ in $(seq 1 30); do
  if sudo mariadb -e 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
sudo mariadb -e 'SELECT 1' >/dev/null 2>&1 || die "MariaDB is not reachable"

# ---------------------------------------------------------------------------
# Environment file
# ---------------------------------------------------------------------------
say "Preparing .env.local"
if [[ ! -f .env.local ]]; then
  [[ -f .env.example ]] || die ".env.example is missing"
  cp .env.example .env.local
  ok "Created .env.local from .env.example"
fi

read_env() {
  local key="$1" fallback="$2"
  local value
  value="$(grep -E "^${key}=" .env.local 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  printf '%s' "${value:-$fallback}"
}

DB_HOST="$(read_env DB_HOST 127.0.0.1)"
DB_PORT="$(read_env DB_PORT 3306)"
DB_USER="$(read_env DB_USER hotel_crs_app)"
DB_PASSWORD="$(read_env DB_PASSWORD change-me)"
DB_NAME="$(read_env DB_NAME hotel_crs)"
MONGODB_URI="$(read_env MONGODB_URI mongodb://127.0.0.1:27017)"
MONGODB_DB="$(read_env MONGODB_DB hotel_crs)"
AUTH_SECRET="$(read_env AUTH_SECRET '')"

if [[ -z "$AUTH_SECRET" || "$AUTH_SECRET" == "replace-with-a-long-random-secret" ]]; then
  AUTH_SECRET="$(openssl rand -base64 32 2>/dev/null || date +%s%N)"
  if grep -q '^AUTH_SECRET=' .env.local; then
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env.local
  else
    printf '\nAUTH_SECRET=%s\n' "$AUTH_SECRET" >> .env.local
  fi
  ok "Generated AUTH_SECRET"
fi

if grep -q '^NEXTAUTH_URL=' .env.local; then
  sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=http://localhost:${PORT}|" .env.local
else
  printf 'NEXTAUTH_URL=http://localhost:%s\n' "$PORT" >> .env.local
fi

if [[ "$DB_NAME" != "hotel_crs" ]]; then
  warn "DB_NAME is $DB_NAME; the SQL files use hotel_crs, so creating a temporary copy"
  sed "s/hotel_crs/${DB_NAME}/g" SQL/hotel_crs_ddl.sql > /tmp/hotel_crs_ddl.run.sql
  sed "s/hotel_crs/${DB_NAME}/g" SQL/hotel_crs_dml.sql > /tmp/hotel_crs_dml.run.sql
  DDL_FILE=/tmp/hotel_crs_ddl.run.sql
  DML_FILE=/tmp/hotel_crs_dml.run.sql
else
  DDL_FILE=SQL/hotel_crs_ddl.sql
  DML_FILE=SQL/hotel_crs_dml.sql
fi

# ---------------------------------------------------------------------------
# Database schema + sample data
# ---------------------------------------------------------------------------
DB_EXISTS="$(sudo mariadb -N -B -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${DB_NAME}'" 2>/dev/null || echo 0)"
TABLE_COUNT=0
if [[ "$DB_EXISTS" != "0" ]]; then
  TABLE_COUNT="$(sudo mariadb -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}'" 2>/dev/null || echo 0)"
fi

if [[ "$RESET" == "true" || "$DB_EXISTS" == "0" || "$TABLE_COUNT" == "0" ]]; then
  say "Loading schema and sample data (this creates a fresh demo database)"
  sudo mariadb < "$DDL_FILE"
  sudo mariadb < "$DML_FILE" >/dev/null
  ok "Database ${DB_NAME} seeded"
else
  ok "Keeping existing ${DB_NAME} data (use ./run.sh --reset for a clean demo)"
fi

say "Creating application database user ${DB_USER}"
sudo mariadb <<SQL
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "Application user ready"

# ---------------------------------------------------------------------------
# MongoDB amenities
# ---------------------------------------------------------------------------
if command -v mongosh >/dev/null 2>&1; then
  say "Seeding MongoDB amenities"
  for _ in $(seq 1 20); do
    if mongosh --quiet "${MONGODB_URI}" --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if [[ "$RESET" == "true" ]]; then
    mongosh --quiet "${MONGODB_URI}" --eval "db.getSiblingDB('${MONGODB_DB}').hotel_features.deleteMany({})" >/dev/null 2>&1 || true
  fi
  HOTEL_IDS="$(sudo mariadb -N -B -e "SELECT hotel_id FROM \`${DB_NAME}\`.hotel ORDER BY hotel_id" 2>/dev/null | paste -sd, - || true)"
  if [[ -z "$HOTEL_IDS" ]]; then
    warn "No hotels found; skipping MongoDB seed"
  elif mongosh --quiet "${MONGODB_URI}" --eval "
    const d = db.getSiblingDB('${MONGODB_DB}');
    d.hotel_features.createIndex({ hotel_id: 1 }, { unique: true });
    [${HOTEL_IDS}].forEach((id) => d.hotel_features.updateOne(
      { hotel_id: id },
      { \$setOnInsert: {
          hotel_id: id,
          amenities: { general: ['free wifi', 'parking'], wellness: ['gym'], policies: { pet_friendly: false } },
          room_type_features: {}
        } },
      { upsert: true }
    ));
  " >/dev/null 2>&1; then
    ok "Amenities seeded for hotels: ${HOTEL_IDS}"
  else
    warn "MongoDB seed failed; the app will fall back to SQL-only mode"
  fi
else
  warn "mongosh not found; skipping MongoDB amenities"
fi

# ---------------------------------------------------------------------------
# Dependencies + dev server
# ---------------------------------------------------------------------------
if [[ ! -d node_modules ]]; then
  say "Installing Node dependencies"
  npm install --no-audit --no-fund
  ok "Dependencies installed"
fi

if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
  warn "A server is already responding on http://localhost:${PORT}."
  die "Stop it first, or choose another port with --port <port>."
fi

LOG_FILE="$ROOT/.run-dev.log"
PID_FILE="$ROOT/.run-dev.pid"
DEV_PID=""
DEV_PGID=""
rm -f "$PID_FILE"

kill_tree() {
  local parent="$1"
  local child
  for child in $(ps -o pid= --ppid "$parent" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$parent" >/dev/null 2>&1 || true
}

cleanup() {
  trap - INT TERM EXIT
  if [[ -n "${DEV_PID:-}" ]]; then
    if kill -0 "$DEV_PID" >/dev/null 2>&1; then
      say "Stopping Next.js"
    fi
    if [[ -n "${DEV_PGID:-}" ]]; then
      kill -- "-${DEV_PGID}" >/dev/null 2>&1 || true
    else
      kill_tree "$DEV_PID"
    fi
    for _ in $(seq 1 50); do
      kill -0 "$DEV_PID" >/dev/null 2>&1 || break
      sleep 0.1
    done
    if kill -0 "$DEV_PID" >/dev/null 2>&1; then
      if [[ -n "${DEV_PGID:-}" ]]; then
        kill -9 -- "-${DEV_PGID}" >/dev/null 2>&1 || true
      else
        kill_tree "$DEV_PID"
        kill -9 "$DEV_PID" >/dev/null 2>&1 || true
      fi
    fi
    wait "$DEV_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}

on_signal() {
  cleanup
  exit 130
}

# Install the traps before starting the server, so an early Ctrl+C still
# reaches the cleanup path.
trap cleanup EXIT
trap on_signal INT TERM

say "Starting Next.js on http://localhost:${PORT}"

# Run the dev server in its own session/process group so Ctrl+C on this script
# can bring down npm, next, and the Turbopack workers together. The wrapper
# writes its PID first so we always know the real process group.
if command -v setsid >/dev/null 2>&1 && setsid --help 2>&1 | grep -q -- '--fork'; then
  setsid --fork sh -c 'echo $$ > "$1"; exec npm run dev -- --port "$2"' sh "$PID_FILE" "$PORT" >"$LOG_FILE" 2>&1
else
  npm run dev -- --port "${PORT}" >"$LOG_FILE" 2>&1 &
  printf '%s\n' "$!" >"$PID_FILE"
fi

for _ in $(seq 1 50); do
  [[ -s "$PID_FILE" ]] && break
  sleep 0.1
done

DEV_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "$DEV_PID" ]] || ! kill -0 "$DEV_PID" >/dev/null 2>&1; then
  tail -n 40 "$LOG_FILE" >&2 || true
  die "Next.js failed to start"
fi

# setsid makes the wrapper its own process-group leader. If setsid was not
# available, fall back to killing just the npm process and its children.
DEV_PGID="$(ps -o pgid= -p "$DEV_PID" 2>/dev/null | tr -d ' ' || true)"
if [[ "$DEV_PGID" != "$DEV_PID" ]]; then
  DEV_PGID=""
fi

for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
    ok "Application is ready"
    break
  fi
  if ! kill -0 "$DEV_PID" >/dev/null 2>&1; then
    tail -n 40 "$LOG_FILE" >&2 || true
    die "Next.js exited before the app became ready"
  fi
  sleep 1
done

if ! curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
  tail -n 40 "$LOG_FILE" >&2 || true
  die "Timed out waiting for http://localhost:${PORT}"
fi

if [[ "$OPEN_BROWSER" == "true" ]]; then
  (command -v xdg-open >/dev/null && xdg-open "http://localhost:${PORT}" >/dev/null 2>&1) \
    || (command -v open >/dev/null && open "http://localhost:${PORT}" >/dev/null 2>&1) \
    || (command -v start >/dev/null && start "http://localhost:${PORT}" >/dev/null 2>&1) \
    || warn "Could not open a browser automatically; visit http://localhost:${PORT}"
fi

printf '\n%s\n' "${c_bold}Demo accounts${c_reset}"
printf '  Guest:  arjun.mehta@example.com / Demo@1234\n'
printf '  Staff:  staff.koramangala@example.com / Demo@1234\n'
printf '  Staff:  staff.andheri@example.com / Demo@1234\n'
printf '  Admin:  admin@example.com / Demo@1234\n\n'
printf 'Dev log: %s\n' "$LOG_FILE"
printf 'Press Ctrl+C to stop the server.\n\n'

# `setsid --fork` detaches the dev server from this shell, so it is not our
# child and `wait` would fail with "not a child of this shell". Poll instead:
# this keeps run.sh in the foreground until the server exits or the user hits
# Ctrl+C (which the trap above turns into a process-group cleanup).
while kill -0 "$DEV_PID" >/dev/null 2>&1; do
  sleep 1
done

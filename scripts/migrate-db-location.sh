#!/usr/bin/env bash
# Move the SmartBrief SQLite database out of the git checkout to a stable path.
#
#   stop agent → sqlite3 .backup to target → integrity + row-count check
#   → point DATABASE_URL in .env/.env.local at target → start agent → health check
#
# Usage: scripts/migrate-db-location.sh [--dry-run]
#   --dry-run   print what would happen, change nothing
#
# Target dir: $SMARTBRIEF_DATA_DIR (default ~/Library/Application Support/smartbrief).
# The old DB file stays in place as a fallback. Env files are copied to
# <target dir>/env-backups/<timestamp>/ (outside the checkout) before editing.

set -euo pipefail

LABEL="${SMARTBRIEF_LAUNCHD_LABEL:-com.kevbu.smartbrief}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
URL="${SMARTBRIEF_LOCAL_URL:-http://127.0.0.1:3000/}"
DATA_DIR="${SMARTBRIEF_DATA_DIR:-$HOME/Library/Application Support/smartbrief}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f "$PLIST" ]] || fail "launchd agent not found: $PLIST"
REPO_DIR="$(plutil -extract WorkingDirectory raw "$PLIST")"
# shellcheck source=lib/db-path.sh
source "$(dirname "$0")/lib/db-path.sh"
command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 not found"

SRC="$(db_path "$REPO_DIR")" || fail "Could not resolve a file: DATABASE_URL from $REPO_DIR/.env.local or .env"
DST="$DATA_DIR/smartbrief.db"
NEW_URL="file:$DST"

[[ -f "$SRC" ]] || fail "Source database not found: $SRC"
[[ "$SRC" != "$DST" ]] || { echo "Already using $DST. Nothing to do."; exit 0; }
[[ ! -e "$DST" ]] || fail "Target already exists, refusing to overwrite: $DST"

ENV_FILES=()
for f in "$REPO_DIR/.env" "$REPO_DIR/.env.local"; do
  [[ -f "$f" ]] && grep -qE '^[[:space:]]*DATABASE_URL[[:space:]]*=' "$f" && ENV_FILES+=("$f")
done

step "Plan"
echo "Source:    $SRC"
echo "Target:    $DST"
echo "New URL:   DATABASE_URL=\"$NEW_URL\""
echo "Env files: ${ENV_FILES[*]:-(none)}"
echo "Agent:     $LABEL (stopped during copy, then restarted)"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Dry run: no changes made."
  exit 0
fi
[[ "${#ENV_FILES[@]}" -gt 0 ]] || fail "No env file defines DATABASE_URL in $REPO_DIR"

TABLES=(Article TopStory UserPreferences SourceWeight TopicWeight FeedbackSignal ArticleFeedback AppState)
counts() {
  local db="$1" t
  for t in "${TABLES[@]}"; do
    printf '%s=%s ' "$t" "$(sqlite3 "$db" "SELECT count(*) FROM \"$t\";" 2>/dev/null || echo missing)"
  done
}

start_agent() { launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl kickstart -k "gui/$(id -u)/$LABEL"; }

step "Stopping $LABEL"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || echo "(agent was not running)"
# Until the env files point at the new DB, any exit restarts the agent on the old one.
ROLLBACK=1
COPY_STARTED=0
on_exit() {
  [[ "$ROLLBACK" -eq 1 ]] || return 0
  echo
  if [[ "$COPY_STARTED" -eq 1 && -e "$DST" ]]; then
    rm -f -- "$DST"
    echo "Removed partial copy $DST."
  fi
  echo "Aborted. Restarting agent on the old database."
  start_agent
}
trap on_exit EXIT

step "Copying database"
mkdir -p "$DATA_DIR"
COPY_STARTED=1
sqlite3 "$SRC" ".backup '$DST'"

step "Verifying copy"
[[ "$(sqlite3 "$DST" 'PRAGMA integrity_check;')" == "ok" ]] || fail "Integrity check failed on $DST"
src_counts="$(counts "$SRC")"
dst_counts="$(counts "$DST")"
echo "Source: $src_counts"
echo "Target: $dst_counts"
[[ "$src_counts" == "$dst_counts" ]] || fail "Row counts differ"

step "Updating env files"
# Env backups go outside the checkout: a .bak next to .env is not gitignored
# and would leak secrets on the next `git add -A`.
ENV_BACKUP_DIR="$DATA_DIR/env-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ENV_BACKUP_DIR"
chmod 700 "$DATA_DIR/env-backups" "$ENV_BACKUP_DIR"
for f in "${ENV_FILES[@]}"; do
  bak="$ENV_BACKUP_DIR/$(basename "$f")"
  cp -p "$f" "$bak"
  tmp="$(mktemp)"
  awk -v url="$NEW_URL" '
    /^[[:space:]]*DATABASE_URL[[:space:]]*=/ { print "DATABASE_URL=\"" url "\""; next }
    { print }
  ' "$bak" >"$tmp"
  cat "$tmp" >"$f"
  rm -f -- "$tmp"
  echo "Updated $f (backup: $bak)"
done
ROLLBACK=0

step "Starting $LABEL"
start_agent

step "Waiting for $URL"
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
  if [[ "$code" =~ ^[23] ]]; then
    printf '\033[32m✓ SmartBrief now uses %s (HTTP %s)\033[0m\n' "$DST" "$code"
    echo
    echo "Old database left at: $SRC"
    echo "Rollback: copy the env files back from $ENV_BACKUP_DIR and run"
    echo "  launchctl kickstart -k gui/$(id -u)/$LABEL"
    exit 0
  fi
  sleep 1
done

fail "Server did not respond within 30s (last: ${code:-none}). Check ~/Library/Logs/smartbrief.log. Rollback: copy the env files back from $ENV_BACKUP_DIR and restart the agent."

#!/usr/bin/env bash
# Deploy SmartBrief to the local launchd service (http://localhost:3000).
#
#   pull main → install deps / push schema if they changed → build → restart → health check
#
# Usage: scripts/deploy-local.sh [--force]
#   --force   rebuild and restart even if main has no new commits
#
# The repo directory is read from the launchd agent's WorkingDirectory, so the
# script deploys the right checkout even when run from a git worktree.

set -euo pipefail

LABEL="${SMARTBRIEF_LAUNCHD_LABEL:-com.kevbu.smartbrief}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
URL="${SMARTBRIEF_LOCAL_URL:-http://127.0.0.1:3000/}"
BRANCH="main"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f "$PLIST" ]] || fail "launchd agent not found: $PLIST"
REPO_DIR="$(plutil -extract WorkingDirectory raw "$PLIST")"
[[ -d "$REPO_DIR/.git" || -f "$REPO_DIR/.git" ]] || fail "Not a git checkout: $REPO_DIR"
cd "$REPO_DIR"

step "Checking $REPO_DIR"
current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$BRANCH" ]] || fail "Checkout is on '$current_branch', expected '$BRANCH'."
git diff --quiet && git diff --cached --quiet || fail "Uncommitted changes to tracked files. Commit or stash them first."

step "Pulling origin/$BRANCH"
old_head="$(git rev-parse HEAD)"
git pull --ff-only --quiet origin "$BRANCH"
new_head="$(git rev-parse HEAD)"

if [[ "$old_head" == "$new_head" ]]; then
  echo "Already up to date at $(git log --oneline -1)."
  if [[ "$FORCE" -eq 0 ]]; then
    echo "Nothing to deploy. Use --force to rebuild anyway."
    exit 0
  fi
else
  git --no-pager log --oneline "$old_head..$new_head"
fi

changed() { [[ "$old_head" != "$new_head" ]] && ! git diff --quiet "$old_head" "$new_head" -- "$@"; }

if changed package.json package-lock.json; then
  step "Dependencies changed: npm ci"
  npm ci
fi

if changed prisma/schema.prisma; then
  step "Schema changed: prisma db push"
  npm run db:push
fi

step "Building"
npm run build

step "Restarting $LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

step "Waiting for $URL"
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
  if [[ "$code" =~ ^[23] ]]; then
    printf '\033[32m✓ Deployed %s (HTTP %s)\033[0m\n' "$(git log --oneline -1)" "$code"
    exit 0
  fi
  sleep 1
done

fail "Server did not respond with 2xx/3xx within 30s (last: ${code:-none}). Check ~/Library/Logs/smartbrief.log"

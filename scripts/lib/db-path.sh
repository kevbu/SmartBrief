# Shared helpers for locating and backing up the SmartBrief SQLite database.
# Source this file; it defines functions only.

# Print the raw DATABASE_URL value the app uses in REPO_DIR.
# Next.js lets .env.local override .env, so .env.local wins here too.
db_url_from_env() {
  local repo_dir="$1" file line
  for file in "$repo_dir/.env.local" "$repo_dir/.env"; do
    [[ -f "$file" ]] || continue
    line="$(grep -E '^[[:space:]]*DATABASE_URL[[:space:]]*=' "$file" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      line="${line#*=}"
      line="${line#"${line%%[![:space:]]*}"}"
      line="${line%"${line##*[![:space:]]}"}"
      line="${line%\"}"; line="${line#\"}"
      line="${line%\'}"; line="${line#\'}"
      printf '%s\n' "$line"
      return 0
    fi
  done
  return 1
}

# Print the absolute SQLite file path for REPO_DIR.
# Prisma resolves relative "file:./x" paths against the prisma/ schema dir.
db_path() {
  local repo_dir="$1" url path
  url="$(db_url_from_env "$repo_dir")" || return 1
  [[ "$url" == file:* ]] || return 1
  path="${url#file:}"
  path="${path%%\?*}"
  if [[ "$path" != /* ]]; then
    path="$repo_dir/prisma/${path#./}"
  fi
  printf '%s\n' "$path"
}

# Write a consistent copy of DB into <db dir>/backups and keep the newest KEEP.
# Warns and returns 0 when sqlite3 or the DB is missing, so callers never fail on it.
backup_db() {
  local db="$1" keep="${2:-10}" dir stamp target
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "⚠ sqlite3 not found, skipping DB backup" >&2
    return 0
  fi
  if [[ ! -f "$db" ]]; then
    echo "⚠ No database at $db, skipping backup" >&2
    return 0
  fi
  dir="$(dirname "$db")/backups"
  mkdir -p "$dir"
  stamp="$(date +%Y%m%d-%H%M%S)"
  target="$dir/smartbrief-$stamp.db"
  # Wait up to 5s for a refresh to release its write lock instead of failing on SQLITE_BUSY
  if ! sqlite3 -cmd '.timeout 5000' "$db" ".backup '$target'"; then
    rm -f -- "$target"
    echo "⚠ DB backup failed, continuing without it" >&2
    return 0
  fi
  echo "Backed up $db → $target"
  # Prune: keep newest $keep backups (timestamped names sort chronologically)
  local old
  old="$(ls -1 "$dir"/smartbrief-*.db 2>/dev/null | sort -r | tail -n +"$((keep + 1))")"
  if [[ -n "$old" ]]; then
    while IFS= read -r f; do rm -f -- "$f"; done <<<"$old"
  fi
}

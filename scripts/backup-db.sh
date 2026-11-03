#!/bin/sh
# Copies the SQLite database to a timestamped backup file.
# Usage: ./scripts/backup-db.sh [destination-directory]

set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DB_PATH="${FASHION_ORDERS_DB:-$ROOT/fashion_orders.db}"
DEST_DIR="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$DEST_DIR"
TARGET="$DEST_DIR/fashion_orders-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$TARGET'"
else
  cp "$DB_PATH" "$TARGET"
fi

echo "Backup written to $TARGET"

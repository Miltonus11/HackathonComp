#!/usr/bin/env bash
# Drops and recreates a local Postgres database, then runs migrations.
# Usage: ./reset_db.sh [db_name] [-y]     (default db: sample_db)
# Credentials/host/port come from DATABASE_URL in .env; only the db name is overridden.
set -euo pipefail
cd "$(dirname "$0")"

DB_NAME="sample_db"
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    *) DB_NAME="$arg" ;;
  esac
done

URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
[[ "$URL" =~ ^postgres(ql)?://([^:]+):([^@]*)@([^:/]+):?([0-9]*)/ ]] || { echo "Cannot parse DATABASE_URL in .env"; exit 1; }
DB_USER="${BASH_REMATCH[2]}"; DB_PASS="${BASH_REMATCH[3]}"; DB_HOST="${BASH_REMATCH[4]}"; DB_PORT="${BASH_REMATCH[5]:-5432}"

if [[ $ASSUME_YES -ne 1 ]]; then
  read -r -p "This will DELETE ALL DATA in '$DB_NAME' on $DB_HOST:$DB_PORT. Type the db name to confirm: " ans
  [[ "$ans" == "$DB_NAME" ]] || { echo "Aborted."; exit 1; }
fi

export PGPASSWORD="$DB_PASS"
PSQL=(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)"
"${PSQL[@]}" -c "CREATE DATABASE \"$DB_NAME\""

# Migrate the target db explicitly (pipenv would otherwise load .env and override this).
export DATABASE_URL="postgres://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"
PIPENV_DONT_LOAD_ENV=1 PIPENV_VERBOSITY=-1 pipenv run python manage.py migrate
echo "Reset '$DB_NAME'. To use it, set DATABASE_URL in .env to .../$DB_NAME"

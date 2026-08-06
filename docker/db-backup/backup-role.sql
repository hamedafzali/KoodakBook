-- Least-privilege role for the db-backup sidecar (approved plan §5.1).
--
-- The backup job connects as THIS role, not the app superuser: it can read
-- every table (pg_read_all_data, a PG16 built-in) but cannot write, so a
-- compromised sidecar credential cannot mutate prod data.
--
-- Apply ONCE against the live DB, then set the password out-of-band to the
-- value stored in the ACM variable BACKUP_DB_PASSWORD (never commit it):
--
--   psql "$DATABASE_URL" -f docker/db-backup/backup-role.sql
--   psql "$DATABASE_URL" -c "ALTER ROLE backup PASSWORD '…from ACM…'"
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backup') THEN
    CREATE ROLE backup LOGIN;
  END IF;
END
$$;

GRANT pg_read_all_data TO backup;

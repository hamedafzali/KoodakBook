-- Staging-harness fixture (LOCAL ONLY — throwaway passwords, never deployed).
-- Runs after 001_schema.sql + seed.sql in the harness DB.
--
-- Two jobs:
--   1. Create the least-privilege `backup` role the sidecar connects as, so the
--      "backup DB role cannot write" least-privilege row is exercised for real.
--   2. Seed a sentinel user + a child + a non-orphan progress row, since the
--      harness has no backend to run seedAdmin() — this gives the restore-drill's
--      row-floor, referential-integrity and sentinel assertions real data.

-- 0. The harness builds the DB via initdb SQL, so it never runs the app's
--    migrate() — which is what creates and populates `_migrations`. Recreate that
--    ledger here so the restore-drill's "schema is current" parity assertion has
--    a real max(filename) to compare on both live and restored. (In prod this
--    table already exists; this block only compensates for the initdb harness.)
CREATE TABLE IF NOT EXISTS _migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO _migrations (filename) VALUES
  ('001_schema.sql'), ('047_placeholder.sql')
ON CONFLICT DO NOTHING;

-- 1. Least-privilege read-only role (mirrors backup-role.sql; password is local).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backup') THEN
    CREATE ROLE backup LOGIN PASSWORD 'backuppw';
  END IF;
END $$;
GRANT pg_read_all_data TO backup;

-- 2. Sentinel data.
INSERT INTO users (id, email, password_hash)
VALUES ('00000000-0000-0000-0000-0000000000ad', 'admin@koodakbook.com', 'x')
ON CONFLICT (email) DO NOTHING;

INSERT INTO children (id, parent_id, name, level)
VALUES ('00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-0000000000ad', 'Sentinel Child', 1)
ON CONFLICT (id) DO NOTHING;

-- Non-orphan progress row against a real seeded word (proves referential probe
-- passes on good data; the "catches bad data" test corrupts a dump separately).
INSERT INTO child_word_progress (child_id, word_id, status)
SELECT '00000000-0000-0000-0000-0000000000c1', w.id, 'practiced'
FROM words w ORDER BY w.id LIMIT 1
ON CONFLICT DO NOTHING;

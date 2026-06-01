FROM postgres:16-alpine
COPY supabase/migrations/001_schema.sql /docker-entrypoint-initdb.d/01_schema.sql
COPY supabase/seed.sql /docker-entrypoint-initdb.d/02_seed.sql

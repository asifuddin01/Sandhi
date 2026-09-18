-- Least-privilege runtime role for SANDHI.
--
-- 1. In the Neon console, create a role named sandhi_app (Neon generates its
--    password) in the production database.
-- 2. Run this script there as the role that owns the tables and runs
--    migrations (`pnpm db:deploy`).
-- 3. Point the application's DATABASE_URL at sandhi_app, with
--    sslmode=require. Keep the owner's connection string only where
--    migrations run.
--
-- sandhi_app can read and write rows but cannot change the schema, create
-- roles, or rewrite history: the audit log accepts new entries only.

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO sandhi_app',
    current_database()
  );
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sandhi_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sandhi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sandhi_app;

-- Tables that future migrations create get the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sandhi_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sandhi_app;

-- Append-only audit trail. (Removing a user still clears actorId on their
-- entries: foreign-key actions run with the table owner's rights.)
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM sandhi_app;

-- Migration history belongs to the owner alone.
REVOKE ALL ON "_prisma_migrations" FROM sandhi_app;

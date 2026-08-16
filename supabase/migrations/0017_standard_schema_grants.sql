-- 0017_standard_schema_grants.sql
-- Guarantee the standard Supabase schema-level privileges exist regardless of
-- how the database was created.
--
-- A fresh `supabase start` grants these during initialization, but a database
-- restored from a dump (or a schema dropped and recreated by `db:reset`) can
-- lose the schema ACL, which surfaces as "permission denied for schema
-- public" for every PostgREST role. These statements are idempotent and make
-- the repository self-healing for both CI (fresh stacks) and restored
-- databases.

grant usage on schema public to anon, authenticated, service_role;

-- RLS remains the access-control boundary; these grants are the baseline
-- "every client role may attempt" privileges, matching Supabase defaults.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
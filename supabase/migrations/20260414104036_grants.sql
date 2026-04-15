-- Grant Supabase roles access to the cyoa schema.
-- RLS still gates rows; this just lets the roles reach the schema/tables.

grant usage on schema cyoa to anon, authenticated, service_role;

grant all on all tables in schema cyoa to anon, authenticated, service_role;
grant all on all sequences in schema cyoa to anon, authenticated, service_role;
grant all on all functions in schema cyoa to anon, authenticated, service_role;

alter default privileges in schema cyoa
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema cyoa
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema cyoa
  grant all on functions to anon, authenticated, service_role;

notify pgrst, 'reload schema';

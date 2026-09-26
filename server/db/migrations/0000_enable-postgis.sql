-- Supabase keeps extensions in the "extensions" schema, which is on the default search_path.
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

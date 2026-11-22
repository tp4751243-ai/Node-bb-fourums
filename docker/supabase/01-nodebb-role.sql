-- Run once in Supabase: SQL Editor > New query. Put in a long random password first.
--
-- Why a separate role: Supabase automatically grants every table that the "postgres" role creates
-- in the public schema to "anon" and "authenticated", the roles behind its REST Data API. NodeBB has
-- to use the public schema and stores password hashes, emails and sessions there. Tables created by
-- this "nodebb" role get no such grants, so the REST API cannot read them.
-- (Tested: tables made by "postgres" were readable by the API role; tables made by "nodebb" were refused.)

create role nodebb with login password 'CHANGE-ME-to-a-long-random-password';
grant usage, create on schema public to nodebb;

-- Then connect NodeBB as  nodebb.<your-project-ref>  through the Session pooler (see docker/.env.example).
-- Also turn the Data API off, since the forum never uses it: Project Settings > Data API.

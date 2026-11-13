-- Prisma creates "_prisma_migrations" itself, outside 0001_init, so it was missed there.
-- Supabase exposes the public schema via PostgREST with the anon key; enabling RLS with no
-- policies blocks that access. Prisma connects as the table owner, so migrations still work.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

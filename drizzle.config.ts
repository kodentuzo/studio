import { defineConfig } from 'drizzle-kit';

// Used by `pnpm db:generate`, which writes a migration file from the schema. It compares the
// schema with the earlier migration files and never connects to a database.
export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle'
});

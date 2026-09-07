import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/core/db/system-schema.ts', './src/modules/*/schema/db.ts'],
  out: './drizzle',
});

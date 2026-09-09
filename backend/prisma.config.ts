// Prisma 7 config file — Migrate/Studio read the connection URL from here.
// The application's own PrismaClient instance (src/prisma/prisma.service.ts) additionally needs the
// PostgreSQL driver adapter (@prisma/adapter-pg) constructed with the same URL.

import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})

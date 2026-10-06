// Configuration de la CLI Prisma (Prisma 7) : chemins et URL de la base.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` n'a pas besoin de base : on tolère l'absence de variable.
    url: process.env.DATABASE_URL ?? 'postgresql://oss:oss@localhost:5432/oss',
  },
});

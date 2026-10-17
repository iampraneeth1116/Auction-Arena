import './env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

if (!process.env.DATABASE_URL) {
  console.error('[db] DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

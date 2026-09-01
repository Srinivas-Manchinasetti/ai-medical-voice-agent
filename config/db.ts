import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  return drizzle(process.env.DATABASE_URL);
}

export const db = process.env.DATABASE_URL
  ? drizzle(process.env.DATABASE_URL)
  : (null as any);

export { schema };



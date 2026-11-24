import { drizzle } from 'drizzle-orm/node-postgres';
import { POSTGRES_URL } from '$app/env/private';
import pg from 'pg';
import * as schema from './schema.js';

// One pool of connections for all of Studio, sign-in included.
export const pool = new pg.Pool({ connectionString: POSTGRES_URL });

export const db = drizzle(pool, { schema });

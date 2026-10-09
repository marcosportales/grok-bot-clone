import "server-only"

import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const globalForDb = globalThis as typeof globalThis & { dbPool?: Pool }

if (!globalForDb.dbPool) {
  const pool = new Pool({ connectionString })

  // Inert off Vercel. On Vercel Fluid compute it releases idle clients before the function suspends.
  attachDatabasePool(pool)

  // pg emits "error" when an idle client dies, and an unhandled "error" event ends the process.
  pool.on("error", (error) => {
    console.error("idle postgres client error", error)
  })

  globalForDb.dbPool = pool
}

export const db = drizzle({ client: globalForDb.dbPool, schema })

export type Database = typeof db

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/lib/db/schema"

let pool: Pool | undefined

export function database() {
  if (pool) {
    return drizzle({ client: pool, schema })
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  pool = new Pool({ connectionString })

  pool.on("error", (error) => {
    console.error("idle postgres client error", error)
  })

  return drizzle({ client: pool, schema })
}

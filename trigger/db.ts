import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

let pool: Pool | undefined

export function database() {
  if (pool) {
    return drizzle({ client: pool })
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  pool = new Pool({ connectionString })

  // pg emits "error" when an idle client dies, and an unhandled "error" event ends the process.
  pool.on("error", (error) => {
    console.error("idle postgres client error", error)
  })

  return drizzle({ client: pool })
}

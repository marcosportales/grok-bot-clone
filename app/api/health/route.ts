import { sql } from "drizzle-orm"

import { db } from "@/lib/db"

export async function GET() {
  const startedAt = Date.now()

  try {
    await db.execute(sql`select 1`)
    return Response.json({ ok: true, latencyMs: Date.now() - startedAt })
  } catch (error) {
    console.error("health check failed", error)
    return Response.json(
      { ok: false, latencyMs: Date.now() - startedAt },
      { status: 503 }
    )
  }
}

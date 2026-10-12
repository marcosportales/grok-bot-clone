import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots, type Bot } from "@/lib/db/schema"

export async function getBots(): Promise<Bot[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return []
  }

  return db
    .select()
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(asc(bots.createdAt))
}

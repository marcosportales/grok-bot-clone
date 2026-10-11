import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots, type Bot } from "@/lib/db/schema"

/**
 * The signed-in user's bots, oldest first.
 *
 * `userId` comes from the Clerk session and never from the caller, so a client
 * cannot ask for somebody else's bots. The group dialog lists them in this
 * order, and a newer bot lands at the end of the list instead of moving the
 * rest around.
 */
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

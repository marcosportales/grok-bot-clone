import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    job: text("job").notNull(),
    instructions: text("instructions"),
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert

// Derived from the table so the database stays the single source of truth. The
// columns the server owns are dropped, so a client can never assert them:
// `userId` comes from the Clerk session, `sandboxId` is assigned when a sandbox
// boots, and `id` and `createdAt` are generated. `avatar` is a generated seed
// too, which is why it is optional here; the dialog always sends one.
export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) =>
    schema
      .trim()
      .min(1, "Give your bot a name.")
      .max(60, "Keep the name under 60 characters."),
  avatar: (schema) => schema.min(1, "A bot needs a face."),
  job: (schema) =>
    schema
      .trim()
      .min(1, "Give your bot a job.")
      .max(60, "Keep the job under 60 characters."),
  instructions: (schema) =>
    schema.max(2000, "Keep the instructions under 2000 characters."),
}).omit({
  id: true,
  userId: true,
  sandboxId: true,
  createdAt: true,
})

export type InsertBot = z.infer<typeof insertBotSchema>

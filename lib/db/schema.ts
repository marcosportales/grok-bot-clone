import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
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
    // When the sandbox was last touched. The gap since this instant, capped at
    // the sandbox's auto-stop interval, is exactly the time it has been
    // running, so this doubles as the accrual cursor for sandbox minutes.
    sandboxTouchedAt: timestamp("sandbox_touched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert

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

export const updateBotSchema = insertBotSchema.extend({
  id: z.string().min(1, "That bot no longer exists."),
})

export type UpdateBot = z.infer<typeof updateBotSchema>

export const chatKind = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    kind: chatKind("kind").notNull().default("direct"),
    name: text("name"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The bot's own last word, which the worker writes when a turn finishes.
    // The unread dot compares this to `lastReadAt` rather than comparing the
    // chat's last message, because the commonest way a chat gains a timestamp
    // is the reader sending a prompt from inside it.
    lastBotMessageAt: timestamp("last_bot_message_at", { withTimezone: true }),
    // The reader's cursor, written when the chat page renders. Null means the
    // chat has never been opened, so a bot message makes it unread.
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)]
)

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

export const botsRelations = relations(bots, ({ many }) => ({
  chatMembers: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  chatMembers: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}))

export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type ChatMember = typeof chatMembers.$inferSelect
export type NewChatMember = typeof chatMembers.$inferInsert

export const insertGroupChatSchema = createInsertSchema(chats)
  .omit({
    id: true,
    userId: true,
    kind: true,
    lastMessagePreview: true,
    lastMessageAt: true,
    lastBotMessageAt: true,
    lastReadAt: true,
    createdAt: true,
  })
  .extend({
    name: z
      .string()
      .trim()
      .min(1, "Name the group.")
      .max(60, "Keep the name under 60 characters."),
    botIds: z
      .array(z.string().min(1))
      .min(2, "Pick at least two bots.")
      .refine(
        (botIds) => new Set(botIds).size === botIds.length,
        "Pick two different bots."
      ),
  })

export type InsertGroupChat = z.infer<typeof insertGroupChatSchema>

export const updateGroupChatSchema = insertGroupChatSchema.extend({
  id: z.string().min(1, "That group chat no longer exists."),
})

export type UpdateGroupChat = z.infer<typeof updateGroupChatSchema>

export const usageDimension = pgEnum("usage_dimension", [
  "ai_tokens",
  "sandbox_minutes",
])

export type UsageDimension = (typeof usageDimension.enumValues)[number]

/**
 * Append-only record of metered consumption. One row is one measured amount in
 * one dimension, and the period it belongs to. `dedupe_key` makes a retried
 * write land once, which matters because the AI side meters from inside a
 * Trigger.dev task that can retry.
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    dimension: usageDimension("dimension").notNull(),
    quantity: integer("quantity").notNull(),
    costMicros: integer("cost_micros").notNull().default(0),
    period: text("period").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_events_dedupe_key_idx").on(table.dedupeKey),
    index("usage_events_user_period_dimension_idx").on(
      table.userId,
      table.period,
      table.dimension
    ),
    check("usage_events_non_negative", sql`${table.quantity} >= 0 and ${table.costMicros} >= 0`),
  ]
)

export type UsageEvent = typeof usageEvents.$inferSelect

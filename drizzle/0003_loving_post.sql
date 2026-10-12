ALTER TABLE "chats" ADD COLUMN "last_bot_message_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "last_read_at" timestamp with time zone;
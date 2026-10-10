import { UserButton } from "@clerk/nextjs"
import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns"

import { ChatAvatar } from "@/components/chat-avatar"
import { SidebarNewMenu } from "@/components/sidebar-new-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { getChatsWithBot, type ChatWithBot } from "@/queries/bot"

// Clerk's UserButton owns its trigger element and exposes no render or asChild
// prop, so the SidebarMenuButton size="lg" variant classes are applied to that
// trigger through the appearance prop. The important flags beat Clerk's own
// trigger class, which globals.css loads after Tailwind.
const sidebarMenuButtonClassName =
  "peer/menu-button flex h-12! w-full! items-center justify-start gap-2 overflow-hidden rounded-md p-2! text-left text-sm! ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground"

// A chat list mixes "just now" with "last week", and a row reads faster with an
// age than with a date the reader has to place in the week. date-fns words it
// ("2 days", "3 hours"), and a chat that moved within the minute reads better as
// "now" than as its own "0 seconds".
function chatAge(lastMessageAt: Date) {
  if (differenceInSeconds(new Date(), lastMessageAt) < 60) {
    return "now"
  }

  return formatDistanceToNowStrict(lastMessageAt, { addSuffix: false })
}

// A direct chat is identified by its bot, so it carries no name of its own.
function chatTitle(chat: ChatWithBot) {
  return chat.name ?? chat.bot.name
}

// Before the first message, the bot's job is what the chat is about.
function chatPreview(chat: ChatWithBot) {
  return chat.lastMessagePreview ?? chat.bot.job
}

export async function AppSidebar() {
  const chats = await getChatsWithBot()

  return (
    <Sidebar>
      <SidebarHeader className="flex-row justify-end">
        <SidebarNewMenu />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  {/* The chat view does not exist yet, so a row has nowhere to
                      navigate and stays a plain menu button. */}
                  <SidebarMenuButton
                    size="lg"
                    // A face beside two lines is taller than size="lg" pins a row.
                    className="h-auto"
                  >
                    <ChatAvatar seed={chat.bot.avatar} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">
                          {chatTitle(chat)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {chatAge(chat.lastMessageAt)}
                        </span>
                      </div>
                      {/* Full column width, so it runs under the age. */}
                      <span className="truncate text-xs text-muted-foreground">
                        {chatPreview(chat)}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserButton
              showName
              appearance={{
                elements: {
                  rootBox: "w-full!",
                  userButtonTrigger: sidebarMenuButtonClassName,
                  userButtonBox: "w-full min-w-0 flex-nowrap gap-2",
                  userButtonAvatarBox: "order-first size-6! shrink-0",
                  userButtonOuterIdentifier:
                    "min-w-0 truncate! ps-0! text-sm! font-medium! text-sidebar-foreground",
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

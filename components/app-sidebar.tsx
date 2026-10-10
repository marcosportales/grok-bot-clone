import { UserButton } from "@clerk/nextjs"
import Link from "next/link"

import { ChatSummary } from "@/components/chat-summary"
import { SidebarNewMenu } from "@/components/sidebar-new-menu"
import { SidebarSearch } from "@/components/sidebar-search"
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
import { toChatSummary } from "@/lib/chat"
import { getChatsWithBot } from "@/queries/bot"

// Clerk's UserButton owns its trigger element and exposes no render or asChild
// prop, so the SidebarMenuButton size="lg" variant classes are applied to that
// trigger through the appearance prop. The important flags beat Clerk's own
// trigger class, which globals.css loads after Tailwind.
const sidebarMenuButtonClassName =
  "peer/menu-button flex h-12! w-full! items-center justify-start gap-2 overflow-hidden rounded-md p-2! text-left text-sm! ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground"

export async function AppSidebar() {
  // Both lists draw from the same summaries, so a chat keeps one name, one age,
  // and one preview wherever it appears.
  const chats = (await getChatsWithBot()).map(toChatSummary)

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex justify-end">
          <SidebarNewMenu />
        </div>
        <SidebarSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    // The chat view does not exist yet, so the row points at
                    // the route it will live on and lands on the 404 until
                    // then.
                    render={<Link href={`/chats/${chat.id}`} />}
                    size="lg"
                    // A face beside two lines is taller than size="lg" pins a row.
                    className="h-auto"
                  >
                    <ChatSummary {...chat} />
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

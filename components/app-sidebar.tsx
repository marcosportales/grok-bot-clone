import Link from "next/link"

import { ChatSummary } from "@/components/chat-summary"
import { SidebarNewMenu } from "@/components/sidebar-new-menu"
import { SidebarSearch } from "@/components/sidebar-search"
import { SidebarUserButton } from "@/components/sidebar-user-button"
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
  SidebarRail,
} from "@/components/ui/sidebar"
import { toChatSummary } from "@/lib/chat"
import { getChatsWithBot } from "@/queries/bot"

export async function AppSidebar() {
  // Both lists draw from the same summaries, so a chat keeps one name, one age,
  // and one preview wherever it appears.
  const chats = (await getChatsWithBot()).map(toChatSummary)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end group-data-[collapsible=icon]:justify-start">
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
                    // The icon row is the face alone, so the name it drops is
                    // what the tooltip puts back.
                    tooltip={chat.title}
                    // A face beside two lines is taller than size="lg" pins a
                    // row, and the collapsed row centers the face on its own.
                    className="h-auto group-data-[collapsible=icon]:justify-center"
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
            <SidebarUserButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

import { SidebarChats } from "@/components/sidebar-chats"
import { SidebarNewMenu } from "@/components/sidebar-new-menu"
import { SidebarSearch } from "@/components/sidebar-search"
import { SidebarUserButton } from "@/components/sidebar-user-button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { toBotOption } from "@/lib/bot"
import { toChatSummary } from "@/lib/chat"
import { getBots } from "@/queries/bot"
import { getChatsWithBots } from "@/queries/chat"

export async function AppSidebar() {
  const [chats, bots] = await Promise.all([getChatsWithBots(), getBots()])
  const summaries = chats.map(toChatSummary)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end group-data-[collapsible=icon]:justify-start">
          <SidebarNewMenu bots={bots.map(toBotOption)} />
        </div>
        <SidebarSearch chats={summaries} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarChats chats={summaries} />
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

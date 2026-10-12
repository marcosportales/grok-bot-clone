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
import type { ChatSummaryData } from "@/lib/chat"
import { getBots } from "@/queries/bot"

export async function AppSidebar({ chats }: { chats: ChatSummaryData[] }) {
  const bots = await getBots()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end group-data-[collapsible=icon]:justify-start">
          <SidebarNewMenu bots={bots.map(toBotOption)} />
        </div>
        <SidebarSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarChats chats={chats} />
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

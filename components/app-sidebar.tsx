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
import { toChatSummary } from "@/lib/chat"
import { getChatsWithBot } from "@/queries/chat"

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

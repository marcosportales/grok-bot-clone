import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { TurnActivityProvider } from "@/components/turn-activity"
import { SidebarProvider } from "@/components/ui/sidebar"
import { toChatSummary } from "@/lib/chat"
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar"
import { getChatsWithBots } from "@/queries/chat"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Signed out, `getChatsWithBots` answers with no chats and the provider has
  // nothing to seed.
  const [cookieStore, chatRows] = await Promise.all([
    cookies(),
    getChatsWithBots(),
  ])
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false"
  const summaries = chatRows.map(toChatSummary)

  return (
    <TurnActivityProvider chats={summaries}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar chats={summaries} />
        {children}
      </SidebarProvider>
    </TurnActivityProvider>
  )
}

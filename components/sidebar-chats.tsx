"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { ChatSummary } from "@/components/chat-summary"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { ChatSummaryData } from "@/lib/chat"

/**
 * The chat list. It is a Client Component because the open chat is the one
 * thing here that has to know the current URL, and a row reading the pathname
 * derives that from the route itself instead of storing an "active chat" that
 * every navigation would have to keep in sync.
 */
function SidebarChats({ chats }: { chats: ChatSummaryData[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {chats.map((chat) => {
            const href = `/chats/${chat.id}`
            const isActive = pathname === href

            return (
              <SidebarMenuItem key={chat.id}>
                <SidebarMenuButton
                  render={<Link href={href} />}
                  isActive={isActive}
                  // The row is a link to the page it names, so the current one
                  // is announced and not only tinted.
                  aria-current={isActive ? "page" : undefined}
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
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export { SidebarChats }

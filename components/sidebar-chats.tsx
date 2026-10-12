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
                  aria-current={isActive ? "page" : undefined}
                  size="lg"
                  tooltip={chat.title}
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

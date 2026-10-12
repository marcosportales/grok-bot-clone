"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { ChatSummary } from "@/components/chat-summary"
import { useTurnActivity } from "@/components/turn-activity"
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
  const { isWorking } = useTurnActivity()

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
                  {/* The reader is looking at the open chat, so it cannot hold
                      an unseen reply even when the layout still says it does:
                      a soft navigation reuses this layout from the client
                      cache, and a reply can land mid-render. */}
                  <ChatSummary
                    {...chat}
                    unread={chat.unread && !isActive}
                    working={isWorking(chat.id)}
                  />
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

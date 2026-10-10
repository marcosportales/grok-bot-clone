"use client"

import { UserButton } from "@clerk/nextjs"
import { PlusIcon, UsersIcon } from "lucide-react"
import { useState } from "react"

import { BotDialog } from "@/components/bot-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Clerk's UserButton owns its trigger element and exposes no render or asChild
// prop, so the SidebarMenuButton size="lg" variant classes are applied to that
// trigger through the appearance prop. The important flags beat Clerk's own
// trigger class, which globals.css loads after Tailwind.
const sidebarMenuButtonClassName =
  "peer/menu-button flex h-12! w-full! items-center justify-start gap-2 overflow-hidden rounded-md p-2! text-left text-sm! ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground"

export function AppSidebar() {
  const [botDialogOpen, setBotDialogOpen] = useState(false)

  return (
    <Sidebar>
      <SidebarHeader className="flex-row justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <PlusIcon />
            <span className="sr-only">New</span>
          </DropdownMenuTrigger>
          {/* The content inherits the trigger width, which is an icon wide. */}
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
                <PlusIcon />
                Create new bot
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UsersIcon />
                Create group chat
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent />
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
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
    </Sidebar>
  )
}

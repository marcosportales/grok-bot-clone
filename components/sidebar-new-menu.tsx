"use client"

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

/**
 * The sidebar header's "New" menu. It owns the bot dialog's open state, which
 * keeps the sidebar around it a Server Component instead of a whole client
 * tree.
 */
function SidebarNewMenu() {
  const [botDialogOpen, setBotDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
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
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
    </>
  )
}

export { SidebarNewMenu }

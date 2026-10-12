"use client"

import { PlusIcon, UsersIcon } from "lucide-react"
import { useState } from "react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BotOption } from "@/lib/bot"

function SidebarNewMenu({ bots }: { bots: BotOption[] }) {
  const [botDialogOpen, setBotDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="group-data-[collapsible=icon]:size-8"
            />
          }
        >
          <PlusIcon />
          <span className="sr-only">New</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
              <PlusIcon />
              Create new bot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupDialogOpen(true)}>
              <UsersIcon />
              Create group chat
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <GroupChatDialog
        bots={bots}
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
      />
    </>
  )
}

export { SidebarNewMenu }

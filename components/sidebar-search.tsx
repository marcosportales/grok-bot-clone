"use client"

import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { ChatSummary } from "@/components/chat-summary"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { useSidebar } from "@/components/ui/sidebar"
import type { ChatSummaryData } from "@/lib/chat"

const searchTriggerClassName =
  "h-8 w-full min-w-0 justify-start gap-2 border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground md:text-sm disabled:bg-input/50 dark:bg-input/30 dark:disabled:bg-input/80 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

const SEARCH_KEY = "k"

function SidebarSearch({ chats }: { chats: ChatSummaryData[] }) {
  const [open, setOpen] = useState(false)
  const { state } = useSidebar()
  const router = useRouter()
  const isCollapsed = state === "collapsed"

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === SEARCH_KEY && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <Button
        variant={isCollapsed ? "ghost" : "outline"}
        size={isCollapsed ? "icon" : "default"}
        className={isCollapsed ? undefined : searchTriggerClassName}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        <span className={isCollapsed ? "sr-only" : undefined}>Search</span>
        {!isCollapsed && (
          <Kbd aria-hidden className="ml-auto">
            ⌘ K
          </Kbd>
        )}
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Find a chat by its bot, its name, or what it was about."
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  // cmdk ranks an item by its value, and a face is an image
                  // with no text, so the title and the preview are what a
                  // query matches.
                  value={`${chat.title} ${chat.preview}`}
                  className="h-auto gap-2"
                  onSelect={() => {
                    setOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                >
                  <ChatSummary {...chat} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

export { SidebarSearch }

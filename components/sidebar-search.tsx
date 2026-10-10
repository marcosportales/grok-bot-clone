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

/**
 * Input's classes, so the trigger reads as the field it stands in for: the same
 * box, height, text size, and invalid and disabled states. The hover, focus
 * ring, and press stay Button's own, and Input's `file:*` rules are dropped
 * because a button has no file input to style. Input's `transition-colors` is
 * dropped too, so Button's `transition-all` keeps the press animated.
 */
const searchTriggerClassName =
  "h-8 w-full min-w-0 justify-start gap-2 border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground md:text-sm disabled:bg-input/50 dark:bg-input/30 dark:disabled:bg-input/80 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

const SEARCH_KEY = "k"

/**
 * The sidebar header's search field. It is a button wearing an input, so the
 * reader can see the shortcut before pressing it, and it owns the chat palette
 * and its open state, which keeps the sidebar around it a Server Component.
 *
 * A collapsed sidebar has no room for the label or the shortcut, so the field
 * becomes the icon button that opens the same palette.
 */
function SidebarSearch({ chats }: { chats: ChatSummaryData[] }) {
  const [open, setOpen] = useState(false)
  const { state } = useSidebar()
  const router = useRouter()
  const isCollapsed = state === "collapsed"

  // ⌘K opens the palette from anywhere on the page. SidebarProvider already
  // claims ⌘B, and the dialog handles its own Escape once it is open.
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
        {/* No data-icon: Button would answer it with an 8px left padding, and
            the icon takes Input's own 10px. */}
        <SearchIcon />
        {/* The button's name is "Search"; the shortcut is read from
            aria-keyshortcuts instead of spelled out. */}
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
                    // The sidebar stays mounted across a navigation, so the
                    // palette would otherwise sit open over the chat it just
                    // opened.
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

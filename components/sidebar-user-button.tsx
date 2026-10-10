"use client"

import { UserButton } from "@clerk/nextjs"

import { useSidebar } from "@/components/ui/sidebar"

// Clerk's UserButton owns its trigger element and exposes no render or asChild
// prop, so the SidebarMenuButton size="lg" classes are applied to that trigger
// through the appearance prop. The important flags beat Clerk's own trigger
// class, which globals.css loads after Tailwind.
const expandedTriggerClassName =
  "peer/menu-button flex h-12! w-full! items-center justify-start gap-2 overflow-hidden rounded-md p-2! text-left text-sm! ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground"

// Clerk never runs our class merger, so two important declarations for one
// property would be settled by stylesheet order. The collapsed row picks its own
// classes instead of fighting the expanded ones.
const collapsedTriggerClassName =
  "flex size-8! shrink-0 items-center justify-center rounded-md p-0! ring-sidebar-ring outline-hidden hover:bg-sidebar-accent! focus-visible:ring-2"

const expandedAppearance = {
  elements: {
    rootBox: "w-full!",
    userButtonTrigger: expandedTriggerClassName,
    userButtonBox: "w-full min-w-0 flex-nowrap gap-2",
    userButtonAvatarBox: "order-first size-6! shrink-0",
    userButtonOuterIdentifier:
      "min-w-0 truncate! ps-0! text-sm! font-medium! text-sidebar-foreground",
  },
}

const collapsedAppearance = {
  elements: {
    rootBox: "w-full!",
    userButtonTrigger: collapsedTriggerClassName,
    userButtonAvatarBox: "size-6! shrink-0",
  },
}

/**
 * The sidebar footer's account menu. It reads the sidebar's state itself, so the
 * row shows the name and avatar while expanded and the face alone while
 * collapsed.
 */
function SidebarUserButton() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <UserButton
      showName={!isCollapsed}
      appearance={isCollapsed ? collapsedAppearance : expandedAppearance}
    />
  )
}

export { SidebarUserButton }

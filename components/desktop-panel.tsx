"use client"

import { MonitorIcon } from "lucide-react"
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import {
  usePanelRef,
  type PanelImperativeHandle,
  type PanelSize,
} from "react-resizable-panels"

import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import { SandboxScreen } from "@/components/sandbox-screen"

/**
 * The desktop panel is the strip to the right of a conversation, and it holds
 * the screen of the computer the chat runs on. The screen previews there and
 * opens fullscreen when it is clicked.
 *
 * The group belongs to the page, and the button and the panel sit on opposite
 * sides of it, so the state they share lives here, above both. The panel keeps
 * its own width, and `onResize` is the only writer of `open`, so dragging the
 * separator to the edge leaves the button reporting what the panel did.
 */
type DesktopPanelState = {
  open: boolean
  panelRef: RefObject<PanelImperativeHandle | null>
  toggle: () => void
  onResize: (size: PanelSize) => void
}

const DesktopPanelContext = createContext<DesktopPanelState | null>(null)

function useDesktopPanel() {
  const context = useContext(DesktopPanelContext)

  if (!context) {
    throw new Error(
      "useDesktopPanel must be used within a DesktopPanelProvider."
    )
  }

  return context
}

function DesktopPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = usePanelRef()
  const [open, setOpen] = useState(false)
  // Collapsing remembers the width the reader last dragged to, so opening the
  // panel again returns to it. There is nothing to remember the first time, and
  // a collapsed panel would otherwise open back to its minimum, which leaves it
  // pinned there for one arrow key to slam shut.
  const opened = useRef(false)

  const value: DesktopPanelState = {
    open,
    panelRef,
    toggle() {
      const panel = panelRef.current

      if (!panel) {
        return
      }

      if (!panel.isCollapsed()) {
        panel.collapse()
      } else if (opened.current) {
        panel.expand()
      } else {
        opened.current = true
        panel.resize("40%")
      }
    },
    onResize(size) {
      setOpen(size.inPixels > 0)
    },
  }

  return (
    <DesktopPanelContext.Provider value={value}>
      {children}
    </DesktopPanelContext.Provider>
  )
}

function DesktopPanel({
  chatId,
  botName,
}: {
  chatId: string
  botName: string
}) {
  const { open, panelRef, onResize } = useDesktopPanel()

  return (
    <>
      {/* The separator goes away with the panel, so a closed panel leaves the
          conversation flush with the edge of the window. */}
      {open ? <ResizableHandle id="chat-desktop-handle" withHandle /> : null}
      <ResizablePanel
        id="chat-desktop"
        panelRef={panelRef}
        collapsible
        collapsedSize="0%"
        defaultSize="0%"
        // The narrowest the panel can be dragged to before it collapses to
        // nothing rather than starving the conversation beside it.
        minSize="25%"
        onResize={onResize}
      >
        {/* The screen mounts with the panel and stays mounted, because the
            reader closing the panel is not a reason to drop the connection. */}
        <SandboxScreen chatId={chatId} botName={botName} active={open} />
      </ResizablePanel>
    </>
  )
}

function DesktopPanelToggle() {
  const { open, toggle } = useDesktopPanel()

  return (
    // Below `sm` the panel would take more of the width than the conversation
    // it sits beside, so the control is out of reach until there is room.
    <Button
      variant="ghost"
      size="icon"
      className="hidden sm:inline-flex"
      aria-label="Toggle Desktop"
      aria-expanded={open}
      aria-controls="chat-desktop"
      onClick={toggle}
    >
      <MonitorIcon />
    </Button>
  )
}

export { DesktopPanel, DesktopPanelProvider, DesktopPanelToggle }

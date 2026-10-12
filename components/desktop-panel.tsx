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

type DesktopPanelState = {
  open: boolean
  canOpen: boolean
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

function DesktopPanelProvider({
  canOpen,
  children,
}: {
  canOpen: boolean
  children: ReactNode
}) {
  const panelRef = usePanelRef()
  const [open, setOpen] = useState(false)
  const opened = useRef(false)

  const value: DesktopPanelState = {
    open,
    canOpen,
    panelRef,
    toggle() {
      if (!canOpen) {
        return
      }

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
      {open ? <ResizableHandle id="chat-desktop-handle" withHandle /> : null}
      <ResizablePanel
        id="chat-desktop"
        panelRef={panelRef}
        collapsible
        collapsedSize="0%"
        defaultSize="0%"
        minSize="25%"
        onResize={onResize}
      >
        <SandboxScreen chatId={chatId} botName={botName} active={open} />
      </ResizablePanel>
    </>
  )
}

function DesktopPanelToggle() {
  const { open, canOpen, toggle } = useDesktopPanel()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="hidden sm:inline-flex"
      aria-label="Toggle Desktop"
      aria-expanded={open}
      aria-controls="chat-desktop"
      disabled={!canOpen}
      onClick={toggle}
    >
      <MonitorIcon />
    </Button>
  )
}

export { DesktopPanel, DesktopPanelProvider, DesktopPanelToggle }

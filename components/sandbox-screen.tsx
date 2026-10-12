"use client"

import { Maximize2Icon, RefreshCwIcon, XIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { getChatScreen } from "@/actions/screen"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

type ScreenState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string; refreshing: boolean }
  | { status: "failed"; error: string }

// `moveBefore` is newer than the TypeScript DOM lib this project compiles
// against, so the host is described rather than assumed.
type MoveableHost = HTMLElement & {
  moveBefore?: (node: Node, child: Node | null) => void
}

function moveInto(host: MoveableHost, node: Node): void {
  if (node.parentNode && host.moveBefore) {
    host.moveBefore(node, null)
    return
  }

  host.appendChild(node)
}

function SandboxScreen({
  chatId,
  botName,
  active,
}: {
  chatId: string
  botName: string
  active: boolean
}) {
  const [screen, setScreen] = useState<ScreenState>({ status: "idle" })
  const [fullscreen, setFullscreen] = useState(false)
  const [dialogHost, setDialogHost] = useState<HTMLDivElement | null>(null)
  const inlineHost = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const asked = useRef(false)

  const url = screen.status === "ready" ? screen.url : null
  const refreshing = screen.status === "ready" && screen.refreshing

  const request = useCallback(async () => {
    const result = await getChatScreen(chatId)

    setScreen(
      result.ok
        ? { status: "ready", url: result.url, refreshing: false }
        : { status: "failed", error: result.error }
    )
  }, [chatId])

  useEffect(() => {
    if (!active || asked.current) {
      return
    }

    asked.current = true
    setScreen({ status: "loading" })
    void request()
  }, [active, request])

  useEffect(() => {
    if (!url) {
      return
    }

    const frame = document.createElement("iframe")
    frame.src = url
    frame.title = `${botName}'s screen`
    frame.referrerPolicy = "no-referrer"
    frame.className = "h-full w-full border-0 bg-black"
    frameRef.current = frame

    return () => {
      frame.remove()

      if (frameRef.current === frame) {
        frameRef.current = null
      }
    }
  }, [url, botName])

  const attachDialogHost = useCallback((node: HTMLDivElement | null) => {
    setDialogHost(node)
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    const host = fullscreen ? dialogHost : inlineHost.current

    if (!frame || !host) {
      return
    }

    if (!host.contains(frame)) {
      moveInto(host, frame)
    }

    frame.tabIndex = fullscreen ? 0 : -1

    if (fullscreen) {
      frame.focus()
    }
  }, [fullscreen, dialogHost, url])

  function refresh() {
    setScreen((current) =>
      current.status === "ready" ? { ...current, refreshing: true } : current
    )
    void request()
  }

  function closeFullscreen() {
    const frame = frameRef.current
    const host = inlineHost.current

    if (frame && host && !host.contains(frame)) {
      moveInto(host, frame)
    }

    setFullscreen(false)
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <div className="flex h-8 shrink-0 items-center justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Refresh the screen"
            disabled={url === null || refreshing}
            onClick={refresh}
          >
            {refreshing ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>
        <div className="shrink-0 rounded-2xl bg-muted p-2.5 ring-1 ring-foreground/10">
          <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-black">
            <div ref={inlineHost} className="absolute inset-0" />
            <ScreenOverlay screen={screen} />
            {screen.status === "ready" ? (
              <button
                type="button"
                className="group absolute inset-0 grid cursor-zoom-in place-items-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open ${botName}'s screen fullscreen`}
                onClick={() => setFullscreen(true)}
              >
                <span className="grid size-9 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Maximize2Icon />
                </span>
              </button>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 text-center text-sm text-muted-foreground">
          {botName}&apos;s screen
        </p>
      </div>

      <Dialog
        open={fullscreen}
        onOpenChange={(next) => {
          if (next) {
            setFullscreen(true)
          }
        }}
        disablePointerDismissal
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none flex-col gap-3 p-3 sm:max-w-none"
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <DialogTitle className="text-sm">
              {botName}&apos;s screen
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Close the fullscreen screen"
              onClick={closeFullscreen}
            >
              <XIcon />
            </Button>
          </div>
          <div className="min-h-0 flex-1 rounded-2xl bg-muted p-2.5 ring-1 ring-foreground/10">
            <div className="relative h-full w-full overflow-hidden rounded-lg bg-black">
              <div ref={attachDialogHost} className="absolute inset-0" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ScreenOverlay({ screen }: { screen: ScreenState }) {
  switch (screen.status) {
    case "failed":
      return (
        <Empty className="absolute inset-0 border-0 bg-background p-4">
          <EmptyHeader>
            <EmptyTitle>No screen</EmptyTitle>
            <EmptyDescription className="text-xs">
              {screen.error}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    case "idle":
    case "loading":
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background p-4 text-sm text-muted-foreground">
          <Spinner />
          Starting the screen
        </div>
      )
    case "ready":
      return null
  }
}

export { SandboxScreen }

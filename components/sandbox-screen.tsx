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

/**
 * What the screen is doing. One value, so a picture and a load cannot both be
 * current, and `refreshing` only exists where there is a picture to keep.
 */
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

/**
 * Puts `node` in `host` without discarding what is running inside it.
 *
 * `appendChild` tears an iframe down and builds another one, and a new noVNC
 * page means a new connection and a blank screen until it is up again.
 * `moveBefore` is the state-preserving move, so the one connection the screen
 * made when it first loaded survives the trip to the fullscreen dialog and
 * back. A browser without it reconnects instead and still works.
 *
 * `moveBefore` moves a node rather than placing one, and refuses a node that is
 * not in a document yet. A screen that has just been built is placed, and every
 * trip after that is moved.
 */
function moveInto(host: MoveableHost, node: Node): void {
  if (node.parentNode && host.moveBefore) {
    host.moveBefore(node, null)
    return
  }

  host.appendChild(node)
}

/**
 * The chat's computer screen, once, shown twice.
 *
 * The panel is a preview: the screen is really running underneath, and it
 * cannot be typed into there because a click on it is what opens the dialog.
 * The dialog is where the same screen takes input, which is why the two hold
 * one iframe rather than one each. `moveInto` moves that one element between
 * them, so nothing reconnects.
 *
 * The URL is asked for when the panel is first opened, never on page load.
 * Opening it can start a stopped sandbox, and a chat that is only being read
 * should not be starting computers.
 */
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

  /**
   * One iframe for as long as the page lives. Rebuilding it is the reconnect
   * the two hosts share it to avoid, so it is created here and then only moved.
   */
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

  // The dialog builds its popup one render after it opens, so its host has to
  // arrive as state. An effect reading a ref would run while the ref was still
  // empty and never be told the host had shown up.
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

    // The preview is for looking at. Keyboard focus reaches the screen only in
    // the dialog, where a key is meant for the computer rather than the page.
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

    // The frame goes back before the dialog takes its host away, so the move
    // still has a document to preserve and the connection is not restarted.
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
        // Pressing Escape or typing into a computer is how a reader talks to the
        // screen, so neither may close the dialog over it. The close button is
        // the one way out.
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

/**
 * What covers the screen's box while there is no screen in it.
 *
 * One switch rather than one condition per part, because every state that is
 * not `ready` has no URL, and a pair of independent conditions put the failure
 * and the wait on top of each other.
 */
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

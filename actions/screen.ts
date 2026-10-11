"use server"

import { SandboxState, type Sandbox } from "@daytona/sdk"

import { getDaytona } from "@/lib/daytona"
import { getChatWithBots } from "@/queries/chat"

// noVNC serves its own client here, and websockify upgrades its connection on
// the same port. The image ships both, and this is the number they listen on.
const screenPort = 6080

// The client page the URL points at. Its own copy of the desktop is scaled to
// whatever box it is given and connects without a prompt, which is what makes
// one page work as both a preview and a fullscreen view.
const screenClientPath = "/vnc.html"

// Long enough to open a page and connect, short enough that a URL left in a
// browser is not a standing key to the desktop. A connection that is already
// open keeps working past this.
const screenUrlSeconds = 60 * 60

export type ChatScreen =
  { ok: true; url: string } | { ok: false; error: string }

/**
 * The desktop of the chat's computer, as one URL a browser can load.
 *
 * The URL is pre-signed, so an iframe can open it without headers, and it names
 * the sandbox's port directly. It is a key to that desktop, which is why the
 * chat is read back from the database first: the id arrives from the browser,
 * and only a chat belonging to the signed-in user gets one.
 *
 * A stopped sandbox is started here rather than refused, because the panel is
 * how a reader looks at a computer that is not doing anything yet.
 */
export async function getChatScreen(chatId: string): Promise<ChatScreen> {
  const chat = await getChatWithBots(chatId)
  // The chat's computer is its first member's, the same one `trigger/computer.ts`
  // hands the agent's own tools, so the panel and the tools show one machine.
  const sandboxId = chat?.bots[0].sandboxId

  if (!sandboxId) {
    return { ok: false, error: "This bot has no screen yet." }
  }

  try {
    const sandbox = await getDaytona().get(sandboxId)

    if (sandbox.state !== SandboxState.STARTED) {
      await sandbox.start(120)
    }

    await openDesktop(sandbox)

    const preview = await sandbox.getSignedPreviewUrl(
      screenPort,
      screenUrlSeconds
    )

    // The signed URL names the port and carries its own credential, so only the
    // path and the viewer's settings are added to it.
    const url = new URL(screenClientPath, preview.url)
    url.searchParams.set("autoconnect", "true")
    url.searchParams.set("resize", "scale")

    return { ok: true, url: url.href }
  } catch (error) {
    console.error("failed to open the chat screen", error)
    return { ok: false, error: "The screen did not open. Try again." }
  }
}

/**
 * Brings the desktop up if it is down. `computerUse.start()` starts all six
 * processes, so it is only called when the one the viewer needs is missing.
 * `trigger/computer.ts` makes the same check for the agent's own tools.
 */
async function openDesktop(sandbox: Sandbox): Promise<void> {
  let running = false

  try {
    const status = await sandbox.computerUse.getProcessStatus("novnc")
    running = status.running === true
  } catch {
    running = false
  }

  if (!running) {
    await sandbox.computerUse.start()
  }
}

"use server"

import { SandboxState, type Sandbox } from "@daytona/sdk"

import { getDaytona } from "@/lib/daytona"
import { getChatWithBots } from "@/queries/chat"

// noVNC serves its own client here, and websockify upgrades its connection on
// the same port. The image ships both, and this is the number they listen on.
const screenPort = 6080

const screenClientPath = "/vnc.html"

const screenUrlSeconds = 60 * 60

export type ChatScreen =
  { ok: true; url: string } | { ok: false; error: string }

export async function getChatScreen(chatId: string): Promise<ChatScreen> {
  const chat = await getChatWithBots(chatId)
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

    const url = new URL(screenClientPath, preview.url)
    url.searchParams.set("autoconnect", "true")
    url.searchParams.set("resize", "scale")

    return { ok: true, url: url.href }
  } catch (error) {
    console.error("failed to open the chat screen", error)
    return { ok: false, error: "The screen did not open. Try again." }
  }
}

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

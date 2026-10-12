"use server"

import { auth } from "@clerk/nextjs/server"
import { SandboxState, type Sandbox } from "@daytona/sdk"

import { missingFeature, type UpgradeRequired } from "@/lib/billing"
import { db } from "@/lib/db"
import { getDaytona } from "@/lib/daytona"
import { missingAllowance } from "@/lib/usage/quota"
import { accrueSandboxTime } from "@/lib/usage/sandbox"
import { getChatWithBots } from "@/queries/chat"

// noVNC serves its own client here, and websockify upgrades its connection on
// the same port. The image ships both, and this is the number they listen on.
const screenPort = 6080

const screenClientPath = "/vnc.html"

const screenUrlSeconds = 60 * 60

export type ChatScreen =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | UpgradeRequired

export async function getChatScreen(chatId: string): Promise<ChatScreen> {
  const chat = await getChatWithBots(chatId)
  const bot = chat?.bots[0]

  if (!chat || !bot?.sandboxId) {
    return { ok: false, error: "This bot has no screen yet." }
  }

  const { has } = await auth()
  const blocked = missingFeature(has, "sandboxes")
  if (blocked) {
    return blocked
  }

  const spent = await missingAllowance(has, chat.userId, "sandbox_minutes")
  if (spent) {
    return spent
  }

  const { id: botId, sandboxId, userId } = bot

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

    try {
      await accrueSandboxTime(db, { botId, userId })
    } catch (meteringError) {
      // Opening a desktop that works must not fail because its metering did.
      console.error("failed to record sandbox usage", {
        chatId,
        botId,
        meteringError,
      })
    }

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

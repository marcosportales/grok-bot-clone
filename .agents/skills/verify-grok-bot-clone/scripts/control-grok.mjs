#!/usr/bin/env node
/**
 * control-grok — verification driver for the grok-bot-clone Next.js app.
 *
 * Zero dependencies. Talks to headless Chrome over the DevTools Protocol using
 * Node's built-in fetch and WebSocket globals, so nothing has to be installed
 * into the project to verify it.
 *
 * Lifecycle: `up` starts one dev server (owned by this run) plus one headless
 * Chrome, and records both PIDs under the verify root. When this checkout is
 * already running `next dev`, `up` reuses that server instead of starting a
 * second one and marks it unowned, because Next 16 keeps one dev server per
 * project directory. Every other command attaches to that already-running pair,
 * so state (theme, scroll, DOM) is preserved between invocations. `down` kills
 * exactly the PIDs this run started and leaves a reused dev server running;
 * proof artifacts are never removed by teardown.
 *
 * Run `node scripts/control-grok.mjs help` for the command list.
 */

import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, "..", "..", "..", "..")
const ROOT = process.env.GROK_VERIFY_ROOT || "/tmp/grok-bot-clone-verify"
const RUN_DIR = join(ROOT, "run")
const ARTIFACTS_DIR = join(ROOT, "artifacts")
const STATE_FILE = join(RUN_DIR, "state.json")
const LOCK_FILE = join(REPO, ".next", "dev", "lock")
const DEFAULT_PORT = 3111

const log = (...a) => console.log(...a)
const fail = (msg, code = 1) => {
  console.error(`control-grok: ${msg}`)
  process.exit(code)
}

function readState() {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"))
  } catch {
    return null
  }
}

function writeState(state) {
  mkdirSync(RUN_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function alive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killGroup(pid, signal = "SIGTERM") {
  if (!alive(pid)) return
  try {
    process.kill(-pid, signal)
  } catch {
    try {
      process.kill(pid, signal)
    } catch {}
  }
}

function portFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once("error", () => res(false))
    srv.once("listening", () => srv.close(() => res(true)))
    srv.listen(port, "127.0.0.1")
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function httpStatus(url, timeoutMs = 2_000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { redirect: "manual", signal: ctrl.signal })
    return r.status
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// `next dev` writes a lock for the whole project directory. A spawned dev
// server that loses the race prints this marker and exits, so watch the log for
// it instead of waiting out the readiness timeout.
async function waitForDevServer(baseUrl, devLog, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(devLog) && readFileSync(devLog, "utf8").includes("Another next dev server is already running")) {
      return { blocked: true }
    }
    const status = await httpStatus(baseUrl + "/", 1_000)
    if (status !== null && status < 500) return { ready: true }
    await sleep(200)
  }
  return { timeout: true }
}

function readLock() {
  if (!existsSync(LOCK_FILE)) return null
  try {
    const lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"))
    return Number.isFinite(lock?.pid) && Number.isFinite(lock?.port) ? lock : null
  } catch {
    return null
  }
}

function pidCwd(pid) {
  const out = spawnSync("readlink", ["-f", `/proc/${pid}/cwd`], { encoding: "utf8" })
  return out.status === 0 ? out.stdout.trim() : null
}

// The dev server this checkout already runs, if any. Reusing it keeps the
// one-instance-per-checkout rule without killing a server the user started.
async function detectDevServer() {
  const lock = readLock()
  if (!lock || !alive(lock.pid)) return null
  const cwd = pidCwd(lock.pid)
  if (cwd !== REPO) return { foreign: true, pid: lock.pid, cwd }
  const baseUrl = `http://localhost:${lock.port}`
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const status = await httpStatus(baseUrl + "/")
    if (status !== null && status < 500) return { pid: lock.pid, port: lock.port, baseUrl }
    await sleep(300)
  }
  return { unreachable: true, pid: lock.pid, baseUrl }
}

async function startOwnedDevServer(port, devLog) {
  const baseUrl = `http://localhost:${port}`
  if (!(await portFree(port))) {
    fail(
      `port ${port} is already in use by a process this run did not start.\n` +
        `Refusing to drive an unknown server. Free it or pass --port <other>.`
    )
  }
  if (!existsSync(join(REPO, "node_modules", ".bin", "next"))) {
    fail("node_modules/.bin/next is missing. Run `pnpm install` in the repo first.")
  }

  const stale = readLock()
  if (stale && !alive(stale.pid)) {
    log(`clearing stale dev lock ${LOCK_FILE} (pid ${stale.pid} is gone)`)
    rmSync(LOCK_FILE, { force: true })
  }

  const child = spawn(join(REPO, "node_modules", ".bin", "next"), ["dev", "-p", String(port)], {
    cwd: REPO,
    detached: true,
    stdio: ["ignore", openSync(devLog, "a"), openSync(devLog, "a")],
  })
  child.unref()
  await sleep(50)

  const outcome = await waitForDevServer(baseUrl, devLog)
  if (outcome.blocked) {
    killGroup(child.pid)
    const other = readLock()
    fail(
      "another next dev server is already running for this checkout" +
        (other ? ` (pid ${other.pid}, http://localhost:${other.port})` : "") +
        `.\nNext 16 allows one dev server per project directory (${LOCK_FILE}). Stop it, then retry.`
    )
  }
  if (outcome.timeout) {
    killGroup(child.pid)
    fail(`dev server did not answer at ${baseUrl} within 60s. See ${devLog}.`)
  }
  return { pid: child.pid, port, baseUrl }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/sbin/google-chrome-stable",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean)
  for (const c of candidates) if (existsSync(c)) return c
  fail(
    "no Chrome found. Set CHROME_BIN to a Chrome/Chromium binary " +
      "(e.g. CHROME_BIN=/usr/sbin/google-chrome-stable)."
  )
}

function readDevToolsPort(profileDir) {
  const f = join(profileDir, "DevToolsActivePort")
  if (!existsSync(f)) return null
  const port = Number(readFileSync(f, "utf8").split("\n")[0])
  return Number.isFinite(port) && port > 0 ? port : null
}

async function waitForChrome(profileDir, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const port = readDevToolsPort(profileDir)
    if (port) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (r.ok) return port
      } catch {}
    }
    await sleep(150)
  }
  fail("Chrome did not expose a DevTools port in time")
}

async function pageTarget(chromePort, baseUrl) {
  const list = await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json()
  const pages = list.filter((t) => t.type === "page")
  const match =
    pages.find((t) => t.url.startsWith(baseUrl)) ||
    pages.find((t) => t.url !== "about:blank") ||
    pages[0]
  if (!match) fail("no page target in Chrome")
  return match
}

/* ---------------------------------- CDP ---------------------------------- */

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : res(msg.result)
      } else if (msg.method) {
        const hs = this.handlers.get(msg.method) || []
        for (const h of hs) h(msg.params)
      }
    })
  }

  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true })
      ws.addEventListener("error", () => rej(new Error("CDP socket error")), { once: true })
    })
    return new CDP(ws)
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, fn) {
    const list = this.handlers.get(method) || []
    list.push(fn)
    this.handlers.set(method, list)
  }

  close() {
    try {
      this.ws.close()
    } catch {}
  }
}

function withPage(fn) {
  return async () => {
    const state = readState()
    if (!state) fail("no running instance. Run `control-grok up` first.")
    if (!alive(state.nextPid)) fail(`dev server pid ${state.nextPid} is not alive. Run \`down\` then \`up\`.`)
    if (!alive(state.chromePid)) fail(`Chrome pid ${state.chromePid} is not alive. Run \`down\` then \`up\`.`)
    const target = await pageTarget(state.chromePort, state.baseUrl)
    const cdp = await CDP.connect(target.webSocketDebuggerUrl)
    try {
      await cdp.send("Page.enable")
      await cdp.send("Runtime.enable")
      await cdp.send("DOM.enable")
      // Make the headless page behave as focused so dispatched keys reach window listeners.
      await cdp.send("Page.bringToFront")
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true })
      return await fn(cdp, state)
    } finally {
      cdp.close()
    }
  }
}

async function settle(cdp, { requireUrl } = {}) {
  for (let i = 0; i < 100; i++) {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: `document.readyState === "complete"`,
      returnByValue: true,
    })
    if (result.value === true) break
    await sleep(100)
  }
  if (requireUrl) {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "location.href",
      returnByValue: true,
    })
    if (!String(result.value).startsWith(requireUrl)) return false
  }
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts ? document.fonts.ready.then(() => true) : true",
    awaitPromise: true,
    returnByValue: true,
  })
  await sleep(150)
  return true
}

async function currentPath(cdp) {
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: "location.pathname + location.search",
    returnByValue: true,
  })
  return result.value
}

/* ----------------------------- AX tree helpers ---------------------------- */

function axRole(node) {
  return node.role?.value || ""
}
function axName(node) {
  return node.name?.value || ""
}

async function axTree(cdp) {
  await cdp.send("Accessibility.enable")
  const { nodes } = await cdp.send("Accessibility.getFullAXTree")
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const root = nodes.find((n) => !n.parentId) || nodes[0]
  return { nodes, byId, root }
}

const SKIP_ALWAYS = new Set(["StaticText", "InlineTextBox", "LineBreak"])
const SKIP_UNNAMED = new Set(["none", "generic", "paragraph", "group"])

function shouldSkipAx(node) {
  const role = axRole(node)
  if (SKIP_ALWAYS.has(role)) return true
  if (SKIP_UNNAMED.has(role) && !axName(node)) return true
  return false
}

function renderAx(nodes, byId, root) {
  const lines = []
  const walk = (node, depth) => {
    if (!node) return
    const role = axRole(node)
    const name = axName(node)
    const hidden = node.ignored || shouldSkipAx(node)
    if (!hidden) {
      const bits = []
      if (name) bits.push(JSON.stringify(name))
      if (role === "heading" && node.properties) {
        const lvl = node.properties.find((p) => p.name === "level")
        if (lvl) bits.push(`level=${lvl.value?.value}`)
      }
      if (node.properties) {
        const checks = ["checked", "selected", "expanded", "disabled", "required"]
        for (const c of checks) {
          const p = node.properties.find((x) => x.name === c)
          if (p && p.value?.value !== undefined && p.value.value !== false) bits.push(`${c}=${p.value.value}`)
        }
      }
      lines.push(`${"  ".repeat(depth)}${role}${bits.length ? " " + bits.join(" ") : ""}`)
    }
    const childDepth = hidden ? depth : depth + 1
    for (const id of node.childIds || []) walk(byId.get(id), childDepth)
  }
  walk(root, 0)
  return lines.join("\n")
}

function findAx(nodes, role, name) {
  return nodes.find((n) => !n.ignored && axRole(n) === role && axName(n) === name)
}

const CENTER_AND_HIT = `function () {
  this.scrollIntoView({ block: "center", inline: "center" });
  const r = this.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return { x, y, w: r.width, h: r.height, hit: !!top && (top === this || this.contains(top)) };
}`

async function rectForBackendNode(cdp, backendNodeId) {
  const { object } = await cdp.send("DOM.resolveNode", { backendNodeId })
  const { result } = await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    functionDeclaration: CENTER_AND_HIT,
    returnByValue: true,
  })
  return result.value
}

async function rectForSelector(cdp, selector) {
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      return (${CENTER_AND_HIT}).call(el);
    })()`,
    returnByValue: true,
  })
  return result.value
}

async function clickPoint(cdp, point) {
  if (!point || point.w <= 0 || point.h <= 0) fail("target has no clickable box")
  if (!point.hit) fail("target is covered at its centre point")
  const base = { x: point.x, y: point.y, button: "left", clickCount: 1 }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y })
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base })
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base })
  await sleep(120)
}

const KEYCODES = { d: 68, Tab: 9, Enter: 13, Escape: 27, " ": 32 }
const MODIFIERS = { alt: 1, ctrl: 2, meta: 4, shift: 8 }

// `meta+b` is a chord; `b` is one key. The CDP modifiers bitmask is what makes
// the page's own keydown listener see `metaKey`/`ctrlKey`, so a chord has to be
// sent as one event rather than as a modifier held across two commands.
function parseKey(spec) {
  const parts = spec.split("+")
  const key = parts.pop()
  const names = parts.map((name) => MODIFIERS[name])
  if (names.some((m) => m === undefined)) return null
  if (!(key in KEYCODES) && !/^[A-Za-z0-9]$/.test(key)) return null
  return { key, modifiers: names.reduce((a, b) => a | b, 0) }
}

async function pressKey(cdp, { key, modifiers }) {
  const code = KEYCODES[key] ?? key.toUpperCase().charCodeAt(0)
  const common = {
    modifiers,
    key,
    code: key === " " ? "Space" : key in KEYCODES ? key : `Key${key.toUpperCase()}`,
    windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code,
  }
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...common })
  // Ctrl and Meta chords are commands, not text. Sending the char event would
  // type the letter alongside the shortcut the page is listening for.
  if (key.length === 1 && !(modifiers & (MODIFIERS.ctrl | MODIFIERS.meta))) {
    const text = modifiers & MODIFIERS.shift ? key.toUpperCase() : key
    await cdp.send("Input.dispatchKeyEvent", { type: "char", text, unmodifiedText: key, ...common })
  }
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...common })
  await sleep(150)
}

const SELF = fileURLToPath(import.meta.url)

function runSelf(args) {
  const out = spawnSync(process.execPath, [SELF, ...args], { encoding: "utf8" })
  if (out.status !== 0) {
    fail(`signin step \`${args.join(" ")}\` failed:\n${(out.stderr || out.stdout).trim()}`)
  }
  return out.stdout.trim()
}

const axHas = (role, name) =>
  withPage(async (cdp) => {
    const { nodes } = await axTree(cdp)
    return !!findAx(nodes, role, name)
  })()

const clerkUserId = () =>
  withPage(async (cdp) => {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "window.Clerk?.user?.id ?? null",
      returnByValue: true,
      awaitPromise: true,
    })
    return result.value
  })()

// Clerk renders its forms in the browser, so the first read after `up` can land
// before the bundle does. Wait for the node instead of failing on a cold page.
// Clerk and React render their controls in the browser, so a lookup that reads
// the tree once races the bundle and reports a control that is merely late as
// missing. Wait for the node instead of reading once.
async function waitForAx(role, name, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const node = await withPage(async (cdp) => findAx((await axTree(cdp)).nodes, role, name))()
    if (node) return node
    if (Date.now() >= deadline) return null
    await sleep(300)
  }
}

async function cmdSignIn() {
  const email = process.env.GROK_VERIFY_EMAIL
  const password = process.env.GROK_VERIFY_PASSWORD
  if (!email || !password) {
    fail(
      "signin needs GROK_VERIFY_EMAIL and GROK_VERIFY_PASSWORD for a dev-instance test account.\n" +
        "See the Signing in section of this skill's SKILL.md."
    )
  }
  const state = readState()
  if (!state) fail("no running instance. Run `control-grok up` first.")
  if (!alive(state.nextPid) || !alive(state.chromePid)) fail("instance is not alive. Run `down` then `up`.")

  const existing = await clerkUserId()
  if (existing) {
    log(`already signed in as ${existing}`)
    return
  }

  runSelf(["open", "/sign-in"])
  runSelf(["click", "--role", "textbox", "--name", "Email address"])
  runSelf(["type", email])
  runSelf(["click", "--role", "button", "--name", "Continue"])

  let sawPassword = false
  for (let i = 0; i < 20 && !sawPassword; i++) {
    await sleep(500)
    sawPassword = await axHas("textbox", "Password")
  }
  if (!sawPassword) fail("the sign-in form never asked for a password. Check GROK_VERIFY_EMAIL.")

  runSelf(["click", "--role", "textbox", "--name", "Password"])
  runSelf(["type", password])
  runSelf(["click", "--role", "button", "--name", "Continue"])

  let userId = null
  for (let i = 0; i < 40 && !userId; i++) {
    await sleep(500)
    userId = await clerkUserId()
  }
  if (!userId) {
    const path = await withPage((cdp) => currentPath(cdp))()
    fail(
      `still signed out after the password step (path ${path}).\n` +
        "A `/sign-in/client-trust` path means the test account needs `bypass_client_trust`."
    )
  }
  log(`signed in as ${userId}`)
}

const cmdType = withPage(async (cdp) => {
  const text = process.argv[3]
  if (!text) fail("usage: type <text>")
  for (const ch of text) {
    await cdp.send("Input.insertText", { text: ch })
    await sleep(20)
  }
  log(`typed ${text.length} characters`)
})

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback
}

/* Fixed output target: keep command stdout parseable, diagnostics on stderr. */
function writeArtifact(relPath, contents) {
  const out = relPath.startsWith("/") ? relPath : resolve(process.cwd(), relPath)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, contents)
  return out
}

/* -------------------------------- commands -------------------------------- */

async function cmdUp() {
  const existing = readState()
  if (existing && (alive(existing.nextPid) || alive(existing.chromePid))) {
    fail(
      `an instance is already running (run ${existing.runId}, dev pid ${existing.nextPid}).\n` +
        "Refusing to start a second one: `next dev` shares .next and cannot run twice from the same checkout.\n" +
        "Run `control-grok down` first if it is stale."
    )
  }
  // Always start from a clean run dir: a leftover dev-server.log would carry the
  // previous run's lock marker and make the readiness check report a false block.
  rmSync(RUN_DIR, { recursive: true, force: true })

  const reuse = await detectDevServer()
  if (reuse?.foreign) {
    fail(
      `a dev server for another checkout holds ${LOCK_FILE} (pid ${reuse.pid}, cwd ${reuse.cwd || "unknown"}).\n` +
        "Refusing to drive a foreign instance. Stop it, then retry."
    )
  }
  if (reuse?.unreachable) {
    fail(
      `dev pid ${reuse.pid} holds ${LOCK_FILE} but ${reuse.baseUrl} did not answer within 15s.\n` +
        `It may still be starting. Retry, or stop pid ${reuse.pid} if it is wedged.`
    )
  }
  if (reuse && process.argv.includes("--port")) {
    fail(
      `this checkout already runs a dev server on ${reuse.baseUrl} (pid ${reuse.pid}), and Next 16 cannot start a second one.\n` +
        `Use that server, or stop pid ${reuse.pid} before passing --port.`
    )
  }

  mkdirSync(RUN_DIR, { recursive: true })
  const runId = new Date().toISOString().replace(/[:.]/g, "-")
  const devLog = join(RUN_DIR, "dev-server.log")
  const chromeLog = join(RUN_DIR, "chrome.log")

  // Must be `localhost`, not `127.0.0.1`: Next dev treats the two as different
  // origins and blocks its HMR client on 127.0.0.1, which prevents React from
  // hydrating (and the dark-mode hotkey from ever being attached).
  const dev = reuse
    ? { pid: reuse.pid, port: reuse.port, baseUrl: reuse.baseUrl, owned: false }
    : { ...(await startOwnedDevServer(Number(arg("port", DEFAULT_PORT)), devLog)), owned: true }
  if (!dev.owned) {
    log(`reusing the dev server this checkout already runs (pid ${dev.pid}, ${dev.baseUrl})`)
  }
  const baseUrl = dev.baseUrl

  const profileDir = join(RUN_DIR, "chrome-profile")
  mkdirSync(profileDir, { recursive: true })
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1280,900",
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", openSync(chromeLog, "a"), openSync(chromeLog, "a")] }
  )
  chrome.unref()
  const chromePid = chrome.pid
  const chromePort = await waitForChrome(profileDir)

  writeState({
    runId,
    port: dev.port,
    baseUrl,
    nextPid: dev.pid,
    nextOwned: dev.owned,
    chromePid,
    chromePort,
    profileDir,
    startedAt: new Date().toISOString(),
  })

  const target = await pageTarget(chromePort, baseUrl)
  const cdp = await CDP.connect(target.webSocketDebuggerUrl)
  await cdp.send("Page.enable")
  await cdp.send("Page.navigate", { url: baseUrl + "/" })
  await settle(cdp)
  cdp.close()

  log(`run ${runId}`)
  log(`app     ${baseUrl}`)
  log(
    `dev pid ${dev.pid} ${dev.owned ? "(owned)" : "(reused, left running by down)"}   ` +
      `chrome pid ${chromePid} (cdp ${chromePort})`
  )
  log(`artifacts will be written under ${ARTIFACTS_DIR}`)
}

async function cmdDown() {
  const state = readState()
  if (!state) {
    log("nothing to stop (no run state)")
    return
  }
  const ownsDev = state.nextOwned !== false
  killGroup(state.chromePid)
  if (ownsDev) killGroup(state.nextPid)
  for (let i = 0; i < 40 && (alive(state.chromePid) || (ownsDev && alive(state.nextPid))); i++) await sleep(100)
  killGroup(state.chromePid, "SIGKILL")
  if (ownsDev) killGroup(state.nextPid, "SIGKILL")
  rmSync(RUN_DIR, { recursive: true, force: true })
  log(
    `stopped run ${state.runId} (chrome pid ${state.chromePid}; dev pid ${state.nextPid} ` +
      `${ownsDev ? "stopped" : "left running, not started by this run"})`
  )
  log(`proof artifacts kept under ${ARTIFACTS_DIR}`)
}

async function cmdDoctor() {
  const problems = []
  const state = readState()
  if (!state) fail("doctor: no run state. Run `control-grok up` first.")
  log(`run        ${state.runId}`)
  log(`app url    ${state.baseUrl}`)
  log(`dev pid    ${state.nextPid} alive=${alive(state.nextPid)} owned=${state.nextOwned !== false}`)
  log(`chrome pid ${state.chromePid} alive=${alive(state.chromePid)} cdp=${state.chromePort}`)
  if (!alive(state.nextPid)) problems.push("dev server process is dead")
  if (!alive(state.chromePid)) problems.push("chrome process is dead")

  const cwd = pidCwd(state.nextPid)
  log(`dev cwd    ${cwd || "unknown"}`)
  if (cwd !== REPO) problems.push(`dev server cwd ${cwd || "unknown"} is not this checkout ${REPO}`)

  try {
    const r = await fetch(state.baseUrl + "/")
    log(`http /     ${r.status}`)
    if (r.status !== 200) problems.push(`GET / returned ${r.status}`)
  } catch (e) {
    problems.push(`app not reachable: ${e.message}`)
  }

  if (!problems.length) {
    try {
      await withPage(async (cdp) => {
        const path = await currentPath(cdp)
        log(`path       ${path}`)
        // A signed-out probe lands on the auth route: `/` is behind Clerk.
        const [role, name] = path.startsWith("/sign-up")
          ? ["heading", "Create your account"]
          : path.startsWith("/sign-in")
            ? ["heading", "Sign in to grok-bot-clone"]
            : ["button", "Create a new bot"]
        const found = await waitForAx(role, name)
        log(`${role.padEnd(10)} ${found ? "found" : "MISSING"}`)
        if (!found) problems.push(`no ${role} named "${name}" at ${path} after 10s`)
      })()
    } catch (e) {
      problems.push(`CDP check failed: ${e.message}`)
    }
  }

  if (problems.length) {
    console.error("doctor: NOT HEALTHY")
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  log("doctor: healthy")
}

const cmdOpen = withPage(async (cdp, state) => {
  const argPath = process.argv[3]?.startsWith("--") ? "/" : process.argv[3] || "/"
  const url = new URL(argPath, state.baseUrl).href
  await cdp.send("Page.navigate", { url })
  await settle(cdp)
  const ok = await settle(cdp, { requireUrl: url })
  log(`opened ${url}`)
  if (!ok) fail(`navigation did not land on ${url}`)
})

const cmdText = withPage(async (cdp) => {
  const selector = process.argv[3]
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: selector
      ? `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.innerText : null })()`
      : "document.body.innerText",
    returnByValue: true,
  })
  if (result.value === null) fail(`no element matches ${selector}`)
  log(result.value)
})

const cmdEval = withPage(async (cdp) => {
  const expr = process.argv[3]
  if (!expr) fail("usage: eval <javascript-expression>")
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  if (exceptionDetails) fail(exceptionDetails.exception?.description || exceptionDetails.text)
  log(JSON.stringify(result.value))
})

const cmdPress = withPage(async (cdp) => {
  const spec = process.argv[3]
  if (!spec) fail("usage: press <key> (e.g. press d, press meta+b)")
  const parsed = parseKey(spec)
  if (!parsed) {
    fail(
      `press takes one letter, one digit, a named key, or a modifier+key chord ` +
        `(meta/ctrl/alt/shift). Use \`type ${JSON.stringify(spec)}\` for text.`
    )
  }
  await pressKey(cdp, parsed)
  log(`pressed ${spec}`)
})

const cmdClick = withPage(async (cdp) => {
  const role = arg("role")
  const name = arg("name")
  if (role || name) {
    if (!role || !name) fail("--role and --name must be used together")
    const node = await waitForAx(role, name)
    if (!node) fail(`no accessible ${role} named ${JSON.stringify(name)} within 10s`)
    if (!node.backendDOMNodeId) fail(`accessible ${role} ${JSON.stringify(name)} has no DOM node`)
    await clickPoint(cdp, await rectForBackendNode(cdp, node.backendDOMNodeId))
    log(`clicked ${role} "${name}"`)
    return
  }
  const text = arg("text")
  const selector = text ? null : process.argv[3]
  if (!text && !selector) fail("usage: click <css-selector> | click --text <text> | click --role <role> --name <name>")
  if (selector) {
    await clickPoint(cdp, await rectForSelector(cdp, selector))
    log(`clicked ${selector}`)
    return
  }
  const { nodes } = await axTree(cdp)
  const node = nodes.find((n) => !n.ignored && axName(n) === text && n.backendDOMNodeId)
  if (!node) fail(`no accessible element named ${JSON.stringify(text)}`)
  await clickPoint(cdp, await rectForBackendNode(cdp, node.backendDOMNodeId))
  log(`clicked "${text}"`)
})

function hidesFromArgs() {
  const raw = arg("hide")
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []
}

async function withHides(cdp, selectors, fn) {
  if (selectors.length) {
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const out = [];
        for (const sel of ${JSON.stringify(selectors)}) {
          document.querySelectorAll(sel).forEach((el) => {
            out.push([el, el.style.display]);
            el.style.display = "none";
          });
        }
        window.__verifyHidden = out;
        return out.length;
      })()`,
      returnByValue: true,
    })
    await sleep(120)
  }
  try {
    return await fn()
  } finally {
    if (selectors.length) {
      await cdp.send("Runtime.evaluate", {
        expression: `(() => {
          (window.__verifyHidden || []).forEach(([el, prev]) => { el.style.display = prev; });
          window.__verifyHidden = null;
          return true;
        })()`,
        returnByValue: true,
      })
    }
  }
}

const cmdSnapshot = withPage(async (cdp) => {
  const hide = hidesFromArgs()
  const out = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : null
  const text = await withHides(cdp, hide, async () => {
    const { nodes, byId, root } = await axTree(cdp)
    return renderAx(nodes, byId, root)
  })
  if (out) log(`wrote ${writeArtifact(out, text + "\n")}`)
  else log(text)
})

const cmdScreenshot = withPage(async (cdp) => {
  const hide = hidesFromArgs()
  let out = null
  for (const a of process.argv.slice(3)) if (!a.startsWith("--") && !hide.includes(a)) { out = a; break }
  if (!out) fail("usage: screenshot <path> [--hide <css,selector>]")
  const data = await withHides(cdp, hide, async () => {
    const r = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
    return r.data
  })
  log(`wrote ${writeArtifact(out, Buffer.from(data, "base64"))}`)
})

const cmdTheme = withPage(async (cdp) => {
  const scheme = arg("scheme")
  if (scheme) {
    if (!["dark", "light"].includes(scheme)) fail("--scheme must be dark or light")
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] })
    await sleep(250)
  }
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const d = document.documentElement;
      return {
        htmlClasses: [...d.classList],
        isDark: d.classList.contains("dark"),
        colorScheme: d.style.colorScheme || null,
        storedTheme: localStorage.getItem("theme"),
        storedSystemTheme: localStorage.getItem("systemTheme"),
        prefersDarkAtRead: matchMedia("(prefers-color-scheme: dark)").matches,
      };
    })()`,
    returnByValue: true,
  })
  log(JSON.stringify(result.value, null, 2))
})

async function cmdArtifacts() {
  const state = readState()
  const runId = state?.runId || "unknown"
  mkdirSync(join(ARTIFACTS_DIR, runId), { recursive: true })
  log(join(ARTIFACTS_DIR, runId))
}

function cmdHelp() {
  console.log(`control-grok — drive the grok-bot-clone app

  up [--port N]            start or reuse the dev server + start headless Chrome
  down                     stop exactly the processes this run started
  doctor                   read-only health check of the running instance
  open <path>              navigate the page (default /)
  text [css-selector]      print body or element text
  eval <js>                evaluate JS in the page, print JSON value
  press <key>              dispatch one key (e.g. press d, press meta+b, press ctrl+k)
  type <text>              click a field first, then enter the whole string
  signin                   sign in with GROK_VERIFY_EMAIL/GROK_VERIFY_PASSWORD
  click <css>              click by CSS selector
  click --text <text>      click by accessible name
  click --role R --name N  click by ARIA role + accessible name
  snapshot [path] [--hide <css,selector>]  print (or write) the accessibility tree
  screenshot <path> [--hide <css,selector>]  write a PNG
  theme [--scheme dark|light]  print theme state; optionally emulate the OS scheme first
  artifacts                print the proof-artifact directory for this run

Reuse: when this checkout already runs next dev, up drives that server
instead of starting a second one, and down leaves it running.

Env: CHROME_BIN, GROK_VERIFY_ROOT (default ${ROOT}), GROK_VERIFY_EMAIL and
     GROK_VERIFY_PASSWORD (for signin)`)
}

const COMMANDS = {
  up: cmdUp,
  down: cmdDown,
  doctor: cmdDoctor,
  open: cmdOpen,
  text: cmdText,
  eval: cmdEval,
  press: cmdPress,
  type: cmdType,
  signin: cmdSignIn,
  click: cmdClick,
  snapshot: cmdSnapshot,
  screenshot: cmdScreenshot,
  theme: cmdTheme,
  artifacts: cmdArtifacts,
  help: cmdHelp,
}

const cmd = process.argv[2]
if (!cmd || !COMMANDS[cmd]) {
  cmdHelp()
  process.exit(cmd ? 1 : 0)
}
await COMMANDS[cmd]()

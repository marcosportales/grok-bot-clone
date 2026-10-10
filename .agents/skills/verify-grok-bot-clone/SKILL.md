---
name: verify-grok-bot-clone
description: Drive and verify the grok-bot-clone Next.js app (a local web UI) with headless Chrome over the DevTools Protocol. Use when you need to prove the Clerk-gated home page or chat page renders, that the sidebar shell works, that the bot dialog creates, edits, and deletes a row, or that the dark-mode hotkey works, capture screenshots or ARIA snapshots, or reproduce a UI bug in this repo without installing a test framework.
---

# Verify grok-bot-clone

`grok-bot-clone` is a Next.js 16 (App Router, Turbopack) + shadcn/ui app on Clerk
and Postgres. Its user surfaces are four page routes (`/`, `/chats/<id>`,
`/sign-in`, `/sign-up`) and the `/api/health` JSON endpoint. The root page and the
chat page are behind Clerk and render inside a sidebar shell, so a signed-out
visitor lands on `/sign-in` and both pages need a session. This skill launches the
app in an owned dev server plus an owned headless Chrome, lets you drive it like a
user, and captures proof artifacts.

The driver is `scripts/control-grok.mjs` (see **Helpers**). It has no dependencies:
it uses Node's built-in `fetch` and `WebSocket` to speak CDP to the system Chrome.
Nothing is installed into the project, so verification never changes the app's
dependency graph.

Run every command from the repository root and define the driver once:

```bash
CG="node .agents/skills/verify-grok-bot-clone/scripts/control-grok.mjs"
```

Before driving a feature, read [`features/README.md`](./features/README.md) and the
matching feature file. The map is the maintained source of what is user-facing,
how to reach it, and what proves it.

## Isolation

One instance per checkout, enforced by the driver. `next dev` serves from the
shared `.next` directory and Next 16 keeps a single dev server per project
directory, so a second one cannot start. `up` therefore refuses to start when a
run it owns is still alive, and never attaches to a server belonging to another
checkout.

When this checkout is already running `next dev` (a `pnpm dev` left open in a
terminal, for example), `up` reuses that server instead of starting a second one.
It records the dev PID as unowned and `down` leaves it running, so verification
does not kill a server you started. Because the project lock makes the port
irrelevant, `up --port` fails while a server for this checkout is already up.

State and proof artifacts live outside the repo:

- Run state (PIDs, port, logs, Chrome profile): `/tmp/grok-bot-clone-verify/run/`.
- Proof artifacts: `/tmp/grok-bot-clone-verify/artifacts/<run-id>/`.

Override the root with `GROK_VERIFY_ROOT`. Override the Chrome binary with
`CHROME_BIN`; otherwise the driver searches the usual system locations.

## Launch

```bash
$CG up                 # dev server on 3111 + headless Chrome, navigates to /
$CG up --port 3222     # use another port
```

`up` is ready when it prints the run id, the app URL, and both PIDs. It waits for
`GET /` to return before launching Chrome, and waits for Chrome's DevTools port
before navigating, so the printed URLs are already serving the app. It navigates to
`/`, which signed out leaves the page on `/sign-in`. When it reuses a running dev
server it says so first, and the dev PID line reads
`(reused, left running by down)` instead of `(owned)`.

There is nothing else to build first beyond dependencies: run `pnpm install` once
if `node_modules/.bin/next` is missing. For a short check the printed app URL
(`http://localhost:<port>`) is also visible in a normal browser.

Teardown:

```bash
$CG down
```

`down` kills exactly the process groups this run started (the `next dev` process
and the Chrome process) and deletes only `/tmp/grok-bot-clone-verify/run/`. Proof
artifacts under `artifacts/` are never removed.

## Doctor

```bash
$CG doctor
```

Read-only. Reports the run id, both PIDs and whether they are alive, whether the
run owns the dev server (`owned=false` means it was reused), the dev server's
working directory (must be this checkout), the `GET /` status, the path the page is
on, and one accessibility assertion for that path. Signed out, the page sits on
`/sign-in` and the assertion is the form's `Sign in to grok-bot-clone` heading;
signed in it sits on `/` and the assertion is the `Create a new bot` button. Exits
non-zero and lists problems when the instance is not worth driving. Run it first
whenever anything looks off, and before a proof run whose result matters.

## Drive

All interaction goes through `scripts/control-grok.mjs`. Every command attaches to
the already-running page, so DOM state, scroll position, and theme persist between
invocations; `up` must have been run first.

```bash
$CG open /                         # navigate (default /)
$CG text                           # visible text of <body>
$CG text "h1"                      # text of a CSS selector
$CG eval "location.pathname"       # evaluate JS, prints the JSON value
$CG press d                        # dispatch one key to the focused page
$CG press meta+b                   # a modifier chord, here: toggle the sidebar
$CG press ctrl+k                   # toggle the search palette
$CG type "Ada"                     # click a field first, then enter the string
$CG signin                         # sign in with GROK_VERIFY_EMAIL/PASSWORD
$CG click --role button --name "Create a new bot"
$CG click --role menuitem --name "Create new bot"
$CG click --text "Shuffle"
$CG click "[data-slot=command-input]"   # the palette's unnamed combobox
$CG click "[data-slot=button]"
$CG theme                          # theme state: class, colorScheme, localStorage
$CG theme --scheme dark            # emulate OS dark preference, then read state
```

Selectors to prefer in this app:

- Root trigger: ARIA `button` named `Create a new bot`.
- Sidebar rail: ARIA `button` named `Toggle Sidebar`, and the `[data-slot=sidebar]`
  element whose `data-state` reads `expanded` or `collapsed`.
- New menu: ARIA `button` named `New`, holding `menuitem` entries
  `Create new bot` and `Create group chat`.
- Search: ARIA `button` named `Search`, and the palette `dialog` named
  `Search chats`. Its input is an unnamed `combobox`, so focus it with
  `[data-slot=command-input]`.
- Chat list: `link` rows named `<title> <age> <preview>`, with `aria-current=page`
  on the open chat.
- Account: ARIA `button` named `Open user menu`, and `dialog "Account panel"` with
  `Manage account` and `Sign out`.
- Bot dialog: ARIA `dialog` named `New bot` or `Edit bot`, with textboxes `Name`,
  `Job`, and `How it should work`, and the delete confirmation
  `alertdialog "Delete <name>?"`.
- Chat header: a `sectionheader` holding a `heading` and a `button` named after the
  chat, plus `button "Share desktop"`.
- Auth form: ARIA `heading` named `Sign in to grok-bot-clone`, and the two
  auth-route headings `Create your account` and `Sign in to grok-bot-clone`.
- Theme hotkey: the `d` key on a focused page. No hint for it is rendered, so
  there is no on-page handle.

Rules that keep a run honest:

- Use `--role`/`--name` clicks. Fall back to a CSS selector only when there is no
  accessible name.
- `press` takes one letter, one digit, a named key, or a chord such as `meta+b`,
  `ctrl+k`, or `shift+Tab`, and refuses punctuation rather than dropping it
  silently. A `ctrl` or `meta` chord sends no character text, because the page is
  listening for the shortcut. Text goes through `type`, which needs a preceding
  `click` on the field to focus it.
- A locked surface needs a session, not a skipped step. Run `$CG signin` (see
  [Signing in](./features/README.md#signing-in)) and confirm
  `$CG eval "location.pathname"` reads `/` before driving anything on the root page.
- `click --role` scrolls the target into view and dispatches real mouse events, so
  it also proves the control has a non-zero, hit-testable box. It waits up to 10
  seconds for the control, because Clerk and React render theirs after the page
  loads, and a control that is merely late must not read as missing.
- `press` delivers keys to `window`; the driver enables focus emulation so the
  headless page behaves as focused.
- `theme --scheme dark|light` must read the state in the same invocation as the
  emulation. CDP media emulation is scoped to one WebSocket session and resets
  when the command exits.

## Evidence

Get the artifact directory for the current run, then write inside it:

```bash
ART=$($CG artifacts)               # /tmp/grok-bot-clone-verify/artifacts/<run-id>
$CG snapshot "$ART/home-page.aria.txt" --hide "nextjs-portal,next-route-announcer"
$CG screenshot "$ART/home-page.png"    --hide "nextjs-portal,next-route-announcer"
```

Proof standards for this app:

- Exercise the real user path: navigate the page, dispatch keys, click real
  controls. Do not assert through internal setters or test-only endpoints.
- Capture the action and the resulting state, not only the final screen. For the
  theme hotkey that means the theme state before, after, and after a reload.
- Verify side effects alongside what is visible. The dark-mode choice is persisted
  in `localStorage["theme"]`; `press d` must change both the `dark` class and the
  stored value, and a reload must preserve it. The sidebar's collapse is persisted
  in the `sidebar_state` cookie. A bot is reported by a toast but stored in the
  `bots` table; prove it by reading the row, per
  [Bots](./features/bots.md).
- A dashboard page's accessibility tree carries a stray `heading "Search chats"`
  from the closed command palette. It is not a dialog. Check the `dialog` role or
  `[data-slot=dialog-content]` before reporting an open palette, and see
  [Sidebar](./features/sidebar.md#gotchas).
- `/` and `/chats/<id>` need a session. A signed-out run of a recipe on either one
  measures the sign-in route instead, so sign in first and check the path.
- A screenshot alone is weak proof of a state change. Pair it with `theme` output
  and an ARIA snapshot.
- `--hide "nextjs-portal,next-route-announcer"` removes Next.js dev-tooling
  overlays from snapshots and screenshots. Those elements are framework chrome,
  not app surface. Leaving them out keeps artifacts comparable between runs.
- Report an unreachable path with the attempted command and the unmet
  precondition. Do not report a path you skipped as verified through another one.

## Cleanup

```bash
$CG down
```

Run `down` after every run, including failed iterations, so no dev server or
Chrome process outlives the attempt. `down` only removes run state; confirm the
artifacts you care about still exist at

```bash
ls /tmp/grok-bot-clone-verify/artifacts/<run-id>/
```

Never kill by process name (`pkill -f "next dev"` also matches your own shell).
Kill what you started: use `$CG down`, which uses the recorded PIDs.

A run that creates a bot leaves rows in `bots`, `chats`, and `chat_members`, and a
sidebar row in every later run. Delete what the run created with the delete recipe
in [Bots](./features/bots.md).

## Helpers

`scripts/control-grok.mjs` is the whole driver. Run `$CG help` for the command
list. Relevant environment variables:

- `CHROME_BIN`: Chrome/Chromium executable to launch.
- `GROK_VERIFY_ROOT`: base directory for run state and artifacts
  (default `/tmp/grok-bot-clone-verify`).
- `GROK_VERIFY_EMAIL` and `GROK_VERIFY_PASSWORD`: the dev-instance test account
  `signin` uses. Provisioning is in
  [features/README.md](./features/README.md#signing-in).

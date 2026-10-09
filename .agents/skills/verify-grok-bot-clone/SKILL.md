---
name: verify-grok-bot-clone
description: Drive and verify the grok-bot-clone Next.js app (a local web UI) with headless Chrome over the DevTools Protocol. Use when you need to prove the home page renders or the dark-mode hotkey works, capture screenshots or ARIA snapshots, or reproduce a UI bug in this repo without installing a test framework.
---

# Verify grok-bot-clone

`grok-bot-clone` is a Next.js 16 (App Router, Turbopack) + shadcn/ui starter. Its
only user surface today is one web page. This skill launches that page in an owned
dev server plus an owned headless Chrome, lets you drive it like a user, and
captures proof artifacts.

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
before navigating, so the printed URLs are already serving the app. When it reuses
a running dev server it says so first, and the dev PID line reads
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
working directory (must be this checkout), the `GET /` status, and whether the
accessibility tree contains the heading `Project ready!` and the button `Button`.
Exits non-zero and lists problems when the instance is not worth driving. Run it
first whenever anything looks off, and before a proof run whose result matters.

## Drive

All interaction goes through `scripts/control-grok.mjs`. Every command attaches to
the already-running page, so DOM state, scroll position, and theme persist between
invocations; `up` must have been run first.

```bash
$CG open /                         # navigate (default /)
$CG text                           # visible text of <body>
$CG text "h1"                      # text of a CSS selector
$CG eval "location.pathname"       # evaluate JS, prints the JSON value
$CG press d                        # dispatch a key to the focused page
$CG click --role button --name Button
$CG click --text "Button"
$CG click "[data-slot=button]"
$CG theme                          # theme state: class, colorScheme, localStorage
$CG theme --scheme dark            # emulate OS dark preference, then read state
```

Selectors to prefer in this app:

- Heading: ARIA `heading` named `Project ready!`.
- Primary control: ARIA `button` named `Button` (also `[data-slot=button]`).
- Theme hotkey: the `d` key on a focused page (the hint is the `kbd` element in
  the page footer).

Rules that keep a run honest:

- Use `--role`/`--name` clicks. Fall back to a CSS selector only when there is no
  accessible name.
- `click --role` scrolls the target into view and dispatches real mouse events, so
  it also proves the control has a non-zero, hit-testable box.
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
  stored value, and a reload must preserve it.
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

## Helpers

`scripts/control-grok.mjs` is the whole driver. Run `$CG help` for the command
list. Relevant environment variables:

- `CHROME_BIN`: Chrome/Chromium executable to launch.
- `GROK_VERIFY_ROOT`: base directory for run state and artifacts
  (default `/tmp/grok-bot-clone-verify`).

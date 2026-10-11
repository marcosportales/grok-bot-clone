# Home page

The root page is behind Clerk. Signed out it never renders, because the page calls
`auth.protect()` and the request lands on the sign-in route instead. Signed in it
shows the first-run empty state, a face drawn from a fresh seed on every request,
and the `Create a new bot` trigger that opens the bot dialog. The page renders
inside the dashboard shell, so the sidebar is on screen around it. The dialog and
what it writes are [Bot dialog](./bots.md), the shell around the page is
[Sidebar](./sidebar.md), the header controls are gone and the account control is
[Auth](./auth.md), and the dark-mode hotkey is
[Dark mode toggle](./theme-toggle.md).

## Sub-features

- `home-gate` signed out, a request for `/` redirects to the sign-in route with a
  `redirect_url` back to `/`.
- `home-empty-state` signed in, `/` shows the title `Meet your first bot` with the
  two lines of copy about personality, memory, and a face.
- `home-avatar` the face above the title comes from a new seed on every request, so
  it differs after a reload.
- `home-trigger` the primary control is a button named `Create a new bot` with a
  real, hit-testable box, and clicking it opens the `New bot` dialog.

## How to get to it (user POV)

- Sign in, then open `/`.
- Type the app root URL into any browser. Signed out that lands on the sign-in
  route, and the sign-in form sends the visitor back to `/` on success.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- A signed-in session:
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`. Every recipe below
  except `home-gate` needs it.
- Baseline state: `$CG eval "localStorage.clear(); 'cleared'"` then `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **The gate.** Signed out, run `$CG open /` then
  `$CG eval "location.pathname + location.search"`. The path starts with
  `"/sign-in?redirect_url="` and the query decodes to the app URL for `/`, for
  example `"/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3000%2F"`. The port is
  whatever this run serves, so assert the shape, not the number.
- **Signed in reaches it.** Run `$CG signin`, then `$CG open /` and
  `$CG eval "location.pathname"`. It prints `"/"`.
- **Copy.** Run `$CG text`. Stdout contains `Meet your first bot`,
  `Every bot gets its own personality, memory, and face. Spin one up and start the
  conversation.`, and `Create a new bot`.
- **Trigger is interactive.** Run
  `$CG click --role button --name "Create a new bot"`. Prints
  `clicked button "Create a new bot"` and exits `0`. A non-zero box is required, so
  this fails if the trigger is hidden, collapsed, or covered. The `New bot` dialog
  follows; close it with `$CG press Escape` before the next step.
- **Fresh face per request.** Run
  `$CG eval "document.querySelector('[data-slot=empty-header] img').src"` before and
  after `$CG open /`. The two values differ, because the seed is generated per
  request.
- **Visual proof.** Run
  `$CG screenshot "$ART/home-page.png" --hide "nextjs-portal,next-route-announcer"`.

## Gotchas

- The page is behind Clerk. A signed-out run of any recipe here measures the
  sign-in route instead, so run `$CG signin` first and check
  `$CG eval "location.pathname"` reads `/`.
- `EmptyTitle` renders a `div`, not a heading. The accessibility tree therefore has
  no heading on this page, and asserting on one fails. Assert the copy with
  `$CG text` and the trigger with `--role button`.
- The document still has no `<title>`, so the ARIA root stays an unnamed
  `RootWebArea`.
- There is no site header. The account control lives in the sidebar footer, so a
  recipe that looks for a `banner` finds nothing. Use
  `--role button --name "Open user menu"` on any dashboard page instead, per
  [Auth](./auth.md).
- `document.querySelector('main img')` no longer selects the empty-state face. The
  sidebar's chat avatars and Clerk's user avatar come first in the DOM, so that
  selector returns a sidebar row. Scope the empty state with
  `[data-slot=empty-header] img`.
- The closed search palette leaves a `heading "Search chats"` in the tree of every
  dashboard page. It is not a dialog and it is not this page. See
  [Sidebar](./sidebar.md#gotchas).
- Signed in, `/sign-in` and `/sign-up` redirect back to `/`. The redirect runs in
  the browser, so read the path a moment after the navigation. The auth routes are
  only reachable signed out; sign out before driving anything in [Auth](./auth.md).
- The face is a pure function of a fresh seed, so two runs never match and a
  reload changes it. Assert that the seed changes, never a specific face.
- There is no dark-mode hint on the page. The `d` hotkey still works app-wide and is
  covered by [Dark mode toggle](./theme-toggle.md).
- In dev the page includes Next.js tooling (`nextjs-portal`,
  `next-route-announcer`). Always pass
  `--hide "nextjs-portal,next-route-announcer"` for artifacts.

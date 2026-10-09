# Home page

The root page tells the user the project is ready, shows the starter copy, offers
the primary `Button`, and prints the hint for the dark-mode hotkey. It is one of
three routes in the app; the header controls and the sign-in and sign-up routes
live in [auth](./auth.md).

## Sub-features

- `home-render` loads `/` and shows the heading `Project ready!` with the starter
  copy.
- `home-button` renders the primary control as a button named `Button` that has a
  real, hit-testable box.
- `home-hint` shows the footer hint `(Press d to toggle dark mode)`.

## How to get to it (user POV)

- Open the app root `/`. `control-grok up` navigates there automatically.
- The page is also reachable by typing the printed app URL
  (`http://localhost:<port>/`) into any browser.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- Baseline state: `$CG eval "localStorage.clear(); 'cleared'"` then `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Open the page.** Run `$CG open /`. The command prints
  `opened http://localhost:<port>/` and exits `0`.
- **Heading and copy.** Run `$CG text`. Stdout contains `Project ready!`,
  `You may now add components and start building.`, and
  `We've already added the button component for you.`
- **Hint.** Run `$CG text`. Stdout contains `(Press d to toggle dark mode)`.
- **Primary control is interactive.** Run
  `$CG click --role button --name Button`. Prints `clicked button "Button"` and
  exits `0`. A non-zero box is required, so this fails if the button is hidden,
  collapsed, or covered.
- **Structural proof.** Run
  `$CG snapshot "$ART/home-page.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The file contains `heading "Project ready!" level=1` and `button "Button"`.
- **Visual proof.** Run
  `$CG screenshot "$ART/home-page.png" --hide "nextjs-portal,next-route-announcer"`.
  A 1280-wide PNG of the page is written.

## Gotchas

- The document has no `<title>`, so the ARIA root is `RootWebArea` with no name.
  Assert on the heading and button, not on an app title.
- The header above the page belongs to the auth feature. Its `Sign in` and
  `Sign up` buttons are in the accessibility tree of `/` alongside `Button`; drive
  them per [auth](./auth.md), and assert on the heading and `Button` here.
- `Button` has no click handler yet. A successful click proves the control renders,
  is enabled, and is hit-testable. It does not change state; do not claim a state
  change from it.
- In dev the page includes Next.js tooling (`nextjs-portal`,
  `next-route-announcer`) and a dev-tools alert in the accessibility tree. Always
  pass `--hide "nextjs-portal,next-route-announcer"` for artifacts, and ignore any
  remaining dev-tools entries.
- Pressing `Tab` reaches dev-tools chrome before the app button in dev, so do not
  use Tab order as proof of keyboard reachability.

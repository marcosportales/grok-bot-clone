# grok-bot-clone verification map

This directory is the maintained source for verifying the user-facing behavior of
`grok-bot-clone`. Read this index before driving the app, then use the matching
feature file as the recipe.

At the current commit the app has four page routes and one endpoint: the root
page, the chat page at `/chats/<id>`, the `/sign-in` and `/sign-up` routes, and
the `/api/health` endpoint. The root page and the chat page both sit behind Clerk
and both render inside the dashboard shell, which is the sidebar. A signed-out
visitor to either one lands on `/sign-in` and never sees the shell. Seven
behaviors are mapped: the root page, the sidebar shell, the bot dialog, the chat
page, the dark-mode toggle, the Clerk auth surface, and the health endpoint.
Browser-side persistence is `localStorage["theme"]` and the `sidebar_state`
cookie; the other durable state is the `bots`, `chats`, and `chat_members` tables
that the bot dialog writes. The map covers everything a user can touch today. Add
a feature file whenever a new route, control, or command appears.

## Baseline preconditions

- Run `pnpm install` once if `node_modules/.bin/next` is missing.
- Launch an owned instance from the repository root with
  `node .agents/skills/verify-grok-bot-clone/scripts/control-grok.mjs up`, and
  define `CG="node .agents/skills/verify-grok-bot-clone/scripts/control-grok.mjs"`.
- `up` refuses to start a second instance: Next 16 keeps one `next dev` per project
  directory. When this checkout is already running one, `up` reuses it, prints
  `reusing the dev server ...`, marks the dev PID unowned, and `down` leaves it
  running. `doctor` reports `owned=false` for that case.
- Never drive an instance for a different checkout. `up` fails when the dev lock
  belongs to a foreign directory, and `doctor` checks that the dev PID's working
  directory is this checkout.
- Run `$CG doctor` and require a healthy report before trusting a proof. It asserts
  the surface a signed-out probe reaches, which is the sign-in form, and the
  `Create a new bot` trigger once a session exists.
- Start every recipe from the baseline state unless its preconditions say
  otherwise. Reset the baseline with
  `$CG eval "localStorage.clear(); 'cleared'"` followed by `$CG open /`. Signed in
  that lands on the root page; signed out it lands on `/sign-in`, where the
  dashboard shell is absent.
- The closed search palette leaves a `heading "Search chats"` in the
  accessibility tree of every dashboard page. See
  [Sidebar](./sidebar.md#gotchas) before asserting on a dashboard snapshot.

## Signing in

The root page and the chat page need a session. The harness signs in through the
app's own form with a dev-instance test account, so no human credentials or inbox
are involved. Provenance: the account lives in the development instance
`clerk whoami` links to this repo.

Provision the account once, then delete it when you no longer want it:

```bash
clerk users create --email grok-maintain-verify@example.com --password '<password>' \
  --first-name Verify --last-name Maintain --yes
clerk users list --json            # read the user id and its email address id
clerk api email_addresses/<idn> -X PATCH -d '{"verified":true}' --yes
clerk api users/<id> -X PATCH -d '{"bypass_client_trust":true}' --yes
```

The email address must be `verified` or the form diverts to a code nobody can
read. `bypass_client_trust` cancels the `/sign-in/client-trust` step that would
divert the same way.

Then sign the owned Chrome in with the same credentials:

```bash
export GROK_VERIFY_EMAIL=grok-maintain-verify@example.com
export GROK_VERIFY_PASSWORD='<password>'
$CG signin                       # idempotent; says so when a session already exists
$CG eval "location.pathname"     # "/" when signed in
```

Sign out from the account panel
(`$CG click --role button --name "Open user menu"` then
`$CG click --role button --name "Sign out"`) before driving the signed-out
recipes. The sign-out lands on `/sign-in`, which is where the signed-out gate
leaves a visitor to `/`.

## Driving conventions

- Treat every command as literal. Keep quoted names and flags unchanged.
- Prefer ARIA role + accessible name over CSS selectors or DOM position.
- All interaction goes through `control-grok`. Do not add a test framework.
- State (DOM, theme, sidebar, scroll) persists between commands; only `up`/`down`
  reset it.
- `press` sends one letter, one digit, a named key, or a chord such as `meta+b`,
  `ctrl+k`, or `shift+Tab`. Text goes through `type`, because `press` refuses
  punctuation.
- `click --role` waits up to 10 seconds for the control. A control Clerk or React
  renders in the browser is late, not missing.
- Focus a control that carries no accessible name by CSS selector. The search
  palette's input is `[data-slot=command-input]`.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the app identity
  visible.
- State-change proof includes the state before, after, and after a reload.
- Mutation proof includes a read-only second view of the stored value. For the
  theme that is `localStorage["theme"]` read back by `$CG theme`, for the sidebar
  it is the `sidebar_state` cookie, and for a bot it is the `bots` row read back
  by the queries in [Bots](./bots.md).
- Write artifacts under `$($CG artifacts)` and use `--hide
  "nextjs-portal,next-route-announcer"` so dev tooling does not pollute them.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet
  precondition. Do not report a skipped entry point as verified through a
  different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-grok` starts with `Preconditions:` and uses labeled
   bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles,
required state, commands, and observable proof.

## Features

- [Home page](./home-page.md) covers the Clerk gate on `/`, the signed-in empty
  state, the per-request face, and the `Create a new bot` trigger.
- [Sidebar](./sidebar.md) covers the shell's rail and its collapse, the `New`
  menu, the chat search palette, the chat list, and the account menu.
- [Bot dialog](./bots.md) covers the dialog in create, edit, and delete mode, and
  the `bots`, `chats`, and `chat_members` rows each mode changes.
- [Chat page](./chat-page.md) covers `/chats/<id>`, its header, the button that
  edits the chat's bot, the share placeholder, and the missing-chat page.
- [Dark mode toggle](./theme-toggle.md) covers the `d` hotkey, system-preference
  following, and persistence across reloads.
- [Auth](./auth.md) covers the gate, the `/sign-in` and `/sign-up` routes, and the
  signed-in account panel.
- [API health](./api-health.md) covers the `/api/health` status, body, and content
  type.

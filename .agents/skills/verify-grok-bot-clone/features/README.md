# grok-bot-clone verification map

This directory is the maintained source for verifying the user-facing behavior of
`grok-bot-clone`. Read this index before driving the app, then use the matching
feature file as the recipe.

At the current commit the app has three page routes and one endpoint: the root
page, the `/sign-in` and `/sign-up` routes, and the `/api/health` endpoint. The root
page sits behind Clerk, so a signed-out visitor to `/` lands on `/sign-in` and
never sees the root page at all. Five user-facing behaviors are mapped: the root
page, bot creation from its dialog, the dark-mode toggle, the Clerk auth surface,
and the health endpoint. Browser-side persistence is `localStorage`; the only
other durable state is the `bots` table that bot creation writes. The map covers
everything a user can touch today. Add a feature file whenever a new route,
control, or command appears.

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
  `$CG eval "localStorage.clear(); 'cleared'"` followed by `$CG open /`.

## Signing in

The root page needs a session. The harness signs in through
the app's own form with a dev-instance test account, so no human credentials or
inbox are involved. Provenance: the account lives in the development instance
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
recipes. Text entry goes through `$CG type`, because `press` handles one letter,
one digit, or a named key and refuses punctuation.

## Driving conventions

- Treat every command as literal. Keep quoted names and flags unchanged.
- Prefer ARIA role + accessible name over CSS selectors or DOM position.
- All interaction goes through `control-grok`. Do not add a test framework.
- State (DOM, theme, scroll) persists between commands; only `up`/`down` reset it.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the app identity
  visible.
- State-change proof includes the state before, after, and after a reload.
- Mutation proof includes a read-only second view of the stored value. For the
  theme that is `localStorage["theme"]` read back by `$CG theme`; for a created bot
  it is the `bots` row read back by the query in [Bots](./bots.md).
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
- [Bots](./bots.md) covers the bot dialog, its presets and validation, the insert,
  and the toast that reports it.
- [Dark mode toggle](./theme-toggle.md) covers the `d` hotkey, system-preference
  following, and persistence across reloads.
- [Auth](./auth.md) covers the header controls, the sign-in modal, the `/sign-in`
  and `/sign-up` routes, and the signed-in account panel.
- [API health](./api-health.md) covers the `/api/health` status, body, and content
  type.

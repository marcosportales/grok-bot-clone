# grok-bot-clone verification map

This directory is the maintained source for verifying the user-facing behavior of
`grok-bot-clone`. Read this index before driving the app, then use the matching
feature file as the recipe.

At the current commit the app is a Next.js + shadcn starter with exactly one page
and two user-facing behaviors. There is no routing, auth, persistence layer, or
API, so this map covers everything a user can actually touch today. Add a feature
file whenever a new route, control, or command appears.

## Baseline preconditions

- Run `pnpm install` once if `node_modules/.bin/next` is missing.
- Launch an owned instance from the repository root with
  `node .agents/skills/verify-grok-bot-clone/scripts/control-grok.mjs up`, and
  define `CG="node .agents/skills/verify-grok-bot-clone/scripts/control-grok.mjs"`.
- `up` refuses to start a second instance: `next dev` shares `.next`, so one
  instance per checkout. Never drive an instance this run did not start.
- Run `$CG doctor` and require a healthy report before trusting a proof.
- Start every recipe from the baseline state unless its preconditions say
  otherwise. Reset the baseline with
  `$CG eval "localStorage.clear(); 'cleared'"` followed by `$CG open /`.

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
- Mutation proof includes a read-only second view of the stored value; here that
  is `localStorage["theme"]` read back by `$CG theme`.
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

- [Home page](./home-page.md) covers the root page render, the primary button, and
  the visible dark-mode hint.
- [Dark mode toggle](./theme-toggle.md) covers the `d` hotkey, system-preference
  following, and persistence across reloads.

# API health

`GET /api/health` reports whether the app can reach its database. While the
database answers it returns `200` with `{"ok":true,"latencyMs":<n>}`; when it does
not, it returns `503` with `{"ok":false,"latencyMs":<n>}`.

## Sub-features

- `health-ok` a healthy database answers `GET /api/health` with status `200` and a
  JSON body carrying `"ok": true` and a numeric `"latencyMs"`.
- `health-content-type` the response is served as `application/json`.
- `health-failure` an unreachable database answers `503` with `"ok": false`.
  Unreachable in a normal run; see Gotchas.

## How to get to it (user POV)

- Open `http://localhost:<port>/api/health` in a browser.
- Call the same URL with any HTTP client.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- `DATABASE_URL` in `.env.local` points at a reachable database. Without one the
  route cannot report healthy.
- Baseline state: `$CG open /`. The fetch runs from the origin the route is
  served from.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Healthy status.** Run
  `$CG eval "(async () => (await fetch('/api/health')).status)()"`. It prints
  `200`.
- **Healthy body.** Run
  `$CG eval "(async () => await fetch('/api/health').then((r) => r.json()))()"`.
  It prints an object with `"ok": true` and a numeric `"latencyMs"`.
- **JSON content type.** Run
  `$CG eval "(async () => { const r = await fetch('/api/health'); return { status: r.status, ct: r.headers.get('content-type') } })()"`.
  It prints `{"status":200,"ct":"application/json"}`.
- **Artifact.** Run
  `$CG eval "(async () => await fetch('/api/health').then((r) => r.json()))()" > "$ART/api-health.json"`.
  The file holds the body; the status printed above is the read-only second view.

## Gotchas

- `$CG eval` evaluates an expression, so a top-level `await fetch(...)` is a
  `SyntaxError`. Wrap the call in an async IIFE, as the commands above do.
- The first call after `up` can take hundreds of milliseconds while the
  connection pool opens; later calls answer in a few milliseconds. Assert the body
  shape, never a `latencyMs` threshold.
- `health-failure` needs an unreachable database. Do not edit `.env.local` to force
  it. Repair or repoint the database instead, and report the sub-feature as
  unreachable with that prerequisite.
- A missing `DATABASE_URL` is a different failure from `health-failure`: the route
  answers with a server error instead of the `503` JSON body.
- The request passes through Clerk middleware, so responses carry
  `x-clerk-auth-status` headers. The route is not protected, and a signed-out
  caller still gets `200`.

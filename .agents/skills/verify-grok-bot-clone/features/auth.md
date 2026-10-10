# Auth

Clerk guards the root page and the chat page. Signed out, a request for either one
redirects to the sign-in route with a `redirect_url` back to it. The `/sign-in` and
`/sign-up` routes render Clerk's forms as full pages, and each form links to the
other. There is no site header and no sign-in modal, so the page form is the only
way in. Signed in, the account control sits in the sidebar footer, and it opens a
panel holding `Manage account` and `Sign out`. The shell the control lives in is
[Sidebar](./sidebar.md).

## Sub-features

- `auth-gate` signed out, a request for `/` or `/chats/<id>` redirects to the
  sign-in route with a `redirect_url` back to the requested path.
- `auth-signin-route` `/sign-in` renders the sign-in form in the page body.
- `auth-signup-route` `/sign-up` renders the sign-up form with an email field, a
  password field, and a show-password control.
- `auth-form-switch` the link at the foot of either form switches to the other
  form.
- `auth-no-header` no page renders a `Sign in` or `Sign up` button.
- `auth-account` signing in replaces the signed-out routes with a sidebar footer
  control named `Open user menu`.
- `auth-panel` the account control opens a panel holding `Manage account` and
  `Sign out`.
- `auth-signout` `Sign out` ends the session and returns the reader to the sign-in
  route.
- `auth-signed-in-redirect` signed in, `/sign-in` and `/sign-up` both redirect
  back to `/`.

## How to get to it (user POV)

- Open `/` signed out, and follow the redirect to the sign-in route.
- Open `/sign-in` or `/sign-up` directly. The forms render as pages.
- Follow the link at the foot of either form to reach the other one.
- Sign in with the harness test account to reach the account control in the sidebar
  footer.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- Signed-out recipes: `$CG open /sign-in`. Signed out, `/` redirects here anyway,
  and the auth routes are only reachable signed out; see Gotchas.
- Signed-in recipes need
  `GROK_VERIFY_EMAIL=... GROK_VERIFY_PASSWORD=... $CG signin`.
- `ART=$($CG artifacts)` is the artifact directory for this run.
- `clerk-js` fetches from the network on first render, so allow a moment after a
  navigation before snapshotting.

- **The gate.** Signed out, run `$CG open /` and
  `$CG eval "location.pathname + location.search"`. The path starts with
  `"/sign-in?redirect_url="` and the query decodes to the app URL for `/`, for
  example `"/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3000%2F"`. The port is
  whatever this run serves, so assert the shape, not the number.
- **The chat gate.** Signed out, run `$CG open /chats/anything` and the same read.
  The path is the sign-in route with a `redirect_url` for that chat.
- **Sign-in route.** Run `$CG open /sign-in` and `$CG eval "location.pathname"`.
  The path is `"/sign-in"`, and a snapshot holds
  `heading "Sign in to grok-bot-clone" level=1` inside `main`,
  `button "Continue with Google"`, `textbox "Email address" required=true`,
  `button "Continue"`, and the links `Sign up` and `Clerk logo`. There is no
  `banner` and no `Sign in` button.
- **Sign-up route.** Run `$CG open /sign-up` and `$CG eval "location.pathname"`.
  The path is `"/sign-up"`, and the tree holds
  `heading "Create your account" level=1`, `textbox "Email address" required=true`,
  `textbox "Password" required=true`, `button "Show password"`,
  `button "Continue"`, and `link "Sign in"`.
- **No header control.** Run `$CG click --role button --name "Sign in"`. It fails
  with `no accessible button named "Sign in" within 10s`, which is the proof that
  no page carries a header sign-in control.
- **Form switch.** On `/sign-in`, run `$CG click --role link --name "Sign up"`, then
  `$CG eval "location.pathname"`. It prints `"/sign-up"`. On `/sign-up`, run
  `$CG click --role link --name "Sign in"`. It prints `"/sign-in"`.
- **Visual proof.** Run
  `$CG screenshot "$ART/auth-signin-page.png" --hide "nextjs-portal,next-route-announcer"`
  on `/sign-in` and
  `$CG screenshot "$ART/auth-signup-page.png" --hide "nextjs-portal,next-route-announcer"`
  on `/sign-up`.
- **Signed in.** Run `$CG signin`, then `$CG open /` and
  `$CG eval "location.pathname"`. It prints `"/"`. The sidebar footer holds
  `button "Open user menu"`.
- **Account panel.** Run `$CG click --role button --name "Open user menu"`, then
  `sleep 2`, then
  `$CG snapshot "$ART/auth-account-panel.aria.txt" --hide "nextjs-portal,next-route-announcer"`.
  The tree holds `dialog "Account panel"` with `button "Manage account"` and
  `button "Sign out"`.
- **Signed-in redirect.** Still signed in, run `$CG open /sign-in`, `sleep 4`, then
  `$CG eval "location.pathname"`. It prints `"/"`. Do the same for `/sign-up`.
- **Sign out.** Run `$CG click --role button --name "Open user menu"`, then
  `$CG click --role button --name "Sign out"`, then `sleep 4` and
  `$CG eval "({ path: location.pathname + location.search, user: window.Clerk?.user?.id ?? null })"`.
  `user` is `null` and the path is the sign-in route with a `redirect_url` for `/`.

## Gotchas

- There is no sign-in modal and no header. An older version of the app had a site
  header with `Sign in` and `Sign up` buttons that opened the form as a dialog over
  the page, and committing `08a88e1` deleted it. A recipe built on `banner`,
  `dialog` without a name, or `button "Sign in"` measures nothing now.
- `Sign in` and `Sign up` each name a form's footer link. Use `--role link` for
  those. The header buttons those names used to collide with are gone.
- The `auth-no-header` recipe asserts an absence by failing to click. That costs the
  driver's 10-second wait. Read the snapshot for a faster absence check.
- The signed-in redirect away from the auth routes runs in the browser, so a read
  taken immediately after the navigation can still report `/sign-in`. Wait, then
  read.
- `clerk-js` renders into the tree after the page loads. A snapshot taken
  immediately after a navigation can be empty of the form. The driver's role clicks
  wait for their target, but a plain `snapshot` does not.
- `auth-account` needs a dev-instance test account. The harness provisions one and
  `$CG signin` drives the real form. Provisioning and the two environment variables
  are in the [README](./README.md#signing-in).
- The email-code verification step, the sign-up CAPTCHA, and completing Google
  sign-in still need human credentials or an inbox, and stay unreachable.
- Signed in, the auth routes bounce to `/`. Sign out from the account panel before
  driving the signed-out recipes.
- Clerk development keys log a warning and a telemetry notice to the console. Both
  are expected in dev and are not failures.
- A test account stops at the `/sign-in/client-trust` step until it is marked
  `bypass_client_trust`. `$CG signin` reports the path when it stops there.

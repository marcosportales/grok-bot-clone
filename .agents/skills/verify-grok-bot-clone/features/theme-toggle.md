# Dark mode toggle

Dark mode lets a user switch the whole page between light and dark by pressing
`d`, or by relying on the operating system preference, and remembers the explicit
choice across reloads.

## Sub-features

- `theme-toggle` pressing `d` switches the page between light and dark.
- `theme-system` with no explicit choice, the page follows the OS color-scheme
  preference.
- `theme-persist` an explicit choice survives a page reload.

## How to get to it (user POV)

- Press `d` anywhere on the page while focus is not inside a text field.
- Change the operating system light/dark setting while the page has no explicit
  choice.
- Reload the page to see the last explicit choice restored.

## Driving it with control-grok

Preconditions:

- An owned instance is healthy: `$CG doctor` reports `doctor: healthy`.
- Fresh, choice-free state:
  `$CG eval "localStorage.clear(); 'cleared'"` then `$CG open /`.
- `ART=$($CG artifacts)` is the artifact directory for this run.

- **Baseline is light.** Run `$CG theme`. The output has `"isDark": false`,
  `"storedTheme": null`.
- **Follow the OS preference (dark).** Run `$CG theme --scheme dark`. The output
  has `"isDark": true`, `"prefersDarkAtRead": true`, `"storedTheme": null`. The
  state is read in the same command as the emulation because media emulation does
  not survive a new command.
- **Follow the OS preference (light).** Run `$CG theme --scheme light`. The output
  has `"isDark": false`, `"prefersDarkAtRead": false`.
- **Toggle to dark.** Run `$CG press d`. Then run `$CG theme`. The output has
  `"isDark": true` and `"storedTheme": "dark"`.
- **Persist.** Run `$CG open /` to reload, then `$CG theme`. The output still has
  `"isDark": true` and `"storedTheme": "dark"`.
- **Toggle back to light.** Run `$CG press d`, then `$CG theme`. The output has
  `"isDark": false` and `"storedTheme": "light"`.
- **Visual proof.** With the page dark, run
  `$CG screenshot "$ART/theme-dark.png" --hide "nextjs-portal,next-route-announcer"`;
  with it light, run
  `$CG screenshot "$ART/theme-light.png" --hide "nextjs-portal,next-route-announcer"`.
  The two PNGs differ and the dark one shows dark surfaces.

## Gotchas

- The driver must navigate to `localhost`, not `127.0.0.1`. Next dev treats them
  as different origins and blocks its HMR client on `127.0.0.1`, which stops React
  from hydrating, so the hotkey never attaches. `up` already uses `localhost`.
- `theme --scheme` and its reading must be one command. Chrome resets emulated
  media when the CDP session closes, so `theme --scheme dark` followed by a
  separate `theme` reports light again.
- `press d` needs a focused page. The driver enables focus emulation on every
  command; if a run reports no change, run `$CG doctor` before assuming a bug.
- A resolved dark page is not proof of persistence. Assert
  `localStorage["theme"]` via `$CG theme`, then reload and assert again.
- `localStorage` belongs to the owned Chrome profile. A fresh `up` starts from
  empty storage, so clear it explicitly when a recipe needs baseline state.

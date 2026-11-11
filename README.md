# Herdr attention notifications

Agent notifications from the [Herdr](https://herdr.dev) desktop app, on the desktop:
a popup that reaches you from another workspace, with the reason in it.

This repo holds three small pieces that work together.

| Piece | What it does |
|---|---|
| `pi/extensions/herdr-prompt-status.ts` | A pi extension. While a question dialog from any pi package waits for you, it tells Herdr the pane is `blocked`. |
| `herdr-app/mods/needs-you/` | A Herdr mod. Watches every agent and, when one turns blocked, posts a note with the space, tab and the reason. |
| `herdr-app/mods/toast-desktop/` | A Herdr toast mod. Draws the in-app popup as before and also sends it to the system's notification service while the Herdr window is not focused. |

You can use any piece alone. Together they cover the case "an agent is waiting for me and I am in another window".

## Why this exists

Two gaps in Herdr 0.1.15 make agent attention easy to miss.

1. **A question dialog never marks the pane blocked.** Herdr learns agent state from
   OSC 7501 records the program writes. pi reports `blocked` for its own dialogs, but for
   `ctx.ui.custom()` it only does that when the caller passes `blocked: true`. Packages such as
   `@juicesharp/rpiv-ask-user-question` draw their form with `ui.custom(..., { overlay: true })`
   and pass no `blocked`, so the pane stays `working` and nothing is reported at all.

2. **The blocked note has no reason in it, and never leaves the window.** Herdr's own note is
   `"<App> needs you"` and `"<space> / <tab>"`. It drops the program's `msg` ("Approve the
   change?"), sometimes arrives with no text at all, and is drawn inside the Herdr window, which
   you cannot see from another workspace.

## Install

```sh
./install.sh
```

It copies each piece into place and prints the two edits you still have to make yourself.
Those edits touch your own config and layout, so the script does not make them.

### The two edits

**1. Keep in-app popups on.** `~/.config/herdr/config-gpui.local.toml`:

```toml
[notifications]
delivery = "herdr"
```

The built-in field is either/or: `off`, `herdr`, `terminal`, `system`. Only `herdr` draws
in-app popups, and only a drawn popup is copied to the desktop. `system` would replace
popups instead of adding to them.

**2. Give the watcher a home and point the toasts at the new mod.** In your layout,
`~/.config/herdr-app/layouts/<name>.json`:

```json
{ "id": "root", "type": "row", "toast": "toast-desktop", "children": [
  { "id": "sidebar", "type": "column", "children": [
    "...",
    { "id": "needs-you", "type": "block", "content": { "mod": "needs-you" }, "size": { "px": 1 } }
  ] },
  { "id": "work", "type": "column", "children": [ "..." ] }
] }
```

- `"toast": "toast-desktop"` at the root replaces the shipped toast.
- The 1 px block is where the watcher runs. It is invisible, but it must be a real block:
  a mod copy starts only when its block shows, and a `"hidden": true` block never starts.
- If Herdr docks a 320 px block for the new mod folder on first sight, delete that block,
  or you get an empty column on the right of the window.

## How it works

- The pi extension listens to pi's generic `ui_prompt_start` / `ui_prompt_end` events for
  `kind === "custom"` and writes one OSC 7501 record itself:
  `ESC ] 7501 ; state=blocked : app=pi : kind=question : msg=<base64> ESC \`.
  It knows no question package, so every package that draws a custom component is covered.
  It stays silent outside Herdr panes and when `PI_PROGRAM_STATUS=0`.
- The watcher polls `agents()` and `terminals()` every 2 s and acts on a transition into
  `blocked`. It posts an in-app note, and a `notify-send` when Herdr is not focused.
- The toast mod copies `{title, body, icon}` to `notify-send` for every popup, so finished
  agents and custom notifications also reach the desktop. It skips `"… needs you"` notes,
  which the watcher owns, and empty ones, which Herdr's own attention popup can be.

## Needs

- Herdr with mods (`herdr-app` 0.1.15 or later) and `notify-send`.
- pi, for the extension part. Its auto-discovery loads `~/.pi/agent/extensions/*.ts`.
- Hyprland, for the focus check: `hyprctl -j activewindow`. See the caveat below.

## Caveats

- **Focus check is Hyprland-specific.** Herdr's `window().active` stayed `true` while another
  window had the keyboard, so both mods ask the compositor instead. On another desktop the
  check fails and they notify anyway, which is the safe direction.
- **hokum draws no card over a fullscreen surface.** The note still lands in its history.
  Other notification daemons may differ.
- The pi extension writes to stdout, like pi's own status reports. It sends one short record per
  prompt, not a stream.

## License

MIT.

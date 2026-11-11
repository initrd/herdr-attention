#!/usr/bin/env bash
# Copy the pieces into place. Your config and layout stay untouched: the two
# edits they need are printed at the end.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
app_home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
pi_home="${PI_HOME:-$HOME/.pi/agent}"

if [ ! -d "$app_home" ]; then
  echo "no Herdr app home at $app_home; set HERDR_APP_HOME" >&2
  exit 1
fi

for mod in needs-you toast-desktop; do
  mkdir -p "$app_home/mods/$mod"
  cp "$here/herdr-app/mods/$mod/main.js" "$here/herdr-app/mods/$mod/mod.json" "$app_home/mods/$mod/"
  echo "mod  -> $app_home/mods/$mod"
done

if [ -d "$pi_home/extensions" ] || [ -d "$pi_home" ]; then
  mkdir -p "$pi_home/extensions"
  cp "$here/pi/extensions/herdr-prompt-status.ts" "$pi_home/extensions/"
  echo "pi   -> $pi_home/extensions/herdr-prompt-status.ts"
else
  echo "skip pi extension: no $pi_home"
fi

if command -v notify-send >/dev/null 2>&1; then
  echo "notify-send found"
else
  echo "warning: notify-send not found; desktop popups will not work" >&2
fi

cat <<'TEXT'

Now make these two edits yourself.

1. Keep in-app popups on, in ~/.config/herdr/config-gpui.local.toml:

     [notifications]
     delivery = "herdr"

2. Point the toasts at the new mod and give the watcher a home, in
   ~/.config/herdr-app/layouts/<your layout>.json:

     root:   "toast": "toast-desktop"
     sidebar: { "id": "needs-you", "type": "block",
                "content": { "mod": "needs-you" }, "size": { "px": 1 } }

   Delete any 320 px block Herdr docked for the new mod folder by itself.

Then check both mods:  herdr-app check <app home>/mods/needs-you
TEXT

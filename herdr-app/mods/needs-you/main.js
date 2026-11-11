// Tells you when any agent turns blocked: an in-app note, and — when the Herdr
// window is not the one with the keyboard — a desktop notification with the
// space, tab and the program's own reason, which the app's own note leaves out.

import { View, div } from "gpui-kit";
import { agents, terminals, notify, exec, focused } from "herdr";

const POLL_MS = 2000;

// Herdr's window().active stays true while another window has the keyboard, so
// ask the compositor. Not knowing is no reason to stay silent.
async function herdrHasFocus() {
  try {
    const { stdout } = await exec("hyprctl", ["-j", "activewindow"], { timeout: 1500 });
    return JSON.parse(stdout)?.class === "herdr-app";
  } catch {
    return false;
  }
}

export default class NeedsYou extends View {
  states = new Map(); // terminal address -> last status seen
  busy = false;

  init(_props, cx) {
    cx.timer.every(POLL_MS, () => this.poll());
  }

  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const turned = [];
      const seen = new Set();
      for (const a of agents()) {
        seen.add(a.address);
        const before = this.states.get(a.address);
        this.states.set(a.address, a.status);
        if (a.status === "blocked" && before !== "blocked") turned.push(a);
      }
      for (const address of [...this.states.keys()]) {
        if (!seen.has(address)) this.states.delete(address);
      }
      if (turned.length === 0) return; // no need to ask the compositor
      const here = await herdrHasFocus();
      const mine = focused()?.terminal;
      const reports = new Map(terminals().map((t) => [t.address, t.report]));
      for (const a of turned) {
        if (here && a.address === mine) continue; // you are looking at that pane
        const title = `${a.app ?? "An agent"} needs you`;
        const body = [a.space_name && `${a.space_name} / ${a.tab_name}`, reports.get(a.address)?.msg]
          .filter(Boolean)
          .join(" — ");
        notify({
          title,
          body,
          level: "warning",
          action: { name: "agent.focus", args: { terminal: a.address } },
        });
        // The app's own note stays inside the window; this one reaches the
        // desktop, the only place you see it from another workspace.
        if (!here) {
          exec("notify-send", ["--app-name=Herdr", title, body]).catch(() => {});
        }
      }
    } finally {
      this.busy = false;
    }
  }

  render() {
    return div().size(0);
  }
}

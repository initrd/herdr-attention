// How notifications look, plus a copy to the system's own notification service.
// Herdr calls this once per notification (Herdr's own and every notify()) in
// place of the shipped toast. The popup stays as is; when the Herdr window does
// not have the keyboard, the same title and body also go to notify-send.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, exec } from "herdr";

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };

// One desktop notification per popup: the overlay id is new for each one.
const sent = new Set();

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

function mirror(p) {
  // An empty note has nothing to copy, and "needs you" notes are the needs-you
  // mod's: it sends the reason too, so copying this one would be a duplicate.
  if (!p.title && !p.body) return;
  if (/needs you$/i.test(p.title ?? "")) return;
  const key = p.overlay ?? `${p.title ?? ""}\u0000${p.body ?? ""}`;
  if (sent.has(key)) return;
  sent.add(key);
  if (sent.size > 500) sent.clear();
  const args = ["--app-name=Herdr"];
  if (typeof p.icon === "string" && p.icon.includes("/")) args.push(`--icon=${p.icon}`);
  args.push(p.title ?? "Herdr");
  if (p.body) args.push(String(p.body));
  herdrHasFocus().then((focused) => {
    if (!focused) exec("notify-send", args).catch(() => {});
  });
}

export default class ToastDesktop extends View {
  render(cx) {
    const t = theme();
    const p = props() ?? {};
    mirror(p);
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    return h_flex()
      .id("toast")
      .size_full()
      .px(18)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(p.icon ? image(p.icon).w(18).h(18).flex_none() : div().size(8).rounded(4).flex_none().bg(t[DOT[p.level] ?? "accent"]))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(div().truncate().font_semibold().text_size(13).text_color(t.foreground).child(login ? `${login[1]} needs a login: run` : p.title ?? ""))
          .when(!login && Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(t.muted).child(p.body ?? "")))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).text_size(12).text_color(t.muted).child(command))
            .child(div().id("toast-login-copy").flex_none().px(6).py(3).rounded(4).bg(t.raised)
              .text_size(12).text_color(t.foreground).cursor_pointer().hover(s => s.bg(t.hover))
              .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
              .child(this.copied ? "Copied" : "Copy")))),
      );
  }
}

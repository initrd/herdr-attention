// Report "blocked" over the terminal's status protocol (OSC 7501) while an
// extension component waits for the user, so Herdr shows the pane as needing
// you. Any package's component counts: pi fires ui_prompt_start / ui_prompt_end
// around every dialog, and only components arrive without pi's own report.

const ESC = "\x1b";
const host = Boolean(process.env.HC_TERMINAL_ID || process.env.HERDR_ENV === "1");
const enabled = host && process.env.PI_PROGRAM_STATUS !== "0";


function report(pairs: string[]): void {
  if (!enabled) return;
  try {
    // One short write to the program's own status channel. Nothing is drawn.
    process.stdout.write(`${ESC}]7501;${pairs.join(":")}${ESC}\\`);
  } catch {
    // A missing or closing terminal is not worth an error in the chat.
  }
}

export default function (pi: any) {
  let open = 0;

  pi.on("ui_prompt_start", async (event: any, ctx: any) => {
    if (ctx?.mode !== "tui") return;
    // Pi already reports blocked for its own dialogs (select, confirm, input,
    // editor). Only components are left unreported, so only they need us.
    if (event?.kind !== "custom") return;
    open += 1;
    if (open > 1) return; // overlapping prompts share one blocked span
    const title = typeof event?.title === "string" ? event.title.trim() : "";
    const message = Buffer.from(title || "Waiting for your input", "utf8").toString("base64");
    report(["state=blocked", "app=pi", "kind=question", `msg=${message}`]);
  });

  pi.on("ui_prompt_end", async (_event: any, ctx: any) => {
    if (ctx?.mode !== "tui" || open === 0) return;
    open -= 1;
    if (open > 0) return;
    report([`state=${ctx?.isIdle?.() === false ? "working" : "idle"}`, "app=pi"]);
  });
}

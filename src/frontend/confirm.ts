// Ask the player before something that can't be undone from the page. Uses Lumiverse's own
// confirm dialog, or the browser's on older hosts.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";

export async function ask(ctx: SpindleFrontendContext, opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
  try {
    if (typeof ctx.ui?.showConfirm === "function") {
      const r = await ctx.ui.showConfirm({ title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel, cancelLabel: opts.cancelLabel, variant: opts.danger ? "danger" : "warning" });
      return !!r?.confirmed;
    }
  } catch {
    /* fall back to the browser's dialog */
  }
  return typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(`${opts.title}\n\n${opts.message}`) : false;
}

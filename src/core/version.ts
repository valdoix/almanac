// The extension's version, shared by the backend and frontend bundles so the
// drawer can tell when the page and the background process disagree.
export const VERSION = "1.29.1";

/** The preset release this extension was built with; the handshake reports the one in use. */
export const PRESET_VERSION = "1.1.5";

/** Whether preset version `a` is older than `b` ("1.0.9" < "1.0.11"). */
export function olderThan(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}

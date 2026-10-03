// Pear Desktop (pear-devs/pear-desktop, the "YouTube Music" desktop app), API Server plugin: the
// player the Soundtrack drives (design/11 §10). REST on 127.0.0.1:26538. A client asks once with
// POST /auth/{clientId}; the app shows Allow / Deny and answers with a JWT. Every call goes through
// spindle.cors (the server makes it, and loopback is allowed there).

import type { NowPlaying } from "../../core/soundtrack/director";
import type { TrackArtist } from "../../core/soundtrack/taste";
import { describe, host } from "../host";

export type PlayerStatus = "connected" | "not-running" | "not-allowed" | "no-permission" | "error";

export class PlayerError extends Error {
  constructor(public status: PlayerStatus, message: string) {
    super(message);
  }
}

interface Res {
  status: number;
  body: string;
}

const API = "/api/v1";

export class PearPlayer {
  constructor(
    public base: string,
    public token: string | null,
    private clientId: string,
  ) {
    this.base = base.replace(/\/+$/, "");
  }

  private async raw(method: string, path: string, body?: unknown, auth = true): Promise<Res> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    let res: any;
    try {
      res = await host.cors(`${this.base}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) } as any);
    } catch (err) {
      const msg = describe(err);
      if (/permission/i.test(msg)) throw new PlayerError("no-permission", "The cors_proxy permission isn't granted, so the Almanac can't reach the player.");
      if (/ECONNREFUSED|refused|unable to connect|fetch failed|timed? ?out|ENOTFOUND|socket|network/i.test(msg)) throw new PlayerError("not-running", `YouTube Music (Pear Desktop) isn't answering at ${this.base}. Is it open, with the API Server plugin on?`);
      throw new PlayerError("error", msg);
    }
    const status = Number(res?.status ?? 0);
    const text = typeof res?.body === "string" ? res.body : res?.body == null ? "" : JSON.stringify(res.body);
    if (status === 401 || status === 403) throw new PlayerError("not-allowed", "YouTube Music didn't allow the Almanac. Press Connect and choose Allow in the app.");
    if (status >= 400) throw new PlayerError("error", `YouTube Music answered ${status} to ${method} ${path}${text ? `: ${text.slice(0, 200)}` : ""}`);
    return { status, body: text };
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const r = await this.raw(method, path, body);
    if (r.status === 204 || !r.body.trim()) return null;
    try {
      return JSON.parse(r.body) as T;
    } catch {
      return null;
    }
  }

  /** Ask the app for a token (it shows Allow / Deny unless this client was allowed before). */
  async connect(): Promise<string> {
    const r = await this.raw("POST", `/auth/${encodeURIComponent(this.clientId)}`, undefined, false);
    let token = "";
    try {
      token = JSON.parse(r.body)?.accessToken ?? "";
    } catch {
      /* fall through */
    }
    if (!token) throw new PlayerError("not-allowed", "YouTube Music didn't hand over a token.");
    this.token = token;
    return token;
  }

  async nowPlaying(): Promise<NowPlaying | null> {
    const s = await this.json<any>("GET", `${API}/song`);
    if (!s?.videoId) return null;
    return {
      videoId: String(s.videoId),
      title: String(s.title ?? ""),
      artist: String(s.artist ?? ""),
      album: s.album ?? undefined,
      thumb: s.imageSrc ?? undefined,
      isPaused: !!s.isPaused,
      elapsedS: Number(s.elapsedSeconds ?? 0),
      durationS: Number(s.songDuration ?? 0),
    };
  }

  async queue(): Promise<{ videoId: string; selected: boolean }[]> {
    const q = await this.json<any>("GET", `${API}/queue`);
    const items: any[] = q?.items ?? [];
    return items.map((it) => {
      const r = it?.playlistPanelVideoRenderer ?? it?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
      return { videoId: String(r?.videoId ?? ""), selected: !!r?.selected };
    });
  }

  async enqueue(videoId: string, afterCurrent: boolean): Promise<void> {
    await this.raw("POST", `${API}/queue`, { videoId, insertPosition: afterCurrent ? "INSERT_AFTER_CURRENT_VIDEO" : "INSERT_AT_END" });
  }

  /** The queue position of a song after the one playing, or -1. */
  private async indexAfterCurrent(videoId: string): Promise<number> {
    const q = await this.queue();
    const cur = q.findIndex((x) => x.selected);
    for (let i = Math.max(0, cur + 1); i < q.length; i++) if (q[i].videoId === videoId) return i;
    return -1;
  }

  /** Play a song now: put it after the current one and jump to it. */
  async playNow(videoId: string): Promise<void> {
    await this.enqueue(videoId, true);
    // The app adds it a moment later (the API hands it to the page): find it, then jump there.
    for (let i = 0; i < 6; i++) {
      await sleep(250);
      const idx = await this.indexAfterCurrent(videoId).catch(() => -1);
      if (idx >= 0) {
        await this.raw("PATCH", `${API}/queue`, { index: idx });
        await this.play().catch(() => undefined);
        return;
      }
    }
    await this.raw("POST", `${API}/next`);
  }

  async removeNext(videoId: string): Promise<boolean> {
    const idx = await this.indexAfterCurrent(videoId);
    if (idx < 0) return false;
    await this.raw("DELETE", `${API}/queue/${idx}`);
    return true;
  }

  async next(): Promise<void> {
    await this.raw("POST", `${API}/next`);
  }
  async play(): Promise<void> {
    await this.raw("POST", `${API}/play`);
  }
  async pause(): Promise<void> {
    await this.raw("POST", `${API}/pause`);
  }
  async volume(): Promise<number | null> {
    const v = await this.json<any>("GET", `${API}/volume`);
    return typeof v?.state === "number" ? v.state : null;
  }
  async setVolume(volume: number): Promise<void> {
    await this.raw("POST", `${API}/volume`, { volume: Math.max(0, Math.min(100, Math.round(volume))) });
  }
  async liked(): Promise<boolean> {
    const v = await this.json<any>("GET", `${API}/like-state`);
    return v?.state === "LIKE";
  }

  /** YouTube Music search in the user's own session (raw InnerTube JSON). */
  async search(query: string, params?: string): Promise<unknown> {
    return await this.json<unknown>("POST", `${API}/search`, { query, ...(params ? { params } : {}) });
  }

  /** Fade out, run `fn`, fade back to where the volume was. */
  async fade(fn: () => Promise<void>): Promise<void> {
    const v0 = await this.volume().catch(() => null);
    if (v0 == null || v0 <= 0) return fn();
    for (const k of [0.7, 0.45, 0.25, 0.1]) {
      await this.setVolume(v0 * k).catch(() => undefined);
      await sleep(350);
    }
    try {
      await fn();
    } finally {
      await sleep(400);
      for (const k of [0.35, 0.65, 1]) {
        await this.setVolume(v0 * k).catch(() => undefined);
        await sleep(250);
      }
    }
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The player's artist line as credits ("A, B & C" → three), when the player gives no ids. */
export function artistsOf(np: NowPlaying): TrackArtist[] {
  return np.artists ?? [{ name: np.artist }];
}

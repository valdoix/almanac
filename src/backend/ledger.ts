// ChatLedger: everything the Ledger knows about one chat, rebuilt from the chat's
// messages (the event log) plus extension storage.

import { LedgerRuntime, toPath, type PathMessage, type RawChatMessage } from "../core/branch";
import { buildCodex, type CodexRecord } from "../core/codex";
import { almanacFor, type AlmanacConfig, type AlmanacReport } from "../core/engines/almanac";
import { KeyIndex, cleanKeys, DEFAULT_STOP } from "../core/keys";
import { parseMessage } from "../core/dsl";
import type { FoldOptions } from "../core/state";
import type { LedgerEvent, Settings, WorldState } from "../core/types";
import { hash } from "../core/util";
import { describe, has, host, rememberUser, warn } from "./host";
import { loadChat, loadSettings, type ChatMeta } from "./store";

export interface Names {
  user: string;
  char: string;
  characterId?: string;
  personaId?: string;
  chatName?: string;
}

export class ChatLedger {
  readonly chatId: string;
  userId?: string;
  runtime = new LedgerRuntime();
  raw: RawChatMessage[] = [];
  path: PathMessage[] = [];
  names: Names = { user: "You", char: "" };
  state!: WorldState;
  events: LedgerEvent[] = [];
  records: CodexRecord[] = [];
  index!: KeyIndex;
  stamp = "";
  loadedAt = 0;

  constructor(chatId: string, userId?: string) {
    this.chatId = chatId;
    this.userId = userId;
  }

  async files() {
    return loadChat(this.chatId, this.userId);
  }

  async meta(): Promise<ChatMeta> {
    return (await this.files()).meta;
  }

  async settings(): Promise<Settings> {
    return loadSettings(this.userId);
  }

  async loadNames(): Promise<Names> {
    try {
      const chat = has("chats") ? await host.chats.get(this.chatId, this.userId) : null;
      if (chat) {
        this.names.chatName = chat.name;
        this.names.characterId = chat.character_id;
        if (has("characters") && chat.character_id) {
          const ch = await host.characters.get(chat.character_id, this.userId).catch(() => null);
          if (ch) this.names.char = ch.name;
        }
        const pid = (chat.metadata as any)?.persona_id ?? (chat.metadata as any)?.personaId;
        if (has("personas")) {
          const p = pid ? await host.personas.get(pid, this.userId).catch(() => null) : await host.personas.getActive(this.userId).catch(() => null);
          if (p) {
            this.names.user = p.name;
            this.names.personaId = p.id;
          }
        }
      }
    } catch (err) {
      warn(`names for ${this.chatId}: ${describe(err)}`);
    }
    return this.names;
  }

  foldOptions(meta: ChatMeta, settings: Settings): FoldOptions {
    const mode = meta.config.personaMode;
    const sealed = meta.detected.sealed ?? (mode ? mode === "sealed" || mode === "continuity" : true);
    const start = meta.config.startPoint ? /(\d{1,2})[:.](\d{2})/.exec(meta.config.startPoint) : null;
    const startDay = meta.config.startPoint ? /day\s*(\d+)/i.exec(meta.config.startPoint) : null;
    return {
      userName: this.names.user,
      strictness: settings.strictness,
      sealed,
      personaThoughts: meta.detected.personaThoughts,
      romance: meta.detected.romance ?? meta.config.romance,
      startTime: start ? { day: startDay ? parseInt(startDay[1], 10) : 1, minute: parseInt(start[1], 10) * 60 + parseInt(start[2], 10) } : null,
    };
  }

  /** Reload messages and refold. `excludeTrailingAssistant` for regenerate/swipe prompts. */
  async refresh(opts: { excludeTrailingAssistant?: boolean; reloadNames?: boolean } = {}): Promise<void> {
    const [files, settings] = await Promise.all([this.files(), this.settings()]);
    if (opts.reloadNames || !this.names.char) await this.loadNames();
    try {
      this.raw = (await host.chat.getMessages(this.chatId)) as unknown as RawChatMessage[];
    } catch (err) {
      warn(`getMessages ${this.chatId}: ${describe(err)}`);
      this.raw = [];
    }
    let path = toPath(this.raw);
    if (opts.excludeTrailingAssistant) {
      while (path.length && !path[path.length - 1].isUser) path = path.slice(0, -1);
    }
    this.path = path;
    const fo = this.foldOptions(files.meta, settings);
    const res = this.runtime.fold(path, fo, files.side);
    this.state = res.state;
    this.events = res.events;
    // Hidden pressures live in meta (narrator-only), applied to state for the note and Codex.
    for (const [id, p] of Object.entries(files.meta.pressures)) if (this.state.chars[id]) this.state.chars[id].pressure = p;
    this.records = buildCodex(this.state, files.codex);
    const castNames = Object.values(this.state.chars).map((c) => c.name);
    const stop = new Set([...DEFAULT_STOP, ...settings.stopList.map((s) => s.toLowerCase())]);
    for (const r of this.records) r.keys = cleanKeys(r.keys, { name: r.name, aliases: r.aliases, castNames, stop, max: settings.maxKeys });
    this.index = new KeyIndex(this.records);
    this.stamp = res.chain[res.chain.length - 1] ?? hash(this.chatId);
    this.loadedAt = Date.now();
  }

  stateAt(msgId: string, meta: ChatMeta, settings: Settings, side?: import("../core/branch").SideEventStore): WorldState | null {
    const full = toPath(this.raw);
    const s = this.runtime.stateAt(full, msgId, this.foldOptions(meta, settings), side);
    if (s) for (const [id, p] of Object.entries(meta.pressures)) if (s.chars[id]) s.chars[id].pressure = p;
    return s;
  }

  almanacConfig(meta: ChatMeta, settings: Settings): AlmanacConfig {
    const firstHeader = this.path.find((m) => !m.isUser && /🗓/u.test(m.content));
    const firstParsed = firstHeader ? parseMessage(firstHeader.content).header : undefined;
    const headerDate = firstParsed?.dateLabel;
    const anchorDay = firstParsed?.day;
    const scheduled = this.records
      .filter((r) => r.kind === "forecast" && r.body.weatherLevel != null && r.body.fromAbs != null)
      .map((r) => ({ fromAbs: r.body.fromAbs, toAbs: r.body.toAbs ?? r.body.fromAbs + 360, level: r.body.weatherLevel, label: r.name }));
    return {
      chatId: this.chatId,
      climate: meta.config.climate || settings.climate || this.climateFromLore(),
      latitude: meta.config.latitude || settings.latitude,
      calendar: meta.config.calendar || settings.calendar || this.calendarFromLore(),
      startPoint: meta.config.startPoint,
      headerDate,
      anchorDay,
      scheduled,
    };
  }

  climateFromLore(): string {
    const r = this.records.find((x) => x.kind === "place" && x.body.climate);
    return r ? String(r.body.climate) : "";
  }

  calendarFromLore(): string {
    const r = this.records.find((x) => /calendar/i.test(x.name) && x.kind === "meta");
    return r ? r.summary : "";
  }

  almanac(meta: ChatMeta, settings: Settings, state = this.state): AlmanacReport | null {
    try {
      return almanacFor(state, this.almanacConfig(meta, settings));
    } catch (err) {
      warn(`almanac: ${describe(err)}`);
      return null;
    }
  }

  /** The most recent assistant replies' raw text (for telemetry and recall). */
  recentAssistant(n: number): string[] {
    return this.path.filter((m) => !m.isUser).slice(-n).map((m) => m.content);
  }

  lastUser(): string {
    return [...this.path].reverse().find((m) => m.isUser)?.content ?? "";
  }

  lastAssistant(): PathMessage | undefined {
    return [...this.path].reverse().find((m) => !m.isUser);
  }
}

const ledgers = new Map<string, ChatLedger>();

export function ledgerFor(chatId: string, userId?: string): ChatLedger {
  let l = ledgers.get(chatId);
  if (!l) {
    l = new ChatLedger(chatId, userId);
    ledgers.set(chatId, l);
    if (ledgers.size > 24) {
      const first = ledgers.keys().next().value!;
      if (first !== chatId) ledgers.delete(first);
    }
  }
  if (userId) {
    l.userId = userId;
    rememberUser(chatId, userId);
  }
  return l;
}

export function dropLedger(chatId: string) {
  ledgers.delete(chatId);
}

// The macros the preset reads. The ALMANAC preset runs only while these say the Ledger
// manages the chat (almActive yes, or arming on the prompt that will arm it).
//
// Values are kept per chat and served by a handler that reads the host-given chat id. The host's
// push cache (updateMacroValue) holds one value per extension, so two chats, or two users of an
// operator-scoped install, would read each other's place, cast and voices.

import { absMinutes, fmtSpan, hash, hhmm, partyName } from "../core/util";
import { LADDER_NAMES, normFact, overlap } from "../core/state";
import { factKind, lackOf, stanceVerb } from "../core/facts";
import { describe, has, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled, lastPlan } from "./turn";

const PUSH: { name: string; description: string }[] = [
  { name: "almActive", description: "yes when the ALMANAC Ledger manages this chat; arming when this prompt will switch it on (automatic mode); no when it's off here" },
  { name: "almDay", description: "Story day number" },
  { name: "almClock", description: "Weekday, date and time" },
  { name: "almTime", description: "24 h time" },
  { name: "almWeather", description: "Current weather" },
  { name: "almForecast", description: "Next ~12 hours of weather" },
  { name: "almSun", description: "Sunrise and sunset" },
  { name: "almMoon", description: "Moon phase" },
  { name: "almSeason", description: "Season" },
  { name: "almCalendar", description: "One line about a fantasy or custom calendar (empty for Gregorian)" },
  { name: "almPlace", description: "Place path" },
  { name: "almVoices", description: "Voice-slot roster for [spk] marks" },
  { name: "almCast", description: "Present characters, one line each" },
  { name: "almMode", description: "Current scene mode" },
  { name: "almDue", description: "Consequences and deadlines due now" },
  { name: "almReturning", description: "yes if the player returns after a long absence" },
  { name: "almDie", description: "A d20 for this player turn: the same on every swipe and regeneration of the reply" },
];

/** chat id → macro name → value, filled by pushMacros before each assembly. */
const values = new Map<string, Record<string, string>>();

/**
 * What a chat's macro reads. `almActive` is "off" when the prompt interceptor isn't granted (the preset then
 * tells the player instead of running without its note). A chat nothing has been pushed for yet reads
 * "arming": the interceptor decides on this very prompt whether the Almanac takes it.
 */
export function macroValue(chatId: string | undefined, name: string): string {
  if (name === "almActive" && !has("interceptor")) return "off";
  const v = chatId ? values.get(chatId)?.[name] : undefined;
  return v ?? (name === "almActive" ? "arming" : "");
}

/** The d20 for the player's latest message: seeded by the chat and that message, so a swipe can't reroll it. */
export function turnDie(chatId: string, lastUserMessageId: string | undefined): string {
  if (!lastUserMessageId) return "";
  return String((parseInt(hash(`${chatId}:${lastUserMessageId}:d20`), 16) % 20) + 1);
}

let registered = false;
export function registerMacros() {
  if (registered) return;
  registered = true;
  for (const m of PUSH) {
    try {
      host.registerMacro({
        name: m.name, category: "extension:almanac_ledger", description: m.description, returnType: "string",
        handler: ((ctx: any) => macroValue(ctx?.chatId ?? ctx?.env?.chat?.id, m.name)) as unknown as string,
      });
    } catch (err) {
      warn(`macro ${m.name}: ${describe(err)}`);
    }
  }
  const pull = (name: string, description: string, args: { name: string; description: string }[], fn: (ctx: any, a: string[]) => Promise<string> | string) => {
    try {
      host.registerMacro({
        name, category: "extension:almanac_ledger", description, returnType: "string", args: args.map((a) => ({ ...a, required: true })),
        handler: (async (ctx: any) => {
          try {
            return await fn(ctx, (ctx?.args ?? []).map((x: unknown) => String(x ?? "")));
          } catch {
            return "";
          }
        }) as unknown as string,
      });
    } catch (err) {
      warn(`macro ${name}: ${describe(err)}`);
    }
  };
  pull("almKnows", "What a character knows / believes (Ledger)", [{ name: "name", description: "Character name" }], async (ctx, [name]) => {
    const L = ctx?.chatId ? ledgerFor(ctx.chatId) : null;
    if (!L?.state) return "";
    const c = Object.values(L.state.chars).find((x) => x.name.toLowerCase() === name.toLowerCase() || x.aliases.some((a) => a.toLowerCase() === name.toLowerCase()));
    if (!c) return "";
    // What they have (and how), what they're wrong about, and what they lack with evidence; passing observations left out.
    const nm = (id: string) => (id === "user" ? L.names.user : L.state.chars[id]?.name ?? id);
    const facts = Object.values(L.state.facts ?? {}).filter((f) => !f.hidden && factKind(f) !== "noted").sort((a, b) => b.lastMsg - a.lastMsg);
    const has = facts.filter((f) => f.stances[c.id] && f.stances[c.id].status !== "unaware").slice(0, 8).map((f) => `${stanceVerb(f.stances[c.id], nm)}: ${f.statement}`);
    const lacks = facts.filter((f) => lackOf(L.state, f, c.id)).slice(0, 4).map((f) => `doesn't know: ${f.statement}`);
    return [...has, ...lacks].join("; ");
  });
  pull("almBond", "Directed bond A → B (Ledger)", [{ name: "from", description: "From" }, { name: "to", description: "To" }], async (ctx, [a, b]) => {
    const L = ctx?.chatId ? ledgerFor(ctx.chatId) : null;
    if (!L?.state) return "";
    const find = (n: string) => Object.values(L.state.chars).find((x) => x.name.toLowerCase() === n.toLowerCase())?.id;
    const bond = L.state.bonds[`${find(a)}>${find(b)}`];
    if (!bond) return "";
    const ladder = L.state.ladders[`${bond.from}>${bond.to}`];
    return `${Object.entries(bond.axes).map(([k, v]) => `${k} ${v! > 0 ? "+" : ""}${v}`).join(", ")}${bond.label ? ` (${bond.label})` : ""}${ladder ? `; ${LADDER_NAMES[ladder.tier]}` : ""}`;
  });
  pull("almRecord", "A Codex record by id or name (Ledger)", [{ name: "id", description: "Record id or name" }], async (ctx, [id]) => {
    const L = ctx?.chatId ? ledgerFor(ctx.chatId) : null;
    if (!L?.records) return "";
    const r = L.records.find((x) => x.id === id) ?? L.records.find((x) => x.name.toLowerCase() === id.toLowerCase()) ?? L.records.find((x) => overlap(normFact(x.name), normFact(id)) > 0.7);
    return r ? r.summary : "";
  });
}

export async function pushMacros(chatId: string, userId?: string) {
  const cur: Record<string, string> = {};
  const push = (name: string, value: string) => void (cur[name] = value);
  try {
    const files = await loadChat(chatId, userId);
    const settings = await loadSettings(userId);
    if (!isEnabled(files.meta, settings)) {
      // Automatic mode arms a chat on the first prompt that carries the ALMANAC charter, so the preset runs that prompt in full.
      const arming = settings.enabled === "auto" && files.meta.config.enabledOverride !== false;
      values.set(chatId, { almActive: arming ? "arming" : "no" });
      return;
    }
    const L = ledgerFor(chatId, userId);
    if (!L.state) await L.refresh();
    const st = L.state;
    const al = L.almanac(files.meta, settings);
    push("almActive", "yes");
    push("almDay", st.time ? String(st.time.day) : "");
    push("almClock", al?.clock ?? (st.time ? `Day ${st.time.day}, ${hhmm(st.time.minute)}` : ""));
    push("almTime", st.time ? hhmm(st.time.minute) : "");
    push("almWeather", al?.weather.text ?? st.weather?.condition ?? "");
    push("almForecast", al?.forecast ?? "");
    push("almSun", al?.sun.text ?? "");
    push("almMoon", al?.moon.name ?? "");
    push("almSeason", al?.season ?? "");
    push("almCalendar", al?.calendarNote ?? "");
    push("almPlace", st.place.join(" › "));
    push("almMode", st.mode);
    const present = Object.values(st.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.dead);
    const voices = Object.values(st.chars).filter((c) => !c.isUser && !c.dead).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 12);
    push("almVoices", voices.map((c) => `${c.name}#${c.slot}`).join(", "));
    push("almCast", present.map((c) => `${c.name} (${c.tier === "spot" ? "spotlight" : "periphery"}${c.activity ? `, ${c.activity}` : ""}${c.mood?.name ? `, ${c.mood.name}` : ""})`).join("\n"));
    const now = st.time ? absMinutes(st.time) : null;
    const due = [
      ...Object.values(st.cons).filter((c) => (c.status === "open" || c.status === "due") && c.due?.at && now != null && absMinutes(c.due.at) <= now + 60).map((c) => `${c.what} (${partyName(st, c.who)})`),
      ...Object.values(st.deadlines).filter((d) => !d.done && now != null && absMinutes(d.at) - now <= 180).map((d) => `${d.title}: ${now != null ? fmtSpan(Math.max(0, absMinutes(d.at) - now)) : ""} left`),
    ];
    push("almDue", due.join("; "));
    push("almReturning", lastPlan(chatId)?.returning ? "yes" : "no");
    push("almDie", turnDie(chatId, [...L.path].reverse().find((m) => m.isUser)?.id));
    values.set(chatId, cur);
    if (values.size > 64) values.delete(values.keys().next().value!);
  } catch (err) {
    warn(`push macros: ${describe(err)}`);
  }
}

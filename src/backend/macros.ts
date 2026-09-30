// Push-model macros (zero latency during assembly) + a few pull macros with
// arguments, and chat-variable mirrors so the preset's standalone mode can take
// over seamlessly if the extension is disabled mid-chat.

import { absMinutes, fmtSpan, hhmm, partyName } from "../core/util";
import { LADDER_NAMES, normFact, overlap } from "../core/state";
import { factKind, lackOf, stanceVerb } from "../core/facts";
import { describe, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled, lastPlan } from "./turn";

const PUSH: { name: string; description: string }[] = [
  { name: "almActive", description: "yes when the ALMANAC Ledger manages this chat" },
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
];

let registered = false;
export function registerMacros() {
  if (registered) return;
  registered = true;
  for (const m of PUSH) {
    try {
      host.registerMacro({ name: m.name, category: "extension:almanac_ledger", description: m.description, returnType: "string", handler: "" });
      host.updateMacroValue(m.name, m.name === "almActive" ? "no" : "");
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

const lastPushed = new Map<string, string>();
function push(name: string, value: string) {
  if (lastPushed.get(name) === value) return;
  lastPushed.set(name, value);
  try {
    host.updateMacroValue(name, value);
  } catch {
    /* host gone */
  }
}

export async function pushMacros(chatId: string, userId?: string) {
  try {
    const files = await loadChat(chatId, userId);
    const settings = await loadSettings(userId);
    if (!isEnabled(files.meta, settings)) {
      push("almActive", "no");
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
  } catch (err) {
    warn(`push macros: ${describe(err)}`);
  }
}

/** Mirror a few values into chat variables (standalone fallback continuity). */
const lastVars = new Map<string, string>();
export async function mirrorChatVars(chatId: string, userId?: string) {
  try {
    const L = ledgerFor(chatId, userId);
    const st = L.state;
    if (!st) return;
    const vars: Record<string, string> = {
      alm_day: st.time ? String(st.time.day) : "",
      alm_clock: st.time ? `Day ${st.time.day} ${hhmm(st.time.minute)}` : "",
      alm_place: st.place.join(" › "),
      alm_wx: st.weather?.condition ?? "",
      alm_present: Object.values(st.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.isUser && !c.dead).map((c) => c.name).join(", "),
      alm_mode: st.mode,
    };
    for (const [k, v] of Object.entries(vars)) {
      const key = `${chatId}:${k}`;
      if (lastVars.get(key) === v) continue;
      lastVars.set(key, v);
      await host.variables.chat.set(chatId, k, v);
    }
  } catch (err) {
    warn(`chat vars: ${describe(err)}`);
  }
}

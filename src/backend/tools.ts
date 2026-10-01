// LLM tools (inline function calling and Council): retrieval on demand.

import { KeyIndex } from "../core/keys";
import { recall, renderRecord } from "../core/recall";
import { normFact, overlap } from "../core/state";
import { lackOf, lackText, stanceVerb } from "../core/facts";
import { describe, has, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled } from "./turn";
import { offPageFacts, redact } from "../core/offpage";

const TOOLS = [
  {
    name: "ledger_recall",
    display_name: "ALMANAC: recall",
    description: "Search the story's verified memory (Codex, documents, facts, threads) for a topic. Returns ranked entries with who knows what.",
    parameters: { type: "object", properties: { query: { type: "string", description: "What to look up" }, k: { type: "number", description: "How many results (default 6)" } }, required: ["query"] },
  },
  {
    name: "ledger_who_knows",
    display_name: "ALMANAC: who knows",
    description: "Who knows, believes, suspects or is wrong about a fact in the story.",
    parameters: { type: "object", properties: { fact: { type: "string", description: "The fact or topic" } }, required: ["fact"] },
  },
  {
    name: "ledger_lookup",
    display_name: "ALMANAC: lookup",
    description: "The current record for a named person, place, object, group or thread.",
    parameters: { type: "object", properties: { name: { type: "string", description: "Name to look up" } }, required: ["name"] },
  },
];

export function registerTools() {
  if (!has("tools")) return;
  for (const t of TOOLS) {
    try {
      host.registerTool({ ...t, council_eligible: true, inline_available: true });
    } catch (err) {
      warn(`tool ${t.name}: ${describe(err)}`);
    }
  }
  host.on("TOOL_INVOCATION", async (payload, userId) => {
    try {
      return await answer(payload, userId);
    } catch (err) {
      return `Ledger error: ${describe(err)}`;
    }
  });
}

async function answer(payload: { toolName: string; args?: Record<string, unknown> }, userId?: string): Promise<string> {
  {
    {
      const active = await host.chats.getActive(userId).catch(() => null);
      if (!active) return "No active chat.";
      const files = await loadChat(active.id, userId);
      const settings = await loadSettings(userId);
      if (!isEnabled(files.meta, settings)) return "ALMANAC Ledger is not active in this chat.";
      const L = ledgerFor(active.id, userId);
      if (!L.state) await L.refresh();
      const allowNarrator = !!settings.narratorOnlyToTools;
      // A secret kept off the page stays out of tool answers too, worded the way recall and the mirror word it.
      const off = offPageFacts(L.state, settings.secretsOffPage !== false);
      const out = (s: string) => (off.length ? redact(s, off) : s);
      const present = Object.values(L.state.chars).filter((c) => c.tier === "spot" || c.tier === "peri" || c.isUser).map((c) => c.id);
      const args = payload.args ?? {};
      switch (payload.toolName) {
        case "ledger_recall": {
          const q = String(args.query ?? "");
          const res = recall({ state: L.state, records: L.records, index: new KeyIndex(L.records), playerMsg: q, lastReply: "", recent: [], tier: "charged", budget: 900, allowNarratorOnly: allowNarrator, userName: L.names.user, offPage: off });
          const hits = res.items.slice(0, Math.max(1, Math.min(12, Number(args.k ?? 6))));
          if (hits.length) return out(hits.map((h) => h.text).join("\n"));
          const fuzzy = L.records.filter((r) => !r.scope.narratorOnly || allowNarrator).map((r) => ({ r, s: overlap(normFact(`${r.name} ${r.summary}`), normFact(q)) })).filter((x) => x.s > 0.3).sort((a, b) => b.s - a.s).slice(0, 6);
          return fuzzy.length ? out(fuzzy.map((x) => renderRecord(x.r, L.state, present, false, L.names.user)).join("\n")) : "Nothing recorded about that.";
        }
        case "ledger_who_knows": {
          const q = String(args.fact ?? "").trim();
          const facts = Object.values(L.state.facts ?? {}).filter((x) => !x.hidden);
          const byKey = facts.find((x) => x.key === q.replace(/^#/, "").toLowerCase() || x.altKeys?.includes(q.replace(/^#/, "").toLowerCase()));
          const found = byKey ? [byKey] : facts.map((x) => ({ x, s: Math.max(overlap(normFact(x.statement), normFact(q)), ...x.aliases.map((a) => overlap(a, normFact(q)))) })).filter((y) => y.s > 0.4).sort((a, b) => b.s - a.s).slice(0, 3).map((y) => y.x);
          if (!found.length) return "No fact like that is recorded.";
          const nm = (id: string) => (id === "user" ? L.names.user : L.state.chars[id]?.name ?? id);
          return out(found.map((f) => {
            const has = Object.values(f.stances).filter((s) => s.status !== "unaware").map((s) => `${nm(s.holder)} ${stanceVerb(s, nm)}`);
            const lacks = Object.keys(L.state.chars).map((id) => ({ id, r: lackOf(L.state, f, id) })).filter((x) => x.r).map((x) => `${nm(x.id)} ${lackText(x.r!)}`);
            return `#${f.key} "${f.statement}"${f.truth !== "unknown" ? ` [${f.truth}]` : ""}: ${[...has, ...lacks].join("; ") || "no one recorded"}. Anyone not named is unrecorded, not ignorant.`;
          }).join("\n"));
        }
        case "ledger_lookup": {
          const n = String(args.name ?? "").toLowerCase();
          const r = L.records.find((x) => x.name.toLowerCase() === n || x.aliases.some((a) => a.toLowerCase() === n)) ?? L.records.find((x) => x.name.toLowerCase().includes(n));
          if (!r || (r.scope.narratorOnly && !allowNarrator)) return "No record by that name.";
          return out(renderRecord(r, L.state, present, true, L.names.user));
        }
      }
      return "";
    }
  }
}

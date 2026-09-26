// LLM tools (inline function calling and Council): retrieval on demand.

import { KeyIndex } from "../core/keys";
import { recall, renderRecord } from "../core/recall";
import { normFact, overlap } from "../core/state";
import { describe, has, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled } from "./turn";

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
      const active = await host.chats.getActive(userId).catch(() => null);
      if (!active) return "No active chat.";
      const files = await loadChat(active.id, userId);
      const settings = await loadSettings(userId);
      if (!isEnabled(files.meta, settings)) return "ALMANAC Ledger is not active in this chat.";
      const L = ledgerFor(active.id, userId);
      if (!L.state) await L.refresh();
      const allowNarrator = !settings.narratorOnlyToTools ? false : true;
      const present = Object.values(L.state.chars).filter((c) => c.tier === "spot" || c.tier === "peri" || c.isUser).map((c) => c.id);
      const args = payload.args ?? {};
      switch (payload.toolName) {
        case "ledger_recall": {
          const q = String(args.query ?? "");
          const res = recall({ state: L.state, records: L.records, index: new KeyIndex(L.records), playerMsg: q, lastReply: "", recent: [], tier: "charged", budget: 900, allowNarratorOnly: allowNarrator, userName: L.names.user });
          const hits = res.items.slice(0, Math.max(1, Math.min(12, Number(args.k ?? 6))));
          if (hits.length) return hits.map((h) => h.text).join("\n");
          const fuzzy = L.records.filter((r) => !r.scope.narratorOnly || allowNarrator).map((r) => ({ r, s: overlap(normFact(`${r.name} ${r.summary}`), normFact(q)) })).filter((x) => x.s > 0.3).sort((a, b) => b.s - a.s).slice(0, 6);
          return fuzzy.length ? fuzzy.map((x) => renderRecord(x.r, L.state, present, false, L.names.user)).join("\n") : "Nothing recorded about that.";
        }
        case "ledger_who_knows": {
          const f = normFact(String(args.fact ?? ""));
          const rows = L.state.knowledge.filter((k) => !k.supersededBy && overlap(normFact(k.fact), f) > 0.4);
          if (!rows.length) return "No one is recorded as knowing about that.";
          const nm = (id: string) => (id === "user" ? L.names.user : L.state.chars[id]?.name ?? id);
          return rows.map((k) => `${nm(k.holder)}: ${k.status} — ${k.fact}${k.source ? ` (${k.source})` : ""}${k.truth !== "unknown" ? ` [${k.truth}]` : ""}`).join("\n");
        }
        case "ledger_lookup": {
          const n = String(args.name ?? "").toLowerCase();
          const r = L.records.find((x) => x.name.toLowerCase() === n || x.aliases.some((a) => a.toLowerCase() === n)) ?? L.records.find((x) => x.name.toLowerCase().includes(n));
          if (!r || (r.scope.narratorOnly && !allowNarrator)) return "No record by that name.";
          return renderRecord(r, L.state, present, true, L.names.user);
        }
      }
      return "";
    } catch (err) {
      return `Ledger error: ${describe(err)}`;
    }
  });
}

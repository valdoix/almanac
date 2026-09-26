# ALMANAC — Preset + Extension Design Set for Lumiverse

**Status:** design only. There is no implementation code here.

The set has two parts that work together:

- **ALMANAC** (preset): a living-world roleplay preset. Deep character states, autonomous NPCs and NPC↔NPC relationships, world simulation, a knowledge firewall, genre contracts, a step-by-step Director's Pass that works with or without provider reasoning, five-layer anti-slop, player agency, an adults-only NSFW enhancer, and a full visual system (dialogue blocks, weather-reactive scene plates, VTKs, trackers).
- **ALMANAC Ledger** (extension): event-sourced story memory. It combines LumiBooks-style summarise-and-hide chapters and Codex with Lore Recall-style reasoning retrieval. Tracker keys become real retrieval keys. It seeds from attached lorebooks, includes a built-in VELLUM III-compatible lorebook creator, and computes weather, calendar and astronomy.

```
            ┌──────────── ALMANAC preset ────────────┐        ┌──────────── ALMANAC Ledger ────────────┐
 player ──► │ Director's Pass → prose + marks        │ reply  │ parse <ledger> → validate → event log   │
            │ + <ledger> delta (what changed)        │ ─────► │ state · Codex · keys · chronicle        │
            │                                        │        │ weather/calendar · off-screen sim       │
            │ reads: <ledger-note>, <recall>, macros │ ◄───── │ Recall → <ledger-note> + <recall>       │
            └────────────────────────────────────────┘ prompt │ splice chapters · render trackers       │
                                                              └─────────────────────────────────────────┘
```

---

## Reading order

| # | Document | What's in it |
|---|---|---|
| 01 | [Source analysis](01-source-analysis.md) | All 11 presets on `dev`, the Lumiverse platform (staging), LumiBooks, Lore Recall, VELLUM, and the lorebook-creator prompt: strengths, flaws (including concrete bugs), and what's borrowed. Ends with a gap table |
| 02 | [ALMANAC preset](02-preset-almanac.md) | Block map, every system, all prompt variables, the Director's Pass, the `<ledger>` delta language, output contract, regex suite, scene-mode router, token budget |
| 03 | [Visual system](03-visual-system.md) | Rendering pipelines, themes, dialogue blocks (4 styles), scene plate layers, unspoken register, VTK library, tracker drawer, Director's Desk, accessibility |
| 04 | [Recommendations](04-recommendations.md) | Additions beyond the brief, ranked, plus what *not* to do |
| 05 | [ALMANAC Ledger extension](05-extension-ledger.md) | Architecture, branch-correct event model, chronicle, Codex, retrieval keys, Recall, Lore Bridge, Lorebook Creator, engines, telemetry, UI, performance, roadmap |
| 06 | [Storage decision](06-storage-decision.md) | Lorebooks vs extension storage, scored against recall accuracy and continuity, with the recommended hybrid |
| — | [Visual mockup](mockups/almanac-visuals.html) | Static HTML: scene plates, dialogue blocks, unspoken drawer, Director's notes, tracker drawer, VTKs, relationship graph. Open it in a browser |

---

## Requirement → where it's designed

| Requirement | Section |
|---|---|
| Deep character states | 02 §6 |
| NPC autonomy | 02 §7, 05 §11.4 |
| Deep world simulation | 02 §10, 05 §11 |
| NPC-to-NPC autonomous relationships | 02 §8 |
| Step-by-step CoT (reasoning on / off) | 02 §19 |
| Anti-slop | 02 §18, 05 §12 |
| Persona / player agency | 02 §5 |
| Dialogue colouriser as blocks | 03 §3 (mockup §2–3) |
| Weather and time continuity | 02 §11, 05 §11.2 |
| Knowledge firewall | 02 §9, 05 §8.3 |
| Meaningful, impactful genres | 02 §12 |
| NSFW enhancer (consenting adults only) | 02 §4, §17 |
| Trackers (relationships, thoughts, inventory, mood, condition…) | 02 §20, 03 §7 |
| Visual Toolkits | 03 §6 |
| Beautiful visuals | 03 (all), mockup |
| Scene headers with dynamic titles and weather visuals | 02 §11.3, 03 §4 |
| Romance pace | 02 §13 |
| Dialogue frequency | 02 §14 |
| World disposition | 02 §15 |
| Consequences | 02 §16 |
| Recommendations and additions | 04 |
| Extension: LumiBooks + Lore Recall mix | 05 §5–8 |
| Summarise turns, hide them, Codex entries | 05 §5–6 |
| Tracker keys become real retrieval keys | 05 §7 |
| Lorebook creator | 05 §10 |
| Seed from chat/persona/character lorebooks | 05 §9 |
| Lorebooks vs extension storage | 06 |

---

## Assumptions and open items

1. **The dialogue reference image wasn't attached.** Dialogue blocks are designed from the description ("blocks instead of just coloured dialogue"). The mockup shows the Blocks style next to Chips, Tint and Script. Share the image and 03 §3 can be matched to it exactly.
2. **Name.** "ALMANAC" matches the repo, and an almanac is literally a book of days, weather and sky. Rename freely; identifiers are prefixed `alm` / `almanac_ledger`.
3. **Platform behaviours to confirm at implementation time** (documented in Lumiverse `staging`, but worth a test):
   - how an unknown macro renders when the extension is absent. The router checks `{{eq::{{almActive}}::yes}}`; `{{hasExtension::almanac_ledger}}` can back it up;
   - the preset-linked "activate prompt blocks from matches" flow for the scene-mode router;
   - that the message content processor's `render` origin fires twice per message (needs a small cache);
   - `hidden` excludes messages from embeddings only, so the interceptor must drop covered turns itself;
   - the 10 s WI-interceptor budget (heavy retrieval runs earlier, in the context handler or as a prefetch).
4. **Safety floor.** The NSFW enhancer is fully explicit-capable, for consenting adults only. The design deliberately omits the "ignore policies" and non-consent material some source presets contain (reasons in 01 §1.1 and 04 §15).

---

## Sources analysed

- Presets: `valdoix/almanac@dev`: CHRONICON v1.9.0, Tessera, VELLUM II Engine, ARGENT LOOM, KittyLotus 3.6.6, Freaky FrankenSIM, Freaky Frankenstein 5.4, Stabs GLM 5.1 Directives, The HawThore Directives, Paramnesia V3, IHYLL 1.1.5.
- Lumiverse: [`prolix-oc/Lumiverse@staging`](https://github.com/prolix-oc/Lumiverse/tree/staging): `developer-docs/` (Spindle API) and `user-docs/` (presets, world books, regex, memory). These mirror [lumiverse.chat/guides/presets](https://lumiverse.chat/guides/presets/) and [lumiverse.chat/guides/world-books](https://lumiverse.chat/guides/world-books/).
- [`AMousePad/LumiBooks`](https://github.com/AMousePad/LumiBooks): chapter/arc/volume coverage and splice injection, Codex schema and archivist prompts.
- [`archkr/Lumiverse-LoreRecall`](https://github.com/archkr/Lumiverse-LoreRecall): tree retrieval, controller modes, scoring and feedback.
- [`valdoix/vellum-engine`](https://github.com/valdoix/vellum-engine): VELLUM II event-log engine, model errata, colored-dialogue CSS-injection plan (`testing` branch).
- `lorebook_creator_prompt_vellum3.md` (uploaded): VELLUM III reading conventions, templates, QA checklist.

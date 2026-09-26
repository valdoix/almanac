# 03 — ALMANAC Visual System

All visuals share one principle: **the model writes short semantic marks; renderers draw.** The model never writes tracker HTML. (The one exception is optional "free-form" VTKs for power users, §6.4.)

A static mockup of the key pieces lives in [`mockups/almanac-visuals.html`](mockups/almanac-visuals.html). Open it in a browser. It has a skin switcher (all six themes) and a light/dark toggle.

**Design direction:** a storybook with a pulse. Each piece should feel like an object from the world (a medallion, a sealed envelope, a painted sign, a call sheet, a trading card), and each should *move a little* when something happens: rain falls, a sign swings, a shout jolts, a changed bond sparks. Motion is always CSS-only and always off under reduced motion.

---

## 1. Rendering pipelines

| | **Standalone** (preset only) | **Linked** (ALMANAC Ledger installed) |
|---|---|---|
| Who draws | Display regex scripts | Display regex (markup only) + the extension's stylesheet + the render processor |
| Styling | Inline `style=""` attributes. Blocks with ≥ 3 inline styles stay in light DOM (no island per quote). The scene plate carries one `<style>` and becomes a Shadow-DOM island, which is fine for a self-contained card | One global stylesheet injected with `ctx.dom.addStyle()`. Regex emits **class names only**, so replacements are tiny and repaint instantly on every render |
| Speaker colours | Voice slot `#N` → a 12-colour palette via `{{switch}}` in the replacement (`substitute_macros: raw`); first-letter hash as fallback | Per-cast colour from the Codex (user-editable), written into the stylesheet as `[data-spk="Mara" i]{…}` rules. This is VELLUM's CSS-injection plan, which fixes the "new turns don't colour" bug |
| Trackers | Drawn from `<ledger>` lines and `status` lines | The **message content processor (`render` origin)** replaces the ledger with the *compiled snapshot as of that message*. It is display-only: never stored, never sent to the model |
| Scene plate | Hour + weather glyph + season word + place keywords | Plus exact sunrise/sunset, moon phase, temperature trend, wind and place type from the Codex |

**What each mode can draw.** Inline `style=""` attributes can't create pseudo-elements, masks on pseudo-layers or keyframe animations, so the full look needs a stylesheet:

| Piece | Standalone (inline styles) | Linked (stylesheet) |
|---|---|---|
| Scene plate | Full (it's a self-contained island with its own `<style>`) | Full, plus exact sun times and moon phase |
| Voice cards | "Lite": medallion, washed bubble, ribbon nameplate, tone weight and italics | Everything: tails, watermarks, tone decorations, jolt, same-speaker merge |
| Thought bubble, painted sign | Static bubble / plaque | Trailing dots, bob and swing |
| Envelopes, call sheet, trading cards, rings | Simplified cards | Full |

Why not let the extension touch message DOM? Lumiverse's `ctx.dom` exposes only `addStyle`/`cleanup`. There is no per-message DOM hook, so DOM painting only reaches messages that already exist. VELLUM's own plan documents this failure ("past turns coloured, new turns didn't"). Regex runs on every render, including the post-stream settle; a stylesheet re-applies automatically. **Regex for structure, stylesheet for paint.**

---

## 2. Design tokens and themes

Every renderer reads CSS custom properties. Themes are token sets, not separate templates, so there is one set of renderers for every theme (VELLUM's lesson from shipping dozens of per-theme duplicates).

```css
--alm-bg / --alm-panel / --alm-ink / --alm-muted / --alm-line
--alm-accent / --alm-accent-2 / --alm-danger / --alm-good
--alm-font-display / --alm-font-body / --alm-font-mono
--alm-radius / --alm-shadow / --alm-texture (a CSS gradient pattern)
```

Defaults derive from Lumiverse's own theme variables (`--lumiverse-text`, `--lumiverse-bg-elevated`, `--lumiverse-primary`, `--lumiverse-border`) through `color-mix()`, so ALMANAC sits naturally in any Lumiverse theme and follows light/dark.

| Theme | Character | Display / body type | Signature touch |
|---|---|---|---|
| **Almanac** *(default)* | Warm almanac paper with a dot-grain texture by day; ink-blue star chart (faint star field) by night; gold fleurons | Fraunces / Newsreader | Title sheen on the masthead; gold chapter ornaments |
| **Solar Editorial** | Cream vellum, navy ink, coral and gold (a nod to CHRONICON); faint column ruling | Playfair Display / Newsreader | High-contrast Didone titles |
| **Nocturne** | Velvet black, garnet, tarnished silver; gothic | Cormorant Garamond / Newsreader | Garnet speckle texture, deep shadows |
| **Botanical** | Herbarium green, rose, pressed-leaf blotches; extra-round radii | Fraunces / Newsreader | Soft organic cards |
| **Prism** | Deep navy console, teal signal, blueprint grid, tight radii | Space Grotesk / Space Grotesk | Grid texture, cyan accents |
| **Candy** | White and pink sticker book | Fredoka / Fredoka | Hard offset "sticker" shadows on every card |

**Fonts.** All faces are free Google Fonts (plus DM Mono for labels and Caveat for handwritten thoughts). The linked extension loads them with one `@import` in its stylesheet; every stack falls back to system faces (Iowan/Palatino/Georgia, system-ui, ui-monospace), so nothing breaks offline or if the host's CSP blocks remote fonts. *Confirm at build time that Lumiverse's CSP allows `fonts.googleapis.com`; if not, the extension can bundle the woff2 files.* Standalone mode uses the fallback stacks only.

`theme: Auto` picks from the lead genre: horror → Nocturne, sci-fi and thriller → Prism, fantasy → Botanical, romance → Almanac (rose accent), comedy → Candy, mystery → Solar (sepia accent).

---

## 3. Dialogue Blocks (the colouriser)

### 3.1 The mark (model side)
```
[spk=Mara#2|whisper]"You gave it back."[/spk]
[thk=Mara#2]Why would a thief give it back?[/thk]
```
- `Name` exactly as established; `#N` is the stable voice slot (1–12; {{user}} is 0). In linked mode the slot comes from `{{almVoices}}`.
- Optional tone after `|`: whisper · murmur · shout · sing · sob · cold · tender · sly · breathless · flat.
- An unknown or uncertain speaker is `[spk=?]` and renders neutral. Recovery regexes add tags only when the speaker is named next to the quote; they never guess.

### 3.2 Four styles (`dialogue_style`)

| Style | Look | Best for |
|---|---|---|
| **Blocks** *(default)* | Each speaker turn is a **voice card**: a glossy **medallion** (monogram on a lit gradient with a halo ring) beside a **speech bubble** whose tail points at it. The bubble is washed in the speaker's colour, carries a giant faint “ watermark, and wears a **ribbon nameplate** pinned across its top edge (name in small caps, tone in italics). The trailing narration beat sits under a dashed rule | Visual-novel feel; dense group scenes |
| Chips | Inline pill with a tiny medallion dot in front of the quote; prose flow untouched | Literary prose with sparse dialogue |
| Tint | Coloured text with a soft matching underline (Tessera's approach, improved contrast) | Minimalists; old devices |
| Script | Screenplay layout: NAME column with a coloured rule, parenthetical tone, line | Dialogue-forward and comedy |

### 3.3 Block vs inline: the paragraph rule
A regex can't parse a paragraph, but it can see where a mark sits:
1. **A paragraph that starts with `[spk]`** becomes a full **block**. Any narration after the closing tag on the same line (`, she said, turning away.`) becomes the block's **beat line**. A second quote in the same paragraph continues inside the block.
2. **A mark in the middle of narration** becomes an inline **chip**, so sentences never break mid-flow.
3. **Consecutive blocks by the same speaker** merge visually: the medallion, tail, watermark and nameplate hide on the follower, which tucks up under the first bubble. In linked mode the extension writes one adjacency rule per cast member (`.alm-say[data-spk="Mara"]+.alm-say[data-spk="Mara"] .alm-say__name{display:none}`). Standalone uses slot-based rules.

### 3.4 Layout variants (`dialogue_align`, a sub-option of Blocks)
- **Stage:** every block left-aligned (default).
- **Chat:** NPC blocks left, {{user}}'s quoted speech right-aligned in the persona colour, medallion and tail mirrored. It reads like a conversation.
- **Ensemble:** blocks indent slightly by presence tier (spotlight flush, periphery inset) to show who holds the scene.

### 3.5 Markup (linked mode, class-only)
```html
<div class="alm-say" data-spk="Mara" data-slot="2" data-tone="whisper">
  <span class="alm-say__medal" aria-hidden="true">M</span>
  <div class="alm-say__bubble">
    <span class="alm-say__who">Mara<em class="alm-say__tone">whisper</em></span>
    <span class="alm-sr">Mara whispers: </span>
    <q class="alm-say__line">You gave it back.</q>
    <span class="alm-say__beat">She doesn't look up from the fire.</span>
  </div>
</div>
```
The tail, watermark and tone decorations are pseudo-elements, so the markup stays this small.

### 3.6 Colour assignment (linked)
Priority order:
1. The user's pick in the Cast tab.
2. The character card's colour, if the card stores one.
3. **Sampled from the avatar**: the dominant non-neutral hue of the avatar image, via Lumiverse's image API.
4. **Golden-angle assignment** by first appearance (137.5° hue steps in OKLCH), so any two speakers in a scene are maximally distinct.

Every colour is then **contrast-clamped** in OKLCH against the active background (lightness adjusted until the text meets WCAG AA), with separate light- and dark-mode variants. Aliases map to the same colour ("the Duchess" and "Elinor" colour alike), using case-insensitive `[data-spk="…" i]` selectors.

### 3.7 Thoughts, chips and signs
- **Thought bubble** (`[thk]`, when `inner_voice: inline`): a cloud-rounded, dashed bubble with two trailing "thought dots", the text in a handwritten face (Caveat) tinted toward the thinker's colour, and a small "Kael · thinking" label. It bobs gently.
- **Painted sign** (`[txt]` for in-world lettering): an enamel plaque with brass screws and border that swings from its top edge.

### 3.8 Tone treatments
The tone after `|` changes the card, not just a badge:

| Tone | Treatment |
|---|---|
| whisper | Dashed bubble, no shadow, italic and slightly faded line, a dotted "hush" ring around the medallion |
| murmur | Whisper at half strength (solid border, italic) |
| shout | Thick border in the speaker's colour, a hard offset shadow, a slight tilt, heavier and larger line, a spiky burst behind the medallion that slowly turns; the card **jolts** once when it appears |
| tender | Soft outer glow in the speaker's colour; a ♡ watermark instead of “ |
| cold | Frost-blue wash and border, wider letter-spacing, ❄ watermark |
| sing | Wavy underline in the speaker's colour; ♪ ♫ watermark |
| sly | Tilted nameplate, asymmetric bubble corners, italic line, ✧ watermark |
| sob / breathless | Tender and whisper treatments respectively, with the line broken where the beat says |
| flat | No watermark, muted wash |

### 3.9 What makes this better than CHRONICON's colouriser

| CHRONICON | ALMANAC |
|---|---|
| Every speaker painted with the theme's one accent colour | A distinct, stable colour per character; editable; avatar-sampled |
| A full `<style>` sheet repeated inside **every** quote | One stylesheet per page (linked) or ~5 inline declarations (standalone) |
| Inline-grid span only | Four styles; a paragraph-aware block/chip rule; same-speaker merge |
| No tone | Ten tone treatments that reshape the whole card (§3.8) |
| Colour conveys identity | Colour **plus** nameplate, medallion letter, and screen-reader label |

---

## 4. Scene Header Plate (weather-reactive)

### 4.1 Input
The model writes the three-line header from 02 §11.3. The renderer parses it into data attributes:

`data-h` (hour 0–23) · `data-wx` (glyph) · `data-int` (light / moderate / heavy / torrential) · `data-season` · `data-place` (city / town / village / forest / coast / sea / desert / mountain / plains / underground / space / **interior**) · `data-temp` band (freezing / cold / mild / warm / hot) · `data-moon` (linked only) · `data-genre`.

### 4.2 Layers (back to front)

| Layer | Driven by | Detail |
|---|---|---|
| 1. Sky gradient | `data-h` | 12 bands: deep night · small hours · pre-dawn · dawn · sunrise · morning · midday · afternoon · golden hour · sunset · dusk · evening (the mockup shows all twelve as a ribbon) |
| 2. Season wash | `data-season` | Spring: cool green lift · summer: saturated · autumn: amber cast · winter: desaturated blue-white |
| 3. Celestial body | `data-h` (+ exact sunrise/sunset when linked) | The sun arcs from east horizon to west; the moon rises opposite. The **moon shows its phase** in linked mode (a CSS terminator). Stars fade in by band. Dawn and golden-hour suns cast **slowly turning rays** |
| 4. Clouds | `data-wx` | None → wisps (🌤️) → scattered (⛅) → full deck (☁️); storm decks darken, lower and **drift** |
| 5. Precipitation | `data-wx` + `data-int` | **Two depth layers** of rain (near: longer, faster; far: finer, slower), drawn as individual streaks at staggered spacings so the pattern never looks tiled; angle follows the wind. Snow uses a small far layer and a large, soft near layer. Sleet mixes both |
| 6. Atmosphere | `data-wx` | Drifting fog and mist bands between silhouette layers · lightning bolt and flash (⛈️, a 7 s cycle) · wind streaks (🌬️) · heat shimmer (🔥) · city haze glow after dark |
| 7. Silhouette | `data-place` | **Two or three parallax layers** (far, hazed and lighter; near, dark and crisp): skyline with lit windows that occasionally switch off, treelines, peaks with snow-lit and shadow faces, waves with a shimmering sun path, cliffs, dunes, cave arch, starfield. Wet streets add **blurred lamp reflections**. Birds or gulls cross slowly in fair weather. **Interior** swaps the whole composition: a damask wall and wainscot, an arched **window showing layers 1–6 through the glass**, lightning that also lights the room, a flickering lamp glow whose strength rises after dusk, and dust motes |
| 8. Sky dial | `data-h` (+ sunrise/sunset) | A small 24-hour ring in the top corner: a gold arc from sunrise to sunset, night in indigo, and a glowing dot at the current hour. The time sits in the middle. It makes "how long until dark?" readable at a glance |
| 9. Info strip | Header text | A frosted-glass strip along the bottom: date chip · condition · a mini **thermometer** filled by the temperature band · a **wind arrow** rotated to the wind direction · the moon phase glyph. The place breadcrumb (`Lowmarket › Dockside Stair`) is a glass pill in the top-left, last segment highlighted |
| 10. Title | `# Title` line | Display type per genre (§4.4), with a genre kicker and ornament. The kicker, title and subtitle **rise into place** one after another |

**Motion** runs only under `@media (prefers-reduced-motion: no-preference)`; otherwise every layer is static. Animations are CSS-only (transforms, opacity, masks and background-position), so there is no script.

**Weather bleeds into the reply.** The reply card under a plate gets a thin top band in the current sky's colours (storm grey with a lightning white streak, dawn rose-gold, and so on), so the page keeps the weather even after the plate scrolls away.

### 4.3 Standalone parsing rules
- Place keywords in line 2 → `data-place`: tavern|inn|room|hall|chamber|house|office|shop|bedroom|kitchen|library|cabin|car|ship's cabin → interior; forest|wood|grove → forest; harbour|dock|beach|coast|cliff → coast; street|square|market|district|city → city; and so on. Otherwise → town.
- A season word anywhere in line 1 → `data-season`.
- Intensity word next to the condition (light / moderate / heavy / torrential / driving / blizzard) → `data-int`.

### 4.4 Dynamic title typography

| Genre | Title treatment |
|---|---|
| Romance | Italic serif, a ❦ fleuron in the kicker, a rose rule fading out under the title |
| Horror | Condensed serif, slightly uneven letter-spacing, ink-bleed shadow |
| Mystery | Small-caps serif; the kicker is a tilted **case-file tab** ("Case Nº 3 · Mystery") |
| Thriller / sci-fi | Wide uppercase grotesk, plus a **countdown rule** under the title that fills toward the deadline ("front in ~3 h") |
| Fantasy | Italic Cormorant, the kicker framed by ❧ leaf ornaments |
| Comedy | Rounded sans on a slightly tilted sticker |
| Noir | Tall condensed caps, with **venetian-blind shadows** falling across the plate |
| Default | Almanac serif with a gold rule |

Title rules (model side, 02 §11.3): 2–6 words, grounded in this reply, changes when the beat changes, never "Untitled", never a spoiler.

### 4.5 Title card without a header
When a reply opens a new *beat* without a new place or time, the model may write only `# Title`. It renders as a slim **chapter card**: a small-caps "Chapter III" line above the title in display italic, framed by ❦ fleurons and gold rules that end in a dot.

---

## 5. Unspoken Register (sealed thoughts)

- A drawer, **closed by default**, labelled "✉ 3 unspoken thoughts", with the thinkers' medallions stacked in the summary.
- Each entry is a **sealed envelope** (its own `<details>`): a paper envelope tinted in the character's colour with a triangular flap and a **wax seal** stamped with their initial. The front shows the **cue** ("her thumb keeps finding the locket's clasp") and a "break the seal" hint.
- Opening it flips the flap up, lifts the seal away, and reveals the **interior** as a handwritten note in first person, signed "— Mara" in their colour. "Reseal" closes it again.
- A padlock glyph and the caption "No one else in the story knows these" set the knowledge boundary for the *reader* too.
- The drawer never returns to the prompt (prompt regex) and is stripped from memory ingestion.

---

## 6. Visual Toolkit (VTKs)

### 6.1 Mark
```
[vtk=letter|To the Harbourmaster|sealed · red wax · Day 2]
Sir —
» The cargo was never ours to sell.
[sig=E. Vance]
[/vtk]
```

### 6.2 Library (`vtk_kinds`)

| Kind | Look | Sub-syntax |
|---|---|---|
| letter | Laid paper, wax seal in the sender's colour, deckled edge | `[sig=Name]`, `[stamp=text]` |
| note | Torn scrap, pencil hand | — |
| phone | Message thread, bubbles, timestamps, battery and signal bar | `» Name: msg` received · `« msg` sent · `~ typing` |
| sign / plaque | Carved wood or enamel plaque depending on the theme | — |
| notice / wanted | Pinned poster, reward line, weathering | `[stamp=]` |
| news | Masthead, dateline, two columns, a headline in display serif | `## headline` |
| screen / terminal | Mono, scanlines, prompt lines | `> command` |
| item | Item card with rarity border (common → mythic), stats grid | `[meter=Label\|cur\|max]` |
| map / route | Parchment with a legs list | `→ leg · time` |
| receipt | Thermal paper, dotted rules, mono totals | `Item .... price` |
| photo | Polaroid frame, handwritten caption | — |
| journal | Lined page, date margin | — |
| omen / tarot | Card frame, upright/reversed name, symbol line | `[card=Name\|upright]` |
| dossier | Manila folder, **redactions**, CONFIDENTIAL stamp | `[redacted]`, `[stamp=]` |
| contract | Numbered clauses, signature lines | `[sig=]` |
| feed | Social post (handle, likes, reposts), era-appropriate | — |
| menu | Two-column prices, a specials box | `Item .... price` |
| ticket | Perforated stub, seat and gate | — |
| song | Lyrics card with a play bar and track time (IHYLL's "melody" idea) | `♪ line` |
| status *(game-like stories only; `meters: on`)* | HUD panel with meter bars | `[meter=]` |

### 6.3 Rules
- A VTK is something a character **could hold and read** at this moment: never a menu of choices, a stat dump or commentary.
- Frequency (`vtk`): Off · Rare (only when the story turns on a document) · **Balanced** · Frequent.
- **Artifacts are filed.** An `artifact` ledger op files the VTK into the Codex as a document with its full text and retrieval keys. Later ("what did the letter say?") Recall injects the *exact words*. Nothing else in any preset does this.
- **Prompt thinning:** artifacts older than depth 6 are reduced to `[Letter: title] text` (Tessera's approach).

### 6.4 Free-form VTK (opt-in, `vtk_freeform`)
For power users: the model may write self-contained HTML inside `[vtk=html|Title]…[/vtk]` under strict rules (no scripts, forms, remote assets, event handlers or `position: fixed`; responsive; readable as text). This follows KittyLotus's HTML safety and compatibility patches. Off by default.

---

## 7. Ledger Drawer (trackers)

### 7.1 Structure
Under each reply (`tracker_view: Drawer`), a **summary strip** is always visible:

`🕰 14:32 · 🌧 heavy rain · 📍 back room · (M)(K)(J) 3 present · Δ 9 ▾`

Each item is a pill; the present cast shows as overlapping mini-medallions; the change count is an accent-coloured button whose caret flips when open. Each panel inside is a card with an icon tile and a count ("3 changed").

Opening it reveals panels (each a `<details>`, so they're keyboard-accessible, work without script, and are respected by Lumiverse context filters):

| Panel | Content | Visual |
|---|---|---|
| **Scene** | Clock, elapsed this turn, weather now → next, place path, present (tiers), scene mode, tension (0–5) | A compact plate strip |
| **Cast** | One card per present character: named emotion + **VAD sliders** (valence, arousal, dominance as knobs on a track tinted in their colour); meters (health · fatigue · hunger · thirst · pain · arousal*) as 5-segment bars, each meter its own colour; injuries as tags with healing status (warnings in red); outfit line; want / tactic; mask ("shows: calm · feels: cornered") | **Trading cards**: a striped header band in the character's colour with a presence-tier badge, the medallion overlapping the band, then the stats |
| **Bonds** | Changed edges this turn first, then the pair's full axis bars. **NPC↔NPC edges included** | Row: medallion → gradient arrow → medallion, axis name, a green/red delta pill (`▲ +1 → +2`). Below it a bipolar track (−5…+5) showing the **old value as a dashed ghost knob, the new value as a solid knob, and a trail between them**, so you see the movement, then the reason in italics |
| **Thoughts** | The Unspoken register (when `inner_voice: register`) | Sealed envelopes (§5) |
| **Inventory** | {{user}}'s items and notable NPC items: holder, where, condition, quantity, custody chain (last transfer) | Item tiles: a gilded icon square, name in display type, holder shown as their mini-medallion |
| **Threads & Clocks** | Open threads (status, latest, next eligible), **faction clocks**, deadlines with countdown | **Segmented rings** with visible gaps between segments and the fraction in the middle; colour by meaning (threat red, hopeful green, neutral blue) |
| **Knowledge** | Who knows what *about the scene's topics*: knows / believes / suspects / **wrong** (flagged) / unaware; dramatic-irony alerts ("Kael is certain of something false") | Matrix with the present cast's medallions as column heads and coloured pills (✓ knows, ? suspects, ✗ wrong, — unaware). Irony alerts get a 🎭 callout with a gradient border. On phones each fact becomes a small card listing each person |
| **Consequences** | Open debts, promises, injuries, reputation changes; *due* items highlighted | Ledger list |
| **World** | 12 h forecast, rumours in circulation (truth hidden or revealed per `epistemic`), faction status, local prices band | Mini forecast strip |
| **Romance** | Ladder tier per pair (7-step gauge), last evidence, the pace gate ("needs 1 more scene of returned signals") | Step gauge |
| **Timeline** | Milestones in story time | Ribbon |
| **Genre widget** | Clue board / dread gauge / countdown / callback ledger / leverage map / needs panel, depending on the genre | Genre-specific |

\* The arousal meter shows only when `nsfw` ≠ off.

### 7.2 Standalone vs linked
- **Standalone:** panels built from ledger lines plus `status` lines: Scene, Cast (from status), Bonds (deltas only), Thoughts, Inventory (deltas), Threads (deltas).
- **Linked:** every panel, complete, as a **snapshot at that message**. Scrolling up shows the world as it was then. The extension's **drawer UI** adds rich views that in-message HTML can't: a force-directed relationship graph (SVG), a timeline scrubber, a knowledge matrix with filters, and a Codex browser (05 §14).

### 7.3 HUD mode
`tracker_view: HUD` renders a single slim strip pinned at the top of the reply (a mini sky dial, time, weather, place, present people's medallions each with a glowing mood dot), on a sky-coloured gradient, and nothing else. For players who want continuity at a glance without drawers.

---

## 8. Director's notes and OOC cards

- **Director's notes** (visible CoT channel): a closed drawer titled "🎬 Director's notes · pivotal", styled as a **call sheet**: a clapperboard stripe across the top, then each Director's Pass step as a coloured label (planning steps blue, minds violet, world amber, checks green) beside its note. Risks are flagged in red. It appears after the prose (moved by `alm-plan-last`) and never returns to the prompt.
- **OOC answer card:** out-of-character replies render as a quiet, dashed-border side card with an "OOC" tab, visually separate from fiction.
- **Command results** (`/recap`, `/report bonds`, `/audit`) render as a **Campaign Folio** card with tabbed sections (the successor to CHRONICON's toolkit).

---

## 9. Director's Desk (one-click actions)

Built with Lumiverse **associative regex actions** (`data-regex-action`) in the footer of the Ledger drawer on the **latest** reply only (a depth filter). The buttons are tactile **keycaps** that press down when clicked; the primary action is filled in the accent colour.

| Button | Action |
|---|---|
| ⏩ Skip… | Multi-select: 15 min · 1 h · until evening · next morning → sends `/skip <span>` |
| 📜 Recap | Sends `/recap` (a "Previously on…" folio) |
| 🕸 Bonds | Sends `/report bonds` |
| 🔎 Audit | Sends `/audit` (continuity check against the Ledger) |
| 🌦 Forecast | *Append* action: adds the forecast to the composer as OOC context |

Actions are **one-shot** (Lumiverse disables used choices across reloads and devices), so an old drawer can't fire twice.

---

## 10. Accessibility and mobile

- **Never colour alone:** every speaker has a nameplate and medallion letter, and a screen-reader label (`<span class="alm-sr">Mara says:</span>`).
- **Contrast:** all tints are clamped to WCAG AA against the live background.
- **Motion:** all animation sits behind `prefers-reduced-motion: no-preference`.
- **Keyboard:** drawers are `<details>`/`<summary>`.
- **Mobile (< 560 px):** voice cards go full-width and the medallion shrinks; the player's card stops indenting; plates stay tall enough for the title (about 260 px) and the info strip wraps; tracker grids collapse to one column; the call sheet stacks labels above notes; the knowledge matrix becomes a list of fact cards.
- **Token hygiene:** HTML exists only in display output. Lumiverse context filters and ALMANAC's prompt regex keep it out of the model's context.

# 09 · Elsewhere: the world off the page

Elsewhere answers one question between scenes: **what is everyone else doing?** It has two jobs. First, the people who aren't in the scene live their own stories: subplots that move while the player is busy, including people the story has never shown. Second, the world produces surprises that are **random** in when they happen and how they turn out, but **grounded**: every event rests on something the story, the card, the persona or the lorebooks already established, and names what it rests on.

**Status:** built in extension 1.14.0 and preset 1.0.12 (`src/core/elsewhere/`, `src/backend/elsewhere.ts`). Where the build differs from this text, the notes in §19 say so.

It replaces the off-screen simulator ([05 §11.4](05-extension-ledger.md)). It builds on NPC autonomy and the relationship web ([02 §7–8](02-preset-almanac.md)), the world layers ([02 §10](02-preset-almanac.md)) and the knowledge model ([07](07-knowledge.md)).

## 1. What goes wrong today (1.13.1)

The simulator is one model call asked to "advance the world". It has no dice, no memory of what it said, no cast beyond the page, and nothing checks what it writes. Replaying the user's Buffy chat (`6170f171`: 269 messages, four story days, simulator on) and the Targaryen chat (`7a49f564`) shows the results:

| Symptom | Cause |
|---|---|
| 29 of the 40 people in the Buffy lorebooks could never move off the page: Spike, Faith, Hank, the Trio, Clem, Razor, and all of Gabriel's family (Richard, Jonathan, Eleanor, William, Clara, Callum, Amaya). Giles and Angel, named once, were eligible but never moved. Two of the ten actor slots went to "house" and "Dawn's", which aren't people | The simulator takes only people already in the story's cast who aren't in the scene, the first 10 of them ([ingest.ts](../src/backend/ingest.ts) `runSimulator`). The Targaryen chat would leave out 24 of its 27 the same way: the whole court. It hasn't ticked yet, being one 45-minute evening |
| 11 of 12 arrivals never reached the story | An arrival's place ("Winters Residence › kitchen") is compared against each single segment of the scene's place, so a nested place never matches ([turn.ts](../src/backend/turn.ts)). Nothing expires either: fixing the match alone would deliver Day 1's sirens on Day 4 |
| The Hellions raid "moved 2/6 → 3/6" in four separate runs. In the state it moved once, and a second, junk clock appeared ("raid Sunnydale → 3/6", at 2/6) | The model writes clocks as free text. `clockf` reads `2/6 → 3/6` as "set to 2", puts the arrow into the project name, and makes a new faction from `Hellions 3/6 → 4/6` |
| 7 of the 12 arrivals are the same beat: the raid heard or reported from the house (sirens, breaking glass, a helicopter, the radio) | Nothing records what was already sent, or rotates the spotlight |
| `thread Scoobies: Buffy hasn't contacted Xander or Willow yet; stalls: 0` is filed as an advance | A restatement with no change parses as `advance`, which also resets the stall rule |
| Duplicate threads: *Back-pay* and *Council back-pay*; *Scoobies* and *Scoobies-departed*; *Lost meals* and *Packing the house* | The simulator names threads freely |
| `know Willow: Buffy was in Heaven` filed with no route | The simulator states knowledge; nothing checks how it reached her |
| A quiet night produces nothing, or more of the same | Every decision is left to a single model call; there is no chance in it |

## 2. Principles

1. **Everyone is somewhere, doing something.** The cast is everyone the story knows: the page, the card, the persona and the lorebooks. Not only who has spoken.
2. **Grounded means it has grounds.** Every arc and every beat cites the records, facts and threads it rests on. If nothing grounds it, it doesn't happen.
3. **Random means dice, not vagueness.** The engine decides whether something happens, when, and how it turns out. The dice are seeded by the chat and the story clock, so a swipe, a regenerate or a rebuild sees the same world. The weather engine already works this way.
4. **The engine keeps the books; the model only tells.** Clocks, stages, outcomes and who is involved are mechanical. A model writes the in-world sentence and the knowledge lines, inside a card it can't step out of. If the model fails, a template tells the beat and the mechanics still move.
5. **Knowledge travels off the page too.** Nobody acts on news that hasn't reached them. News moves along ties, person to person, with delays and distortion ([02 §8.4](02-preset-almanac.md), [07](07-knowledge.md)). No record means "unknown", never "knows" (07 principle 3).
6. **The page belongs to the player.** Off-page life reaches the scene only by a route: a call, a carrier, a sound, a trace, an entrance. It never decides what the player's character does, says, thinks or knows. An offered entrance is an option the reply may decline.
7. **Irreversible changes happen on the page, or with the player's say-so.** Death, a permanent departure, a marriage, a child, a lasting injury to someone who matters.
8. **Variety is enforced, not hoped for.** The spotlight rotates, a beat never repeats, and a route isn't reused back to back.
9. **Spoiler-safe.** Secrets kept off the page stay off. Playbooks (a depth book's scripted what-if scenes) are never grounds for off-page events; they are what made the user regenerate for invented events.
10. **Cheap.** The engine runs in milliseconds. There is at most one quiet model call per tick, and engine-only telling costs nothing.

## 3. Overview

```
 reply filed, story clock moved ≥ step                                            next prompt
        │                                                                              ▲
        ▼                     ── all engine: deterministic, milliseconds ──            │
 ┌─ ROSTER ─────┐  ┌─ NEWS ────────┐  ┌─ STORYTELLER ──┐  ┌─ GATE ──┐  ┌─ TELLING ──────┐  ┌─ CROSSINGS ──┐
 │ who, where,  │─►│ facts hop     │─►│ which arcs move│─►│ MKAMT   │─►│ one quiet call │─►│ arrivals,    │
 │ standing,    │  │ along ties    │  │ dice, new arcs │  │ per beat│  │ dresses the    │  │ carriers,    │
 │ drives, ties │  │ (know lines)  │  │ pacing, twists │  │         │  │ beat cards     │  │ entrances    │
 └──────────────┘  └───────────────┘  └────────────────┘  └─────────┘  └───────┬────────┘  └──────────────┘
                                                                        validator│ fails → template
                    everything lands as anchored side events (@index, source "sim"): swipe-, fork- and rebuild-safe
```

The deterministic half runs right after the reply is filed, so its arrivals are ready for the next prompt. The telling call runs in the background, as the simulator does now. If it hasn't come back when the player sends, any due arrival goes out in its template wording. The send is never blocked.

## 4. The roster

### 4.1 Rings

| Ring | Who | Buffy chat, Day 4 |
|---|---|---|
| Onstage | In the scene now (`tier` spot/peri) | Buffy, Gabriel, Dawn, Ruth |
| Offstage | Has been on the page, not here | Valeria, Walter, Willow, Tara, Xander, Anya |
| Unmet | Known from the card, persona or lore; never on the page (or only named) | Spike, Faith, Hank, the Winters family, Clem, the Trio, Razor…; Giles and Angel only named (31) |
| Extras | Unnamed roles a beat may need: "a Council courier", "the bag boy" | minted per beat, never named people |

Onstage people aren't simulated; the scene is their life. Elsewhere still remembers them, so their arcs pause and resume.

### 4.2 The profile

Built on demand from the Codex record and the state. Only what Elsewhere adds is stored.

| Field | Means | Comes from |
|---|---|---|
| `standing` | here · away · captive · changed · dead · companion · construct | Lore text (the classifier's `dead`, plus one new field), the Cast page. Joyce: dead. Giles: away (England). Faith: captive. Amy: changed (a rat). Ruth, Caraxes: companion. Buffybot: construct |
| `base`, `where` | Where they live or work, and where they were last placed off the page | Lore `place`/`parent`, routine, `where` ops |
| `reach` | How far their doings are from the player: house · town · region · far · none | `where` against the scene's place path; place records' `routes` |
| `drives` | want · fear · role · tension | Codex body (archivist, lore, Weaver anchor *Drives*) |
| `ties` | To whom, how strong (1–3), and what kind | Bonds; lore links (`member`, `participant`, `about`); family words ("Gabriel's uncle"); names mentioned in each other's records (weak) |
| `knows` | Their stances on facts | The knowledge model (07) |
| `routine` | Hours and places | Codex `routine` (archivist or Cast page) |
| `lastPage`, `lastBeat` | When they were last seen, and last moved | State, arcs |
| `protected` | Irreversible fates need the player | On by default for anyone with a lore record, the card, and anyone tied to the player's character |
| flags | out · hold · bring in | Elsewhere page |

A **companion** (a pet, a dragon) acts only with its owner. A **construct** acts on its orders. The **dead** never act, but they ground arcs: grief, an inheritance, a grave. **Away** people act where they are, and **captive** people act inside. **Changed** people don't act until the story changes them back.

### 4.3 The awake set

Simulating 40 people dilutes the story and costs tokens. Each tick, people are ranked and the top *N* are **awake** (Quiet 6 · Living 10 · Restless 16):

```
score = 3·(has a running arc) + max tie strength to someone onstage or offstage
      + reach weight (house 1 · town .8 · region .5 · far .3 · none 0)
      + .5·(named in the last 40 messages) + neglect (hours since their last beat / 24, capped at 1)
      − 10·(standing is dead, changed or companion) − 10·(flag: out)
```

Everyone else sleeps and costs nothing. A sleeper wakes when news reaches them, when an awake arc needs them (a twist pulls in a tie), or when the player asks.

## 5. Arcs: the subplots

### 5.1 Shape

```ts
interface ArcState {
  id: string;                 // "arc:giles-return"
  kind: ArcKind;              // §5.2
  lead: string;               // char id (or "world", or a faction id)
  cast: string[];             // others in it
  premise: string;            // "Giles hears Buffy is back and comes to see for himself"
  want: string;               // what the lead is after
  fear: string;               // what happens if it goes badly
  grounds: string[];          // record ids, #fact keys, thread ids: never empty
  secrecy: "public" | "private" | "secret";
  clock: { cur: number; max: 4 | 6 | 8 };
  tally: { win: number; cost: number; loss: number };
  heat: 0 | 1 | 2 | 3;        // how hard it pushes
  stage: "setup" | "rising" | "crisis" | "aftermath";
  beats: Beat[];              // dated, newest last (12 kept; older ones fold into a line)
  nextAbs: number;            // earliest next beat, in story minutes
  status: "running" | "held" | "crossed" | "resolved" | "dropped";
  thread?: string;            // the onstage thread it became, once it crossed
  by: "engine" | "player" | "lore";
  locked?: boolean;           // the player's own words; the engine never rewrites them
}

interface Beat {
  atAbs: number;
  roll: [number, number]; mod: number;
  result: "win" | "cost" | "loss";
  twist?: TwistKind;
  text: string;               // the in-world sentence
  told: "model" | "template";
  arrivals: string[];
  msgIndex: number;           // its anchor
}
```

### 5.2 The grammar

Each kind says when it fits, how it tends to move, and how it reaches the player.

| Kind | Fits when | Moves through | Reaches the player as |
|---|---|---|---|
| **Pursuit** | A clear want and something in the way | asks · tries · fails forward · gets | a request for help; the result, shown |
| **Scheme** | Ambition or a role in power, plus a rival | recruits · gathers · moves · exposed or done | a rumour, a consequence, a summons |
| **Rivalry** | rivalry or resentment ≥ 3 | slight · retaliation · escalation · showdown | a changed greeting; being asked to take a side |
| **Courtship** | Attraction between two people off the page | notices · meets · tested · together or apart | gossip; they arrive together |
| **Rift** | A strained bond, a recent hurt | silence · words · a choice | a call to take a side; a carrier's mood |
| **Debt** | An open `owe`/`cons` | reminder · pressure · due | the collector at the door |
| **Secret** | They keep a secret others lack | covers · close call · slips or holds | a slip, a leak, a lie that doesn't fit |
| **Decline** | Addiction, illness, a hunger for power | small use · escalation · cost · bottom | a worried call; a carrier who saw it |
| **Investigation** | A question they want answered | lead · dead end · finding | they bring the finding |
| **Threat** | A hostile person, group or force | scouting · strike · escalation · reckoning | noise, news, aftermath, a trace |
| **Return** | Someone away with a reason to come back | hears · decides · travels · arrives | a call, then the door |
| **Duty** | An institution makes demands (the Council, the Small Council) | summons · order · conflict | a letter with a seal |
| **Life** | Work, family, the calendar | an ordinary event on a known day | an invitation, a photo, a missed call |
| **Loss** | A death, a departure, a grief | shock · coping · ritual · new shape | a funeral notice; someone changed |
| **World** | A Weaver world's agenda, with its holds | consequences in the setting, never announced | changed places, prices, laws |

The genre contract ([02 §12](02-preset-almanac.md)) weights the kinds. Horror leans to Threat and Decline, romance to Courtship and Rift, intrigue to Scheme, Secret and Duty, cozy and slice of life to Life, and mystery to Investigation and Secret.

### 5.3 Where arcs come from

In this order, each candidate keeping its grounds:

1. **The player.** "Give Spike a story about the chip": an arc with the player's premise, locked.
2. **Story residue.** Open threads that involve offstage people (*Willow confrontation*, *First Evil imbalance*). Open debts and consequences (*Council back-pay*). Secrets with keepers off the page. Bonds with resentment or rivalry ≥ 3. Journal lines.
3. **Lore situations.** `situation`, `group` and `forecast` records, a Weaver world's hooks and tension, and lore that states an ongoing life ("has just left for England", "serving a prison sentence").
4. **Drives.** An awake person with a want and no arc gets the kind that fits their want, fear, role and ties best.
5. **The pressures deck** ([pressures.ts](../src/core/pressures.ts)), for people the story has made consequential.

**Canon gravity** (setting: off · light · strong) decides how much the source canon may pull. *Off*: only the chat and the lore ground anything. *Light* (default): a `forecast` record can ground an arc, framed as "may happen". *Strong*: forecasts become arcs that run toward canon unless the story has diverged (the divergence detector already marks those, [05 §9.4](05-extension-ledger.md)). The model's own memory of canon never grounds anything at any setting. For the user's AU campaigns, the chat and the lore win.

**Seeding** happens when a slot is free (running arcs under the mode's cap) and a seeding roll succeeds. In engine-only mode the premise is templated from the kind, the drives and the grounds ("Spike wants to be rid of the chip", from `lore:spikes_chip`). With telling on, one quiet call proposes premises for up to three candidates, each citing its grounds by id, and the engine picks with the dice. A premise whose claims about the past aren't supported by the chat, card, persona or lore is dropped, using the same passage search the reply check uses since 1.12.2 (`supportOf` in [audit.ts](../src/core/audit.ts)).

### 5.4 The life of an arc

- **Every beat moves the story; the dice decide which way.** The clock gains 1 on every beat. The result goes on the tally: **win** (the lead gets what they're after this time), **cost** (they get it and pay), or **loss** (they don't, and something gets worse).
- **Stages follow the clock:** setup (first quarter), rising, crisis (the last segment), aftermath.
- **Resolution** comes when the clock fills: a final roll plus (wins − losses). On 10 or more, the want is met. On 7–9 it is met at a price. On 6 or less, the fear comes true. Consequences are written as ordinary ops: bond shifts among the cast (±1, ±2 for betrayal or rescue), `cons`/`owe`, `rep`, a fact that becomes news.
- **Aftermath chains.** A resolution may seed a follow-on arc (by mode: Quiet 1 in 6, Living 1 in 3, Restless 1 in 2). This is how subplots grow out of each other instead of being invented whole.
- **No stalling.** Because the clock always moves, the STALL rule ([02 §10.3](02-preset-almanac.md)) holds by construction. An arc that hasn't had a beat in three story days is dropped, with a line saying why.
- **Crossing.** When an arc reaches the player's story (an entrance used, or a carrier's news taken up on the page), its status becomes *crossed* and it links to a thread. From then on, the page drives it. Elsewhere only advances it while its lead is off the page again.

## 6. The storyteller: chance and pacing

### 6.1 Modes

| | Quiet | **Living** | Restless |
|---|---|---|---|
| Awake people | 6 | 10 | 16 |
| Running arcs | 3 | 6 | 10 |
| Beats per 6 story hours (about) | 1 | 2 | 6 |
| Beats per tick (cap) | 2 | 4 | 6 |
| Crossings offered per scene | time jumps only | 1 | 2 |
| Incidents per story day | 0 | up to 1 | up to 2 |
| Twist chance per beat | 1 in 12 | 1 in 6 | 1 in 4 |

### 6.2 Whether something happens

Each running arc has a rate per story hour:

```
λ = base(kind) × (1 + heat/2) × stage(setup .8 · rising 1 · crisis 1.4) × mode(.5 · 1 · 2)
P(beat this tick) = 1 − e^(−λ · hours since the last tick)      base ≈ 0.08/h: about one beat in 12 h
```

A ten-minute exchange produces almost nothing, and an overnight jump produces a handful, as it should. Seeding has its own rate per awake person without an arc. Deadlines and due debts don't roll: they happen when their time comes.

### 6.3 How it turns out

**2d6 + modifier**, where the modifier (−2 to +2) comes from the gate's margins (§7): strong Means (resources) +1, an ally in the cast +1, a stronger opponent −1, acting on a belief rather than a fact −1.

| Roll | Result |
|---|---|
| 10+ | **win** |
| 7–9 | **cost**: they get it, and the engine picks the price from the kind's list (time, money, a tie strained, someone noticed, a resource spent) |
| 6 or less | **loss**: it doesn't work, and something gets worse |

**The twist die.** On a twist, one of these is drawn. Each uses only material that already exists:

| Twist | Draws on |
|---|---|
| A tie gets involved | One of the lead's ties, woken if asleep |
| The weather intervenes | The weather engine's forecast for that hour (a storm delays, fog hides) |
| The calendar intervenes | A named day, a closing day, nightfall |
| An object matters | An item in state held by the cast or at the place |
| A secret slips | Secrecy drops a step; the arc's existence becomes news |
| Two arcs collide | Another running arc that shares a place or a person. The strongest source of emergent plot |

### 6.4 Variety

- **Spotlight rotation.** A lead who moved last tick waits, unless they're the only one eligible. A neglected awake person gets the neglect bonus (§4.3).
- **Novelty.** A beat whose wording overlaps one of the last ten beats by more than 0.6 is rejected and retold. The same arc can't use the same route twice in a row. The Hellions would have had to escalate, or reach the house some other way.
- **Spread.** At most one beat per arc per tick, and at most half a tick's beats from one kind.

### 6.5 Breathing room

The storyteller reads the onstage scene: the turn tier (routine · charged · pivotal), the scene mode, injuries and fresh crises.

- During a **charged or pivotal** scene, no crossing is offered unless an arc's clock is full or a deadline is due. Arrivals wait for the scene to turn.
- **The long-scene valve** (Living and Restless only): when a scene has run 12 or more replies with little change (no new thread, fact or bond), the storyteller may offer one crossing from an arc already in motion. A long evening in the Targaryen chat might get a knock at the door, but only from someone with a reason, and only as an offer.

### 6.6 Incidents

Texture events with no lead: a power cut in a storm, a market day, a festival, a fire on the next street. They come from small tables keyed to place type, calendar and weather, and they reuse the engines that already exist. They reach the player as ambient or trace routes. Incidents follow the same novelty and spread rules as beats.

### 6.7 Determinism

```
seed = chatId : arcId (or "seed", "news", "incident") : floor(storyAbs / simStep)
```

Re-running a stretch ("Run the off-screen world now", a rebuild, a regenerate) rolls the same dice. The outcomes are stored too (§11), so the model's wording stays stable as well.

## 7. The gate: MKAMT, made checkable

[02 §10.2](02-preset-almanac.md) asks for Motive, Knowledge, Access, Means and Time before anything happens. Elsewhere checks each one against data:

| Link | Checked against | When it fails |
|---|---|---|
| **Motive** | The arc's want or fear; each beat must serve one of them | Not proposed |
| **Knowledge** | The actor's stances. A beat that acts on a fact needs *has it* (knows, believes or suspects). **Unrecorded is not enough** | A news beat first (§8), or the arc waits |
| **Access** | Where they are against where the beat happens: travel time from place routes, otherwise by reach (house 0, town 30 min, region 4 h, far 12–24 h), and their standing | Delayed by the travel time, or moved to a remote route (phone, letter, raven) |
| **Means** | Role and resources: money, magic, a car, a dragon, a gang, a seal of office | A cost at best, or a tie brought in to help |
| **Time** | The arc's cooldown; the hour (people sleep 23:00–07:00 unless their routine or nature says otherwise, and vampires keep the opposite hours); the calendar | Put off to the next eligible hour |

The gate is why the dice can't produce nonsense. Giles can't come to the door at 05:00 on the day Buffy came back if he's in England and nobody has told him.

## 8. News: knowledge off the page

The knowledge model (07) tracks who has what and how it reached them. Elsewhere adds the spreading between scenes. It runs in the engine, without a model call.

- **What travels.** Facts a holder took in recently (the stance's message, or a `FactOut`), weighted by kind: deaths, returns, identities, betrayals and big events travel. Small talk doesn't.
- **How.** For each holder, each tie without the fact, and each tick:

  ```
  P(hop) = 1 − e^(−rate · hours),  rate = 0.1/h × tie strength × contact × talk
  contact: same house 1 · same town .6 · phone/letter by tie .3 · none 0
  talk:    1, or .2 for someone the codex calls guarded or secretive
  ```

- **Secrets don't spread from their keepers.** A keeper passes a secret only through a *secret slips* twist or a Secret arc's loss.
- **Distortion.** From the second hop, each hop has a 1 in 4 chance of landing as a belief (`status: believes`, `truth: partial`) with a `version` the telling call writes ("Willow brought her back *from hell*").
- **What it writes.** Ordinary knowledge lines with a route, for example `know Giles: #buffy-alive-present | told by Willow, by phone · knows`. They are `source: sim` and narrator-only until they reach the page. A hop supersedes an older belief, such as the lore's `giles_believes_buffy_is_dead`.
- **Being there is a route.** Someone whose `where` puts them at a place takes in what is plain to see there ("saw"): a burned house, an empty room, a crowd. This is 07's witness rule, applied off the page.
- **Why it matters.** News is what wakes sleepers and unlocks arcs. Giles's Return arc can't start until the news reaches him. When it does, it starts because it reached him. The Buffy lore's own forecast says the same: "once Willow tells him Buffy is alive".

## 9. Telling: the one model call

### 9.1 The beat card

The engine has already decided everything mechanical. The card tells the model what to dress:

```
CARD b1 · arc:giles-return · Return · beat 1/6 · setup · roll 4+5 = 9 → COST (price: time)
LEAD Giles (Rupert Giles): Watcher, Buffy's mentor; away in England. Wants: to see Buffy with his own eyes.
     Fears: the risk they took with her. Knows: #buffy-alive-present (told by Willow, by phone, 04:10).
     No route to: #resurrection-cost.
CAST Willow (by phone).  WHERE England.  WHEN Day 4 04:10–05:00.
GROUNDS lore:giles_returns_to_sunnydale (forecast) · lore:giles_believes_buffy_is_dead (superseded) · #giles-left
MAY WRITE the beat (≤ 40 words) · know/bond/journal lines for Giles and Willow only · one arrival: carrier (Willow)
NEVER a new named person · anything Gabriel does, says, thinks or knows · where Buffy was
```

### 9.2 The prompt

> You tell what happened off the page in a roleplay, between two story times. *(safety data clause)* Each CARD is already decided: who, where, when, and how it turned out (WIN, COST or LOSS). Tell it as one plain past-tense sentence of what happened, in the story's language. Keep the outcome. Add nothing the card doesn't allow. Name only the people on the card. If you need anyone else, they are unnamed ("a clerk"). Write knowledge lines only for the people on the card, each with how they learned it. Never decide anything {{user}} does, says, thinks or knows. Never use the card's NEVER words.
> Output JSON only: `{"beats":[{"card":"b1","text":"…","result":"cost","lines":["…"],"arrival":{"route":"carrier","carrier":"Willow","text":"…"}}]}`

The cards and the story's [TRUTHS] lane go in the user message. Truths are the player's own rules: "Jaime and Cersei are strictly family" binds off the page too.

### 9.3 The validator

A card that fails any check is told from the template instead. The mechanics stand either way.

| Check | Rule |
|---|---|
| Shape | One entry per card; unknown cards dropped |
| Outcome | `result` echoes the card's; a mismatch fails |
| People | Every name in the text and lines resolves to the card's cast or a known place or object. A new named person, or someone off the card doing something, fails |
| The player | No clause with the player's character as subject. They may only receive ("left Gabriel a message") |
| Knowledge | `know` lines only for the cast, each with a route the card allows |
| Bonds | Card cast only, ±2 at most, and the sign fits the result |
| Off the page | `offPageHits` over the text, lines and arrival ([offpage.ts](../src/core/offpage.ts)) |
| Novelty | No more than 0.6 overlap with the last ten beats |
| Length | 40 words per beat, 30 per arrival |

### 9.4 Templates and engine-only mode

Each kind has a sentence per result ("Giles booked the first flight he could get; it leaves tomorrow."; "The Hellions hit {place} again; this time someone saw their faces."), filled from the card. With **Telling: engine** the model is never called. Beats are plainer, but they are just as grounded and cost nothing.

## 10. Crossings: how it reaches the scene

### 10.1 Routes

| Route | Example | Delivered when | Expires |
|---|---|---|---|
| **carrier** | Tara knows Willow slipped out last night | The carrier is in the scene with the player's character | When superseded, or after 3 story days (becomes old news the carrier mentions in passing) |
| **signal** | A call, a text, a letter, a raven | At its time, if the player's character can receive it (a phone in a modern setting; a raven at the Red Keep) | A letter waits. A call becomes a missed call or voicemail trace |
| **ambient** | Sirens, the radio, bells, smoke on the skyline | The player is within the event's reach at its time | 6–12 story hours |
| **trace** | A broken window at Revello Drive | The player is at that place | Until found, or until a later beat changes it |
| **entrance** | Giles at the door | Offered when access and time allow and the scene isn't charged or pivotal | When the arc moves on |

**Place matching is by segment.** An arrival at `["Revello Drive", "Summers house"]` matches when the scene's place path contains its deepest named place, or contains its parent and the route's reach covers the gap. This fixes the 11-of-12 bug.

**Delivery is confirmed after the reply, not assumed when planning.** An arrival is *offered* in the note. After the reply, it counts as *used* when the prose or the ledger takes it up: the carrier speaks of it, the person enters the cast, or the arrival's words overlap the prose. If it isn't used, it stays pending until it expires. Today, an arrival is marked delivered as soon as it is planned, whether or not the reply used it.

### 10.2 The note lane

`[ARRIVED]` becomes `[ELSEWHERE]`, about 140 tokens at most:

```
[ELSEWHERE] Reaches the scene now: Gabriel's phone, 09:10 — his mother, Eleanor (her usual call; she knows
  nothing of Sunnydale). Render it; invent no other news.
  Could come in, if the scene opens (optional): Tara, about Willow — she woke last night to find Willow gone.
```

### 10.3 Entrances and returns

**First entrance of an unmet person.** The note carries a capsule (≤ 120 tokens): who they are (the Codex), what they want right now (the arc), what they know, and what they have no route to (07's firewall: Spike has no route to Buffy's return, so the model mustn't have him act on it), and their latest beat. The model doesn't invent their off-page life, because it is given it.

**"Since you last saw them."** When an offstage person comes back on the page, their PRESENT capsule gains their beats since `lastPage`, from their point of view, with what they would tell or hide:

```
Willow (last here Day 3 20:13): overnight she slipped out looking for Rack's place; Tara woke to find her gone.
She'll hide it unless asked straight out.
```

This gives continuity on return. People come back carrying what they did.

### 10.4 Encounters

When the player's character moves to a new place, the engine lists who is likely there: routines and `where` from the roster, plus arcs placed there. "Likely here: Anya at the Magic Box counter (her hours); Clem, asking around for Spike." It is an offer in the note, never forced, using the place clocks of [05 §11.3](05-extension-ledger.md).

## 11. Storage and branch safety

**New extension-only ops** (never written by the model, shown in the Director view):

```
arc new #giles-return: return | lead Giles · with Willow · private · 6 | wants to see Buffy with his own eyes; fears the risk they took with her | grounds char:rupert_giles, lore:giles_returns_to_sunnydale, #buffy-alive-present
arc beat #giles-return: cost 4+5 | booked the first flight he could get; it leaves tomorrow
arc stage #giles-return: rising
arc cross #giles-return: thread giles-return
arc end #giles-return: met at a price | …
where Giles: England | since Day 3
```

Everything else goes out as the ops that already exist, written by the engine in canonical form: `know`, `bond`, `clockf Hellions: raid Sunnydale 4/6 | cause` (never the free-text arrow forms), `cons`, `owe`, `rep`, `journal`.

**Where it lives.** Each tick's ops are anchored side events at `@<index>` with `source: "sim"`. This is the 1.13 mechanism, so beats survive swipes and regenerations ("what happened off-screen still happened"), carry over into a fork up to the branch point, and survive a rebuild. The fold gains `st.arcs` and `st.whereabouts`. Arrivals stay in `meta.arrivals`, upgraded to:

```ts
interface Arrival {
  id: string; arc?: string; route: "carrier" | "signal" | "ambient" | "trace" | "entrance";
  text: string; template: string;       // the model's wording, and the engine's fallback
  carrier?: string; place?: string[]; medium?: string;
  atAbs: number; untilAbs?: number;
  status: "pending" | "offered" | "used" | "expired";
  offered: number[];                    // msg indexes it was offered at
}
```

**When the clock moves back** (the player says "it's day 12"), beats stay at their anchors, because they happened at that point in the chat, and ticks resume from the new time, as the simulator has done since 1.13 (release-audit item M-11).

**Bounds.** At most 24 non-resolved arcs. A resolved arc folds to one line after two story days. Each arc keeps its last 12 beats, and up to 40 arrivals are kept.

## 12. The player's controls

```
┌ Elsewhere ───────────────────────────────────────────── Surprise me ◐ Director ┐
│ Day 4 05:00 · last tick: overnight (6 h 36 m) · 4 beats · 1 call · 2.1K tokens │
├────────────────────────────────────────────────────────────────────────────────┤
│ ◔ Spike · Pursuit                        1/6 · setup · private · 1 loss        │
│   wants to know where Dawn went · fears she's in the Hellions' hands           │
│   ▸ 03:30 back at Revello Drive for her trail; ran into the Hellions (twist:   │
│     two arcs collide); got out, trail cold                                     │
│   reaches you: ⌂ trace at the Summers house (broken windows, a burned bike,    │
│     his cigarette ends on the porch)                                           │
│   grounds: lore:spike_protects_dawn · Spike→Dawn · thread Find Dawn            │
│   [hold] [nudge] [bring in] [edit] [drop]                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│ ◔ Giles · Return                         1/6 · setup · private · 1 cost        │
│ ◔ Willow · Decline                       1/6 · setup · secret · 1 loss         │
│ ◕ Hellions · Threat                      4/6 · rising · public · 1 win         │
│ ○ Eleanor · Life                         0/4 · first beat held until 09:00     │
├ In the wings ──────────────────────────────────────────────────────────────────┤
│ awake   Valeria · Walter · Willow · Tara · Xander · Anya · Giles · Spike ·     │
│         Eleanor · Razor          woken this tick: Rack (Willow's twist)        │
│ asleep  Clem · Angel · Oz · Riley · Hank · Amaya · Richard Winters · …         │
│ dead Joyce · Maria   captive Faith   changed Amy                               │
│ [+ give someone a story]                                                       │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Surprise me** shows only what has reached the player ("you've heard…"). **Director** shows everything: dice, grounds and pending fates. The drawer already shows secrets and pressures, so Director is the default, and Surprise is one switch away.
- **Per arc:** *hold* (freeze), *nudge* (next beat sooner), *bring in* (offer a crossing next turn), *edit* (rewrite the premise, want or fear; this locks it), *drop*.
- **Per person:** out of the simulation, keep off the page, wake.
- **Give someone a story:** a free-text premise for anyone in the roster. The engine picks the kind and grounds it, and asks if it can't.
- **Fates** (setting: page · ask · allow). Under *ask*, an irreversible outcome for a protected person waits on the page as **Accept · Soften · Keep it for the page**. Soften downgrades it ("injured", "nearly"). Keep turns it into an entrance, so it happens in a scene.

## 13. Settings

| Setting | Values | Default | Notes |
|---|---|---|---|
| `elsewhere` | off · quiet · living · restless | living if `simulator` was on, else off | Replaces `simulator` |
| `elsewhereTelling` | model · engine | model | Engine: no model calls at all |
| `canonGravity` | off · light · strong | light | §5.3 |
| `fates` | page · ask · allow | ask | §12 |
| `elsewhereView` | surprise · director | director | Drawer only; never changes the prompt |
| `simStep` | story minutes | 120 | Kept: the tick length |
| `simConnection` | a connection | your default | Kept: the telling call |

Per chat (`ChatConfig`): a mode override, roster flags and the player's own arcs. The legacy `socialTicks` and `rumors` keys still in the user's settings file are folded in: social drift between co-located people is a Rift or Courtship beat, and rumours are news hops.

**Preset side** (small): the off-screen life block ([02 §7.4](02-preset-almanac.md)) reads `[ELSEWHERE]`. Arrivals are rendered and none invented, and an offered entrance is optional. The Director's Pass WORLD step names whether it takes the offer.

## 14. Worked example: the Buffy chat, Day 3 22:24 → Day 4 05:00

*Illustrative. This is what the engine would do if Elsewhere were switched on (Living) at Day 3 22:24, using the chat's real state. It is not a recorded run. Every record id and fact key below is the chat's own.*

**Roster.**
- Onstage: Buffy, Gabriel, Dawn (asleep), Ruth.
- Awake (10): Valeria, Walter, Willow, Tara, Xander and Anya (offstage); Giles (tied to Buffy and Willow; away in England); Spike (tied to Dawn, who is onstage; in town); Eleanor Winters (the player's mother; Los Angeles); Razor (leads the Hellions).
- Asleep: Clem, Rack, Angel, Oz, Riley, Hank, Amaya, the rest of the Winters family and the Trio.
- Can't act: Joyce and Maria are dead, Faith is captive, Amy is changed.

**News (6 h 36 m).**
- Willow holds `#buffy-alive-present` ("Buffy is alive and present at Gabriel's house").
- Willow → Giles: tie 2 (both are named in `lore:giles_returns_to_sunnydale` and `lore:willows_magic_spirals`), by phone (.3). The rate is .1 × 2 × .3 = .06/h, so P = 1 − e^(−.4) ≈ .33.
- The seeded draw is .21, so it hops: `know Giles: #buffy-alive-present | told by Willow, by phone · knows`. That supersedes his lore belief `lore:giles_believes_buffy_is_dead`.
- Nothing carries `#resurrection-cost` (where Buffy was). Buffy holds it, Valeria suspects it, and it is kept from Dawn, Gabriel and Walter.

**Seeds.**
- **Giles · Return.** The forecast `lore:giles_returns_to_sunnydale` says he "will likely fly back to Sunnydale within days once Willow tells him Buffy is alive". The news hop has just met its condition, and under light canon gravity a forecast is a ground.
- **Spike · Pursuit**, the user's own example of someone never on the page. The lore puts him at Revello Drive guarding Dawn during the raid (`lore:spike_protects_dawn`). The story moved past that situation on Day 1, when Gabriel took Dawn away, and Spike never appeared. His base is his crypt (`loc:spikes_crypt`).
  - What grounds his arc: he was guarding Dawn, and she's gone. Being at the place is a route ("saw").
  - What doesn't: that Buffy is back. None of his ties holds that news, and the engine won't import it from canon.
  - So he wants to know where Dawn went. Grounds: the situation record, his tie to Dawn, and the *Find Dawn* thread.
- **Willow · Decline.** Grounds: the forecast `lore:willows_magic_spirals` (Tara is in its cast and Rack is named), the *Willow confrontation* thread, and Tara's knowledge line.
- **Hellions · Threat.** It adopts the existing faction clock, raid Sunnydale 3/6.
- **Eleanor · Life.** Grounds: her lore record (Gabriel's mother, a neurosurgeon in Los Angeles) and her tie to her son. It is seeded without a beat: the Time link holds her first one, a call, until 09:00.

**Beats** (Living allows 4 a tick):

| Arc | Roll | Result | The engine fixed | Told as |
|---|---|---|---|---|
| Giles · Return | 4+5 = 9 | cost: time | clock 1/6 | He booked the first flight he could get; it leaves tomorrow. **Carrier:** Willow. **Entrance:** not before Day 5 evening (Access: far, 12–24 h) |
| Hellions · Threat | 5+6 = 11 | win (for them) | `clockf Hellions: raid Sunnydale 4/6` | Told with Spike's beat, below. Seven earlier arrivals were the raid heard from the house, so ambient is out (novelty). The beat goes to Revello Drive, where the open *Revello Drive salvage* thread will take the player |
| Spike · Pursuit | 3+3 = 6, twist: *two arcs collide* (Hellions, same street) | loss | clock 1/6 | He went back to Revello Drive for Dawn's trail and walked into the Hellions stripping the Summers house. He got out; the trail went cold. **Trace** at the Summers house, shared with the Hellions beat: broken windows, a burned-out bike in the yard, his cigarette ends on the porch |
| Willow · Decline | 2+3 = 5, twist: *a tie gets involved* (Rack, named in the forecast) | loss | clock 1/6; Willow→Tara trust −1; Rack wakes | She slipped out looking for Rack's place; Tara woke to an empty bed. **Carrier:** Tara |

**The next prompt (Day 4 05:00)** says `[ELSEWHERE] (nothing has reached the scene yet)`. It's dawn: no carrier is onstage and nobody is at Revello Drive. Then, as the story moves:
- Gabriel's phone rings after 09:00 (Eleanor).
- Tara or Willow, whichever shares a scene first, brings her part.
- The Summers house waits with its broken windows for the salvage trip. That is how the player first meets Spike's story, without Spike.
- Giles's entrance becomes possible from Day 5 evening.

The Director view shows all of this, and Surprise shows none of it. Nothing in it is invented beyond the beats' own small details. Every person, place and want comes from the chat or its lorebooks.

**The Targaryen chat**, for contrast: 39 messages in 45 story minutes, so nothing ticks, which is right. At the first overnight jump the court wakes up: Viserys, Alicent, Otto, Daemon, Laenor, Larys, Criston and Mysaria. Scheme, Duty and Secret arcs move news through Larys and Mysaria, and the dragons act only with their riders.

## 15. Cost and performance

- **Engine:** the roster, news, storyteller and gate together take under 5 ms a tick for 50 people (to be measured against the 2,510-message synthetic chat from the release audit).
- **Model:** at most one call per tick, and only when at least one beat or seed needs telling. The cost is about 1.5–2.5K tokens in and 400–600 out. The Buffy chat would have made about 10 calls in four story days, much as now. Engine-only telling makes none.
- **Prompt:** `[ELSEWHERE]` up to about 140 tokens, plus up to 120 for an entrance or return capsule, counted under the injection ceiling.

## 16. Failure modes

| Failure | Guard |
|---|---|
| The model invents a person or an event | The validator's name check; the template takes over |
| The model decides for the player | The player-clause check; the template |
| A spoiler | `offPageHits` on everything; playbooks are never grounds; NEVER words on the card |
| An AU rule broken | [TRUTHS] on every card; seeds checked against them |
| Floods | Caps per tick and per scene; breathing room |
| The same beat again | The novelty filter; route rotation |
| An arc that goes nowhere | The clock always moves; arcs idle for 3 days drop |
| An unwanted death | Fates |
| The telling call fails or times out | Templates; the mechanics still advance; the problem shows in the drawer |
| The player moves the clock back | Beats keep their anchors; ticks resume from the new time |

## 17. Validation

Following the house rule: replay the real chat, not only synthetic tests.

- **Unit tests.**
  - The same window gives the same dice.
  - The gate: the dead, away, captive and companions; unrecorded knowledge blocks.
  - News never leaves a keeper.
  - Arrivals: segment matching, expiry, confirmed on use.
  - Canonical clock lines.
  - The validator rejects new names, player clauses and off-page words.
- **Replay of the Buffy chat** (`6170f171`): fold to each tick's anchor and run the engine with template telling, then with model telling on a cheap connection. Read every tick. Targets:
  - at least 6 different leads across the four days;
  - no beat repeated;
  - every arrival used or expired with a reason;
  - no invented names, no off-page leak;
  - no knowledge line without a route.
- **The Targaryen chat**: nothing ticks inside the 45-minute scene. A synthetic overnight jump seeds court arcs that use only the lore's people.
- **Performance**: the engine time per tick and the state growth on the 2,510-message synthetic chat.

## 18. Delivery plan

| Phase | Ships | Contents |
|---|---|---|
| 1 | Patch (1.13.x) | Fix the current simulator: segment place matching, expiry, delivery confirmed on use; the engine writes canonical `clockf` lines (reading `a/b → c/d` as the new value); "no change" thread restatements are dropped from simulator ops; simulator threads reuse an existing thread's key on a close match |
| 2 | Roster and news | Standing, ties, the awake set, news hops (engine only); the roster on the Elsewhere page |
| 3 | Arcs, engine-told | Arcs, the storyteller, dice, the gate, templates, crossings, `[ELSEWHERE]`, "since you last saw them"; Director and Surprise views |
| 4 | Telling | The beat-card call, the validator, seeding proposals, fates |
| 5 | Tuning | Authoring arcs, incidents, encounters, canon gravity; tuned by replay |

**New modules:** `src/core/elsewhere/` with `roster.ts`, `arcs.ts` (the grammar and templates), `storyteller.ts`, `dice.ts`, `gate.ts`, `news.ts`, `crossings.ts` and `telling.ts` (prompt and validator). `src/backend/elsewhere.ts` replaces `runSimulator`. The fold of `arc` and `where` goes in `state.ts`, the lane in `note.ts`, and the page in `src/frontend/`.

## 19. As built (1.14.0)

All five phases shipped together. The modules: `roster.ts`, `news.ts`, `arcs.ts` (seeding and the gate), `grammar.ts`, `storyteller.ts` (the tick), `crossings.ts`, `telling.ts`, `fold.ts`, and `src/backend/elsewhere.ts`. Tests: `tests/elsewhere.test.ts`, plus a host test in `tests/hooks.test.ts`. A replay of the Buffy chat with engine-only telling was read tick by tick.

Changes the replay forced, beyond the text above:
- **News must be big.** Only facts about a life, a death, a return, a betrayal, an arrest, a raid or an exposure travel. One fact per pair of people per tick, at most four hops a tick. Nobody is told news about themselves, or passes on news about themselves.
- **Estranged and former ties are weak.** "Drifted out of his daughters' lives" makes a father a tie of 1, and "former lover" a tie of 2.
- **The awake set keeps room for the unmet.** At most three in five awake places go to people who have been on the page, and a seeded jitter rotates near-ties.
- **Lore alone seeds only kinds a description can carry:** duty, scheme, decline, investigation, secret, life, and loss only with grief words. A demon's lore doesn't make him a threat.
- **Light subplots give way.** A subplot resting on nothing but the person's own record yields to a better grounded one: Giles's Council duty gives way to his return once the news reaches him.
- **Factions and the world's agenda seed first** when there is room.
- **The town is the top of the visited places,** climbed through lore parents only while the story has been there ("Winters Residence" → "Sunnydale", never "Southern California").
- **A trace waits at a particular place,** never "the town": the beat's own spot, or a place an open thread will take the player.
- **How often each route is offered before it's gone:** a sound once, a call once (then a missed call, offered twice), a trace twice, a carrier three times, an entrance twice.
- **"Back on the page" shows only a person's own subplots,** and ones they're in that aren't secret.
- **Profiles.** When telling is on, the same call profiles up to four awake people from their lore (standing, whereabouts, reach, want, fear, nocturnal). The profiles are cached until the lore text changes.
- **The player's controls are side events** (`arc set`, `arc new … | by: player`) anchored like corrections. Per-person flags live in the chat's config.
- **Not built:** premises aren't checked with the reply check's passage search (`supportOf`); the validator checks their names and words instead.

### Since 1.15.1

A report from the Buffy chat: two stories written on the page never moved, and the one step told was nonsense. The replay of that afternoon (Day 4, messages 270–290) changed these:
- **A player's story starts pushed** (`push: yes`): its first step comes at once, in a step of its own. With telling on, one small call first shapes the premise into a kind, a want, a fear, a cast and a secrecy (`shapePrompt`, `validateShape`). Without it, `kindForStory` reads the kind for what the lead does: words after "about" or "how" are the topic, and a decline or a grief belongs to the person named nearest before it.
- **Nudge is a push.** A pushed step happens even out of the lead's hours, at −1, and the card tells the model so. A held step writes its reason (`wait:`), and the page shows it with the next possible time.
- **A forced step** ("Move the world a step now") counts the whole step for any subplot whose cooldown ends within it. If the dice move nothing, the most overdue subplot that can move does, the player's first.
- **Outcome labels:** a near miss (win told as cost) keeps the model's words. Only the opposite outcome falls back to the template, and the rejected text goes into the tick's log.
- **Cards carry SO FAR** (the last two beats) and the grounds' own words.
- **Carriers** are the lead or someone close to them (a tie of 2 or more). The subplot's target never carries it.
- **Seeding:** the player's stories don't count as the world being busy, and a step seeds one subplot per kind at most.
- **The parser:** every field of an `arc set` line counts, including the first. Before this, bring-ins, fates, premise edits, twist casts and slips were silently dropped.

### Since 1.15.2 (shipped in 1.16.0)

The same chat: Spike's search for Dawn left Gabriel a missed call. Spike has no tie to Gabriel, and Dawn was in the scene. A signal or an entrance was feasible whenever any of the subplot's cast was onstage ("about the stage").
- **`callee`:** a signal needs a listener, either the player (the lead's tie to `user` ≥ 2) or someone onstage the lead is tied to at 2 or more. The arrival keeps `to`, and its text says "for Buffy". The lane holds a call for someone until they're in the scene. A call to the player from a lead with no tie to them (`callFits`, for arrivals made before this) expires, and the page stops listing it.
- **`soughtOf`:** cast named after "find", "search for", "look for", "track down", "rescue" and the like in the want or premise. The one sought never carries the subplot's news or receives its calls. An entrance into a scene they're in needs `found`: an ending met or at a price, a win reaching the crisis, or a bring-in. Ending routes now get the ending's result, not the last beat's. "Back on the page" doesn't credit the one sought with the search.
- **The card's SOUGHT line:** the lead doesn't know where they are. The validator rejects a telling that finds them ("tracked Dawn down", "found Dawn", "learned where Dawn…") before an ending met or at a price. "Found no sign of Dawn" passes.

### 1.16.0: proposals and prose

- **`seeding`** (`settings.elsewhereSeeding`: `ask`, the default · `auto` · `off`). Under `ask`, the tick's seeding loop builds the same candidates but writes no `arc new` line. Each becomes a `Proposal`: the line acceptance will write, its kind, lead, cast, premise, want, fear, secrecy, grounds and `why`, plus `replaces` when a light subplot of the lead would give way. Its seed card still goes to the telling (`card.proposal`, `line: -1`), and the backend writes the model's premise, want and fear into the proposal.
- **Room.** Pending proposals count as live subplots for room and for "is the world busy". The tick skips `proposalKey`s (lead · kind · grounds) the player declined, and leads with a proposal already waiting (`lead:name`).
- **The player's answer.** `accept` writes the line as a player side event with `at: now | push: yes` (plus the light subplot's drop), so it begins at once. `decline` keeps the key in `elsewhere.declined` (the last 100). A pending proposal goes stale when its lead gets a story that isn't light, or after three story days.
- **Specific words.** The telling asks for two short, plain sentences (≤ 50 words, validated at 95): what happened, past tense, naming the actual news, people and places; then where it leaves things, present tense. The prompt's examples come from other stories, so no chat's names leak into another. The card's `ESTABLISHED` line lists up to three recent facts that name the lead. Names match case-sensitively ("Will" isn't "will"). It never lists a fact naming the player's character, an off-page fact, or a secret kept from the lead, and its names are allowed in the telling. Arrivals carry the news (≤ 40 words, validated at 60). Premises name what happened and what the lead means to do (validated at 60 words).
- **The engine's two sentences.** `beatTemplate` writes a move that names the other person (`{cast}`, else the kind's `other`), the town or the want, then the kind's `state` on a win, the price on a cost, or the setback on a loss. Prices and setbacks are clauses. A return begins with the news its lead holds (`news`: the first `#fact` ground, if the lead knows it). The place leads the sentence (`atPlace`), and groups take an article and agree in number (`groupName`). `endTemplate` opens with a kind's conclusion (`END_FIRST`) and puts a lost ending's fear in the past tense (`cameTrue`). Seed premises are sentences (`factionPremise`, `sentence`, `threadLatest`). A thread's premise is its latest news, and placeholder drives ("Unknown — …") fall back to the kind's defaults.
- **Courtship guard.** Courtship words need romance. "court" (a lawsuit) and "date" (a day) are gone. A courtship candidate is dropped if anyone in it reads as a minor (`isMinor`), or if the lead's tie to them is family.
- **Proposal cards** get ids of their own (`p0`, `p1`, …), since they have no line index.

## 20. Subplots bear on each other

Two subplots are **tied** when one of them is about a person the other has in it (the lead of one is in the other). Buffy in two casts is not a tie. Everything is read from the subplots' own beats and endings in [web.ts](../src/core/elsewhere/web.ts); nothing new is stored.

- **What stands.** `settled` reads a step for something taken from a person ("took Willow's magic", "Willow's magic is gone", "stripped Willow of her powers") or given back ("got her magic back"). Intent and near misses ("sent to take away", "stopped short") don't count. The latest word stands for every subplot with that person (`conditionsFor`).
- **Meanwhile.** Each card carries the tied subplots' latest steps (two story days, or their ending) as `MEANWHILE`, and what stands as `STANDS`. A step since this subplot's last one is marked: this step answers it. The telling may name the people in them. A telling where someone uses magic that was taken is set aside (`usesGone`).
- **Pulls.** `aimAt` reads a subplot's want (then premise) for what it does to the other's lead: against ("take away Willow's magic") or for ("help Willow"). A fresh step of a subplot against the lead turns the lead's next roll by how it went (−1 when it went its way); one on their side +1 when it went well. The other way round, a subplot on someone's side gains or loses with that person's own steps. At most ±1 in all, inside the usual ±2.
- **Endings shake.** When a subplot ends, each running subplot tied to it that hasn't moved this tick gets `next` pulled to 30–120 minutes later and heat +1.
- **Engine words.** A decline whose means were taken becomes the want of them ("Willow went looking for a way to get the magic back"); any other subplot about the thing begins "With Willow's magic gone, …".
- **Twists.** "Two arcs collide" also draws on tied subplots.
- **The page.** Each live subplot card shows "Tied to": what stands, each tied subplot (which way it pulls, its latest step, its effect on the next roll).

Replay of 6170f171: Valeria's duty ended at 6434 with Willow's magic taken. Willow's decline (steps at 6481 and 6786) and Tara's decline then carried on as if nothing had happened. With ties, both cards carry "Willow's magic is gone" (marked new on the first step after it) and the stripping as MEANWHILE. Willow's next roll would have been −1 from Valeria's duty while the stripping was under way. Tara's next roll is −1 from Willow's own setbacks.

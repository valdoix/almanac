# 07 · Knowledge: facts, witnesses, secrets and gaps

The knowledge system answers one question every turn: **who has what information, and how did it reach them?** It exists for two jobs. It stops a character from acting on something they never learned (a leak). It also stops a character from being told what they already know (re-telling news). Everything below serves those two jobs.

## 1. What went wrong (1.5.0)

Replaying a real 72-message chat through the 1.5 engine gave 42 "facts". The Knowledge page and the model's note were wrong in ways that fed each other:

| Symptom | Cause |
|---|---|
| `"Gabriel's name-voice · necklace weight against hip · hasn't asked what any of this costs"`, known by Buffy only | The model used `know` as a diary of what one person noticed. Three unrelated things on one line became one "fact". |
| Valeria heard Gabriel say "Gabe-o" but isn't credited | Only the person named on the line was credited. The "said aloud" check read the *how* text, which the model rarely fills in. |
| "Doesn't know yet: **Gabriel Winters**", on his own nickname | Nobody was credited as the one who *said* something. |
| The note told the model the fact was "news to Gabriel, Ruth, Valeria" | "Doesn't know" meant "no record". A missing record became a claim of ignorance, sent to the model as fact. |
| Ruth (a cat) and "Osiris forces" listed as not knowing | Anyone in the cast counted as someone who could know things. |
| "DOES NOT KNOW: who raised her, Heaven, …" lost | The most useful thing the model wrote was stored as a free-text note, and its items were read as people. |
| `#unpaid-price-peace` renamed to "has NOT said Heaven aloud" | Loose word-matching merged different facts, and the shorter wording replaced the statement. |
| Every reply repeated the bad shape | The latest ledger stays in the prompt as the model's example, so the model copied it. |

## 2. Principles

1. **Track information, not perception.** A fact is worth a line when knowing it or not would change what someone says or does: identities, secrets, confessions, lies, deductions, wrong beliefs, plans, news. What someone saw or felt in the moment belongs to the prose.
2. **Knowledge travels by events, and the engine does the spreading.** The model says what came out and how. The engine works out who was there to receive it, using the cast, and credits whoever said it.
3. **No record is not "doesn't know".** Each person on each fact is in one of three states: *has it* (a route is recorded), *lacks it* (there is evidence), or *unrecorded*. Only the first two ever reach the model.
4. **Lacking needs evidence.** There are four kinds: it is kept from them (a secret), they weren't there when it came out, the story said so, or it's one of their recorded gaps.
5. **Only people know things.** Knowers are the player, anyone who has spoken or been named on a knowledge line, and anyone who has just entered a scene. Someone in four or more replies without a word is a pet, a force or a thing. Models give cats thoughts in the register, so a thought doesn't count. A name that only appears in a debt or item line was never in a scene. Anyone asleep hears nothing.
6. **The model copies what it sees.** The lines the model sees from earlier turns are rewritten into clean form, so it learns the right shape from its own history.
7. **The note guards; it doesn't narrate.** Something one person noticed, with no one known to lack it, guards nothing and never reaches the model. Something everyone present shares reaches it only when the player brings it up, as "don't explain it again".

## 3. The ledger language

Four line shapes. One fact per line, in a few plain words, with a `#key` the note shows so later lines can refer back.

```
reveal #locket: {{user}} took the locket | Joss → Mara, whispered · true
know Kael: #locket | overheard half at the bar · suspects
secret #locket: {{user}} took the locket | kept by Mara · from Kael
unaware Mara: who hired Joss
```

| Line | Means | The engine does |
|---|---|---|
| `reveal #key: fact \| Source → listeners, how` | It came out in the scene: said, shown or written | Credits the source ("said it") and every listener. **aloud** (the default) or **shown** reaches everyone present who can hear. **whispered**, **private**, **letter** and **told** reach only the listeners named. Records the moment, so anyone absent is known to have missed it. |
| `know Name: #key fact \| how · status · truth` | One person's own stance: a deduction, a guess, a wrong belief, news that reached them off-screen | Files the stance. If the how or the words point to speech in this scene, it's treated as a reveal. |
| `secret #key: fact \| kept by A · from B, C` | Someone is hiding it | Keepers have it. B and C lack it (kept from them) until a route reaches them. |
| `unaware Name: thing · thing` | Gaps: what they don't know | A gap that matches a tracked fact marks that person as lacking it. Anything else is kept as a gap and closes when they learn something that matches. |

Statuses: knows · believes · suspects · doubts · wrong · unaware. Truth: true · false · partial.

**Tolerance.** Models drift, so the old shapes still work:

- `know Buffy: A (heard) · B (told by Valeria) · does NOT know X, Y` becomes two stances with their routes, plus two gaps.
- Brackets are split: route words like `(heard)`, `(told by X)`, `(deduced)` or `(sensory)` become the route. Noise like `(this beat)` or `(no new info)` is dropped. Anything else, like `(Gabe-o)`, stays in the fact.
- `— all this beat`, `Cumulative: …` and `(per existing record)` are dropped.
- A `DOES NOT KNOW:` list of people means those people lack this fact. A list of things becomes the holder's gaps.

## 4. The engine

**Stances.** A line written for a person always sets their stance. Stances the engine works out only fill empty places or clear an "unaware". They never overwrite a suspicion, a belief or a wrong belief, so a doubter stays a doubter until a line says otherwise.

**Sources.** A fact that opens with a person's name and a speech or action verb has that person as its source. "Gabriel calls himself Gabe-o" and "Buffy said no" are examples. The source always has the fact. A line with no subject ("said 'I can't go home'", "gave Gabriel a partial truth") is the holder's own words. Facts about identity are not guessed this way ("Gabriel is the Chosen One" may be news to Gabriel). A teller named in the route or the evidence ("told by Valeria", "Valeria named it") has it too.

**Witnesses.** When a fact comes out in the open, every listener present gets it (route *heard it said* / *saw it*). It comes out in the open when:
- it's a public reveal, or
- the line's words match something spoken this turn or in the player's message before it, or
- the route says so: *aloud*, *in front of*, *to everyone*, or said *this beat*.

A match means, in this order: a quoted phrase or a distinctive hyphenated word ("Gabe-o"), then three or more of the line's content words in one spoken line. The earliest speaker is the source. Speech is attributed by its `[spk]` mark; in the player's message, to the last person named before the quote, otherwise to the player's character. A bare "told" or "heard" doesn't place it in this scene, so only the teller is credited. "Told Giles" in the holder's own line is a private telling to Giles.

**Missed it.** Each time a fact comes out, the engine records who was there, and who was in the room but outside a private telling. Someone already in the story who had no stance "wasn't there when it came out". So does anyone who walked into that same scene afterwards: an arrival hears nothing said before. Someone introduced in a later scene gets no claim, because they may have known all along.

**Secrets.** A secret has keepers and people it's kept from. Someone it's kept from lacks it until a route reaches them. Hearing it said aloud counts: the secret is out for them. Three things make a secret without a `secret` line:
- *unspoken*, *narrator-only* or *won't say* in a line's route or evidence: kept from everyone present who doesn't have it.
- "has not said Heaven to Valeria" or "still has not named Willow": attaches to the tracked fact those words name ("Buffy was in Heaven"), kept from the one named, or from everyone present.

**Gaps.** Per person, a list of things they don't know. Restating a gap refreshes it. A gap closes when they learn a fact that matches it, or when it only named people they've since been in a room with. A gap that names most of a tracked fact someone else has ("Heaven" names "Buffy was in Heaven") becomes a stance: they lack that fact. The note shows a gap only when the player's message touches it.

**Merging.** A `#key` always wins. Lines without a key join a fact only on a strong wording match (measured over the longer wording, lightly stemmed). A holder restating their own line, grown or trimmed, joins their earlier fact. When trimmed, the cleaner wording wins, and an automatic key follows its new wording. A fact's wording otherwise changes only when a line with the same key gives a cleaner version.

**Kinds**, worked out when shown and never stored:

| Kind | When |
|---|---|
| secret | kept from someone, or someone lacks it with evidence while someone else has it |
| belief | someone suspects, believes, doubts or is wrong; or it's false or partly true |
| shared | two or more people have it |
| noted | one person has it and there are no other claims (a passing observation) |

## 5. The knowledge clerk (optional, most accurate)

After a reply, a quiet call reads it and rewrites its knowledge lines cleanly. It sees the player's message, the prose with speakers named, the thoughts in the register, the facts already tracked (with keys), who is present, and the lines the writer wrote. Its lines replace that reply's `know`, `reveal`, `secret` and `unaware` lines. They're stored with the message and swipe, so swipes and branches stay correct. It never gives the player's character a belief or a thought in sealed mode.

- **Off**: never runs.
- **When needed** (the default): runs when the reply's lines needed repair (bundled items, a DOES NOT KNOW tail, no key and no match, a diary-like line). Also runs when there are no knowledge lines but the reply has a thought in the register.
- **Every reply**: always runs.

**Tidy the whole chat** on the Knowledge page reads every reply the clerk has not read yet, in its current text, oldest first, so each reply sees the keys the earlier ones settled. The button shows how many replies are left and has a Stop button; tidying again carries on where it stopped, and an edited reply counts as unread again. If the call itself fails twice in a row (no connection or no permission), it stops and says why. In the default mode, a reply whose lines were already clean is marked as checked, so it never counts as unread.

The turn planner waits up to 8 s for a clerk pass still running on the latest reply, so the next note is built from the clean version.

## 6. What the model is told

The `[KNOWLEDGE]` lane of the `<ledger-note>` lists up to five facts in play, ranked by what a slip would cost. Risk is highest when someone present has a fact someone else present lacks (with evidence), or when someone present is wrong. Next: a keeper is present, the player is talking about it, it's recent. Replaying the Buffy chat, the note stays empty for the first 48 replies, apart from the odd gap. From Valeria's arrival on, it carries exactly the three secrets of the story:

```
[KNOWLEDGE] Only what the story recorded: a person not named on a fact is unrecorded, not ignorant. Never let anyone act on a fact they lack.
  #buffy-heaven "Buffy was in Heaven" — Buffy keeps it; Gabriel Winters worked it out; Valeria doesn't know (kept from them).
  #willow "it was Willow" — Buffy suspects it; Gabriel Winters doesn't know (kept from them); Valeria doesn't know (kept from them).
  #slayer-signature-timing "Slayer signature + timing = Gabriel Called at Buffy's death" — Valeria worked it out; Buffy doesn't know (kept from them); Gabriel Winters doesn't know (kept from them).
  (Something comes out: reveal #key. A guess or wrong belief: know. A hidden fact: secret. Reuse the #key.)
```

When the player says "Gabe-o" again: `#gabriel-name-voice "Gabriel's name-voice (Gabe-o)" — Buffy, Gabriel Winters and Valeria all have it: don't explain it again.`

"Doesn't know" only appears with its evidence. The drawer's table follows the same rules: ✓ has it (and how) · ? suspects/believes · ✗ wrong · — lacks it (with the reason) · a blank `·` for no record. It lists the facts the note picked, then what this reply filed, then recent secrets and beliefs.

## 7. The Knowledge page

- Filters: **In play** (secrets and beliefs), **Shared**, **Noted**, **All**, plus a person picker.
- With a person picked, the page shows what they have, suspect and are wrong about, what they lack and why, and their gaps.
- Each card: #key, the fact, truth, kind, who has it and how (said it · heard it · lived it · told by X · deduced), who lacks it and why, and who keeps it from whom. The history of how it came out is folded.
- **edit**: rename, truth, merge, and **who knows it**: one choice per person (as the story says · knows · believes · suspects · doubts · has it wrong · doesn't know · no record either way). Stored in `factEdits[key].people` and applied after every message, so a later line never undoes it; "no record" also switches off the "wasn't there" inference for that person.
- **delete** on the card (click twice). Deleted facts are listed at the bottom with **restore**.
- **+ Add a fact**: a statement, its truth and who knows it. Stored as `factEdits[key]` with `added` (the message it joins at).
- **Tidy the whole chat** runs the clerk over every reply it has not read yet (one call each), with progress and a Stop button.

### "Wasn't there when it came out" needs news

Being away when something is said only counts as not knowing it when it was news then: the teller found it out in the story first (read it, worked it out, was told), or it's something that happened in the story (an offer, a joke, a fight). Gabriel telling Buffy he's a Slayer says nothing about whether Walter, his Watcher, knows, so Walter is left blank.

### Clerk lines are read as one fact

The clerk often writes `fact · heard Valeria · knows · true` with no `|`. The trailing stance, truth and how are read as the line's meta, not as more facts, and a clerk line is always one fact ("…; she accepted" stays in it). Stored clerk lines are read again from their raw text on every fold, so a better reader fixes old tidies. A fact written whole in quotes is the fact, unquoted; a short quoted phrase ("Gabe-o") is still words said.

## 8. Compatibility

- The engine folds the whole chat from the transcript on load, so old chats are re-read under the new rules with no migration.
- The `know` op keeps its syntax. `reveal`, `secret` and `unaware` are new. Their aliases are `tell` / `told` / `reveals`, `secrets` / `hidden`, and `lacks`. Side events stored by older versions carry the old single-fact `know` shape and are read again from their raw line.
- `FactState` gains `out` (the moments it came out), `keepers` and `keptFrom`. `FactStance` gains `route` and `from`, and `derived` becomes a reason. `WorldState` gains `gaps`, `speech`, `speechSince`, `lastReply`, `knowCanon` and `knowRepair`. `CharacterState` gains `voiced`, `arrivedMsg` and `castSeen`. Side events gain `replacesOps` and `hash`.

## 9. Code map

| File | What |
|---|---|
| `src/core/knowparse.ts` | Reading `know` / `reveal` / `secret` / `unaware` lines tolerantly |
| `src/core/facts.ts` | The engine: filing, sources, witnesses, secrets, gaps, who lacks what, what's in play |
| `src/core/state.ts` | Hands each line to the engine with the scene (who can hear, what was said), and keeps the filed lines |
| `src/core/note.ts` | The `[KNOWLEDGE]` lane |
| `src/core/clerk.ts`, `src/backend/clerk.ts` | The clerk's prompt and runner |
| `src/backend/hooks.ts` | Rewrites old knowledge lines in the prompt |
| `tests/facts.test.ts` | The Gabe-o scene, secrets, gaps, arrivals, merging, the clerk |

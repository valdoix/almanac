// Sample chat content used by the preset harness and the golden tests.

export const SAMPLE_USER = `I set the locket on the table between us. "It was never mine to keep," I say, and wait.`;

export const OPENING = `🗓️ Day 3 · Tuesday, 14 October 1923 🕰️ 21:28 🌧️ rain, moderate · 9°C · wind SW
📍 Lowmarket › The Rusty Flagon › back room
# Salt in the Wound

The back room smelled of wet wool and lamp oil.

[spk=Mara#2]"You came back."[/spk] She didn't look up from the fire.

<ledger>
cast: Mara@spot(by the fire) · Kael@peri(at the bar) · Joss@peri(by the door)
mood Mara: guarded | V-1 A2 D1
body Mara: soaked; fatigue 2
item Locket: +Wren
mode: social
</ledger>`;

export const SAMPLE_REPLY = `🗓️ Day 3 · Tuesday, 14 October 1923 🕰️ 21:40 🌧️ rain, heavy · 9°C · wind SW
📍 Lowmarket › The Rusty Flagon › back room
# Salt in the Wound

Rain hammered the shutters hard enough to rattle the latch. The locket lay between them, its clasp still bent where someone had forced it.

[spk=Mara#2|whisper]"You gave it back."[/spk] Her thumb found the clasp and stayed there.

At the bar, Kael went on drying the same glass. [spk=Kael#5|cold]"Thieves don't give things back,"[/spk] he said, to no one in particular.

[spk=Mara#2|shout]"Then maybe he isn't one!"[/spk] The words cracked off the low beams, and Joss flinched by the door.

[spk=Joss#3]"I'll just— the cart."[/spk]

[thk=Kael#5]She never shouts for me.[/thk]

A card was pinned above the hearth, the ink run by damp: [txt=sign]NO CREDIT · NO KNIVES[/txt]

[vtk=letter|To the Harbourmaster|sealed · red wax · Day 2]
Sir —
The cargo was never ours to sell. [redacted] knows where it went.
[stamp=URGENT]
[sig=E. Vance]
[/vtk]

[vtk=phone|Joss|22:01]
» Tam: where r u
« still at the flagon
» Tam: bring the cart round back
[/vtk]

<unspoken>
<t who="Mara#2" cue="her thumb keeps finding the locket's clasp">He gave it back. Why would a thief give it back?</t>
<t who="Kael#5" cue="he's wiping the same glass">She laughed with him. She never laughs for me.</t>
</unspoken>

<plan>
ROUTE — scene; charged: lies in play, three speakers.
ANCHOR — Day 3 21:28 → 21:40; heavy rain; back room; Mara spot, Kael/Joss peri.
SEAL — SAID: "never mine to keep". DID: set locket down. Stop before Wren answers.
MINDS — Mara: wants the truth · fears being played · guarded → wary-curious.
MOVE — (b) Kael needles; Mara defends Wren and surprises herself.
PREMORTEM — B, a bit static. Risk: Kael softening. Keep him cold.
LEDGER — clock, wx, mood, bonds, know, item, thread.
</plan>

<ledger>
clock: +12m
wx: rain → heavy rain
cast: Mara@spot(by the fire) · Kael@peri(at the bar) · Joss@left(→ the yard)
mood Mara: guarded → wary-curious | V-1 A3 D0
bond Mara>Wren: trust +1 — he gave the locket back
bond Kael>Mara: resent +1 — she defended Wren
know Kael: Wren stole the locket | overheard half · suspects · false
item Locket: Wren → Mara — set it on the table for her
thread Lost locket: new — Mara owes Wren a favour
artifact To the Harbourmaster: letter — Mara
keys Mara: locket, harbourmaster, favour
mode: conflict
</ledger>`;

/** How an extension-rendered reply might look before display regex (built live by the harness). */
export const LINKED_REPLY = SAMPLE_REPLY;

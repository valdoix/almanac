// Speaker marks for lines the model left bare. Some models drop the [spk] marks for whole
// stretches of a reply, so the page draws no voice cards. After the reply, a quiet call says
// who spoke each bare line (the backend's speakers.ts); these helpers find the lines, build
// the ask, read the answer and wrap the lines, changing nothing else in the text.

import { SAFETY_DATA } from "./prompts";

export interface BareLine {
  start: number;
  end: number;
  text: string;
}

export interface Voice {
  name: string;
  slot?: number;
  aliases?: string[];
  isUser?: boolean;
}

const QUOTE = /["“][^"“”\n]{1,1200}["”]/g;

/** Where the text is not story prose: marks, thoughts, texts, voicemails, ledgers and other tagged blocks, headers, OOC. */
function closedRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const add = (re: RegExp) => {
    for (const m of text.matchAll(re)) out.push([m.index!, m.index! + m[0].length]);
  };
  add(/\[(spk|thk)=[^\]\n]*\][\s\S]*?(?:\[\/\1\]|(?=\[(?:spk|thk)=)|(?=\n[ \t]*\n)|$)/g);
  add(/\[(vtk|txt|sig)(?:=[^\]]*)?\][\s\S]*?(?:\[\/\1\]|(?=\n[ \t]*\n)|$)/gi);
  add(/<([a-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/gi);
  add(/<[^>\n]+>/g);
  add(/^[ \t]*(?:\*\*)?(?:🗓|📍|#)[^\n]*$/gmu);
  add(/\(\([\s\S]*?\)\)|\[OOC[^\]]*\]/gi);
  return out;
}

/** Spoken lines in double quotes outside every mark and tagged block, in order. */
export function bareLines(text: string): BareLine[] {
  const closed = closedRanges(text);
  const out: BareLine[] = [];
  for (const m of text.matchAll(QUOTE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (closed.some(([a, b]) => start < b && end > a)) continue;
    // A word or two in quotes inside a sentence is a title or a scare quote, not a line.
    const words = m[0].slice(1, -1).trim();
    const lead = text.slice(Math.max(0, start - 2), start);
    if (!/[.!?—…,-]/.test(words) && words.split(/\s+/).length <= 3 && /\p{L}\s$/u.test(lead) && !/\n/.test(lead)) continue;
    out.push({ start, end, text: m[0] });
  }
  return out;
}

export function speakerPrompt(opts: { text: string; lines: BareLine[]; voices: Voice[]; userName: string }): { system: string; user: string } {
  let marked = "";
  let at = 0;
  opts.lines.forEach((l, i) => {
    marked += opts.text.slice(at, l.start) + `⟦${i + 1}⟧`;
    at = l.start;
  });
  marked += opts.text.slice(at);
  marked = marked.replace(/<(ledger|unspoken|plan|think|thinking|folio)\b[^>]*>[\s\S]*?(<\/\1>|$)/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  const people = opts.voices.map((v) => `${v.name}${v.aliases?.length ? ` (also ${v.aliases.slice(0, 3).join(", ")})` : ""}${v.isUser ? " — the player's character" : ""}`).join("; ");
  return {
    system: `You read a scene from a story and say who speaks each numbered line of dialogue. ${SAFETY_DATA}
Each line to attribute is marked ⟦n⟧ just before its opening quote. Lines already wrapped as [spk=Name#N]"…"[/spk] show who said them; use them, the narration around each line ("she says", "Dawn points her fork"), and the flow of the conversation (who is answering whom, who is addressed by name, what each person would say). A line that continues an earlier line by the same speaker, split by narration, is theirs too.
Answer one line per number, nothing else:
n: Name — the person who says it aloud, named as in the list
n: ? — when you can't tell who says it
n: - — when it isn't someone speaking aloud in this scene (a sign, a title, a text message, words remembered from before, a word quoted in narration)
People: ${people || "(none listed)"}. The player is ${opts.userName}.`,
    user: `<story>\n${marked}\n</story>`,
  };
}

/** The answer: line number → a name, or null for "?" and "-". */
export function parseSpeakerAnswer(text: string, count: number): (string | null)[] {
  const out: (string | null)[] = Array(count).fill(null);
  for (const raw of text.split("\n")) {
    const m = /^\s*[-*•]?\s*⟦?(\d{1,3})⟧?\s*[:.)—-]\s*(.+?)\s*$/.exec(raw);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > count) continue;
    const who = m[2].replace(/^[*_"]+|[*_"]+$/g, "").replace(/\s*[(—].*$/, "").trim();
    out[n - 1] = !who || /^[?-]$|^(?:unknown|unclear|none|n\/a)$/i.test(who) ? null : who;
  }
  return out;
}

function findVoice(voices: Voice[], name: string): Voice | undefined {
  const k = name.toLowerCase();
  return voices.find((v) => v.name.toLowerCase() === k || v.aliases?.some((a) => a.toLowerCase() === k))
    ?? voices.find((v) => v.name.toLowerCase().split(/\s+/)[0] === k.split(/\s+/)[0]);
}

/**
 * Wraps the attributed lines. The mark's name and voice number follow the reply's own marks
 * for that person (Buffy#1), else the roster's. A name nobody in the roster or the reply has is
 * left alone. Returns the text unchanged when nothing was attributed.
 */
export function applySpeakers(text: string, lines: BareLine[], answer: (string | null)[], voices: Voice[]): string {
  const used = new Map<string, string>();
  for (const m of text.matchAll(/\[spk=([^\]#|\n]{1,60}?)\s*#(\d{1,2})/g)) {
    const v = findVoice(voices, m[1].trim());
    const key = (v?.name ?? m[1].trim()).toLowerCase();
    if (!used.has(key)) used.set(key, `${m[1].trim()}#${m[2]}`);
  }
  let out = text;
  for (let i = lines.length - 1; i >= 0; i--) {
    const who = answer[i];
    if (!who) continue;
    const v = findVoice(voices, who);
    const label = used.get((v?.name ?? who).toLowerCase()) ?? (v ? `${v.name.split(/\s+/)[0]}${v.slot != null ? `#${v.slot}` : ""}` : undefined);
    if (!label) continue;
    const l = lines[i];
    out = `${out.slice(0, l.start)}[spk=${label}]${l.text}[/spk]${out.slice(l.end)}`;
  }
  if (out === text) return text;
  // The reply's own marks that left out the voice number ([spk=Dawn]) take it, so their colour matches.
  return out.replace(/\[spk=([^\]#|\n]{1,60}?)(\s*\|[^\]\n]*)?\]/g, (m, name: string, tone: string | undefined) => {
    const v = findVoice(voices, name.trim());
    const label = used.get((v?.name ?? name.trim()).toLowerCase());
    const slot = label ? label.split("#")[1] : v?.slot;
    return slot != null && name.trim() !== "?" ? `[spk=${name.trim()}#${slot}${tone ?? ""}]` : m;
  });
}

/** The text with speaker marks taken out, to prove a rewrite only added marks. */
export function withoutSpeakerMarks(text: string): string {
  return text.replace(/\[spk=[^\]\n]*\]|\[\/spk\]/g, "");
}

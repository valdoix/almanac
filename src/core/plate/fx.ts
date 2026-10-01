// Scene accents (one per plate, picked from the hour band, weather and a seed
// taken from the title and the hour) and genre atmospheres. Each is a CSS chunk
// scoped to its data attribute; the regex emits only the chosen ones.
import { Layer, rng, birds, bats, balloon, cornerBranch, floatingIsle, svgUrl } from "./art";

const flock = (seed: number, count: number) => { const l = new Layer(); birds(l, rng(seed), count, 150, 44); return l.url(150, 44); };
const batFlock = (seed: number) => { const l = new Layer(); bats(l, rng(seed), 6, 150, 50); return l.url(150, 50); };
const balloonUrl = (() => { const l = new Layer(); balloon(l, 20, 18, 1); return l.url(40, 40); })();
const bolt = svgUrl(`<path fill='none' stroke='#000' stroke-width='3' stroke-linejoin='round' d='M40 0L30 40L44 46L26 92L36 98L20 140M30 40L14 62M44 46L58 74M26 92L10 108'/>`, 70, 140, true);
const branch = cornerBranch(new Layer(), rng(41)).url(220, 110);
const isle = (() => { const l = new Layer(); floatingIsle(l, rng(5), 60, 24, 100); return l.url(120, 100); })();

/** Particles: n radial dots spread over a tile. */
function dots(seed: number, n: number, color: string, size: [number, number], tw = 100, th = 100) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const s = size[0] + (size[1] - size[0]) * r();
    return `radial-gradient(${s.toFixed(1)}px ${s.toFixed(1)}px at ${(r() * tw).toFixed(0)}% ${(r() * th).toFixed(0)}%,${color},transparent)`;
  }).join(",");
}

const MOTION = (rules: string) => `@media (prefers-reduced-motion:no-preference){${rules}}`;
/** A seamless background scroll over whole tiles: name, tile size, tiles moved per loop (x, y). */
const scroll = (name: string, w: number, h: number, tx: number, ty: number) => `@keyframes ${name}{to{background-position:${w * tx}px ${h * ty}px}}`;

export const FX: Record<string, string> = {
  birds: `&.p .fx,&.p .fx2{inset:auto;top:16%;left:-30%;width:150px;height:44px;-webkit-mask:${flock(3, 9)} 0 0/100% 100%;mask:${flock(3, 9)} 0 0/100% 100%;background:color-mix(in oklab,var(--N),#000 25%);opacity:.8}&.p .fx{left:22%}&.p .fx2{top:26%;left:56%;width:90px;height:26px;-webkit-mask-image:${flock(9, 5)};mask-image:${flock(9, 5)};opacity:.55}` + MOTION(`&.p .fx{animation:fly 58s linear infinite,bob 3s ease-in-out infinite alternate}&.p .fx2{animation:fly 80s linear -30s infinite,bob 2.4s ease-in-out infinite alternate}`),
  bats: `&.p .fx{inset:auto;top:20%;left:30%;width:150px;height:50px;-webkit-mask:${batFlock(4)} 0 0/100% 100%;mask:${batFlock(4)} 0 0/100% 100%;background:#0d0a14;opacity:.85}` + MOTION(`&.p .fx{animation:fly 30s linear infinite,flit .5s steps(2) infinite}`),
  shoot: `&.p .fx,&.p .fx2{inset:auto;top:14%;left:62%;width:150px;height:1.5px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95));transform:rotate(-24deg);opacity:.85}&.p .fx2{top:24%;left:22%;width:90px;transform:rotate(-30deg);opacity:.5}` + MOTION(`&.p .fx{opacity:0;animation:shoot 9s ease-in infinite}&.p .fx2{opacity:0;animation:shoot 13s ease-in -5s infinite}`),
  aurora: `&.p .fx,&.p .fx2{inset:-6% -20% 34% -20%;background:repeating-linear-gradient(90deg,transparent 0 5px,rgba(120,255,190,.18) 5px 7px,transparent 7px 13px),linear-gradient(180deg,transparent 4%,rgba(90,255,170,.5) 46%,rgba(70,200,255,.32) 66%,transparent 86%);-webkit-mask:radial-gradient(60% 46% at 50% 56%,#000 40%,transparent 72%);mask:radial-gradient(60% 46% at 50% 56%,#000 40%,transparent 72%);filter:blur(5px);mix-blend-mode:screen;transform:skewX(-14deg)}&.p .fx2{inset:-12% -10% 46% 10%;background:linear-gradient(180deg,transparent 10%,rgba(200,110,255,.45) 50%,rgba(255,90,170,.22) 70%,transparent 90%);transform:skewX(18deg)}` + MOTION(`&.p .fx{animation:aur 14s ease-in-out infinite alternate}&.p .fx2{animation:aur 19s ease-in-out -6s infinite alternate-reverse}`),
  milky: `&.p .fx{inset:-30%;transform:rotate(-28deg);background:linear-gradient(90deg,transparent 36%,rgba(190,180,255,.12) 44%,rgba(255,236,220,.22) 50%,rgba(190,180,255,.12) 56%,transparent 64%);filter:blur(3px)}&.p .fx2{inset:-30%;transform:rotate(-28deg);background:${dots(11, 26, "#fff", [0.6, 1.2])};background-size:90px 70px;-webkit-mask:linear-gradient(90deg,transparent 40%,#000 50%,transparent 60%);mask:linear-gradient(90deg,transparent 40%,#000 50%,transparent 60%);opacity:.9}`,
  comet: `&.p .fx{inset:auto;top:16%;left:18%;width:220px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,rgba(170,215,255,.55) 70%,#fff);transform:rotate(-14deg);filter:blur(.6px)}&.p .fx:after{content:"";position:absolute;right:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 14px 6px rgba(190,225,255,.8)}&.p .fx2{inset:auto;top:calc(16% - 10px);left:18%;width:200px;height:24px;transform:rotate(-11deg);background:linear-gradient(90deg,transparent,rgba(150,190,255,.18));filter:blur(6px);border-radius:50%}`,
  fireflies: `&.p .fx,&.p .fx2{inset:auto 0 0 0;height:56%;background:${dots(21, 14, "#efff9a", [1.4, 2.6])};filter:drop-shadow(0 0 3px #d6ff6a)}&.p .fx2{background:${dots(22, 12, "#fff4a0", [1.2, 2.2])}}` + MOTION(`&.p .fx{animation:blink 2.6s ease-in-out infinite alternate,driftup 22s ease-in-out infinite alternate}&.p .fx2{animation:blink 3.4s ease-in-out -1s infinite alternate,driftup 30s ease-in-out infinite alternate-reverse}`),
  lanterns: `&.p .fx,&.p .fx2{inset:0;background:${dots(31, 6, "rgba(255,190,110,.95)", [2, 3.4])};background-size:220px 200px;filter:drop-shadow(0 0 4px rgba(255,150,60,.9))}&.p .fx2{background:${dots(32, 3, "rgba(255,170,90,.95)", [3.5, 5.5])};background-size:300px 260px;opacity:.9}` + scroll("lan1", 220, 200, 0, -2) + scroll("lan2", 300, 260, 0, -2) + MOTION(`&.p .fx{animation:lan1 70s linear infinite}&.p .fx2{animation:lan2 50s linear infinite}`),
  godrays: `&.p .fx{inset:-30% -10% 18% -10%;background:repeating-conic-gradient(from 168deg at var(--sx) 0%,rgba(255,244,214,.2) 0 2.5deg,transparent 2.5deg 8deg);-webkit-mask:linear-gradient(180deg,#000 10%,transparent 90%);mask:linear-gradient(180deg,#000 10%,transparent 90%);mix-blend-mode:screen}` + MOTION(`&.p .fx{animation:breathe 9s ease-in-out infinite alternate}`),
  balloon: `&.p .fx,&.p .fx2{inset:auto;top:20%;left:66%;width:34px;height:34px;-webkit-mask:${balloonUrl} 0 0/100% 100%;mask:${balloonUrl} 0 0/100% 100%;background:repeating-linear-gradient(90deg,#d9493a 0 5px,#f4c64e 5px 10px,#3a8fd9 10px 15px);box-shadow:inset -8px -6px 0 rgba(0,0,0,.25)}&.p .fx2{top:32%;left:24%;width:22px;height:22px;background:repeating-linear-gradient(90deg,#3fae7a 0 4px,#f2efe6 4px 8px);opacity:.85}` + MOTION(`&.p .fx{animation:balloon 40s ease-in-out infinite alternate}&.p .fx2{animation:balloon 52s ease-in-out -12s infinite alternate-reverse}`),
  cirrus: `&.p .fx{inset:4% -20% 52% -20%;background:radial-gradient(48% 7% at 26% 32%,color-mix(in oklab,#fff 70%,var(--s3)),transparent 70%),radial-gradient(40% 5% at 60% 50%,color-mix(in oklab,#fff 60%,var(--s3)),transparent 70%),radial-gradient(36% 6% at 80% 24%,color-mix(in oklab,#fff 60%,var(--s3)),transparent 70%),radial-gradient(30% 4% at 44% 70%,color-mix(in oklab,#fff 50%,var(--s3)),transparent 70%);filter:blur(1.5px);transform:rotate(-5deg);opacity:.75}` + MOTION(`&.p .fx{animation:drift 120s linear infinite alternate}`),
  season: `&.p .fx,&.p .fx2{inset:-12% 0 0 0;background-size:170px 150px}&.p[data-season=spring] .fx,&.p[data-season=spring] .fx2{background-image:${dots(41, 7, "#ffc4d8", [2, 3.4])}}&.p[data-season=summer] .fx,&.p[data-season=summer] .fx2{background-image:${dots(42, 7, "rgba(255,240,170,.85)", [1, 2])}}&.p[data-season=autumn] .fx,&.p[data-season=autumn] .fx2{background-image:${dots(43, 6, "#e0762a", [2.4, 3.6])},${dots(44, 4, "#c9452a", [2, 3])}}&.p:is([data-season=winter],[data-season=\"\"]) .fx,&.p:is([data-season=winter],[data-season=\"\"]) .fx2{background-image:${dots(45, 8, "#fff", [1.2, 2.2])}}&.p .fx2{background-size:240px 210px;filter:blur(.7px);opacity:.8}` + scroll("pet1", 170, 150, 1, 2) + scroll("pet2", 240, 210, 1, 2) + MOTION(`&.p .fx{animation:pet1 16s linear infinite}&.p .fx2{animation:pet2 22s linear infinite}`),
  mist: `&.p .fx,&.p .fx2{inset:auto -20% 18% -20%;height:24%;background:radial-gradient(40% 50% at 30% 50%,rgba(240,244,250,.55),transparent 70%),radial-gradient(40% 40% at 72% 60%,rgba(240,244,250,.45),transparent 70%);filter:blur(6px)}&.p .fx2{bottom:30%;height:16%;opacity:.6}` + MOTION(`&.p .fx{animation:drift 50s ease-in-out infinite alternate}&.p .fx2{animation:drift 70s ease-in-out infinite alternate-reverse}`),
  venus: `&.p .fx{inset:auto;top:30%;left:calc(100% - var(--sx) * .8);width:4px;height:4px;border-radius:50%;background:#fffbe8;box-shadow:0 0 8px 3px rgba(255,250,220,.8)}&.p .fx2{inset:auto;top:20%;left:calc(92% - var(--sx) * .7);width:18px;height:18px;border-radius:50%;box-shadow:inset -4px 2px 0 0 #fdf3d6;opacity:.9;transform:rotate(-30deg)}` + MOTION(`&.p .fx{animation:twinkle 4s ease-in-out infinite alternate}`),
  bolt: `&.p .fx{inset:0 auto 26% calc(30% + var(--ox) * .03);width:70px;-webkit-mask:${bolt} 0 0/100% 100%;mask:${bolt} 0 0/100% 100%;background:#f4f7ff;opacity:0}&.p .fx2{inset:0;background:radial-gradient(30% 40% at 34% 20%,rgba(200,215,255,.5),transparent 70%);opacity:0}` + MOTION(`&.p :is(.fx,.fx2){animation:flash 7s ease-out infinite}`),
  rainbow: `&.p .fx{inset:auto;left:calc(64% - var(--p) * 44%);width:min(560px,90%);aspect-ratio:1;top:34%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,transparent 80%,rgba(255,70,70,.5) 81.5%,rgba(255,170,60,.5) 83%,rgba(255,240,90,.5) 84.5%,rgba(90,210,110,.5) 86%,rgba(70,140,255,.5) 87.5%,rgba(140,80,230,.45) 89%,transparent 90.5%);-webkit-mask:linear-gradient(180deg,#000 20%,transparent 50%);mask:linear-gradient(180deg,#000 20%,transparent 50%);opacity:.7;filter:blur(1px)}`,
  none: "",
};
const DAY = ["birds", "godrays", "balloon", "cirrus", "season", "mist"];
const TWI = ["birds", "venus", "bats", "mist", "season", "cirrus"];
const NIGHT = ["shoot", "aurora", "milky", "fireflies", "lanterns", "comet"];
const SPACE = ["shoot", "comet", "milky", "none", "shoot", "comet"];
const at = (list: string[]) => list.map((f, i) => `${i}::${f}`).join("::");
/** The accent: weather first, then the band's list by seed. `seed`, `band`, `wx`, `kind` are macro expressions. */
export function fxMacro(seed: string, band: string, wx: string, kind: string) {
  const grp = `{{switch::${band}::morning::day::midday::day::afternoon::day::dawn::twi::sunrise::twi::golden::twi::sunset::twi::dusk::twi::night}}`;
  const bySeed = `{{switch::${grp}::day::{{switch::{{mod::${seed}::6}}::${at(DAY)}}}::twi::{{switch::{{mod::${seed}::6}}::${at(TWI)}}}::{{switch::{{mod::${seed}::6}}::${at(NIGHT)}}}}}`;
  return `{{switch::${kind}::space::{{switch::{{mod::${seed}::6}}::${at(SPACE)}}}::underground::none::{{switch::${wx}::storm::bolt::showers::{{if::{{eq::${grp}::night}}}}none{{else}}rainbow{{/if}}::fog::mist::rain::none::sleet::none::snow::none::overcast::{{if::{{eq::${grp}::night}}}}none{{else}}birds{{/if}}::${bySeed}}}}}`;
}

export const GENRE_FX: Record<string, string> = {
  horror: `&.p .moon{background:radial-gradient(circle at 36% 36%,#ffe2d4 0 26%,#d0553a 66%,#7a1d14);box-shadow:inset var(--ph) 0 0 0 rgba(30,8,10,.92),0 0 50px 14px rgba(200,60,40,.35)}&.p .gx{inset:0 auto auto 0;width:min(46%,320px);aspect-ratio:2/1;-webkit-mask:${branch} 0 0/100% 100%;mask:${branch} 0 0/100% 100%;background:#07050a}&.p .grade{background:radial-gradient(120% 90% at 50% 40%,transparent 45%,rgba(60,0,10,.6))}&.p .scene{filter:saturate(.7) contrast(1.05)}`,
  tragedy: `&.p .grade{background:linear-gradient(180deg,rgba(40,60,100,.3),rgba(20,30,50,.3));mix-blend-mode:multiply}&.p .scene{filter:saturate(.5)}&.p .gx{inset:0;background:${dots(51, 10, "rgba(220,230,255,.5)", [1, 2])};background-size:160px 120px;opacity:.6}` + scroll("tra", 160, 120, 0, 3) + MOTION(`&.p .gx{animation:tra 24s linear infinite}`),
  scifi: `&.p .gx{inset:auto;left:12%;top:12%;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 34% 34%,#d8ecff,#6a8fd0 50%,#1e2c5a 80%);box-shadow:inset -10px -6px 18px rgba(0,0,20,.6),0 0 24px rgba(140,190,255,.35);opacity:.9}&.p .gx:after{content:"";position:absolute;left:-40%;right:-40%;top:42%;height:16%;border-radius:50%;border:2px solid rgba(220,235,255,.55);transform:rotate(-18deg)}&.p .grade{background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px),linear-gradient(180deg,rgba(0,190,220,.12),rgba(160,0,220,.1));mix-blend-mode:screen}`,
  fantasy: `&.p .gx{inset:auto;top:12%;left:calc(14% + var(--ox) * .04);width:132px;height:110px;-webkit-mask:${isle} 0 0/100% 100%;mask:${isle} 0 0/100% 100%;background:color-mix(in oklab,var(--F),var(--s2) 40%);opacity:.85}&.p .gx:after{content:"";position:absolute;inset:0;background:${dots(61, 8, "rgba(255,240,200,.9)", [1, 2])}}&.p .grade{background:radial-gradient(100% 80% at 50% 0%,rgba(255,220,160,.12),transparent 60%)}` + MOTION(`&.p .gx{animation:bob 6s ease-in-out infinite alternate}`),
  dark_fantasy: `&.p .gx{inset:0;background:${dots(71, 16, "rgba(255,140,60,.95)", [1.2, 2.4])};background-size:220px 200px;filter:drop-shadow(0 0 3px rgba(255,90,20,.9))}${scroll("emb", 220, 200, -1, -2)}&.p .grade{background:radial-gradient(120% 90% at 50% 30%,transparent 40%,rgba(50,0,40,.55)),linear-gradient(0deg,rgba(120,20,10,.2),transparent 50%)}&.p .moon{background:radial-gradient(circle at 36% 36%,#fff2e0 0 30%,#e0a070 66%,#8a4a2a)}` + MOTION(`&.p .gx{animation:emb 20s linear infinite}`),
  romance: `&.p .gx{inset:0;background:radial-gradient(40px 40px at 18% 30%,rgba(255,170,200,.22),transparent 70%),radial-gradient(28px 28px at 72% 22%,rgba(255,210,160,.24),transparent 70%),radial-gradient(54px 54px at 84% 60%,rgba(255,160,190,.16),transparent 70%),radial-gradient(22px 22px at 40% 14%,rgba(255,230,200,.26),transparent 70%),radial-gradient(34px 34px at 56% 44%,rgba(255,180,210,.14),transparent 70%);mix-blend-mode:screen}&.p .grade{background:linear-gradient(180deg,rgba(255,150,170,.12),rgba(255,190,150,.1));mix-blend-mode:soft-light}` + MOTION(`&.p .gx{animation:breathe 7s ease-in-out infinite alternate}`),
  mystery: `&.p .grade{background:rgba(140,100,50,.22);mix-blend-mode:color}&.p .gx{inset:auto -20% 10% -20%;height:30%;background:radial-gradient(50% 40% at 30% 60%,rgba(230,224,210,.4),transparent 70%),radial-gradient(40% 30% at 70% 50%,rgba(230,224,210,.32),transparent 70%);filter:blur(8px)}` + MOTION(`&.p .gx{animation:drift 60s ease-in-out infinite alternate}`),
  noir: `&.p .scene{filter:grayscale(.88) contrast(1.15)}&.p .grade{background:radial-gradient(120% 100% at 50% 30%,transparent 40%,rgba(0,0,0,.6))}`,
  thriller: `&.p .gx{inset:auto 0 auto 0;top:calc(var(--sy) + 27px);height:2px;background:linear-gradient(90deg,transparent,rgba(120,200,255,.7) 50%,transparent);opacity:var(--sv);filter:blur(.5px)}&.p .grade{background:linear-gradient(180deg,rgba(0,120,140,.2),rgba(255,120,40,.14));mix-blend-mode:soft-light}`,
  intrigue: `&.p .grade{background:radial-gradient(120% 100% at 50% 20%,transparent 40%,rgba(10,40,30,.5)),linear-gradient(180deg,rgba(200,160,60,.1),transparent);mix-blend-mode:normal}`,
  survival: `&.p .scene{filter:saturate(.65) contrast(1.06)}&.p .grade{background:linear-gradient(0deg,rgba(60,50,40,.3),transparent 60%)}`,
  cozy: `&.p .grade{background:radial-gradient(120% 100% at 50% 50%,rgba(255,200,130,.16),rgba(80,40,20,.25));mix-blend-mode:soft-light}&.p .scene{filter:saturate(1.12)}`,
};
GENRE_FX.erotic = GENRE_FX.romance;
GENRE_FX.action = GENRE_FX.thriller;
GENRE_FX.adventure = `&.p .scene{filter:saturate(1.15)}&.p .grade{background:linear-gradient(180deg,rgba(255,200,120,.1),transparent)}`;
GENRE_FX.comedy = GENRE_FX.cozy;
GENRE_FX.slice_of_life = GENRE_FX.cozy;
GENRE_FX.drama = `&.p .grade{background:radial-gradient(130% 110% at 50% 40%,transparent 50%,rgba(0,0,0,.35))}`;

/** The same choice as fxMacro, for the Ledger's renderer. */
export function pickFx(seed: number, band: string, wx: string, kind: string): string {
  const grp = ["morning", "midday", "afternoon"].includes(band) ? "day" : ["dawn", "sunrise", "golden", "sunset", "dusk"].includes(band) ? "twi" : "night";
  const i = ((seed % 6) + 6) % 6;
  if (kind === "space") return SPACE[i];
  if (kind === "underground") return "none";
  if (wx === "storm") return "bolt";
  if (wx === "showers") return grp === "night" ? "none" : "rainbow";
  if (wx === "fog") return "mist";
  if (["rain", "sleet", "snow"].includes(wx)) return "none";
  if (wx === "overcast") return grp === "night" ? "none" : "birds";
  return (grp === "day" ? DAY : grp === "twi" ? TWI : NIGHT)[i];
}

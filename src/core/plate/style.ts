// The scene plate's stylesheet and header grammar, shared by the Ledger (which
// draws the plate itself, see ./index.ts) and the preset's standalone fallback.
import { rng, svgUrl } from "./art";

/** String.raw that also decodes \u escapes (so regex sources can name surrogates). */
export function raw(strings: TemplateStringsArray, ...values: unknown[]): string {
  const fix = (s: string) => s.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, (_m, a, b) => String.fromCodePoint(parseInt(a ?? b, 16)));
  return String.raw({ raw: strings.raw.map(fix) }, ...values);
}

/** Collapse whitespace and keep "}}" out of the CSS (the macro lexer would read it as a close). */
export function minCss(src: string): string {
  let out = src.replace(/\s*\n\s*/g, "");
  while (out.includes("}}")) out = out.replace(/\}\}/g, "} }");
  return out;
}

/** Puffy cloud banks: lit tops over shaded bellies, as stacked radial gradients. */
function cloudBank(seed: number, n: number, y: [number, number]) {
  const r = rng(seed), out: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + r() * 0.6) * (100 / n), cy = y[0] + r() * (y[1] - y[0]), w = 9 + r() * 9, h = w * (1.3 + r() * 0.5);
    for (let k = 0; k < 3; k++) {
      const dx = x + (k - 1) * w * 0.55 + (r() - 0.5) * 4, dy = cy - (k === 1 ? h * 0.18 : 0);
      out.push(`radial-gradient(${w.toFixed(1)}% ${h.toFixed(1)}% at ${dx.toFixed(1)}% ${dy.toFixed(1)}%,var(--cc) 30%,transparent 70%)`);
    }
    out.push(`radial-gradient(${(w * 1.7).toFixed(1)}% ${(h * 0.6).toFixed(1)}% at ${x.toFixed(1)}% ${(cy + h * 0.32).toFixed(1)}%,var(--cs) 25%,transparent 70%)`);
  }
  return out.join(",");
}
function starField(seed: number, n: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const s = (0.7 + r() * 0.9).toFixed(1);
    return `radial-gradient(${s}px ${s}px at ${(r() * 100).toFixed(0)}% ${(r() * 100).toFixed(0)}%,#fff 60%,transparent)`;
  }).join(",");
}
const NOISE = svgUrl(`<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(#n)'/>`, 160, 160);

export const PLATE_CSS = raw`
.p{--h:12;--rise:6.5;--set:18.5;--t:.5;--wd:90;--ph:0px;--ox:0px;--fl:1;--kbo:50%;
 --p:calc((var(--h) - var(--rise)) / (var(--set) - var(--rise)));
 --early:clamp(0,calc((var(--rise) - var(--h)) * 100),1);
 --q:calc((var(--h) + 24 * var(--early) - var(--set)) / (24 - var(--set) + var(--rise)));
 --sx:calc(6% + var(--p) * 82%);--sy:calc(74% - var(--p) * (1 - var(--p)) * 240%);--sun:clamp(0,calc(var(--p) * (1 - var(--p)) * 28),1);
 --mx:calc(6% + var(--q) * 82%);--my:calc(70% - var(--q) * (1 - var(--q)) * 230%);--mvis:clamp(0,calc(var(--q) * (1 - var(--q)) * 28),.95);
 --s1:#3f7fd0;--s2:#86b9ee;--s3:#d6e9fa;--far:#5d6f8c;--near:#223043;--cc:rgba(255,255,255,.75);--cs:rgba(150,165,190,.55);--lit:0;--gl:rgba(255,255,255,.12);--acc:#ffd27a;
 --kt:var(--far);--ka:0%;--va:0%;--veg:var(--far);--tn:var(--far);
 --F:color-mix(in oklab,color-mix(in oklab,var(--far),var(--kt) var(--ka)),var(--tn) 16%);
 --N:color-mix(in oklab,color-mix(in oklab,var(--near),var(--kt) calc(var(--ka) * .5)),var(--tn) 8%);
 --M:color-mix(in oklab,color-mix(in oklab,var(--F),var(--N) 55%),var(--veg) var(--va));
 --mf:none;--mm:none;--mn:none;--mg:none;--mw:none;--hf:0%;--hm:0%;--hn:0%;--hg:0%;--hw:0%;--bf:0px;--bm:0px;--bn:0px;--bw:0px;--kf:.5;--km:.8;--kn:1.2;--kg:1.6;--kw:.8;--af:.5;--am:.5;--an:.5;--ag:.5;--aw:.5;--wl:0px;--rf:0;--g:40px;
 position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;min-height:258px;margin:.3em 0 1.2em;border-radius:22px;color:#fff;
 font-family:"Newsreader","Iowan Old Style",Palatino,Georgia,serif;background:#111a33;
 box-shadow:0 26px 50px -30px rgba(10,10,30,.85),inset 0 0 0 1px rgba(255,255,255,.08)}
.p *{box-sizing:border-box}
.l{position:absolute;inset:0;pointer-events:none}
.scene{position:absolute;inset:0;overflow:hidden;transform-origin:var(--kbo) 78%}
.p[data-flip="1"]{--fl:-1}
.p[data-tint="1"]{--tn:#2c7a86}.p[data-tint="2"]{--tn:#5e3e96}.p[data-tint="3"]{--tn:#94404f}.p[data-tint="4"]{--tn:#3f7444}
.p[data-season=spring]{--veg:#86b86c}.p[data-season=summer]{--veg:#3f7a3a}.p[data-season=autumn]{--veg:#c06a2a}.p[data-season=winter]{--veg:#dfe7f0}
.p[data-band=night]{--s1:#05081a;--s2:#0f1838;--s3:#27224d;--far:#1a2146;--near:#070a15;--cc:rgba(88,98,132,.55);--cs:rgba(20,24,44,.6);--lit:1;--gl:rgba(110,130,200,.1);--acc:#8fb6ff}
.p[data-band=small]{--s1:#03051a;--s2:#0a1130;--s3:#171a42;--far:#151b3c;--near:#05070f;--cc:rgba(80,90,125,.5);--cs:rgba(16,18,36,.6);--lit:.6;--gl:transparent;--acc:#8fb6ff}
.p[data-band=predawn]{--s1:#0c1030;--s2:#2a2a5a;--s3:#5a4470;--far:#2c2a55;--near:#0d0c1d;--cc:rgba(110,100,150,.5);--cs:rgba(40,32,70,.55);--lit:.4;--gl:rgba(160,110,170,.25);--acc:#c9a8ff}
.p[data-band=dawn]{--s1:#27295a;--s2:#7a4d80;--s3:#f0a07a;--far:#8a6390;--near:#2a1a2c;--cc:rgba(255,190,190,.6);--cs:rgba(120,80,120,.5);--gl:rgba(255,150,120,.5);--acc:#ffb38a}
.p[data-band=sunrise]{--s1:#4a5a9a;--s2:#e89a7c;--s3:#ffd79a;--far:#9c7895;--near:#3a2a38;--cc:rgba(255,220,195,.7);--cs:rgba(170,110,120,.5);--gl:rgba(255,190,120,.55);--acc:#ffc27a}
.p[data-band=morning]{--s1:#5b8fd0;--s2:#9cc3ea;--s3:#e8f1f8;--gl:rgba(255,250,230,.2)}
.p[data-band=midday]{--s1:#3a78cc;--s2:#83b6ec;--s3:#d9ebfa}
.p[data-band=afternoon]{--s1:#4b82c4;--s2:#a2c3e4;--s3:#f3e7c8;--far:#6c7690;--gl:rgba(255,230,180,.22)}
.p[data-band=golden]{--s1:#48609e;--s2:#e0a36a;--s3:#ffd28a;--far:#8c6c70;--near:#35263a;--cc:rgba(255,226,180,.72);--cs:rgba(180,110,100,.5);--gl:rgba(255,200,120,.5);--acc:#ffcf6a}
.p[data-band=sunset]{--s1:#34275f;--s2:#c0587a;--s3:#ffb070;--far:#6a3f6c;--near:#1f1428;--cc:rgba(255,175,160,.62);--cs:rgba(110,50,90,.55);--lit:.3;--gl:rgba(255,110,90,.55);--acc:#ff9a8a}
.p[data-band=dusk]{--s1:#1c1c4a;--s2:#5a3a70;--s3:#b0607a;--far:#3a2c58;--near:#120f22;--cc:rgba(170,125,165,.5);--cs:rgba(60,40,80,.55);--lit:.7;--gl:rgba(200,90,140,.35);--acc:#f0a0d0}
.p[data-band=evening]{--s1:#0b1030;--s2:#1c2350;--s3:#3a3060;--far:#222a52;--near:#080b18;--cc:rgba(90,100,135,.55);--cs:rgba(24,28,50,.6);--lit:1;--gl:rgba(120,110,190,.15);--acc:#a8b8ff}
.sky{background:linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3))}
.glow{background:radial-gradient(75% 60% at calc(var(--sx) + 28px) 96%,var(--gl),transparent 70%)}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=sleet]) .sky{filter:saturate(.35) brightness(.78)}
.p[data-wx=storm] .sky{filter:saturate(.3) brightness(.5)}
.p:is([data-wx=fog],[data-wx=snow]) .sky{filter:saturate(.3) brightness(1.08)}
.p:not([data-wx=clear]):not([data-wx=fair]) .glow{opacity:.35}
.p[data-season=spring] .wash{background:linear-gradient(0deg,rgba(130,210,130,.16),transparent 60%)}
.p[data-season=summer] .wash{background:linear-gradient(0deg,rgba(255,200,80,.12),transparent 70%)}
.p[data-season=autumn] .wash{background:linear-gradient(0deg,rgba(235,140,50,.2),rgba(235,140,50,.05) 70%)}
.p[data-season=winter] .wash{background:linear-gradient(0deg,rgba(210,225,255,.22),rgba(210,225,255,.06))}
.stars{opacity:calc(var(--lit) * .95);background:${starField(1, 22)};background-size:300px 190px}
.stars:after{content:"";position:absolute;inset:0;background:${starField(2, 8).replace(/0\.\dpx 0\.\dpx|1\.\dpx 1\.\dpx/g, "1.6px 1.6px")};background-size:420px 230px}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=storm],[data-wx=fog],[data-wx=snow],[data-wx=sleet]) .stars{opacity:0}
.sun,.moon{inset:auto;border-radius:50%}
.sun{width:56px;height:56px;left:var(--sx);top:var(--sy);opacity:var(--sun);
 background:radial-gradient(circle,#fff8e0 0 40%,#ffd07a 68%,rgba(255,170,90,0));box-shadow:0 0 80px 30px rgba(255,190,110,.38)}
.rays{inset:auto;width:440px;height:440px;margin:-192px 0 0 -192px;left:var(--sx);top:var(--sy);border-radius:50%;opacity:0;
 background:repeating-conic-gradient(rgba(255,228,170,.2) 0 5deg,transparent 5deg 15deg);-webkit-mask:radial-gradient(circle,#000 8%,transparent 62%);mask:radial-gradient(circle,#000 8%,transparent 62%)}
.p:is([data-band=dawn],[data-band=sunrise],[data-band=golden],[data-band=sunset]):is([data-wx=clear],[data-wx=fair]) .rays{opacity:.9}
.moon{width:36px;height:36px;left:var(--mx);top:var(--my);opacity:var(--mvis);
 background:radial-gradient(circle at 36% 36%,#fbfcff 0 44%,#d7defa 72%,#aeb8e6);box-shadow:inset var(--ph) 0 0 0 rgba(18,22,48,.92),0 0 38px 10px rgba(200,210,255,.2)}
.p:is([data-wx=overcast],[data-wx=rain],[data-wx=storm],[data-wx=fog],[data-wx=snow],[data-wx=sleet]) :is(.sun,.moon){filter:blur(3px);opacity:.25}
.clouds,.clouds2{inset:-6% -50% 40% -10%;opacity:0;background:${cloudBank(3, 6, [26, 52])}}
.clouds2{inset:-14% -40% 52% -30%;background:${cloudBank(8, 7, [30, 60])};filter:blur(1px)}
.p[data-wx=fair] .clouds{opacity:.55}.p[data-wx=fair] .clouds2{opacity:.35}
.p[data-wx=broken] :is(.clouds,.clouds2){opacity:.9}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=sleet],[data-wx=snow]) :is(.clouds,.clouds2){opacity:1;inset:-14% -50% 26% -10%}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=sleet],[data-wx=snow]) .clouds2{inset:-24% -40% 40% -30%}
.p[data-wx=storm] :is(.clouds,.clouds2){opacity:1;inset:-14% -50% 18% -10%;--cc:rgba(46,50,66,.92);--cs:rgba(14,16,24,.85)}
.land{position:absolute;left:0;right:0;top:auto;bottom:calc(var(--b,0px) + var(--g));height:var(--hh,0%);pointer-events:none;transform:scaleX(var(--fl));
 -webkit-mask:var(--m) calc(var(--a) * 100% + var(--ox) * var(--k)) 100%/auto 100% repeat-x;mask:var(--m) calc(var(--a) * 100% + var(--ox) * var(--k)) 100%/auto 100% repeat-x}
.ground{top:auto;height:calc(var(--g) + 1px);background:var(--N)}
.p[data-wx=snow] .ground{background:linear-gradient(180deg,#e9eef6,#c3cddb)}
.far{--m:var(--mf);--hh:var(--hf);--b:var(--bf);--k:var(--kf);--a:var(--af);background:linear-gradient(180deg,color-mix(in oklab,var(--F),var(--s3) 40%),color-mix(in oklab,var(--F),var(--s3) 14%))}
.refl{--m:var(--mf);--hh:var(--hf);--k:var(--kf);--a:var(--af);bottom:calc(var(--bf) + var(--g) - var(--hf));transform:scale(var(--fl),-1);opacity:calc(var(--rf) * .3);background:linear-gradient(0deg,var(--F),transparent);filter:blur(1.2px)}
.mid{--m:var(--mm);--hh:var(--hm);--b:var(--bm);--k:var(--km);--a:var(--am);background:var(--M)}
.lit{--m:var(--mw);--hh:var(--hw);--b:var(--bw);--k:var(--kw);--a:var(--aw);background:#ffd27a;opacity:var(--lit)}
.near{--m:var(--mn);--hh:var(--hn);--b:var(--bn);--k:var(--kn);--a:var(--an);background:var(--N)}
.fg{--m:var(--mg);--hh:calc(var(--hg) - var(--g));--k:var(--kg);--a:var(--ag);background:color-mix(in oklab,var(--N),#000 30%)}
.p[data-wx=snow] .far{background:linear-gradient(180deg,rgba(240,245,252,.85) 0 14%,transparent 34%),color-mix(in oklab,var(--F),var(--s3) 24%)}
.p[data-wx=snow] .mid{background:linear-gradient(180deg,rgba(238,243,250,.9) 0 10%,transparent 26%),var(--M)}
.p[data-wx=snow] .near{background:linear-gradient(180deg,rgba(236,242,250,.92) 0 10%,transparent 24%),var(--N)}
.water{top:auto;height:calc(var(--wl) + var(--g));background:linear-gradient(180deg,color-mix(in oklab,var(--s3),var(--s2) 30%),color-mix(in oklab,var(--s2),var(--N) 50%) 55%,var(--N))}
.water:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.12) 0 1px,transparent 1px 6px);-webkit-mask:linear-gradient(180deg,transparent,#000 30%);mask:linear-gradient(180deg,transparent,#000 30%)}
.glint,.mglint{top:auto;height:calc(var(--wl) + var(--g));width:70px;left:calc(var(--sx) - 7px);opacity:var(--sun);background:repeating-linear-gradient(180deg,rgba(255,236,190,.8) 0 2px,transparent 2px 7px);-webkit-mask:radial-gradient(50% 100% at 50% 0,#000,transparent 85%);mask:radial-gradient(50% 100% at 50% 0,#000,transparent 85%)}
.mglint{left:calc(var(--mx) - 17px);opacity:calc(var(--mvis) * var(--lit) * .8);background:repeating-linear-gradient(180deg,rgba(215,225,255,.7) 0 2px,transparent 2px 8px)}
.p:not([data-wx=clear]):not([data-wx=fair]):not([data-wx=broken]) :is(.glint,.mglint){opacity:.15}
.fog{opacity:0;background:linear-gradient(180deg,transparent 25%,rgba(228,233,240,.5) 62%,rgba(228,233,240,.78))}
.p[data-wx=fog] .fog{opacity:1}.p:is([data-wx=rain],[data-wx=snow]) .fog{opacity:.3}
.rain{inset:-30%;opacity:0;transform:rotate(12deg);background-image:radial-gradient(1px 11px at 50% 50%,rgba(215,228,255,.6) 40%,transparent),radial-gradient(1px 8px at 30% 20%,rgba(215,228,255,.42) 40%,transparent),radial-gradient(1.3px 15px at 70% 60%,rgba(232,240,255,.62) 40%,transparent);background-size:23px 61px,37px 83px,53px 113px}
.rain.r2{background-size:17px 47px,29px 67px,41px 89px;transform:rotate(9deg) scale(.9)}
.p:is([data-wx=showers],[data-wx=rain],[data-wx=storm],[data-wx=sleet]) .rain{opacity:.85}
.p:is([data-wx=rain],[data-wx=storm]) .rain.r2{opacity:.5}
.p[data-int=light] .rain{opacity:.45}.p[data-int=light] .rain.r2{opacity:0}
.p:is([data-int=heavy],[data-int=torrential]) .rain.r2{opacity:.85}
.snow{inset:-20%;opacity:0;background-image:radial-gradient(2px 2px at 10% 20%,#fff 60%,transparent),radial-gradient(3px 3px at 30% 60%,#fff 60%,transparent),radial-gradient(2px 2px at 50% 30%,#fff 60%,transparent),radial-gradient(3px 3px at 70% 70%,#fff 60%,transparent),radial-gradient(2px 2px at 85% 25%,#fff 60%,transparent),radial-gradient(2.5px 2.5px at 20% 85%,#fff 60%,transparent);background-size:150px 110px}
.snow.big{background-size:260px 200px;filter:blur(.8px);transform:scale(1.6)}
.p[data-wx=snow] .snow{opacity:.95}.p[data-wx=sleet] .snow{opacity:.5}
.flash{opacity:0;background:#eef3ff}
.windl{opacity:0;background:repeating-linear-gradient(172deg,transparent 0 26px,rgba(255,255,255,.2) 26px 27px)}
.p[data-wx=wind] .windl,.p[data-wx=storm] .windl{opacity:.8}
.heat{opacity:0;background:linear-gradient(0deg,rgba(255,160,80,.3),transparent 55%)}
.p[data-wx=heat] .heat{opacity:1}
.room,.wf{display:none}
.p[data-place^=r_]{--g:0px}
.p[data-place^=r_] :is(.room,.wf){display:block}
.p[data-place^=r_] .scene{z-index:1;-webkit-mask:var(--mwin) 0 0/100% 100% no-repeat;mask:var(--mwin) 0 0/100% 100% no-repeat}
.p[data-place^=r_] .scene:before{content:"";position:absolute;inset:0;z-index:3;background:linear-gradient(125deg,transparent 30%,rgba(255,255,255,.1) 42%,transparent 52%)}
.wf{position:absolute;z-index:1;pointer-events:none;-webkit-mask:var(--mfr) 0 0/100% 100% no-repeat;mask:var(--mfr) 0 0/100% 100% no-repeat;background:linear-gradient(180deg,#6a4a30,#2a1a10);filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.p[data-place^=r_] :is(.ra,.rb,.rc,.rd){z-index:1}
.ra,.rb,.rc,.rd{position:absolute;pointer-events:none}
.wall{background:linear-gradient(180deg,#3d2819,#24170f)}
.wain{top:auto;height:20%;background:linear-gradient(#2c1b10,#1a100a)}
.lamp{opacity:calc(.35 + var(--lit) * .65);background:radial-gradient(40% 70% at 10% 96%,rgba(255,170,80,.6),transparent 70%)}
.spill{z-index:1;opacity:calc((1 - var(--lit)) * .9);background:radial-gradient(30% 70% at var(--wx,70%) 40%,rgba(255,244,220,.16),transparent 70%)}
.p[data-place^=r_] .walldim{opacity:calc(var(--lit) * .35);background:#05060c}
.motes{z-index:1;background:radial-gradient(1.5px 1.5px at 20% 70%,rgba(255,220,170,.8),transparent),radial-gradient(1px 1px at 35% 40%,rgba(255,220,170,.7),transparent),radial-gradient(1.5px 1.5px at 12% 50%,rgba(255,220,170,.6),transparent);background-size:220px 180px}
.roomflash{z-index:1;opacity:0;background:radial-gradient(60% 90% at var(--wx,70%) 32%,rgba(220,232,255,.3),transparent 70%)}
.scrim{background:linear-gradient(0deg,rgba(6,8,18,.62),rgba(6,8,18,.12) 48%,transparent 70%)}
.grain{opacity:.07;background:${NOISE} 0 0/160px 160px;mix-blend-mode:overlay}
.frame{z-index:1;border-radius:inherit}
.p[data-frame="1"] .frame{inset:8px;border:1px solid rgba(255,255,255,.3);border-radius:15px}
.p[data-frame="2"] .frame{inset:10px;opacity:.6;background:linear-gradient(#fff,#fff) 0 0/18px 1.5px,linear-gradient(#fff,#fff) 0 0/1.5px 18px,linear-gradient(#fff,#fff) 100% 0/18px 1.5px,linear-gradient(#fff,#fff) 100% 0/1.5px 18px,linear-gradient(#fff,#fff) 0 100%/18px 1.5px,linear-gradient(#fff,#fff) 0 100%/1.5px 18px,linear-gradient(#fff,#fff) 100% 100%/18px 1.5px,linear-gradient(#fff,#fff) 100% 100%/1.5px 18px;background-repeat:no-repeat}
.p[data-frame="3"] .frame{inset:6px;border:4px double rgba(255,236,200,.38);border-radius:17px}
.p[data-frame="4"] .frame{box-shadow:inset 0 0 90px 12px rgba(0,0,0,.55)}
.top{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 14px 0}
.crumb{display:inline-flex;flex-wrap:wrap;align-items:center;gap:5px;padding:7px 12px;border-radius:999px;font:500 12px/1.25 "DM Mono",ui-monospace,Menlo,monospace;background:rgba(8,10,22,.36);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.crumb b{font-weight:500;color:#ffe3b0}
.crumb:empty{display:none}
.dial{position:relative;flex:none;width:56px;height:56px;border-radius:50%;margin-left:auto;
 background:conic-gradient(from 180deg,#1d2250 0deg calc(var(--rise) * 15deg - 10deg),#f19a6b calc(var(--rise) * 15deg),#ffd978 calc(var(--rise) * 15deg + 14deg) calc(var(--set) * 15deg - 14deg),#ef7f69 calc(var(--set) * 15deg),#1d2250 calc(var(--set) * 15deg + 10deg));box-shadow:0 0 0 1px rgba(255,255,255,.25),0 6px 16px -6px rgba(0,0,0,.6)}
.dial::before{content:"";position:absolute;inset:7px;border-radius:50%;background:rgba(8,10,24,.74)}
.mk{position:absolute;inset:0;transform:rotate(calc(180deg + var(--h) * 15deg))}
.mk::before{content:"";position:absolute;left:50%;top:-1px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 10px 3px rgba(255,255,255,.7)}
.dial span{position:absolute;inset:0;display:grid;place-items:center;font:500 11px/1 "DM Mono",ui-monospace,Menlo,monospace;color:#fff}
.title{position:relative;z-index:2;margin-top:auto;padding:16px 20px 14px}
.kicker{display:inline-flex;align-items:center;gap:8px;font:500 10.5px/1 "DM Mono",ui-monospace,Menlo,monospace;letter-spacing:.22em;text-transform:uppercase;opacity:.92}
.ttl{margin:8px 0 0;font:700 clamp(26px,6vw,42px)/1.04 "Fraunces","Iowan Old Style",Palatino,Georgia,serif;letter-spacing:-.01em;text-shadow:0 2px 24px rgba(0,0,0,.55)}
.ttl:empty{display:none}
.p[data-lay="1"] .title{text-align:center;padding-bottom:16px}
.p[data-lay="1"] .ttl:after{content:"";display:block;width:76px;height:1px;margin:12px auto 0;background:linear-gradient(90deg,transparent,var(--acc),transparent)}
.p[data-lay="2"] .title{display:grid;grid-template-columns:auto 1fr;align-items:end;column-gap:14px}
.p[data-lay="2"] .kicker{grid-row:1/3;writing-mode:vertical-rl;transform:rotate(180deg);padding:0 0 0 12px;border-right:2px solid var(--acc);letter-spacing:.3em;font-size:9.5px}
.p[data-lay="2"] .ttl{margin:0;font-size:clamp(28px,6.6vw,48px)}
.p[data-lay="3"] .title{align-self:flex-end;margin:auto 14px 12px auto;max-width:min(82%,520px);padding:13px 18px 14px;text-align:right;border-radius:16px;background:rgba(8,10,22,.34);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.p[data-lay="4"] .ttl{display:inline;padding:0 .12em;background:linear-gradient(transparent 64%,color-mix(in oklab,var(--acc) 55%,transparent) 64% 88%,transparent 88%);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.p[data-lay="4"] .kicker{display:flex;width:fit-content;margin-bottom:8px}
.strip{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 12px;background:linear-gradient(0deg,rgba(6,8,18,.62),rgba(6,8,18,.28));border-top:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(10px) saturate(1.2);backdrop-filter:blur(10px) saturate(1.2)}
.gl{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;white-space:nowrap;font:500 12px/1 "DM Mono",ui-monospace,Menlo,monospace;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16)}
.gl:empty{display:none}
.thermo{position:relative;width:6px;height:14px;border-radius:3px;background:rgba(255,255,255,.25);overflow:hidden}
.thermo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:calc(var(--t) * 100%);background:linear-gradient(0deg,#69b7ff,#ffb86b 70%,#ff6b6b)}
.wind{display:inline-block;font-style:normal;font-size:11px;transform:rotate(calc(var(--wd) * 1deg - 90deg))}
.mo{width:13px;height:13px;border-radius:50%;background:#f4f1e6;box-shadow:inset calc(var(--ph) / 3) 0 0 0 #2a2f4a}
.p[data-genre=mystery] .kicker{padding:5px 10px 4px;border-radius:5px 5px 0 0;background:#efe2c4;color:#3a2c1c;opacity:1;transform:rotate(-1.2deg);box-shadow:0 3px 10px rgba(0,0,0,.35);writing-mode:horizontal-tb}
.p[data-genre=mystery] .ttl{font-variant:small-caps;letter-spacing:.02em}
.p[data-genre=noir] .ttl{font:600 clamp(26px,6vw,42px)/.98 "Oswald","Bebas Neue","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em}
.p[data-genre=noir] .scrim{background:repeating-linear-gradient(172deg,transparent 0 16px,rgba(0,0,0,.22) 16px 25px),linear-gradient(0deg,rgba(6,8,18,.6),transparent 60%)}
.p:is([data-genre=fantasy],[data-genre=dark_fantasy]) .ttl{font:700 italic clamp(26px,6vw,42px)/1 "Cormorant Garamond","Iowan Old Style",Georgia,serif}
.p:is([data-genre=fantasy],[data-genre=dark_fantasy]) .kicker::before,.p:is([data-genre=fantasy],[data-genre=dark_fantasy]) .kicker::after{content:"❧";letter-spacing:0;font-size:14px}
.p:is([data-genre=fantasy],[data-genre=dark_fantasy]) .kicker::before{transform:scaleX(-1)}
.p:is([data-genre=thriller],[data-genre=scifi],[data-genre=action]) .ttl{font:700 clamp(24px,5.4vw,36px)/1.02 "Space Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em}
.p:is([data-genre=romance],[data-genre=erotic]) .ttl{font:600 italic clamp(26px,6vw,42px)/1.02 "Fraunces","Iowan Old Style",Georgia,serif}
.p:is([data-genre=romance],[data-genre=erotic]) .kicker{color:#ffd5dc}
.p:is([data-genre=romance],[data-genre=erotic]) .kicker::before{content:"❦";font-size:15px;letter-spacing:0}
.p:is([data-genre=horror],[data-genre=tragedy]) .ttl{font:600 clamp(26px,6vw,42px)/1 "Cormorant Garamond",Georgia,serif;letter-spacing:.03em;text-shadow:0 0 1px #000,0 3px 18px rgba(120,0,0,.55)}
.p:is([data-genre=comedy],[data-genre=cozy],[data-genre=slice_of_life]) .ttl{font:600 clamp(26px,6vw,40px)/1.05 "Fredoka","Nunito",system-ui,sans-serif;display:inline-block;padding:4px 14px;border-radius:14px;background:rgba(255,255,255,.14);transform:rotate(-1.5deg)}
@media (prefers-reduced-motion:no-preference){
 .scene{animation:kb 48s ease-in-out infinite alternate}
 .p[data-place^=r_] .scene{animation:none}
 .rain{animation:rain .75s linear infinite}.rain.r2{animation-duration:1.05s}
 .snow{animation:snow 10s linear infinite}.snow.big{animation-duration:6s}
 .clouds{animation:drift 70s linear infinite alternate}.clouds2{animation:drift 110s linear infinite alternate-reverse}
 .p[data-wx=storm] :is(.flash,.roomflash){animation:flash 7s ease-out infinite}
 .rays{animation:spin 90s linear infinite}
 .windl{animation:gust 1.4s linear infinite}
 .fog{animation:breathe 14s ease-in-out infinite alternate}
 .stars:after{animation:twinkle 3.5s ease-in-out infinite alternate}
 .water:before{animation:shimmer 3s linear infinite}
 .glint,.mglint{animation:breathe 4s ease-in-out infinite alternate}
 .lamp{animation:flicker 4.5s ease-in-out infinite}
 .motes{animation:motes 26s linear infinite}
 .title>*{animation:rise 1s cubic-bezier(.2,.7,.2,1) both}.title>*:nth-child(2){animation-delay:.12s}
 .mk::before{animation:pulse 2.8s ease-in-out infinite}
}
@keyframes kb{to{transform:scale(1.07)}}
@keyframes rain{to{background-position:0 244px,0 332px,0 452px}}
@keyframes snow{to{background-position:30px 220px,-20px 220px,15px 220px,-30px 220px,25px 220px,-15px 220px}}
@keyframes drift{to{transform:translateX(-26%)}}
@keyframes flash{0%,86%,92%,100%{opacity:0}87%{opacity:.8}89%{opacity:.1}90%{opacity:.55}}
@keyframes spin{to{transform:rotate(1turn)}}
@keyframes gust{to{background-position:-120px 20px}}
@keyframes breathe{to{opacity:.7;transform:translateX(-4%)}}
@keyframes flicker{0%,100%{opacity:1}45%{opacity:.86}48%{opacity:.97}52%{opacity:.8}60%{opacity:.95}}
@keyframes motes{to{background-position:40px -360px,-30px -360px,20px -360px}}
@keyframes rise{from{opacity:0;transform:translateY(10px);filter:blur(5px)}}
@keyframes pulse{50%{box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 16px 6px rgba(255,255,255,.9)}}
@keyframes twinkle{to{opacity:.35}}
@keyframes shimmer{to{background-position:0 12px}}
@keyframes pan{from{-webkit-mask-position:0 100%;mask-position:0 100%}to{-webkit-mask-position:-800px 100%;mask-position:-800px 100%}}
@keyframes fly{from{left:-30%}to{left:115%}}
@keyframes bob{to{transform:translateY(7px)}}
@keyframes flit{50%{transform:scaleY(.55)}}
@keyframes shoot{0%,88%{opacity:0;translate:0 0}90%{opacity:1}100%{opacity:0;translate:-230px 104px}}
@keyframes aur{to{transform:skewX(8deg) translateX(5%);opacity:.6}}
@keyframes blink{0%,25%{opacity:.15}100%{opacity:1}}
@keyframes driftup{to{transform:translate(12px,-16px)}}
@keyframes balloon{to{transform:translate(-70px,-14px)}}
@keyframes sway{from{transform:scale(1.06) rotate(-1.4deg) translateY(3px)}to{transform:scale(1.06) rotate(1.4deg) translateY(-3px)}}
@keyframes rattle{50%{transform:translateY(1px)}}
@keyframes beam{0%,100%{transform:rotate(-6deg) scaleX(1)}50%{transform:rotate(-6deg) scaleX(-1)}}
@keyframes plume{to{transform:translate(-6%,-5%) scale(1.14)}}
@keyframes fall{to{background-position:0 28px}}
@keyframes sweep{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
@keyframes swing{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}
@keyframes ecg{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
@keyframes steam{0%{transform:translateY(10%);opacity:.4}50%{opacity:1}100%{transform:translateY(-14%);opacity:.3}}
@media (max-width:560px){.p{min-height:236px;border-radius:18px}.dial{width:46px;height:46px}.dial::before{inset:6px}.dial span{font-size:9.5px}.gl{font-size:11px;padding:5px 8px}.p[data-lay="2"] .kicker{display:none}}
`;

// Header grammar (no "u" flag: emoji are matched as literal code-unit sequences).
// Groups: 1 date · 2 hour · 3 minute · 4 glyph · 5 condition text · 6/7 sunrise ·
// 8/9 sunset · 10 moon · 11 place path · 12 title
// Any clock glyph opens the time: models drift from 🕰 to the hour faces
// 🕐–🕧 (written as surrogates, since there is no "u" flag), ⏰, ⌚, ⏱ or ⏲.
const CLOCK = raw`(?:🕰|\uD83D[\uDD50-\uDD67]|⏰|⌚|⏱|⏲)`;
export const PLATE_FIND = raw`(?:^|\n)[ \t]*(?:\*\*)?🗓️?[ \t]*((?:(?!${CLOCK})[^\n])*?)[ \t]*(?:${CLOCK}️?)?[ \t]*0?(\d|1\d|2[0-3]):([0-5]\d)[ \t]*(?:(☀|🌙|✨|🌤|⛅|🌥|☁|🌦|🌧|⛈|🌩|🌨|❄|🧊|🌫|🌬|🌪|🔥|🌡)️?)?[ \t]*([^\n⟪]*?)[ \t]*(?:\*\*)?[ \t]*(?:⟪(\d{1,2}):(\d\d)\|(\d{1,2}):(\d\d)\|([^⟫\n]*)⟫)?[ \t]*(?:\n[ \t]*(?:\*\*)?📍️?[ \t]*([^\n]*?)(?:\*\*)?)?[ \t]*(?:\n[ \t]*#{1,3}[ \t]+([^\n]+))?(?=\n|$)`;


import { R } from "./vars";
// The scene plate: the three-line header (🗓 … 🕰 HH:MM ☁ condition · temp · wind /
// 📍 place / # Title) drawn as a living sky. One self-contained island with its
// own <style>, so it looks the same with or without the Ledger; the Ledger only
// adds exact sunrise/sunset and the moon phase as a ⟪06:42|18:10|🌖 waning gibbous⟫
// suffix on the header line, which this regex reads.

const css = R;

/** Collapse whitespace and keep "}}" out of the CSS (the macro lexer would read it as a close). */
export function minCss(src: string): string {
  let out = src.replace(/\s*\n\s*/g, "");
  while (out.includes("}}")) out = out.replace(/\}\}/g, "} }");
  return out;
}

export const PLATE_CSS = css`
.p{--h:12;--rise:6.5;--set:18.5;--t:.5;--wd:90;--ph:0px;
 --p:calc((var(--h) - var(--rise)) / (var(--set) - var(--rise)));
 --early:clamp(0,calc((var(--rise) - var(--h)) * 100),1);
 --q:calc((var(--h) + 24 * var(--early) - var(--set)) / (24 - var(--set) + var(--rise)));
 --s1:#3f7fd0;--s2:#86b9ee;--s3:#d6e9fa;--far:#5d6f8c;--near:#223043;--cc:rgba(255,255,255,.6);--lit:0;
 position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;min-height:258px;margin:.3em 0 1.2em;border-radius:22px;color:#fff;
 font-family:"Newsreader","Iowan Old Style",Palatino,Georgia,serif;background:#111a33;
 box-shadow:0 26px 50px -30px rgba(10,10,30,.85),inset 0 0 0 1px rgba(255,255,255,.08)}
.p *{box-sizing:border-box}
.l{position:absolute;inset:0;pointer-events:none}
.scene{position:absolute;inset:0;overflow:hidden}
.p[data-band=night]{--s1:#05081a;--s2:#0f1838;--s3:#27224d;--far:#1a2146;--near:#070a15;--cc:rgba(88,98,132,.55);--lit:1}
.p[data-band=small]{--s1:#03051a;--s2:#0a1130;--s3:#171a42;--far:#151b3c;--near:#05070f;--cc:rgba(80,90,125,.5);--lit:.6}
.p[data-band=predawn]{--s1:#0c1030;--s2:#2a2a5a;--s3:#5a4470;--far:#2c2a55;--near:#0d0c1d;--cc:rgba(110,100,150,.5);--lit:.4}
.p[data-band=dawn]{--s1:#27295a;--s2:#7a4d80;--s3:#f0a07a;--far:#8a6390;--near:#2a1a2c;--cc:rgba(255,190,190,.5)}
.p[data-band=sunrise]{--s1:#4a5a9a;--s2:#e89a7c;--s3:#ffd79a;--far:#9c7895;--near:#3a2a38;--cc:rgba(255,215,190,.6)}
.p[data-band=morning]{--s1:#5b8fd0;--s2:#9cc3ea;--s3:#e8f1f8}
.p[data-band=midday]{--s1:#3a78cc;--s2:#83b6ec;--s3:#d9ebfa}
.p[data-band=afternoon]{--s1:#4b82c4;--s2:#a2c3e4;--s3:#f3e7c8;--far:#6c7690}
.p[data-band=golden]{--s1:#48609e;--s2:#e0a36a;--s3:#ffd28a;--far:#8c6c70;--near:#35263a;--cc:rgba(255,220,170,.6)}
.p[data-band=sunset]{--s1:#34275f;--s2:#c0587a;--s3:#ffb070;--far:#6a3f6c;--near:#1f1428;--cc:rgba(255,170,160,.55);--lit:.3}
.p[data-band=dusk]{--s1:#1c1c4a;--s2:#5a3a70;--s3:#b0607a;--far:#3a2c58;--near:#120f22;--cc:rgba(160,120,160,.5);--lit:.7}
.p[data-band=evening]{--s1:#0b1030;--s2:#1c2350;--s3:#3a3060;--far:#222a52;--near:#080b18;--cc:rgba(90,100,135,.55);--lit:1}
.sky{background:linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3))}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=sleet]) .sky{filter:saturate(.35) brightness(.78)}
.p[data-wx=storm] .sky{filter:saturate(.3) brightness(.5)}
.p:is([data-wx=fog],[data-wx=snow]) .sky{filter:saturate(.3) brightness(1.08)}
.p[data-season=spring] .wash{background:linear-gradient(0deg,rgba(130,210,130,.16),transparent 60%)}
.p[data-season=summer] .wash{background:linear-gradient(0deg,rgba(255,200,80,.12),transparent 70%)}
.p[data-season=autumn] .wash{background:linear-gradient(0deg,rgba(235,140,50,.2),rgba(235,140,50,.05) 70%)}
.p[data-season=winter] .wash{background:linear-gradient(0deg,rgba(210,225,255,.22),rgba(210,225,255,.06))}
.stars{opacity:calc(var(--lit) * .9);background:radial-gradient(1px 1px at 12% 18%,#fff 60%,transparent),radial-gradient(1px 1px at 33% 9%,#fff 60%,transparent),radial-gradient(1.4px 1.4px at 58% 22%,#fff 60%,transparent),radial-gradient(1px 1px at 76% 12%,#fff 60%,transparent),radial-gradient(1.2px 1.2px at 88% 30%,#fff 60%,transparent),radial-gradient(1px 1px at 46% 36%,#fff 60%,transparent),radial-gradient(1px 1px at 22% 40%,#fff 60%,transparent);background-size:260px 170px}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=storm],[data-wx=fog],[data-wx=snow],[data-wx=sleet]) .stars{opacity:0}
.p[data-place=space] .stars{opacity:1}
.sun,.moon{inset:auto;border-radius:50%}
.sun{width:56px;height:56px;left:calc(6% + var(--p) * 82%);top:calc(74% - var(--p) * (1 - var(--p)) * 240%);opacity:clamp(0,calc(var(--p) * (1 - var(--p)) * 28),1);
 background:radial-gradient(circle,#fff8e0 0 40%,#ffd07a 68%,rgba(255,170,90,0));box-shadow:0 0 80px 30px rgba(255,190,110,.38)}
.rays{inset:auto;width:440px;height:440px;margin:-192px 0 0 -192px;left:calc(6% + var(--p) * 82%);top:calc(74% - var(--p) * (1 - var(--p)) * 240%);border-radius:50%;opacity:0;
 background:repeating-conic-gradient(rgba(255,228,170,.2) 0 5deg,transparent 5deg 15deg);-webkit-mask:radial-gradient(circle,#000 8%,transparent 62%);mask:radial-gradient(circle,#000 8%,transparent 62%)}
.p:is([data-band=dawn],[data-band=sunrise],[data-band=golden],[data-band=sunset]):is([data-wx=clear],[data-wx=fair]) .rays{opacity:.9}
.moon{width:36px;height:36px;left:calc(6% + var(--q) * 82%);top:calc(70% - var(--q) * (1 - var(--q)) * 230%);opacity:clamp(0,calc(var(--q) * (1 - var(--q)) * 28),.95);
 background:radial-gradient(circle at 36% 36%,#fbfcff 0 44%,#d7defa 72%,#aeb8e6);box-shadow:inset var(--ph) 0 0 0 rgba(18,22,48,.92),0 0 38px 10px rgba(200,210,255,.2)}
.p:is([data-wx=overcast],[data-wx=rain],[data-wx=storm],[data-wx=fog],[data-wx=snow],[data-wx=sleet]) :is(.sun,.moon){filter:blur(3px);opacity:.25}
.clouds{inset:-10% -50% 36% -10%;opacity:0;background:radial-gradient(28% 55% at 14% 40%,var(--cc),transparent 70%),radial-gradient(24% 45% at 40% 25%,var(--cc),transparent 70%),radial-gradient(30% 50% at 66% 38%,var(--cc),transparent 70%),radial-gradient(26% 48% at 90% 22%,var(--cc),transparent 70%)}
.p[data-wx=fair] .clouds{opacity:.45}
.p[data-wx=broken] .clouds{opacity:.8}
.p:is([data-wx=overcast],[data-wx=showers],[data-wx=rain],[data-wx=sleet],[data-wx=snow]) .clouds{opacity:1;inset:-14% -50% 24% -10%}
.p[data-wx=storm] .clouds{opacity:1;inset:-14% -50% 18% -10%;--cc:rgba(34,38,54,.9)}
.rain{inset:-30%;opacity:0;transform:rotate(12deg);background-image:radial-gradient(1px 11px at 50% 50%,rgba(215,228,255,.6) 40%,transparent),radial-gradient(1px 8px at 30% 20%,rgba(215,228,255,.42) 40%,transparent),radial-gradient(1.3px 15px at 70% 60%,rgba(232,240,255,.62) 40%,transparent);background-size:23px 61px,37px 83px,53px 113px}
.rain.r2{background-size:17px 47px,29px 67px,41px 89px;transform:rotate(9deg) scale(.9)}
.p:is([data-wx=showers],[data-wx=rain],[data-wx=storm],[data-wx=sleet]) .rain{opacity:.85}
.p:is([data-wx=rain],[data-wx=storm]) .rain.r2{opacity:.5}
.p[data-int=light] .rain{opacity:.45}.p[data-int=light] .rain.r2{opacity:0}
.p:is([data-int=heavy],[data-int=torrential]) .rain.r2{opacity:.85}
.snow{inset:-20%;opacity:0;background-image:radial-gradient(2px 2px at 10% 20%,#fff 60%,transparent),radial-gradient(3px 3px at 30% 60%,#fff 60%,transparent),radial-gradient(2px 2px at 50% 30%,#fff 60%,transparent),radial-gradient(3px 3px at 70% 70%,#fff 60%,transparent),radial-gradient(2px 2px at 85% 25%,#fff 60%,transparent),radial-gradient(2.5px 2.5px at 20% 85%,#fff 60%,transparent);background-size:150px 110px}
.snow.big{background-size:260px 200px;filter:blur(.8px);transform:scale(1.6)}
.p[data-wx=snow] .snow{opacity:.95}.p[data-wx=sleet] .snow{opacity:.5}
.fog{opacity:0;background:linear-gradient(180deg,transparent 25%,rgba(228,233,240,.5) 62%,rgba(228,233,240,.78))}
.p[data-wx=fog] .fog{opacity:1}.p:is([data-wx=rain],[data-wx=snow]) .fog{opacity:.3}
.flash{opacity:0;background:#eef3ff}
.windl{opacity:0;background:repeating-linear-gradient(172deg,transparent 0 26px,rgba(255,255,255,.2) 26px 27px)}
.p[data-wx=wind] .windl,.p[data-wx=storm] .windl{opacity:.8}
.heat{opacity:0;background:linear-gradient(0deg,rgba(255,160,80,.3),transparent 55%)}
.p[data-wx=heat] .heat{opacity:1}
.far,.near{top:auto;height:52%;background:var(--far)}
.near{height:40%;background:var(--near)}
.far{filter:blur(.5px)}
.p[data-place=city] .far{clip-path:polygon(0 100%,0 52%,5% 52%,5% 38%,9% 38%,9% 48%,14% 48%,14% 26%,17% 26%,17% 20%,20% 20%,20% 44%,27% 44%,27% 32%,33% 32%,33% 50%,39% 50%,39% 30%,43% 30%,43% 14%,45% 14%,45% 36%,52% 36%,52% 48%,58% 48%,58% 30%,63% 30%,63% 42%,69% 42%,69% 22%,73% 22%,73% 36%,79% 36%,79% 46%,85% 46%,85% 28%,90% 28%,90% 44%,100% 44%,100% 100%)}
.p[data-place=city] .near{clip-path:polygon(0 100%,0 40%,7% 40%,7% 22%,12% 22%,12% 34%,18% 34%,18% 12%,21% 12%,21% 6%,23% 6%,23% 30%,30% 30%,30% 20%,36% 20%,36% 42%,42% 42%,42% 16%,46% 16%,46% 2%,49% 2%,49% 28%,55% 28%,55% 40%,61% 40%,61% 20%,66% 20%,66% 36%,72% 36%,72% 10%,76% 10%,76% 26%,82% 26%,82% 44%,88% 44%,88% 18%,93% 18%,93% 34%,100% 34%,100% 100%)}
.p[data-place=city] .near::after,.p[data-place=town] .near::after{content:"";position:absolute;inset:0;opacity:var(--lit);background:radial-gradient(2px 3px at 19% 40%,#ffd27a 60%,transparent),radial-gradient(2px 3px at 32% 52%,#ffd27a 60%,transparent),radial-gradient(2px 3px at 47% 34%,#ffe2a8 60%,transparent),radial-gradient(2px 3px at 63% 48%,#ffd27a 60%,transparent),radial-gradient(2px 3px at 74% 38%,#ffe2a8 60%,transparent),radial-gradient(2px 3px at 90% 56%,#ffd27a 60%,transparent),radial-gradient(2px 3px at 8% 62%,#ffe2a8 60%,transparent)}
.p:is([data-place=town],[data-place=village]) .far{clip-path:polygon(0 100%,0 62%,8% 62%,12% 50%,16% 62%,26% 62%,26% 54%,34% 44%,42% 54%,42% 62%,52% 62%,58% 48%,64% 62%,74% 62%,74% 52%,80% 40%,86% 52%,86% 62%,100% 62%,100% 100%)}
.p[data-place=town] .near{clip-path:polygon(0 100%,0 48%,6% 48%,12% 30%,18% 48%,22% 48%,22% 36%,30% 22%,38% 36%,38% 48%,46% 48%,52% 28%,58% 48%,64% 48%,64% 40%,72% 24%,80% 40%,80% 48%,88% 48%,94% 32%,100% 44%,100% 100%)}
.p[data-place=village] .near{clip-path:polygon(0 100%,0 60%,5% 52%,9% 60%,14% 58%,20% 42%,26% 58%,30% 58%,30% 50%,36% 38%,42% 50%,42% 60%,55% 60%,60% 48%,65% 60%,74% 58%,80% 44%,86% 58%,92% 54%,100% 60%,100% 100%)}
.p:is([data-place=forest],[data-place=plains]) .far{clip-path:polygon(0 100%,0 56%,3% 46%,6% 56%,9% 42%,13% 56%,17% 45%,21% 56%,25% 38%,29% 56%,33% 47%,37% 56%,41% 41%,45% 56%,49% 48%,53% 56%,57% 39%,61% 56%,65% 46%,69% 56%,73% 40%,77% 56%,81% 48%,85% 56%,89% 41%,93% 56%,97% 47%,100% 52%,100% 100%)}
.p[data-place=forest] .near{clip-path:polygon(0 100%,0 64%,4% 40%,8% 64%,12% 34%,17% 64%,21% 46%,25% 64%,30% 26%,35% 64%,39% 50%,43% 64%,48% 32%,53% 64%,57% 54%,61% 64%,66% 28%,71% 64%,75% 48%,79% 64%,84% 36%,89% 64%,93% 52%,97% 64%,100% 56%,100% 100%)}
.p[data-place=plains] .far{height:30%;clip-path:ellipse(80% 60% at 30% 100%)}
.p[data-place=plains] .near{height:22%;clip-path:ellipse(90% 70% at 70% 100%)}
.p[data-place=mountain] .far{height:64%;clip-path:polygon(0 100%,0 60%,10% 44%,18% 52%,28% 26%,38% 48%,46% 36%,56% 54%,66% 30%,76% 50%,86% 34%,100% 52%,100% 100%)}
.p[data-place=mountain] .near{height:48%;background:linear-gradient(100deg,color-mix(in oklab,var(--near) 70%,#fff) 0 46%,var(--near) 52%);clip-path:polygon(0 100%,0 70%,14% 44%,24% 60%,36% 30%,48% 62%,58% 50%,70% 74%,82% 42%,92% 62%,100% 54%,100% 100%)}
.p[data-place=mountain][data-wx=snow] .near{background:linear-gradient(100deg,#f8fafd 0 46%,#cdd8e6 52%,#e9eef5)}
.p:is([data-place=coast],[data-place=sea]) .far{height:36%;background:repeating-linear-gradient(180deg,rgba(255,255,255,.12) 0 1px,transparent 1px 8px),linear-gradient(180deg,color-mix(in oklab,var(--s3) 45%,var(--near)),var(--near))}
.p[data-place=coast] .near{height:56%;clip-path:polygon(0 100%,0 30%,6% 26%,12% 34%,17% 44%,21% 60%,24% 68%,27% 100%)}
.p[data-place=sea] .near{display:none}
.p[data-place=desert] .far{height:34%;clip-path:ellipse(70% 60% at 25% 100%);background:color-mix(in oklab,var(--far) 60%,#c98a4a)}
.p[data-place=desert] .near{height:26%;clip-path:ellipse(80% 70% at 78% 100%);background:color-mix(in oklab,var(--near) 60%,#8a5a2a)}
.p[data-place=underground] .far{height:100%;background:radial-gradient(60% 70% at 50% 100%,transparent 55%,#0a0808 57%)}
.p[data-place=underground] .near{height:30%;background:#0a0808;clip-path:polygon(0 100%,0 40%,12% 60%,20% 30%,34% 70%,50% 50%,64% 72%,78% 36%,90% 58%,100% 44%,100% 100%)}
.p[data-place=space] :is(.far,.near,.clouds){display:none}
.room{display:none}
.p[data-place=interior] .room{display:block}
.p[data-place=interior] .scene{inset:auto;right:7%;top:13%;width:clamp(116px,26%,190px);aspect-ratio:1/1.1;border-radius:999px 999px 6px 6px;border:7px solid #1b120c;box-shadow:inset 0 0 0 2px #604330,0 10px 26px rgba(0,0,0,.55);z-index:1}
.p[data-place=interior] .scene::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent calc(50% - 2.5px),#1b120c calc(50% - 2.5px) calc(50% + 2.5px),transparent calc(50% + 2.5px)),linear-gradient(180deg,transparent calc(48% - 2.5px),#1b120c calc(48% - 2.5px) calc(48% + 2.5px),transparent calc(48% + 2.5px))}
.p[data-place=interior] :is(.near,.rays){display:none}
.p[data-place=interior] .far{height:30%}
.wall{background:radial-gradient(circle at 50% 50%,rgba(255,214,160,.08) 0 2px,transparent 3px) 0 0/26px 26px,radial-gradient(circle at 50% 50%,rgba(255,214,160,.05) 0 1.5px,transparent 2.5px) 13px 13px/26px 26px,linear-gradient(180deg,#3d2819,#24170f)}
.wain{top:auto;height:26%;border-top:4px solid #5a3c25;background:repeating-linear-gradient(90deg,#231509 0 2px,transparent 2px 22%),linear-gradient(#2c1b10,#1a100a)}
.lamp{opacity:calc(.35 + var(--lit) * .65);background:radial-gradient(40% 70% at 10% 96%,rgba(255,170,80,.6),transparent 70%)}
.motes{background:radial-gradient(1.5px 1.5px at 20% 70%,rgba(255,220,170,.8),transparent),radial-gradient(1px 1px at 35% 40%,rgba(255,220,170,.7),transparent),radial-gradient(1.5px 1.5px at 12% 50%,rgba(255,220,170,.6),transparent);background-size:220px 180px}
.roomflash{opacity:0;background:radial-gradient(60% 90% at 82% 32%,rgba(220,232,255,.3),transparent 70%)}
.scrim{background:linear-gradient(0deg,rgba(6,8,18,.6),rgba(6,8,18,.12) 48%,transparent 70%)}
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
.strip{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 12px;background:linear-gradient(0deg,rgba(6,8,18,.62),rgba(6,8,18,.28));border-top:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(10px) saturate(1.2);backdrop-filter:blur(10px) saturate(1.2)}
.gl{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;white-space:nowrap;font:500 12px/1 "DM Mono",ui-monospace,Menlo,monospace;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16)}
.gl:empty{display:none}
.thermo{position:relative;width:6px;height:14px;border-radius:3px;background:rgba(255,255,255,.25);overflow:hidden}
.thermo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:calc(var(--t) * 100%);background:linear-gradient(0deg,#69b7ff,#ffb86b 70%,#ff6b6b)}
.wind{display:inline-block;font-style:normal;font-size:11px;transform:rotate(calc(var(--wd) * 1deg - 90deg))}
.mo{width:13px;height:13px;border-radius:50%;background:#f4f1e6;box-shadow:inset calc(var(--ph) / 3) 0 0 0 #2a2f4a}
.p[data-genre=mystery] .kicker{padding:5px 10px 4px;border-radius:5px 5px 0 0;background:#efe2c4;color:#3a2c1c;opacity:1;transform:rotate(-1.2deg);box-shadow:0 3px 10px rgba(0,0,0,.35)}
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
 .rain{animation:rain .75s linear infinite}.rain.r2{animation-duration:1.05s}
 .snow{animation:snow 10s linear infinite}.snow.big{animation-duration:6s}
 .clouds{animation:drift 60s linear infinite alternate}
 .p[data-wx=storm] :is(.flash,.roomflash){animation:flash 7s ease-out infinite}
 .rays{animation:spin 90s linear infinite}
 .windl{animation:gust 1.4s linear infinite}
 .fog{animation:breathe 14s ease-in-out infinite alternate}
 .lamp{animation:flicker 4.5s ease-in-out infinite}
 .motes{animation:motes 26s linear infinite}
 .title>*{animation:rise 1s cubic-bezier(.2,.7,.2,1) both}.title>*:nth-child(2){animation-delay:.12s}
 .mk::before{animation:pulse 2.8s ease-in-out infinite}
}
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
@media (max-width:560px){.p{min-height:236px;border-radius:18px}.dial{width:46px;height:46px}.dial::before{inset:6px}.dial span{font-size:9.5px}.gl{font-size:11px;padding:5px 8px}}
`;

// Header grammar (no "u" flag: emoji are matched as literal code-unit sequences).
// Groups: 1 date · 2 hour · 3 minute · 4 glyph · 5 condition text · 6/7 sunrise ·
// 8/9 sunset · 10 moon · 11 place path · 12 title
// Any clock glyph opens the time: models drift from 🕰 to the hour faces
// 🕐–🕧 (written as surrogates, since there is no "u" flag), ⏰, ⌚, ⏱ or ⏲.
const CLOCK = R`(?:🕰|\uD83D[\uDD50-\uDD67]|⏰|⌚|⏱|⏲)`;
export const PLATE_FIND = R`(?:^|\n)[ \t]*(?:\*\*)?🗓️?[ \t]*((?:(?!${CLOCK})[^\n])*?)[ \t]*(?:${CLOCK}️?)?[ \t]*0?(\d|1\d|2[0-3]):([0-5]\d)[ \t]*(?:(☀|🌙|✨|🌤|⛅|🌥|☁|🌦|🌧|⛈|🌩|🌨|❄|🧊|🌫|🌬|🌪|🔥|🌡)️?)?[ \t]*([^\n⟪]*?)[ \t]*(?:\*\*)?[ \t]*(?:⟪(\d{1,2}):(\d\d)\|(\d{1,2}):(\d\d)\|([^⟫\n]*)⟫)?[ \t]*(?:\n[ \t]*(?:\*\*)?📍️?[ \t]*([^\n]*?)(?:\*\*)?)?[ \t]*(?:\n[ \t]*#{1,3}[ \t]+([^\n]+))?(?=\n|$)`;

const BAND = R`{{switch::$2::0::night::1::night::2::small::3::small::4::predawn::5::dawn::6::sunrise::7::morning::8::morning::9::morning::10::morning::11::midday::12::midday::13::midday::14::afternoon::15::afternoon::16::afternoon::17::golden::18::sunset::19::dusk::20::evening::21::evening::night}}`;
const WX = R`{{switch::$4::☀::clear::🌙::clear::✨::clear::🌤::fair::⛅::broken::🌥::broken::☁::overcast::🌦::showers::🌧::rain::⛈::storm::🌩::storm::🌨::snow::❄::snow::🧊::sleet::🌫::fog::🌬::wind::🌪::storm::🔥::heat::🌡::heat::{{if::{{matches::$5::storm|thunder::i}}}}storm{{else}}{{if::{{matches::$5::snow|blizzard::i}}}}snow{{else}}{{if::{{matches::$5::rain|drizzle|shower::i}}}}rain{{else}}{{if::{{matches::$5::fog|mist::i}}}}fog{{else}}{{if::{{matches::$5::overcast|cloud::i}}}}overcast{{else}}clear{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}}}`;
const INT = R`{{if::{{matches::$5::torrential|downpour|blizzard|driving::i}}}}torrential{{else}}{{if::{{matches::$5::heavy|hard|thick|dense::i}}}}heavy{{else}}{{if::{{matches::$5::light|drizzle|thin|fine|patchy::i}}}}light{{else}}moderate{{/if}}{{/if}}{{/if}}`;
const SEASON = R`{{if::{{matches::$1::spring::i}}}}spring{{else}}{{if::{{matches::$1::summer|midsummer::i}}}}summer{{else}}{{if::{{matches::$1::autumn|fall\b|harvest::i}}}}autumn{{else}}{{if::{{matches::$1::winter|midwinter|yule::i}}}}winter{{else}}{{if::{{matches::$1::\b(?:Mar|Apr|May)[a-z]*\b}}}}spring{{else}}{{if::{{matches::$1::\b(?:Jun|Jul|Aug)[a-z]*\b}}}}summer{{else}}{{if::{{matches::$1::\b(?:Sep|Oct|Nov)[a-z]*\b}}}}autumn{{else}}{{if::{{matches::$1::\b(?:Dec|Jan|Feb)[a-z]*\b}}}}winter{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}`;
const PLACE = R`{{if::{{matches::$11::\b(?:tavern|inn|room|hall|chamber|house|home|office|shop|store|bedroom|kitchen|library|cabin|parlou?r|study|bar|pub|salon|apartment|flat|cell|temple|church|chapel|interior|inside|lobby|corridor|attic|cellar|gallery|ballroom|theatre|theater|carriage|train|bath|clinic|hospital|lab|classroom|dorm|restaurant|caf[eé]|diner|bunk|throne|manor|mansion|palace|castle|tower|bridge of)\b::i}}}}interior{{else}}{{if::{{matches::$11::\b(?:space|orbit|station|starship|void|asteroid)\b::i}}}}space{{else}}{{if::{{matches::$11::\b(?:cave|cavern|tunnel|mine|sewer|crypt|catacomb|dungeon|underground|undercroft|vault)\b::i}}}}underground{{else}}{{if::{{matches::$11::\b(?:forest|wood|woods|grove|jungle|thicket|glade|orchard|garden|park)\b::i}}}}forest{{else}}{{if::{{matches::$11::\b(?:sea|ocean|deck|ship|boat|open water)\b::i}}}}sea{{else}}{{if::{{matches::$11::\b(?:harbou?r|dock|docks|pier|wharf|beach|coast|cliff|shore|bay|port|quay|lighthouse)\b::i}}}}coast{{else}}{{if::{{matches::$11::\b(?:mountain|peak|pass|summit|ridge|alps|glacier|highlands?)\b::i}}}}mountain{{else}}{{if::{{matches::$11::\b(?:desert|dunes?|waste|wastes|badlands|oasis|steppe)\b::i}}}}desert{{else}}{{if::{{matches::$11::\b(?:plain|plains|field|fields|meadow|farm|moor|heath|prairie|road|trail|countryside)\b::i}}}}plains{{else}}{{if::{{matches::$11::\b(?:village|hamlet|farmstead)\b::i}}}}village{{else}}{{if::{{matches::$11::\b(?:city|street|square|market|district|avenue|alley|downtown|capital|metropolis|plaza|quarter|borough|lane)\b::i}}}}city{{else}}town{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}`;
const MOONPH = R`{{if::{{matches::$10::🌑|new moon::i}}}}44px{{else}}{{if::{{matches::$10::🌒|waxing crescent::i}}}}26px{{else}}{{if::{{matches::$10::🌓|first quarter::i}}}}18px{{else}}{{if::{{matches::$10::🌔|waxing gibbous::i}}}}8px{{else}}{{if::{{matches::$10::🌖|waning gibbous::i}}}}-8px{{else}}{{if::{{matches::$10::🌗|last quarter|third quarter::i}}}}-18px{{else}}{{if::{{matches::$10::🌘|waning crescent::i}}}}-26px{{else}}0px{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}`;
const WIND = R`{{setvar::alm_wd::{{upper::{{regex::^.*?\bwind[ \t]+(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)\b.*$::$$1::$5::i}}}}}}{{switch::{{getvar::alm_wd}}::N::180::NNE::202::NE::225::ENE::247::E::270::ESE::292::SE::315::SSE::337::S::0::SSW::22::SW::45::WSW::67::W::90::WNW::112::NW::135::NNW::157::90}}`;
const TEMP = R`{{setvar::alm_tc::{{regex::^.*?(-?\d{1,3})[ \t]*°[ \t]*C\b.*$::$$1::$5::i}}}}{{if::{{matches::{{getvar::alm_tc}}::^-?\d+$}}}}--t:clamp(0,calc(({{getvar::alm_tc}} + 10) / 50),1);{{/if}}`;
// Condition pills: split "heavy rain · 9°C · wind SW" into glass pills; wind gets an arrow.
const PILLS = R`{{regex::[ \t]*[·•|][ \t]*::</span><span class="gl">::{{regex::(-?\d{1,3})[ \t]*°[ \t]*([CF])\b::<i class="thermo"></i>$$1°$$2::{{regex::\bwind[ \t]+([NSEW]{1,3})\b::<i class="wind">➤</i> $$1::$5::i}}::i}}::g}}`;

export const PLATE_REPLACE =
  "\n" + R`<div class="p" data-band="${BAND}" data-wx="${WX}" data-int="${INT}" data-season="${SEASON}" data-place="${PLACE}" data-genre="{{default::{{getchatvar::alm_ui_lead}}::drama}}" ` +
  `style="--h:calc($2 + $3 / 60);{{if::$6}}--rise:calc($6 + $7 / 60);--set:calc($8 + $9 / 60);{{/if}}--ph:${MOONPH};--wd:${WIND};${TEMP}"><style>${minCss(PLATE_CSS)}</style>` +
  R`<div class="scene"><div class="l sky"></div><div class="l wash"></div><div class="l stars"></div><div class="l rays"></div><div class="l sun"></div><div class="l moon"></div><div class="l clouds"></div><div class="l far"></div><div class="l near"></div><div class="l fog"></div><div class="l windl"></div><div class="l heat"></div><div class="l rain"></div><div class="l rain r2"></div><div class="l snow"></div><div class="l snow big"></div><div class="l flash"></div></div>` +
  R`<div class="l room wall"></div><div class="l room wain"></div><div class="l room lamp"></div><div class="l room motes"></div><div class="l room roomflash"></div><div class="l scrim"></div>` +
  R`<div class="top"><span class="crumb">{{regex::[ \t]*›[ \t]*([^›]*)$::<span>›</span> <b>$$1</b>::{{regex::[ \t]*›[ \t]*(?=[^›]*›)::<span>›</span> ::$11::g}}}}</span><span class="dial"><i class="mk"></i><span>{{if::{{lt::$2::10}}}}0{{/if}}$2:$3</span></span></div>` +
  R`<div class="title"><span class="kicker">{{regex::^\s*((?:Day|Dia|Día|Jour|Tag)\s*\d+).*$::$$1::$1::i}}{{if::{{getchatvar::alm_ui_lead}}}} · {{replace::_:: ::{{getchatvar::alm_ui_lead}}}}{{/if}}</span><h3 class="ttl">$12</h3></div>` +
  R`<div class="strip"><span class="gl">🗓 {{regex::^\s*(?:(?:Day|Dia|Día|Jour|Tag)\s*\d+\s*[·•|,]\s*)?::::$1::i}}</span><span class="gl">{{if::$4}}$4 {{/if}}${PILLS}</span>{{if::$6}}<span class="gl">☀ $6:$7 – $8:$9</span>{{/if}}{{if::$10}}<span class="gl"><i class="mo"></i>$10</span>{{/if}}</div></div>` + "\n";

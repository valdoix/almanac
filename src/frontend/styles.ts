// The ALMANAC stylesheet (linked mode): regex draws structure, this paints it.
// The base tokens here follow Lumiverse's theme (the "Follow Lumiverse" skin);
// the fixed skins and their light/dark palettes live in skins.ts. Standalone "Lite"
// inline styles from the preset regex are overridden here with !important.

export const TOKENS = `
:root{
  --alm-ink:var(--lumiverse-text,#2a231d);
  --alm-muted:var(--lumiverse-text-muted,#76695a);
  --alm-panel:color-mix(in oklab,var(--lumiverse-fill-subtle,#fffaf1) 94%,#c4922c 6%);
  --alm-panel-2:color-mix(in oklab,var(--alm-panel) 90%,var(--alm-ink) 6%);
  --alm-line:color-mix(in oklab,var(--lumiverse-border,#e3d3b8) 80%,#c4922c 20%);
  --alm-accent:color-mix(in oklab,var(--lumiverse-accent,#b5602a) 55%,#c4702a 45%);
  --alm-accent-2:#4f7ab0; --alm-gold:#c4922c; --alm-good:#3f9a62; --alm-warn:#c58a22; --alm-danger:#cc4a4a;
  --alm-font-display:"Fraunces","Iowan Old Style",Palatino,Georgia,serif;
  --alm-font-body:inherit;
  --alm-font-mono:"DM Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --alm-font-hand:"Caveat","Segoe Print","Bradley Hand",cursive;
  --alm-radius:18px; --alm-r-sm:12px;
  --alm-shadow:0 18px 40px -26px rgba(40,25,10,.55),0 2px 6px -3px rgba(40,25,10,.18);
  --alm-lift:0 12px 24px -18px rgba(40,25,10,.55);
  --alm-texture:radial-gradient(color-mix(in oklab,var(--alm-ink) 7%,transparent) 1px,transparent 1.3px) 0 0/15px 15px;
  --alm-on-voice:#fff; --alm-on-accent:#fff;
}
`;

export const MESSAGE_CSS = `
.alm-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}

/* ── Voice cards (Blocks) ── */
.alm-say{--c:var(--alm-muted);position:relative!important;display:grid!important;grid-template-columns:44px minmax(0,1fr)!important;gap:0 14px!important;margin:22px 0 16px!important;align-items:start!important;font-family:var(--alm-font-body)}
.alm-say__medal{position:relative!important;width:44px!important;height:44px!important;border-radius:50%!important;display:grid!important;place-items:center!important;margin-top:4px!important;
  font:700 19px/1 var(--alm-font-display)!important;color:var(--alm-on-voice)!important;
  background:radial-gradient(circle at 32% 26%,color-mix(in oklab,var(--c) 38%,#fff) 0 14%,var(--c) 56%,color-mix(in oklab,var(--c) 72%,#000) 100%)!important;
  box-shadow:0 0 0 2.5px var(--alm-panel),0 0 0 4.5px color-mix(in oklab,var(--c) 45%,transparent),0 10px 18px -8px color-mix(in oklab,var(--c) 80%,#000)!important}
.alm-say__bubble{position:relative!important;min-width:0!important;padding:18px 18px 12px!important;border-radius:6px var(--alm-radius) var(--alm-radius) var(--alm-radius)!important;
  background:linear-gradient(135deg,color-mix(in oklab,var(--c) 14%,var(--alm-panel)),color-mix(in oklab,var(--c) 4%,var(--alm-panel)) 70%)!important;
  border:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line))!important;box-shadow:var(--alm-lift)!important;color:var(--alm-ink)}
.alm-say__bubble::before{content:"";position:absolute;left:-7px;top:18px;width:12px;height:12px;transform:rotate(45deg);
  background:color-mix(in oklab,var(--c) 14%,var(--alm-panel));border-left:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line));border-bottom:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line))}
.alm-say__bubble::after{content:"\\201C";position:absolute;right:12px;top:-6px;font:700 88px/1 var(--alm-font-display);color:var(--c);opacity:.13;pointer-events:none}
.alm-say__who{position:absolute!important;top:-12px!important;left:16px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;padding:5px 11px!important;border-radius:999px!important;
  background:var(--c)!important;color:var(--alm-on-voice)!important;font:500 10.5px/1 var(--alm-font-mono)!important;letter-spacing:.16em!important;text-transform:uppercase!important;
  box-shadow:0 6px 12px -6px color-mix(in oklab,var(--c) 90%,#000)!important}
.alm-say__tone{font-style:italic!important;font-weight:500!important;font-size:12px!important;line-height:1!important;font-family:var(--alm-font-body)!important;letter-spacing:.02em!important;text-transform:none!important;padding-left:7px!important;border-left:1px solid color-mix(in oklab,var(--alm-on-voice) 45%,transparent)!important;opacity:1!important}
.alm-say__line{display:block!important;font-size:1.06em!important;line-height:1.5!important;color:var(--alm-ink)!important;font-style:normal}
.alm-say__beat{display:block!important;margin-top:8px!important;padding-top:7px!important;border-top:1px dashed color-mix(in oklab,var(--c) 25%,var(--alm-line))!important;color:var(--alm-muted)!important;font-size:.9em!important;font-style:italic!important}
.alm-say--user{grid-template-columns:minmax(0,1fr) 44px!important;margin-left:12%!important}
.alm-say--user .alm-say__medal{grid-column:2;grid-row:1}
.alm-say--user .alm-say__bubble{grid-column:1;grid-row:1;text-align:right;border-radius:var(--alm-radius) 6px var(--alm-radius) var(--alm-radius)!important}
.alm-say--user .alm-say__bubble::before{left:auto;right:-7px;border-left:0;border-bottom:0;border-right:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line));border-top:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line))}
.alm-say--user .alm-say__bubble::after{right:auto;left:12px}
.alm-say--user .alm-say__who{left:auto!important;right:16px!important}
.alm-say--follow{margin-top:-10px!important}
.alm-say--follow .alm-say__medal{visibility:hidden!important;height:0!important}
.alm-say--follow .alm-say__who{display:none!important}
.alm-say--follow .alm-say__bubble::before,.alm-say--follow .alm-say__bubble::after{content:none}
/* tones */
.alm-say[data-tone="whisper"] .alm-say__bubble,.alm-say[data-tone="breathless"] .alm-say__bubble{border-style:dashed!important;background:color-mix(in oklab,var(--c) 6%,var(--alm-panel))!important;box-shadow:none!important}
.alm-say[data-tone="whisper"] .alm-say__bubble::before,.alm-say[data-tone="breathless"] .alm-say__bubble::before{background:color-mix(in oklab,var(--c) 6%,var(--alm-panel));border-left-style:dashed;border-bottom-style:dashed}
.alm-say[data-tone="whisper"] .alm-say__line,.alm-say[data-tone="breathless"] .alm-say__line{font-style:italic!important;color:color-mix(in oklab,var(--alm-ink) 78%,var(--alm-panel))!important;letter-spacing:.01em}
.alm-say[data-tone="whisper"] .alm-say__medal::after{content:"";position:absolute;inset:-8px;border-radius:50%;border:2px dotted color-mix(in oklab,var(--c) 55%,transparent)}
.alm-say[data-tone="murmur"] .alm-say__line{font-style:italic!important;opacity:.9}
.alm-say[data-tone="shout"] .alm-say__bubble{transform:rotate(-.7deg);border:2px solid var(--c)!important;box-shadow:5px 5px 0 color-mix(in oklab,var(--c) 28%,transparent)!important}
.alm-say[data-tone="shout"] .alm-say__bubble::before{border-width:2px;border-color:var(--c);left:-8px}
.alm-say[data-tone="shout"] .alm-say__line{font-weight:650!important;font-size:1.16em!important}
.alm-say[data-tone="shout"] .alm-say__medal::before{content:"";position:absolute;inset:-12px;z-index:-1;background:color-mix(in oklab,var(--c) 30%,transparent);
  clip-path:polygon(50% 0,61% 22%,85% 12%,78% 37%,100% 50%,78% 63%,85% 88%,61% 78%,50% 100%,39% 78%,15% 88%,22% 63%,0 50%,22% 37%,15% 12%,39% 22%)}
.alm-say[data-tone="tender"] .alm-say__bubble,.alm-say[data-tone="sob"] .alm-say__bubble{box-shadow:0 0 0 5px color-mix(in oklab,var(--c) 9%,transparent),0 18px 34px -18px color-mix(in oklab,var(--c) 70%,transparent)!important}
.alm-say[data-tone="tender"] .alm-say__bubble::after,.alm-say[data-tone="sob"] .alm-say__bubble::after{content:"♡";font-size:52px;top:6px;opacity:.16}
.alm-say[data-tone="sob"] .alm-say__line{font-style:italic!important}
.alm-say[data-tone="cold"] .alm-say__bubble{background:linear-gradient(135deg,color-mix(in oklab,#7fb3d9 16%,var(--alm-panel)),var(--alm-panel) 75%)!important;border-color:color-mix(in oklab,#7fb3d9 40%,var(--alm-line))!important}
.alm-say[data-tone="cold"] .alm-say__bubble::before{background:color-mix(in oklab,#7fb3d9 16%,var(--alm-panel));border-color:color-mix(in oklab,#7fb3d9 40%,var(--alm-line))}
.alm-say[data-tone="cold"] .alm-say__line{letter-spacing:.025em;color:color-mix(in oklab,var(--alm-ink) 85%,#7fb3d9)!important}
.alm-say[data-tone="cold"] .alm-say__bubble::after{content:"❄";font-size:38px;top:8px;opacity:.2;color:#7fb3d9}
.alm-say[data-tone="sing"] .alm-say__line{text-decoration:underline wavy color-mix(in oklab,var(--c) 45%,transparent);text-underline-offset:6px;text-decoration-thickness:1.5px}
.alm-say[data-tone="sing"] .alm-say__bubble::after{content:"♪ ♫";font-size:28px;top:8px;letter-spacing:.2em}
.alm-say[data-tone="sly"] .alm-say__who{transform:rotate(-3deg)}
.alm-say[data-tone="sly"] .alm-say__bubble{border-radius:6px var(--alm-radius) 6px var(--alm-radius)!important}
.alm-say[data-tone="sly"] .alm-say__line{font-style:italic!important}
.alm-say[data-tone="sly"] .alm-say__bubble::after{content:"✧";font-size:42px;top:6px}
.alm-say[data-tone="flat"] .alm-say__bubble{background:color-mix(in oklab,var(--c) 5%,var(--alm-panel))!important}
.alm-say[data-tone="flat"] .alm-say__bubble::after{content:none}
.alm-say[data-spk="?"]{--c:var(--alm-muted)!important}

/* chips, tint, script */
.alm-chip{--c:var(--alm-muted);padding:2px 9px 3px 3px!important;border-radius:999px!important;background:color-mix(in oklab,var(--c) 13%,transparent)!important;
  box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--c) 30%,transparent)!important;-webkit-box-decoration-break:clone;box-decoration-break:clone;color:inherit!important}
.alm-chip__dot{display:inline-grid!important;place-items:center!important;width:20px!important;height:20px!important;margin-right:6px!important;border-radius:50%!important;vertical-align:-3px!important;
  background:var(--c)!important;color:var(--alm-on-voice)!important;font:700 11px/1 var(--alm-font-display)!important}
.alm-tint{--c:var(--alm-muted);color:color-mix(in oklab,var(--c) 75%,var(--alm-ink))!important;text-decoration:underline;text-decoration-color:color-mix(in oklab,var(--c) 35%,transparent);text-underline-offset:4px;text-decoration-thickness:2px}
.alm-script{--c:var(--alm-muted);display:grid!important;grid-template-columns:auto 1fr!important;gap:4px 12px!important;margin:10px 0!important}
.alm-script__n{font:500 11px/1.9 var(--alm-font-mono)!important;letter-spacing:.1em;color:var(--c)!important;text-align:right;border-right:2px solid color-mix(in oklab,var(--c) 35%,transparent);padding-right:8px;text-transform:uppercase}
.alm-script__par{color:var(--alm-muted);font-style:italic;font-size:.92em}
/* thought bubble */
.alm-thk{--c:var(--alm-muted);position:relative!important;display:block!important;width:fit-content;max-width:88%;margin:16px 0 24px 58px!important;padding:10px 20px 12px!important;border-radius:30px!important;
  background:color-mix(in oklab,var(--c) 8%,var(--alm-panel))!important;border:1.5px dashed color-mix(in oklab,var(--c) 50%,var(--alm-line))!important;
  font:600 22px/1.25 var(--alm-font-hand)!important;color:color-mix(in oklab,var(--c) 62%,var(--alm-ink))!important;font-style:normal!important}
.alm-thk::before,.alm-thk::after{content:"";position:absolute;border-radius:50%;background:inherit;border:inherit}
.alm-thk::before{width:15px;height:15px;left:-22px;top:14px}
.alm-thk::after{width:8px;height:8px;left:-38px;top:6px}
.alm-thk__lab{display:block!important;font:500 9.5px/1.6 var(--alm-font-mono)!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:var(--c)!important}
/* painted sign */
.alm-txt{display:inline-block!important;padding:3px 18px!important;border-radius:6px!important;transform-origin:50% -14px;
  background:radial-gradient(circle at 7px 50%,#c9a24a 0 2px,transparent 2.5px),radial-gradient(circle at calc(100% - 7px) 50%,#c9a24a 0 2px,transparent 2.5px),linear-gradient(#2f4c40,#1d3429)!important;
  color:#f3e4b5!important;border:2px solid #c9a24a!important;box-shadow:inset 0 0 0 2px #17291f,0 6px 10px -5px rgba(0,0,0,.45)!important;
  font:500 .72em/1.5 var(--alm-font-mono)!important;letter-spacing:.16em!important;text-transform:uppercase!important}
.alm-txt[data-kind="screen"]{background:#0b1512!important;color:#7dffb8!important;border-color:#1e3b30!important;box-shadow:0 0 12px rgba(80,255,170,.18)!important}
.alm-txt[data-kind="neon"]{background:#150b1a!important;color:#ff7ad9!important;border-color:#ff7ad9!important;text-shadow:0 0 8px #ff7ad9}
.alm-txt[data-kind="chalk"]{background:#253028!important;color:#eef0e8!important;border-color:#6b5a3a!important;font-family:var(--alm-font-hand)!important;font-size:1em!important;text-transform:none!important;letter-spacing:.02em!important}

/* chapter card, OOC card, folio */
.alm-chapter{display:grid!important;grid-template-columns:1fr auto 1fr!important;align-items:center!important;gap:16px!important;margin:28px 0 22px!important;text-align:center!important}
.alm-chapter::before,.alm-chapter::after{content:"";height:10px;background:radial-gradient(circle,var(--alm-gold) 0 2.5px,transparent 3px) center/10px 10px no-repeat,linear-gradient(var(--alm-gold),var(--alm-gold)) center/100% 1px no-repeat;
  -webkit-mask:linear-gradient(90deg,transparent,#000 60%);mask:linear-gradient(90deg,transparent,#000 60%)}
.alm-chapter::after{transform:scaleX(-1)}
.alm-chapter small{display:block!important;font:500 10.5px/1 var(--alm-font-mono)!important;letter-spacing:.3em!important;text-transform:uppercase!important;color:var(--alm-accent)!important}
.alm-chapter b{display:block!important;margin-top:6px!important;font:600 italic 26px/1.1 var(--alm-font-display)!important;color:var(--alm-ink)!important}
.alm-chapter b::before,.alm-chapter b::after{content:"❦";font-style:normal;font-size:.6em;color:var(--alm-gold);margin:0 .5em;vertical-align:.18em}
.alm-chapter b::before{display:inline-block;transform:scaleX(-1)}
.alm-ooc{position:relative!important;margin:14px 0!important;padding:14px 16px 12px!important;border:1.5px dashed var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;background:var(--alm-panel-2)!important;color:var(--alm-muted)!important;font-size:.95em}
.alm-ooc::before{content:"OOC";position:absolute;top:-10px;left:14px;padding:2px 8px;border-radius:6px;background:var(--alm-muted);color:var(--alm-panel);font:500 10px/1.4 var(--alm-font-mono);letter-spacing:.16em}
.alm-folio{margin:14px 0!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;background:var(--alm-panel)!important;box-shadow:var(--alm-shadow)!important;overflow:hidden}
.alm-folio__hd{padding:10px 14px!important;background:linear-gradient(90deg,var(--alm-accent),color-mix(in oklab,var(--alm-accent) 60%,var(--alm-accent-2)))!important;color:var(--alm-on-accent)!important;font:600 12px/1.2 var(--alm-font-mono)!important;letter-spacing:.16em;text-transform:uppercase}
.alm-folio__bd{padding:12px 16px!important}

/* ── Drawers (unspoken, director's notes, ledger) ── */
details.alm-drawer{margin:16px 0 0!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;overflow:hidden!important;color:var(--alm-ink)!important;font-family:var(--alm-font-body)}
details.alm-drawer>summary{list-style:none!important;cursor:pointer;display:flex!important;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px!important;font:500 12.5px/1.2 var(--alm-font-mono)!important;color:var(--alm-muted)!important;background:var(--alm-panel-2)!important}
details.alm-drawer>summary::-webkit-details-marker{display:none}
details.alm-drawer[open]>summary{border-bottom:1px solid var(--alm-line)}
.alm-drawer__body{padding:14px!important;background-image:var(--alm-texture)}
.alm-pill{display:inline-flex!important;align-items:center;gap:6px;padding:6px 10px!important;border-radius:999px!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;color:var(--alm-ink)!important}
.alm-pill small{color:var(--alm-muted)}
.alm-pill--warn{color:var(--alm-warn)!important;border-color:color-mix(in oklab,var(--alm-warn) 45%,var(--alm-line))!important}
.alm-stack{display:inline-flex}
.alm-stack .alm-mini{margin-left:-5px;box-shadow:0 0 0 2px var(--alm-panel)}
.alm-stack .alm-mini:first-child{margin-left:0}
.alm-caret{margin-left:auto;display:inline-flex!important;align-items:center;gap:8px;padding:6px 11px!important;border-radius:999px!important;background:var(--alm-accent)!important;color:var(--alm-on-accent)!important;font-weight:500}
.alm-caret::after{content:"▾";transition:transform .25s}
details[open]>summary .alm-caret::after{transform:rotate(180deg)}
.alm-mini{--c:var(--alm-muted);display:inline-grid!important;place-items:center;flex:none;width:22px!important;height:22px!important;border-radius:50%!important;background:var(--c)!important;color:var(--alm-on-voice)!important;font:700 10.5px/1 var(--alm-font-display)!important}

/* sealed envelopes */
.alm-envs{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:12px!important;align-items:start}
details.alm-env{--c:var(--alm-muted);position:relative!important;border-radius:10px!important;background:color-mix(in oklab,var(--c) 7%,var(--alm-panel-2))!important;
  border:1px solid color-mix(in oklab,var(--c) 25%,var(--alm-line))!important;box-shadow:var(--alm-lift)!important;overflow:hidden!important;perspective:600px}
details.alm-env>summary{list-style:none!important;cursor:pointer;position:relative;min-height:112px;padding:62px 14px 12px!important;text-align:center}
details.alm-env>summary::-webkit-details-marker{display:none}
.alm-env__flap{position:absolute!important;left:0;right:0;top:0;height:64px;transform-origin:top;transition:transform .5s cubic-bezier(.3,.7,.3,1);
  background:color-mix(in oklab,var(--c) 16%,var(--alm-panel-2))!important;clip-path:polygon(0 0,100% 0,50% 100%);filter:drop-shadow(0 2px 0 rgba(0,0,0,.08))}
.alm-env__wax{position:absolute!important;left:50%;top:40px;width:38px;height:38px;margin-left:-19px;border-radius:50%;display:grid!important;place-items:center;z-index:1;
  background:radial-gradient(circle at 35% 30%,color-mix(in oklab,var(--c) 60%,#fff),var(--c) 60%,color-mix(in oklab,var(--c) 60%,#000))!important;
  color:var(--alm-on-voice)!important;font:700 15px/1 var(--alm-font-display)!important;box-shadow:0 3px 8px rgba(0,0,0,.3),inset 0 0 0 3px rgba(0,0,0,.12);transition:transform .4s,opacity .4s}
.alm-env__cue{display:block!important;margin-top:12px;font:500 10.5px/1.45 var(--alm-font-mono)!important;letter-spacing:.06em;text-transform:uppercase;color:var(--alm-muted)!important}
.alm-env__hint{display:block!important;margin-top:6px;font-style:italic!important;font-size:12px!important;line-height:1!important;font-family:var(--alm-font-body)!important;color:var(--c)!important}
.alm-env__hint::after{content:"break the seal"}
details.alm-env[open] .alm-env__hint::after{content:"reseal"}
details.alm-env[open] .alm-env__flap{transform:rotateX(180deg)}
details.alm-env[open] .alm-env__wax{transform:translateY(-44px) scale(.7);opacity:0}
.alm-env__inner{margin:0 12px 14px!important;padding:12px 14px!important;border-radius:6px!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;
  font:600 21px/1.3 var(--alm-font-hand)!important;color:var(--alm-ink)!important;box-shadow:0 -8px 16px -12px rgba(0,0,0,.3)}
.alm-env__inner::after{content:"— " attr(data-who);display:block;text-align:right;font-size:17px;color:var(--c)}
.alm-lockcap{display:flex!important;align-items:center;gap:8px;font:12px/1.4 var(--alm-font-mono)!important;color:var(--alm-muted)!important;margin-top:12px!important}

/* director's call sheet */
.alm-clap{height:14px;margin:-14px -14px 14px;background:repeating-linear-gradient(-45deg,var(--alm-ink) 0 14px,var(--alm-panel) 14px 28px);opacity:.85}
.alm-cs{display:grid!important;grid-template-columns:auto 1fr!important;gap:7px 12px!important;margin:0!important;font-size:14px;line-height:1.45}
.alm-cs dt{align-self:start;font:500 10px/1 var(--alm-font-mono)!important;letter-spacing:.12em;padding:5px 8px!important;border-radius:6px;color:var(--alm-panel)!important;background:var(--g,var(--alm-accent-2))!important;text-align:center}
.alm-cs dd{margin:0!important;padding-top:1px}
.alm-cs .g1{--g:var(--alm-accent-2)} .alm-cs .g2{--g:#7b5bd6} .alm-cs .g3{--g:var(--alm-accent)} .alm-cs .g4{--g:var(--alm-good)}
.alm-cs .risk{color:var(--alm-danger);font-weight:600}

/* ledger drawer sections */
details.alm-sub{margin:0 0 12px!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;background:var(--alm-panel)!important}
details.alm-sub>summary{list-style:none!important;cursor:pointer;display:flex!important;align-items:center;gap:10px;padding:10px 12px!important;font:500 11px/1 var(--alm-font-mono)!important;letter-spacing:.16em;text-transform:uppercase;color:var(--alm-ink)!important}
details.alm-sub>summary::-webkit-details-marker{display:none}
.alm-sub__ico{display:grid!important;place-items:center;width:26px;height:26px;border-radius:8px;background:color-mix(in oklab,var(--alm-accent) 14%,var(--alm-panel));font-size:13px;letter-spacing:0}
.alm-sub__ct{margin-left:auto;color:var(--alm-muted);letter-spacing:.06em;text-transform:none}
.alm-sub__ct::after{content:" ▸";display:inline-block;transition:transform .2s}
details.alm-sub[open]>summary .alm-sub__ct::after{transform:rotate(90deg)}
.alm-sub__in{padding:4px 12px 14px!important}
.alm-deltas{margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5;color:var(--alm-ink)}
.alm-rejected{margin-top:10px;padding:8px 10px;border-radius:10px;background:color-mix(in oklab,var(--alm-danger) 8%,var(--alm-panel));color:var(--alm-danger);font-size:12.5px}
.alm-rejected code{font:11px var(--alm-font-mono)}
.alm-list{margin:0;padding-left:18px;font-size:13.5px;line-height:1.55}
.alm-list li.due{color:var(--alm-danger);font-weight:600}
.alm-cast{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important;gap:12px}
.alm-cc{--c:var(--alm-muted);position:relative;border-radius:var(--alm-r-sm);background:var(--alm-panel);border:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line));overflow:hidden;box-shadow:var(--alm-lift)}
.alm-cc__band{position:relative;height:50px;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.12) 0 6px,transparent 6px 12px),linear-gradient(120deg,var(--c),color-mix(in oklab,var(--c) 55%,var(--alm-accent-2)))}
.alm-cc__tier{position:absolute;right:10px;top:10px;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,.22);color:#fff;font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.12em;text-transform:uppercase}
.alm-cc .alm-cc__medal{position:absolute!important;left:12px;top:24px;margin:0!important;width:46px!important;height:46px!important}
.alm-cc__bd{padding:28px 12px 12px}
.alm-cc__nm{font:700 17px/1.1 var(--alm-font-display)}
.alm-cc__em{margin-top:2px;font-style:italic;font-size:14px;line-height:1.3;font-family:var(--alm-font-body);color:var(--c)}
.alm-cc__em small{color:var(--alm-muted);font-style:normal}
.alm-vad{display:grid;grid-template-columns:14px 1fr;gap:6px 8px;align-items:center;margin:12px 0 10px;font:500 10px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-slider{position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,color-mix(in oklab,var(--c) 10%,var(--alm-panel-2)),color-mix(in oklab,var(--c) 45%,var(--alm-panel-2)))}
.alm-slider::before{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--alm-line)}
.alm-slider i{position:absolute;left:calc(var(--v)*100%);top:50%;width:13px;height:13px;border-radius:50%;transform:translate(-50%,-50%);background:var(--alm-panel);border:3px solid var(--c);box-shadow:0 2px 5px rgba(0,0,0,.25)}
.alm-meters{display:grid;grid-template-columns:70px 1fr;gap:5px 8px;align-items:center;font:500 10.5px/1.2 var(--alm-font-mono);color:var(--alm-muted)}
.alm-seg{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}
.alm-seg i{height:7px;border-radius:2px;background:var(--alm-panel-2);box-shadow:inset 0 0 0 1px var(--alm-line)}
.alm-seg i.on{background:var(--m,var(--c));box-shadow:none}
.m-hp{--m:#d9534f} .m-fat{--m:#8f6bd6} .m-hun{--m:#d99a2b} .m-cold{--m:#4d9bd6} .m-drink{--m:#c9772b} .m-comp{--m:var(--c)} .m-heart{--m:#e05a8a}
.alm-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.alm-tag{font:500 10.5px/1 var(--alm-font-mono);padding:5px 8px;border-radius:999px;background:var(--alm-panel-2);border:1px solid var(--alm-line);color:var(--alm-muted)}
.alm-tag.warn{color:var(--alm-danger);border-color:color-mix(in oklab,var(--alm-danger) 40%,var(--alm-line));background:color-mix(in oklab,var(--alm-danger) 8%,var(--alm-panel))}
.alm-cc__row{display:flex;gap:8px;font-size:13.5px;line-height:1.4;margin-top:8px}
.alm-cc__row b{flex:none;width:44px;font:500 9.5px/1.9 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)}
.alm-bond{padding:12px 0;border-bottom:1px dashed var(--alm-line)}
.alm-bond:last-child{border-bottom:0}
.alm-bond__pair,.alm-ladder{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.alm-bond__link{position:relative;width:52px;height:2px;border-radius:1px;background:linear-gradient(90deg,var(--ca,var(--alm-muted)),var(--cb,var(--alm-muted)))}
.alm-bond__link::after{content:"";position:absolute;right:-2px;top:-4px;border:5px solid transparent;border-left:7px solid var(--cb,var(--alm-muted));border-right:0}
.alm-bond__axis{font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--alm-muted);margin-left:4px}
.alm-bond__d{margin-left:auto;padding:4px 9px;border-radius:999px;font:500 11px/1 var(--alm-font-mono)}
.alm-bond__d.up{color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 12%,var(--alm-panel))}
.alm-bond__d.dn{color:var(--alm-danger);background:color-mix(in oklab,var(--alm-danger) 12%,var(--alm-panel))}
.alm-move{position:relative;height:10px;margin:12px 0 6px;border-radius:5px;background:linear-gradient(90deg,color-mix(in oklab,var(--alm-danger) 16%,var(--alm-panel-2)),var(--alm-panel-2) 50%,color-mix(in oklab,var(--alm-good) 16%,var(--alm-panel-2)))}
.alm-move::before{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--alm-muted);opacity:.5}
.alm-move__trail{position:absolute;top:2px;bottom:2px;left:calc(min(var(--from),var(--to))*100%);width:calc(max(var(--from) - var(--to),var(--to) - var(--from))*100%);border-radius:3px;background:var(--ca);opacity:.35}
.alm-move__ghost,.alm-move__now{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%)}
.alm-move__ghost{left:calc(var(--from)*100%);border:2px dashed var(--ca);background:var(--alm-panel);opacity:.7}
.alm-move__now{left:calc(var(--to)*100%);background:var(--ca);box-shadow:0 0 0 3px var(--alm-panel),0 2px 8px rgba(0,0,0,.3)}
.alm-scale{display:flex;justify-content:space-between;font:500 9px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-bond__why{margin-top:6px;color:var(--alm-muted);font-style:italic;font-size:14px}
.alm-ladder{padding:10px 0}
.alm-ladder__steps{display:inline-flex;gap:3px}
.alm-ladder__steps i{width:14px;height:8px;border-radius:2px;background:var(--alm-panel-2);box-shadow:inset 0 0 0 1px var(--alm-line)}
.alm-ladder__steps i.on{background:linear-gradient(90deg,#ff9fb4,#e0566b);box-shadow:none}
.alm-inv{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.alm-it{display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:start;border:1px solid var(--alm-line);border-radius:var(--alm-r-sm);padding:10px;background:var(--alm-panel-2);font-size:13.5px;line-height:1.4}
.alm-it__ic{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;font-size:20px;background:linear-gradient(135deg,color-mix(in oklab,var(--alm-gold) 30%,var(--alm-panel)),var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-gold) 40%,var(--alm-line))}
.alm-it b{display:block;font:700 14.5px/1.25 var(--alm-font-display)}
.alm-it__h{display:flex;align-items:center;gap:5px;margin:3px 0;font:500 10.5px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.alm-it__h .alm-mini{width:16px!important;height:16px!important;font-size:8.5px!important}
.alm-clocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
.alm-clock{display:flex;gap:12px;align-items:center;font-size:13.5px;line-height:1.35}
.alm-clock__face{position:relative;flex:none;width:58px;height:58px}
.alm-ring{--n:3;--of:6;--rc:var(--alm-accent);position:absolute;inset:0;border-radius:50%;
  background:repeating-conic-gradient(var(--alm-panel) 0 3deg,transparent 3deg calc(360deg / var(--of))),conic-gradient(var(--rc) calc(var(--n) / var(--of) * 360deg),color-mix(in oklab,var(--rc) 12%,var(--alm-panel-2)) 0);
  -webkit-mask:radial-gradient(circle,transparent 54%,#000 55%);mask:radial-gradient(circle,transparent 54%,#000 55%)}
.alm-clock__face b{position:absolute;inset:0;display:grid;place-items:center;font:600 13px/1 var(--alm-font-display)}
.alm-clock strong{display:block;font:700 14px/1.25 var(--alm-font-display)}
.alm-clock span{font:500 10.5px/1.4 var(--alm-font-mono);color:var(--alm-muted)}
.alm-km-wrap{overflow-x:auto!important;max-width:100%!important;margin:0!important;-webkit-overflow-scrolling:touch}
.alm-km{display:grid!important;gap:6px!important;width:100%;font-size:13.5px!important;text-align:left!important}
.alm-km--1{--alm-km-cols:minmax(10em,1.6fr) minmax(8em,1fr);min-width:calc(10em + 1 * (7.5em + 10px) + 20px)}
.alm-km--2{--alm-km-cols:minmax(10em,1.5fr) repeat(2,minmax(7.5em,1fr));min-width:calc(10em + 2 * (7.5em + 10px) + 20px)}
.alm-km--3{--alm-km-cols:minmax(10em,1.4fr) repeat(3,minmax(7.5em,1fr));min-width:calc(10em + 3 * (7.5em + 10px) + 20px)}
.alm-km--4{--alm-km-cols:minmax(10em,1.3fr) repeat(4,minmax(7.5em,1fr));min-width:calc(10em + 4 * (7.5em + 10px) + 20px)}
.alm-km--5{--alm-km-cols:minmax(10em,1.2fr) repeat(5,minmax(7.5em,1fr));min-width:calc(10em + 5 * (7.5em + 10px) + 20px)}
.alm-km__r{display:grid!important;grid-template-columns:var(--alm-km-cols);align-items:center;gap:0 10px;padding:8px 10px!important;border-radius:10px;background:var(--alm-panel-2)!important;border:0!important}
.alm-km__h{background:none!important;padding:0 10px!important;font:500 10px/1.2 var(--alm-font-mono)!important;letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)!important}
.alm-km__f{font-weight:600;line-height:1.35;overflow-wrap:break-word;text-align:left!important;hyphens:auto;min-width:0}
.alm-km__c{min-width:0;align-self:start;text-align:left!important}
.alm-kp{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font:500 11px/1.2 var(--alm-font-mono);white-space:nowrap;max-width:100%}
.alm-kp.knows{color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 13%,var(--alm-panel))}
.alm-kp.sus{color:var(--alm-warn);background:color-mix(in oklab,var(--alm-warn) 14%,var(--alm-panel))}
.alm-kp.wrong{color:var(--alm-danger);background:color-mix(in oklab,var(--alm-danger) 13%,var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-danger) 40%,transparent)}
.alm-kp.un{color:var(--alm-muted);border:1px dashed var(--alm-line)}
.alm-kp__n{display:block;margin-top:4px;font-size:11px;line-height:1.35;color:var(--alm-muted);white-space:normal;overflow-wrap:break-word;max-width:22em}
.alm-irony{display:flex;gap:12px;align-items:center;margin-top:10px;padding:10px 14px;border-radius:var(--alm-r-sm);font-size:14px;
  background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,linear-gradient(120deg,#7b5bd6,var(--alm-danger),var(--alm-gold)) border-box;border:1.5px solid transparent}
.alm-irony .i{font-size:22px}
.alm-fc{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px}
.alm-fc div{display:grid;justify-items:center;gap:3px;padding:8px 4px;border-radius:10px;background:var(--alm-panel-2);font:500 11px/1 var(--alm-font-mono)}
.alm-fc span{font-size:18px}
/* director's desk keycaps (regex actions) */
.alm-desk{display:flex!important;flex-wrap:wrap;gap:9px;margin-top:14px!important;padding-top:14px!important;border-top:1px dashed var(--alm-line)!important}
.alm-btn{display:inline-flex!important;align-items:center;gap:7px;padding:9px 13px!important;border-radius:11px!important;cursor:pointer;
  font:500 12.5px/1 var(--alm-font-mono)!important;color:var(--alm-ink)!important;background:linear-gradient(var(--alm-panel),var(--alm-panel-2))!important;
  border:1px solid var(--alm-line)!important;box-shadow:0 3px 0 var(--alm-line),0 8px 14px -10px rgba(0,0,0,.45)!important;transition:transform .08s,box-shadow .08s}
.alm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 var(--alm-line)!important}
.alm-btn--primary{color:var(--alm-on-accent)!important;background:linear-gradient(color-mix(in oklab,var(--alm-accent) 85%,#fff),var(--alm-accent))!important;border-color:color-mix(in oklab,var(--alm-accent) 70%,#000)!important;box-shadow:0 3px 0 color-mix(in oklab,var(--alm-accent) 60%,#000),0 8px 14px -10px rgba(0,0,0,.45)!important}
.alm-btn[data-lumiverse-regex-action-used="true"]{opacity:.45;transform:none;cursor:default}
/* HUD strip */
.alm-hud{display:flex!important;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 12px 8px 8px!important;border-radius:999px!important;background:linear-gradient(90deg,#1c2146,#3a3060 60%,#6a4a6a)!important;color:#fff!important;
  font:500 12px/1 var(--alm-font-mono)!important;box-shadow:var(--alm-lift);margin:0 0 12px!important}
.alm-dial{--h:12;--rise:6.5;--set:18.5;position:relative;flex:none;width:34px;height:34px;border-radius:50%;
  background:conic-gradient(from 180deg,#1d2250 0deg calc(var(--rise)*15deg - 10deg),#f19a6b calc(var(--rise)*15deg),#ffd978 calc(var(--rise)*15deg + 14deg) calc(var(--set)*15deg - 14deg),#ef7f69 calc(var(--set)*15deg),#1d2250 calc(var(--set)*15deg + 10deg));
  box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.alm-dial::before{content:"";position:absolute;inset:5px;border-radius:50%;background:rgba(8,10,24,.72)}
.alm-dial__mk{position:absolute;inset:0;transform:rotate(calc(180deg + var(--h)*15deg))}
.alm-dial__mk::before{content:"";position:absolute;left:50%;top:-1px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 10px 3px rgba(255,255,255,.7)}
.alm-hud__who{display:inline-flex;align-items:center;gap:4px}
.alm-hud__dot{width:7px;height:7px;border-radius:50%;background:var(--md);box-shadow:0 0 6px var(--md)}

@media (prefers-reduced-motion: no-preference){
  .alm-say[data-tone="shout"] .alm-say__bubble{animation:alm-jolt .5s cubic-bezier(.3,1.6,.5,1) both}
  .alm-say[data-tone="shout"] .alm-say__medal::before{animation:alm-spin 16s linear infinite}
  .alm-thk{animation:alm-bob 5s ease-in-out infinite}
  .alm-txt{animation:alm-swing 3.6s ease-in-out infinite}
  .alm-dial__mk::before{animation:alm-pulse 2.8s ease-in-out infinite}
}
@keyframes alm-jolt{0%{transform:scale(.94) rotate(1.5deg)}60%{transform:scale(1.02) rotate(-1.2deg)}100%{transform:rotate(-.7deg)}}
@keyframes alm-spin{to{transform:rotate(1turn)}}
@keyframes alm-bob{50%{transform:translateY(-3px)}}
@keyframes alm-swing{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}
@keyframes alm-pulse{50%{box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 16px 6px rgba(255,255,255,.9)}}

@media (max-width:560px){
  .alm-say{grid-template-columns:34px minmax(0,1fr)!important;gap:0 12px!important}
  .alm-say__medal{width:34px!important;height:34px!important;font-size:15px!important}
  .alm-say--user{margin-left:0!important;grid-template-columns:minmax(0,1fr) 34px!important}
  .alm-thk{margin-left:40px!important;font-size:20px!important}
  .alm-cs{grid-template-columns:1fr!important;gap:3px!important}
  .alm-cs dt{justify-self:start}
  .alm-cs dd{margin-bottom:8px!important}
  .alm-km{min-width:0;gap:8px!important}
  .alm-km__h{display:none!important}
  .alm-km__r{grid-template-columns:1fr!important;gap:4px!important;padding:10px 12px!important;border-radius:12px}
  .alm-km__f{margin-bottom:2px}
  .alm-km__c{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 10px}
  .alm-km__c .alm-kp__n{flex-basis:100%;max-width:none;margin-top:0}
  .alm-km__c[data-who]::before{content:attr(data-who);font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)}
}
`;

export const PANEL_CSS = `
.almp{--c:var(--alm-accent);color:var(--alm-ink);font-family:var(--alm-font-body);font-size:14px;line-height:1.5;padding:0}
.almp *{box-sizing:border-box}
.almp h3{margin:14px 0 8px;font:600 17px/1.2 var(--alm-font-display)}
.almp h4{margin:12px 0 6px;font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--alm-muted)}
.almp .muted{color:var(--alm-muted)}
.almp .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.almp .grow{flex:1;min-width:0}
.almp .card{background:var(--alm-panel);border:1px solid var(--alm-line);border-radius:var(--alm-r-sm);padding:12px;margin:0 0 10px;box-shadow:var(--alm-lift)}
.almp .card.flat{box-shadow:none}
.almp .hero{position:relative;overflow:hidden;border-radius:var(--alm-radius);padding:16px;color:#fff;min-height:120px;background:linear-gradient(180deg,#27295a,#6d4a7d 50%,#e0866b);box-shadow:var(--alm-shadow)}
.almp .hero .t{font:700 22px/1.1 var(--alm-font-display);margin-top:8px;text-shadow:0 2px 14px rgba(0,0,0,.5)}
.almp .hero .gl{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);font:500 11.5px/1 var(--alm-font-mono);margin:6px 6px 0 0}
.almp .btn{all:unset;display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:7px 11px;border-radius:10px;font:500 12px/1 var(--alm-font-mono);background:linear-gradient(var(--alm-panel),var(--alm-panel-2));border:1px solid var(--alm-line);box-shadow:0 2px 0 var(--alm-line)}
.almp .btn:active{transform:translateY(1px);box-shadow:none}
.almp .btn.primary{background:var(--alm-accent);color:var(--alm-on-accent);border-color:color-mix(in oklab,var(--alm-accent) 70%,#000)}
.almp .btn.danger{color:var(--alm-danger)}
.almp .btn[disabled]{opacity:.5;pointer-events:none}
.almp input[type=text],.almp input[type=number],.almp textarea,.almp select{width:100%;padding:7px 9px;border-radius:9px;border:1px solid var(--alm-line);background:var(--alm-panel-2);color:var(--alm-ink);font:inherit}
.almp textarea{min-height:70px;resize:vertical}
.almp label.f{display:grid;gap:4px;margin:0 0 10px;font:500 11px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.almp label.chk{display:flex;gap:8px;align-items:center;margin:6px 0}
.almp .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--alm-panel-2);border:1px solid var(--alm-line);font:500 11px/1.2 var(--alm-font-mono);color:var(--alm-muted);margin:2px}
.almp .pill.on{color:var(--alm-on-accent);background:var(--alm-accent);border-color:transparent}
.almp .kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:13px}
.almp .kv b{font:500 10.5px/1.7 var(--alm-font-mono);color:var(--alm-muted);text-transform:uppercase;letter-spacing:.08em}
.almp .list{display:grid;gap:8px}
.almp .rec{padding:10px;border-radius:10px;background:var(--alm-panel-2);border:1px solid var(--alm-line)}
.almp .rec .hd{display:flex;gap:8px;align-items:center}
.almp .rec .hd b{font:600 14px/1.2 var(--alm-font-display)}
.almp .kind{font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;padding:3px 6px;border-radius:5px;background:color-mix(in oklab,var(--alm-accent) 14%,var(--alm-panel));color:var(--alm-accent)}
.almp .bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--alm-panel-2)}
.almp .bar i{display:block;height:100%}
/* chronicle: volumes › arcs › chapters */
.almp .chron-legend{display:grid;gap:4px;margin-top:8px;font:500 11px/1.3 var(--alm-font-mono)}
.almp .chron-lg{display:grid;grid-template-columns:10px minmax(0,1fr) auto auto 2ch;gap:10px;align-items:center;font-variant-numeric:tabular-nums}
.almp .chron-lg i{width:10px;height:10px;border-radius:3px}
.almp .chron-lg span:last-child{text-align:right}
.almp .chron-filter{margin:12px 0 8px}
.almp button.pill{cursor:pointer;min-height:28px}
.almp button.pill b{font-weight:600;margin-left:2px}
.almp .rec.chron{border-left:4px solid var(--lv);min-width:0}
.almp .chron-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.almp .chron>.hd{flex-wrap:wrap}
.almp .chron>.hd b{min-width:0;overflow-wrap:anywhere}
.almp .chron .kind{background:color-mix(in oklab,var(--lv) 16%,var(--alm-panel));color:var(--lv)}
.almp .chron--volume{background:color-mix(in oklab,var(--lv) 7%,var(--alm-panel-2));padding:12px}
.almp .chron--volume>.hd b{font-size:16px}
.almp .chron--arc>.hd b{font-size:15px}
.almp .chron .pill.tok{font-variant-numeric:tabular-nums}
.almp .chron .pill.on-prompt{color:var(--alm-good);border-color:color-mix(in oklab,var(--alm-good) 40%,var(--alm-line))}
.almp .rec.chron.chron--folded{background:color-mix(in oklab,var(--alm-muted) 9%,var(--alm-panel-2));border-left-color:color-mix(in oklab,var(--lv) 30%,var(--alm-line));border-style:dashed}
.almp .chron--folded>.hd,.almp .chron--folded>.muted,.almp .chron--folded>.chron-tags,.almp .chron--folded>details>summary{opacity:.62;filter:grayscale(.75)}
.almp .chron-kids-t{all:unset;cursor:pointer;display:inline-flex;gap:6px;align-items:center;margin-top:8px;padding:4px 0;font:500 11px/1 var(--alm-font-mono);color:var(--lv)}
.almp .chron-kids-t:focus-visible{outline:2px solid var(--lv);outline-offset:2px}
.almp .chron-kids{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:8px 0 0 4px;padding-left:12px;border-left:2px dashed color-mix(in oklab,var(--lv) 40%,var(--alm-line))}
.almp .graph{width:100%;height:auto;border-radius:var(--alm-r-sm);background:radial-gradient(circle,color-mix(in oklab,var(--alm-muted) 22%,transparent) 1px,transparent 1.4px) 0 0/18px 18px,var(--alm-panel-2)}
.almp .graph .nm{font:700 12px var(--alm-font-display);fill:var(--alm-ink)}
.almp .graph .ini{font:700 15px var(--alm-font-display);fill:var(--alm-on-voice)}
.almp .graph .lbl{font:500 9.5px var(--alm-font-mono);fill:var(--alm-muted);paint-order:stroke;stroke:var(--alm-panel-2);stroke-width:4px;stroke-linejoin:round}
.almp .graph .spark{stroke:var(--alm-panel);stroke-dasharray:2 22;stroke-width:3.2}
@media (prefers-reduced-motion: no-preference){.almp .graph .spark{animation:alm-spark 1.6s linear infinite}}
@keyframes alm-spark{to{stroke-dashoffset:-24}}
.almp .feed .it{display:grid;grid-template-columns:48px 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed var(--alm-line);font-size:12.5px}
.almp .feed .sc{font:600 12px/1.6 var(--alm-font-mono);text-align:right}
.almp .feed .it.in .sc{color:var(--alm-good)}
.almp pre{white-space:pre-wrap;font:12px/1.5 var(--alm-font-mono);background:var(--alm-panel-2);border:1px solid var(--alm-line);border-radius:10px;padding:10px;max-height:320px;overflow:auto}
.almp .empty{padding:18px;text-align:center;color:var(--alm-muted);border:1px dashed var(--alm-line);border-radius:var(--alm-r-sm)}
.almp .swatch{width:22px;height:22px;border-radius:50%;border:2px solid var(--alm-panel);box-shadow:0 0 0 1px var(--alm-line);padding:0;cursor:pointer}
.almp .spoiler{filter:blur(5px);transition:filter .2s;cursor:pointer}.almp .spoiler:hover,.almp .spoiler:focus{filter:none}
.almp .timeline{position:relative;padding-left:18px}
.almp .timeline::before{content:"";position:absolute;left:5px;top:4px;bottom:4px;width:2px;background:var(--alm-line)}
.almp .timeline .ev{position:relative;margin:0 0 10px;font-size:13px}
.almp .timeline .ev::before{content:"";position:absolute;left:-17px;top:5px;width:10px;height:10px;border-radius:50%;background:var(--alm-accent);box-shadow:0 0 0 3px var(--alm-panel)}
.almp .timeline .ev small{display:block;font:500 10.5px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudw{box-sizing:border-box;width:max-content;max-width:440px;height:40px;display:flex;align-items:center;gap:9px;padding:0 12px 0 7px;border-radius:999px;background:linear-gradient(90deg,#1c2146,#3a3060 60%,#6a4a6a);color:#fff;font:500 12px/1 var(--alm-font-mono);box-shadow:0 10px 26px -12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,255,255,.12);cursor:pointer;white-space:nowrap;user-select:none;transition:transform .15s,box-shadow .15s}
.alm-hudw:hover{transform:translateY(-1px);box-shadow:0 14px 30px -12px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,255,255,.22)}
.alm-hudw:focus-visible{outline:2px solid #ffc46b;outline-offset:2px}
.alm-hudw>*{flex:none}
.alm-hudw b{font-weight:600;letter-spacing:.02em}
.alm-hudw__orb{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 0 10px rgba(255,255,255,.15)}
.alm-hudw__orb i{width:10px;height:10px;border-radius:50%}
.alm-hudw__orb i.moon{background:#f7efd9;box-shadow:inset -3px 0 0 rgba(20,24,60,.75),0 0 7px rgba(247,239,217,.55)}
.alm-hudw__orb i.sun{background:#ffd36b;box-shadow:0 0 8px #ffc46b}
.alm-hudw__pl{display:inline-flex;align-items:center;gap:4px;flex:0 1 auto!important;min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis}
.alm-hudw__pl svg{flex:none;opacity:.8}
.alm-hudw .alm-stack{display:inline-flex;padding-left:5px}
.alm-hudw .alm-mini{box-shadow:0 0 0 2px #3f3264!important}
.alm-hudw__dim{opacity:.72;font-style:italic}
.alm-hudc{box-sizing:border-box;width:300px;border-radius:18px;overflow:hidden;background:var(--alm-panel);color:var(--alm-ink);font-family:var(--alm-font-body);font-size:13px;line-height:1.45;box-shadow:0 24px 50px -18px rgba(0,0,0,.75),0 0 0 1px var(--alm-line)}
.alm-hudc button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
.alm-hudc__sky{position:relative;padding:12px 12px 11px;color:#fff;cursor:grab}
.alm-hudc__row{display:flex;align-items:flex-end;gap:10px}
.alm-hudc__clock{font:800 30px/.9 "Syne",var(--alm-font-display);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.alm-hudc__date{font:500 10.5px/1.3 var(--alm-font-mono);opacity:.85;min-width:0}
.alm-hudc__x{margin-left:auto!important;align-self:flex-start;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14)!important;color:#fff!important;font-size:12px!important}
.alm-hudc__x:hover{background:rgba(255,255,255,.26)!important}
.alm-hudc__title{margin-top:7px;font-weight:700;font-size:15px;font-family:var(--alm-font-display)}
.alm-hudc__chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.alm-hudc__chips span{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.16);font-size:11px}
.alm-hudc__bd{padding:4px 12px 12px}
.alm-hudc h5{margin:10px 0 6px;font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--alm-muted)}
.alm-hudc ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.alm-hudc__who li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start}
.alm-hudc__who b{font-weight:600}
.alm-hudc__mood{color:var(--alm-muted);font-size:12px}
.alm-hudc__who small{display:block;color:var(--alm-muted);font-size:11.5px;overflow-wrap:anywhere}
.alm-hudc__owed li{padding-left:12px;position:relative;font-size:12.5px}
.alm-hudc__owed li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--alm-accent)}
.alm-hudc__owed li.due::before{background:var(--alm-warn)}
.alm-hudc__owed small{color:var(--alm-muted)}
.alm-hudc__muted{margin:0;color:var(--alm-muted);font-size:12px}
.alm-hudc__go{display:block;width:100%;margin-top:12px!important;padding:9px 12px!important;border-radius:12px;text-align:center;background:var(--alm-accent)!important;color:var(--alm-on-accent)!important;font-weight:600!important;font-size:12.5px!important}
.alm-hudc__go:hover{filter:brightness(1.08)}
.alm-sz{font-size:14px}
.alm-sz .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
@media (max-width:560px){.alm-sz .grid{grid-template-columns:1fr}}
.almk{display:grid;gap:8px}
.almk-q{display:flex;gap:8px;align-items:flex-start;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
.almk-h{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start}
.almk-h__b{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.almk-h__b .alm-kp__n{flex-basis:100%;margin-top:0;max-width:none}
.almk-un{font-size:11.5px;color:var(--alm-muted)}
.almp .alm-warnbox{border-color:color-mix(in oklab,var(--alm-warn) 55%,var(--alm-line));background:color-mix(in oklab,var(--alm-warn) 10%,var(--alm-panel))}
/* ── Orrery navigation ── */
.almo{position:relative;display:flex;flex-direction:column;min-height:100%;background:color-mix(in oklab,var(--alm-panel-2) 55%,var(--alm-panel));background-image:var(--alm-texture);--almo-font:"Syne",var(--alm-font-display)}
.almo-ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.almo button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
.almo button:focus-visible{outline:2px solid var(--alm-accent);outline-offset:2px}
.almo-sky{flex:none;position:relative;overflow:hidden;padding:14px 14px 12px;color:#fff;isolation:isolate}
.almo-sky::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none}
.almo-sky.almo-night::before{background:radial-gradient(1px 1px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 78% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 60% 12%,#fff,transparent),radial-gradient(1px 1px at 34% 44%,#fffc,transparent),radial-gradient(1px 1px at 90% 58%,#fffa,transparent)}
.almo-sky.almo-rain::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:repeating-linear-gradient(105deg,transparent 0 11px,rgba(210,222,255,.2) 11px 12px,transparent 12px 26px)}
.almo-sky.almo-snow::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(2px 2px at 70% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 80%,#fff,transparent);background-size:60px 60px}
.almo-sky__row{display:flex;align-items:flex-end;gap:12px}
.almo-clock{font:800 38px/.9 var(--almo-font);letter-spacing:-.02em;font-variant-numeric:tabular-nums;text-shadow:0 2px 16px rgba(0,0,0,.35)}
.almo-date{font:500 11px/1.35 var(--alm-font-mono);color:rgba(255,255,255,.82);min-width:0}
.almo-moon{--sh:0px;margin-left:auto;flex:none;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 60% 40%,#f7efd9 0 45%,#bdb4a2 75%);box-shadow:inset var(--sh) 0 0 0 rgba(12,16,44,.88),0 0 22px rgba(247,239,217,.3)}
.almo-title{margin-top:8px;font:700 18px/1.15 var(--alm-font-display);text-shadow:0 2px 12px rgba(0,0,0,.4)}
.almo-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.almo-chips span{padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);font-weight:500;font-size:11px;line-height:1.25;max-width:100%;overflow-wrap:anywhere}
.almo-seg{display:flex;gap:4px;margin-top:12px;padding:4px;border-radius:14px;background:rgba(6,9,26,.42);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.almo-seg button{flex:1;min-width:0;display:flex;justify-content:center;align-items:center;gap:6px;padding:8px 4px;border-radius:10px;font-weight:600;font-size:12px;line-height:1;color:rgba(255,255,255,.66)}
.almo-seg button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.almo-seg .almo-ic{width:15px;height:15px}
.almo-seg button:hover{color:#fff}
.almo-seg button[aria-selected="true"]{background:rgba(255,255,255,.15);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),inset 0 -2px 0 var(--pc)}
.almo-body{flex:1 0 auto;padding:6px 12px 12px;min-width:0}
.almo-head{margin:8px 0 10px}
.almo-head h3{margin:3px 0 1px!important;font:800 22px/1.1 var(--almo-font)!important;letter-spacing:-.01em}
.almo-head small{color:var(--alm-muted);font-size:12px}
.almo-eyebrow{font:700 10px/1 var(--alm-font-mono);letter-spacing:.2em;text-transform:uppercase}
.almo-facts{margin-top:10px}
.almo-facts .kv{grid-template-columns:70px 1fr}
.almo-dockwrap{flex:none;position:sticky;bottom:10px;z-index:8;display:flex;justify-content:center;padding:14px 8px 0;pointer-events:none}
.almo-dockwrap>*{pointer-events:auto}
.almo-dock{display:flex;align-items:flex-end;gap:2px;padding:6px 8px;border-radius:26px;max-width:100%;
  background:color-mix(in oklab,var(--alm-panel) 80%,transparent);border:1px solid var(--alm-line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 18px 40px -14px rgba(0,0,0,.65)}
.almo-pl{flex:1 1 60px;min-width:44px;max-width:64px;display:grid;justify-items:center;gap:4px;padding:6px 0 4px;border-radius:18px;color:var(--alm-muted);font-weight:600!important;font-size:10px!important;line-height:1.1!important;white-space:nowrap}
.almo-pl>span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.almo-pl:hover,.almo-pl.on{color:var(--alm-ink)}
.almo-orb{position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#10132e;
  background:radial-gradient(circle at 35% 30%,color-mix(in oklab,var(--pc) 65%,#fff),var(--pc) 60%,color-mix(in oklab,var(--pc) 62%,#000));transition:box-shadow .2s,transform .2s}
.almo-orb .almo-ic{width:16px;height:16px;stroke-width:1.9}
.almo-pl:hover .almo-orb{transform:translateY(-2px)}
.almo-pl.on .almo-orb{box-shadow:0 0 0 3px var(--alm-panel),0 0 0 5px var(--pc),0 0 16px var(--pc)}
.almo-pl.alert .almo-orb{box-shadow:0 0 14px 1px var(--pc)}
.almo-orb b{position:absolute;top:-5px;right:-7px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--alm-danger);color:#fff;font-weight:700;font-size:9.5px;line-height:16px;box-shadow:0 0 0 2px var(--alm-panel)}
.almo-sun{flex:none;width:56px;height:56px;margin:0 4px 2px!important;border-radius:50%;display:grid;place-items:center;color:#3a1c00!important;transform:translateY(-12px);
  background:radial-gradient(circle at 38% 32%,#fff3c4,#ffc46b 45%,#f08a3c)!important;box-shadow:0 0 0 4px var(--alm-panel),0 0 24px rgba(255,196,107,.55);transition:box-shadow .2s}
.almo-sun span{display:grid;justify-items:center}
.almo-sun small{font:800 8.5px/1 var(--almo-font);letter-spacing:.12em;margin-top:1px}
.almo-sun.on{box-shadow:0 0 0 4px var(--alm-panel),0 0 0 6px #ffc46b,0 0 32px rgba(255,196,107,.85)}
.almo.orbiting .almo-body,.almo.orbiting .almo-sky{filter:blur(2px) brightness(.55);transition:filter .2s}
.almo-orbit{position:absolute;left:50%;bottom:88px;transform:translateX(-50%);width:280px;height:132px}
.almo-orbit::before{content:"";position:absolute;left:8px;right:8px;top:22px;height:240px;border-radius:50%;border:1px dashed color-mix(in oklab,var(--pc) 45%,transparent);pointer-events:none}
.almo-orbit__t{position:absolute;left:0;right:0;bottom:4px;text-align:center;font:700 10px/1 var(--alm-font-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--pc);pointer-events:none}
.almo-moonb{position:absolute;width:88px;display:grid;justify-items:center;gap:4px;text-align:center;animation:almo-rise .22s ease-out both}
.almo-m{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--alm-panel);border:1.5px solid var(--pc);color:var(--pc);box-shadow:0 0 18px -4px var(--pc);transition:background .15s,color .15s}
.almo-moonb:hover .almo-m,.almo-moonb:focus-visible .almo-m{background:var(--pc);color:#10132e}
.almo-moonb b{font-weight:700;font-size:12px;line-height:1.1;color:var(--alm-ink);text-shadow:0 1px 6px var(--alm-panel)}
.almo-moonb small{font:500 9.5px/1.2 var(--alm-font-mono);color:var(--alm-muted)}
@keyframes almo-rise{from{opacity:0;transform:translateY(14px) scale(.9)}}
.almo-empty{flex:1 0 auto;display:grid;justify-items:center;align-content:center;text-align:center;gap:6px;padding:40px 24px}
.almo-empty h4{margin:14px 0 0;font:800 19px/1.2 var(--almo-font);color:var(--alm-ink)}
.almo-empty p{margin:0 0 8px;color:var(--alm-muted);max-width:30ch}
.almo-dial{position:relative;width:110px;height:110px;border-radius:50%;border:1px dashed var(--alm-line);display:grid;place-items:center}
.almo-dial::before{content:"";width:14px;height:14px;border-radius:50%;background:#ffc46b;box-shadow:0 0 22px #ffc46b}
.almo-dial::after{content:"";position:absolute;top:-5px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#5fcfc0;box-shadow:0 0 12px #5fcfc0;transform-origin:5px 60px}
.almo-dial.spin::after{animation:almo-orbit 3s linear infinite}
@keyframes almo-orbit{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.almo-moonb,.almo-dial.spin::after{animation:none}.almo.orbiting .almo-body,.almo.orbiting .almo-sky{transition:none}}
`;

// The Now widget (orrery). Built on the skin tokens (--alm-panel, --alm-ink,
// --alm-accent, the fonts and radii), so it takes each skin's colours and type;
// the sky stays a sky. Each skin then adds its signature (hard shadows for
// Candy, clipped corners for Orbital, a wax seal for Scriptorium…) below.

const S = (id: string) => `:root[data-alm-skin="${id}"]`;

const BASE = `
.alm-hudw,.alm-hudc,.alm-hudt{--alm-hud-r:var(--alm-radius,18px);--alm-hud-pill:999px;--alm-hud-ring:var(--alm-panel);--alm-hud-veil:linear-gradient(color-mix(in oklab,var(--alm-panel) 84%,transparent),color-mix(in oklab,var(--alm-panel) 84%,transparent));box-sizing:border-box;-webkit-font-smoothing:antialiased}
.alm-hudw *,.alm-hudc *,.alm-hudt *{box-sizing:border-box}
.alm-hudc button,.alm-hudw button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:inherit;min-width:0;min-height:0;box-shadow:none}

/* ── Pill ── */
.alm-hudw{position:relative;width:max-content;max-width:min(480px,calc(100vw - 24px));height:44px;display:flex;align-items:center;gap:9px;padding:0 13px 0 6px;border-radius:var(--alm-hud-pill);
  background:var(--alm-hud-veil),var(--alm-texture,none),var(--alm-panel);color:var(--alm-ink);border:1px solid var(--alm-line);font:500 12px/1 var(--alm-font-mono);
  box-shadow:0 12px 28px -14px rgba(0,0,0,.55),var(--alm-lift,none);cursor:pointer;white-space:nowrap;user-select:none;transition:transform .15s,box-shadow .15s}
.alm-hudw:hover{transform:translateY(-1px);box-shadow:0 16px 32px -14px rgba(0,0,0,.65),var(--alm-lift,none)}
.alm-hudw:focus-visible{outline:2px solid var(--alm-accent);outline-offset:2px}
.alm-hudw>*{flex:none}
.alm-hudw__dial{position:relative;display:block;width:32px;height:32px;border-radius:50%;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 0 0 2px var(--alm-panel),0 0 0 3px var(--alm-line)}
.alm-hudw__dial::after{content:"";position:absolute;left:0;right:0;bottom:0;height:34%;background:rgba(10,12,34,.78)}
.alm-hudw__dial b{position:absolute;width:10px;height:10px;border-radius:50%}
.alm-hudw__dial b.sun{right:6px;top:10px;background:#ffcf73;box-shadow:0 0 8px 2px rgba(255,170,80,.8)}
.alm-hudw__dial b.moon{left:8px;top:6px;background:#f4ecd6;box-shadow:inset -3px 0 0 rgba(30,30,80,.8),0 0 7px rgba(247,239,217,.55)}
.alm-hudw__brand{font-weight:600;letter-spacing:.14em}
.alm-hudw__t{font:600 17px/1 var(--alm-font-display);letter-spacing:.01em;font-variant-numeric:tabular-nums}
.alm-hudw__wx{color:var(--alm-muted)}
.alm-hudw__pl{display:inline-flex;align-items:center;gap:4px;flex:0 1 auto!important;min-width:64px;overflow:hidden;text-overflow:ellipsis}
.alm-hudw__pl svg{flex:none;opacity:.7}
.alm-hudw__who{display:inline-flex;padding-left:5px}
.alm-hudw__who .alm-om{margin-left:-5px}
.alm-hudw__dim{color:var(--alm-muted);font-style:italic}
.alm-hudw__chip{flex:0 1 auto!important;min-width:0;height:24px;overflow:hidden;border-radius:var(--alm-hud-pill);padding:0 10px;color:color-mix(in oklab,var(--alm-accent) 80%,var(--alm-ink));background:color-mix(in oklab,var(--alm-accent) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-accent) 35%,transparent)}
.alm-hudw__rot{display:flex;flex-direction:column}
.alm-hudw__rot span{height:24px;line-height:24px;overflow:hidden;text-overflow:ellipsis}
.alm-hudw__err{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--alm-warn);color:#1d1400;font-weight:700;font-size:12px}
.alm-hudw__badge{position:absolute;top:-7px;right:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--alm-danger);color:#fff;font:700 11px/20px var(--alm-font-body);text-align:center;box-shadow:0 0 0 2px var(--alm-panel),0 0 12px color-mix(in oklab,var(--alm-danger) 70%,transparent)}

/* ── Docked tab: a bookmark flush with the screen edge (the host keeps widgets 12px in) ── */
.alm-hudt{position:relative;width:46px;display:flex;flex-direction:column;align-items:center;gap:7px;padding:9px 0 8px;
  background:var(--alm-hud-veil),var(--alm-texture,none),var(--alm-panel);color:var(--alm-ink);border:1px solid var(--alm-line);font:500 11px/1 var(--alm-font-mono);
  box-shadow:0 12px 28px -14px rgba(0,0,0,.55),var(--alm-lift,none);cursor:grab;user-select:none;touch-action:none;transition:transform .15s,box-shadow .15s,border-radius .15s}
.alm-hudt--left{transform:translateX(-12px);border-left:0;border-radius:0 calc(var(--alm-hud-r) - 2px) calc(var(--alm-hud-r) - 2px) 0}
.alm-hudt--right{transform:translateX(12px);border-right:0;border-radius:calc(var(--alm-hud-r) - 2px) 0 0 calc(var(--alm-hud-r) - 2px)}
.alm-hudt--left:hover{transform:translateX(-9px)}
.alm-hudt--right:hover{transform:translateX(9px)}
.alm-hudt.is-free{transform:none;border:1px solid var(--alm-line);border-radius:var(--alm-hud-r)}
.alm-hudt.is-dragging{cursor:grabbing;box-shadow:0 18px 36px -14px rgba(0,0,0,.7),var(--alm-lift,none)}
.alm-hudt:focus-visible{outline:2px solid var(--alm-accent);outline-offset:2px}
.alm-hudt .alm-hudw__dial{width:30px;height:30px;flex:none}
.alm-hudt__t{font:600 11px/1 var(--alm-font-mono);letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
.alm-hudt__wx{display:grid;justify-items:center;gap:2px;font-size:14px;line-height:1;color:var(--alm-muted)}
.alm-hudt__wx small{font:500 10px/1 var(--alm-font-mono)}
.alm-hudt__who{display:flex;flex-direction:column;align-items:center;padding-top:5px}
.alm-hudt__who .alm-om{margin-top:-5px}
.alm-hudt__grab{display:block;width:14px;height:6px;margin-top:1px;opacity:.45;background:radial-gradient(circle,currentColor 1px,transparent 1.3px) 0 0/4.7px 3px}
.alm-hudt .alm-hudw__badge{top:-8px}
.alm-hudt--left .alm-hudw__badge,.alm-hudt.is-free .alm-hudw__badge{right:-8px}
.alm-hudt--right:not(.is-free) .alm-hudw__badge{right:auto;left:-8px}

/* Medallions */
.alm-om{--c:var(--alm-muted);position:relative;display:inline-grid;place-items:center;flex:none;width:24px;height:24px;border-radius:50%;background:var(--c);color:var(--alm-on-voice,#fff);font:700 10.5px/1 var(--alm-font-display);box-shadow:0 0 0 2px var(--alm-hud-ring)}
.alm-om--big{width:36px;height:36px;font-size:15px}
.alm-om__md{position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border-radius:50%;background:var(--m);box-shadow:0 0 0 2px var(--alm-hud-ring)}
.alm-om--big .alm-om__md{width:11px;height:11px}

/* ── Window ── */
.alm-hudc{position:relative;container:almhud/size;display:flex;flex-direction:column;width:360px;max-width:100%;border-radius:calc(var(--alm-hud-r) + 6px);overflow:hidden;background:var(--alm-panel);color:var(--alm-ink);font-family:var(--alm-font-body);font-size:13px;line-height:1.45;
  box-shadow:0 30px 60px -24px rgba(0,0,0,.7),0 0 0 1px var(--alm-line)}
.alm-hudc__sky{position:relative;flex:none;min-height:176px;overflow:hidden;color:#fff;cursor:grab;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto 1fr auto;column-gap:8px;padding:10px 12px 8px 16px}
.alm-hudc__sky::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(165deg,rgba(6,8,24,.5),rgba(6,8,24,.16) 42%,transparent 62%)}
.alm-hudc__sky>div{position:relative;z-index:2;min-width:0}
.alm-hudc__stars{position:absolute;inset:0 0 45% 0;background:radial-gradient(1px 1px at 12% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 55%,#fff,transparent),radial-gradient(1.5px 1.5px at 62% 14%,#fff,transparent),radial-gradient(1px 1px at 82% 38%,#fff,transparent),radial-gradient(1px 1px at 48% 30%,#fff,transparent),radial-gradient(1px 1px at 92% 12%,#fff,transparent)}
.alm-hudc__arc{position:absolute;inset:0;width:100%;height:100%}
.alm-hudc__land{position:absolute;left:0;right:0;bottom:0;width:100%;height:40px;fill:rgba(8,10,26,.88)}
.alm-hudc__fx{position:absolute;inset:0;pointer-events:none}
.alm-hudc__fx.is-rain{background:repeating-linear-gradient(105deg,transparent 0 13px,rgba(210,220,255,.24) 13px 14px,transparent 14px 29px) 0 0/80px 80px;mix-blend-mode:screen}
.alm-hudc__fx.is-snow{background:radial-gradient(1.6px 1.6px at 10px 12px,#fff,transparent),radial-gradient(1.2px 1.2px at 40px 30px,#fff,transparent),radial-gradient(2px 2px at 64px 58px,#fff,transparent) 0 0/80px 80px;opacity:.85}
.alm-hudc__fx.is-fog{background:linear-gradient(transparent 35%,rgba(230,230,240,.35) 70%,rgba(230,230,240,.5))}
.alm-hudc__ttl{grid-column:1;grid-row:1;text-shadow:0 1px 2px rgba(0,0,0,.5),0 2px 12px rgba(0,0,0,.4)}
.alm-hudc__ttl b{display:block;font:600 clamp(28px,11cqi,40px)/1 var(--alm-font-display);white-space:nowrap;letter-spacing:.01em;font-variant-numeric:tabular-nums}
.alm-hudc__ttl span{display:block;overflow-wrap:anywhere;margin-top:5px;font:500 10.5px/1.35 var(--alm-font-mono);letter-spacing:.06em;text-transform:uppercase}
.alm-hudc__ttl em{display:block;margin-top:4px;font:italic 500 14px/1.25 var(--alm-font-display);overflow-wrap:anywhere}
.alm-hudc__side{grid-column:2;grid-row:1;display:flex;flex-direction:column;align-items:flex-end;gap:7px;padding-top:2px}
.alm-hudc__btns{display:flex;gap:6px}
.alm-hudc__astro{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px;max-width:150px}
.alm-hudc__astro i,.alm-hudc__astro2 i{display:none;font-style:normal}
.alm-hudc__chips .alm-hudc__astro2{display:none}
.alm-hudc__astro span,.alm-hudc__chips span{font:500 10.5px/1 var(--alm-font-mono);padding:5px 8px;border-radius:999px;background:rgba(8,9,26,.42);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);color:#f1efff;line-height:1.3;overflow-wrap:anywhere}
.alm-hudc__b{width:28px;height:28px;border-radius:50%!important;display:grid!important;place-items:center;background:rgba(8,9,26,.38)!important;color:#fff!important;font-size:12px!important}
.alm-hudc__b:hover{background:rgba(8,9,26,.6)!important}
.alm-hudc__b:focus-visible{outline:2px solid #fff;outline-offset:1px}
.alm-hudc__chips{grid-column:1/-1;grid-row:3;margin:8px -4px 0;display:flex;gap:5px;flex-wrap:wrap}
.alm-hudc__chips span{display:inline-flex;align-items:center;gap:4px;flex:0 1 auto;min-width:0;max-width:100%;border-radius:12px;background:rgba(8,9,26,.6)}
.alm-hudc__chips .alm-hudc__plc{display:block}
.alm-hudc__plc svg{display:inline-block;vertical-align:-2px;margin-right:4px}
.alm-hudc__plc b{font-weight:inherit}
.alm-hudc__plc s{text-decoration:none;opacity:.65;padding:0 4px}
.alm-hudc__fc{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);background:var(--alm-panel-2);border-bottom:1px solid var(--alm-line)}
.alm-hudc__fc div{display:grid;gap:3px;justify-items:center;padding:7px 0 6px;font:500 10px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudc__fc b{font:400 15px/1 var(--alm-font-body)}
.alm-hudc__fc i{font-style:normal;color:var(--alm-ink)}
.alm-hudc__fc .now{color:var(--alm-accent);background:color-mix(in oklab,var(--alm-accent) 10%,transparent)}
.alm-hudc__err{margin:0;padding:8px 12px;font-size:12px;line-height:1.4;border-bottom:1px solid color-mix(in oklab,var(--alm-warn) 45%,var(--alm-line));background:color-mix(in oklab,var(--alm-warn) 14%,var(--alm-panel));overflow-wrap:anywhere;cursor:pointer}
.alm-hudc__body{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:52px minmax(0,1fr)}
.alm-hudc__fc,.alm-hudc__err{flex:none}
.alm-hudc__grip{position:absolute;right:0;bottom:0;z-index:3;width:18px;height:18px;cursor:nwse-resize;touch-action:none;
  background:linear-gradient(135deg,transparent 0 52%,var(--alm-muted) 52% 58%,transparent 58% 68%,var(--alm-muted) 68% 74%,transparent 74% 84%,var(--alm-muted) 84% 90%,transparent 90%);opacity:.55}
.alm-hudc__grip:hover{opacity:1}
.alm-hudc__rail{display:flex;flex-direction:column;gap:4px;padding:9px 6px;min-height:0;overflow-y:auto;scrollbar-width:none;background:var(--alm-panel-2);border-right:1px solid var(--alm-line)}
.alm-hudc__rail button{position:relative;display:grid;place-items:center;flex:none;width:40px;height:38px;border-radius:var(--alm-r-sm,12px);color:var(--alm-muted)}
.alm-hudc__rail button:hover{color:var(--alm-ink);background:color-mix(in oklab,var(--alm-ink) 6%,transparent)}
.alm-hudc__rail button[aria-selected="true"]{color:var(--alm-on-accent);background:var(--alm-accent);box-shadow:0 6px 14px -8px var(--alm-accent)}
.alm-hudc__rail button:focus-visible{outline:2px solid var(--alm-accent);outline-offset:1px}
.alm-hudc__rail sup{position:absolute;top:1px;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--alm-danger);color:#fff;font:700 9.5px/16px var(--alm-font-body);text-align:center;box-shadow:0 0 0 2px var(--alm-panel-2)}
.alm-hudc__rail sup.dot{min-width:8px;width:8px;height:8px;padding:0;top:6px;right:6px;background:var(--alm-warn)}
.alm-hudc__rail sup.dot.soft{background:var(--alm-accent-2)}
.alm-hudc__open{margin-top:auto}
.alm-hudc__pane{min-width:0;overflow-x:hidden;overflow-y:auto;padding:12px 14px 16px;background:var(--alm-hud-veil),var(--alm-texture,none),var(--alm-panel);scrollbar-width:thin;scrollbar-color:var(--alm-line) transparent;overscroll-behavior:contain}
.alm-hudc h6{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 8px;font:500 9.5px/1.2 var(--alm-font-mono);letter-spacing:.15em;text-transform:uppercase;color:var(--alm-muted)}
.alm-hudc h6:not(:first-child){margin-top:16px}
.alm-hudc small{display:block;color:var(--alm-muted);font-size:12px;line-height:1.35;font-style:italic}
.alm-hudc__empty{margin:6px 0 0;color:var(--alm-muted);font-style:italic}
.alm-hudc__row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:start;padding:8px 0;border-bottom:1px dashed var(--alm-line)}
.alm-hudc__row:last-child{border-bottom:0}
.alm-hudc__ic{display:grid;place-items:center;width:28px;height:28px;border-radius:var(--alm-r-sm,10px);background:color-mix(in oklab,var(--alm-ink) 6%,transparent);font-size:14px}
.alm-hudc__row b{font-weight:600}
.alm-hudc__row>div>span,.alm-hudc__row small{display:block;overflow-wrap:anywhere}
.alm-hudc__d{font:600 10.5px/1 var(--alm-font-mono);padding:4px 7px;border-radius:999px;white-space:nowrap;color:var(--alm-muted);background:color-mix(in oklab,var(--alm-ink) 6%,transparent)}
.alm-hudc__d.up,.alm-hudc__tag.up{color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 14%,transparent)}
.alm-hudc__d.dn,.alm-hudc__tag.dn{color:var(--alm-danger);background:color-mix(in oklab,var(--alm-danger) 13%,transparent)}
.alm-hudc__d.due{color:var(--alm-warn);background:color-mix(in oklab,var(--alm-warn) 15%,transparent)}
.alm-otrk{--c:var(--alm-accent);position:relative;display:block;height:6px;margin:8px 6px 5px;border-radius:9px;background:color-mix(in oklab,var(--alm-ink) 10%,transparent)}
.alm-otrk.is-empty{opacity:.4}
.alm-otrk__mid{position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:color-mix(in oklab,var(--alm-ink) 28%,transparent)}
.alm-otrk__trail{position:absolute;top:0;bottom:0;background:var(--c);opacity:.4;border-radius:9px}
.alm-otrk__ghost,.alm-otrk__knob{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%)}
.alm-otrk__ghost{border:1.5px dashed var(--c)}
.alm-otrk__knob{background:var(--c);box-shadow:0 0 0 2px var(--alm-panel),0 0 8px color-mix(in oklab,var(--c) 70%,transparent)}
.alm-hudc__count{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;align-items:center;padding:11px 13px;border-radius:var(--alm-hud-r);background:linear-gradient(135deg,color-mix(in oklab,var(--alm-danger) 16%,var(--alm-panel)),color-mix(in oklab,var(--alm-accent) 8%,var(--alm-panel)));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-danger) 30%,transparent)}
.alm-hudc__count b{grid-row:span 2;font:600 28px/1 var(--alm-font-display);color:var(--alm-danger);white-space:nowrap}
.alm-hudc__count span{font-weight:600}
.alm-hudc__count small{font-style:normal}
.alm-hudc__count i{grid-column:1/-1;height:4px;margin-top:6px;border-radius:9px;background:linear-gradient(90deg,var(--alm-warn),var(--alm-danger)) 0 0/var(--p) 100% no-repeat,color-mix(in oklab,var(--alm-ink) 8%,transparent)}
.alm-hudc__rings{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;text-align:center}
.alm-hudc__rings div{padding:8px 3px 7px;border-radius:var(--alm-r-sm,12px);background:color-mix(in oklab,var(--alm-ink) 4%,transparent)}
.alm-hudc__rings small{font-style:normal;font-size:11px;margin-top:3px;overflow-wrap:anywhere}
.alm-oring{display:block;margin:0 auto}
.alm-oring text{font:600 11px var(--alm-font-mono)}
.alm-hudc__gauge{display:grid;grid-template-columns:minmax(0,74px) 1fr auto auto;gap:8px;align-items:center;padding:4px 0}
.alm-hudc__gauge>span:first-child{overflow-wrap:anywhere}
.alm-hudc__segs{display:flex;gap:2px}
.alm-hudc__segs i{flex:1;height:11px;border-radius:2px;background:color-mix(in oklab,var(--alm-ink) 9%,transparent)}
.alm-hudc__segs i.on{background:var(--alm-accent-2);box-shadow:0 0 6px color-mix(in oklab,var(--alm-accent-2) 45%,transparent)}
.alm-hudc__bar{height:8px;border-radius:9px;background:color-mix(in oklab,var(--alm-ink) 9%,transparent);overflow:hidden}
.alm-hudc__bar i{display:block;height:100%;background:var(--alm-accent-2)}
.alm-hudc__n{font:500 10.5px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudc__clue{display:grid;grid-template-columns:auto 1fr;gap:8px;padding:5px 0;font-size:12.5px}
.alm-hudc__clue em{color:var(--alm-muted);font-style:normal}
.alm-hudc__rel{display:flex;gap:2px;margin-top:4px}
.alm-hudc__rel i{width:6px;height:6px;border-radius:50%;background:color-mix(in oklab,var(--alm-ink) 16%,transparent)}
.alm-hudc__rel i.on{background:var(--alm-gold)}
.alm-hudc__tags{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 2px}
.alm-hudc__tag{max-width:100%;overflow-wrap:anywhere;font:500 10.5px/1.3 var(--alm-font-mono);padding:3px 8px;border-radius:11px;background:color-mix(in oklab,var(--alm-ink) 7%,transparent)}
.alm-hudc__tag s{opacity:.6}
.alm-hudc__narr{display:inline-flex!important;align-items:center;gap:4px;padding:3px 8px!important;border-radius:999px!important;border:1px solid var(--alm-line)!important;text-transform:none;letter-spacing:.02em;color:var(--alm-muted)}
.alm-hudc__narr.is-on{color:var(--alm-on-accent);background:var(--alm-accent-2)!important;border-color:transparent!important}
.alm-hudc__who{display:grid;grid-template-columns:minmax(0,1fr);gap:9px}
.alm-hudc__per{--alm-hud-ring:var(--alm-panel);min-width:0;padding:10px 11px;border-radius:var(--alm-hud-r);background:linear-gradient(135deg,color-mix(in oklab,var(--c) 13%,var(--alm-panel)),var(--alm-panel) 70%);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--c) 28%,var(--alm-line))}
.alm-hudc__perh{display:flex;align-items:center;gap:10px;min-width:0}
.alm-hudc__perh>div{min-width:0;overflow-wrap:anywhere}
.alm-hudc__perh b{display:block;font:600 14px/1.2 var(--alm-font-display)}
.alm-hudc__bars{display:grid;grid-template-columns:62px 1fr;gap:6px 8px;align-items:center;margin-top:6px;font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--alm-muted)}
.alm-hudc__bars .alm-otrk{margin:0 6px}
.alm-hudc__secret,.alm-hudc__irony{margin-top:9px;padding:8px 10px;border-radius:var(--alm-r-sm,10px);font-size:12.5px;font-style:italic}
.alm-hudc__secret{border:1px dashed color-mix(in oklab,var(--alm-accent-2) 50%,var(--alm-line));background:color-mix(in oklab,var(--alm-accent-2) 7%,transparent)}
.alm-hudc__irony{font-style:normal;border:1.5px solid transparent;background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,linear-gradient(135deg,var(--alm-accent),var(--alm-accent-2),var(--alm-gold)) border-box}
.alm-hudc__secret b,.alm-hudc__irony b{display:block;margin-bottom:3px;font:500 9.5px/1 var(--alm-font-mono);font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:var(--alm-accent-2)}
.alm-hudc__locked{margin:12px 0 0;padding:8px 10px;border-radius:var(--alm-r-sm,10px);border:1px dashed var(--alm-line);font:500 11px/1.4 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudc__thr{padding:8px 0;border-bottom:1px dashed var(--alm-line)}
.alm-hudc__thr>div{display:flex;justify-content:space-between;align-items:center;gap:8px}
.alm-hudc__st{flex:none;font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:999px;color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 14%,transparent)}
.alm-hudc__st.stall{color:var(--alm-warn);background:color-mix(in oklab,var(--alm-warn) 15%,transparent)}
.alm-hudc__chek{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:center;padding:9px 11px;margin-bottom:6px;border-radius:var(--alm-r-sm,12px);border:1px solid color-mix(in oklab,var(--alm-gold) 35%,var(--alm-line));background:color-mix(in oklab,var(--alm-gold) 7%,transparent);font-size:12.5px}
.alm-hudc__rumor{margin:0 0 8px;padding-left:11px;border-left:2px solid var(--alm-accent-2);font-style:italic}
.alm-hudc__rumor small{font:500 10px/1.4 var(--alm-font-mono);font-style:normal;margin-top:3px}
.alm-hudc__lockcap{margin:0 0 10px;font:500 10.5px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudc__bub{position:relative;margin:0 0 16px;padding:10px 13px;border-radius:18px;background:color-mix(in oklab,var(--c) 13%,var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--c) 35%,transparent);font:500 1.2em/1.25 var(--alm-font-hand)}
.alm-hudc__bub::after{content:"";position:absolute;left:20px;bottom:-8px;width:9px;height:9px;border-radius:50%;background:color-mix(in oklab,var(--c) 13%,var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--c) 35%,transparent)}
.alm-hudc__bub b{display:block;margin-bottom:4px;font:600 9.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--c)}
.alm-hudc__env{display:block!important;width:100%;margin:0 0 10px!important}
.alm-hudc__front{position:relative;display:block;padding:38px 14px 11px;border-radius:var(--alm-r-sm,10px);background:linear-gradient(color-mix(in oklab,var(--c) 22%,#efe4cc),color-mix(in oklab,var(--c) 12%,#e8dcc0));color:#3b2f22;box-shadow:0 8px 16px -10px rgba(0,0,0,.6)}
.alm-hudc__front::before{content:"";position:absolute;left:0;right:0;top:0;height:42px;background:color-mix(in oklab,var(--c) 34%,#e2d3b2);clip-path:polygon(0 0,100% 0,50% 100%);border-radius:var(--alm-r-sm,10px) var(--alm-r-sm,10px) 0 0}
.alm-hudc__seal{position:absolute;left:50%;top:24px;z-index:1;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 35% 30%,#d4475a,#8e1f2f 70%);color:#ffd9c9;font:600 12px/1 var(--alm-font-display);box-shadow:0 2px 5px rgba(0,0,0,.4),inset 0 0 0 3px rgba(0,0,0,.15);transition:transform .25s}
.alm-hudc__env:hover .alm-hudc__seal{transform:translate(-50%,-50%) rotate(-12deg) scale(1.08)}
.alm-hudc__cue{display:block;text-align:center;font-style:italic;font-size:13px;line-height:1.35}
.alm-hudc__envwho{display:block;margin-top:6px;text-align:center;font:500 9px/1 var(--alm-font-mono);letter-spacing:.14em;text-transform:uppercase;opacity:.6}
.alm-hudc__note{display:block;padding:12px 14px 10px;border-radius:var(--alm-r-sm,10px);border-top:4px solid var(--c);background:#fbf6ea;color:#2e261c;font:500 1.4em/1.2 var(--alm-font-hand);box-shadow:0 8px 16px -10px rgba(0,0,0,.6)}
.alm-hudc__note em{display:block;margin-top:5px;text-align:right;color:color-mix(in oklab,var(--c) 70%,#000);font-style:normal}
.alm-hudc__tok{display:flex;height:10px;border-radius:9px;overflow:hidden;margin:2px 0 7px}
.alm-hudc__tok i{display:block;min-width:3px}
.alm-hudc__legend{display:flex;flex-wrap:wrap;gap:5px 11px;font:500 10px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudc__legend span::before{content:"";display:inline-block;width:8px;height:8px;margin-right:5px;border-radius:2px;background:var(--c);vertical-align:-1px}
.alm-hudc__fed{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--alm-line);font-size:12.5px}
.alm-hudc__via{font:500 9px/1 var(--alm-font-mono);letter-spacing:.08em;text-transform:uppercase;padding:4px 6px;border-radius:5px;color:var(--alm-muted);background:color-mix(in oklab,var(--alm-ink) 7%,transparent)}
.alm-hudc__ok{margin:0 0 6px;padding:7px 10px;border-radius:var(--alm-r-sm,10px);font-size:12.5px;color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 10%,transparent)}
.alm-hudc__ok.is-warn{color:var(--alm-warn);background:color-mix(in oklab,var(--alm-warn) 12%,transparent)}

/* Narrow windows: sun and moon join the chips below, the forecast and rail tighten. */
@container almhud (max-width:400px){
  .alm-hudc__astro{display:none}
  .alm-hudc__chips .alm-hudc__astro2{display:contents}
  .alm-hudc__sky{padding-left:14px}
}
@container almhud (max-width:330px){
  .alm-hudc__body{grid-template-columns:44px minmax(0,1fr)}
  .alm-hudc__rail{padding:7px 4px}
  .alm-hudc__rail button{width:36px;height:34px}
  .alm-hudc__pane{padding:10px 10px 14px}
  .alm-hudc__row{grid-template-columns:24px minmax(0,1fr) auto;gap:7px}
  .alm-hudc__ic{width:24px;height:24px;font-size:12px}
  .alm-hudc__rings{grid-template-columns:repeat(2,1fr)}
  .alm-hudc__gauge{grid-template-columns:minmax(0,1fr) auto auto;row-gap:4px}
  .alm-hudc__gauge>.alm-hudc__segs,.alm-hudc__gauge>.alm-hudc__bar{grid-column:1/-1;grid-row:2}
  .alm-hudc__bars{grid-template-columns:auto 1fr}
  .alm-hudc__count{grid-template-columns:minmax(0,1fr)}
  .alm-hudc__count b{grid-row:auto}
}
/* Short windows: a lower sky, a tighter rail. */
@container almhud (max-height:470px){
  .alm-hudc__sky{min-height:132px;padding-top:8px}
  .alm-hudc__fc div{padding:5px 0 4px}
  .alm-hudc__rail{gap:2px;padding-top:6px;padding-bottom:6px}
  .alm-hudc__rail button{height:32px}
}

@media (prefers-reduced-motion:no-preference){
  .alm-om__md.is-fresh{animation:alm-hud-pulse 1.4s ease-out infinite}
  .alm-hudw__badge{animation:alm-hud-pop .6s cubic-bezier(.3,1.6,.5,1) both}
  .alm-hudw__rot[data-n="2"]{animation:alm-hud-rot2 7s steps(1) infinite}
  .alm-hudw__rot[data-n="3"]{animation:alm-hud-rot3 10.5s steps(1) infinite}
  .alm-hudc__row{animation:alm-hud-in .45s ease both;animation-delay:calc(var(--i,0) * 60ms)}
  .alm-otrk__knob.is-moved{animation:alm-hud-spark 1s ease 3}
  .alm-hudc__fx.is-rain{animation:alm-hud-rain .7s linear infinite}
  .alm-hudc__fx.is-snow{animation:alm-hud-snow 6s linear infinite}
  .alm-hudc__stars{animation:alm-hud-twinkle 4s ease-in-out infinite}
  .alm-hudc__note{animation:alm-hud-unfold .4s ease both;transform-origin:top}
}
@keyframes alm-hud-pulse{0%{box-shadow:0 0 0 2px var(--alm-hud-ring),0 0 0 2px var(--m)}100%{box-shadow:0 0 0 2px var(--alm-hud-ring),0 0 0 8px transparent}}
@keyframes alm-hud-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.2)}100%{transform:none;opacity:1}}
@keyframes alm-hud-rot2{0%{transform:none}50%{transform:translateY(-24px)}}
@keyframes alm-hud-rot3{0%{transform:none}33.33%{transform:translateY(-24px)}66.66%{transform:translateY(-48px)}}
@keyframes alm-hud-in{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
@keyframes alm-hud-spark{50%{box-shadow:0 0 0 2px var(--alm-panel),0 0 16px 4px var(--c)}}
@keyframes alm-hud-rain{to{background-position:-40px 160px}}
@keyframes alm-hud-snow{to{background-position:20px 160px,-20px 160px,10px 160px}}
@keyframes alm-hud-twinkle{50%{opacity:.35}}
@keyframes alm-hud-unfold{from{opacity:0;transform:rotateX(-60deg)}to{opacity:1;transform:none}}
`;

// Each skin's signature on the widget.
const SIGNATURES = `
/* Almanac: the sun on the section heads */
${S("almanac")} .alm-hudc h6>span:first-child::before{content:"☉ ";color:var(--alm-gold);letter-spacing:0}

/* Solar: square, ruled, highlighter yellow */
${S("solar")} .alm-hudw,${S("solar")} .alm-hudc{--alm-hud-pill:0px;--alm-hud-r:0px}
${S("solar")} .alm-hudw{border:2px solid var(--alm-rule);box-shadow:none}
${S("solar")} .alm-hudc{box-shadow:0 0 0 2px var(--alm-rule)}
${S("solar")} .alm-hudc h6{border-top:2px solid var(--alm-rule);padding-top:6px;color:var(--alm-ink);font-weight:700}
${S("solar")} .alm-hudc__rail button{border-radius:0}
${S("solar")} .alm-hudc__rail button[aria-selected="true"]{box-shadow:none;color:#111}
${S("solar")} .alm-om,${S("solar")} .alm-hudw__dial{border-radius:0}
${S("solar")} .alm-hudc__ttl b{font-weight:900}

/* Nocturne: arched portraits, a filigree frame */
${S("nocturne")} .alm-om{border-radius:50% 50% 3px 3px;font-style:italic}
${S("nocturne")} .alm-hudc{box-shadow:0 30px 60px -24px rgba(0,0,0,.8),0 0 0 1px var(--alm-line),inset 0 0 0 4px var(--alm-panel)}
${S("nocturne")} .alm-hudc__pane{box-shadow:inset 0 0 0 4px var(--alm-panel),inset 0 0 0 5px var(--alm-line)}
${S("nocturne")} .alm-hudc h6{font-family:var(--alm-font-display);font-style:italic;text-transform:none;letter-spacing:.04em;font-size:13px}
${S("nocturne")} .alm-hudc__ttl b{font-style:italic;font-weight:500}

/* Botanical: specimen labels and tape */
${S("botanical")} .alm-hudw,${S("botanical")} .alm-hudc{--alm-hud-pill:4px}
${S("botanical")} .alm-hudw{border-color:var(--alm-ink)}
${S("botanical")} .alm-om{border-radius:4px;background:var(--alm-panel);color:var(--c);box-shadow:0 0 0 1px var(--c);font-family:var(--alm-font-mono);font-weight:400}
${S("botanical")} .alm-hudc{overflow:visible;border:1px solid var(--alm-ink)}
${S("botanical")} .alm-hudc__sky{border-radius:calc(var(--alm-hud-r) + 5px) calc(var(--alm-hud-r) + 5px) 0 0}
${S("botanical")} .alm-hudc::before{content:"";position:absolute;z-index:2;top:-8px;left:40%;width:70px;height:17px;background:color-mix(in oklab,var(--alm-gold) 40%,transparent);transform:rotate(-3deg);pointer-events:none}
${S("botanical")} .alm-hudc__rail button{border-radius:3px}

/* Prism: holographic foil */
${S("prism")} .alm-hudw{border:1.5px solid transparent;background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,var(--alm-holo) border-box}
${S("prism")} .alm-hudc{box-shadow:0 30px 60px -24px rgba(0,0,0,.7);border:1.5px solid transparent;background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,var(--alm-holo) border-box}
${S("prism")} .alm-hudc__rail button[aria-selected="true"],${S("prism")} .alm-hudw__badge{background:var(--alm-holo);color:#15152c}
${S("prism")} .alm-hudc__ttl b{font-weight:800}

/* Candy: stickers with hard shadows */
${S("candy")} .alm-hudw{border:2.5px solid var(--alm-pop);box-shadow:3px 3px 0 var(--alm-pop)}
${S("candy")} .alm-hudc{border:2.5px solid var(--alm-pop);box-shadow:5px 5px 0 var(--alm-pop)}
${S("candy")} .alm-om{box-shadow:0 0 0 2px var(--alm-pop);transform:rotate(-6deg)}
${S("candy")} .alm-hudc__rail button[aria-selected="true"]{border:2px solid var(--alm-pop);box-shadow:2px 2px 0 var(--alm-pop)}
${S("candy")} .alm-hudc__per,${S("candy")} .alm-hudc__count{box-shadow:inset 0 0 0 2px var(--alm-pop),3px 3px 0 var(--c,var(--alm-accent))}
${S("candy")} .alm-hudw__badge{border:2px solid var(--alm-pop);box-shadow:2px 2px 0 var(--alm-pop)}

/* Dossier: case file, a stamped count */
${S("dossier")} .alm-hudw,${S("dossier")} .alm-hudc{--alm-hud-pill:3px}
${S("dossier")} .alm-om{border-radius:3px}
${S("dossier")} .alm-hudw__badge{border-radius:2px;background:none;color:var(--alm-accent);box-shadow:none;border:1.5px solid var(--alm-accent);transform:rotate(-8deg);font-family:var(--alm-font-mono)}
${S("dossier")} .alm-hudc__row{border-bottom-style:solid}
${S("dossier")} .alm-hudc__per{background:var(--alm-panel);border-left:3px solid var(--c);border-radius:2px}
${S("dossier")} .alm-hudc__note{font-size:1.7em}

/* Scriptorium: ribbons, a wax seal, blackletter */
${S("scriptorium")} .alm-hudw,${S("scriptorium")} .alm-hudc{--alm-hud-pill:3px}
${S("scriptorium")} .alm-hudw{outline:1px solid var(--alm-line);outline-offset:-4px}
${S("scriptorium")} .alm-hudw__t{font:400 20px/1 "UnifrakturMaguntia",serif}
${S("scriptorium")} .alm-hudc__ttl b{font:400 clamp(30px,11.5cqi,42px)/1 "UnifrakturMaguntia",serif}
${S("scriptorium")} .alm-hudw__badge{width:24px;height:24px;line-height:24px;background:radial-gradient(circle at 35% 30%,#d4475a,#8e1f2f 70%);box-shadow:0 2px 5px rgba(0,0,0,.4),inset 0 0 0 3px rgba(0,0,0,.18)}
${S("scriptorium")} .alm-om{border-radius:50% 50% 6px 6px;box-shadow:0 0 0 2px var(--alm-hud-ring),0 0 0 3px var(--alm-gold);font:400 13px/1 "UnifrakturMaguntia",serif}
${S("scriptorium")} .alm-hudc h6{border-bottom:3px double var(--alm-line);padding-bottom:4px}
${S("scriptorium")} .alm-hudc__pane{box-shadow:inset 0 0 0 3px var(--alm-panel),inset 0 0 0 4px var(--alm-line)}

/* Arcana: gold frames, glowing voices */
${S("arcana")} .alm-hudc{box-shadow:0 30px 60px -24px rgba(0,0,0,.8),0 0 0 1px color-mix(in oklab,var(--alm-gold) 45%,transparent),0 0 36px -16px var(--alm-gold)}
${S("arcana")} .alm-hudw{border-color:color-mix(in oklab,var(--alm-gold) 50%,var(--alm-line))}
${S("arcana")} .alm-om{box-shadow:0 0 0 2px var(--alm-hud-ring),0 0 12px -1px var(--c)}
${S("arcana")} .alm-hudc h6{font-family:var(--alm-font-display);letter-spacing:.2em;color:var(--alm-gold)}
${S("arcana")} .alm-hudc__per{box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-gold) 30%,transparent),0 0 20px -12px var(--c)}

/* Orbital: clipped corners, instrument readout */
${S("orbital")} .alm-hudw,${S("orbital")} .alm-hudc{--alm-hud-pill:0px;--alm-hud-r:0px}
${S("orbital")} .alm-hudw{border-top:2px solid var(--alm-accent);text-transform:uppercase}
${S("orbital")} .alm-hudc{clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px));border-top:3px solid var(--alm-accent)}
${S("orbital")} .alm-om,${S("orbital")} .alm-hudw__dial,${S("orbital")} .alm-om__md{border-radius:0}
${S("orbital")} .alm-hudc__rail button,${S("orbital")} .alm-hudc__tag,${S("orbital")} .alm-hudc__d,${S("orbital")} .alm-hudc__st{border-radius:0}
${S("orbital")} .alm-hudw__badge{border-radius:0}
${S("orbital")} .alm-hudc h6>span:first-child::before{content:"// ";color:var(--alm-accent)}

/* Posy: round, with a sprig of roses */
${S("posy")} .alm-om{box-shadow:0 0 0 2px var(--alm-hud-ring),0 0 0 4px color-mix(in oklab,var(--c) 35%,transparent)}
${S("posy")} .alm-hudc__pane{position:relative}
${S("posy")} .alm-hudc__pane::after{content:"";position:sticky;display:block;float:right;bottom:-10px;margin:-40px -12px -16px 0;width:64px;height:64px;background:var(--alm-sprig) center/contain no-repeat;opacity:.55;pointer-events:none}
${S("posy")} .alm-hudc h6>span:first-child::after{content:" ✿";color:var(--alm-accent)}

/* Airmail: an airmail-striped edge */
${S("airmail")} .alm-hudc{border:5px solid transparent;background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,repeating-linear-gradient(135deg,var(--alm-accent) 0 10px,var(--alm-panel) 10px 15px,var(--alm-accent-2) 15px 25px,var(--alm-panel) 25px 30px) border-box}
${S("airmail")} .alm-om{background:transparent;color:var(--c);box-shadow:0 0 0 1.5px var(--c),0 0 0 3px var(--alm-hud-ring),0 0 0 4px var(--c);transform:rotate(-8deg)}

/* Lido: square brass edges, octagon voices */
${S("lido")} .alm-hudw,${S("lido")} .alm-hudc{--alm-hud-pill:0px;--alm-hud-r:0px}
${S("lido")} .alm-hudw,${S("lido")} .alm-hudc{box-shadow:inset 0 0 0 1px var(--alm-gold),inset 0 0 0 4px var(--alm-panel),inset 0 0 0 5px color-mix(in oklab,var(--alm-gold) 55%,transparent),0 14px 30px -16px rgba(0,0,0,.6)}
${S("lido")} .alm-om{border-radius:0;clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)}
${S("lido")} .alm-hudc h6{letter-spacing:.3em;color:var(--alm-gold)}

/* Riso: ink outline, second ink off register */
${S("riso")} .alm-hudw,${S("riso")} .alm-hudc{border:2px solid var(--alm-ink);box-shadow:var(--alm-shadow)}
${S("riso")} .alm-om{background:radial-gradient(var(--c) 1.3px,transparent 1.7px) 0 0/4px 4px,color-mix(in oklab,var(--c) 22%,var(--alm-panel));color:var(--alm-ink);box-shadow:0 0 0 2px var(--c)}

/* Neon: a lit frame at night */
${S("neon")} .alm-hudw,${S("neon")} .alm-hudc{border-color:color-mix(in oklab,var(--alm-accent) 55%,var(--alm-line));box-shadow:0 0 calc(16px * var(--alm-gl)) calc(-4px * var(--alm-gl)) var(--alm-accent),0 14px 30px -16px rgba(0,0,0,.6)}
${S("neon")} .alm-om{background:transparent;color:var(--c);box-shadow:0 0 0 1.5px var(--c),0 0 calc(8px * var(--alm-gl)) var(--c)}
${S("neon")} .alm-hudw__t{color:var(--alm-accent-2);text-shadow:0 0 calc(8px * var(--alm-gl)) var(--alm-accent-2)}

/* Splash Page: a comic panel */
${S("splash")} .alm-hudw,${S("splash")} .alm-hudc{--alm-hud-pill:3px;--alm-hud-r:2px;border:2.5px solid var(--alm-line);box-shadow:4px 4px 0 var(--alm-pow)}
${S("splash")} .alm-om{box-shadow:0 0 0 2px var(--alm-line)}
${S("splash")} .alm-hudc h6{font-family:var(--alm-font-display);letter-spacing:.08em;color:var(--alm-accent)}
`;

export const HUD_CSS = BASE + SIGNATURES;

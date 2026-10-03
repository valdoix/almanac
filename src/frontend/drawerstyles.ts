// The drawer's "Night Almanac" layer: heroes, stickers, toggles, medals, dot
// meters, rings and the restyled pages. Scoped to the drawer (.almo), drawn in
// the skin's tokens so every skin and both modes keep working, and laid over
// PANEL_CSS. The group colour of the open page arrives as --g.

export const DRAWER_CSS = `
.almo{--g:#ffc46b;--on-g:#17132e;--almo-font:var(--alm-font-display);font-size:15px;line-height:1.5;background:var(--alm-panel-2);background-image:var(--alm-texture)}
.almo .almx-ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-3px}
.almo .almx-ic.sm{width:15px;height:15px}
.almo .almx-ic.lg{width:26px;height:26px}
.almo .muted{color:var(--alm-muted)}
.almo small{font-size:12.5px}

/* ── Sky ── */
.almo-sky{padding:16px 16px 14px}
.almo-sky .almo-town{position:absolute;left:0;right:0;bottom:0;width:100%;height:40px;z-index:-1;fill:color-mix(in oklab,var(--alm-panel-2) 70%,#000);opacity:.6;pointer-events:none}
.almo-sky__row{align-items:flex-start}
.almo-clock{font-size:44px;font-family:var(--almo-font)}
.almo-date{padding-top:4px;font:400 12.5px/1.3 var(--alm-font-body);color:rgba(255,255,255,.9)}
.almo-date b{display:block;font-size:14.5px;font-weight:700}
.almo-day{flex:none;margin-left:auto;padding:5px 10px;border-radius:8px;background:#ffc46b;color:#2b1a00;font:800 12.5px/1 var(--almo-font);letter-spacing:.06em;text-transform:uppercase;transform:rotate(4deg);box-shadow:0 3px 0 rgba(0,0,0,.25);white-space:nowrap}
.almo-day+.almo-moon{margin-left:6px}
.almo-title{font:700 23px/1.15 var(--almo-font);margin-top:12px;max-width:92%}
.almo-chips{margin-top:12px;gap:6px}
.almo-chips span{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;background:rgba(10,8,36,.4);border-color:rgba(255,255,255,.14);font-size:12.5px}
.almo-chips .almo-ic{width:14px;height:14px}
.almo-seg{margin-top:14px;border-radius:16px;background:rgba(8,8,30,.5)}
.almo-seg button{flex-direction:column;gap:3px;min-height:46px;padding:6px 4px;border-radius:12px;font-size:12px;font-weight:700;color:rgba(255,255,255,.82)}
.almo-seg .almo-ic{width:18px;height:18px}
.almo-seg button[aria-selected="true"]{background:var(--pc);color:var(--on-g);box-shadow:none}

/* ── Page hero ── */
.almo-body{padding:16px 14px 18px}
.almo-head{display:flex;align-items:flex-end;gap:12px;margin:2px 0 18px}
.almo-head>div{flex:1;min-width:0}
.almo-head .almo-eyebrow{color:color-mix(in oklab,var(--g) 65%,var(--alm-ink));font:700 11.5px/1 var(--alm-font-body);letter-spacing:.16em}
.almo-head h3{margin:6px 0 6px!important;font:800 34px/1 var(--almo-font)!important;letter-spacing:-.02em}
.almo-head small{font-size:13.5px}
.almo-badge{flex:none;width:60px;height:60px;border-radius:19px;display:grid;place-items:center;background:var(--g);color:var(--on-g);transform:rotate(-6deg);box-shadow:0 5px 0 color-mix(in oklab,var(--g) 45%,#000)}
.almo-badge .almo-ic{width:32px;height:32px;stroke-width:2}

/* ── Sections, cards, atoms ── */
.almo-body h4,.almo .almx-sec h4{margin:22px 0 10px;font:700 19px/1.2 var(--almo-font);letter-spacing:-.01em;text-transform:none;color:var(--alm-ink)}
.almo .almx-sec{display:flex;align-items:center;gap:10px;margin:22px 0 10px}
.almo .almx-sec h4{margin:0}
.almo .almx-n{min-width:24px;height:24px;padding:0 7px;border-radius:999px;display:grid;place-items:center;background:color-mix(in oklab,var(--alm-ink) 12%,var(--alm-panel));font:700 12.5px/1 var(--alm-font-body)}
.almo .almx-hint{margin-left:auto;color:var(--alm-muted);font-size:12.5px;text-align:right}
.almo .card{border-radius:calc(var(--alm-radius) + 4px);padding:14px 16px;margin:0 0 12px}
.almo .card.tight{padding:11px 13px}
.almo .card.hl{border-color:var(--g)}
.almo .card.almx-bad{border-color:color-mix(in oklab,var(--alm-danger) 55%,var(--alm-line));background:color-mix(in oklab,var(--alm-danger) 9%,var(--alm-panel))}
.almo .card.almx-dash{border-style:dashed;border-width:2px}
.almo .card.almx-soft{background:transparent;border-style:dashed}
.almo .rec{border-radius:var(--alm-radius);padding:12px 14px;background:var(--alm-panel)}
.almo .rec .hd b{font:700 16px/1.25 var(--almo-font)}
.almo .list{gap:10px}
.almo .empty{border-radius:calc(var(--alm-radius) + 4px);padding:22px 18px}
.almo .almx-stack{display:grid;gap:10px}
.almo .almx-g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.almo .almx-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.almo .almx-lbl{display:flex;align-items:center;gap:6px;font:700 11.5px/1.3 var(--alm-font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--alm-muted)}
.almo .almx-val{font:700 16px/1.3 var(--almo-font);margin-top:4px;overflow-wrap:anywhere}
.almo .almx-big{font:800 36px/1 var(--almo-font);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.almo .almx-row{display:flex;align-items:center;gap:10px;min-width:0}
.almo .almx-row>.grow{min-width:0}
.almo .almx-rows>*{padding:11px 0;border-bottom:1px dashed var(--alm-line)}
.almo .almx-rows>*:last-child{border-bottom:0}
.almo .almx-inset{padding:10px 12px;border-radius:var(--alm-r-sm);background:var(--alm-panel-2);font-size:13.5px}
.almo .almx-note{padding:12px;border-radius:var(--alm-r-sm);border:1.5px dashed var(--alm-line);font-size:13.5px}
.almo .almx-quote{padding:12px 14px;border-radius:calc(var(--alm-r-sm) + 2px);background:var(--alm-panel-2)}
.almo .almx-quote p{margin:6px 0 0;font:600 16.5px/1.35 var(--almo-font)}
.almo .almx-callout{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:calc(var(--alm-radius) + 2px);margin:0 0 10px;font-size:14px;line-height:1.45;background:color-mix(in oklab,var(--alm-accent-2) 12%,var(--alm-panel));border:1px solid color-mix(in oklab,var(--alm-accent-2) 35%,var(--alm-line))}
.almo .almx-callout.warn{background:color-mix(in oklab,var(--alm-warn) 13%,var(--alm-panel));border-color:color-mix(in oklab,var(--alm-warn) 40%,var(--alm-line))}
.almo .almx-callout.bad{background:color-mix(in oklab,var(--alm-danger) 11%,var(--alm-panel));border-color:color-mix(in oklab,var(--alm-danger) 40%,var(--alm-line))}
.almo .almx-callout>.almx-ic{width:24px;height:24px;margin-top:1px}
.almo .almx-callout.warn>.almx-ic{color:var(--alm-warn)}
.almo .almx-callout.bad>.almx-ic{color:var(--alm-danger)}
.almo .almx-callout .almx-lbl{color:inherit;opacity:.8}

/* Stickers */
.almo .almx-stk{display:inline-block;flex:none;padding:5px 8px;border-radius:7px;font:800 10.5px/1 var(--almo-font);letter-spacing:.09em;text-transform:uppercase;white-space:nowrap;transform:rotate(-2deg);background:color-mix(in oklab,var(--alm-ink) 13%,var(--alm-panel));color:var(--alm-ink)}
.almo .almx-stk.g{background:var(--g);color:var(--on-g)}
.almo .almx-stk.good{background:var(--alm-good);color:var(--alm-panel)}
.almo .almx-stk.warn{background:var(--alm-warn);color:var(--alm-panel)}
.almo .almx-stk.bad{background:var(--alm-danger);color:var(--alm-panel)}
.almo .almx-stk.acc{background:var(--alm-accent);color:var(--alm-on-accent)}
.almo .almx-stk.acc2{background:var(--alm-accent-2);color:var(--alm-panel)}
.almo .almx-stk.voice{background:var(--c);color:var(--alm-on-voice)}
.almo .almx-stk.ghost{background:transparent;border:1.5px dashed color-mix(in oklab,var(--alm-muted) 70%,transparent);color:var(--alm-muted);padding:4px 7px}
.almo .almx-stk.flat{transform:none}
.almo .card,.almo .almx-row>.grow,.almo .almx-inset{min-width:0;overflow-wrap:anywhere}
.almo .row>.almx-stk,.almo .almx-row>.almx-stk{max-width:100%;white-space:normal;line-height:1.2;text-align:center}
.almo .almx-bond__nm{display:block;font:700 15.5px/1.25 var(--almo-font)}

/* Pills, buttons, fields */
.almo .pill{padding:5px 11px;font:600 12.5px/1.2 var(--alm-font-body);color:var(--alm-ink);margin:0}
.almo .pill.k,.almo .almk-key{font:500 12px/1.3 var(--alm-font-mono);color:var(--alm-accent);background:color-mix(in oklab,var(--alm-accent) 10%,var(--alm-panel));border:1px solid color-mix(in oklab,var(--alm-accent) 25%,var(--alm-line));padding:3px 9px;border-radius:999px}
.almo .pill.on{background:var(--g);color:var(--on-g)}
.almo .btn{box-sizing:border-box;max-width:100%;min-height:38px;padding:0 14px;border-radius:12px;font:700 13.5px/1 var(--alm-font-body);box-shadow:none;background:var(--alm-panel-2);justify-content:center;gap:7px}
.almo .btn:hover{border-color:color-mix(in oklab,var(--g) 60%,var(--alm-line))}
.almo .btn.primary{background:var(--g);color:var(--on-g);border-color:transparent}
.almo .btn.danger{background:transparent;border-color:color-mix(in oklab,var(--alm-danger) 45%,var(--alm-line))}
.almo .btn.ghost{background:transparent;border-color:transparent}
.almo .btn.sm{min-height:32px;padding:0 11px;border-radius:10px;font-size:12.5px}
.almo .btn.wide{display:flex;width:100%}
.almo .btn.tile{flex-direction:column;min-height:88px;gap:7px;text-align:center;line-height:1.2;padding:10px 6px}
.almo .btn.tile .almx-ic{width:26px;height:26px}
.almo .row .btn.grow{flex:1 1 0}
.almo input[type=text],.almo input[type=password],.almo input[type=number],.almo textarea,.almo select{min-height:40px;padding:8px 12px;border-radius:12px;background:var(--alm-panel);font-size:14px}
.almo textarea{padding:10px 12px;line-height:1.45}
.almo label.f{font:700 12px/1.3 var(--alm-font-body);gap:6px;letter-spacing:.02em}
.almo label.chk{gap:10px;margin:10px 0;font-size:14px}
.almo label.chk input[type=checkbox],.almo input.almx-switch{appearance:none;-webkit-appearance:none;flex:none;width:42px;height:24px;margin:0;border-radius:999px;background:color-mix(in oklab,var(--alm-ink) 18%,var(--alm-panel));position:relative;cursor:pointer;transition:background .15s}
.almo label.chk input[type=checkbox]::after,.almo input.almx-switch::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--alm-panel);box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .15s}
.almo label.chk input[type=checkbox]:checked,.almo input.almx-switch:checked{background:var(--g)}
.almo label.chk input[type=checkbox]:checked::after,.almo input.almx-switch:checked::after{left:21px;background:var(--on-g)}
.almo label.chk input:focus-visible{outline:2px solid var(--alm-accent);outline-offset:2px}
.almo input[type=range]{width:100%;accent-color:var(--g)}
.almo .almx-search{position:relative;flex:1;min-width:0}
.almo .almx-search .almx-ic{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--alm-muted);pointer-events:none}
.almo .almx-search input{padding-left:36px!important}

/* Toggles */
.almo .almx-tgl{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--alm-panel-2);border:1px solid var(--alm-line)}
.almo .card .almx-tgl{background:color-mix(in oklab,var(--alm-panel-2) 70%,var(--alm-panel))}
.almo .almx-tgl button{flex:1 1 0;min-width:0;min-height:36px;padding:4px 6px;border-radius:10px;font:700 12.5px/1.15 var(--alm-font-body);color:var(--alm-muted);text-align:center}
.almo .almx-tgl button:hover{color:var(--alm-ink)}
.almo .almx-tgl button[aria-pressed="true"]{background:var(--g);color:var(--on-g)}
.almo .almx-tgl button b{font-weight:800;opacity:.75;margin-left:3px}
.almo .almx-chips{display:flex;flex-wrap:wrap;gap:6px}
.almo .almx-chips button{padding:6px 12px;border-radius:999px;border:1px solid var(--alm-line);background:var(--alm-panel);font:600 12.5px/1.2 var(--alm-font-body);color:var(--alm-ink)}
.almo .almx-chips button[aria-pressed="true"]{background:var(--g);color:var(--on-g);border-color:transparent}

/* Medals, meters, rings, bars */
.almo .almx-medal{--c:var(--alm-muted);flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--c);color:var(--alm-on-voice);font:800 16px/1 var(--almo-font);box-shadow:0 0 0 3px var(--alm-panel),0 0 0 5px var(--c)}
.almo .almx-medal.sm{width:30px;height:30px;font-size:12px;box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px var(--c)}
.almo .almx-medal.xs{width:22px;height:22px;font-size:10px;box-shadow:none}
.almo .almx-medal.lg{width:64px;height:64px;font-size:24px}
.almo .almx-medal.dim{opacity:.5}
.almo .almx-pair{display:inline-flex}
.almo .almx-pair .almx-medal+.almx-medal{margin-left:-6px}
.almo .almx-dots{display:inline-flex;gap:3px;vertical-align:middle}
.almo .almx-dots i{width:10px;height:10px;border-radius:3px;background:color-mix(in oklab,var(--alm-ink) 14%,var(--alm-panel))}
.almo .almx-dots i.on{background:var(--c,var(--g))}
.almo .almx-meter{display:grid;gap:3px;font-size:11.5px;color:var(--alm-muted)}
.almo .almx-ring{flex:none;width:52px;height:52px;border-radius:50%;display:grid;place-items:center}
.almo .almx-ring>span{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--alm-panel);font:800 12.5px/1 var(--almo-font);font-variant-numeric:tabular-nums}
.almo .bar{height:10px;border-radius:999px;background:color-mix(in oklab,var(--alm-ink) 12%,var(--alm-panel))}
.almo .bar.thick{height:16px;border-radius:8px}
.almo .almx-dv{position:relative;flex:1;height:10px;border-radius:999px;background:color-mix(in oklab,var(--alm-ink) 12%,var(--alm-panel))}
.almo .almx-dv i{position:absolute;top:0;height:100%}
.almo .almx-dv::after{content:"";position:absolute;left:50%;top:-3px;width:2px;height:16px;background:var(--alm-muted)}
.almo .almx-dv.uni::after{display:none}
.almo .almx-key{display:inline-flex;align-items:center;gap:6px;font-size:12.5px}
.almo .almx-key i{width:11px;height:11px;border-radius:3px}

/* Person cards */
.almo .almx-pc{--c:var(--alm-muted);position:relative;padding:0;overflow:hidden;border-color:color-mix(in oklab,var(--c) 35%,var(--alm-line))}
.almo .almx-pc__band{position:relative;height:64px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.17) 0 9px,transparent 9px 18px),var(--c)}
.almo .almx-pc__band .almx-stk{position:absolute;right:12px;top:12px;background:var(--alm-panel);color:var(--alm-ink)}
.almo .almx-pc__slot{position:absolute;left:92px;top:14px;font:700 11px/1 var(--alm-font-body);letter-spacing:.1em;text-transform:uppercase;color:rgba(0,0,0,.6)}
.almo .almx-pc__bd{padding:0 14px 14px}
.almo .almx-pc__who{position:relative;display:flex;align-items:flex-start;gap:14px;margin-top:-30px}
.almo .almx-pc__who>.grow{padding-top:36px}
.almo .almx-pc__who .almx-medal{box-shadow:0 0 0 4px var(--alm-panel)}
.almo .almx-pc__nm{font:800 22px/1.1 var(--almo-font);overflow-wrap:anywhere}
.almo .kv{grid-template-columns:84px minmax(0,1fr);gap:6px 10px;font-size:14px}
.almo .kv b{font:700 11px/1.9 var(--alm-font-body);letter-spacing:.08em}
.almo .alm-tags{margin-top:12px;gap:6px}
.almo .alm-tag{font:600 12px/1 var(--alm-font-body);padding:6px 10px;color:var(--alm-ink)}
.almo .alm-tag.warn{color:var(--alm-danger)}
.almo .almx-pcs{padding:12px 14px}
.almo .almx-pcs .almx-pc__nm{font-size:18px}
.almo .almx-away{display:flex;align-items:center;gap:12px;width:100%;padding:10px 0;text-align:left;border-bottom:1px solid var(--alm-line)!important}
.almo .almx-away:last-child{border-bottom:0!important}
.almo .almx-away b{display:block;font-size:14.5px}
.almo .almx-away small{display:block;color:var(--alm-muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.almo .almx-merge{margin-top:12px}

/* Now */
.almo .almx-tile{padding:11px 13px;border-radius:calc(var(--alm-radius) + 2px);background:var(--alm-panel);border:1px solid var(--alm-line);min-width:0}
.almo .almx-tile small{display:block;color:var(--alm-muted);font-size:12.5px;line-height:1.35}
.almo .almx-fc{display:grid;gap:4px;align-items:start;text-align:center}
.almo .almx-fc em{display:flex;align-items:flex-end;height:58px}
.almo .almx-g2>.almx-tile:last-child:nth-child(odd){grid-column:1/-1}
.almo .almx-fc>div{display:grid;justify-items:center;gap:5px;font-size:12px;font-family:var(--alm-font-body)}
.almo .almx-fc span{font-size:18px;line-height:1}
.almo .almx-fc i{display:block;width:14px;border-radius:7px;background:var(--alm-accent-2)}
.almo .almx-fc b{font:800 14px/1 var(--almo-font)}
.almo .almx-hear{background:var(--alm-panel-2)}
.almo .almx-hear pre{margin:0;max-height:260px;background:none;border:0;padding:0;font-size:12px;line-height:1.6}
.almo .almx-em{font-style:italic;color:var(--alm-muted);font-size:14px}
.almo .almx-stats{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;margin-top:14px;color:var(--alm-muted);font-size:12.5px}

/* Bonds */
.almo .graph{border-radius:calc(var(--alm-radius) + 4px);border:1px solid var(--alm-line)}
.almo .almx-bond .almx-dvs{display:grid;gap:8px;margin-top:12px}
.almo .almx-bond .almx-dvrow{display:grid;grid-template-columns:82px minmax(0,1fr) 28px;align-items:center;gap:8px;font-size:12.5px}
.almo .almx-bond .almx-dvrow b{text-align:right;font-variant-numeric:tabular-nums}

/* Knowledge */
.almo .almk{gap:10px}
.almo .almk-stmt{font:700 19px/1.28 var(--almo-font)}
.almo .almk-st{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.almo .almk-h{grid-template-columns:30px minmax(0,1fr);align-items:center;padding:8px;border-radius:12px;background:var(--alm-panel-2)}
.almo .almk-h .alm-mini{width:30px!important;height:30px!important;font-size:12px!important}
.almo .almk-h__b{gap:2px 8px}
.almo .almk-h__b>b{font-size:13.5px;flex-basis:100%}
.almo .almk-h .alm-kp{padding:0;background:none;box-shadow:none;border:0;font:700 12px/1.3 var(--alm-font-body);white-space:normal}
.almo .almk--secret,.almo .almk--belief{box-shadow:none}
.almo .almk--secret{border-color:color-mix(in oklab,var(--alm-danger) 45%,var(--alm-line))}
.almo .almk--belief{border-color:color-mix(in oklab,var(--alm-warn) 45%,var(--alm-line))}
.almo .almk-un{padding:10px 12px;border-radius:12px;border:1.5px dashed var(--alm-line);font-size:13px}
.almo .almk-clerk .bar{margin:8px 0 10px}

/* Chronicle */
.almo .rec.chron{padding:0;overflow:hidden;border-left:1px solid color-mix(in oklab,var(--lv) 55%,var(--alm-line));border-color:color-mix(in oklab,var(--lv) 55%,var(--alm-line))}
.almo .rec.chron>.hd{padding:11px 14px;background:color-mix(in oklab,var(--lv) 22%,var(--alm-panel))}
.almo .rec.chron>.hd b{font-size:16.5px}
.almo .rec.chron>.chron-body{padding:10px 14px 12px}
.almo .chron .kind{background:var(--lv);color:#fff;font:800 10.5px/1 var(--almo-font);letter-spacing:.08em;padding:5px 8px;border-radius:7px;transform:rotate(-2deg)}
.almo .chron--chapter .kind{color:var(--alm-on-accent)}
.almo .chron--arc .kind{color:var(--alm-panel)}
.almo .chron-kids-t{font:700 12.5px/1 var(--alm-font-body)}
.almo .chron-kids{margin:8px 0 0 2px;padding-left:12px;border-left:3px solid color-mix(in oklab,var(--lv) 45%,var(--alm-line))}
.almo .chron-kids .rec.chron>.hd{padding:8px 12px}
.almo .rec.chron.chron--folded{border-style:dashed}
.almo .chron-legend{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px;font:600 12.5px/1.3 var(--alm-font-body)}
.almo .chron-lg{grid-template-columns:12px minmax(0,1fr) auto}
.almo .chron-lg i{width:12px;height:12px;border-radius:4px}

/* Timeline */
.almo .almx-tl{position:relative;padding-left:34px}
.almo .almx-tl::before{content:"";position:absolute;left:12px;top:6px;bottom:6px;width:3px;border-radius:2px;background:var(--alm-line)}
.almo .almx-tl__day{margin:4px 0 10px -34px}
.almo .almx-tl__ev{position:relative;margin-bottom:12px}
.almo .almx-tl__dot{position:absolute;left:-32px;top:12px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--k,var(--alm-accent));color:var(--alm-panel);box-shadow:0 0 0 3px var(--alm-panel-2)}
.almo .almx-tl__dot .almx-ic{width:13px;height:13px;stroke-width:2.4}
.almo .almx-tl__ev .card{margin:0}

/* World */
.almo .alm-clocks{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.almo .alm-inv{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.almo .alm-it{background:var(--alm-panel);border-radius:calc(var(--alm-radius) + 2px);grid-template-columns:1fr;gap:6px}
.almo .alm-it.gone{opacity:.6}
.almo .alm-it.gone b{text-decoration:line-through}
.almo .alm-it__h{font:500 12.5px/1.3 var(--alm-font-body)}
.almo .alm-it__ic{width:36px;height:36px;font-size:18px}
.almo .almx-bubble{flex:1;min-width:0;padding:11px 14px;border-radius:18px 18px 18px 4px;background:var(--alm-panel);border:1px solid var(--alm-line);font-size:14px}
.almo .almx-bits{display:flex;flex-wrap:wrap;gap:10px 8px}
.almo .almx-bits .almx-stk{font-size:11.5px;white-space:normal;text-align:left;line-height:1.25;max-width:100%}
.almo .almx-bits .almx-stk:nth-child(3n+2){transform:rotate(2deg)}
.almo .almx-bits .almx-stk:nth-child(3n){transform:rotate(-1deg)}

/* Elsewhere */
.almo .almx-wf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.almo .almx-wf>div{padding:9px 11px;border-radius:12px;font-size:13.5px;min-width:0;overflow-wrap:anywhere}
.almo .almx-wf .w{background:color-mix(in oklab,var(--alm-good) 14%,var(--alm-panel))}
.almo .almx-wf .f{background:color-mix(in oklab,var(--alm-danger) 12%,var(--alm-panel))}
.almo .almx-wf .w .almx-lbl{color:var(--alm-good)}
.almo .almx-wf .f .almx-lbl{color:var(--alm-danger)}
.almo .almx-beat{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:12px;background:var(--alm-panel-2);font-size:13.5px}
.almo .almx-die{flex:none;width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:var(--alm-ink);color:var(--alm-panel);font:800 14px/1 var(--almo-font)}
.almo .almx-reach{margin-top:12px;padding:12px;border-radius:14px;border:1.5px solid var(--alm-line);font-size:13.5px;display:grid;gap:6px}
.almo .almx-wings{display:grid;gap:12px}
.almo .almx-wings .pill a{color:inherit;text-decoration:none;margin-left:2px}

/* Codex and Lore */
.almo .almx-rec .almx-nm{display:block;font:800 19px/1.2 var(--almo-font);margin:6px 0 2px;overflow-wrap:anywhere}
.almo .almx-book{padding:0;overflow:hidden}
.almo .almx-book__hd{padding:14px 16px;background:color-mix(in oklab,var(--g) 22%,var(--alm-panel))}
.almo .almx-book__hd b{display:block;font:800 20px/1.15 var(--almo-font);margin-top:6px;overflow-wrap:anywhere}
.almo .almx-book__bd{padding:12px 16px 14px}
.almo .almx-conf{display:grid;gap:6px;padding:10px 0;border-bottom:1px solid var(--alm-line)}
.almo .almx-conf:last-child{border-bottom:0}
.almo .almx-conf .bar{height:6px}

/* Recall */
.almo .almx-score{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font:800 16px/1 var(--almo-font);background:color-mix(in oklab,var(--alm-ink) 12%,var(--alm-panel))}
.almo .almx-feed .card.in{border-color:color-mix(in oklab,var(--alm-good) 45%,var(--alm-line))}
.almo .almx-feed .card.in .almx-score{background:var(--alm-good);color:var(--alm-panel)}
.almo .almx-feed .card:not(.in){opacity:.78}
.almo .almx-code{font:500 12px/1.5 var(--alm-font-mono);overflow-wrap:anywhere}

/* Craft */
.almo .almx-try{padding:0;overflow:hidden}
.almo .almx-try__hd{position:relative;padding:16px;background:var(--g);color:var(--on-g)}
.almo .almx-try__hd .almx-lbl{color:inherit;opacity:.72}
.almo .almx-try__hd .almx-big{font-size:27px;line-height:1.1;margin-top:4px;padding-right:40px}
.almo .almx-try__hd>.almx-ic{position:absolute;right:16px;top:16px;width:32px;height:32px}
.almo .almx-try__bd{padding:12px 16px 14px}
.almo .almx-avoid{text-decoration:line-through;text-decoration-color:var(--alm-danger)}

/* Settings */
.almo details.almx-set{border-radius:calc(var(--alm-radius) + 4px);background:var(--alm-panel);border:1px solid var(--alm-line);margin:0 0 10px}
.almo details.almx-set>summary{display:flex;align-items:center;gap:12px;padding:11px 13px;cursor:pointer;list-style:none}
.almo details.almx-set>summary::-webkit-details-marker{display:none}
.almo details.almx-set>summary b{display:block;font:700 15.5px/1.25 var(--almo-font)}
.almo details.almx-set>summary small{display:block;color:var(--alm-muted);font-size:12.5px;line-height:1.35}
.almo details.almx-set>summary>.almx-ic:last-child{color:var(--alm-muted);transition:transform .15s}
.almo details.almx-set[open]>summary>.almx-ic:last-child{transform:rotate(180deg)}
.almo details.almx-set>.almx-set__bd{padding:2px 14px 14px}
.almo details.almx-set .card{background:transparent;border:0;box-shadow:none!important;padding:0;margin:0;clip-path:none}
.almo .almx-set__ic{flex:none;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:color-mix(in oklab,var(--k,var(--g)) 22%,var(--alm-panel));color:color-mix(in oklab,var(--k,var(--g)) 70%,var(--alm-ink))}
.almo .almx-truths textarea{background:color-mix(in oklab,#ffc46b 26%,var(--alm-panel));border-color:color-mix(in oklab,#ffc46b 50%,var(--alm-line));font-weight:600;transform:rotate(-.4deg)}
.almo .almx-skins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.almo .almx-skins button{display:grid;justify-items:center;gap:6px;padding:10px 4px;border-radius:12px;border:1.5px solid var(--alm-line);background:var(--alm-panel-2);font:600 12px/1.2 var(--alm-font-body);text-align:center}
.almo .almx-skins button[aria-pressed="true"]{border-color:var(--g);box-shadow:0 0 0 2px var(--g)}
.almo .almx-skins span{display:flex;gap:3px}
.almo .almx-skins i{width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(127,127,127,.4)}

/* Creator */
.almo .almcr-bubble{border-radius:18px;font-size:14px;padding:11px 14px}
.almo .almcr-msg.almanac .almcr-bubble{border-top-left-radius:4px;background:var(--alm-panel)}
.almo .almcr-msg.user .almcr-bubble{border-radius:18px 18px 4px 18px;background:var(--g);color:var(--on-g);border-color:transparent;font-weight:600}
.almo .almcr-who{display:flex;align-items:center;gap:6px;color:color-mix(in oklab,var(--g) 65%,var(--alm-ink));font:700 11px/1 var(--alm-font-body)}
.almo .almcr-who::before{content:"";width:18px;height:18px;border-radius:6px;background:var(--g);transform:rotate(-8deg)}
.almo .almcr-compose{border-radius:20px}
.almo .almcr-plan,.almo .almcr-draft,.almo .almcr-report{border-radius:14px;background:var(--alm-panel-2)}
.almo .almcr-head b{font:800 17px/1.2 var(--almo-font)}

/* ── Orbit: each page's name and count on its own plate, never running into the next ── */
.almo-orbit{width:312px;height:150px;bottom:92px}
.almo-orbit.four .almo-moonb,.almo-moonb{width:78px}
.almo-orbit:not(.four) .almo-moonb{width:100px}
.almo-orbit.five .almo-moonb{width:64px}
.almo-orbit.five .almo-moonb b{font-size:11.5px;padding:3px 4px}
.almo-orbit.five .almo-moonb small{font-size:10px;padding:2px 4px}
.almo-moonb{gap:5px}
.almo-moonb b{font:800 13px/1.15 var(--almo-font);text-shadow:none;padding:3px 7px;border-radius:8px;background:color-mix(in oklab,var(--alm-panel) 88%,transparent)}
.almo-moonb small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-width:100%;padding:3px 6px;border-radius:8px;background:color-mix(in oklab,var(--alm-panel) 88%,transparent);font:600 11px/1.25 var(--alm-font-body);color:var(--alm-muted);overflow-wrap:anywhere}
.almo-orbit__t{font:800 11px/1 var(--almo-font)}
@media (max-width:360px){.almo .almx-g3{grid-template-columns:repeat(2,minmax(0,1fr))}.almo-head h3{font-size:28px!important}}
`;

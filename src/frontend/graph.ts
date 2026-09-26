// Force-directed relationship graph (SVG) with a timeline scrubber.

import { escapeHtml as e, initials } from "../core/util";

export interface GNode { id: string; name: string; color: string; spot: boolean; user: boolean }
export interface GEdge { from: string; to: string; axes: Record<string, number>; label?: string; changedAt: number; changedNow: boolean; history: { axis: string; delta: number; to: number; msgIndex: number }[] }

const DOMINANT_COLORS: Record<string, string> = {
  trust: "#3f9a62", affection: "#e05a8a", respect: "#4f7ab0", familiarity: "#8a8a8a", comfort: "#6bb3a0",
  attraction: "#ff6fa8", fear: "#7b5bd6", resentment: "#cc4a4a", obligation: "#c58a22", rivalry: "#e07b30",
};

export function edgeAsOf(edge: GEdge, msgIndex: number): Record<string, number> {
  if (msgIndex === Infinity) return edge.axes;
  const out: Record<string, number> = {};
  for (const h of edge.history) if (h.msgIndex <= msgIndex) out[h.axis] = h.to;
  return out;
}

export function layout(nodes: GNode[], edges: GEdge[], w = 640, h = 360): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  nodes.forEach((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    pos[n.id] = { x: w / 2 + Math.cos(a) * w * 0.3, y: h / 2 + Math.sin(a) * h * 0.3, vx: 0, vy: 0 };
  });
  for (let it = 0; it < 260; it++) {
    for (const a of nodes) for (const b of nodes) {
      if (a.id >= b.id) continue;
      const pa = pos[a.id], pb = pos[b.id];
      let dx = pa.x - pb.x, dy = pa.y - pb.y;
      const d2 = Math.max(80, dx * dx + dy * dy);
      const f = 26000 / d2;
      const d = Math.sqrt(d2);
      dx /= d; dy /= d;
      pa.vx += dx * f; pa.vy += dy * f; pb.vx -= dx * f; pb.vy -= dy * f;
    }
    for (const ed of edges) {
      const pa = pos[ed.from], pb = pos[ed.to];
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (d - 190) * 0.012;
      pa.vx += (dx / d) * f; pa.vy += (dy / d) * f; pb.vx -= (dx / d) * f; pb.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      const p = pos[n.id];
      p.vx += (w / 2 - p.x) * 0.004; p.vy += (h / 2 - p.y) * 0.006;
      p.x += Math.max(-12, Math.min(12, p.vx)); p.y += Math.max(-12, Math.min(12, p.vy));
      p.vx *= 0.55; p.vy *= 0.55;
      p.x = Math.max(44, Math.min(w - 44, p.x)); p.y = Math.max(40, Math.min(h - 46, p.y));
    }
  }
  return Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, { x: v.x, y: v.y }]));
}

export function renderGraph(nodes: GNode[], edges: GEdge[], opts: { asOf: number; filterAxis?: string; npcOnly?: boolean }): string {
  const w = 640, h = 360;
  const es = edges
    .map((ed) => ({ ...ed, cur: edgeAsOf(ed, opts.asOf) }))
    .filter((ed) => Object.keys(ed.cur).length)
    .filter((ed) => !opts.npcOnly || (ed.from !== "user" && ed.to !== "user"))
    .filter((ed) => !opts.filterAxis || ed.cur[opts.filterAxis] != null);
  const used = new Set(es.flatMap((x) => [x.from, x.to]));
  const ns = nodes.filter((n) => used.has(n.id) || n.spot);
  if (!ns.length) return `<div class="empty">No relationships recorded${opts.asOf !== Infinity ? " yet at this point" : ""}.</div>`;
  const pos = layout(ns, es, w, h);
  const defs: string[] = [`<marker id="almar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>`];
  const paths: string[] = [];
  const labels: string[] = [];
  es.forEach((ed, i) => {
    const a = pos[ed.from], b = pos[ed.to];
    if (!a || !b) return;
    const axis = opts.filterAxis ?? Object.entries(ed.cur).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0]?.[0] ?? "trust";
    const mag = Math.abs(ed.cur[axis] ?? 0);
    const color = DOMINANT_COLORS[axis] ?? "#888";
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len, ny = dx / len;
    const bend = 26;
    const sx = a.x + (dx / len) * 30, sy = a.y + (dy / len) * 30;
    const ex = b.x - (dx / len) * 32, ey = b.y - (dy / len) * 32;
    const cx = (a.x + b.x) / 2 + nx * bend, cy = (a.y + b.y) / 2 + ny * bend;
    const d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
    const neg = (ed.cur[axis] ?? 0) < 0;
    paths.push(`<path d="${d}" stroke="${color}" stroke-width="${(1.4 + mag * 0.55).toFixed(1)}" fill="none" stroke-linecap="round" marker-end="url(#almar)"${neg ? ' stroke-dasharray="6 5"' : ""} opacity=".9"><title>${e(ed.from)} → ${e(ed.to)}</title></path>`);
    if (ed.changedNow && opts.asOf === Infinity) paths.push(`<path class="spark" d="${d}" fill="none"/>`);
    const txt = Object.entries(ed.cur).filter(([, v]) => v).slice(0, 2).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(" · ") + (ed.label ? ` · ${ed.label}` : "");
    labels.push(`<text class="lbl" x="${cx.toFixed(0)}" y="${(cy + (i % 2 ? 12 : -6)).toFixed(0)}" text-anchor="middle">${e(txt.slice(0, 42))}</text>`);
  });
  const circles = ns.map((n, i) => {
    const p = pos[n.id];
    defs.push(`<radialGradient id="almn${i}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${n.color}" stop-opacity=".55"/><stop offset=".6" stop-color="${n.color}"/></radialGradient>`);
    return `${n.spot ? `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="34" fill="${n.color}" opacity=".16"/>` : ""}<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="24" fill="url(#almn${i})" stroke="var(--alm-panel)" stroke-width="3"/><text class="ini" x="${p.x.toFixed(0)}" y="${(p.y + 5).toFixed(0)}" text-anchor="middle">${e(initials(n.name))}</text><text class="nm" x="${p.x.toFixed(0)}" y="${(p.y + 42).toFixed(0)}" text-anchor="middle">${e(n.name)}</text>`;
  });
  return `<svg class="graph" viewBox="0 0 ${w} ${h}" role="img" aria-label="Relationship graph"><defs>${defs.join("")}</defs><g>${paths.join("")}</g><g>${labels.join("")}</g><g>${circles.join("")}</g></svg>
<div class="row" style="margin-top:6px">${Object.entries(DOMINANT_COLORS).map(([k, c]) => `<span class="pill"><i style="display:inline-block;width:10px;height:3px;background:${c}"></i>${k}</span>`).join("")}<span class="pill">┄ negative</span><span class="pill">✦ changed now</span></div>`;
}

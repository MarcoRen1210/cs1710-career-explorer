// ---------------------------------------------------------------------------
// Sketch 9 — Career Progression (lane ribbons + category highlight panel)
//
// One lane per career category, in the same order as the radial chart.
// Within every lane the vertical position of a node encodes the median salary
// on ONE shared scale, so slopes are comparable across lanes. Medians compare
// different people at each level; they are not longitudinal salary growth.
// ---------------------------------------------------------------------------
import { state, selectCategory, isDimmedCat } from "./state.js";
import { fmtUSD, fmtK, fmtInt, tooltip, row, widthOf } from "./utils.js";
import { LEVELS, MIN_N, SOURCES } from "./config.js";

let data, el, panelEl, svg;

export function initProgression(_data, container, panel) {
  data = _data;
  el = container;
  panelEl = panel;
  render();
}

export function render() {
  const W = widthOf(el);
  const compact = W < 520;
  const cats = data.categories;
  const pillW = compact ? 104 : 150;
  const m = { top: 44, right: compact ? 24 : 36, bottom: 30, left: pillW + 18 };
  const rise = 20;
  const laneStep = 52;
  const H = m.top + cats.length * laneStep + m.bottom;

  const x = d3.scalePoint().domain(LEVELS.map((l) => l.code)).range([m.left + 22, W - m.right]);
  const allMedians = cats.flatMap((c) => c.levels.map((l) => l.median)).filter((v) => v != null);
  const yDom = d3.extent(allMedians);
  const yOff = d3.scaleLinear().domain(yDom).range([0, -rise]);
  const laneBase = (i) => m.top + i * laneStep + rise + 12;

  d3.select(el).selectAll("svg").remove();
  svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Median salary by experience level for each career category");

  const cols = svg.append("g").attr("class", "prog-cols");
  cols.selectAll("line").data(LEVELS).join("line")
    .attr("x1", (d) => x(d.code)).attr("x2", (d) => x(d.code))
    .attr("y1", m.top - 10).attr("y2", H - m.bottom + 6);
  cols.selectAll("text").data(LEVELS).join("text")
    .attr("x", (d) => x(d.code)).attr("y", m.top - 22).attr("text-anchor", "middle")
    .text((d) => d.label);

  svg.append("text").attr("class", "prog-note").attr("x", compact ? 4 : m.left - 6).attr("y", H - 8)
    .text(compact
      ? `Height = median, shared ${fmtK(yDom[0])}–${fmtK(yDom[1])} scale`
      : `Node height within each lane = median salary on a shared ${fmtK(yDom[0])}–${fmtK(yDom[1])} scale`);

  const line = d3.line().defined((d) => d.median != null).x((d) => x(d.code)).y((d) => d.y).curve(d3.curveMonotoneX);

  const lanes = svg.append("g").selectAll("g.lane").data(cats, (d) => d.id).join("g")
    .attr("class", (d) => "lane" + (d.isOther ? " other" : ""))
    .attr("transform", (d, i) => `translate(0,${laneBase(i)})`);

  lanes.each(function (cat) {
    const sel = d3.select(this);
    const lv = cat.levels.map((l) => ({ ...l, y: l.median != null ? yOff(l.median) : -rise / 2 }));

    const pill = sel.append("g").attr("class", "pill").attr("transform", `translate(4,${-rise / 2 - 11})`)
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", `Select ${cat.name}`)
      .on("click", () => pick(cat))
      .on("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(cat); } });
    pill.append("rect").attr("width", pillW).attr("height", 22).attr("rx", 6).attr("stroke", cat.color);
    pill.append("text").attr("x", pillW / 2).attr("y", 15).attr("text-anchor", "middle").text(cat.short);
    const firstDef = lv.find((d) => d.median != null);
    sel.append("line").attr("class", "pill-lead").attr("stroke", cat.color)
      .attr("x1", pillW + 4).attr("x2", x(firstDef.code) - 8).attr("y1", -rise / 2).attr("y2", firstDef.y);

    sel.append("path").attr("class", "ribbon").attr("d", line(lv)).attr("stroke", cat.color);
    for (let k = 0; k < lv.length - 1; k++) {
      const a = lv[k], b = lv[k + 1];
      if (a.median == null || b.median == null) continue;
      sel.append("path").attr("class", "spine" + (a.status === "low" || b.status === "low" ? " limited" : ""))
        .attr("d", line([a, b])).attr("stroke", cat.color);
    }

    const nodes = sel.selectAll("g.node").data(lv).join("g")
      .attr("class", (d) => "node " + d.status)
      .attr("transform", (d) => `translate(${x(d.code)},${d.y})`)
      .on("click", () => pick(cat));
    const has = nodes.filter((d) => d.status !== "none");
    has.append("circle").attr("class", "dotc").attr("r", 5)
      .attr("fill", (d) => (d.status === "low" ? "var(--bg-card)" : cat.color))
      .attr("stroke", (d) => (d.status === "low" ? cat.color : "#fff"));
    has.append("text").attr("class", "val").attr("y", -9).attr("text-anchor", "middle").text((d) => fmtK(d.median));
    nodes.filter((d) => d.status === "low").append("text").attr("class", "flag").attr("y", 16).attr("text-anchor", "middle")
      .text((d) => `⚠ n=${d.n}`);
    has.filter((d) => d.status === "ok").append("text").attr("class", "nlabel").attr("y", 16).attr("text-anchor", "middle")
      .text((d) => `n=${fmtInt(d.n)}`);
    const none = nodes.filter((d) => d.status === "none");
    none.append("circle").attr("class", "missing").attr("r", 5);
    none.append("text").attr("class", "flag").attr("y", -9).attr("text-anchor", "middle").text("N/A");
    nodes.append("circle").attr("class", "hit").attr("r", 13);
    tooltip(nodes, (d) => nodeTip(cat, d));
  });

  update();
}

// Overridable click behaviour (Prototype B changes it)
export let pick = (cat) => selectCategory(cat.id);
export const setPick = (fn) => { pick = fn; };

function nodeTip(cat, d) {
  const status = d.status === "none"
    ? `<div class="tt-note warn">No ${d.label.toLowerCase()}-level records — no value shown.</div>`
    : d.status === "low" ? `<div class="tt-note warn">⚠ Limited data: fewer than ${MIN_N} records.</div>` : "";
  return `
    <div class="tt-title" style="--c:${cat.color}">${cat.name}</div>
    <div class="tt-sub">${d.label} level (${d.code})</div>
    ${d.n ? row("Median salary", fmtUSD(d.median)) : ""}
    ${d.n ? row("Middle 50% (IQR)", `${fmtK(d.q1)} – ${fmtK(d.q3)}`) : ""}
    ${row("Sample size", "n = " + fmtInt(d.n))}
    ${status}
    <div class="tt-note">Compares different people at each level, not one person's growth.</div>
    <div class="tt-src">${SOURCES.salary}</div>`;
}

export function update() {
  if (!svg) return;
  svg.selectAll("g.lane")
    .classed("dimmed", (d) => isDimmedCat(d.id))
    .classed("selected", (d) => d.id === state.catId);
  svg.selectAll("g.lane .pill").attr("aria-pressed", (d) => d.id === state.catId);
  renderPanel();
}

// ---- Category highlight panel --------------------------------------------
function renderPanel() {
  const p = d3.select(panelEl).html("");
  const cat = state.catId ? data.catById.get(state.catId) : null;
  p.append("div").attr("class", "panel-kicker").text("Category highlight");

  if (!cat) {
    if (state.origin === "occ") {
      const occ = data.blsByCode.get(state.occCodes[0]);
      p.append("div").attr("class", "panel-title muted").text("Unavailable");
      p.append("p").attr("class", "panel-msg warn")
        .html(`<b>${occ.occupation}</b> has no corresponding salary category, so no experience-level comparison is shown.`);
      return;
    }
    p.append("div").attr("class", "panel-title muted").text("Select a category");
    p.append("p").attr("class", "panel-msg").text("Click a lane label, a node, or a petal to see median salary and sample size by experience level.");
    const key = p.append("ul").attr("class", "key");
    key.append("li").html(`<span class="k-dot"></span> n ≥ ${MIN_N}`);
    key.append("li").html(`<span class="k-dot hollow"></span> ⚠ n &lt; ${MIN_N}: limited data (dashed path)`);
    key.append("li").html(`<span class="k-dot missing"></span> N/A: no records, no line drawn`);
    return;
  }

  p.append("div").attr("class", "panel-title").style("color", cat.color).text(cat.name);
  p.append("div").attr("class", "panel-sub").text("Median salary by experience level");

  const w = 230, h = 120, mt = 20, mb = 20;
  const xs = d3.scaleBand().domain(LEVELS.map((l) => l.code)).range([0, w]).padding(0.28);
  const ys = d3.scaleLinear().domain([0, d3.max(data.categories, (c) => d3.max(c.levels, (l) => l.median))]).range([h - mb, mt]);
  const s = p.append("svg").attr("class", "mini").attr("viewBox", `0 0 ${w} ${h}`);
  s.append("line").attr("class", "mini-base").attr("x1", 0).attr("x2", w).attr("y1", ys(0)).attr("y2", ys(0));
  const b = s.selectAll("g").data(cat.levels).join("g").attr("transform", (d) => `translate(${xs(d.code)},0)`);
  b.filter((d) => d.median != null).append("path")
    .attr("d", (d) => roundedTop(0, ys(d.median), xs.bandwidth(), ys(0) - ys(d.median), 3))
    .attr("fill", cat.color).attr("fill-opacity", (d) => (d.status === "low" ? 0.35 : 0.9))
    .attr("stroke", cat.color).attr("stroke-dasharray", (d) => (d.status === "low" ? "3 2" : null));
  b.append("text").attr("class", "mini-val").attr("x", xs.bandwidth() / 2).attr("text-anchor", "middle")
    .attr("y", (d) => (d.median != null ? ys(d.median) - 5 : ys(0) - 5))
    .text((d) => (d.median != null ? fmtK(d.median) : "N/A"));
  b.append("text").attr("class", "mini-lab").attr("x", xs.bandwidth() / 2).attr("y", h - 5).attr("text-anchor", "middle")
    .text((d) => d.label);

  p.append("div").attr("class", "panel-sub").text("Sample size (U.S., 2024)");
  const ul = p.append("ul").attr("class", "nlist");
  cat.levels.forEach((l) => {
    ul.append("li").attr("class", l.status)
      .html(`<span class="k-dot" style="background:${cat.color}"></span>${l.label}: <b>${fmtInt(l.n)}</b>` +
        (l.status === "low" ? ` <span class="warn">⚠ limited</span>` : l.status === "none" ? ` <span class="warn">no data</span>` : ""));
  });
}

function roundedTop(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

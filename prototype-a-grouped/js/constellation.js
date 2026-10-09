// ---------------------------------------------------------------------------
// Sketch 12 — Career Opportunity Constellation (BLS bubble chart)
//   x = projected employment growth 2025–2035 (%)
//   y = median annual wage 2025 ($)
//   bubble AREA ∝ employment 2025 (sqrt scale on radius)
//   color = career_category (same colors as the salary charts)
// Every bubble is an individual BLS occupation with its own official numbers.
// ---------------------------------------------------------------------------
import { state, selectOcc, isDimmedOcc } from "./state.js";
import { fmtUSD, fmtK, fmtInt, fmtPct, tooltip, row, widthOf } from "./utils.js";
import { SOURCES, SCOPE_TEXT, BLS_ONLY_STYLE } from "./config.js";

const LABEL_SIDE = {
  "15-2051": "left", "15-1221": "right", "15-1212": "right", "15-2031": "right",
  "15-2041": "right", "15-1252": "top", "15-1243": "left", "15-1211": "bottom-right",
  "15-1299": "left", "15-1242": "top-left", "15-1251": "bottom",
};

let data, el, panelEl, svg, rScale;
let legendOpen = false; // remembered across re-renders

export function initConstellation(_data, container, panel) {
  data = _data;
  el = container;
  panelEl = panel;
  render();
}

export function render() {
  const W = widthOf(el);
  const compact = W < 440;
  const m = { top: 20, right: compact ? 16 : 24, bottom: 46, left: compact ? 60 : 66 };
  const H = Math.round(Math.max(340, Math.min(470, W * 0.62)));
  const bls = [...data.bls].sort((a, b) => b.employment2025 - a.employment2025);

  const gx = d3.extent(bls, (d) => d.growth);
  const x = d3.scaleLinear().domain([Math.min(-10, gx[0] - 3), gx[1] + 6]).nice().range([m.left, W - m.right]);
  const gy = d3.extent(bls, (d) => d.wage);
  const y = d3.scaleLinear().domain([gy[0] - 10000, gy[1] + 12000]).nice().range([H - m.bottom, m.top]);
  rScale = d3.scaleSqrt().domain([0, d3.max(bls, (d) => d.employment2025)]).range([0, compact ? 28 : 38]);

  d3.select(el).selectAll("svg").remove();
  svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Bubble chart of BLS occupations by projected growth and median wage");

  const defs = svg.append("defs");
  const glow = defs.append("filter").attr("id", "star-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
  glow.append("feGaussianBlur").attr("stdDeviation", 5).attr("result", "b");
  const mg = glow.append("feMerge");
  mg.append("feMergeNode").attr("in", "b");
  mg.append("feMergeNode").attr("in", "SourceGraphic");

  const grid = svg.append("g").attr("class", "cst-grid");
  grid.selectAll("line.v").data(x.ticks(6)).join("line").attr("class", (d) => (d === 0 ? "v zero" : "v"))
    .attr("x1", x).attr("x2", x).attr("y1", m.top).attr("y2", H - m.bottom);
  grid.selectAll("line.h").data(y.ticks(5)).join("line").attr("class", "h")
    .attr("x1", m.left).attr("x2", W - m.right).attr("y1", y).attr("y2", y);

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => d + "%").tickSizeOuter(0));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(fmtK).tickSizeOuter(0));
  svg.append("text").attr("class", "axis-title").attr("x", (m.left + W - m.right) / 2).attr("y", H - 8)
    .attr("text-anchor", "middle").text("Projected employment growth, 2025–2035 (%)");
  svg.append("text").attr("class", "axis-title").attr("transform", `translate(${compact ? 11 : 14},${(m.top + H - m.bottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").text("Median annual wage, 2025 (USD)");

  const stars = svg.append("g").selectAll("g.star").data(bls, (d) => d.code).join("g")
    .attr("class", (d) => "star" + (d.catId ? "" : " bls-only"))
    .attr("transform", (d) => `translate(${x(d.growth)},${y(d.wage)})`)
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (d) => `${d.occupation}: median wage ${fmtUSD(d.wage)}, growth ${fmtPct(d.growth)}`)
    .on("click", (e, d) => selectOcc(d.code))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectOcc(d.code); } });

  stars.append("circle").attr("class", "halo").attr("r", (d) => rScale(d.employment2025) + 5);
  stars.append("circle").attr("class", "bubble").attr("r", (d) => Math.max(3, rScale(d.employment2025)))
    .attr("fill", (d) => d.color).attr("stroke", (d) => d.color);
  stars.append("circle").attr("class", "core").attr("r", 1.8);
  stars.append("circle").attr("class", "hit").attr("r", (d) => Math.max(12, rScale(d.employment2025)));
  tooltip(stars, (d) => occTip(d));

  const labelLayer = svg.append("g").attr("class", "cst-labels");
  labelLayer.selectAll("text").data(bls, (d) => d.code).join("text")
    .attr("class", (d) => "star-label" + (d.catId ? " linked" : ""))
    .text((d) => d.short);
  placeLabels(labelLayer, { x, y, rScale, W, H, m });
  labelLayer.classed("compact", compact);

  update();
}

// Collision-aware label placement: each label tries positions around its
// bubble (preferred side first) and takes the one that overlaps the fewest
// other labels and bubbles while staying inside the chart. Labels that
// cannot be placed cleanly are hidden; tooltips still name every bubble.
function placeLabels(layer, { x, y, rScale, W, H, m }) {
  const nodes = layer.selectAll("text").nodes();
  const circles = nodes.map((n) => {
    const d = n.__data__;
    return { cx: x(d.growth), cy: y(d.wage), r: Math.max(3, rScale(d.employment2025)), code: d.code };
  });
  const pos = (side, px, py, r) => {
    const k = r * 0.72;
    return {
      right: [px + r + 6, py + 4, "start"], left: [px - r - 6, py + 4, "end"],
      top: [px, py - r - 6, "middle"], bottom: [px, py + r + 13, "middle"],
      "top-left": [px - k - 3, py - k - 3, "end"], "top-right": [px + k + 3, py - k - 3, "start"],
      "bottom-left": [px - k - 3, py + k + 11, "end"], "bottom-right": [px + k + 3, py + k + 11, "start"],
    }[side];
  };
  const hits = (b, c) => {
    const nx = Math.max(b.x, Math.min(c.cx, b.x + b.width)), ny = Math.max(b.y, Math.min(c.cy, b.y + b.height));
    return (nx - c.cx) ** 2 + (ny - c.cy) ** 2 < (c.r + 1) ** 2;
  };
  const overlap = (a, b) => a.x < b.x + b.width + 2 && b.x < a.x + a.width + 2 && a.y < b.y + b.height + 1 && b.y < a.y + a.height + 1;
  const placed = [];
  // Linked occupations first, then larger bubbles
  const order = nodes.slice().sort((a, b) => (!!b.__data__.catId - !!a.__data__.catId) || (b.__data__.employment2025 - a.__data__.employment2025));
  order.forEach((node) => {
    const d = node.__data__;
    const t = d3.select(node).classed("unplaced", false);
    const c = circles.find((q) => q.code === d.code);
    const sides = [LABEL_SIDE[d.code] || "right", "right", "left", "top", "bottom", "top-right", "top-left", "bottom-right", "bottom-left"];
    let best = null;
    sides.forEach((side, i) => {
      const [lx, ly, anchor] = pos(side, c.cx, c.cy, c.r);
      t.attr("x", lx).attr("y", ly).attr("text-anchor", anchor);
      const bb = node.getBBox();
      const box = { x: bb.x, y: bb.y, width: bb.width * 1.08, height: bb.height };
      if (anchor === "end") box.x -= bb.width * 0.08;
      const out = box.x < 2 || box.x + box.width > W - 2 || box.y < 0 || box.y + box.height > H - m.bottom;
      const score = (out ? 1000 : 0) + 1000 * placed.filter((p) => overlap(box, p)).length
        + 30 * circles.filter((q) => q.code !== d.code && hits(box, q)).length + i;
      if (!best || score < best.score) best = { score, lx, ly, anchor, box };
    });
    t.attr("x", best.lx).attr("y", best.ly).attr("text-anchor", best.anchor);
    if (best.score >= 1000) t.classed("unplaced", true);
    else placed.push(best.box);
  });
}

const catName = (d) => (d.catId ? data.catById.get(d.catId).name : `${d.categoryName} (BLS only)`);

// One-line version for the compact panel (the full note is in tooltips and the rail)
const SCOPE_SHORT = { direct_for_exact_title_only: "direct match for the exact job title only", broader_context_only: "broader context only" };
function shortLink(d) {
  if (!d.catId) return "No corresponding salary category: a BLS catch-all, not the same as the salary data’s “Other”.";
  return `Salary category: <b>${data.catById.get(d.catId).name}</b> · <i>${SCOPE_SHORT[d.scope] || d.scope}</i>`;
}

function linkText(d) {
  if (!d.catId) return `No corresponding salary category. ${SCOPE_TEXT[d.scope] || ""}`;
  const c = data.catById.get(d.catId);
  return `Salary category: <b>${c.name}</b> (median ${fmtUSD(c.median)}, n = ${fmtInt(c.n)}).<br>${SCOPE_TEXT[d.scope] || ""}`;
}

function occTip(d) {
  return `
    <div class="tt-title" style="--c:${d.color}">${d.occupation}</div>
    <div class="tt-sub">SOC ${d.code} · ${catName(d)}</div>
    ${row("Median wage (2025)", fmtUSD(d.wage))}
    ${row("10th – 90th pct wage", `${fmtK(d.wageP10)} – ${fmtK(d.wageP90)}`)}
    ${row("Employment 2025", fmtInt(d.employment2025))}
    ${row("Employment 2035 (proj.)", fmtInt(d.employment2035))}
    ${row("Growth 2025–2035", fmtPct(d.growth))}
    ${row("Annual openings", fmtInt(d.openings))}
    <div class="tt-note">${linkText(d)}</div>
    <div class="tt-src">${SOURCES.blsWage}<br>${SOURCES.blsProj}</div>`;
}

export function update() {
  if (!svg) return;
  const noMatch = state.origin === "cat" && !state.occCodes.length;
  const sel = (d) => state.occCodes.includes(d.code);
  svg.selectAll("g.star")
    .classed("dimmed", (d) => isDimmedOcc(d.code))
    .classed("faint", noMatch)
    .classed("selected", sel)
    .attr("aria-pressed", sel);
  svg.selectAll("g.star.selected").raise().select(".bubble").attr("filter", "url(#star-glow)");
  svg.selectAll("g.star:not(.selected) .bubble").attr("filter", null);
  svg.selectAll(".star-label").classed("dimmed", (d) => isDimmedOcc(d.code)).classed("selected", sel);
  renderPanel();
}

// ---- Side panel: legend + selected occupation(s) ------------------------
function renderPanel() {
  const p = d3.select(panelEl).html("");

  const det = p.append("details").attr("class", "legend-details").property("open", legendOpen)
    .on("toggle", function () { legendOpen = this.open; });
  det.append("summary").text("Legend");
  const leg = det.append("div").attr("class", "cst-legend");
  const cats = leg.append("ul").attr("class", "key scroll-key");
  data.categories.filter((c) => c.bls.length).forEach((c) => {
    cats.append("li").html(`<span class="k-dot" style="background:${c.color}"></span>${c.name}`);
  });
  data.bls.filter((b) => !b.catId).forEach((b) => {
    cats.append("li").html(`<span class="k-dot" style="background:${BLS_ONLY_STYLE.color}"></span>${b.categoryName} <i>(BLS only)</i>`);
  });
  leg.append("div").attr("class", "panel-kicker").style("margin-top", "6px").text("Bubble area = employment (2025)");
  const sizes = [100000, 500000, 1500000];
  const maxR = rScale(sizes[2]);
  const s = leg.append("svg").attr("class", "size-key").attr("viewBox", `0 0 200 ${maxR * 2 + 8}`);
  sizes.forEach((v) => {
    const r = rScale(v);
    s.append("circle").attr("cx", maxR + 2).attr("cy", maxR * 2 + 4 - r).attr("r", r);
    s.append("line").attr("x1", maxR + 2).attr("x2", maxR * 2 + 22).attr("y1", maxR * 2 + 4 - 2 * r).attr("y2", maxR * 2 + 4 - 2 * r);
    s.append("text").attr("x", maxR * 2 + 26).attr("y", maxR * 2 + 8 - 2 * r).text(d3.format(".2~s")(v).replace("k", "K"));
  });

  const box = p.append("div").attr("class", "occ-box");
  box.append("div").attr("class", "panel-kicker").text("Selected occupation");

  if (state.origin === "cat" && !state.occCodes.length) {
    const cat = data.catById.get(state.catId);
    box.append("div").attr("class", "panel-title muted").text("Outlook data unavailable");
    box.append("p").attr("class", "panel-msg warn")
      .html(`<b style="color:${cat.color}">${cat.name}</b> has no corresponding BLS occupation in this dataset, so no wage or employment projection is shown.`);
    return;
  }
  if (!state.occCodes.length) {
    box.append("div").attr("class", "panel-title muted").text("Click a bubble");
    box.append("p").attr("class", "panel-msg").text("Hover for full BLS statistics; click to link with the salary views.");
    return;
  }
  state.occCodes.forEach((code) => {
    const d = data.blsByCode.get(code);
    box.append("div").attr("class", "panel-title").style("color", d.color).text(d.occupation);
    box.append("div").attr("class", "panel-sub").text(`SOC ${d.code} · ${catName(d)}`);
    const stat = (k, v) => box.append("div").attr("class", "stat").html(`<span>${k}</span><b>${v}</b>`);
    stat("Median wage (2025)", fmtUSD(d.wage));
    stat("Projected growth (2025–2035)", fmtPct(d.growth));
    stat("Annual openings (2025–2035)", "~" + fmtInt(d.openings));
    stat("Employment (2025)", fmtInt(d.employment2025));
    box.append("p").attr("class", "panel-msg" + (d.catId ? "" : " warn")).html(shortLink(d));
  });
  box.append("div").attr("class", "panel-foot").text("Source: BLS OEWS 2025; Employment Projections 2025–2035. Full scope note in the tooltip and the Explore panel.");
}

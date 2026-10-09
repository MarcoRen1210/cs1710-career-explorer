// ---------------------------------------------------------------------------
// Sketch 12 — Career Opportunity Constellation (main view in Prototype B)
//   x = projected employment growth 2025–2035 (%)
//   y = median annual wage 2025 ($)
//   bubble AREA ∝ employment 2025 (sqrt scale on radius)
//   color = career_category (same colors as the salary charts)
// Selected occupations get a ring + ①/② badge in their slot color and are
// joined by a dashed "constellation" line.
// ---------------------------------------------------------------------------
import { state, toggleOcc, replaceSlot, cancelPending, hasSelection, slotOfOcc } from "./state.js";
import { fmtUSD, fmtK, fmtInt, fmtPct, tooltip, row, widthOf } from "./utils.js";
import { SOURCES, SLOTS, SCOPE_TEXT, BLS_ONLY_STYLE } from "./config.js";

const LABEL_SIDE = {
  "15-2051": "left", "15-1221": "right", "15-1212": "right", "15-2031": "right",
  "15-2041": "right", "15-1252": "top", "15-1243": "left", "15-1211": "bottom-right",
  "15-1299": "left", "15-1242": "top-left", "15-1251": "bottom",
};

let data, el, legendEl, svg, x, y, rScale, popover;

export function initConstellation(_data, container, legendContainer) {
  data = _data;
  el = container;
  legendEl = legendContainer;
  popover = d3.select(el).append("div").attr("class", "popover").attr("role", "dialog").attr("hidden", true);
  render();
}

export function render() {
  const W = widthOf(el);
  const compact = W < 440;
  const m = { top: 24, right: compact ? 16 : 28, bottom: 48, left: compact ? 60 : 72 };
  const H = Math.round(Math.max(400, Math.min(600, W * 0.72)));
  const bls = [...data.bls].sort((a, b) => b.employment2025 - a.employment2025);

  const gx = d3.extent(bls, (d) => d.growth);
  x = d3.scaleLinear().domain([Math.min(-10, gx[0] - 3), gx[1] + 6]).nice().range([m.left, W - m.right]);
  const gy = d3.extent(bls, (d) => d.wage);
  y = d3.scaleLinear().domain([gy[0] - 10000, gy[1] + 12000]).nice().range([H - m.bottom, m.top]);
  rScale = d3.scaleSqrt().domain([0, d3.max(bls, (d) => d.employment2025)]).range([0, compact ? 30 : 46]);

  d3.select(el).selectAll("svg").remove();
  svg = d3.select(el).insert("svg", ".popover").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Bubble chart of BLS occupations by projected growth and median wage");

  const defs = svg.append("defs");
  const glow = defs.append("filter").attr("id", "star-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
  glow.append("feGaussianBlur").attr("stdDeviation", 6).attr("result", "b");
  const mg = glow.append("feMerge");
  mg.append("feMergeNode").attr("in", "b");
  mg.append("feMergeNode").attr("in", "SourceGraphic");
  const lg = defs.append("linearGradient").attr("id", "link-grad").attr("gradientUnits", "userSpaceOnUse");
  lg.append("stop").attr("offset", 0).attr("stop-color", SLOTS[0].color);
  lg.append("stop").attr("offset", 1).attr("stop-color", SLOTS[1].color);

  // Axes & grid
  const grid = svg.append("g").attr("class", "cst-grid");
  grid.selectAll("line.v").data(x.ticks(8)).join("line").attr("class", (d) => (d === 0 ? "v zero" : "v"))
    .attr("x1", x).attr("x2", x).attr("y1", m.top).attr("y2", H - m.bottom);
  grid.selectAll("line.h").data(y.ticks(6)).join("line").attr("class", "h")
    .attr("x1", m.left).attr("x2", W - m.right).attr("y1", y).attr("y2", y);

  // Reference lines: medians of the occupations shown (computed from the file)
  const medG = d3.median(bls, (d) => d.growth);
  const medW = d3.median(bls, (d) => d.wage);
  const ref = svg.append("g").attr("class", "cst-ref");
  ref.append("line").attr("x1", x(medG)).attr("x2", x(medG)).attr("y1", m.top).attr("y2", H - m.bottom);
  ref.append("line").attr("x1", m.left).attr("x2", W - m.right).attr("y1", y(medW)).attr("y2", y(medW));
  ref.append("text").attr("x", x(medG) + 5).attr("y", m.top + 10).text(`median growth ${fmtPct(medG)}`);
  ref.append("title").text(`Dashed lines: medians across the ${bls.length} occupations in the file`);
  ref.append("text").attr("x", W - m.right - 4).attr("y", y(medW) + 15).attr("text-anchor", "end")
    .text(`median wage ${fmtK(medW)}`);
  if (!compact) {
    ref.append("text").attr("class", "quad").attr("x", W - m.right - 6).attr("y", m.top + 10).attr("text-anchor", "end").text("Higher pay · faster growth ↗");
  }

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat((d) => d + "%").tickSizeOuter(0));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat(fmtK).tickSizeOuter(0));
  svg.append("text").attr("class", "axis-title").attr("x", (m.left + W - m.right) / 2).attr("y", H - 8)
    .attr("text-anchor", "middle").text("Projected employment growth, 2025–2035 (%)");
  svg.append("text").attr("class", "axis-title").attr("transform", `translate(${compact ? 11 : 16},${(m.top + H - m.bottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").text("Median annual wage, 2025 (USD)");

  // Link line between the two selected occupations
  svg.append("line").attr("class", "cst-link").attr("stroke", "url(#link-grad)");

  // Bubbles (largest first so small ones stay on top)
  const stars = svg.append("g").attr("class", "stars").selectAll("g.star").data(bls, (d) => d.code).join("g")
    .attr("class", (d) => "star" + (d.catId ? "" : " bls-only"))
    .attr("transform", (d) => `translate(${x(d.growth)},${y(d.wage)})`)
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (d) => `${d.occupation}: median wage ${fmtUSD(d.wage)}, growth ${fmtPct(d.growth)}. Toggle comparison.`)
    .on("click", (e, d) => { e.stopPropagation(); toggleOcc(d.code); })
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOcc(d.code); } });

  stars.append("circle").attr("class", "halo").attr("r", (d) => Math.max(3, rScale(d.employment2025)) + 6);
  stars.append("circle").attr("class", "bubble").attr("r", (d) => Math.max(3, rScale(d.employment2025)))
    .attr("fill", (d) => d.color).attr("stroke", (d) => d.color);
  stars.append("circle").attr("class", "core").attr("r", 1.8);
  stars.append("circle").attr("class", "hit").attr("r", (d) => Math.max(12, rScale(d.employment2025)));
  stars.append("text").attr("class", "slot-badge")
    .attr("x", (d) => Math.max(3, rScale(d.employment2025)) * 0.75 + 6)
    .attr("y", (d) => -Math.max(3, rScale(d.employment2025)) * 0.75 - 4);
  tooltip(stars, (d) => occTip(d));

  // Labels (measured, flipped at edges, then hidden on compact screens)
  const labelLayer = svg.append("g").attr("class", "cst-labels");
  labelLayer.selectAll("text").data(bls, (d) => d.code).join("text")
    .attr("class", (d) => "star-label" + (d.catId ? " linked" : ""))
    .text((d) => d.short);
  placeLabels(labelLayer, { x, y, rScale, W, H, m });
  labelLayer.classed("compact", compact);

  svg.on("click", () => cancelPending());
  renderLegend();
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

function salaryLine(d) {
  if (d.catId) {
    const c = data.catById.get(d.catId);
    return `Salary category: <b>${c.name}</b> (median ${fmtUSD(c.median)}, n = ${fmtInt(c.n)}).<br>${SCOPE_TEXT[d.scope] || ""}`;
  }
  return `No corresponding salary category. ${SCOPE_TEXT[d.scope] || ""}`;
}

function occTip(d) {
  const s = slotOfOcc(d.code);
  const hint = s >= 0
    ? `Selected as ${SLOTS[s].badge} · click to remove`
    : state.slots.includes(null) ? "Click to add to the comparison" : "Click to replace ① or ②";
  return `
    <div class="tt-title" style="--c:${d.color}">${d.occupation}</div>
    <div class="tt-sub">SOC ${d.code} · ${catName(d)}</div>
    ${row("Median wage (2025)", fmtUSD(d.wage))}
    ${row("10th – 90th pct wage", `${fmtK(d.wageP10)} – ${fmtK(d.wageP90)}`)}
    ${row("Employment 2025", fmtInt(d.employment2025))}
    ${row("Employment 2035 (proj.)", fmtInt(d.employment2035))}
    ${row("Growth 2025–2035", fmtPct(d.growth))}
    ${row("Annual openings", fmtInt(d.openings))}
    <div class="tt-note">${salaryLine(d)}</div>
    <div class="tt-hint">${hint}</div>
    <div class="tt-src">${SOURCES.blsWage}<br>${SOURCES.blsProj}</div>`;
}

export function update() {
  if (!svg) return;
  const any = hasSelection();
  svg.selectAll("g.star")
    .classed("dimmed", (d) => any && slotOfOcc(d.code) < 0 && d.code !== state.pending)
    .classed("selected", (d) => slotOfOcc(d.code) >= 0)
    .classed("pending", (d) => d.code === state.pending)
    .attr("aria-pressed", (d) => slotOfOcc(d.code) >= 0);
  svg.selectAll("g.star .halo").attr("stroke", (d) => {
    const s = slotOfOcc(d.code);
    return s >= 0 ? SLOTS[s].color : d.code === state.pending ? "#fff" : null;
  });
  svg.selectAll("g.star .slot-badge")
    .text((d) => (slotOfOcc(d.code) >= 0 ? SLOTS[slotOfOcc(d.code)].badge : ""))
    .attr("fill", (d) => (slotOfOcc(d.code) >= 0 ? SLOTS[slotOfOcc(d.code)].color : null));
  svg.selectAll("g.star.selected").raise().select(".bubble").attr("filter", "url(#star-glow)");
  svg.selectAll("g.star:not(.selected) .bubble").attr("filter", null);
  svg.selectAll(".star-label")
    .classed("dimmed", (d) => any && slotOfOcc(d.code) < 0)
    .classed("selected", (d) => slotOfOcc(d.code) >= 0)
    .attr("fill", (d) => (slotOfOcc(d.code) >= 0 ? SLOTS[slotOfOcc(d.code)].color : null));

  // Constellation line between ① and ②
  const [a, b] = state.slots.map((c) => (c ? data.blsByCode.get(c) : null));
  const link = svg.select(".cst-link");
  if (a && b) {
    const p = [x(a.growth), y(a.wage), x(b.growth), y(b.wage)];
    svg.select("#link-grad").attr("x1", p[0]).attr("y1", p[1]).attr("x2", p[2]).attr("y2", p[3]);
    link.attr("x1", p[0]).attr("y1", p[1]).attr("x2", p[2]).attr("y2", p[3]).attr("visibility", "visible");
  } else link.attr("visibility", "hidden");

  renderPopover();
}

// "Both slots are full — which one should this replace?"
function renderPopover() {
  if (!state.pending) {
    popover.attr("hidden", true);
    return;
  }
  const d = data.blsByCode.get(state.pending);
  popover.attr("hidden", null).html("");
  popover.append("div").attr("class", "pop-title").html(`Compare <b>${d.occupation}</b> instead of:`);
  state.slots.forEach((code, i) => {
    const o = data.blsByCode.get(code);
    popover.append("button").attr("type", "button").attr("class", "pop-btn").style("--c", SLOTS[i].color)
      .html(`<span>${SLOTS[i].badge}</span> ${o.short}`)
      .on("click", (e) => { e.stopPropagation(); replaceSlot(i); });
  });
  popover.append("button").attr("type", "button").attr("class", "pop-cancel").text("Cancel")
    .on("click", (e) => { e.stopPropagation(); cancelPending(); });

  const W = el.clientWidth;
  const pw = popover.node().offsetWidth;
  const px = x(d.growth), py = y(d.wage);
  const r = Math.max(3, rScale(d.employment2025));
  popover.style("left", Math.max(4, Math.min(W - pw - 4, px - pw / 2)) + "px").style("top", py + r + 10 + "px");
  popover.select(".pop-btn").node().focus();
}

function renderLegend() {
  const p = d3.select(legendEl).html("");
  p.append("div").attr("class", "panel-kicker").text("Bubble color = career category (same colors as the salary charts)").style("display", "none");
  const cats = p.append("ul").attr("class", "key key-row");
  data.categories.filter((c) => c.bls.length).forEach((c) => {
    cats.append("li").html(`<span class="k-dot" style="background:${c.color}"></span>${c.name}`);
  });
  data.bls.filter((b) => !b.catId).forEach((b) => {
    cats.append("li").html(`<span class="k-dot" style="background:${BLS_ONLY_STYLE.color}"></span>${b.categoryName}&nbsp;<i>(BLS only, no salary category)</i>`);
  });
  const sizeWrap = p.append("div").attr("class", "size-wrap");
  sizeWrap.append("div").attr("class", "panel-kicker").text("Bubble area = employment (2025)");
  const sizes = [100000, 500000, 1500000];
  const maxR = rScale(sizes[2]);
  const s = sizeWrap.append("svg").attr("class", "size-key").attr("viewBox", `0 0 200 ${maxR * 2 + 8}`);
  sizes.forEach((v) => {
    const r = rScale(v);
    s.append("circle").attr("cx", maxR + 2).attr("cy", maxR * 2 + 4 - r).attr("r", r);
    s.append("line").attr("x1", maxR + 2).attr("x2", maxR * 2 + 22).attr("y1", maxR * 2 + 4 - 2 * r).attr("y2", maxR * 2 + 4 - 2 * r);
    s.append("text").attr("x", maxR * 2 + 26).attr("y", maxR * 2 + 8 - 2 * r).text(d3.format(".2~s")(v).replace("k", "K"));
  });
  p.append("div").attr("class", "panel-foot").text("Each bubble is one BLS occupation with its own official statistics · dashed lines = medians of the occupations shown");
}

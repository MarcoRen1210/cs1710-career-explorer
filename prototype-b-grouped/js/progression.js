// ---------------------------------------------------------------------------
// Sketch 9 — Career Progression (lane ribbons + category highlight panel)
//
// One lane per career category, in the same order as the radial chart.
// Within every lane the vertical position of a node encodes the median salary
// on ONE shared scale, so slopes are comparable across lanes. Medians compare
// different people at each level; they are not longitudinal salary growth.
// ---------------------------------------------------------------------------
import { pickCategory, hasSelection, slotsOfCat, catColor, badgesOfCat, salaryGroups, selection } from "./state.js";
import { fmtUSD, fmtK, fmtInt, tooltip, row, widthOf } from "./utils.js";
import { LEVELS, MIN_N, SOURCES } from "./config.js";

let pillMax = 140;
let data, el, panelEl, svg, laneBase;

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
  const pillW = compact ? 126 : 154;
  pillMax = pillW - 8;
  const m = { top: 34, right: compact ? 24 : 34, bottom: 24, left: pillW + 16 };
  // Compact lanes: values appear on hover/selection (see CSS), tooltips always.
  const rise = 13;
  // Lane spacing comes from the layout (CSS --lane-step) so tall columns can
  // use roomier lanes with values always visible; otherwise compact lanes.
  const cssStep = parseFloat(getComputedStyle(el).getPropertyValue("--lane-step"));
  const laneStep = cssStep || (W < 560 ? 30 : 33);
  // Selected lanes move to the top and get extra room for their values / n
  const EXTRA = 16;
  const H = m.top + cats.length * laneStep + m.bottom + 2 * EXTRA;

  const x = d3.scalePoint().domain(LEVELS.map((l) => l.code)).range([m.left + 22, W - m.right]);
  const allMedians = cats.flatMap((c) => c.levels.map((l) => l.median)).filter((v) => v != null);
  const yDom = d3.extent(allMedians);
  const yOff = d3.scaleLinear().domain(yDom).range([0, -rise]);
  laneBase = (i, k = 0) => m.top + i * laneStep + rise + 12 + EXTRA * Math.min(i, k);

  d3.select(el).selectAll("svg").remove();
  svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
    .attr("role", "img").attr("aria-label", "Median salary by experience level for each career category")
    .classed("roomy", laneStep >= 40)
    .classed("compact-lanes", compact);

  const cols = svg.append("g").attr("class", "prog-cols");
  cols.selectAll("line").data(LEVELS).join("line")
    .attr("x1", (d) => x(d.code)).attr("x2", (d) => x(d.code))
    .attr("y1", m.top - 10).attr("y2", H - m.bottom + 6);
  cols.selectAll("text").data(LEVELS).join("text")
    .attr("x", (d) => x(d.code)).attr("y", m.top - 16).attr("text-anchor", "middle")
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

    const pill = sel.append("g").attr("class", "pill").attr("transform", `translate(4,${-rise / 2 - 10})`)
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", `${cat.name}: add its BLS occupation to the comparison`)
      .on("click", () => pick(cat))
      .on("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(cat); } });
    pill.append("rect").attr("width", pillW).attr("height", 20).attr("rx", 6).attr("stroke", cat.color);
    pill.append("text").attr("x", pillW / 2).attr("y", 14).attr("text-anchor", "middle").text(cat.short)
      .each(function () { fitText(this, pillW - 8); });
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
    has.append("circle").attr("class", "dotc").attr("r", 4.5)
      .attr("fill", (d) => (d.status === "low" ? "var(--bg-card)" : cat.color))
      .attr("stroke", (d) => (d.status === "low" ? cat.color : "#fff"));
    has.append("text").attr("class", "val").attr("y", -8).attr("text-anchor", "middle").text((d) => fmtK(d.median));
    nodes.filter((d) => d.status === "low").append("text").attr("class", "flag").attr("y", 15).attr("text-anchor", "middle")
      .text((d) => `⚠ n=${d.n}`);
    has.filter((d) => d.status === "ok").append("text").attr("class", "nlabel").attr("y", 15).attr("text-anchor", "middle")
      .text((d) => `n=${fmtInt(d.n)}`);
    const none = nodes.filter((d) => d.status === "none");
    none.append("circle").attr("class", "missing").attr("r", 4.5);
    none.append("text").attr("class", "flag").attr("y", -8).attr("text-anchor", "middle").text("N/A");
    nodes.append("circle").attr("class", "hit").attr("r", 12);
    tooltip(nodes, (d) => nodeTip(cat, d));
  });

  update();
}

const pick = (cat) => pickCategory(cat);

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
  const any = hasSelection();
  // Selected categories move to the top (in slot order) so their paths sit together.
  const first = salaryGroups().map((gp) => gp.cat.id);
  const order = [...first, ...data.categories.map((c) => c.id).filter((id) => !first.includes(id))];

  svg.selectAll("g.lane")
    .classed("dimmed", (d) => any && !slotsOfCat(d.id).length)
    .classed("selected", (d) => slotsOfCat(d.id).length > 0)
    .each(function (cat) {
      const c = catColor(cat);
      const b = badgesOfCat(cat.id);
      const g = d3.select(this);
      g.selectAll(".ribbon, .spine, .pill-lead").attr("stroke", c);
      g.select(".pill rect").attr("stroke", c);
      g.select(".pill").attr("aria-pressed", !!b);
      g.select(".pill text").text((b ? b + " " : "") + cat.short).each(function () { fitText(this, pillMax); });
      g.selectAll(".node.ok .dotc").attr("fill", c);
      g.selectAll(".node.low .dotc").attr("stroke", c);
    })
    .transition().duration(450)
    .attr("transform", (d) => `translate(0,${laneBase(order.indexOf(d.id), first.length)})`);
  renderPanel();
}

// ---- Side panel: experience-level comparison of the selected categories --
function renderPanel() {
  const p = d3.select(panelEl).html("");
  const sel = selection();
  const groups = salaryGroups();
  p.append("div").attr("class", "panel-kicker").text("Experience-level comparison");

  if (!sel.length) {
    p.append("div").attr("class", "panel-title muted").text("Waiting for a selection");
    p.append("p").attr("class", "panel-msg").text("Pick occupations in the Constellation. Their career categories move to the top of the chart in their comparison colors.");
    const key = p.append("ul").attr("class", "key");
    key.append("li").html(`<span class="k-dot"></span> n ≥ ${MIN_N}`);
    key.append("li").html(`<span class="k-dot hollow"></span> ⚠ n &lt; ${MIN_N}: limited data (dashed)`);
    key.append("li").html(`<span class="k-dot missing"></span> N/A: no records, no line drawn`);
    return;
  }

  sel.filter((x) => !x.cat).forEach(({ slot, occ }) => {
    p.append("p").attr("class", "panel-msg warn")
      .html(`<b style="color:${slot.color}">${slot.badge} ${occ.short}</b>: no corresponding salary category, so no experience-level data is shown.`);
  });
  groups.filter((gp) => gp.slots.length > 1).forEach((gp) => {
    p.append("p").attr("class", "panel-msg warn")
      .html(`${gp.slots.map((s) => s.badge).join("")} <b>${gp.occs.map((o) => o.short).join(" and ")}</b> share the <b>${gp.cat.name}</b> category, so they share one set of salary statistics below.`);
  });
  if (!groups.length) return;

  const leg = p.append("div").attr("class", "cmp-legend");
  groups.forEach(({ slots, cat }) => leg.append("span")
    .html(`<span class="k-dot" style="background:${slots[0].color}"></span>${slots.map((s) => s.badge).join("")} ${cat.name}`));

  // Grouped bars (bars start at $0); one group per level
  const w = 250, h = 150, mt = 22, mb = 34;
  const x0 = d3.scaleBand().domain(LEVELS.map((l) => l.code)).range([0, w]).paddingInner(0.22).paddingOuter(0.05);
  const x1 = d3.scaleBand().domain(groups.map((gp, i) => i)).range([0, x0.bandwidth()]).padding(0.1);
  const ys = d3.scaleLinear().domain([0, d3.max(data.categories, (c) => d3.max(c.levels, (l) => l.median))]).range([h - mb, mt]);
  const s = p.append("svg").attr("class", "mini").attr("viewBox", `0 0 ${w} ${h}`);
  s.append("line").attr("class", "mini-base").attr("x1", 0).attr("x2", w).attr("y1", ys(0)).attr("y2", ys(0));
  LEVELS.forEach((lv, li) => {
    const g = s.append("g").attr("transform", `translate(${x0(lv.code)},0)`);
    groups.forEach(({ slots, cat }, gi) => {
      const d = cat.levels[li];
      const color = slots[0].color;
      const bx = x1(gi), bw = x1.bandwidth();
      if (d.median != null) {
        g.append("path").attr("d", roundedTop(bx, ys(d.median), bw, ys(0) - ys(d.median), 3))
          .attr("fill", color).attr("fill-opacity", d.status === "low" ? 0.3 : 0.9)
          .attr("stroke", color).attr("stroke-dasharray", d.status === "low" ? "3 2" : null);
        g.append("text").attr("class", "mini-val sm").attr("x", bx + bw / 2).attr("y", ys(d.median) - 4).attr("text-anchor", "middle")
          .text(d3.format(".0f")(d.median / 1000));
      } else {
        g.append("text").attr("class", "mini-val sm warn-fill").attr("x", bx + bw / 2).attr("y", ys(0) - 4).attr("text-anchor", "middle").text("N/A");
      }
      g.append("text").attr("class", "mini-n" + (d.status !== "ok" ? " warn-fill" : "")).attr("x", bx + bw / 2).attr("y", h - 20).attr("text-anchor", "middle")
        .text((d.status === "low" ? "⚠" : "") + d.n);
    });
    g.append("text").attr("class", "mini-lab").attr("x", x0.bandwidth() / 2).attr("y", h - 5).attr("text-anchor", "middle").text(lv.label);
  });
  p.append("div").attr("class", "panel-foot").text("Bar labels = median salary in $K; numbers under bars = sample size (n). ⚠ = fewer than " + MIN_N + " records.");

  const t = p.append("table").attr("class", "ntable");
  t.append("tr").html(`<th></th>${LEVELS.map((l) => `<th>${l.label}</th>`).join("")}`);
  groups.forEach(({ slots, cat }) => {
    t.append("tr").html(`<td style="color:${slots[0].color}">${slots.map((s) => s.badge).join("")}</td>` +
      cat.levels.map((l) => `<td class="${l.status}">${l.median != null ? fmtK(l.median) : "N/A"}<span>n=${fmtInt(l.n)}</span></td>`).join(""));
  });
}

// Shrink a label's font (never below 8.5px) until it fits the given width
function fitText(node, maxW) {
  node.style.fontSize = null;
  const len = node.getComputedTextLength();
  if (len > maxW) {
    const fs = parseFloat(getComputedStyle(node).fontSize);
    node.style.fontSize = Math.max(8.5, (fs * maxW) / len).toFixed(2) + "px";
  }
}

function roundedTop(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

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

export function initConstellation(_data, container, panel) {
  data = _data;
  el = container;
  panelEl = panel;
  render();
}

export function render() {
  const W = widthOf(el);
  const compact = W < 520;
  const m = { top: 24, right: compact ? 16 : 28, bottom: 52, left: compact ? 62 : 70 };
  const H = compact ? 380 : 430;
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
  svg.append("text").attr("class", "axis-title").attr("x", (m.left + W - m.right) / 2).attr("y", H - 12)
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
    .each(function (d) {
      const r = Math.max(3, rScale(d.employment2025));
      const px = x(d.growth), py = y(d.wage);
      const pos = {
        right: [px + r + 6, py + 4, "start"],
        left: [px - r - 6, py + 4, "end"],
        top: [px, py - r - 7, "middle"],
        bottom: [px, py + r + 14, "middle"],
        "top-left": [px - r - 2, py - r - 4, "end"],
        "bottom-right": [px + r * 0.6, py + r + 13, "start"],
      }[LABEL_SIDE[d.code] || "right"];
      d3.select(this).attr("x", pos[0]).attr("y", pos[1]).attr("text-anchor", pos[2]);
    })
    .text((d) => d.short)
    .each(function (d) {
      // Flip labels that would run past the chart edge (10% slack for bold selection)
      const t = d3.select(this);
      const len = this.getComputedTextLength() * 1.1;
      const lx = +t.attr("x");
      const a = t.attr("text-anchor");
      const left = a === "end" ? lx - len : a === "middle" ? lx - len / 2 : lx;
      const r = Math.max(3, rScale(d.employment2025));
      if (left + len > W - 2) t.attr("x", x(d.growth) - r - 6).attr("text-anchor", "end");
      else if (left < 2) t.attr("x", x(d.growth) + r + 6).attr("text-anchor", "start");
    });
  labelLayer.classed("compact", compact);

  update();
}

const catName = (d) => (d.catId ? data.catById.get(d.catId).name : `${d.categoryName} (BLS only)`);

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

  const leg = p.append("div").attr("class", "cst-legend");
  leg.append("div").attr("class", "panel-kicker").text("Bubble color = career category");
  const cats = leg.append("ul").attr("class", "key scroll-key");
  data.categories.filter((c) => c.bls.length).forEach((c) => {
    cats.append("li").html(`<span class="k-dot" style="background:${c.color}"></span>${c.name}`);
  });
  data.bls.filter((b) => !b.catId).forEach((b) => {
    cats.append("li").html(`<span class="k-dot" style="background:${BLS_ONLY_STYLE.color}"></span>${b.categoryName} <i>(BLS only)</i>`);
  });
  leg.append("div").attr("class", "panel-kicker").text("Bubble area = employment (2025)");
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
    box.append("p").attr("class", "panel-msg" + (d.catId ? "" : " warn")).html(linkText(d));
  });
  box.append("div").attr("class", "panel-foot").text("Source: U.S. Bureau of Labor Statistics (OEWS 2025; Employment Projections 2025–2035)");
}

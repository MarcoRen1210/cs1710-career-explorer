// ---------------------------------------------------------------------------
// Sketch 5 — Salary Landscape (radial "petal" chart), one petal per career
// category, ordered clockwise by median salary with "Other" last.
//
// Encoding (identical for every petal):
//   • distance from the center circle = salary (linear, $0 at the circle edge)
//   • petal width at a given radius   = kernel density of salaries there,
//                                       scaled to each category's own peak
//   • dots                            = individual salary records
//   • white segment / white dot       = IQR (25th–75th pct) / median
// Labels sit in two columns (left/right) with leader lines so 17 categories
// never overlap; on narrow screens the category list replaces them.
// ---------------------------------------------------------------------------
import { pickCategory, hasSelection, slotsOfCat, catColor, badgesOfCat, salaryGroups, selection } from "./state.js";
import { fmtUSD, fmtK, fmtInt, tooltip, showTip, moveTip, hideTip, row, widthOf } from "./utils.js";
import { SOURCES, LEVELS, SMALL_N, MIN_N, SLOTS } from "./config.js";

const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.code, l.label]));
const EMP_TYPE = { FT: "Full-time", PT: "Part-time", CT: "Contract", FL: "Freelance" };
const CO_SIZE = { S: "Small", M: "Medium", L: "Large" };

let data, el, stripEl, svg, g;
const onPick = (cat) => pickCategory(cat);

export function initLandscape(_data, container, strip) {
  data = _data;
  el = container;
  stripEl = strip;
  render();
}

export function render() {
  const W = widthOf(el);
  const compact = W < 540;
  const H = compact ? Math.round(W * 0.98) : Math.round(Math.min(720, Math.max(600, W * 0.66)));
  const medium = !compact && W < 800; // half-width cards: smaller label text
  const labelRoom = compact ? 10 : medium ? 172 : 190;
  const R = Math.min(W / 2 - labelRoom, H / 2 - (compact ? 14 : 30));
  const r0 = R * 0.2;
  const cx = W / 2;
  const cy = H / 2;
  const cats = data.categories;
  const step = (2 * Math.PI) / cats.length;

  const rScale = d3.scaleLinear().domain([0, data.salaryMax]).range([r0, R]);
  const halfAngle = (s) => rScale(s) * Math.tan(step / 2) * 0.92;
  // Widest petal that still fits between spokes at every category's density peak
  const maxHalf = Math.min(R * 0.12, d3.min(cats, (c) => {
    const pk = c.kde.reduce((a, b) => (b[1] > a[1] ? b : a));
    return halfAngle(pk[0]);
  }));

  d3.select(el).selectAll("svg").remove();
  svg = d3.select(el).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("width", W).attr("height", H)
    .attr("role", "img")
    .attr("aria-label", `Radial chart of 2024 U.S. salary distributions for ${cats.length} career categories`)
    .classed("medium", medium);

  const defs = svg.append("defs");
  const glow = defs.append("filter").attr("id", "petal-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
  glow.append("feGaussianBlur").attr("stdDeviation", 5).attr("result", "b");
  const merge = glow.append("feMerge");
  merge.append("feMergeNode").attr("in", "b");
  merge.append("feMergeNode").attr("in", "SourceGraphic");

  g = svg.append("g");

  // ---- Grid rings ------------------------------------------------------
  const rings = [100000, 200000, 300000, 400000];
  const grid = g.append("g").attr("class", "lnd-grid");
  grid.selectAll("circle").data(rings).join("circle")
    .attr("cx", cx).attr("cy", cy).attr("r", (d) => rScale(d));
  grid.selectAll("text").data(compact ? [200000, 400000] : rings).join("text")
    .attr("class", "ring-label")
    .attr("x", cx).attr("y", (d) => cy - rScale(d) - 4)
    .attr("text-anchor", "middle")
    .text((d) => fmtK(d));

  // ---- Petals ----------------------------------------------------------
  const geo = (a) => ({ ux: Math.sin(a), uy: -Math.cos(a), px: Math.cos(a), py: Math.sin(a) });
  const pt = (o, s, t) => [cx + rScale(s) * o.ux + t * o.px, cy + rScale(s) * o.uy + t * o.py];

  cats.forEach((c, i) => {
    c._angle = step / 2 + i * step;
    c._geo = geo(c._angle);
  });

  const petals = g.append("g").attr("class", "petals").selectAll("g.petal").data(cats, (d) => d.id).join("g")
    .attr("class", (d) => "petal" + (d.isOther ? " other" : ""))
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `${d.name}: median ${fmtUSD(d.median)}, n = ${fmtInt(d.n)}`)
    .on("click", (e, d) => onPick(d))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d); } });

  petals.each(function (cat) {
    const sel = d3.select(this);
    const o = cat._geo;
    const half = (s, dens) => Math.min(maxHalf * (dens / cat.peak), halfAngle(s));
    const thresh = cat.peak * 0.01;
    const kde = cat.kde;
    const first = kde.findIndex((d) => d[1] > thresh);
    const last = kde.length - 1 - [...kde].reverse().findIndex((d) => d[1] > thresh);
    const span = kde.slice(Math.max(0, first - 1), last + 2);
    cat._half = (s) => {
      const j = Math.min(kde.length - 1, Math.max(0, Math.round(s / 2000)));
      return half(s, kde[j][1]);
    };

    const left = span.map(([s, d]) => pt(o, s, -half(s, d)));
    const right = span.map(([s, d]) => pt(o, s, half(s, d))).reverse();
    const path = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))([...left, ...right]);

    const [x1, y1] = pt(o, 0, 0);
    const [x2, y2] = pt(o, data.salaryMax * 0.75, 0);
    const grad = defs.append("linearGradient").attr("id", `grad-${cat.id}`).attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2);
    grad.append("stop").attr("offset", 0).attr("stop-color", cat.color).attr("stop-opacity", 0.75);
    grad.append("stop").attr("offset", 1).attr("stop-color", cat.color).attr("stop-opacity", 0.25);

    const [sx1, sy1] = pt(o, data.salaryMax, 0);
    sel.append("line").attr("class", "spoke").attr("x1", x1).attr("y1", y1).attr("x2", sx1).attr("y2", sy1);
    sel.append("path").attr("class", "petal-shape").attr("d", path)
      .attr("fill", `url(#grad-${cat.id})`).attr("stroke", cat.color);
    tooltip(sel.select(".petal-shape"), () => petalTip(cat));

    // Individual salaries — deterministic jitter inside the petal
    const rand = d3.randomLcg(cat.id.length * 9973 + cat.n);
    const dots = cat.rows.map((r) => {
      const s = Math.min(r.salary, data.salaryMax);
      const over = r.salary > data.salaryMax;
      const [x, y] = over
        ? pt(o, data.salaryMax, (rand() * 2 - 1) * 5).map((v, k) => v + (k ? o.uy : o.ux) * 7)
        : pt(o, s, (rand() * 2 - 1) * cat._half(s) * 0.85);
      return { ...r, x, y, over };
    });
    // One delegated listener per petal keeps 23K dots responsive
    let hovered = null;
    sel.append("g").attr("class", "dots")
      .on("pointermove", (e) => {
        const d = e.target.__data__;
        if (e.target.tagName !== "circle" || !d) return;
        if (d !== hovered) { hovered = d; showTip(e, dotTip(cat, d)); } else moveTip(e);
      })
      .on("pointerout", () => { hovered = null; })
      .on("pointerleave", hideTip)
      .selectAll("circle").data(dots).join("circle")
      .attr("class", (d) => (d.over ? "dot over" : "dot"))
      .attr("cx", (d) => d.x).attr("cy", (d) => d.y)
      .attr("r", cat.n < SMALL_N ? 1.9 : 1.1)
      .attr("fill", cat.color)
      .attr("stroke", (d) => (d.over ? cat.color : null));

    const [qx1, qy1] = pt(o, cat.q1, 0);
    const [qx3, qy3] = pt(o, cat.q3, 0);
    sel.append("line").attr("class", "iqr").attr("x1", qx1).attr("y1", qy1).attr("x2", qx3).attr("y2", qy3);
    const [mx, my] = pt(o, cat.median, 0);
    tooltip(sel.append("circle").attr("class", "median").attr("cx", mx).attr("cy", my).attr("r", 4.5), () => petalTip(cat));
  });

  if (!compact) drawLabels(cats, { cx, cy, R, H, petals, offset: medium ? 34 : 44 });

  // ---- Center circle ----------------------------------------------------
  const center = g.append("g").attr("class", "lnd-center").attr("transform", `translate(${cx},${cy})`);
  center.append("circle").attr("r", r0 - 3);
  center.append("text").attr("class", "c1").attr("y", -10);
  center.append("text").attr("class", "c2").attr("y", 8);
  center.append("text").attr("class", "c3").attr("y", 22);

  update();
}

// Two label columns with leader lines; positions relaxed to avoid overlap.
function drawLabels(cats, { cx, cy, R, H, petals, offset }) {
  const gap = 37;
  const colR = cx + R + offset, colL = cx - R - offset;
  const items = cats.map((c) => {
    const s = Math.sin(c._angle);
    return { c, side: s > 1e-6 ? "R" : s < -1e-6 ? "L" : null, y0: cy - (R + 14) * Math.cos(c._angle) };
  });
  // A petal pointing straight up/down goes to the less crowded column
  items.filter((d) => !d.side).forEach((d) => {
    d.side = items.filter((x) => x.side === "R").length <= items.filter((x) => x.side === "L").length ? "R" : "L";
  });
  ["R", "L"].forEach((side) => {
    const col = items.filter((d) => d.side === side).sort((a, b) => a.y0 - b.y0);
    const top = 16, bottom = H - 22;
    // Push down to keep a minimum gap, then pull back up from the bottom edge
    col.forEach((d, i) => { d.y = Math.max(d.y0, i ? col[i - 1].y + gap : top); });
    for (let i = col.length - 1; i >= 0; i--) {
      const lim = i === col.length - 1 ? bottom : col[i + 1].y - gap;
      if (col[i].y > lim) col[i].y = lim;
    }
  });

  petals.each(function (cat) {
    const it = items.find((x) => x.c === cat);
    const sel = d3.select(this);
    const o = cat._geo;
    const right = it.side === "R";
    const lx = right ? colR : colL;
    const tip = [cx + (R + 3) * o.ux, cy + (R + 3) * o.uy];
    const elbow = [cx + (R + 16) * o.ux, cy + (R + 16) * o.uy];
    sel.append("path").attr("class", "leader")
      .attr("d", `M${tip}L${elbow}L${lx + (right ? -6 : 6)},${it.y - 4}`)
      .attr("stroke", cat.color);
    const t = sel.append("text").attr("class", "petal-label").attr("text-anchor", right ? "start" : "end")
      .attr("transform", `translate(${lx},${it.y})`);
    t.append("tspan").attr("class", "pl-name").attr("x", 0).attr("dy", -2).attr("fill", cat.color).text(cat.short);
    t.append("tspan").attr("class", "pl-line").attr("x", 0).attr("dy", 15)
      .html(`<tspan class="pl-value">${fmtK(cat.median)}</tspan> · n = ${fmtInt(cat.n)}${cat.n < MIN_N ? " ⚠" : ""}`);
  });
}

function blsLine(cat) {
  if (!cat.bls.length) return "No BLS outlook data available for this category, so it cannot join the comparison.";
  return "BLS outlook: " + cat.bls.map((b) => `${b.occupation} (${b.code})`).join(", ") + ". Click to compare.";
}

function petalTip(cat) {
  const withRecords = cat.titles.filter((t) => t.n > 0);
  const top = withRecords.slice(0, 5).map((t) => `${t.title} (${fmtInt(t.n)})`).join("<br>");
  return `
    <div class="tt-title" style="--c:${cat.color}">${cat.name}</div>
    <div class="tt-sub">Career category · salary distribution</div>
    ${row("Median", fmtUSD(cat.median))}
    ${row("Middle 50% (IQR)", `${fmtK(cat.q1)} – ${fmtK(cat.q3)}`)}
    ${row("10th – 90th pct", `${fmtK(cat.p10)} – ${fmtK(cat.p90)}`)}
    ${row("Sample size", "n = " + fmtInt(cat.n))}
    ${row("Job titles (with 2024 U.S. records)", `${cat.titles.length} (${withRecords.length})`)}
    ${cat.overflow ? row("Above $400K", fmtInt(cat.overflow) + " records") : ""}
    ${cat.n < MIN_N ? `<div class="tt-note warn">⚠ Fewer than ${MIN_N} records: limited data.</div>` : cat.n < SMALL_N ? `<div class="tt-note warn">⚠ Small sample — interpret with caution.</div>` : ""}
    <div class="tt-note"><b>Largest titles:</b><br>${top}${withRecords.length > 5 ? `<br>+ ${withRecords.length - 5} more` : ""}</div>
    <div class="tt-note">${blsLine(cat)}</div>
    <div class="tt-src">${SOURCES.salary}</div>`;
}

function dotTip(cat, d) {
  return `
    <div class="tt-title" style="--c:${cat.color}">${d.title}</div>
    <div class="tt-sub">Individual salary record · ${cat.name}</div>
    ${row("Salary (USD)", fmtUSD(d.salary))}
    ${row("Experience level", LEVEL_LABEL[d.level] || d.level)}
    ${row("Employment type", EMP_TYPE[d.employmentType] || d.employmentType)}
    ${row("Company size", CO_SIZE[d.companySize] || d.companySize)}
    ${row("Remote ratio", d.remote + "%")}
    ${d.over ? `<div class="tt-note">Above ${fmtK(data.salaryMax)} — pinned to the outer ring.</div>` : ""}
    <div class="tt-src">${SOURCES.salary}</div>`;
}

export function update() {
  if (!svg) return;
  const any = hasSelection();
  const groups = salaryGroups();

  svg.selectAll("g.petal")
    .classed("dimmed", (d) => any && !slotsOfCat(d.id).length)
    .classed("selected", (d) => slotsOfCat(d.id).length > 0)
    .attr("aria-pressed", (d) => slotsOfCat(d.id).length > 0)
    .each(function (cat) {
      // Selected categories take their slot color everywhere in the petal
      const c = catColor(cat);
      const p = d3.select(this);
      d3.selectAll(`#grad-${cat.id} stop`).attr("stop-color", c);
      p.select(".petal-shape").attr("stroke", c);
      p.select(".leader").attr("stroke", c);
      p.selectAll(".dot").attr("fill", c).attr("stroke", (d) => (d.over ? c : null));
      const b = badgesOfCat(cat.id);
      p.select(".pl-name").attr("fill", c).text((b ? b + " " : "") + cat.short);
    });
  svg.selectAll("g.petal.selected .petal-shape").attr("filter", "url(#petal-glow)");
  svg.selectAll("g.petal:not(.selected) .petal-shape").attr("filter", null);
  svg.selectAll("g.petal.selected").raise();

  const c = svg.select(".lnd-center");
  c.selectAll("text").attr("fill", null).attr("class", (d, i) => "c" + (i + 1));
  if (groups.length === 2) {
    c.select(".c1").text("Median");
    groups.forEach((gp, i) => c.select(".c" + (i + 2)).text(`${gp.slots[0].badge} ${fmtK(gp.cat.median)}`).attr("fill", gp.slots[0].color).attr("class", `c${i + 2} mid`));
  } else if (groups.length === 1) {
    const gp = groups[0];
    c.select(".c1").text(gp.cat.short).attr("fill", gp.slots[0].color);
    c.select(".c2").text(fmtK(gp.cat.median)).attr("class", "c2 big");
    c.select(".c3").text(`n = ${fmtInt(gp.cat.n)}`);
  } else if (any) {
    c.select(".c1").text("No salary");
    c.select(".c2").text("category");
    c.select(".c3").text("see below");
  } else {
    c.select(".c1").text("Median");
    c.select(".c2").text("salary");
    c.select(".c3").text("(USD)");
  }
  renderStrip(groups);
}

// Readout under the radial chart: one card per distinct salary category,
// plus a card for each selected occupation without a salary category.
function renderStrip(groups) {
  const sel = selection();
  if (!sel.length) {
    stripEl.innerHTML = `<p class="strip-hint">All ${data.categories.length} career categories shown. Pick occupations in the Constellation above to compare their career categories here.</p>`;
    return;
  }
  const cards = groups.map(({ cat, slots, occs }) => {
    const badges = slots.map((s) => `<span class="slot-badge-html" style="--c:${s.color}">${s.badge}</span>`).join("");
    const shared = slots.length > 1
      ? `<div class="strip-msg">${occs.map((o) => o.short).join(" and ")} both belong to this category, so they share the same category-level salary statistics. The grouped salary data cannot tell them apart.</div>` : "";
    const top = cat.titles.filter((t) => t.n > 0).slice(0, 3).map((t) => t.title).join(", ");
    return `<div class="strip-card" style="--c:${slots[0].color}">
      <div class="strip-head">${badges}${occs.map((o) => o.short).join(" + ")} → <b>${cat.name}</b></div>
      <div class="strip-stats"><span><b>${fmtUSD(cat.median)}</b> median</span><span>IQR ${fmtK(cat.q1)}–${fmtK(cat.q3)}</span><span>n = ${fmtInt(cat.n)}</span></div>
      <div class="strip-titles">Largest titles: ${top}${cat.titles.length > 3 ? ` + ${cat.titles.length - 3} more` : ""}</div>
      ${shared}
    </div>`;
  });
  sel.filter((x) => !x.cat).forEach(({ slot, occ }) => {
    cards.push(`<div class="strip-card unmatched" style="--c:${slot.color}">
      <div class="strip-head"><span class="slot-badge-html">${slot.badge}</span>${occ.short}</div>
      <div class="strip-msg">No corresponding salary category. No salary distribution is shown for this occupation.</div>
    </div>`);
  });
  stripEl.innerHTML = cards.join("");
}

// ---------------------------------------------------------------------------
// Comparison panel: the two selected BLS occupations side by side.
// Each metric gets a small bar scaled across ALL occupations in the file, so
// values are read in context, not only against each other.
// ---------------------------------------------------------------------------
import { state, removeSlot, selection, salaryGroups } from "./state.js";
import { fmtUSD, fmtK, fmtInt, fmtPct } from "./utils.js";
import { SLOTS, SOURCES, SCOPE_TEXT } from "./config.js";

let data, el, metrics;

export function initCompare(_data, container) {
  data = _data;
  el = container;
  const ext = (f) => d3.extent(data.bls, f);
  metrics = [
    { key: "wage", label: "Median wage (2025)", fmt: fmtUSD, dom: [0, ext((d) => d.wage)[1]] },
    { key: "growth", label: "Projected growth (2025–2035)", fmt: fmtPct, dom: [Math.min(0, ext((d) => d.growth)[0]), ext((d) => d.growth)[1]] },
    { key: "employment2025", label: "Employment (2025)", fmt: fmtInt, dom: [0, ext((d) => d.employment2025)[1]] },
    { key: "openings", label: "Annual openings (2025–2035)", fmt: (v) => "~" + fmtInt(v), dom: [0, ext((d) => d.openings)[1]] },
  ];
  update();
}

// Bar from the zero point; negative growth extends left of it.
function bar(v, dom, color) {
  const s = d3.scaleLinear().domain(dom).range([0, 100]);
  const z = s(0), p = s(v);
  const left = Math.min(z, p), w = Math.abs(p - z);
  return `<div class="mbar"><div class="mbar-zero" style="left:${z}%"></div><div class="mbar-fill" style="left:${left}%;width:${Math.max(w, 0.8)}%;background:${color}"></div></div>`;
}

export function update() {
  const sel = state.slots.map((code, i) => (code ? { slot: SLOTS[i], occ: data.blsByCode.get(code) } : { slot: SLOTS[i], occ: null }));
  const filled = selection();

  if (!filled.length) {
    el.innerHTML = `
      <div class="panel-kicker">Compare occupations</div>
      <div class="panel-title muted">Start with the outlook</div>
      <p class="panel-msg">Click up to <b>two bubbles</b> to compare their official BLS wage and employment outlook. The salary views below follow the <b>career category</b> of each pick.</p>
      <div class="slot-empty-row">
        ${SLOTS.map((s) => `<div class="slot-card empty" style="--c:${s.color}"><span class="slot-badge-html">${s.badge}</span>Empty</div>`).join("")}
      </div>
      <p class="panel-foot">${data.bls.filter((b) => b.catId).length} of ${data.bls.length} occupations have a corresponding salary category.</p>`;
    return;
  }

  const head = sel.map(({ slot, occ }) => occ
    ? `<div class="slot-card" style="--c:${slot.color}">
         <button class="slot-x" type="button" data-slot="${slot.index}" aria-label="Remove ${occ.occupation}">✕</button>
         <span class="slot-badge-html">${slot.badge}</span>
         <div class="slot-name">${occ.occupation}</div>
         <div class="slot-code">SOC ${occ.code}</div>
       </div>`
    : `<div class="slot-card empty" style="--c:${slot.color}"><span class="slot-badge-html">${slot.badge}</span>Click another bubble to compare</div>`).join("");

  const rows = metrics.map((m) => {
    const vals = sel.map(({ occ }) => (occ ? occ[m.key] : null));
    const both = vals.every((v) => v != null);
    const best = both ? Math.max(...vals) : null;
    return `<div class="cmp-row">
      <div class="cmp-label">${m.label}</div>
      ${sel.map(({ slot, occ }, i) => occ
        ? `<div class="cmp-cell${both && vals[i] === best && vals[0] !== vals[1] ? " lead" : ""}"><b>${m.fmt(vals[i])}</b>${bar(vals[i], m.dom, slot.color)}</div>`
        : `<div class="cmp-cell na">—</div>`).join("")}
    </div>`;
  }).join("");

  const scopeShort = { direct_for_exact_title_only: "direct for exact title only", broader_context_only: "broader context only" };
  const salary = sel.map(({ occ }) => {
    if (!occ) return `<div class="cmp-cell na">—</div>`;
    if (!occ.catId) return `<div class="cmp-cell"><span class="warn">No corresponding salary category</span></div>`;
    const c = data.catById.get(occ.catId);
    return `<div class="cmp-cell"><b>${c.name}</b><span class="cmp-small">${fmtUSD(c.median)} median · n = ${fmtInt(c.n)}</span><span class="cmp-scope">${scopeShort[occ.scope] || occ.scope}</span></div>`;
  }).join("");

  let summary = "";
  if (filled.length === 2) {
    const [a, b] = filled.map((f) => f.occ);
    const g = a.growth - b.growth;
    const w = a.wage - b.wage;
    const name = (o, i) => `<b style="color:${SLOTS[i].color}">${o.short}</b>`;
    summary = `<p class="cmp-summary">
      ${g === 0 ? "Both are projected to grow at the same rate." : `${name(g > 0 ? a : b, g > 0 ? 0 : 1)} is projected to grow <b>${d3.format(".1f")(Math.abs(g))} percentage points</b> faster.`}
      ${w === 0 ? "Median wages are equal." : `${name(w > 0 ? a : b, w > 0 ? 0 : 1)} has a <b>${fmtUSD(Math.abs(w))}</b> higher 2025 median wage.`}
    </p>`;
  }

  const unmatched = filled.filter((f) => !f.occ.catId);
  const shared = salaryGroups().filter((gp) => gp.slots.length > 1);
  const note = (unmatched.length
    ? `<div class="alert small">${unmatched.map((f) => `${f.slot.badge} ${f.occ.occupation}: salary comparison unavailable — no corresponding salary category. ${SCOPE_TEXT[f.occ.scope] || ""}`).join("<br>")}</div>`
    : "") + shared.map((gp) => `<div class="alert small">${gp.slots.map((s) => s.badge).join("")} Both occupations belong to <b>${gp.cat.name}</b>, so the salary charts show one shared set of category-level statistics. The grouped salary data cannot separate them.</div>`).join("");

  el.innerHTML = `
    <div class="panel-kicker">Comparing ${filled.length === 2 ? "two occupations" : "one occupation"}</div>
    <div class="cmp-grid">
      <div class="cmp-head">${head}</div>
      <div class="src-tag bls">BLS · official statistics</div>
      ${rows}
      <div class="src-tag salary">Self-reported salaries · U.S. · 2024</div>
      <div class="cmp-row"><div class="cmp-label">Salary category</div>${salary}</div>
    </div>
    ${summary}
    ${note}
    <p class="panel-foot">Bars are scaled across all ${data.bls.length} occupations. Category membership is a broad relationship, not proof that every job title shares an occupation's outlook. ${SOURCES.blsWage}; ${SOURCES.blsProj}.</p>`;

  el.querySelectorAll(".slot-x").forEach((btn) => btn.addEventListener("click", () => removeSlot(+btn.dataset.slot)));
}

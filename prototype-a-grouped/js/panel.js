// ---------------------------------------------------------------------------
// Side column of the Salary Landscape: search, category list, info panel.
//   • Search accepts any category name or any of the original job titles;
//     a title selects its category and is highlighted in the title list.
//   • The category list is a scrollable legend (and the only label set on
//     narrow screens, where petal labels are hidden).
// ---------------------------------------------------------------------------
import { state, selectCategory } from "./state.js";
import { fmtUSD, fmtK, fmtInt, fmtPct } from "./utils.js";
import { SOURCES, SCOPE_TEXT, MIN_N, SMALL_N, OTHER } from "./config.js";

let data, el, listEl;

export function initPanel(_data, container, list, search) {
  data = _data;
  el = container;
  listEl = list;
  initSearch(search);
  update();
}

function initSearch(form) {
  const input = form.querySelector("input");
  const options = [
    ...data.categories.map((c) => `<option value="${c.name}">Category · ${fmtInt(c.n)} records</option>`),
    ...data.titleMap.slice().sort((a, b) => d3.ascending(a.title, b.title))
      .map((t) => `<option value="${t.title.replace(/"/g, "&quot;")}">${t.category}</option>`),
  ];
  form.querySelector("datalist").innerHTML = options.join("");
  const msg = form.querySelector(".search-msg");
  const go = () => {
    const v = input.value.trim();
    if (!v) return;
    const lower = v.toLowerCase();
    const cat = data.categories.find((c) => c.name.toLowerCase() === lower);
    const t = data.titleMap.find((m) => m.title.toLowerCase() === lower);
    if (cat) { msg.textContent = ""; selectCategory(cat.id); }
    else if (t) { msg.textContent = ""; selectCategory(data.categories.find((c) => c.name === t.category).id, t.title); }
    else msg.textContent = "No category or job title matches. Pick one from the suggestions.";
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); go(); });
  input.addEventListener("change", go);
}

const stat = (k, v, cls = "") => `<div class="stat ${cls}"><span>${k}</span><b>${v}</b></div>`;

function blsBlock(occ) {
  return `
    <div class="bls-name">${occ.occupation} <span class="code">(${occ.code})</span></div>
    ${stat("Median annual wage (2025)", fmtUSD(occ.wage))}
    ${stat("Projected growth (2025–2035)", fmtPct(occ.growth))}
    ${stat("Annual openings (2025–2035)", "~" + fmtInt(occ.openings))}
    ${stat("Employment (2025)", fmtInt(occ.employment2025))}
    <p class="scope-note">${SCOPE_TEXT[occ.scope] || ""}</p>`;
}

function titleList(cat) {
  const withRecords = cat.titles.filter((t) => t.n > 0).length;
  const items = cat.titles.map((t) => `<li class="${t.n ? "" : "zero"}${t.title === state.title ? " hit" : ""}">
      <span>${t.title}${t.method === "unclassified" ? ' <i class="tag">unclassified</i>' : ""}</span><b>${fmtInt(t.n)}</b></li>`).join("");
  return `<div class="panel-sub">Job titles in this category: <b>${cat.titles.length}</b> (${withRecords} with U.S. 2024 records)</div>
    <ul class="title-list" tabindex="0" aria-label="Job titles in ${cat.name}">${items}</ul>`;
}

export function update() {
  renderList();
  const cat = state.catId ? data.catById.get(state.catId) : null;
  const occs = state.occCodes.map((c) => data.blsByCode.get(c));

  if (!cat && !occs.length) {
    el.innerHTML = `
      <div class="panel-kicker">Selection</div>
      <div class="panel-title muted">Pick a career category</div>
      <p class="panel-msg">Click a <b>petal</b>, a <b>lane label</b>, a <b>bubble</b>, or search above. All three views stay in sync.</p>
      <p class="panel-msg">Analysed: <b>${fmtInt(data.totalN)}</b> U.S. salary records from 2024 across <b>${data.categories.length}</b> career categories, covering all <b>${data.totalTitles}</b> original job titles, plus <b>${data.bls.length}</b> BLS occupations.</p>
      <div class="sources">
        <div class="src-tag salary">Salary data</div><span>${SOURCES.salary}</span>
        <div class="src-tag bls">BLS wages</div><span>${SOURCES.blsWage}</span>
        <div class="src-tag bls">BLS projections</div><span>${SOURCES.blsProj}</span>
      </div>`;
    scrollTitle();
    return;
  }

  if (!cat) {
    const occ = occs[0];
    el.innerHTML = `
      <div class="panel-kicker">Selected BLS occupation</div>
      <div class="panel-title" style="color:${occ.color}">${occ.occupation}</div>
      <div class="alert">Salary comparison unavailable: no salary career category corresponds to this occupation.</div>
      <div class="src-tag bls">BLS · official aggregate statistics</div>
      ${blsBlock(occ)}`;
    return;
  }

  const sizeNote = cat.n < MIN_N
    ? `<div class="alert small">⚠ Only ${cat.n} records: limited data. Treat the distribution as indicative only.</div>`
    : cat.n < SMALL_N ? `<div class="alert small">⚠ Small sample (n = ${cat.n}). Interpret with caution.</div>` : "";
  const otherNote = cat.name === OTHER
    ? `<p class="panel-msg">“Other” groups ambiguous or unrelated titles (e.g., Engineer, Manager, Analyst). It is kept so no records are dropped.</p>` : "";
  const searched = state.title
    ? `<p class="panel-msg">Search: <b>${state.title}</b> is classified as <b>${cat.name}</b> (${fmtInt(cat.titles.find((t) => t.title === state.title)?.n || 0)} U.S. 2024 records).</p>` : "";

  el.innerHTML = `
    <div class="panel-kicker">${state.origin === "occ" ? "Selected via BLS bubble" : "Selected career category"}</div>
    <div class="panel-title" style="color:${cat.color}">${cat.name}</div>
    ${searched}
    <div class="src-tag salary">Self-reported salaries · U.S. · 2024</div>
    <div class="hero"><b>${fmtUSD(cat.median)}</b><span>median salary</span></div>
    ${stat("Sample size", "n = " + fmtInt(cat.n))}
    ${stat("Middle 50% (IQR)", `${fmtK(cat.q1)} – ${fmtK(cat.q3)}`)}
    ${stat("10th – 90th percentile", `${fmtK(cat.p10)} – ${fmtK(cat.p90)}`)}
    ${sizeNote}${otherNote}
    <div class="divider"></div>
    <div class="src-tag bls">BLS employment outlook</div>
    ${cat.bls.length
      ? cat.bls.map(blsBlock).join("") + `<p class="panel-foot">BLS figures describe a whole occupation in 2025; they are not directly comparable to the self-reported 2024 salaries above. Category membership is a broad relationship, not proof that every title shares this outlook.</p>`
      : `<div class="alert">Outlook data unavailable.<br><span>No BLS occupation in this dataset corresponds to ${cat.name}. No projection is shown or borrowed from another occupation.</span></div>`}
    <div class="divider"></div>
    ${titleList(cat)}`;
  scrollTitle();
}

function scrollTitle() {
  const hit = el.querySelector(".title-list .hit");
  if (hit) hit.scrollIntoView({ block: "nearest" });
}

// Scrollable category legend (clickable)
function renderList() {
  listEl.innerHTML = data.categories.map((c) => `
    <li><button type="button" data-id="${c.id}" class="${c.id === state.catId ? "on" : ""}${state.origin && c.id !== state.catId ? " dim" : ""}" aria-pressed="${c.id === state.catId}">
      <span class="k-dot" style="background:${c.color}"></span><span class="cl-name" title="${c.name}">${c.short}</span>
      <span class="cl-med">${fmtK(c.median)}</span><span class="cl-n">${fmtInt(c.n)}</span>${c.bls.length ? '<span class="cl-bls" title="Has BLS outlook data">◆</span>' : '<span class="cl-bls"></span>'}
    </button></li>`).join("");
  listEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => selectCategory(b.dataset.id)));
}

// Entry point: load data, build the views, wire the shared comparison state.
import { loadData } from "./data.js";
import { initState, onChange, reset, removeSlot, cancelPending, state, hasSelection } from "./state.js";
import * as constellation from "./constellation.js";
import * as compare from "./compare.js";
import * as landscape from "./landscape.js";
import * as progression from "./progression.js";
import { hideTip, fmtInt, fmtK } from "./utils.js";
import { SLOTS, SCOPE_TEXT } from "./config.js";

const $ = (id) => document.getElementById(id);

loadData()
  .then((data) => {
    initState(data);
    constellation.initConstellation(data, $("constellation-chart"), $("constellation-legend"));
    compare.initCompare(data, $("compare-panel"));
    landscape.initLandscape(data, $("landscape-chart"), $("landscape-strip"));
    progression.initProgression(data, $("progression-chart"), $("progression-panel"));
    renderMappingTable(data);
    renderCategoryKey(data);
    // Wide layout: the landscape column is tall, so show its key and guide
    if (window.matchMedia("(min-width: 1760px)").matches) document.querySelectorAll(".card-land details").forEach((d) => { d.open = true; });

    onChange(() => {
      hideTip();
      constellation.update();
      compare.update();
      landscape.update();
      progression.update();
      renderTray(data);
    });
    renderTray(data);

    $("reset").addEventListener("click", reset);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cancelPending(); });

    let lastW = window.innerWidth;
    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        hideTip();
        constellation.render();
        landscape.render();
        progression.render();
      }, 150);
    });
    document.body.classList.remove("loading");
  })
  .catch((err) => {
    console.error(err);
    $("load-error").hidden = false;
    $("load-error").textContent =
      "Could not load the CSV files. Serve this folder with a local web server (see README) rather than opening index.html directly.";
  });

// Header tray: what is being compared, with remove buttons.
function renderTray(data) {
  $("reset").disabled = !hasSelection();
  $("tray").innerHTML = SLOTS.map((s) => {
    const code = state.slots[s.index];
    if (!code) return `<span class="chip empty" style="--c:${s.color}"><span class="chip-badge">${s.badge}</span>empty</span>`;
    const o = data.blsByCode.get(code);
    return `<span class="chip" style="--c:${s.color}"><span class="chip-badge">${s.badge}</span>${o.short}
      <button type="button" class="chip-x" data-slot="${s.index}" aria-label="Remove ${o.occupation}">✕</button></span>`;
  }).join('<span class="vs">vs</span>');
  document.querySelectorAll(".chip-x").forEach((b) => b.addEventListener("click", () => removeSlot(+b.dataset.slot)));
}

function renderMappingTable(data) {
  const rows = data.categories.map((c) => `<tr>
      <td><span class="k-dot" style="background:${c.color}"></span>${c.name}</td>
      <td>${c.titles.length}</td><td>${fmtInt(c.n)}</td>
      <td>${c.bls.length ? c.bls.map((b) => `${b.occupation} (${b.code})`).join("<br>") : '<span class="na">No BLS occupation</span>'}</td>
      <td>${c.bls.map((b) => SCOPE_TEXT[b.scope] || b.scope).join("<br>")}</td></tr>`);
  data.bls.filter((b) => !b.catId).forEach((b) => rows.push(`<tr>
      <td><span class="k-dot" style="background:${b.color}"></span>${b.categoryName} <i>(BLS only)</i></td><td>—</td><td>—</td>
      <td>${b.occupation} (${b.code})</td><td>${SCOPE_TEXT[b.scope] || b.scope}</td></tr>`));
  $("mapping-table").innerHTML = `<thead><tr><th>Career category</th><th>Job titles</th><th>U.S. 2024 records</th><th>BLS occupation</th><th>Comparison scope</th></tr></thead><tbody>${rows.join("")}</tbody>`;
}

// Compact key of all categories (identity for petals when labels are hidden on phones)
function renderCategoryKey(data) {
  $("category-key").innerHTML = data.categories.map((c) => `<li><span class="k-dot" style="background:${c.color}"></span>${c.name}<b>${fmtK(c.median)}</b><span>n=${fmtInt(c.n)}</span></li>`).join("");
}

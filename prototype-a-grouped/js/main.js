// Entry point: load data, build the three views, wire shared state.
import { loadData } from "./data.js";
import { initState, onChange, reset, state } from "./state.js";
import * as landscape from "./landscape.js";
import * as progression from "./progression.js";
import * as constellation from "./constellation.js";
import * as panel from "./panel.js";
import { hideTip, fmtInt } from "./utils.js";
import { SCOPE_TEXT } from "./config.js";

const $ = (id) => document.getElementById(id);

loadData()
  .then((data) => {
    initState(data);
    landscape.initLandscape(data, $("landscape-chart"));
    panel.initPanel(data, $("info-panel"), $("category-list"), $("search"));
    progression.initProgression(data, $("progression-chart"), $("progression-panel"));
    constellation.initConstellation(data, $("constellation-chart"), $("constellation-panel"));
    renderMappingTable(data);

    onChange(() => {
      landscape.update();
      progression.update();
      constellation.update();
      panel.update();
      updateStatus(data);
    });
    updateStatus(data);

    $("reset").addEventListener("click", () => { $("search").reset(); reset(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.activeElement?.tagName !== "INPUT") reset(); });

    let lastW = window.innerWidth;
    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        hideTip();
        landscape.render();
        progression.render();
        constellation.render();
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

function updateStatus(data) {
  const el = $("status");
  const cat = state.catId ? data.catById.get(state.catId) : null;
  const occs = state.occCodes.map((c) => data.blsByCode.get(c));
  $("reset").disabled = !state.origin;
  if (!state.origin) {
    el.innerHTML = `Showing all ${data.categories.length} career categories · click any petal, lane, or bubble`;
    return;
  }
  const c = cat ? `<b style="color:${cat.color}">${cat.name}</b>` : `<span class="na">no salary category</span>`;
  const o = occs.length ? `<b>${occs.map((d) => d.occupation).join(", ")}</b>` : `<span class="na">no BLS outlook data</span>`;
  el.innerHTML = `${c} <span class="link">↔</span> ${o}`;
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

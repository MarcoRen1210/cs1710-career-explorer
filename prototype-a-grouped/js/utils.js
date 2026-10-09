// Formatting helpers and a single shared tooltip.

export const fmtUSD = (v) => (v == null ? "—" : "$" + d3.format(",.0f")(v));
export const fmtK = (v) => (v == null ? "—" : "$" + d3.format(",.0f")(v / 1000) + "K");
export const fmtKs = (v) => (v == null ? "—" : "$" + d3.format(".1f")(v / 1000) + "K");
export const fmtInt = (v) => (v == null ? "—" : d3.format(",")(v));
export const fmtPct = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + d3.format(".1f")(v) + "%");

const tip = d3.select("body").append("div").attr("class", "tooltip").attr("role", "tooltip");

export function showTip(event, html) {
  tip.html(html).classed("visible", true);
  moveTip(event);
}

export function moveTip(event) {
  const node = tip.node();
  const pad = 14;
  const { innerWidth: W, innerHeight: H } = window;
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + w > W - 8) x = event.clientX - w - pad;
  if (y + h > H - 8) y = event.clientY - h - pad;
  tip.style("left", Math.max(8, x) + "px").style("top", Math.max(8, y) + "px");
}

export function hideTip() {
  tip.classed("visible", false);
}

// Attach tooltip behavior to a d3 selection; `html(d, event)` builds content.
export function tooltip(selection, html) {
  selection
    .on("pointerenter.tip", (e, d) => showTip(e, html(d, e)))
    .on("pointermove.tip", moveTip)
    .on("pointerleave.tip", hideTip);
}

// Small labelled row for tooltips
export const row = (k, v) => `<div class="tt-row"><span>${k}</span><b>${v}</b></div>`;

// Width of the element that a chart renders into
export const widthOf = (el) => Math.max(280, el.getBoundingClientRect().width);

// Short-lived message at the bottom of the screen (Prototype B)
const toast = d3.select("body").append("div").attr("class", "toast").attr("role", "status").attr("aria-live", "polite");
let toastTimer;
export function notice(html) {
  toast.html(html).classed("visible", true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classed("visible", false), 4200);
}

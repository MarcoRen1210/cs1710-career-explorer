// ---------------------------------------------------------------------------
// Shared comparison state for Prototype B (grouped).
//
//   slots   – [occCode | null, occCode | null]; slot index fixes the color
//   pending – occCode waiting for the user to choose which slot to replace
//
// Salary views are driven by the career categories of the selected BLS
// occupations. Two occupations in the same category share one set of
// category-level salary statistics (see `salaryGroups`).
// ---------------------------------------------------------------------------
import { SLOTS } from "./config.js";
import { notice } from "./utils.js";

const listeners = [];
let ctx = null; // { catById, blsByCode }

export const state = { slots: [null, null], pending: null };

export function initState(data) {
  ctx = data;
}

export function onChange(fn) {
  listeners.push(fn);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

// Click on an occupation: remove if selected, fill an empty slot, or ask
// which slot to replace when both are full.
export function toggleOcc(code) {
  const i = state.slots.indexOf(code);
  state.pending = null;
  if (i >= 0) {
    state.slots[i] = null;
  } else {
    const empty = state.slots.indexOf(null);
    if (empty >= 0) state.slots[empty] = code;
    else state.pending = code;
  }
  emit();
}

export function replaceSlot(index, code = state.pending) {
  if (code) state.slots[index] = code;
  state.pending = null;
  emit();
}

export function cancelPending() {
  if (!state.pending) return;
  state.pending = null;
  emit();
}

export function removeSlot(index) {
  state.slots[index] = null;
  state.pending = null;
  emit();
}

// Clicking a salary category (petal or lane): toggles one of its BLS
// occupations; categories without one explain why they cannot be compared.
export function pickCategory(cat) {
  if (!cat.bls.length) {
    notice(`<b>${cat.name}</b> has no corresponding BLS occupation, so it can't join the outlook comparison. Its salary data stays visible in the charts.`);
    return;
  }
  const selected = cat.bls.find((b) => state.slots.includes(b.code));
  toggleOcc((selected || cat.bls[0]).code);
}

export function reset() {
  state.slots = [null, null];
  state.pending = null;
  emit();
}

// ---- Derived helpers ------------------------------------------------------
export const hasSelection = () => state.slots.some(Boolean);
export const slotOfOcc = (code) => state.slots.indexOf(code);

// Slot indices whose occupation belongs to this salary category
export function slotsOfCat(catId) {
  return state.slots
    .map((code, i) => (code && ctx.blsByCode.get(code).catId === catId ? i : -1))
    .filter((i) => i >= 0);
}

// Filled slots as [{ slot, occ, cat|null }]
export function selection() {
  return state.slots
    .map((code, i) => {
      if (!code) return null;
      const occ = ctx.blsByCode.get(code);
      return { slot: SLOTS[i], occ, cat: occ.catId ? ctx.catById.get(occ.catId) : null };
    })
    .filter(Boolean);
}

// Distinct salary categories behind the selection, each with the slots that
// point to it: [{ cat, slots: [slot, …], occs: [occ, …] }]
export function salaryGroups() {
  const groups = [];
  selection().forEach(({ slot, occ, cat }) => {
    if (!cat) return;
    let gp = groups.find((x) => x.cat === cat);
    if (!gp) groups.push((gp = { cat, slots: [], occs: [] }));
    gp.slots.push(slot);
    gp.occs.push(occ);
  });
  return groups;
}

// Color for a category: its first slot's color when selected, else its own
export function catColor(cat) {
  const s = slotsOfCat(cat.id);
  return s.length ? SLOTS[s[0]].color : cat.color;
}

export const badgesOfCat = (catId) => slotsOfCat(catId).map((i) => SLOTS[i].badge).join("");

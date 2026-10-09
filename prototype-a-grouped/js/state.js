// ---------------------------------------------------------------------------
// Shared selection state. Every chart reads from `state` and re-styles itself
// when `onChange` fires; no chart talks to another chart directly.
//
//   catId    – selected career category (or null)
//   occCodes – highlighted BLS occupations (all of the category's, or the one clicked)
//   origin   – "cat" | "occ" | null: which kind of mark made the selection
//   title    – original job title found via search (or null)
// ---------------------------------------------------------------------------
const listeners = [];
let ctx = null; // { catById, blsByCode }

export const state = { catId: null, occCodes: [], origin: null, title: null };

export function initState(data) {
  ctx = data;
}

export function onChange(fn) {
  listeners.push(fn);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

// Select a career category; highlight the BLS occupations in that category, if any.
export function selectCategory(catId, title = null) {
  if (state.origin === "cat" && state.catId === catId && !title) return reset();
  const cat = ctx.catById.get(catId);
  state.catId = catId;
  state.occCodes = cat ? cat.bls.map((b) => b.code) : [];
  state.origin = "cat";
  state.title = title;
  emit();
}

// Select a BLS occupation; follow its career category only if the salary data has it.
export function selectOcc(code) {
  if (state.origin === "occ" && state.occCodes[0] === code) return reset();
  const occ = ctx.blsByCode.get(code);
  state.occCodes = [code];
  state.catId = occ?.catId || null;
  state.origin = "occ";
  state.title = null;
  emit();
}

export function reset() {
  state.catId = null;
  state.occCodes = [];
  state.origin = null;
  state.title = null;
  emit();
}

export const isDimmedCat = (id) => state.origin !== null && state.catId !== id;
export const isDimmedOcc = (code) => state.origin !== null && !state.occCodes.includes(code);

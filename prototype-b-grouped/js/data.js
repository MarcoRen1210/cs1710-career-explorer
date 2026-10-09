// ---------------------------------------------------------------------------
// Data loading and aggregation for the grouped dashboards.
// Every statistic is computed from individual salary records in each
// career_category (never by averaging job-title medians). Nothing is hardcoded.
// ---------------------------------------------------------------------------
import {
  FILES, SALARY_FILTER, LEVELS, MIN_N, CATEGORY_STYLE, DEFAULT_STYLE, OTHER,
  BLS_ONLY_STYLE, BLS_SHORT,
} from "./config.js";

// Strip a UTF-8 byte-order mark from column names, if present.
const cleanKeys = (row) => {
  const out = {};
  for (const k in row) out[k.replace(/^﻿/, "").trim()] = row[k];
  return out;
};

const num = (v) => (v === "" || v == null ? null : +v);
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function summarize(sortedValues) {
  const q = (p) => d3.quantileSorted(sortedValues, p);
  return {
    n: sortedValues.length,
    median: q(0.5),
    q1: q(0.25),
    q3: q(0.75),
    p10: q(0.1),
    p90: q(0.9),
    min: sortedValues[0],
    max: sortedValues[sortedValues.length - 1],
    mean: d3.mean(sortedValues),
  };
}

// Gaussian kernel density estimate on a fixed salary grid.
// Bandwidth: Silverman's rule with a robust spread estimate.
function kde(sortedValues, grid) {
  const n = sortedValues.length;
  const sd = d3.deviation(sortedValues) || 1;
  const iqr = d3.quantileSorted(sortedValues, 0.75) - d3.quantileSorted(sortedValues, 0.25);
  const spread = Math.min(sd, iqr / 1.34) || sd;
  const bw = 0.9 * spread * Math.pow(n, -0.2);
  const norm = 1 / (n * bw * Math.sqrt(2 * Math.PI));
  return grid.map((x) => {
    let s = 0;
    for (const v of sortedValues) {
      const z = (x - v) / bw;
      if (z > -6 && z < 6) s += Math.exp(-0.5 * z * z);
    }
    return [x, s * norm];
  });
}

export async function loadData() {
  const [salaryRaw, blsRaw, mapRaw] = await Promise.all([
    d3.csv(FILES.salaries, (r) => cleanKeys(r)),
    d3.csv(FILES.bls, (r) => cleanKeys(r)),
    d3.csv(FILES.titleMap, (r) => cleanKeys(r)),
  ]);

  // ---- Salary records (all job titles; only country/year filtered) ------
  const filtered = salaryRaw
    .filter((r) => r.employee_residence === SALARY_FILTER.country && +r.work_year === SALARY_FILTER.year)
    .map((r) => ({
      title: r.original_job_title || r.job_title,
      category: r.career_category,
      level: r.experience_level,
      salary: +r.salary_in_usd,
      employmentType: r.employment_type,
      remote: +r.remote_ratio,
      companySize: r.company_size,
    }));

  const SAL_MAX = 400000; // outer ring of the radial axis
  const grid = d3.range(0, SAL_MAX + 1, 2000);

  // Job-title → category mapping (all titles, including those without 2024 U.S. records)
  const titleMap = mapRaw.map((m) => ({
    title: m.original_job_title,
    category: m.career_category,
    display: m.display_job_title,
    method: m.categorization_method,
    nAllYears: +m.records_all_years,
  }));
  const usTitleCounts = d3.rollup(filtered, (v) => v.length, (r) => r.title);

  const catNames = Array.from(new Set([...titleMap.map((m) => m.category), ...filtered.map((r) => r.category)]));
  const blsByCat = d3.group(blsRaw, (r) => r.career_category);

  let categories = catNames.map((name) => {
    const style = CATEGORY_STYLE[name] || DEFAULT_STYLE;
    const rows = filtered.filter((r) => r.category === name);
    const values = rows.map((r) => r.salary).sort(d3.ascending);
    const stats = values.length ? summarize(values) : { n: 0, median: null };
    const density = values.length ? kde(values, grid) : grid.map((x) => [x, 0]);
    const levels = LEVELS.map((lv) => {
      const lvVals = rows.filter((r) => r.level === lv.code).map((r) => r.salary).sort(d3.ascending);
      const s = lvVals.length ? summarize(lvVals) : { n: 0, median: null };
      return { ...lv, ...s, status: s.n === 0 ? "none" : s.n < MIN_N ? "low" : "ok" };
    });
    const titles = titleMap.filter((m) => m.category === name)
      .map((m) => ({ ...m, n: usTitleCounts.get(m.title) || 0 }))
      .sort((a, b) => b.n - a.n || d3.ascending(a.title, b.title));
    return {
      id: slug(name),
      name,
      short: style.short || name,
      color: style.color,
      isOther: name === OTHER,
      rows,
      values,
      ...stats,
      overflow: values.filter((v) => v > SAL_MAX).length,
      kde: density,
      peak: d3.max(density, (d) => d[1]) || 1,
      levels,
      titles,
      blsCodes: (blsByCat.get(name) || []).map((r) => r.occ_code),
    };
  });

  // Fixed order shared by every chart: median salary (high → low), "Other" last.
  categories.sort((a, b) => (a.isOther - b.isOther) || (b.median - a.median));

  // ---- BLS occupations ----------------------------------------------------
  const catByName = new Map(categories.map((c) => [c.name, c]));
  const bls = blsRaw.map((r) => {
    const cat = catByName.get(r.career_category) || null;
    return {
      code: r.occ_code,
      occupation: r.original_bls_occupation || r.occupation,
      short: BLS_SHORT[r.occ_code] || r.occupation,
      family: r.job_family,
      categoryName: r.career_category,
      catId: cat ? cat.id : null,          // null → no salary category
      color: cat ? cat.color : BLS_ONLY_STYLE.color,
      scope: r.bls_comparison_scope,
      employment2025: num(r.employment_2025),
      employment2035: num(r.employment_2035),
      growth: num(r.growth_pct_2025_2035),
      openings: num(r.annual_openings_2025_2035),
      wage: num(r.oews_median_wage_2025),
      wageP10: num(r.wage_p10_2025),
      wageP25: num(r.wage_p25_2025),
      wageP75: num(r.wage_p75_2025),
      wageP90: num(r.wage_p90_2025),
    };
  });
  const blsByCode = new Map(bls.map((b) => [b.code, b]));
  categories.forEach((c) => { c.bls = c.blsCodes.map((code) => blsByCode.get(code)); });

  return {
    categories,
    catById: new Map(categories.map((c) => [c.id, c])),
    bls,
    blsByCode,
    titleMap,
    totalN: filtered.length,
    totalTitles: titleMap.length,
    salaryMax: SAL_MAX,
  };
}

// ---------------------------------------------------------------------------
// Configuration for the grouped (career-category) dashboards.
// The category of every job title and BLS occupation comes from the CSV
// files; this file only controls display: labels, colors, filters.
// ---------------------------------------------------------------------------

export const FILES = {
  salaries: "data/salaries_grouped.csv",
  bls: "data/bls_career_outlook_grouped.csv",
  titleMap: "data/job_title_to_career_category_mapping.csv",
};

// Filters applied to salaries_grouped.csv
export const SALARY_FILTER = {
  country: "US",   // employee_residence
  year: 2024,      // work_year (largest sample in the file)
};

// Experience-level groups (no years of experience are implied)
export const LEVELS = [
  { code: "EN", label: "Entry" },
  { code: "MI", label: "Mid" },
  { code: "SE", label: "Senior" },
  { code: "EX", label: "Executive" },
];

// Groups with fewer observations than this are flagged as limited data
export const MIN_N = 30;

// Categories with fewer records than this get a "small sample" note
export const SMALL_N = 100;

// Display settings per career_category (keys must match the CSV values).
// Colors are fixed per category (never by rank) and shared by all charts.
// Neighbours in the radial order (median salary, "Other" last) were checked
// for colour-blind separation; labels always carry identity as well.
export const CATEGORY_STYLE = {
  "Product & Technical Management":     { short: "Product & Tech Mgmt",    color: "#ff9f43" },
  "AI & Machine Learning":              { short: "AI & ML",                color: "#a86bff" },
  "Cybersecurity":                      { short: "Cybersecurity",          color: "#ff5c7a" },
  "Research & Applied Science":         { short: "Research & Applied Sci.", color: "#2dd4bf" },
  "Software Development":               { short: "Software Dev.",          color: "#e879f9" },
  "Robotics & Computer Vision":         { short: "Robotics & CV",          color: "#d9f99d" },
  "Systems, Cloud & DevOps":            { short: "Systems, Cloud & DevOps", color: "#22d3ee" },
  "Data Architecture & Modeling":       { short: "Data Architecture",      color: "#fdba74" },
  "Data Science":                       { short: "Data Science",           color: "#3b9dff" },
  "Data Engineering & Platforms":       { short: "Data Engineering",       color: "#2ee0a1" },
  "Quantitative & Operations Research": { short: "Quant & Ops Research",   color: "#f472b6" },
  "Database Administration":            { short: "Database Admin.",        color: "#c4b5fd" },
  "Statistics":                         { short: "Statistics",             color: "#ff8a65" },
  "Computer Programming":               { short: "Programming",            color: "#86efac" },
  "Data Governance & Management":       { short: "Data Governance",        color: "#d8b4fe" },
  "Analytics & Business Intelligence":  { short: "Analytics & BI",         color: "#f5c938" },
  "Other":                              { short: "Other",                  color: "#9aa7b8" },
};
// Fallback for a category found in the data but missing above
export const DEFAULT_STYLE = { color: "#94a3b8" };

// The salary "Other" category is kept, but always placed last.
export const OTHER = "Other";

// BLS-only category (no salary category of the same name).
export const BLS_ONLY_STYLE = { color: "#64748b" };

// Meaning of bls_comparison_scope values, shown wherever a link is displayed.
export const SCOPE_TEXT = {
  direct_for_exact_title_only:
    "Direct match for the exact job title only. Other titles in this category are related, but this projection does not measure them specifically.",
  broader_context_only:
    "Broader context only. This BLS occupation is related to the category but does not measure its job titles specifically.",
  broad_miscellaneous_not_other:
    "BLS catch-all occupation. It is not the same as the salary data's “Other” category, so no salary comparison is made.",
};

// Short labels for bubbles (full titles appear in tooltips and panels)
export const BLS_SHORT = {
  "15-2051": "Data scientists",
  "15-1221": "Computer & info. research scientists",
  "15-1212": "Information security analysts",
  "15-2031": "Operations research analysts",
  "15-2041": "Statisticians",
  "15-1252": "Software developers",
  "15-1243": "Database architects",
  "15-1211": "Computer systems analysts",
  "15-1299": "Computer occupations, all other",
  "15-1242": "Database administrators",
  "15-1251": "Computer programmers",
};

export const SOURCES = {
  salary: "Self-reported compensation · U.S. residents · 2024 (salaries_grouped.csv)",
  blsWage: "BLS Occupational Employment and Wage Statistics · U.S. · 2025",
  blsProj: "BLS Employment Projections · U.S. · 2025–2035",
};

// ---------------------------------------------------------------------------
// Prototype B: two comparison slots. Each selected occupation keeps its slot
// color in every view; ①/② badges are the non-color encoding.
// ---------------------------------------------------------------------------
export const SLOTS = [
  { index: 0, badge: "①", label: "Occupation 1", color: "#2fc7ff" },
  { index: 1, badge: "②", label: "Occupation 2", color: "#ffb020" },
];

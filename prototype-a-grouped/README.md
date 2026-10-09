# Prototype A (grouped) — Salary-First Career Explorer

Revised version of Prototype A (`../prototype-a`, unchanged). Instead of seven hand-picked job titles, it analyses **every U.S. 2024 salary record (23,580)** across **17 career categories** covering **all 289 original job titles**, including **Other**.

Layout and interactions are the same as Prototype A: the Salary Landscape is the main view, with Career Progression and the Career Opportunity Constellation below it as supporting views.

## Run locally

```bash
cd prototype-a-grouped
python -m http.server 8002        # then open the address it prints in a browser
```

The page must be served over HTTP so it can load its CSV files. There is no build step. D3 v7 loads from jsDelivr. The folder is self-contained and can be published to GitHub Pages on its own.

## Data (`data/`)

| File | Used for |
|---|---|
| `salaries_grouped.csv` | Salary records. Filter: `employee_residence = US`, `work_year = 2024`. Uses `salary_in_usd`, `career_category`, `experience_level` and `original_job_title`. |
| `bls_career_outlook_grouped.csv` | 11 BLS occupations: official names, codes, 2025 wages, 2025–2035 projections, `career_category`, `bls_comparison_scope`. |
| `job_title_to_career_category_mapping.csv` | All 289 job titles → category. Powers the search and the per-category title lists. |

All statistics are calculated in the browser from individual records (`js/data.js`). Category medians and percentiles are **not** averages of job-title medians. No `career_category_summary.csv` was provided, so category summaries are computed from the records.

## Views and interactions

- **Salary Landscape:** one petal per category, ordered clockwise by median salary, with **Other** last. The encodings are unchanged from Prototype A. With 17 petals, labels sit in two columns with leader lines. On narrow screens the labels hide and the scrollable category list identifies the petals.
- **Side column:**
  - **Search** any category or any of the 289 original titles. A title selects its category and is highlighted in the title list.
  - A **scrollable category list** (median, *n*, ◆ = has BLS data) that also selects categories.
  - The **info panel**: category statistics, all job titles with their U.S. 2024 counts, and BLS outlook data with its comparison scope.
- **Career Progression:** 17 lanes in the same order and colors. *n* < 30 is flagged ⚠, and empty levels show N/A with no line drawn.
- **Constellation:** each bubble is one BLS occupation with its own official statistics, colored by its career category.

Selecting a category highlights it in all three views and highlights its BLS occupation(s) when one exists. Otherwise every panel says **"Outlook data unavailable"**. Clicking a bubble selects its category. "Computer occupations, all other" belongs to a BLS-only category (*Other Computer Occupations*), which is not the salary data's *Other*, so no salary comparison is shown for it.

Every BLS link shows its `bls_comparison_scope`:
- *direct for exact title only*: Data Science, Software Development, Statistics, Database Administration.
- *broader context only*: the other categories with a BLS occupation.

## Display settings

`js/config.js` holds category short labels and colors. Colors are fixed per category, not by rank, and are shared by all three charts. Neighboring categories in the radial order were checked for colorblind separation.

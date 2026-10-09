# Prototype B (grouped) — Future-First Career Explorer

Revised version of Prototype B (`../prototype-b`, unchanged). The two-occupation comparison works as before. The salary views now follow the **career category** of each selected BLS occupation and use **all 23,580 U.S. 2024 salary records** across **17 categories** (all 289 job titles, including **Other**).

## Run locally

```bash
cd prototype-b-grouped
python -m http.server 8003        # then open the address it prints in a browser
```

The page must be served over HTTP. There is no build step. D3 v7 loads from jsDelivr. The folder is self-contained (its own `data/`).

## Data (`data/`)

Same three files as Prototype A (grouped): `salaries_grouped.csv`, `bls_career_outlook_grouped.csv` and `job_title_to_career_category_mapping.csv`. All statistics are calculated from individual records in `js/data.js`.

## Interactions

- **Constellation (main view):**
  - Click up to two bubbles. Slot ① is cyan and slot ② is amber.
  - Clicking a third bubble opens a popover asking which slot to replace.
  - Remove a pick with ✕ in the header tray or on its comparison card.
  - **Clear comparison** resets everything.
- **Comparison panel:** wage, growth, employment and openings for both picks, with bars scaled across all 11 occupations. It also shows each pick's **salary category** and its BLS comparison scope.
- **Salary Landscape and Career Progression:**
  - Each pick's category is highlighted in its slot color. Its lane moves to the top, with grouped bars and sample sizes by experience level.
  - **Different categories:** two separate category comparisons.
  - **Same category:** one petal shows both badges (①②), and the strip, comparison panel and progression panel all state that the two occupations **share one set of category-level salary statistics**. No separate distributions are invented. With the current data, all 11 occupations are in different categories. This case was tested with a modified copy of the data.
  - **No salary category** ("Computer occupations, all other"): messages appear in place of any salary data.
- **Clicking a petal or lane** adds that category's BLS occupation to the comparison. Categories without one (e.g. AI & Machine Learning, Other) show a notice instead.
- On narrow screens the petal labels hide; the **"All career categories"** key under the chart lists every category.

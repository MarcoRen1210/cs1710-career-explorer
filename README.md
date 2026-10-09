# Data Science Career Explorer — CS 1710 Project

**Team:** Marco Ren, Helen Jin, Daniel Wei

## Interactive dashboards

| Prototype | Live dashboard |
|---|---|
| **A — Salary-First Career Explorer** | https://marcoren1210.github.io/cs1710-career-explorer/prototype-a-grouped/ |
| **B — Future-First Career Explorer** | https://marcoren1210.github.io/cs1710-career-explorer/prototype-b-grouped/ |

Both run in any modern browser. There is nothing to install.

## Research question

> **Which data science-related careers offer attractive compensation, salary progression across experience levels, and strong future employment opportunities in the United States?**

## Two prototypes, one question

Both dashboards combine the same three coordinated D3.js visualizations from our Process Book:

- **Salary Landscape** (Sketch 5): a radial chart of salary distributions, with one petal per career category.
- **Career Progression** (Sketch 9): median salary at the Entry, Mid, Senior and Executive levels.
- **Career Opportunity Constellation** (Sketch 12): BLS occupations by projected growth (x), median wage (y) and employment (bubble area).

They differ in where exploration starts and how the views are linked:

| | **A: Salary-First** | **B: Future-First** |
|---|---|---|
| Main view | Salary Landscape | Career Opportunity Constellation |
| Starting point | A career category (petal, lane, list, or job-title search) | A BLS occupation |
| Interaction | Select one category and inspect it across all views | Select and compare two occupations side by side (slots ① and ②) |
| Best for | "What does this career pay, and how does pay change with experience?" | "Which occupations have the strongest outlook, and how do their salaries compare?" |

## Datasets

| Dataset | Content | Period |
|---|---|---|
| `salaries_grouped.csv` | Individual self-reported AI/ML/data salaries (34,024 records, 289 job titles). The dashboards use U.S. residents in 2024: 23,580 records. | 2024 |
| `bls_career_outlook_grouped.csv` | U.S. Bureau of Labor Statistics data for 11 occupations: OEWS median wages and Employment Projections. | Wages 2025; projections 2025–2035 |
| `job_title_to_career_category_mapping.csv` | Maps each of the 289 job titles to a career category. | — |

Self-reported individual salaries and official BLS occupation statistics are different kinds of data. The dashboards always label them separately and never merge them. BLS projections are not estimates of AI's effect on employment.

## Career classification

Similar job titles are grouped into **17 career categories**, such as *AI & Machine Learning*, *Data Science*, *Data Engineering & Platforms* and *Analytics & Business Intelligence*. Ambiguous or unrelated titles go to **Other**, so no salary records are dropped. All statistics are calculated from the individual records in each category.

Each BLS occupation is linked to one category. The link is labeled either:
- **direct for exact title only**, e.g. BLS *Data scientists* ↔ the job title *Data Scientist*; or
- **broader context only**.

Categories without a BLS occupation, such as *AI & Machine Learning*, show "outlook data unavailable" rather than a borrowed projection.

## Repository layout

```
prototype-a-grouped/   Prototype A: index.html, css/, js/, data/
prototype-b-grouped/   Prototype B: index.html, css/, js/, data/
```

Each folder is self-contained. To run one locally, run `python -m http.server` inside the folder and open the address it prints.

Built with D3.js v7, SVG, HTML, CSS and JavaScript. There is no build step.

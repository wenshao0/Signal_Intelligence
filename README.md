# Signal Desk

Signal Desk is now a question-first business-reporting prototype for an internal newsroom tool. It starts from a concrete event or question, then uses page context and optional structured business tables as supporting evidence. Dataset discovery, ingestion, and review remain available, but they are no longer the main visible path for generating meaning.

This version is intentionally narrow:

- It is optimized for business events, filings, earnings coverage, and structured business-style tables.
- It accepts either structured CSV uploads or a small supported set of public structured datasets.
- It now has a primary `Explain question/event` flow that assembles 1 to 2 explanation paths instead of mining standalone hypotheses from arbitrary data.
- It reuses structured data only when it helps support or challenge a question-first explanation.
- It keeps dataset credibility, evidence summaries, and caution layers as supporting material.
- It generates reporting explanations, not full stories.
- It avoids causal claims and frames findings as leads that still require reporting.

## Tech stack

- Node.js 20+ with no runtime dependencies
- A small HTTP server in `server.mjs`
- A shared analysis module in `src/analysis/`
- Question-first orchestration modules in `src/questions/`
- Structured evidence helpers in `src/evidence/`
- Dataset discovery and ingestion modules in `src/datasets/`
- A dataset review layer in `src/datasets/review.mjs`
- A reporting validation planner and explanation assembler in `src/reporting/`
- Static HTML, CSS, and browser-side JavaScript in `public/`

This keeps version 1 pragmatic: easy to run, easy to inspect, and easy to replace piece by piece as the product matures.

## Project structure

```text
.
├── data/
│   └── sample-company-peer-metrics.csv
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── datasets/
│   │   ├── discovery.mjs
│   │   ├── ingestion.mjs
│   │   └── review.mjs
│   ├── evidence/
│   │   └── structured-signal-extractor.mjs
│   ├── questions/
│   │   ├── anchor-extractor.mjs
│   │   ├── mechanism-router.mjs
│   │   └── tension-detector.mjs
│   ├── analysis/
│   │   └── disparity-analyzer.mjs
│   └── reporting/
│       ├── explanation-assembler.mjs
│       └── validation-planner.mjs
├── package.json
├── README.md
└── server.mjs
```

## Build plan

1. Start from a concrete question or event rather than mining meaning directly from data.
2. Reuse page text and optional business-style tables as evidence for 1 to 2 explanation paths.
3. Keep dataset discovery and CSV analysis available as supporting infrastructure.
4. Reuse the same evidence, caution, and supporting-dataset layers after either question-first analysis, upload, or public-dataset selection.

## How it works

The question-first analysis pipeline:

- Extracts a concrete anchor event or question from the page context
- Detects tensions or contradictions that make the event worth explaining
- Routes the case into 1 to 2 business explanation families
- Reviews any attached structured table for business relevance
- Reuses the existing business analyzer to mine supporting table signals when the table is useful
- Produces a small set of explanation cards with:
  - explanation headline
  - why it may matter
  - current evidence summary
  - what weakens it
  - what still needs verification
  - supporting tables and method notes as secondary layers

The older dataset-first flows still work, but they are now secondary to the explanation path.

## Sample dataset

`data/sample-company-peer-metrics.csv` is a small synthetic business peer-comparison dataset included for testing the prototype end to end.

## Supported public dataset discovery

This version supports a narrow, documented source set:

- `data.gov` catalog search via CKAN metadata
- `NYC Open Data` datasets exposed through the Socrata catalog and JSON API
- `Chicago Data Portal` datasets exposed through the Socrata catalog and JSON API

Discovery is intentionally constrained:

- No arbitrary web crawling
- No scraping of general websites
- No autonomous research behavior
- Only datasets that can be fetched as structured CSV or JSON and normalized into rows

Some catalog results will still be rejected if they do not expose a usable structured download, are too large for the prototype limits, or cannot be flattened into tabular records.

## Dataset credibility and quality review

Each discovered dataset card now shows:

- source / publisher
- source type: government, academic, nonprofit, private, or unknown
- data format
- update / freshness metadata when available
- a heuristic source-credibility assessment with brief reasoning
- an explicit data-usability judgment:
  - suitable for disparity analysis
  - maybe suitable
  - not suitable
- key quality signals from a lightweight sample review:
  - row count when available
  - missingness in sampled rows
  - likely group columns
  - likely metric columns
  - obvious limitations

This is a newsroom triage layer, not factual verification. It is meant to clearly separate:

- source credibility assessment
- data quality and usability assessment
- lead generation after a dataset is chosen for analysis

## Lead-centered validation planning and execution

The planner is a guidance layer, not an automated verifier. It keeps dataset review as a supporting layer, but the main journalist-facing output after analysis now centers each lead and its missing evidence chain.

- baseline and denominator guidance:
  - what baseline is still missing
  - whether the lead needs population, renter, enrollment, exposure, peer-group, historical, geographic, or policy-comparison context
- secondary-source recommendations:
  - 2 to 4 plausible public dataset types that could validate or challenge the pattern
  - a brief joinability assessment for each one:
    - why it is relevant
    - what join or comparison key might exist
    - what limitation would still remain
- follow-up guidance:
  - missing fields or comparisons in the current dataset
- reporting suggestions:
  - interviews
  - relevant agencies or institutions
  - records or documents worth requesting
- caution and claim limits:
  - what cannot yet be claimed from the current evidence
  - what still needs to be confirmed before treating the lead as reporting-ready

The first execution path is intentionally narrow:

- It supports leads grouped by an explicit ZIP-code column.
- It fetches a structured secondary dataset from the U.S. Census ACS 5-year API.
- It adds baseline context such as population, renter households, and median household income.
- For count-like primary metrics, it attempts a simple denominator-adjusted comparison.
- It then labels the added context as strengthening, weakening, or complicating the lead.

This is not automatic validation. It is a practical first pass at evidence-chain execution with explicit joins only.

The workflow stays the same:

1. discover or upload a dataset
2. review source credibility and data usability
3. run disparity analysis
4. review lead-specific evidence-chain guidance before treating a lead as strong
5. when a lead has an explicit ZIP-code join path, run the cross-dataset evidence check to compare the original signal against Census baseline context

## Run locally

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Usage

1. Use `Explain question/event` for the primary workflow.
2. Enter a business question or event, paste page text, and optionally add one structured business table as CSV.
3. Review the 1 to 2 explanation cards first.
4. Open supporting layers to inspect tensions, timeline hints, and structured evidence.
5. Use `Upload CSV` or `Find public datasets` only when you want to inspect a dataset directly.

## Smallest architecture change

The prototype keeps most of the original analysis engine and UI result layout. The main additions are:

- `POST /api/explain-page` for the new question-first flow
- `src/questions/anchor-extractor.mjs` to identify the event or question anchor
- `src/questions/tension-detector.mjs` to find contradictions worth explaining
- `src/questions/mechanism-router.mjs` to choose 1 to 2 business explanation families
- `src/evidence/structured-signal-extractor.mjs` to mine supporting signals from business-style tables
- `src/reporting/explanation-assembler.mjs` to turn the case into explanation cards
- `POST /api/discover` to search a controlled set of public catalogs
- `POST /api/discover` now also enriches each candidate with credibility and quality review data
- `POST /api/analyze-discovered` to fetch a selected dataset, normalize it, and pass it into the existing analyzer
- `src/datasets/discovery.mjs` for source-specific search logic
- `src/datasets/ingestion.mjs` for remote fetch, JSON-to-tabular normalization, and prototype safety limits
- `src/datasets/review.mjs` for source typing, freshness formatting, reliability heuristics, and sample-based data quality signals
- `src/reporting/validation-planner.mjs` for dataset-level guidance plus lead-centered evidence-chain planning
- `src/reporting/evidence-executor.mjs` for narrow cross-dataset execution against Census ACS baseline data

This keeps the change additive rather than replacing the existing internals or turning the app into a crawler or a large autonomous system.

## Notes for next iterations

- Add manual column selection after remote ingestion so reporters can override auto-detected fields.
- Add pagination or sampled previews for large remote datasets instead of hard size limits.
- Broaden supported sources only where stable APIs and structured downloads are available.
- Add explicit schema controls so users can pick group columns and metrics manually.
- Add stronger statistical screening for minimum sample sizes and significance testing.
- Support saved analysis sessions and editorial annotations.
- Add source logging for reproducibility and newsroom review.

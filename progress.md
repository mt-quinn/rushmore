# Rushmore Dataset Research Progress

## 2026-06-22
- Created planning files for dataset feasibility research.
- Confirmed `/Users/quinn/Documents/rushmore` is clean on `main` before starting.
- Researched starter data families: music artists, US presidents, and consumer products.
- Added `Documentation/Rushmore Dataset Feasibility.md` with source links, dataset-depth assessment, risks, and recommended first ingestion order.

## Current recommendation
- Start ingestion with USDA FoodData Central beverages because it best tests the large-dataset premise.
- Add US presidents as the high-trust benchmark board.
- Add music after deciding whether chart/award stats will be curated, scraped, or licensed.

## POC decision
- First proof-of-concept boards are Food/Sodas and Presidents.
- `client/public/rushmore.png` is a comedic reveal asset with transparent face cutouts for four selected entities.
- Added `Documentation/Rushmore Proof of Concept Design.md` to capture the first playable loop and reveal philosophy.

## Dataset build checkpoint
- Added reproducible builders in `scripts/`.
- Built `client/public/data/rushmore/beverages.playable.json` from USDA FoodData Central Branded Foods April 2026.
- Built `client/public/data/rushmore/presidents.app-2026-06-22.json` from American Presidency Project source pages plus static identity metadata.
- Added `client/public/data/rushmore/manifest.json` and README with counts, stat keys, source links, and sample top-four answers.
- Raw source archives/pages are cached under ignored `data/source/`; full beverage audit derivative is under ignored `data/generated/`.

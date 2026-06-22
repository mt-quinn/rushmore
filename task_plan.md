# Rushmore Dataset Feasibility Plan

## Goal
Assess and select the first proof-of-concept dataset families for Rushmore, then capture the playable direction for the initial game loop.

## Phases

| Phase | Status | Notes |
|---|---|---|
| Define evaluation criteria | complete | Need depth, provenance, numeric stats, repeat play, and explainability. |
| Research music datasets | complete | MusicBrainz is strong for identity; scoring stats need Billboard/RIAA/Grammy layers. |
| Research presidents datasets | complete | APP provides approval, executive order, and election statistics with strong provenance. |
| Research consumer products datasets | complete | USDA FDC is the best first large ingestion source; Open Food Facts is useful secondary breadth. |
| Synthesize recommendations | complete | Added `Documentation/Rushmore Dataset Feasibility.md`. |
| Select POC boards | complete | User chose Food/Sodas and Presidents as the first two boards. |
| Capture reveal concept | complete | `client/public/rushmore.png` provides comedic transparent cutouts for the four chosen entities. |
| Build POC datasets | complete | Generated USDA beverage and APP president JSON datasets plus manifest. |

## Evaluation Criteria
- Entity depth: enough entities for non-obvious four-pick sets.
- Stat variety: multiple numeric stats per entity.
- Source credibility: primary or stable public datasets preferred.
- Normalization clarity: units, era, geography, dates, source notes.
- Playability: supports surprising picks, constraints, and repeat prompts.
- Update cost: predictable maintenance burden.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|

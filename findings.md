# Rushmore Dataset Findings

## Research Log

### Initial framing
- The proof of concept should use a small number of domains but large-enough datasets to test the actual promise: discovery through statistical comparison.
- The best datasets will behave like reusable game boards: one entity list, many numeric stat prompts.
- A source citation and stat definition must travel with every stat, because the same plain-English question can mean different things depending on source and normalization.

### Music dataset early findings
- MusicBrainz is very strong for entity identity and depth: as of 2026-06-22 it lists roughly 2.9M artists, 5.6M releases, and 39.3M recordings. Core dumps are available, with core data under CC0. This is useful for canonical artist names, aliases, relationships, dates, countries, genres via derived/tag data, and deduplication.
- MusicBrainz alone is not enough for the game’s most obvious competitive stats because it does not provide Billboard chart rank history, sales totals, streaming totals, or awards as first-class complete metrics.
- RIAA’s Gold & Platinum site exposes searchable certification records with artist/title/date/label/format visible in page data. It looks valuable for certification-count and certification-unit prompts, but needs a scraper/API feasibility check and careful handling of collaborations.
- Billboard #1/top-chart performance is very playable, but official structured access may be limited/commercial. Wikipedia tables and Billboard articles can support a prototype, but source/licensing and update reliability need care.

### Presidents dataset findings
- The American Presidency Project has a presidential approval dataset adapted from Gallup and compiled by Gerhard Peters. This supports prompts such as highest peak approval, lowest approval, final approval, average approval, disapproval, approval margin, volatility, and era-restricted sets. Scope starts with modern polling-era presidents, not all presidents.
- The American Presidency Project executive orders table covers Washington through Trump II with total orders, average per year, years in office, term splits for many presidents, and source notes. It is current through June 20, 2026 on the page reviewed.
- APP election pages list elections from 1789 through 2024 and can support electoral vote totals, popular vote share, margin, turnout, party, and winner/loser comparisons. This likely gives more replayability than approval alone.
- Presidents have limited entity depth (46 people, 47 presidencies if split by nonconsecutive terms), but excellent stat density and story value. The domain should be treated as a "high-trust small board" with many filters and statistic variants.

### Consumer products dataset findings
- USDA FoodData Central is the strongest baseline source for US nutrition data: public domain/CC0, API access, downloadable CSV/JSON archives, and the April 2026 Branded release is large (hundreds of MB zipped, multi-GB unzipped). It has branded foods and nutrient values useful for sugar, calories, sodium, caffeine where present, serving size, and category prompts.
- FDC requires an API key for real API use, but offers `DEMO_KEY` for limited exploration. Bulk downloads are probably better for our ingestion pipeline once we pick a slice.
- Open Food Facts is broader and explicitly open/reusable, with API access and bulk downloads, but it is crowdsourced and its own docs warn there are no assurances of accuracy/completeness/reliability. It is great for product/category/brand breadth and international reach, less good as the sole authority for competitive scoring.
- Consumer product playability is high if we constrain the first slice to a normalized category such as carbonated soft drinks/energy drinks in the US, standardize to per 12 fl oz or per 100 ml, and store source/version/date.

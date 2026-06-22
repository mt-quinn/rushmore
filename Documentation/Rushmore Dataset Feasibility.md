# Rushmore Dataset Feasibility

Date: 2026-06-22

## Summary

The proof of concept should go large on data, but not broad on domains. The first build will use two dataset families with complementary strengths:

- US presidents: smallest board, strongest trust and explainability.
- Consumer products: largest board, highest normalization burden.

The data model should treat every stat as a sourced claim, not as a bare number. Each scored value needs entity, stat key, value, unit, source, source date/version, normalization, and notes.

## Recommendation

Build the first data engine around these proof-of-concept boards:

1. Beverages and packaged drinks
   - Primary source: USDA FoodData Central Branded foods.
   - Secondary source: Open Food Facts for breadth and cross-checking.
   - First stats: sugar per 12 fl oz, calories per 12 fl oz, caffeine per 12 fl oz when present, sodium per serving, serving size weirdness.
   - Why first: huge dataset depth and a direct answer to whether statistical discovery is fun.

2. US presidents
   - Primary source: The American Presidency Project.
   - First stats: Gallup approval highs/lows/final approval, executive orders, executive orders per year, electoral vote share, popular vote margin, turnout, years in office, age at inauguration.
   - Why second: small but reliable, good for testing citation display, filters, and prompt phrasing.

Music artists remain a strong future expansion, but not part of the first proof of concept.

## Rushmore Reveal Image

`client/public/rushmore.png` is the first presentation asset. It is a 2250x1500 transparent PNG of Mount Rushmore with all four presidential faces cut out as ovals.

Implementation intent:

- Render four user choices behind the PNG layer, aligned to the transparent ovals.
- Do not attempt seamless realism. The desired tone is comedic collage: product labels, president portraits, initials, or generated badges should visibly look inserted.
- Use the reveal as a celebratory score moment after the player submits a set of four.
- For presidents, show portraits or high-contrast name plates.
- For sodas/foods, show brand/product labels where available, or bold text badges when images are unavailable.
- Keep the four slots addressable by normalized coordinates so the composition scales responsively.

## Dataset Depth

### Music Artists

MusicBrainz gives enormous depth for entity identity: roughly 2.9 million artists, 5.6 million releases, and 39.3 million recordings as of 2026-06-22. Its core data is available as dumps and released under CC0. This makes it a strong canonical backbone for artist IDs, names, aliases, countries, type, active years, recordings, releases, relationships, and genre tags.

The scoring data is harder. MusicBrainz does not provide complete Billboard performance, sales, streaming, or awards totals. For gameplay stats, we should layer in separate claims:

- Billboard Hot 100 #1 singles, weeks at #1, top-ten entries, chart longevity.
- RIAA certifications by artist/release.
- Grammy wins and nominations by artist.
- Potentially MusicBrainz-derived stats such as number of releases, active span, collaborations, and credited recordings.

Main risk: chart and awards data require careful attribution and deduplication. Collaborations are especially tricky: "Mark Ronson featuring Bruno Mars" can be credited differently depending on the source and stat.

Verdict: high-value future expansion, but not part of the first proof-of-concept dataset pair unless we accept a semi-curated scoring layer.

### US Presidents

This is a small entity set, but it is extremely usable. The American Presidency Project provides approval data adapted from Gallup, executive order counts, and election results. This domain can support many prompts:

- Highest combined peak approval.
- Lowest combined approval floor.
- Highest final approval.
- Most executive orders.
- Most executive orders per year.
- Largest electoral vote shares.
- Largest/smallest popular vote margins.
- Longest combined years in office.

Main risk: entity depth is low. We should make it replayable through filters and variants: only 20th century, only one-term presidents, only presidents who won election directly, split Grover Cleveland/Trump terms, approval-era only, war-time presidents, etc.

Verdict: excellent trust/calibration dataset. It should be included early, but it will not prove the "large dataset" fantasy by itself.

### Consumer Products

USDA FoodData Central is the cleanest starting point. It has API access, bulk downloads, public-domain/CC0 licensing, and a large Branded dataset. The April 2026 Branded release is 195 MB zipped as JSON and 428 MB zipped as CSV, expanding to multi-GB scale. This is deep enough for discovery.

Open Food Facts adds breadth, international coverage, and rich product/category/brand data, but its own documentation warns that data is voluntary and not guaranteed accurate, complete, or reliable. It is best as a secondary source or for exploratory boards, not as the only authority for competitive scoring.

The first product board should not be "all foods." It should be a normalized beverage board:

- Carbonated soft drinks.
- Energy drinks.
- Ready-to-drink teas/coffees.
- Maybe sports drinks and juices as later expansions.

Normalize stats to per 12 fl oz or per 100 ml. Store serving-size conversions explicitly.

Verdict: best first large dataset. It will expose the real engine problems: search, duplicate products, serving normalization, brand aliases, and source display.

## Data Model Implications

Use two layers:

1. Entity records
   - Stable ID.
   - Display name.
   - Domain.
   - Aliases.
   - Type/category.
   - Source IDs.

2. Stat claims
   - Entity ID.
   - Stat key.
   - Numeric value.
   - Unit.
   - Direction: higher-is-better or lower-is-better.
   - Source name and URL.
   - Source date or release version.
   - Normalization method.
   - Confidence/quality flags.
   - Human-readable note.

This lets one entity participate in many prompts and lets the UI explain why a number is what it is.

## Source Links

- MusicBrainz database downloads: https://musicbrainz.org/doc/MusicBrainz_Database/Download
- MusicBrainz statistics: https://musicbrainz.org/statistics
- RIAA Gold & Platinum: https://www.riaa.com/gold-platinum/
- Grammy archive: https://www.grammy.com/awards/
- American Presidency Project approval data: https://www.presidency.ucsb.edu/statistics/data/presidential-job-approval
- American Presidency Project executive orders: https://www.presidency.ucsb.edu/statistics/data/executive-orders
- American Presidency Project elections: https://www.presidency.ucsb.edu/statistics/elections
- USDA FoodData Central API guide: https://fdc.nal.usda.gov/api-guide/
- USDA FoodData Central downloads: https://fdc.nal.usda.gov/download-datasets/
- Open Food Facts API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

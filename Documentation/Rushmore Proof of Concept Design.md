# Rushmore Proof of Concept Design

Date: 2026-06-22

## Direction

Rushmore is a four-pick statistical discovery game. Players build a set of four people or things to maximize a sourced statistic, then see their chosen four carved into a deliberately goofy Mount Rushmore reveal image.

The proof of concept has two boards:

1. Food and sodas
2. US presidents

This pairing gives us one large, messy, discovery-heavy dataset and one compact, trustworthy, historically legible dataset.

## First Playable Loop

1. Player chooses a board: Food & Sodas or Presidents.
2. Game presents a prompt with a clear stat objective.
3. Player searches/browses and selects exactly four entities.
4. Player submits the set.
5. Each choice reveals its stat value, source, and context.
6. The four choices appear in the `rushmore.png` cutouts.
7. The result shows total score and a qualitative rank band.
8. Optional deeper comparison can reveal the best-known answer or nearby leaderboard results.

## Prompt Examples

### Food and Sodas

- Pick four sodas with the highest total sugar per 12 fl oz.
- Pick four beverages with the most caffeine per 12 fl oz.
- Pick four drinks with the highest calories per 12 fl oz.
- Pick four products with the lowest sugar while still having caffeine.
- Pick four branded drinks with the highest sodium per serving.

### Presidents

- Pick four presidents with the highest combined peak Gallup approval.
- Pick four presidents with the highest final approval.
- Pick four presidents with the most executive orders.
- Pick four presidents with the largest combined electoral vote share.
- Pick four presidents with the longest combined time in office.

## Reveal Philosophy

The reveal should reward the player before judging them. Do not immediately tell players they missed the optimal set. Show:

- Total score.
- Individual contribution from each pick.
- Source/context for each stat.
- A rank band such as "strong", "rare", "top tier", or percentile when available.
- Optional compare action for players who want the answer key.

The image composition should be funny, not polished. It is okay if a soda logo or president face looks pasted into the mountain. That visual joke supports the premise: the player is literally making their own Rushmore.

## Data Requirements

Each board needs:

- Entity records with stable IDs, names, aliases, categories, and optional image/logo fields.
- Stat claims with numeric values, units, source names, source URLs, source dates/versions, and normalization notes.
- Prompt definitions that specify domain, stat key, scoring method, constraints, and whether higher or lower values win.
- A quality flag for values that are missing, estimated, normalized, crowdsourced, or source-conflicted.

## Open Product Questions

- Should Food & Sodas include only beverages at first, or all branded foods after the ingestion works?
- Should president nonconsecutive terms be separate choices for stats like approval and executive orders?
- Should optimal answers be hidden until the player asks, or delayed until after a daily challenge ends?
- Should the first multiplayer mode use open search, dealt pools, or asynchronous daily leaderboards?


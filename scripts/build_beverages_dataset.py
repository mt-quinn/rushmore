#!/usr/bin/env python3
"""Build the Rushmore Food/Sodas proof-of-concept dataset from USDA FDC.

The script intentionally uses only Python's standard library so the data build
can run in a fresh checkout after the USDA source archive has been downloaded.
"""

from __future__ import annotations

import csv
import json
import re
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ZIP = ROOT / "data/source/usda-fdc/FoodData_Central_branded_food_csv_2026-04-30.zip"
OUTPUT_DIR = ROOT / "client/public/data/rushmore"
FULL_OUTPUT = ROOT / "data/generated/rushmore/beverages.fdc-2026-04-30.full.json"
PLAYABLE_OUTPUT = OUTPUT_DIR / "beverages.playable.json"

ARCHIVE_PREFIX = "FoodData_Central_branded_food_csv_2026-04-30"
ML_PER_12_FL_OZ = 354.882

NUTRIENTS = {
    "1008": ("calories_per_100_ml", "Energy", "kcal"),
    "2000": ("sugar_g_per_100_ml", "Total Sugars", "g"),
    "1063": ("sugar_g_per_100_ml", "Sugars, Total", "g"),
    "1057": ("caffeine_mg_per_100_ml", "Caffeine", "mg"),
    "1093": ("sodium_mg_per_100_ml", "Sodium", "mg"),
}

STAT_UNITS = {
    "calories": "kcal",
    "sugar_g": "g",
    "caffeine_mg": "mg",
    "sodium_mg": "mg",
}

PLAUSIBLE_MAX_PER_100_ML = {
    "calories_per_100_ml": 150,
    "sugar_g_per_100_ml": 22,
    "caffeine_mg_per_100_ml": 100,
    "sodium_mg_per_100_ml": 400,
}

CATEGORY_ALLOW = {
    "soda",
    "fruit & vegetable juice, nectars & fruit drinks",
    "water",
    "other drinks",
    "iced & bottle tea",
    "non alcoholic beverages ready to drink",
    "non alcoholic beverages - ready to drink",
    "non alcoholic beverages – ready to drink",
    "plant based water",
    "sport drinks",
    "energy, protein & muscle recovery drinks",
    "coffee",
    "plant based milk",
    "milk",
}

DEFAULT_PLAY_CATEGORIES = {
    "soda",
    "fruit & vegetable juice, nectars & fruit drinks",
    "water",
    "other drinks",
    "iced & bottle tea",
    "non alcoholic beverages ready to drink",
    "non alcoholic beverages - ready to drink",
    "non alcoholic beverages – ready to drink",
    "sport drinks",
    "plant based water",
    "coffee",
    "drinks flavoured - ready to drink",
}

CATEGORY_TERMS = (
    "beverage",
    "ready to drink",
    "soda",
    "juice",
    "water",
    "sport drink",
    "bottle tea",
    "iced tea",
)

EXCLUDE_TEXT = re.compile(
    r"\b(powder|powdered|mix|syrup|concentrate|capsule|tablet|tea bag|tea bags|"
    r"k-cup|pod|pods|ground coffee|coffee beans|instant coffee|extract|"
    r"cake|cookie|cracker|candy|sauce|dressing|marinade|salsa|tuna|yogurt|"
    r"ice cream|frozen fruit|canned fruit|dessert|snack bar|granola bar|protein bar|"
    r"nutrition bar|energy bar|bar|oil|butter|fat bomb)\b",
    re.IGNORECASE,
)


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def norm_category(value: str) -> str:
    return norm_text(value).lower().replace("  ", " ")


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "item"


def parse_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def serving_ml(row: dict[str, str]) -> tuple[float | None, list[str]]:
    size = parse_float(row.get("serving_size", ""))
    unit = (row.get("serving_size_unit") or "").strip().lower()
    flags: list[str] = []
    if size is None or size <= 0:
        return None, ["missing-serving-size"]
    if unit in {"ml", "mlt"}:
        return size, flags
    if unit in {"g", "grm", "gm"}:
        flags.append("grams-treated-as-ml")
        return size, flags
    return None, [f"unsupported-serving-unit:{unit or 'blank'}"]


def is_ready_beverage(food: dict[str, str], branded: dict[str, str]) -> bool:
    category = norm_category(branded.get("branded_food_category", ""))
    text = " ".join(
        [
            food.get("description", ""),
            branded.get("short_description", ""),
            branded.get("brand_owner", ""),
            branded.get("brand_name", ""),
            branded.get("subbrand_name", ""),
            branded.get("branded_food_category", ""),
            branded.get("household_serving_fulltext", ""),
        ]
    )
    if EXCLUDE_TEXT.search(text):
        return False
    if category in CATEGORY_ALLOW:
        return True
    if "not ready to drink" in category or "water enhancer" in category or "alcoholic" in category:
        return False
    return any(term in category for term in CATEGORY_TERMS)


def read_csv_from_zip(zf: zipfile.ZipFile, filename: str):
    with zf.open(f"{ARCHIVE_PREFIX}/{filename}") as handle:
        lines = (line.decode("utf-8", errors="replace") for line in handle)
        yield from csv.DictReader(lines)


def build_stat_claims(raw: dict[str, float]) -> tuple[dict[str, dict[str, Any]], list[str]]:
    claims: dict[str, dict[str, Any]] = {}
    quality_flags: list[str] = []
    for key, value in sorted(raw.items()):
        if value < 0:
            continue
        plausible_max = PLAUSIBLE_MAX_PER_100_ML.get(key)
        if plausible_max is not None and value >= plausible_max:
            quality_flags.append(f"suppressed-outlier:{key}:{round(value, 4)}")
            continue
        if key.endswith("_per_100_ml"):
            base_unit = key.removesuffix("_per_100_ml")
            unit = STAT_UNITS.get(base_unit, "")
            per_12_key = f"{base_unit}_per_12_fl_oz"
            claims[key] = {
                "value": round(value, 4),
                "unit": unit,
                "basis": "per 100 ml",
            }
            claims[per_12_key] = {
                "value": round(value * ML_PER_12_FL_OZ / 100, 4),
                "unit": unit,
                "basis": "per 12 fl oz",
                "normalization": "USDA nutrient amount per 100 ml scaled to 354.882 ml",
            }
    return claims, quality_flags


@dataclass
class BeverageCandidate:
    fdc_id: str
    food: dict[str, str]
    branded: dict[str, str]
    serving_ml: float
    quality_flags: list[str]


def main() -> int:
    if not SOURCE_ZIP.exists():
        print(f"Missing USDA source archive: {SOURCE_ZIP}", file=sys.stderr)
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    FULL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    candidates: dict[str, BeverageCandidate] = {}
    category_counter: Counter[str] = Counter()
    unit_reject_counter: Counter[str] = Counter()

    with zipfile.ZipFile(SOURCE_ZIP) as zf:
        foods: dict[str, dict[str, str]] = {}
        for row in read_csv_from_zip(zf, "food.csv"):
            if row.get("data_type") == "branded_food" and row.get("market_country") == "United States":
                foods[row["fdc_id"]] = row

        for branded in read_csv_from_zip(zf, "branded_food.csv"):
            food = foods.get(branded.get("fdc_id", ""))
            if not food or not is_ready_beverage(food, branded):
                continue
            ml, flags = serving_ml(branded)
            if ml is None:
                unit_reject_counter[branded.get("serving_size_unit", "")] += 1
                continue
            fdc_id = branded["fdc_id"]
            category_counter[norm_text(branded.get("branded_food_category", ""))] += 1
            candidates[fdc_id] = BeverageCandidate(fdc_id, food, branded, ml, flags)

        nutrient_values: dict[str, dict[str, float]] = {fdc_id: {} for fdc_id in candidates}
        for row in read_csv_from_zip(zf, "food_nutrient.csv"):
            fdc_id = row.get("fdc_id", "")
            if fdc_id not in nutrient_values:
                continue
            mapped = NUTRIENTS.get(row.get("nutrient_id", ""))
            amount = parse_float(row.get("amount", ""))
            if mapped is None or amount is None:
                continue
            stat_key, _name, _unit = mapped
            if stat_key == "sugar_g_per_100_ml" and row.get("nutrient_id") != "2000" and stat_key in nutrient_values[fdc_id]:
                continue
            if stat_key == "sugar_g_per_100_ml" and row.get("nutrient_id") == "1063" and "sugar_g_per_100_ml" in nutrient_values[fdc_id]:
                continue
            nutrient_values[fdc_id][stat_key] = amount

    records: list[dict[str, Any]] = []
    skipped_no_stats = 0
    for fdc_id, candidate in candidates.items():
        claims, stat_quality_flags = build_stat_claims(nutrient_values.get(fdc_id, {}))
        if not claims:
            skipped_no_stats += 1
            continue
        branded = candidate.branded
        food = candidate.food
        brand = norm_text(branded.get("brand_name")) or norm_text(branded.get("brand_owner"))
        name = norm_text(food.get("description"))
        category = norm_text(branded.get("branded_food_category"))
        canonical_key = slugify(" ".join([brand, re.sub(r"\b\d+(\.\d+)?\s*(fl oz|ml|l|oz|pack|ct|count)\b", "", name, flags=re.I)]))
        quality_flags = [*candidate.quality_flags, *stat_quality_flags]
        if not brand:
            quality_flags.append("missing-brand")
        record = {
            "id": f"fdc:{fdc_id}",
            "domain": "beverages",
            "name": name,
            "brand": brand,
            "category": category,
            "canonicalKey": canonical_key,
            "fdcId": int(fdc_id),
            "gtinUpc": branded.get("gtin_upc") or None,
            "serving": {
                "size": round(candidate.serving_ml, 4),
                "unit": "ml",
                "label": norm_text(branded.get("household_serving_fulltext")),
            },
            "packageWeight": norm_text(branded.get("package_weight")) or None,
            "stats": claims,
            "source": {
                "name": "USDA FoodData Central Branded Foods",
                "release": "April 2026",
                "url": "https://fdc.nal.usda.gov/download-datasets/",
                "publicationDate": food.get("publication_date") or None,
                "modifiedDate": branded.get("modified_date") or None,
                "availableDate": branded.get("available_date") or None,
            },
            "qualityFlags": quality_flags,
        }
        record["defaultPlayable"] = not quality_flags and norm_category(category) in DEFAULT_PLAY_CATEGORIES
        records.append(record)

    records.sort(key=lambda item: (item.get("brand") or "", item["name"], item["fdcId"]))

    # Keep one representative per canonical product/stat profile for a first playable board.
    best_by_key: dict[str, dict[str, Any]] = {}
    duplicate_counts: Counter[str] = Counter()
    for record in records:
        stat_signature = json.dumps(record["stats"], sort_keys=True)
        key = f"{record['canonicalKey']}::{stat_signature}"
        duplicate_counts[key] += 1
        current = best_by_key.get(key)
        if current is None:
            best_by_key[key] = record
            continue
        current_size = current["serving"]["size"]
        new_size = record["serving"]["size"]
        if abs(new_size - ML_PER_12_FL_OZ) < abs(current_size - ML_PER_12_FL_OZ):
            best_by_key[key] = record

    playable = []
    for key, record in best_by_key.items():
        copy = dict(record)
        copy["duplicateGroupSize"] = duplicate_counts[key]
        playable.append(copy)
    playable.sort(key=lambda item: (item.get("brand") or "", item["name"], item["fdcId"]))

    metadata = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "domain": "beverages",
        "source": "USDA FoodData Central Branded Foods April 2026 CSV",
        "sourceArchive": SOURCE_ZIP.name,
        "normalization": "Nutrients are USDA amounts per 100 ml; per-12-fl-oz values are scaled to 354.882 ml.",
        "candidateRows": len(candidates),
        "fullRows": len(records),
        "playableRows": len(playable),
        "defaultPlayableRows": sum(1 for record in playable if record.get("defaultPlayable")),
        "skippedNoStats": skipped_no_stats,
        "topCategories": category_counter.most_common(40),
        "unsupportedServingUnits": unit_reject_counter.most_common(20),
        "statKeys": sorted({key for record in records for key in record["stats"]}),
    }

    full_payload = {"metadata": metadata, "items": records}
    playable_payload = {"metadata": {**metadata, "dataset": "deduped-playable"}, "items": playable}

    FULL_OUTPUT.write_text(json.dumps(full_payload, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    PLAYABLE_OUTPUT.write_text(json.dumps(playable_payload, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")

    print(json.dumps(metadata, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Create compact app-facing Rushmore datasets from generated source-backed JSON."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "client/public/data/rushmore"


def compact_beverages() -> None:
    source = json.loads((DATA_DIR / "beverages.playable.json").read_text(encoding="utf-8"))
    items = []
    stat_keys = [
        "sugar_g_per_12_fl_oz",
        "caffeine_mg_per_12_fl_oz",
        "calories_per_12_fl_oz",
        "sodium_mg_per_12_fl_oz",
    ]
    for item in source["items"]:
        stats = {
            key: item["stats"][key]["value"]
            for key in stat_keys
            if key in item.get("stats", {})
        }
        if not stats:
            continue
        items.append(
            {
                "id": item["id"],
                "name": item["name"],
                "brand": item.get("brand") or "",
                "category": item.get("category") or "",
                "defaultPlayable": bool(item.get("defaultPlayable")),
                "qualityFlags": item.get("qualityFlags", []),
                "stats": stats,
            }
        )
    payload = {
        "metadata": {
            "domain": "beverages",
            "source": source["metadata"]["source"],
            "sourceUrl": "https://fdc.nal.usda.gov/download-datasets/",
            "records": len(items),
            "defaultPlayableRecords": sum(1 for item in items if item["defaultPlayable"]),
            "normalization": source["metadata"]["normalization"],
            "statKeys": stat_keys,
        },
        "items": items,
    }
    (DATA_DIR / "beverages.compact.json").write_text(
        json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )


def compact_presidents() -> None:
    source = json.loads((DATA_DIR / "presidents.app-2026-06-22.json").read_text(encoding="utf-8"))
    items = []
    for item in source["items"]:
        stats = {
            key: claim["value"]
            for key, claim in item.get("stats", {}).items()
            if isinstance(claim, dict) and "value" in claim
        }
        items.append(
            {
                "id": item["id"],
                "name": item["name"],
                "party": item.get("party", ""),
                "presidencyNumbers": item.get("presidencyNumbers", []),
                "terms": item.get("terms", []),
                "sourceCoverage": item.get("sourceCoverage", {}),
                "stats": stats,
            }
        )
    payload = {
        "metadata": {
            "domain": "presidents",
            "source": source["metadata"]["source"],
            "sourceUrls": [
                "https://www.presidency.ucsb.edu/statistics/data/presidential-job-approval",
                "https://www.presidency.ucsb.edu/statistics/data/executive-orders",
                "https://www.presidency.ucsb.edu/statistics/elections",
            ],
            "records": len(items),
            "statKeys": source["metadata"]["statKeys"],
        },
        "items": items,
    }
    (DATA_DIR / "presidents.compact.json").write_text(
        json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    compact_beverages()
    compact_presidents()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

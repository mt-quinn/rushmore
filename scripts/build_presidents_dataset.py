#!/usr/bin/env python3
"""Build the Rushmore US Presidents proof-of-concept dataset."""

from __future__ import annotations

import csv
import html
import json
import re
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data/source/american-presidency-project"
APPROVAL_DIR = SOURCE_DIR / "approval-sheets"
OUTPUT_DIR = ROOT / "client/public/data/rushmore"
OUTPUT = OUTPUT_DIR / "presidents.app-2026-06-22.json"

APP_BASE = "https://www.presidency.ucsb.edu"
APPROVAL_PAGE = SOURCE_DIR / "presidential-job-approval.html"
EXECUTIVE_ORDERS_PAGE = SOURCE_DIR / "executive-orders.html"
ELECTIONS_PAGE = SOURCE_DIR / "elections.html"
GOOGLE_SHEET_ID = "1iEl565M1mICTubTtoxXMdxzaHzAcPTnb3kpRndsrfyY"


PRESIDENTS = [
    (1, "George Washington", "Independent", "1789-04-30", "1797-03-04", 57),
    (2, "John Adams", "Federalist", "1797-03-04", "1801-03-04", 61),
    (3, "Thomas Jefferson", "Democratic-Republican", "1801-03-04", "1809-03-04", 57),
    (4, "James Madison", "Democratic-Republican", "1809-03-04", "1817-03-04", 57),
    (5, "James Monroe", "Democratic-Republican", "1817-03-04", "1825-03-04", 58),
    (6, "John Quincy Adams", "Democratic-Republican", "1825-03-04", "1829-03-04", 57),
    (7, "Andrew Jackson", "Democratic", "1829-03-04", "1837-03-04", 61),
    (8, "Martin Van Buren", "Democratic", "1837-03-04", "1841-03-04", 54),
    (9, "William Henry Harrison", "Whig", "1841-03-04", "1841-04-04", 68),
    (10, "John Tyler", "Whig", "1841-04-04", "1845-03-04", 51),
    (11, "James K. Polk", "Democratic", "1845-03-04", "1849-03-04", 49),
    (12, "Zachary Taylor", "Whig", "1849-03-04", "1850-07-09", 64),
    (13, "Millard Fillmore", "Whig", "1850-07-09", "1853-03-04", 50),
    (14, "Franklin Pierce", "Democratic", "1853-03-04", "1857-03-04", 48),
    (15, "James Buchanan", "Democratic", "1857-03-04", "1861-03-04", 65),
    (16, "Abraham Lincoln", "Republican", "1861-03-04", "1865-04-15", 52),
    (17, "Andrew Johnson", "Democratic", "1865-04-15", "1869-03-04", 56),
    (18, "Ulysses S. Grant", "Republican", "1869-03-04", "1877-03-04", 46),
    (19, "Rutherford B. Hayes", "Republican", "1877-03-04", "1881-03-04", 54),
    (20, "James A. Garfield", "Republican", "1881-03-04", "1881-09-19", 49),
    (21, "Chester A. Arthur", "Republican", "1881-09-19", "1885-03-04", 51),
    (22, "Grover Cleveland", "Democratic", "1885-03-04", "1889-03-04", 47),
    (23, "Benjamin Harrison", "Republican", "1889-03-04", "1893-03-04", 55),
    (24, "Grover Cleveland", "Democratic", "1893-03-04", "1897-03-04", 55),
    (25, "William McKinley", "Republican", "1897-03-04", "1901-09-14", 54),
    (26, "Theodore Roosevelt", "Republican", "1901-09-14", "1909-03-04", 42),
    (27, "William Howard Taft", "Republican", "1909-03-04", "1913-03-04", 51),
    (28, "Woodrow Wilson", "Democratic", "1913-03-04", "1921-03-04", 56),
    (29, "Warren G. Harding", "Republican", "1921-03-04", "1923-08-02", 55),
    (30, "Calvin Coolidge", "Republican", "1923-08-02", "1929-03-04", 51),
    (31, "Herbert Hoover", "Republican", "1929-03-04", "1933-03-04", 54),
    (32, "Franklin D. Roosevelt", "Democratic", "1933-03-04", "1945-04-12", 51),
    (33, "Harry S. Truman", "Democratic", "1945-04-12", "1953-01-20", 60),
    (34, "Dwight D. Eisenhower", "Republican", "1953-01-20", "1961-01-20", 62),
    (35, "John F. Kennedy", "Democratic", "1961-01-20", "1963-11-22", 43),
    (36, "Lyndon B. Johnson", "Democratic", "1963-11-22", "1969-01-20", 55),
    (37, "Richard Nixon", "Republican", "1969-01-20", "1974-08-09", 56),
    (38, "Gerald Ford", "Republican", "1974-08-09", "1977-01-20", 61),
    (39, "Jimmy Carter", "Democratic", "1977-01-20", "1981-01-20", 52),
    (40, "Ronald Reagan", "Republican", "1981-01-20", "1989-01-20", 69),
    (41, "George H. W. Bush", "Republican", "1989-01-20", "1993-01-20", 64),
    (42, "Bill Clinton", "Democratic", "1993-01-20", "2001-01-20", 46),
    (43, "George W. Bush", "Republican", "2001-01-20", "2009-01-20", 54),
    (44, "Barack Obama", "Democratic", "2009-01-20", "2017-01-20", 47),
    (45, "Donald Trump", "Republican", "2017-01-20", "2021-01-20", 70),
    (46, "Joe Biden", "Democratic", "2021-01-20", "2025-01-20", 78),
    (47, "Donald Trump", "Republican", "2025-01-20", None, 78),
]

ALIASES = {
    "george bush": "George H. W. Bush",
    "william j. clinton": "Bill Clinton",
    "william clinton": "Bill Clinton",
    "gerald r. ford": "Gerald Ford",
    "donald j. trump": "Donald Trump",
    "donald trump": "Donald Trump",
    "donald trump - i": "Donald Trump",
    "donald trump - ii": "Donald Trump",
    "joseph r. biden, jr.": "Joe Biden",
    "joseph r. biden jr": "Joe Biden",
    "joseph biden": "Joe Biden",
    "george w. bush": "George W. Bush",
    "george washington": "George Washington",
    "john adams": "John Adams",
    "thomas jefferson": "Thomas Jefferson",
    "james madison": "James Madison",
    "james monroe": "James Monroe",
    "john quincy adams": "John Quincy Adams",
    "andrew jackson": "Andrew Jackson",
    "martin van buren": "Martin Van Buren",
    "william henry harrison": "William Henry Harrison",
    "john tyler": "John Tyler",
    "james k. polk": "James K. Polk",
    "zachary taylor": "Zachary Taylor",
    "millard fillmore": "Millard Fillmore",
    "franklin pierce": "Franklin Pierce",
    "james buchanan": "James Buchanan",
    "abraham lincoln": "Abraham Lincoln",
    "andrew johnson": "Andrew Johnson",
    "ulysses s. grant": "Ulysses S. Grant",
    "rutherford b. hayes": "Rutherford B. Hayes",
    "james garfield": "James A. Garfield",
    "james a. garfield": "James A. Garfield",
    "chester arthur": "Chester A. Arthur",
    "chester a. arthur": "Chester A. Arthur",
    "grover cleveland": "Grover Cleveland",
    "grover cleveland - i": "Grover Cleveland",
    "grover cleveland - ii": "Grover Cleveland",
    "benjamin harrison": "Benjamin Harrison",
    "william mckinley": "William McKinley",
    "theodore roosevelt": "Theodore Roosevelt",
    "william howard taft": "William Howard Taft",
    "woodrow wilson": "Woodrow Wilson",
    "warren g. harding": "Warren G. Harding",
    "calvin coolidge": "Calvin Coolidge",
    "herbert hoover": "Herbert Hoover",
    "franklin d. roosevelt": "Franklin D. Roosevelt",
    "harry s. truman": "Harry S. Truman",
    "dwight d. eisenhower": "Dwight D. Eisenhower",
    "john f. kennedy": "John F. Kennedy",
    "lyndon b. johnson": "Lyndon B. Johnson",
    "richard nixon": "Richard Nixon",
    "jimmy carter": "Jimmy Carter",
    "ronald reagan": "Ronald Reagan",
    "barack obama": "Barack Obama",
}


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._table_stack: list[list[list[str]]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._table_stack.append([])
        elif tag == "tr" and self._table_stack:
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._row is not None and self._cell is not None:
            self._row.append(clean("".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._table_stack and self._row is not None:
            if any(cell for cell in self._row):
                self._table_stack[-1].append(self._row)
            self._row = None
        elif tag == "table" and self._table_stack:
            table = self._table_stack.pop()
            if table:
                self.tables.append(table)


def clean(value: str) -> str:
    value = html.unescape(value)
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def canonical_name(value: str) -> str | None:
    value = clean(value)
    value = re.sub(r"\([^)]*\)", "", value).strip()
    value = re.sub(r"[-–]\s*I{1,4}$", "", value).strip()
    key = value.lower().replace(".", "").replace(",", "").strip(" .")
    alias_key = key
    if alias_key in {k.replace(".", "").replace(",", ""): v for k, v in ALIASES.items()}:
        normalized_aliases = {k.replace(".", "").replace(",", ""): v for k, v in ALIASES.items()}
        return normalized_aliases[alias_key]
    return ALIASES.get(key)


def number(value: str) -> float | None:
    value = clean(value).replace(",", "").replace("%", "")
    if not value or value in {"TBD", "N/A"}:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def read_tables(path: Path) -> list[list[list[str]]]:
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser.tables


def ensure_url(path: Path, url: str) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=30) as response:
        path.write_bytes(response.read())


def parse_approval_sheet(path: Path) -> dict[str, Any]:
    rows = list(csv.DictReader(path.read_text(encoding="utf-8-sig").splitlines()))
    approvals = [number(row.get("Approving", "")) for row in rows]
    disapprovals = [number(row.get("Disapproving", "")) for row in rows]
    pairs = [(a, d, row) for a, d, row in zip(approvals, disapprovals, rows) if a is not None]
    if not pairs:
        return {}
    approving_values = [a for a, _d, _row in pairs]
    disapproving_values = [d for _a, d, _row in pairs if d is not None]
    latest = pairs[0]
    return {
        "pollCount": len(pairs),
        "approval_high": max(approving_values),
        "approval_low": min(approving_values),
        "approval_average": round(sum(approving_values) / len(approving_values), 2),
        "approval_final": latest[0],
        "disapproval_high": max(disapproving_values) if disapproving_values else None,
        "disapproval_low": min(disapproving_values) if disapproving_values else None,
        "approval_margin_final": latest[0] - latest[1] if latest[1] is not None else None,
        "approval_volatility": round(max(approving_values) - min(approving_values), 2),
        "approval_first_poll_start": rows[-1].get("Start Date"),
        "approval_final_poll_end": latest[2].get("End Date"),
    }


def build_approval_stats() -> dict[str, dict[str, Any]]:
    text = APPROVAL_PAGE.read_text(encoding="utf-8")
    titles = re.findall(r'"title":\{"text":"([^"]+) Approval Ratings"\}', text)
    links = re.findall(r"https://docs\.google\.com/spreadsheets/d/[^\"< ]+", text)

    stats: dict[str, dict[str, Any]] = {}
    gid_links = [link for link in links if "gid=" in link]
    for title, link in zip(titles, gid_links):
        gid = link.split("gid=")[-1].split("&")[0]
        out = APPROVAL_DIR / f"{gid}.csv"
        ensure_url(out, f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}/export?format=csv&gid={gid}")
        name = canonical_name(title)
        if name:
            stats[name] = parse_approval_sheet(out)

    # The current workbook default sheet exports Joe Biden's approval data.
    default_out = APPROVAL_DIR / "default.csv"
    ensure_url(default_out, f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}/export?format=csv")
    biden_stats = parse_approval_sheet(default_out)
    if biden_stats:
        stats["Joe Biden"] = biden_stats
    return stats


def build_executive_order_stats() -> dict[str, dict[str, Any]]:
    table = max(read_tables(EXECUTIVE_ORDERS_PAGE), key=len)
    totals: dict[str, dict[str, float]] = defaultdict(lambda: {"executive_orders_total": 0, "years_in_office_app": 0})
    for row in table:
        if len(row) < 5 or row[0] in {"President", "KEY:"}:
            continue
        name = canonical_name(row[0].replace("Total", "").strip())
        total = number(row[2] if len(row) > 2 else "")
        avg = number(row[3] if len(row) > 3 else "")
        years = number(row[4] if len(row) > 4 else "")
        if name and total is not None:
            totals[name]["executive_orders_total"] += total
            if years:
                totals[name]["years_in_office_app"] += years
            if avg is not None:
                totals[name]["executive_orders_avg_per_year_last_term"] = avg
    for name, values in totals.items():
        years = values.get("years_in_office_app")
        if years:
            values["executive_orders_avg_per_year"] = round(values["executive_orders_total"] / years, 2)
    return {k: dict(v) for k, v in totals.items()}


def build_election_stats() -> dict[str, dict[str, Any]]:
    years = sorted({int(match) for match in re.findall(r"/statistics/elections/(\d{4})", ELECTIONS_PAGE.read_text())})
    stats: dict[str, dict[str, Any]] = defaultdict(lambda: {
        "election_wins": 0,
        "electoral_votes_total": 0,
        "popular_votes_total": 0,
        "best_electoral_vote_pct": None,
        "best_popular_vote_pct": None,
        "election_years_won": [],
    })
    for year in years:
        path = SOURCE_DIR / f"elections-{year}.html"
        ensure_url(path, f"{APP_BASE}/statistics/elections/{year}")
        tables = read_tables(path)
        table = tables[0] if tables else []
        winner: tuple[str, float, float | None, float | None, float | None] | None = None
        for row in table:
            if not row or row[0] in {"Party", "Presidential"} or row[0].startswith("Last update"):
                continue
            if row[0] == "STATE":
                break
            if len(row) >= 8 and number(row[-4]) is not None:
                candidate_name = row[-6]
                electoral_votes = number(row[-4])
                electoral_pct = number(row[-3])
                popular_votes = number(row[-2])
                popular_pct = number(row[-1])
            elif len(row) >= 6 and number(row[-2]) is not None:
                candidate_name = row[-3]
                electoral_votes = number(row[-2])
                electoral_pct = number(row[-1])
                popular_votes = None
                popular_pct = None
            else:
                continue
            president = canonical_name(candidate_name)
            if not president or electoral_votes is None or electoral_votes <= 0:
                continue
            if winner is None or electoral_votes > winner[1]:
                winner = (president, electoral_votes, electoral_pct, popular_votes, popular_pct)
        if winner:
            president, electoral_votes, electoral_pct, popular_votes, popular_pct = winner
            current = stats[president]
            current["election_wins"] += 1
            current["electoral_votes_total"] += electoral_votes
            current["popular_votes_total"] += popular_votes or 0
            current["election_years_won"].append(year)
            if electoral_pct is not None:
                best = current["best_electoral_vote_pct"]
                current["best_electoral_vote_pct"] = electoral_pct if best is None else max(best, electoral_pct)
            if popular_pct is not None:
                best = current["best_popular_vote_pct"]
                current["best_popular_vote_pct"] = popular_pct if best is None else max(best, popular_pct)
    return {k: dict(v) for k, v in stats.items()}


def stat_claim(value: Any, unit: str, source: str, url: str, note: str | None = None) -> dict[str, Any] | None:
    if value is None:
        return None
    claim = {"value": value, "unit": unit, "source": {"name": source, "url": url}}
    if note:
        claim["note"] = note
    return claim


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    approvals = build_approval_stats()
    executive_orders = build_executive_order_stats()
    elections = build_election_stats()

    grouped: dict[str, dict[str, Any]] = {}
    for number_, name, party, start, end, age in PRESIDENTS:
        item = grouped.setdefault(
            name,
            {
                "id": f"president:{slugify(name)}",
                "domain": "presidents",
                "name": name,
                "party": party,
                "presidencyNumbers": [],
                "terms": [],
                "ageAtFirstInauguration": age,
            },
        )
        item["presidencyNumbers"].append(number_)
        item["terms"].append({"number": number_, "start": start, "end": end})
        item["ageAtFirstInauguration"] = min(item["ageAtFirstInauguration"], age)

    items: list[dict[str, Any]] = []
    missing_sources: Counter[str] = Counter()
    for name, item in grouped.items():
        stats: dict[str, Any] = {}
        app_approval = approvals.get(name, {})
        eo = executive_orders.get(name, {})
        election = elections.get(name, {})

        source_approval = ("The American Presidency Project / Gallup approval sheets", "https://www.presidency.ucsb.edu/statistics/data/presidential-job-approval")
        source_eo = ("The American Presidency Project Executive Orders", "https://www.presidency.ucsb.edu/statistics/data/executive-orders")
        source_elections = ("The American Presidency Project Elections", "https://www.presidency.ucsb.edu/statistics/elections")

        for key, unit in [
            ("approval_high", "%"),
            ("approval_low", "%"),
            ("approval_average", "%"),
            ("approval_final", "%"),
            ("disapproval_high", "%"),
            ("approval_margin_final", "points"),
            ("approval_volatility", "points"),
        ]:
            claim = stat_claim(app_approval.get(key), unit, *source_approval)
            if claim:
                stats[key] = claim
        for key, unit in [
            ("executive_orders_total", "orders"),
            ("executive_orders_avg_per_year", "orders/year"),
            ("years_in_office_app", "years"),
        ]:
            claim = stat_claim(round(eo.get(key), 2) if isinstance(eo.get(key), float) else eo.get(key), unit, *source_eo)
            if claim:
                stats[key] = claim
        for key, unit in [
            ("election_wins", "wins"),
            ("electoral_votes_total", "electoral votes"),
            ("popular_votes_total", "votes"),
            ("best_electoral_vote_pct", "%"),
            ("best_popular_vote_pct", "%"),
        ]:
            claim = stat_claim(election.get(key), unit, *source_elections)
            if claim:
                stats[key] = claim

        stats["age_at_first_inauguration"] = stat_claim(
            item["ageAtFirstInauguration"],
            "years",
            "White House / historical presidential records",
            "https://www.whitehouse.gov/about-the-white-house/presidents/",
        )
        item["stats"] = stats
        item["sourceCoverage"] = {
            "approval": name in approvals,
            "executiveOrders": name in executive_orders,
            "elections": name in elections,
        }
        for source_name, present in item["sourceCoverage"].items():
            if not present:
                missing_sources[source_name] += 1
        items.append(item)

    items.sort(key=lambda item: min(item["presidencyNumbers"]))
    payload = {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "domain": "presidents",
            "source": "American Presidency Project plus static president identity table",
            "items": len(items),
            "statKeys": sorted({key for item in items for key in item["stats"]}),
            "missingSourceCoverage": missing_sources.most_common(),
            "notes": [
                "Grover Cleveland and Donald Trump are single people records with multiple presidency numbers.",
                "Approval stats cover only presidents present in APP's Gallup approval workbook.",
                "Trump second-term executive-order totals are current through APP's June 20, 2026 table snapshot.",
            ],
        },
        "items": items,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(payload["metadata"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

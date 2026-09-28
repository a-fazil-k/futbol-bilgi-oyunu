#!/usr/bin/env python3
"""Add one national-team/citizenship country to every cached player.

Country priority:
1. Senior current/former international team
2. First Transfermarkt citizenship
3. Country of birth

The process is resumable. Profile results are stored in the existing SQLite
cache and completed profiles are skipped on later runs.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import re
import sqlite3
import sys
import time

from lxml import html
import requests

try:
    from .transfermarkt_league_players import (
        DEFAULT_CACHE_FILE,
        DEFAULT_OUTPUT_FILE,
        _build_output,
        _connect_cache,
        _load_club_seasons,
        _read_cached_rosters,
        _session,
    )
    from .transfermarkt_query import BASE_URL, TIMEOUT_SECONDS
except ImportError:
    from transfermarkt_league_players import (
        DEFAULT_CACHE_FILE,
        DEFAULT_OUTPUT_FILE,
        _build_output,
        _connect_cache,
        _load_club_seasons,
        _read_cached_rosters,
        _session,
    )
    from transfermarkt_query import BASE_URL, TIMEOUT_SECONDS


YOUTH_NATIONAL_TEAM = re.compile(
    r"(?:\bU[- ]?\d{2}\b|\bU\d{2}\b|Olympic|Youth|\bB$)",
    re.IGNORECASE,
)


def _initialize_country_cache(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS player_countries (
            player_id TEXT PRIMARY KEY,
            country TEXT,
            source TEXT NOT NULL
        )
        """
    )
    connection.commit()


def _cached_player_ids(connection: sqlite3.Connection) -> set[str]:
    player_ids = set()
    for players_json, in connection.execute("SELECT players_json FROM club_rosters"):
        player_ids.update(json.loads(players_json))
    return player_ids


def _first(values: list[str]) -> str | None:
    return next((value.strip() for value in values if value.strip()), None)


def _parse_profile_country(content: bytes) -> tuple[str | None, str]:
    tree = html.fromstring(content)
    uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    lowercase = "abcdefghijklmnopqrstuvwxyz"
    international_nodes = tree.xpath(
        "//li[contains(@class,'data-header__label')]"
        f"[contains(translate(normalize-space(.),'{uppercase}','{lowercase}'),'international:')]"
    )
    for node in international_nodes:
        international = _first(
            node.xpath(
                ".//span[contains(@class,'data-header__content')]"
                "//a/@title | "
                ".//span[contains(@class,'data-header__content')]//a/text()"
            )
        )
        if international and not YOUTH_NATIONAL_TEAM.search(international):
            return international, "senior_international"

    citizenship = _first(
        tree.xpath("//span[@itemprop='nationality']//img/@title")
    )
    if citizenship:
        return citizenship, "citizenship"

    birth_country = _first(
        tree.xpath(
            "//li[contains(@class,'data-header__label')]"
            "[contains(normalize-space(.),'Place of birth:')]//img/@title"
        )
    )
    if birth_country:
        return birth_country, "birth_country"
    return None, "not_available"


def _fetch_player_country(
    player_id: str,
    delay_seconds: float,
) -> tuple[str, str | None, str]:
    if delay_seconds:
        time.sleep(delay_seconds)
    response = _session().get(
        f"{BASE_URL}/-/profil/spieler/{player_id}",
        timeout=TIMEOUT_SECONDS,
    )
    if response.status_code == 404:
        return player_id, None, "profile_not_found"
    response.raise_for_status()
    country, source = _parse_profile_country(response.content)
    return player_id, country, source


def _collect_countries(
    connection: sqlite3.Connection,
    player_ids: set[str],
    workers: int,
    delay_seconds: float,
) -> dict[str, str | None]:
    cached = {
        player_id: country
        for player_id, country in connection.execute(
            "SELECT player_id, country FROM player_countries"
        )
        if player_id in player_ids
    }
    missing = sorted(player_ids - cached.keys(), key=int)
    if not missing:
        return cached

    print(f"Fetching {len(missing)} uncached player profiles...", file=sys.stderr)
    batch_size = workers * 10
    completed = 0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        for batch_start in range(0, len(missing), batch_size):
            batch = missing[batch_start : batch_start + batch_size]
            futures = {
                executor.submit(_fetch_player_country, player_id, delay_seconds): player_id
                for player_id in batch
            }
            rate_blocked = False
            for future in as_completed(futures):
                completed += 1
                try:
                    player_id, country, source = future.result()
                except requests.HTTPError as error:
                    if error.response is not None and error.response.status_code in (403, 405):
                        rate_blocked = True
                    continue

                cached[player_id] = country
                connection.execute(
                    "INSERT OR REPLACE INTO player_countries VALUES (?, ?, ?)",
                    (player_id, country, source),
                )

            connection.commit()
            print(f"Player profiles: {completed}/{len(missing)}", file=sys.stderr)
            if rate_blocked:
                raise RuntimeError(
                    "Transfermarkt returned HTTP 403/405 (temporary IP rate block). "
                    "Wait or continue from a different normal network; cached profiles are preserved."
                )
    return cached


def _write_output(
    connection: sqlite3.Connection,
    countries: dict[str, str | None],
    output_file: Path,
) -> int:
    club_seasons = _load_club_seasons(
        connection,
        1997,
        2026,
        workers=1,
        fetch_missing=False,
    )
    rosters = _read_cached_rosters(connection, club_seasons)
    output = _build_output(club_seasons, rosters, countries)
    temporary_output = output_file.with_suffix(output_file.suffix + ".tmp")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    temporary_output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_output.replace(output_file)
    return len(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_FILE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE)
    parser.add_argument(
        "--export-cached",
        action="store_true",
        help="Write current cached countries without network requests",
    )
    args = parser.parse_args()

    if not 1 <= args.workers <= 4:
        parser.error("--workers must be between 1 and 4")
    if args.delay < 0:
        parser.error("--delay cannot be negative")

    connection = _connect_cache(args.cache)
    try:
        _initialize_country_cache(connection)
        player_ids = _cached_player_ids(connection)
        if args.export_cached:
            countries = {
                player_id: country
                for player_id, country in connection.execute(
                    "SELECT player_id, country FROM player_countries"
                )
            }
        else:
            countries = _collect_countries(
                connection,
                player_ids,
                args.workers,
                args.delay,
            )
        count = _write_output(connection, countries, args.output)
    finally:
        connection.close()

    available = sum(country is not None for country in countries.values())
    print(
        f"Wrote {count} players; countries available for {available}/{len(player_ids)}.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Collect 30-season player histories for every configured Transfermarkt league.

The script caches every league-season and club-season response in SQLite, so an
interrupted run can be resumed without downloading completed pages again.

Example:
    python scripts/transfermarkt_league_players.py \
      --start-season 1997 \
      --end-season 2026 \
      --output db/transfermarkt-all-leagues-players-last-30-seasons.json
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import sqlite3
import sys
import threading

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from .transfermarkt_query import (
        BASE_URL,
        HEADERS,
        LEAGUES_FILE,
        TIMEOUT_SECONDS,
        _id_from_url,
        get_competition_clubs,
        load_leagues,
    )
except ImportError:
    from transfermarkt_query import (
        BASE_URL,
        HEADERS,
        LEAGUES_FILE,
        TIMEOUT_SECONDS,
        _id_from_url,
        get_competition_clubs,
        load_leagues,
    )


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CLUBS_FILE = PROJECT_ROOT / "db" / "transfermarkt-all-leagues-last-30-seasons.json"
DEFAULT_OUTPUT_FILE = (
    PROJECT_ROOT / "db" / "transfermarkt-all-leagues-players-last-30-seasons.json"
)
DEFAULT_CACHE_FILE = PROJECT_ROOT / ".cache" / "transfermarkt-league-players.sqlite3"
_thread_local = threading.local()


def _session() -> requests.Session:
    if not hasattr(_thread_local, "session"):
        retry = Retry(
            total=5,
            connect=5,
            read=5,
            status=5,
            backoff_factor=1,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=1, pool_maxsize=1)
        client = requests.Session()
        client.headers.update(HEADERS)
        client.mount("https://", adapter)
        _thread_local.session = client
    return _thread_local.session


def _connect_cache(cache_file: Path) -> sqlite3.Connection:
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(cache_file)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS league_seasons (
            competition_id TEXT NOT NULL,
            season INTEGER NOT NULL,
            clubs_json TEXT NOT NULL,
            PRIMARY KEY (competition_id, season)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS club_rosters (
            club_id TEXT NOT NULL,
            season INTEGER NOT NULL,
            players_json TEXT NOT NULL,
            PRIMARY KEY (club_id, season)
        )
        """
    )
    return connection


def _fetch_league_season(competition_id: str, season: int) -> tuple[str, int, dict[str, str]]:
    clubs = get_competition_clubs(competition_id, season, _session())
    return competition_id, season, clubs


def _load_club_seasons(
    connection: sqlite3.Connection,
    start_season: int,
    end_season: int,
    workers: int,
    fetch_missing: bool = True,
) -> dict[tuple[str, int], str]:
    leagues = load_leagues(LEAGUES_FILE)
    cached = {
        (competition_id, season): json.loads(clubs_json)
        for competition_id, season, clubs_json in connection.execute(
            "SELECT competition_id, season, clubs_json FROM league_seasons"
        )
        if start_season <= season <= end_season
    }
    missing = [
        (competition_id, season)
        for competition_id in leagues.values()
        for season in range(start_season, end_season + 1)
        if (competition_id, season) not in cached
    ]

    if missing and fetch_missing:
        print(f"Fetching {len(missing)} uncached league-season pages...", file=sys.stderr)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(_fetch_league_season, competition_id, season): (
                    competition_id,
                    season,
                )
                for competition_id, season in missing
            }
            for completed, future in enumerate(as_completed(futures), start=1):
                competition_id, season, clubs = future.result()
                cached[(competition_id, season)] = clubs
                connection.execute(
                    "INSERT OR REPLACE INTO league_seasons VALUES (?, ?, ?)",
                    (competition_id, season, json.dumps(clubs, ensure_ascii=False)),
                )
                if completed % 25 == 0:
                    connection.commit()
                    print(
                        f"League seasons: {completed}/{len(missing)}",
                        file=sys.stderr,
                    )
        connection.commit()

    allowed_clubs = {
        club
        for clubs in json.loads(DEFAULT_CLUBS_FILE.read_text(encoding="utf-8")).values()
        for club in clubs
    }
    # Deduplicate clubs that appeared in more than one configured competition
    # in the same season.
    club_seasons = {}
    for (_, season), clubs in cached.items():
        for club_id, club_name in clubs.items():
            if club_name in allowed_clubs:
                club_seasons[(club_id, season)] = club_name
    return club_seasons


def _read_cached_rosters(
    connection: sqlite3.Connection,
    club_seasons: dict[tuple[str, int], str],
) -> dict[tuple[str, int], dict[str, str]]:
    return {
        (club_id, season): json.loads(players_json)
        for club_id, season, players_json in connection.execute(
            "SELECT club_id, season, players_json FROM club_rosters"
        )
        if (club_id, season) in club_seasons
    }


def _fetch_club_roster(club_id: str, season: int) -> tuple[str, int, dict[str, str]]:
    response = _session().get(
        f"{BASE_URL}/-/kader/verein/{club_id}/saison_id/{season}/plus/1",
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    from lxml import html

    tree = html.fromstring(response.content)
    links = tree.xpath(
        "//table[contains(@class,'items')]//tbody"
        "//a[contains(@href,'/profil/spieler/')]"
    )
    players = {}
    for link in links:
        player_id = _id_from_url(link.get("href", ""), "spieler")
        name = (link.get("title") or link.text_content()).strip()
        if player_id and name:
            players[player_id] = name

    if not 10 <= len(players) <= 100:
        raise ValueError(
            f"Unexpected player count for club {club_id}, season {season}: {len(players)}"
        )
    return club_id, season, players


def _load_rosters(
    connection: sqlite3.Connection,
    club_seasons: dict[tuple[str, int], str],
    workers: int,
) -> dict[tuple[str, int], dict[str, str]]:
    cached = _read_cached_rosters(connection, club_seasons)
    missing = [key for key in club_seasons if key not in cached]
    if not missing:
        return cached

    print(f"Fetching {len(missing)} uncached club-season rosters...", file=sys.stderr)
    failures = []
    completed = 0
    batch_size = workers * 10
    with ThreadPoolExecutor(max_workers=workers) as executor:
        for batch_start in range(0, len(missing), batch_size):
            batch = missing[batch_start : batch_start + batch_size]
            futures = {
                executor.submit(_fetch_club_roster, club_id, season): (club_id, season)
                for club_id, season in batch
            }
            rate_blocked = False
            for future in as_completed(futures):
                key = futures[future]
                completed += 1
                try:
                    club_id, season, players = future.result()
                except requests.HTTPError as error:
                    if error.response is not None and error.response.status_code == 405:
                        rate_blocked = True
                    failures.append((key, str(error)))
                except Exception as error:
                    failures.append((key, str(error)))
                else:
                    cached[(club_id, season)] = players
                    connection.execute(
                        "INSERT OR REPLACE INTO club_rosters VALUES (?, ?, ?)",
                        (club_id, season, json.dumps(players, ensure_ascii=False)),
                    )

            connection.commit()
            print(f"Club rosters: {completed}/{len(missing)}", file=sys.stderr)
            if rate_blocked:
                raise RuntimeError(
                    "Transfermarkt returned HTTP 405 (temporary rate block). "
                    "Wait before running the same command again; cached pages are preserved."
                )

    if failures:
        samples = "; ".join(f"{key}: {error}" for key, error in failures[:10])
        raise RuntimeError(
            f"{len(failures)} roster pages failed. Run the command again to resume. {samples}"
        )
    return cached


def _build_output(
    club_seasons: dict[tuple[str, int], str],
    rosters: dict[tuple[str, int], dict[str, str]],
) -> list[dict]:
    players = {}
    for key, club_name in club_seasons.items():
        for player_id, player_name in rosters.get(key, {}).items():
            player = players.setdefault(
                player_id,
                {"player_name": player_name, "clubs_played": set()},
            )
            player["player_name"] = player_name
            player["clubs_played"].add(club_name)

    output = [
        {
            "player_name": player["player_name"],
            "clubs_played": sorted(player["clubs_played"], key=str.casefold),
        }
        for player in players.values()
    ]
    output.sort(key=lambda player: player["player_name"].casefold())
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-season", type=int, default=1997)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE_FILE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE)
    parser.add_argument(
        "--export-cached",
        action="store_true",
        help="Write a partial JSON from cached pages without making network requests",
    )
    args = parser.parse_args()

    if args.start_season > args.end_season:
        parser.error("--start-season cannot be later than --end-season")
    if not 1 <= args.workers <= 12:
        parser.error("--workers must be between 1 and 12")

    connection = _connect_cache(args.cache)
    try:
        club_seasons = _load_club_seasons(
            connection,
            args.start_season,
            args.end_season,
            args.workers,
            fetch_missing=not args.export_cached,
        )
        print(f"Unique club-season tasks: {len(club_seasons)}", file=sys.stderr)
        if args.export_cached:
            rosters = _read_cached_rosters(connection, club_seasons)
            print(
                f"Exporting cached rosters: {len(rosters)}/{len(club_seasons)}",
                file=sys.stderr,
            )
        else:
            rosters = _load_rosters(connection, club_seasons, args.workers)
        output = _build_output(club_seasons, rosters)
    finally:
        connection.close()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary_output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_output.replace(args.output)
    print(f"Wrote {len(output)} players to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()

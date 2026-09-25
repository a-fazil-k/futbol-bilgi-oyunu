#!/usr/bin/env python3
"""Query player career clubs and club squads from Transfermarkt.

Dependencies:
    python -m pip install requests lxml

Examples:
    python scripts/transfermarkt_query.py search-player "ronaldo"
    python scripts/transfermarkt_query.py player "Cristiano Ronaldo"
    python scripts/transfermarkt_query.py club "Barcelona"
    python scripts/transfermarkt_query.py club "Barcelona" --season 2020
    python scripts/transfermarkt_query.py leagues
    python scripts/transfermarkt_query.py league "Süper Lig" --start-season 2017 --end-season 2026
    python scripts/transfermarkt_query.py big-five --start-season 1997 --end-season 2026
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import re
import sys
from typing import Optional
import unicodedata

try:
    import requests
    from lxml import html
except ImportError:
    sys.exit("Missing dependencies. Run: python -m pip install requests lxml")


BASE_URL = "https://www.transfermarkt.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/113.0.0.0 Safari/537.36"
    )
}
TIMEOUT_SECONDS = 20
LEAGUES_FILE = Path(__file__).resolve().parents[1] / "db" / "transfermarkt-leagues.json"
BIG_FIVE_LEAGUE_NAMES = ("Premier League", "LaLiga", "Bundesliga", "Serie A", "Ligue 1")

# Transfermarkt abbreviates some team names. Extend this map for your database.
CLUB_ALIASES = {
    "Al-Nassr": "Al Nassr",
    "Man Utd": "Manchester United",
    "Miami": "Inter Miami",
    "PSG": "Paris Saint-Germain",
    "Sporting": "Sporting CP",
}

DEVELOPMENT_TEAM = re.compile(
    r"(?:Youth|Yth\.?|JV|Reserves?|U\d{2}|Sub-\d+|\bII\b| [BC])$",
    re.IGNORECASE,
)

session = requests.Session()
session.headers.update(HEADERS)


def _get(url: str, **kwargs) -> requests.Response:
    response = session.get(url, timeout=TIMEOUT_SECONDS, **kwargs)
    response.raise_for_status()
    return response


def _get_tree(url: str, **kwargs):
    return html.fromstring(_get(url, **kwargs).content)


def _id_from_url(url: str, resource: str) -> Optional[str]:
    match = re.search(rf"/{resource}/(\d+)", url or "")
    return match.group(1) if match else None


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _normalize_club(name: str) -> str:
    return CLUB_ALIASES.get(name.strip(), name.strip())


def _clean_competition_club(name: str) -> str:
    return re.sub(r"\s*\(-\s*\d{4}\)\s*$", "", name).strip()


def _normalize_lookup(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold().strip())
    return "".join(character for character in normalized if not unicodedata.combining(character))


def load_leagues(leagues_file: Path = LEAGUES_FILE) -> dict[str, str]:
    """Load the league-name to Transfermarkt-code catalog."""
    try:
        data = json.loads(leagues_file.read_text(encoding="utf-8"))
    except OSError as error:
        raise ValueError(f"League catalog could not be read: {leagues_file}") from error

    if not isinstance(data, dict) or not data:
        raise ValueError(f"League catalog must be a non-empty JSON object: {leagues_file}")
    if not all(isinstance(name, str) and isinstance(code, str) for name, code in data.items()):
        raise ValueError("Every league catalog entry must contain a string name and code")

    normalized_names = [_normalize_lookup(name) for name in data]
    if len(normalized_names) != len(set(normalized_names)):
        raise ValueError("League catalog contains ambiguous names after normalization")
    return data


def resolve_league(league_name: str, leagues_file: Path = LEAGUES_FILE) -> tuple[str, str]:
    """Resolve a user-provided league name from the JSON catalog."""
    leagues = load_leagues(leagues_file)
    requested = _normalize_lookup(league_name)
    for name, code in leagues.items():
        if _normalize_lookup(name) == requested:
            return name, code

    available = ", ".join(leagues)
    raise ValueError(
        f"League '{league_name}' was not found in {leagues_file.name}. "
        f"Available leagues: {available}"
    )


def _best_match(results: list[dict], query: str, item_type: str) -> dict:
    if not results:
        raise LookupError(f"No {item_type} found for query: {query}")

    normalized_query = query.casefold().strip()
    return next(
        (result for result in results if result["name"].casefold() == normalized_query),
        results[0],
    )


def search_players(query: str, page: int = 1) -> list[dict[str, str]]:
    """Return only Transfermarkt IDs and names matching a player-name query."""
    tree = _get_tree(
        f"{BASE_URL}/schnellsuche/ergebnis/schnellsuche",
        params={"query": query, "Spieler_page": page},
    )
    rows = tree.xpath(
        "//div[contains(@class,'box')][h2[contains(translate(.,"
        "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'players')]]"
        "//tbody//tr"
    )

    players = []
    for row in rows:
        links = row.xpath(".//td[contains(@class,'hauptlink')]//a[contains(@href,'/spieler/')]")
        if not links:
            continue
        player_id = _id_from_url(links[0].get("href", ""), "spieler")
        name = (links[0].get("title") or links[0].text_content()).strip()
        if player_id and name:
            players.append({"id": player_id, "name": name})

    return _unique_dicts(players)


def _unique_dicts(values: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for value in values:
        key = tuple(value.items())
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def _youth_clubs(player_id: str) -> list[str]:
    tree = _get_tree(f"{BASE_URL}/-/transfers/spieler/{player_id}")
    text_parts = tree.xpath(
        "//div[contains(@class,'tm-player-additional-data')]"
        "[descendant::*[contains(translate(.,'YOUTH','youth'),'youth')]]"
        "//div[contains(@class,'content')]//text()"
    )
    text = " ".join(part.strip() for part in text_parts if part.strip())
    clubs = []
    for item in text.split(","):
        # Example: "Newell's Old Boys (1995-2000)"
        name = re.sub(r"\s*\([^)]*\)\s*$", "", item).strip()
        if name:
            clubs.append(_normalize_club(name))
    return _unique(clubs)


def get_player(query: str, include_youth: bool = True) -> dict:
    """Return {"name": ..., "clubs": [...]} for the best player-name match."""
    player = _best_match(search_players(query), query, "player")
    response = _get(f"{BASE_URL}/ceapi/transferHistory/list/{player['id']}")
    transfers = response.json().get("transfers", [])

    clubs = _youth_clubs(player["id"]) if include_youth else []
    for transfer in reversed(transfers):
        for side in ("from", "to"):
            name = transfer.get(side, {}).get("clubName", "").strip()
            if not name or name == "Without Club" or DEVELOPMENT_TEAM.search(name):
                continue
            clubs.append(_normalize_club(name))

    return {"name": player["name"], "clubs": _unique(clubs)}


def search_clubs(query: str, page: int = 1) -> list[dict[str, str]]:
    """Return only Transfermarkt IDs and names matching a club-name query."""
    tree = _get_tree(
        f"{BASE_URL}/schnellsuche/ergebnis/schnellsuche",
        params={"query": query, "Verein_page": page},
    )
    links = tree.xpath(
        "//div[contains(@class,'box')][h2[contains(translate(.,"
        "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'clubs')]]"
        "//td[contains(@class,'hauptlink')]//a[contains(@href,'/verein/')]"
    )

    clubs = []
    for link in links:
        club_id = _id_from_url(link.get("href", ""), "verein")
        name = (link.get("title") or link.text_content()).strip()
        if club_id and name:
            clubs.append({"id": club_id, "name": name})
    return _unique_dicts(clubs)


def get_players_by_club(club_query: str, season: Optional[int] = None) -> list[str]:
    """Return player names in a club's current or requested season squad."""
    club = _best_match(search_clubs(club_query), club_query, "club")
    url = f"{BASE_URL}/-/kader/verein/{club['id']}"
    if season is not None:
        url += f"/saison_id/{season}"
    url += "/plus/1"

    tree = _get_tree(url)
    names = tree.xpath(
        "//table[contains(@class,'items')]//td[contains(@class,'hauptlink')]"
        "//a[contains(@href,'/profil/spieler/')]/text()"
    )
    return _unique([name.strip() for name in names])


def get_competition_clubs(competition_id: str, season: int, client=session) -> dict[str, str]:
    """Return {Transfermarkt club ID: club name} for one competition season."""
    response = client.get(
        f"{BASE_URL}/-/startseite/wettbewerb/{competition_id}/plus/",
        params={"saison_id": season},
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    tree = html.fromstring(response.content)
    links = tree.xpath(
        "//td[contains(@class,'hauptlink') and contains(@class,'no-border-links')]"
        "//a[contains(@href,'/verein/')][1]"
    )

    clubs = {}
    for link in links:
        club_id = _id_from_url(link.get("href", ""), "verein")
        name = _clean_competition_club(link.get("title") or link.text_content())
        if club_id and name:
            clubs[club_id] = name
    if not 8 <= len(clubs) <= 32:
        raise ValueError(
            f"Unexpected club count for {competition_id}, season {season}: {len(clubs)}"
        )
    return clubs


def _get_league_history(competition_id: str, start_season: int, end_season: int) -> list[str]:
    client = requests.Session()
    client.headers.update(HEADERS)
    clubs_by_id = {}
    try:
        for season in range(start_season, end_season + 1):
            clubs_by_id.update(get_competition_clubs(competition_id, season, client))
    finally:
        client.close()
    return sorted(clubs_by_id.values(), key=str.casefold)


def get_league_clubs(league_name: str, start_season: int, end_season: int) -> dict[str, list[str]]:
    """Resolve a league name from JSON and return its unique clubs over a season range."""
    if start_season > end_season:
        raise ValueError("start_season cannot be later than end_season")
    canonical_name, competition_id = resolve_league(league_name)
    clubs = _get_league_history(competition_id, start_season, end_season)
    return {canonical_name: clubs}


def get_big_five_clubs(start_season: int, end_season: int) -> dict[str, list[str]]:
    """Return unique clubs from the Big Five leagues over an inclusive season range."""
    if start_season > end_season:
        raise ValueError("start_season cannot be later than end_season")

    league_catalog = load_leagues()
    leagues = {name: league_catalog[name] for name in BIG_FIVE_LEAGUE_NAMES}
    results = {}
    with ThreadPoolExecutor(max_workers=len(leagues)) as executor:
        futures = {
            executor.submit(_get_league_history, competition_id, start_season, end_season): league_name
            for league_name, competition_id in leagues.items()
        }
        for future in as_completed(futures):
            league_name = futures[future]
            results[league_name] = future.result()
            print(f"{league_name}: {len(results[league_name])} clubs", file=sys.stderr)

    return {league_name: results[league_name] for league_name in leagues}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    player_search = commands.add_parser("search-player", help="Search player names")
    player_search.add_argument("query")

    player = commands.add_parser("player", help="Get one player's career clubs")
    player.add_argument("query")
    player.add_argument("--senior-only", action="store_true")

    club = commands.add_parser("club", help="Get player names in a club squad")
    club.add_argument("query")
    club.add_argument("--season", type=int, help="Season start year, for example 2020")

    commands.add_parser("leagues", help="List available league names and Transfermarkt codes")

    league = commands.add_parser("league", help="Get clubs by a league name from the JSON catalog")
    league.add_argument("name", help='League name from the catalog, for example "Süper Lig"')
    league.add_argument("--start-season", type=int, required=True)
    league.add_argument("--end-season", type=int, required=True)
    league.add_argument("--output", help="Write JSON to this file instead of stdout")

    big_five = commands.add_parser("big-five", help="Get unique Big Five clubs over a season range")
    big_five.add_argument("--start-season", type=int, default=1997)
    big_five.add_argument("--end-season", type=int, default=2026)
    big_five.add_argument("--output", help="Write JSON to this file instead of stdout")

    args = parser.parse_args()
    try:
        if args.command == "search-player":
            output = [player["name"] for player in search_players(args.query)]
        elif args.command == "player":
            output = get_player(args.query, include_youth=not args.senior_only)
        elif args.command == "club":
            output = get_players_by_club(args.query, args.season)
        elif args.command == "leagues":
            output = load_leagues()
        elif args.command == "league":
            output = get_league_clubs(args.name, args.start_season, args.end_season)
        else:
            output = get_big_five_clubs(args.start_season, args.end_season)

        serialized = json.dumps(output, ensure_ascii=False, indent=2)
        if getattr(args, "output", None):
            with open(args.output, "w", encoding="utf-8") as output_file:
                output_file.write(serialized + "\n")
        else:
            print(serialized)
    except (requests.RequestException, LookupError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()

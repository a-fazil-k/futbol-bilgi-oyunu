#!/usr/bin/env python3
"""Query player career clubs and club squads from Transfermarkt.

Dependencies:
    python -m pip install requests lxml

Examples:
    python scripts/transfermarkt_query.py search-player "ronaldo"
    python scripts/transfermarkt_query.py player "Cristiano Ronaldo"
    python scripts/transfermarkt_query.py club "Barcelona"
    python scripts/transfermarkt_query.py club "Barcelona" --season 2020
"""

import argparse
import json
import re
import sys
from typing import Optional

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

    args = parser.parse_args()
    try:
        if args.command == "search-player":
            output = [player["name"] for player in search_players(args.query)]
        elif args.command == "player":
            output = get_player(args.query, include_youth=not args.senior_only)
        else:
            output = get_players_by_club(args.query, args.season)
        print(json.dumps(output, ensure_ascii=False, indent=2))
    except (requests.RequestException, LookupError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()

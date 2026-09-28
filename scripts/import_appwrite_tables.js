#!/usr/bin/env node
// Appwrite TablesDB importer for Transfermarkt JSON files.
// clubs.club_name / clubs.leagues come from the league JSON.
// footballPlayers.player_clubs stores the related clubs row IDs, not club names.

require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Client, TablesDB, Query } = require("node-appwrite");

const ROOT = path.join(__dirname, "..");
const PLAYERS_JSON = path.join(
  ROOT,
  "db",
  "transfermarkt-all-leagues-players-last-30-seasons.json"
);
const CLUBS_JSON = path.join(
  ROOT,
  "db",
  "transfermarkt-all-leagues-last-30-seasons.json"
);
const PROGRESS_PATH = path.join(ROOT, ".cache", "appwrite-import-progress.json");

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "6ab635d20002717b9c3f";
const DATABASE_ID_ENV = process.env.APPWRITE_DATABASE_ID || "";
const PLAYERS_TABLE_ENV = process.env.APPWRITE_TABLE_PLAYERS || "";
const CLUBS_TABLE_ENV = process.env.APPWRITE_TABLE_CLUBS || "";
let DATABASE_ID = "";
let PLAYERS_TABLE_ID = "";
let CLUBS_TABLE_ID = "";
const BATCH_SIZE = Math.min(Number(process.env.APPWRITE_BATCH_SIZE || 50), 100);
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number((process.argv.find((arg) => arg.startsWith("--limit=")) || "").split("=")[1] || 0);

const NAME_KEYS = ["club_name", "name", "club", "team", "team_name"];
const LEAGUE_KEYS = ["leagues", "league", "league_name", "lig", "lig_adi", "lig_adı"];
const CLUB_NAME_ALIASES = {
  Barcelona: "FC Barcelona",
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} eksik. .env dosyasına ekle; değeri koda yazma.`);
  }
  return value;
}

function rowId(prefix, value) {
  const hash = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${prefix}${hash}`;
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
  } catch (_error) {
    return { clubs: 0, players: 0 };
  }
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function canonicalClubName(name) {
  const text = String(name || "").trim();
  return CLUB_NAME_ALIASES[text] || text;
}

function loadClubsByName() {
  const byLeague = JSON.parse(fs.readFileSync(CLUBS_JSON, "utf8"));
  const byName = new Map();
  for (const [league, clubs] of Object.entries(byLeague)) {
    for (const club of clubs) {
      const clubName = canonicalClubName(club);
      if (!clubName) continue;
      if (!byName.has(clubName)) byName.set(clubName, []);
      const leagues = byName.get(clubName);
      if (!leagues.includes(league)) leagues.push(league);
    }
  }
  return byName;
}

function loadPlayerSources() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_JSON, "utf8"));
  return players.map((player) => ({
    player_name: String(player.player_name || "").trim(),
    clubNames: uniqueStrings(player.clubs_played || player.player_clubs || []).map(canonicalClubName),
  })).filter((player) => player.player_name && player.clubNames.length > 0);
}

function pickColumn(columns, candidates) {
  const keys = new Set(columns.map((column) => column.key));
  const key = candidates.find((candidate) => keys.has(candidate));
  return columns.find((column) => column.key === key) || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(label, fn) {
  let delay = 1000;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const code = error.code || error.status;
      const retryable = code === 429 || code === 503 || code === 500;
      if (!retryable || attempt === 8) {
        throw new Error(`${label}: ${error.message || error}`);
      }
      console.warn(`${label}: ${code}, ${delay}ms sonra tekrar`);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
  return undefined;
}

async function resolveTargets(tablesDB) {
  const databaseList = await tablesDB.list();
  const databases = databaseList.databases || [];
  const configuredDatabase = databases.find((database) => database.$id === DATABASE_ID_ENV);
  if (configuredDatabase) {
    DATABASE_ID = configuredDatabase.$id;
  } else if (databases.length === 1) {
    DATABASE_ID = databases[0].$id;
    console.warn(
      `APPWRITE_DATABASE_ID bir veritabanı kimliği değil. ${databases[0].name} kullanılıyor.`
    );
  } else {
    throw new Error("APPWRITE_DATABASE_ID bulunamadı.");
  }

  const tableList = await tablesDB.listTables({ databaseId: DATABASE_ID });
  const tables = tableList.tables || [];
  const resolveTable = (name, configuredId) => {
    if (configuredId && tables.some((table) => table.$id === configuredId)) return configuredId;
    const match = tables.find((table) => table.name === name);
    if (!match) throw new Error(`${name} tablosu bulunamadı.`);
    return match.$id;
  };
  CLUBS_TABLE_ID = resolveTable("clubs", CLUBS_TABLE_ENV);
  PLAYERS_TABLE_ID = resolveTable("footballPlayers", PLAYERS_TABLE_ENV);
}

async function listCustomColumns(tablesDB, tableId) {
  const result = await tablesDB.listColumns({
    databaseId: DATABASE_ID,
    tableId,
  });
  return (result.columns || result.attributes || []).filter(
    (column) => !String(column.key).startsWith("$")
  );
}

async function waitForColumn(tablesDB, tableId, key) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const columns = await listCustomColumns(tablesDB, tableId);
    const column = columns.find((item) => item.key === key);
    if (column && column.status === "available") return column;
    if (column && column.status === "failed") {
      throw new Error(`${key} kolonu oluşturulamadı: ${column.error || column.status}`);
    }
    await sleep(1000);
  }
  throw new Error(`${key} kolonu hazır olmadı.`);
}

async function ensureClubColumns(tablesDB) {
  let columns = await listCustomColumns(tablesDB, CLUBS_TABLE_ID);
  if (!pickColumn(columns, NAME_KEYS)) {
    console.log("clubs.club_name kolonu oluşturuluyor");
    await tablesDB.createVarcharColumn({
      databaseId: DATABASE_ID,
      tableId: CLUBS_TABLE_ID,
      key: "club_name",
      size: 255,
      required: true,
    });
    await waitForColumn(tablesDB, CLUBS_TABLE_ID, "club_name");
  }

  columns = await listCustomColumns(tablesDB, CLUBS_TABLE_ID);
  if (!pickColumn(columns, LEAGUE_KEYS)) {
    console.log("clubs.leagues kolonu oluşturuluyor");
    await tablesDB.createStringColumn({
      databaseId: DATABASE_ID,
      tableId: CLUBS_TABLE_ID,
      key: "leagues",
      size: 128,
      required: true,
      array: true,
    });
    await waitForColumn(tablesDB, CLUBS_TABLE_ID, "leagues");
  }

  return listCustomColumns(tablesDB, CLUBS_TABLE_ID);
}

function leagueValue(column, leagues) {
  if (column.array) return leagues;
  return leagues.join(" | ");
}

function buildClubRows(clubsByName, columns) {
  const nameColumn = pickColumn(columns, NAME_KEYS);
  const leagueColumn = pickColumn(columns, LEAGUE_KEYS);
  if (!nameColumn) {
    throw new Error(`clubs tablosunda kulüp adı kolonu yok: ${columns.map((column) => column.key).join(", ")}`);
  }

  return [...clubsByName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([clubName, leagues]) => ({
      $id: rowId("c", clubName),
      [nameColumn.key]: clubName,
      ...(leagueColumn ? { [leagueColumn.key]: leagueValue(leagueColumn, leagues) } : {}),
    }));
}

function buildPlayerRows(players, clubsByName) {
  const idByName = new Map(
    [...clubsByName.keys()].map((clubName) => [clubName, rowId("c", clubName)])
  );
  const unknown = new Set();
  const rows = [];
  const seen = new Set();

  for (const player of players) {
    const clubIds = [];
    for (const clubName of player.clubNames) {
      const clubId = idByName.get(clubName);
      if (!clubId) {
        unknown.add(clubName);
        continue;
      }
      if (!clubIds.includes(clubId)) clubIds.push(clubId);
    }
    if (!clubIds.length) continue;
    const $id = rowId("p", `${player.player_name}|${clubIds.join("|")}`);
    if (seen.has($id)) continue;
    seen.add($id);
    rows.push({
      $id,
      player_name: player.player_name,
      player_clubs: clubIds,
    });
  }

  if (unknown.size) {
    throw new Error(`Kulüp kimliği bulunamayan adlar: ${[...unknown].join(", ")}`);
  }
  return rows;
}

async function createBatch(tablesDB, tableId, rows) {
  if (!rows.length) return;
  await withRetry(`upsertRows ${tableId} x${rows.length}`, () =>
    tablesDB.upsertRows({
      databaseId: DATABASE_ID,
      tableId,
      rows,
    })
  );
}

async function importMappedRows(tablesDB, tableId, rows, progressKey, progress) {
  const start = progress[progressKey] || 0;
  for (let index = start; index < rows.length; index += BATCH_SIZE) {
    const slice = rows.slice(index, index + BATCH_SIZE);
    await createBatch(tablesDB, tableId, slice);
    progress[progressKey] = index + slice.length;
    if (!LIMIT) saveProgress(progress);
    if ((index / BATCH_SIZE) % 10 === 0 || index + slice.length >= rows.length) {
      console.log(`${progressKey}: ${Math.min(index + slice.length, rows.length)}/${rows.length}`);
    }
  }
}

async function main() {
  const clubsByName = loadClubsByName();
  const playerSources = LIMIT ? loadPlayerSources().slice(0, LIMIT) : loadPlayerSources();
  const playerRowsForDryRun = buildPlayerRows(playerSources, clubsByName);
  const maxClubs = playerRowsForDryRun.reduce(
    (max, player) => Math.max(max, player.player_clubs.length),
    0
  );

  console.log(`Benzersiz kulüp: ${clubsByName.size}`);
  console.log(`Oyuncu: ${playerRowsForDryRun.length}${LIMIT ? ` (limit ${LIMIT})` : ""}`);
  console.log(`Bir oyuncudaki en fazla kulüp kimliği: ${maxClubs}`);

  if (DRY_RUN) {
    const fcBarcelonaId = rowId("c", "FC Barcelona");
    const hagi = playerRowsForDryRun.find((player) => player.player_name === "Gheorghe Hagi");
    console.log("Örnek kulüp kimliği: FC Barcelona ->", fcBarcelonaId);
    console.log("Örnek oyuncu:", playerRowsForDryRun[0]);
    console.log("Hagi kulüp kimlikleri Barcelona adını içeriyor mu:", Boolean(
      hagi && hagi.player_clubs.includes(fcBarcelonaId)
    ));
    return;
  }

  const apiKey = requiredEnv("APPWRITE_API_KEY");
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(apiKey);
  const tablesDB = new TablesDB(client);
  await resolveTargets(tablesDB);

  const clubColumns = await ensureClubColumns(tablesDB);
  const playerColumns = await listCustomColumns(tablesDB, PLAYERS_TABLE_ID);
  console.log("clubs kolonları:", clubColumns.map((column) => column.key).join(", ") || "(yok)");
  console.log("footballPlayers kolonları:", playerColumns.map((column) => column.key).join(", ") || "(yok)");

  const playerClubsColumn = playerColumns.find((column) => column.key === "player_clubs");
  if (!playerColumns.some((column) => column.key === "player_name") || !playerClubsColumn) {
    throw new Error("footballPlayers tablosunda player_name ve player_clubs kolonları olmalı.");
  }
  if (!playerClubsColumn.array) {
    throw new Error("player_clubs birden fazla kulüp kimliği tutabilmek için dizi kolonu olmalı.");
  }

  const mappedClubs = buildClubRows(clubsByName, clubColumns);
  const mappedPlayers = playerRowsForDryRun;
  const clubsToImport = LIMIT ? mappedClubs.slice(0, LIMIT) : mappedClubs;

  const progress = LIMIT ? { clubs: 0, players: 0 } : loadProgress();
  console.log(`Kaldığı yer: clubs=${progress.clubs || 0}, players=${progress.players || 0}`);
  await importMappedRows(tablesDB, CLUBS_TABLE_ID, clubsToImport, "clubs", progress);
  await importMappedRows(tablesDB, PLAYERS_TABLE_ID, mappedPlayers, "players", progress);

  const [clubCount, playerCount] = await Promise.all([
    tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: CLUBS_TABLE_ID,
      queries: [Query.limit(1)],
    }),
    tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: PLAYERS_TABLE_ID,
      queries: [Query.limit(1)],
    }),
  ]);
  console.log(`Appwrite clubs toplam: ${clubCount.total}`);
  console.log(`Appwrite footballPlayers toplam: ${playerCount.total}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

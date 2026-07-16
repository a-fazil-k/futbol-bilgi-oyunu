// server.js
// Gercek zamanli 2 oyunculu futbol bilgi/tahmin oyunu sunucusu.

const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");
const { seed, DB_PATH } = require("./db/seed.js");

// Veritabani yoksa (ilk calistirma) otomatik olustur ve doldur (SEEDING)
if (!fs.existsSync(DB_PATH)) {
  console.log("[db] Veritabani bulunamadi, seed ediliyor...");
  seed();
} else {
  console.log("[db] Mevcut veritabani kullaniliyor.");
}

const db = new Database(DB_PATH, { readonly: false });

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Oyun sabitleri
// ---------------------------------------------------------------------------
const SELECT_PHASE_SECONDS = 30;
const GUESS_PHASE_SECONDS = 30;
const WRONG_ANSWER_LOCK_SECONDS = 3;
const BETWEEN_ROUND_DELAY_MS = 3500;
const TOTAL_ROUNDS = 5;

// ---------------------------------------------------------------------------
// Basit hazir-sorgu (prepared statement) yardimcilari
// ---------------------------------------------------------------------------
const stmtSearchClubs = db.prepare(
  `SELECT name, country FROM clubs WHERE name LIKE ?
   ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name ASC LIMIT 8`
);
const stmtSearchCountries = db.prepare(
  `SELECT name FROM countries WHERE name LIKE ?
   ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name ASC LIMIT 8`
);
const stmtSearchPlayers = db.prepare(
  `SELECT name, nationality, clubs FROM players WHERE name LIKE ?
   ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name ASC LIMIT 8`
);
const stmtRandomClub = db.prepare("SELECT name FROM clubs ORDER BY RANDOM() LIMIT 1");
const stmtRandomCountry = db.prepare("SELECT name FROM countries ORDER BY RANDOM() LIMIT 1");
const stmtFindPlayerExact = db.prepare(
  "SELECT name, nationality, clubs FROM players WHERE lower(name) = lower(?) LIMIT 1"
);

function searchClubs(q) {
  return stmtSearchClubs.all(`%${q}%`, `${q}%`);
}
function searchCountries(q) {
  return stmtSearchCountries.all(`%${q}%`, `${q}%`);
}
function searchPlayers(q) {
  return stmtSearchPlayers.all(`%${q}%`, `${q}%`);
}

// ---------------------------------------------------------------------------
// Lobi / Eslestirme
// ---------------------------------------------------------------------------
let waitingQueue = []; // [{socketId, username}]
const rooms = new Map(); // roomId -> room state

function makeRoomId() {
  return "room_" + Math.random().toString(36).slice(2, 9);
}

function tryMatchmake() {
  while (waitingQueue.length >= 2) {
    const a = waitingQueue.shift();
    const b = waitingQueue.shift();
    const socketA = io.sockets.sockets.get(a.socketId);
    const socketB = io.sockets.sockets.get(b.socketId);
    if (!socketA || !socketA.connected) {
      if (socketB && socketB.connected) waitingQueue.unshift(b);
      continue;
    }
    if (!socketB || !socketB.connected) {
      waitingQueue.unshift(a);
      continue;
    }
    createRoom(
      { socketId: a.socketId, username: a.username },
      { socketId: b.socketId, username: b.username }
    );
  }
}

function createRoom(playerA, playerB) {
  const roomId = makeRoomId();
  const room = {
    id: roomId,
    players: [
      { socketId: playerA.socketId, username: playerA.username, score: 0 },
      { socketId: playerB.socketId, username: playerB.username, score: 0 },
    ],
    round: 0,
    phase: "idle",
    criteria: { club: null, country: null },
    submitted: { club: false, country: false },
    lockUntil: {}, // socketId -> timestamp ms
    selectTimer: null,
    guessTimer: null,
    nextRoundTimeout: null,
  };
  rooms.set(roomId, room);

  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) {
      s.join(roomId);
      s.data.roomId = roomId;
    }
  }

  io.to(playerA.socketId).emit("match_found", {
    roomId,
    you: playerA.username,
    opponent: playerB.username,
  });
  io.to(playerB.socketId).emit("match_found", {
    roomId,
    you: playerB.username,
    opponent: playerA.username,
  });

  startRound(room);
}

function roleForRound(room, socketId) {
  // Round 1: players[0]=club, players[1]=country. Round 2: rol degisir. vs.
  const idx = room.players.findIndex((p) => p.socketId === socketId);
  const isEvenRound = room.round % 2 === 0; // round 1 -> odd
  if (idx === 0) return isEvenRound ? "country" : "club";
  return isEvenRound ? "club" : "country";
}

function startRound(room) {
  try {
    room.round += 1;
    room.phase = "selecting";
    room.criteria = { club: null, country: null };
    room.submitted = { club: false, country: false };

    const rolesPayload = {};
    for (const p of room.players) {
      rolesPayload[p.socketId] = roleForRound(room, p.socketId);
    }
    room.roles = rolesPayload;

    io.to(room.id).emit("round_start", {
      round: room.round,
      totalRounds: TOTAL_ROUNDS,
      seconds: SELECT_PHASE_SECONDS,
      roles: rolesPayload, // her socketId icin rolu (client kendi rolunu okur)
      scores: scorePayload(room),
    });

    clearTimeout(room.selectTimer);
    room.selectTimer = setTimeout(() => lockSelections(room), SELECT_PHASE_SECONDS * 1000);
  } catch (err) {
    console.error("[startRound] hata:", err);
  }
}

function scorePayload(room) {
  return room.players.map((p) => ({ username: p.username, score: p.score }));
}

function lockSelections(room) {
  try {
    if (room.phase !== "selecting") return;
    const randomClubRow = stmtRandomClub.get();
    const randomCountryRow = stmtRandomCountry.get();
    if (!room.criteria.club) room.criteria.club = randomClubRow ? randomClubRow.name : "Real Madrid";
    if (!room.criteria.country) room.criteria.country = randomCountryRow ? randomCountryRow.name : "Spain";

    room.phase = "guessing";
    room.lockUntil = {};

    io.to(room.id).emit("criteria_locked", {
      club: room.criteria.club,
      country: room.criteria.country,
      seconds: GUESS_PHASE_SECONDS,
    });

    clearTimeout(room.guessTimer);
    room.guessTimer = setTimeout(() => endRound(room, null, null), GUESS_PHASE_SECONDS * 1000);
  } catch (err) {
    console.error("[lockSelections] hata:", err);
  }
}

function endRound(room, winnerSocketId, correctPlayerName) {
  try {
    if (room.phase === "between" || room.phase === "idle") return;
    clearTimeout(room.selectTimer);
    clearTimeout(room.guessTimer);
    room.phase = "between";

    if (winnerSocketId) {
      const p = room.players.find((pp) => pp.socketId === winnerSocketId);
      if (p) p.score += 1;
    }

    const winnerPlayer = winnerSocketId
      ? room.players.find((p) => p.socketId === winnerSocketId)
      : null;

    io.to(room.id).emit("round_result", {
      winner: winnerPlayer ? winnerPlayer.username : null,
      correctPlayerName: correctPlayerName,
      club: room.criteria.club,
      country: room.criteria.country,
      scores: scorePayload(room),
      round: room.round,
      totalRounds: TOTAL_ROUNDS,
    });

    if (room.round >= TOTAL_ROUNDS) {
      room.nextRoundTimeout = setTimeout(() => finishGame(room), BETWEEN_ROUND_DELAY_MS);
    } else {
      room.nextRoundTimeout = setTimeout(() => startRound(room), BETWEEN_ROUND_DELAY_MS);
    }
  } catch (err) {
    console.error("[endRound] hata:", err);
  }
}

function finishGame(room) {
  try {
    const scores = scorePayload(room);
    let winner = "Berabere";
    if (scores.length === 2) {
      if (scores[0].score > scores[1].score) winner = scores[0].username;
      else if (scores[1].score > scores[0].score) winner = scores[1].username;
    }

    io.to(room.id).emit("game_over", { scores, winner });

    for (const p of room.players) {
      const s = io.sockets.sockets.get(p.socketId);
      if (s) {
        s.leave(room.id);
        delete s.data.roomId;
      }
    }
    rooms.delete(room.id);
  } catch (err) {
    console.error("[finishGame] hata:", err);
    // Oda her durumda temizlensin ki kilitli kalmasin
    rooms.delete(room.id);
  }
}

function handlePlayerLeft(socketId) {
  waitingQueue = waitingQueue.filter((w) => w.socketId !== socketId);
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) {
      clearTimeout(room.selectTimer);
      clearTimeout(room.guessTimer);
      clearTimeout(room.nextRoundTimeout);
      io.to(room.id).emit("opponent_left");
      rooms.delete(room.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Socket.io olay yonetimi
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  socket.on("join_lobby", ({ username }) => {
    try {
      const clean = (username || "").toString().trim().slice(0, 20);
      if (!clean) return;
      socket.data.username = clean;
      waitingQueue.push({ socketId: socket.id, username: clean });
      socket.emit("lobby_waiting");
      tryMatchmake();
    } catch (err) {
      console.error("[join_lobby] hata:", err);
    }
  });

  socket.on("search_club", ({ query }, cb) => {
    try {
      cb(searchClubs((query || "").toString()));
    } catch (e) {
      cb([]);
    }
  });

  socket.on("search_country", ({ query }, cb) => {
    try {
      cb(searchCountries((query || "").toString()));
    } catch (e) {
      cb([]);
    }
  });

  socket.on("search_player", ({ query }, cb) => {
    try {
      cb(searchPlayers((query || "").toString()));
    } catch (e) {
      cb([]);
    }
  });

  socket.on("submit_criteria", ({ value }) => {
    try {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || room.phase !== "selecting") return;
      const role = room.roles[socket.id];
      if (!role) return;
      if (role === "club" && !room.submitted.club) {
        room.criteria.club = (value || "").toString();
        room.submitted.club = true;
      } else if (role === "country" && !room.submitted.country) {
        room.criteria.country = (value || "").toString();
        room.submitted.country = true;
      }
      io.to(room.id).emit("opponent_submitted_criteria", { role });
      if (room.submitted.club && room.submitted.country) {
        lockSelections(room);
      }
    } catch (err) {
      console.error("[submit_criteria] hata:", err);
    }
  });

  socket.on("submit_guess", ({ value }) => {
    try {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room || room.phase !== "guessing") return;

      const now = Date.now();
      if (room.lockUntil[socket.id] && room.lockUntil[socket.id] > now) {
        socket.emit("guess_locked", {
          remainingMs: room.lockUntil[socket.id] - now,
        });
        return;
      }

      const guessName = (value || "").toString().trim();
      if (!guessName) return;

      const row = stmtFindPlayerExact.get(guessName);
      let correct = false;
      if (row) {
        const clubs = JSON.parse(row.clubs);
        const clubOk = clubs.some(
          (c) => c.toLowerCase() === (room.criteria.club || "").toLowerCase()
        );
        const countryOk =
          row.nationality.toLowerCase() === (room.criteria.country || "").toLowerCase();
        correct = clubOk && countryOk;
      }

      if (correct) {
        endRound(room, socket.id, row.name);
      } else {
        room.lockUntil[socket.id] = now + WRONG_ANSWER_LOCK_SECONDS * 1000;
        socket.emit("wrong_answer", { seconds: WRONG_ANSWER_LOCK_SECONDS });
        socket.to(room.id).emit("opponent_wrong_answer");
      }
    } catch (err) {
      console.error("[submit_guess] hata:", err);
    }
  });

  socket.on("disconnect", () => {
    handlePlayerLeft(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} adresinde calisiyor`);
});

// ---------------------------------------------------------------------------
// Global cokme korumasi: beklenmeyen bir hata TUM sunucuyu (ve dolayisiyla
// iki oyuncunun da baglantisini) coker duruma getirmesin diye log'layip devam et.
// ---------------------------------------------------------------------------
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Beklenmeyen hata (sunucu ayakta kaliyor):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Yakalanmamis promise reddi (sunucu ayakta kaliyor):", reason);
});

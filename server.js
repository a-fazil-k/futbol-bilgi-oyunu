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
const stmtRandomClubExcluding = db.prepare(
  "SELECT name FROM clubs WHERE name != ? ORDER BY RANDOM() LIMIT 1"
);
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
const MODES = ["country_club", "club_club"];
let waitingQueues = { country_club: [], club_club: [] }; // mode -> [{socketId, username}]
const rooms = new Map(); // roomId -> room state
const pendingCodeRooms = new Map(); // code -> {code, hostSocketId, hostUsername, mode}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // karisikligi onlemek icin 0/O/1/I/L yok
function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (pendingCodeRooms.has(code));
  return code;
}

function makeRoomId() {
  return "room_" + Math.random().toString(36).slice(2, 9);
}

function tryMatchmake(mode) {
  const queue = waitingQueues[mode];
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    const socketA = io.sockets.sockets.get(a.socketId);
    const socketB = io.sockets.sockets.get(b.socketId);
    if (!socketA || !socketA.connected) {
      if (socketB && socketB.connected) queue.unshift(b);
      continue;
    }
    if (!socketB || !socketB.connected) {
      queue.unshift(a);
      continue;
    }
    createRoom(
      { socketId: a.socketId, username: a.username },
      { socketId: b.socketId, username: b.username },
      mode
    );
  }
}

function createRoom(playerA, playerB, mode) {
  const roomId = makeRoomId();
  const room = {
    id: roomId,
    mode: MODES.includes(mode) ? mode : "country_club",
    players: [
      { socketId: playerA.socketId, username: playerA.username, score: 0 },
      { socketId: playerB.socketId, username: playerB.username, score: 0 },
    ],
    round: 0,
    phase: "idle",
    roles: {},
    criteria: {},
    submissionsBySocket: {},
    submittedBySocket: {},
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
    mode: room.mode,
  });
  io.to(playerB.socketId).emit("match_found", {
    roomId,
    you: playerB.username,
    opponent: playerA.username,
    mode: room.mode,
  });

  startRound(room);
}

function roleForRound(room, socketId) {
  if (room.mode === "club_club") return "club"; // iki oyuncu da kulup secer
  // country_club: Round 1: players[0]=club, players[1]=country. Round 2: rol degisir. vs.
  const idx = room.players.findIndex((p) => p.socketId === socketId);
  const isEvenRound = room.round % 2 === 0; // round 1 -> odd
  if (idx === 0) return isEvenRound ? "country" : "club";
  return isEvenRound ? "club" : "country";
}

function startRound(room) {
  try {
    room.round += 1;
    room.phase = "selecting";
    room.criteria = {};
    room.submissionsBySocket = {};
    room.submittedBySocket = {};

    const rolesPayload = {};
    for (const p of room.players) {
      rolesPayload[p.socketId] = roleForRound(room, p.socketId);
      room.submissionsBySocket[p.socketId] = null;
      room.submittedBySocket[p.socketId] = false;
    }
    room.roles = rolesPayload;

    io.to(room.id).emit("round_start", {
      round: room.round,
      totalRounds: TOTAL_ROUNDS,
      seconds: SELECT_PHASE_SECONDS,
      mode: room.mode,
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

// Kriterleri gosterim icin genel "chip" listesine cevirir (mod'a gore).
function buildChips(room) {
  if (room.mode === "club_club") {
    return [
      { icon: "🛡️", label: "Kulüp 1", value: room.criteria.clubA },
      { icon: "🛡️", label: "Kulüp 2", value: room.criteria.clubB },
    ];
  }
  return [
    { icon: "🛡️", label: "Kulüp", value: room.criteria.club },
    { icon: "🌍", label: "Ülke", value: room.criteria.country },
  ];
}

function lockSelections(room) {
  try {
    if (room.phase !== "selecting") return;

    if (room.mode === "club_club") {
      const [p0, p1] = room.players;
      let v0 = room.submissionsBySocket[p0.socketId];
      let v1 = room.submissionsBySocket[p1.socketId];
      // Ikisi de bos kaldiysa: 2 farkli rastgele kulup ata.
      if (!v0 && !v1) {
        const r0 = stmtRandomClub.get();
        v0 = r0 ? r0.name : "Real Madrid";
        const r1 = stmtRandomClubExcluding.get(v0);
        v1 = r1 ? r1.name : "Barcelona";
      } else if (!v0) {
        // v1 zaten var, v0'i ona esit olmayacak sekilde rastgele doldur.
        const r0 = stmtRandomClubExcluding.get(v1);
        v0 = r0 ? r0.name : "Real Madrid";
      } else if (!v1) {
        const r1 = stmtRandomClubExcluding.get(v0);
        v1 = r1 ? r1.name : "Barcelona";
      }
      room.criteria = { clubA: v0, clubB: v1 };
    } else {
      const clubSocketId = Object.keys(room.roles).find((sid) => room.roles[sid] === "club");
      const countrySocketId = Object.keys(room.roles).find(
        (sid) => room.roles[sid] === "country"
      );
      let clubVal = clubSocketId ? room.submissionsBySocket[clubSocketId] : null;
      let countryVal = countrySocketId ? room.submissionsBySocket[countrySocketId] : null;
      if (!clubVal) {
        const r = stmtRandomClub.get();
        clubVal = r ? r.name : "Real Madrid";
      }
      if (!countryVal) {
        const r = stmtRandomCountry.get();
        countryVal = r ? r.name : "Spain";
      }
      room.criteria = { club: clubVal, country: countryVal };
    }

    room.phase = "guessing";
    room.lockUntil = {};

    io.to(room.id).emit("criteria_locked", {
      mode: room.mode,
      chips: buildChips(room),
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
      mode: room.mode,
      chips: buildChips(room),
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
  waitingQueues.country_club = waitingQueues.country_club.filter((w) => w.socketId !== socketId);
  waitingQueues.club_club = waitingQueues.club_club.filter((w) => w.socketId !== socketId);
  for (const [code, pending] of pendingCodeRooms.entries()) {
    if (pending.hostSocketId === socketId) pendingCodeRooms.delete(code);
  }
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
  socket.on("join_lobby", ({ username, mode }) => {
    try {
      const clean = (username || "").toString().trim().slice(0, 20);
      if (!clean) return;
      const cleanMode = MODES.includes(mode) ? mode : "country_club";
      socket.data.username = clean;
      socket.data.mode = cleanMode;
      waitingQueues[cleanMode].push({ socketId: socket.id, username: clean });
      socket.emit("lobby_waiting");
      tryMatchmake(cleanMode);
    } catch (err) {
      console.error("[join_lobby] hata:", err);
    }
  });

  socket.on("create_room", ({ username, mode }) => {
    try {
      const clean = (username || "").toString().trim().slice(0, 20);
      if (!clean) return;
      const cleanMode = MODES.includes(mode) ? mode : "country_club";

      // Bu socket zaten baska bir kod icin bekliyorsa onu iptal et.
      if (socket.data.pendingCode) {
        pendingCodeRooms.delete(socket.data.pendingCode);
      }

      const code = generateRoomCode();
      pendingCodeRooms.set(code, {
        code,
        hostSocketId: socket.id,
        hostUsername: clean,
        mode: cleanMode,
      });
      socket.data.username = clean;
      socket.data.pendingCode = code;
      socket.emit("room_created", { code });
    } catch (err) {
      console.error("[create_room] hata:", err);
    }
  });

  socket.on("join_room_by_code", ({ username, code }) => {
    try {
      const clean = (username || "").toString().trim().slice(0, 20);
      const cleanCode = (code || "").toString().trim().toUpperCase();
      if (!clean || !cleanCode) return;

      const pending = pendingCodeRooms.get(cleanCode);
      if (!pending) {
        socket.emit("room_join_error", { reason: "not_found" });
        return;
      }
      if (pending.hostSocketId === socket.id) {
        socket.emit("room_join_error", { reason: "self" });
        return;
      }
      const hostSocket = io.sockets.sockets.get(pending.hostSocketId);
      if (!hostSocket || !hostSocket.connected) {
        pendingCodeRooms.delete(cleanCode);
        socket.emit("room_join_error", { reason: "not_found" });
        return;
      }

      pendingCodeRooms.delete(cleanCode);
      delete hostSocket.data.pendingCode;
      socket.data.username = clean;

      createRoom(
        { socketId: pending.hostSocketId, username: pending.hostUsername },
        { socketId: socket.id, username: clean },
        pending.mode
      );
    } catch (err) {
      console.error("[join_room_by_code] hata:", err);
      socket.emit("room_join_error", { reason: "error" });
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
      if (room.submittedBySocket[socket.id]) return; // zaten gonderdi

      const cleanValue = (value || "").toString().trim();
      if (!cleanValue) return;

      // Kulup-Kulup modunda: rakip AYNI kulubu secmisse reddet, farkli
      // bir kulup secmesini iste (iki oyuncunun ayni kulubu secmesine karsi onlem).
      if (room.mode === "club_club") {
        const otherPlayer = room.players.find((p) => p.socketId !== socket.id);
        const otherVal = otherPlayer ? room.submissionsBySocket[otherPlayer.socketId] : null;
        if (otherVal && otherVal.toLowerCase() === cleanValue.toLowerCase()) {
          socket.emit("criteria_rejected", { reason: "same_club" });
          return;
        }
      }

      room.submissionsBySocket[socket.id] = cleanValue;
      room.submittedBySocket[socket.id] = true;

      io.to(room.id).emit("opponent_submitted_criteria", { fromSocketId: socket.id });

      const allSubmitted = room.players.every((p) => room.submittedBySocket[p.socketId]);
      if (allSubmitted) {
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
        const clubs = JSON.parse(row.clubs).map((c) => c.toLowerCase());
        if (room.mode === "club_club") {
          const aOk = clubs.includes((room.criteria.clubA || "").toLowerCase());
          const bOk = clubs.includes((room.criteria.clubB || "").toLowerCase());
          correct = aOk && bOk;
        } else {
          const clubOk = clubs.includes((room.criteria.club || "").toLowerCase());
          const countryOk =
            row.nationality.toLowerCase() === (room.criteria.country || "").toLowerCase();
          correct = clubOk && countryOk;
        }
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

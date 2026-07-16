const socket = io();

// ---------------------------------------------------------------------------
// Ekran yönetimi
// ---------------------------------------------------------------------------
const screens = {
  login: document.getElementById("screen-login"),
  lobby: document.getElementById("screen-lobby"),
  game: document.getElementById("screen-game"),
  gameover: document.getElementById("screen-gameover"),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

let myUsername = "";
let myRole = null; // 'club' | 'country' bu tur icin
let countdownInterval = null;

// ---------------------------------------------------------------------------
// EKRAN 1: Giriş
// ---------------------------------------------------------------------------
const usernameInput = document.getElementById("username-input");
const btnJoinLobby = document.getElementById("btn-join-lobby");
const loginError = document.getElementById("login-error");

function joinLobby() {
  const name = usernameInput.value.trim();
  if (!name) {
    loginError.textContent = "Lütfen bir kullanıcı adı gir.";
    return;
  }
  myUsername = name;
  loginError.textContent = "";
  socket.emit("join_lobby", { username: name });
}
btnJoinLobby.addEventListener("click", joinLobby);
usernameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") joinLobby(); });

socket.on("lobby_waiting", () => showScreen("lobby"));

// ---------------------------------------------------------------------------
// EKRAN 3: Oyun — eşleşme
// ---------------------------------------------------------------------------
const meNameEl = document.getElementById("me-name");
const oppNameEl = document.getElementById("opp-name");
const meScoreEl = document.getElementById("me-score");
const oppScoreEl = document.getElementById("opp-score");
const roundNumEl = document.getElementById("round-num");
const roundTotalEl = document.getElementById("round-total");
const timerEl = document.getElementById("timer");

let opponentName = "";

socket.on("match_found", ({ you, opponent }) => {
  myUsername = you;
  opponentName = opponent;
  meNameEl.textContent = you;
  oppNameEl.textContent = opponent;
  showScreen("game");
});

// ---------------------------------------------------------------------------
// Faz panelleri
// ---------------------------------------------------------------------------
const phaseSelecting = document.getElementById("phase-selecting");
const phaseGuessing = document.getElementById("phase-guessing");
const phaseResult = document.getElementById("phase-result");

function showPhase(name) {
  [phaseSelecting, phaseGuessing, phaseResult].forEach((p) => p.classList.add("hidden"));
  if (name === "selecting") phaseSelecting.classList.remove("hidden");
  if (name === "guessing") phaseGuessing.classList.remove("hidden");
  if (name === "result") phaseResult.classList.remove("hidden");
}

function startCountdown(seconds, onTick, onDone) {
  clearInterval(countdownInterval);
  let remaining = seconds;
  onTick(remaining);
  countdownInterval = setInterval(() => {
    remaining -= 1;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      if (onDone) onDone();
    }
  }, 1000);
}

// ---------------------------------------------------------------------------
// Round başlangıcı (seçim aşaması)
// ---------------------------------------------------------------------------
const selectRoleLabel = document.getElementById("select-role-label");
const selectInput = document.getElementById("select-input");
const selectDropdown = document.getElementById("select-dropdown");
const btnSubmitCriteria = document.getElementById("btn-submit-criteria");
const selectStatus = document.getElementById("select-status");

let criteriaSubmitted = false;
let selectedCriteriaValue = null;

socket.on("round_start", ({ round, totalRounds, seconds, roles, scores }) => {
  roundNumEl.textContent = round;
  roundTotalEl.textContent = totalRounds;
  updateScores(scores);

  myRole = roles[socket.id];
  criteriaSubmitted = false;
  selectedCriteriaValue = null;
  selectInput.value = "";
  selectInput.disabled = false;
  selectDropdown.classList.remove("show");
  btnSubmitCriteria.disabled = true;
  selectStatus.textContent = "";
  selectStatus.className = "status-text";

  selectRoleLabel.textContent =
    myRole === "club" ? "Bir KULÜP seç" : "Bir ÜLKE seç";
  selectInput.placeholder =
    myRole === "club" ? "Kulüp adı yaz..." : "Ülke adı yaz...";

  showPhase("selecting");
  startCountdown(
    seconds,
    (t) => setTimerText(t),
    () => { /* sunucu zaten kilitleyecek */ }
  );
});

function updateScores(scores) {
  // scores: [{username, score}, {username, score}]
  const me = scores.find((s) => s.username === myUsername);
  const opp = scores.find((s) => s.username !== myUsername);
  if (me) meScoreEl.textContent = me.score;
  if (opp) oppScoreEl.textContent = opp.score;
}

function setTimerText(t) {
  timerEl.textContent = Math.max(0, t);
}

// --- Autocomplete: kriter seçimi (kulüp veya ülke) ---
let selectDebounce = null;
selectInput.addEventListener("input", () => {
  selectedCriteriaValue = null;
  btnSubmitCriteria.disabled = true;
  const q = selectInput.value.trim();
  clearTimeout(selectDebounce);
  if (!q) { selectDropdown.classList.remove("show"); return; }
  selectDebounce = setTimeout(() => {
    const evt = myRole === "club" ? "search_club" : "search_country";
    socket.emit(evt, { query: q }, (results) => {
      renderDropdown(selectDropdown, results, myRole === "club", (val) => {
        selectInput.value = val;
        selectedCriteriaValue = val;
        btnSubmitCriteria.disabled = false;
        selectDropdown.classList.remove("show");
      });
    });
  }, 120);
});

btnSubmitCriteria.addEventListener("click", () => {
  if (!selectedCriteriaValue || criteriaSubmitted) return;
  criteriaSubmitted = true;
  btnSubmitCriteria.disabled = true;
  selectInput.disabled = true;
  selectStatus.textContent = "Gönderildi. Rakibin seçimini bekliyoruz...";
  socket.emit("submit_criteria", { value: selectedCriteriaValue });
});

socket.on("opponent_submitted_criteria", ({ role }) => {
  if (role !== myRole && !criteriaSubmitted) {
    selectStatus.textContent = "Rakip seçimini yaptı! Sıra sende.";
    selectStatus.className = "status-text ok";
  }
});

// ---------------------------------------------------------------------------
// Kriterler kilitlendi -> tahmin aşaması
// ---------------------------------------------------------------------------
const revealClub = document.getElementById("reveal-club");
const revealCountry = document.getElementById("reveal-country");
const guessInput = document.getElementById("guess-input");
const guessDropdown = document.getElementById("guess-dropdown");
const btnSubmitGuess = document.getElementById("btn-submit-guess");
const guessStatus = document.getElementById("guess-status");

let guessLockedUntil = 0;

socket.on("criteria_locked", ({ club, country, seconds }) => {
  revealClub.textContent = club;
  revealCountry.textContent = country;
  guessInput.value = "";
  guessInput.disabled = false;
  btnSubmitGuess.disabled = false;
  guessStatus.textContent = "";
  guessStatus.className = "status-text";
  guessDropdown.classList.remove("show");
  guessLockedUntil = 0;

  showPhase("guessing");
  startCountdown(seconds, (t) => setTimerText(t), () => {});
});

let guessDebounce = null;
guessInput.addEventListener("input", () => {
  const q = guessInput.value.trim();
  clearTimeout(guessDebounce);
  if (!q) { guessDropdown.classList.remove("show"); return; }
  guessDebounce = setTimeout(() => {
    socket.emit("search_player", { query: q }, (results) => {
      renderDropdown(
        guessDropdown,
        results.map((r) => ({ name: r.name, sub: `${r.nationality}` })),
        false,
        (val) => {
          guessInput.value = val;
          guessDropdown.classList.remove("show");
        },
        true
      );
    });
  }, 120);
});

function trySubmitGuess() {
  const val = guessInput.value.trim();
  if (!val) return;
  if (Date.now() < guessLockedUntil) return;
  socket.emit("submit_guess", { value: val });
}
btnSubmitGuess.addEventListener("click", trySubmitGuess);
guessInput.addEventListener("keydown", (e) => { if (e.key === "Enter") trySubmitGuess(); });

socket.on("wrong_answer", ({ seconds }) => {
  guessLockedUntil = Date.now() + seconds * 1000;
  guessStatus.textContent = `Yanlış! ${seconds} saniye bekle...`;
  guessStatus.className = "status-text warn";
  guessInput.disabled = true;
  btnSubmitGuess.disabled = true;
  setTimeout(() => {
    guessInput.disabled = false;
    btnSubmitGuess.disabled = false;
    guessStatus.textContent = "Tekrar deneyebilirsin.";
    guessStatus.className = "status-text";
  }, seconds * 1000);
});

socket.on("opponent_wrong_answer", () => {
  guessStatus.textContent = "Rakip yanlış cevap verdi, şansın var!";
  guessStatus.className = "status-text ok";
  setTimeout(() => { if (guessStatus.classList.contains("ok")) guessStatus.textContent = ""; }, 2000);
});

socket.on("guess_locked", ({ remainingMs }) => {
  guessStatus.textContent = `Bekle: ${(remainingMs / 1000).toFixed(1)}s`;
  guessStatus.className = "status-text warn";
});

// ---------------------------------------------------------------------------
// Tur sonucu
// ---------------------------------------------------------------------------
const resultBox = document.getElementById("result-box");

socket.on("round_result", ({ winner, correctPlayerName, club, country, scores }) => {
  clearInterval(countdownInterval);
  updateScores(scores);
  showPhase("result");
  timerEl.textContent = "—";

  let html = `<div>Kriter: <b>${club}</b> &amp; <b>${country}</b></div>`;
  if (winner) {
    const isMe = winner === myUsername;
    html += `<div style="margin-top:14px;" class="${isMe ? "win" : "lose"}">
      ${isMe ? "🎉 Doğru bildin! +1 puan" : `${winner} doğru bildi.`}
    </div>`;
    if (correctPlayerName) {
      html += `<div style="margin-top:6px; color:var(--text-dim); font-size:14px;">Doğru cevap: ${correctPlayerName}</div>`;
    }
  } else {
    html += `<div style="margin-top:14px; color:var(--text-dim);">Süre doldu, kimse bilemedi.</div>`;
  }
  resultBox.innerHTML = html;
});

// ---------------------------------------------------------------------------
// Oyun sonu
// ---------------------------------------------------------------------------
const finalScoresEl = document.getElementById("final-scores");
const finalTitleEl = document.getElementById("final-title");
const btnPlayAgain = document.getElementById("btn-play-again");

socket.on("game_over", ({ scores, winner }) => {
  clearInterval(countdownInterval);
  const iWon = winner === myUsername;
  finalTitleEl.textContent = winner === "Berabere" ? "Berabere! 🤝" : (iWon ? "Kazandın! 🏆" : "Kaybettin 😔");

  finalScoresEl.innerHTML = scores
    .map((s) => `<div class="final-row ${s.username === winner ? "winner" : ""}">
        <span>${s.username}</span><span>${s.score}</span>
      </div>`)
    .join("");

  showScreen("gameover");
});

btnPlayAgain.addEventListener("click", () => {
  window.location.reload();
});

// ---------------------------------------------------------------------------
// Rakip ayrıldı
// ---------------------------------------------------------------------------
const toastOpponentLeft = document.getElementById("toast-opponent-left");
socket.on("opponent_left", () => {
  clearInterval(countdownInterval);
  toastOpponentLeft.classList.remove("hidden");
  setTimeout(() => {
    toastOpponentLeft.classList.add("hidden");
    window.location.reload();
  }, 2500);
});

// ---------------------------------------------------------------------------
// Autocomplete dropdown render yardımcı fonksiyonu
// ---------------------------------------------------------------------------
function renderDropdown(container, items, showCountry, onPick, isPlayerList) {
  if (!items || items.length === 0) {
    container.classList.remove("show");
    container.innerHTML = "";
    return;
  }
  container.innerHTML = items
    .map((it) => {
      const name = it.name;
      let sub = "";
      if (isPlayerList) sub = it.sub || "";
      else if (showCountry) sub = it.country || "";
      return `<div class="dropdown-item" data-name="${escapeHtml(name)}">
        <span>${escapeHtml(name)}</span>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}
      </div>`;
    })
    .join("");
  container.classList.add("show");
  container.querySelectorAll(".dropdown-item").forEach((el) => {
    el.addEventListener("click", () => onPick(el.getAttribute("data-name")));
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Dropdown dışına tıklayınca kapat
document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrap")) {
    selectDropdown.classList.remove("show");
    guessDropdown.classList.remove("show");
  }
});

const socket = io();

// ---------------------------------------------------------------------------
// Appwrite Init & Auth
// ---------------------------------------------------------------------------
const appwriteClient = new Appwrite.Client();
appwriteClient
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('6ab635d20002717b9c3f');

const account = new Appwrite.Account(appwriteClient);
const databases = new Appwrite.Databases(appwriteClient);

const DB_ID = '6ab67acd00393caac3e0';
const COL_ID = '6ab67b1e00024e743b26';

// ---------------------------------------------------------------------------
// Ekran yönetimi
// ---------------------------------------------------------------------------
const screens = {
  auth: document.getElementById("screen-auth"),
  login: document.getElementById("screen-login"),
  lobby: document.getElementById("screen-lobby"),
  roomcode: document.getElementById("screen-room-code"),
  game: document.getElementById("screen-game"),
  gameover: document.getElementById("screen-gameover"),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => {
    if(s) s.classList.remove("active");
  });
  if(screens[name]) screens[name].classList.add("active");
}

let myUsername = "";
let myRole = null; // 'club' | 'country' bu tur icin
let currentMode = "country_club"; // 'country_club' | 'club_club'
let selectedMode = "country_club"; // giris ekraninda secili mod (pill)
let countdownInterval = null;

// ---------------------------------------------------------------------------
// EKRAN 0: Auth İşlemleri
// ---------------------------------------------------------------------------
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const authError = document.getElementById("auth-error");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  formLogin.classList.remove("hidden");
  formRegister.classList.add("hidden");
  authError.textContent = "";
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  formRegister.classList.remove("hidden");
  formLogin.classList.add("hidden");
  authError.textContent = "";
});

// Oturum kontrolü
async function checkSession() {
  try {
    const user = await account.get();
    // Kullanıcının ismini (username olarak kaydetmiştik) veya veritabanından username'i alalım.
    // Şimdilik Appwrite name alanında tuttuğumuzu varsayıyoruz, 
    // veya veritabanından çekebiliriz. Biz en kolayı account name'i kullanalım.
    // Eğer name boşsa veritabanından getirebiliriz.
    
    // Veritabanından username sorgulama:
    const docs = await databases.listDocuments(DB_ID, COL_ID, [
      Appwrite.Query.equal("userID", user.$id)
    ]);
    
    if (docs.documents.length > 0) {
      myUsername = docs.documents[0].username;
    } else {
      myUsername = user.name;
    }
    
    // Lobby'e (screen-login) geç
    usernameInput.value = myUsername;
    usernameInput.disabled = true; // Artık değiştiremesin
    showScreen("login");
  } catch (err) {
    // Oturum yok, auth ekranında kal
    showScreen("auth");
  }
}

// Kayıt Ol
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("reg-email").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const pass = document.getElementById("reg-password").value;
  const passConfirm = document.getElementById("reg-password-confirm").value;

  if (pass !== passConfirm) {
    return authError.textContent = "Şifreler eşleşmiyor!";
  }

  try {
    authError.textContent = "Kullanıcı adı kontrol ediliyor...";
    // Kullanıcı adı alınmış mı kontrol et
    const existing = await databases.listDocuments(DB_ID, COL_ID, [
      Appwrite.Query.equal("username", username)
    ]);
    if (existing.documents.length > 0) {
      return authError.textContent = "Bu kullanıcı adı zaten alınmış!";
    }

    authError.textContent = "Kayıt olunuyor...";
    const user = await account.create(Appwrite.ID.unique(), email, pass, username);
    
    // Veritabanına yaz
    await databases.createDocument(DB_ID, COL_ID, Appwrite.ID.unique(), {
      userID: user.$id,
      username: username,
      eMail: email // Kullanıcının oluşturduğu eMail büyük M ile
    });

    authError.textContent = "Kayıt başarılı, giriş yapılıyor...";
    await account.createEmailPasswordSession(email, pass);
    checkSession();

  } catch (err) {
    console.error(err);
    if (err.message.includes("already exists")) {
      authError.textContent = "Bu mail zaten mevcut, lütfen giriş yapın.";
    } else {
      authError.textContent = err.message || "Kayıt olurken bir hata oluştu.";
    }
  }
});

// Giriş Yap
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const pass = document.getElementById("login-password").value;

  try {
    authError.textContent = "Kullanıcı aranıyor...";
    // Username ile DB'den email bul
    const docs = await databases.listDocuments(DB_ID, COL_ID, [
      Appwrite.Query.equal("username", username)
    ]);
    
    if (docs.documents.length === 0) {
      return authError.textContent = "Bu kullanıcı adına sahip bir hesap bulunamadı.";
    }
    
    const email = docs.documents[0].eMail || docs.documents[0].email; // Fallback in case they fix it
    authError.textContent = "Giriş yapılıyor...";
    await account.createEmailPasswordSession(email, pass);
    checkSession();
  } catch (err) {
    console.error(err);
    authError.textContent = "Hatalı şifre veya giriş başarısız.";
  }
});

// Google Login
document.getElementById("btn-google-login").addEventListener("click", () => {
  account.createOAuth2Session('google', window.location.href, window.location.href);
});

// Uygulama açılışında session kontrolü
checkSession();

// ---------------------------------------------------------------------------
// EKRAN 1: Giriş / Lobi (Mod Seçimi)
// ---------------------------------------------------------------------------
const usernameInput = document.getElementById("username-input");
const loginError = document.getElementById("login-error");
const modePills = document.querySelectorAll(".mode-pill");
const btnQuickMatch = document.getElementById("btn-quick-match");
const btnCreateRoom = document.getElementById("btn-create-room");
const roomCodeInput = document.getElementById("room-code-input");
const btnJoinCode = document.getElementById("btn-join-code");

modePills.forEach((pill) => {
  pill.addEventListener("click", () => {
    modePills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    selectedMode = pill.getAttribute("data-mode");
  });
});

function requireUsername() {
  const name = usernameInput.value.trim();
  if (!name) {
    loginError.textContent = "Lütfen bir kullanıcı adı gir.";
    return null;
  }
  loginError.textContent = "";
  myUsername = name;
  return name;
}

btnQuickMatch.addEventListener("click", () => {
  const name = requireUsername();
  if (!name) return;
  socket.emit("join_lobby", { username: name, mode: selectedMode });
});

btnCreateRoom.addEventListener("click", () => {
  const name = requireUsername();
  if (!name) return;
  socket.emit("create_room", { username: name, mode: selectedMode });
});

btnJoinCode.addEventListener("click", () => {
  const name = requireUsername();
  if (!name) return;
  const code = roomCodeInput.value.trim();
  if (!code) {
    loginError.textContent = "Lütfen bir oda kodu gir.";
    return;
  }
  socket.emit("join_room_by_code", { username: name, code });
});

usernameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnQuickMatch.click(); });
roomCodeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnJoinCode.click(); });
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});

socket.on("lobby_waiting", () => showScreen("lobby"));

// --- Oda kodu ile oynama ---
const roomCodeDisplay = document.getElementById("room-code-display");
const btnCopyCode = document.getElementById("btn-copy-code");

socket.on("room_created", ({ code }) => {
  roomCodeDisplay.textContent = code;
  showScreen("roomcode");
});

btnCopyCode.addEventListener("click", () => {
  const code = roomCodeDisplay.textContent;
  if (navigator.clipboard && code) {
    navigator.clipboard.writeText(code).then(() => {
      btnCopyCode.textContent = "✅ Kopyalandı";
      setTimeout(() => { btnCopyCode.textContent = "📋 Kodu Kopyala"; }, 1500);
    }).catch(() => {});
  }
});

socket.on("room_join_error", ({ reason }) => {
  showScreen("login");
  if (reason === "self") {
    loginError.textContent = "Kendi oluşturduğun odaya katılamazsın.";
  } else {
    loginError.textContent = "Bu kodla bir oda bulunamadı. Kodu kontrol et.";
  }
});

// ---------------------------------------------------------------------------
// EKRAN 3: Oyun — eşleşme
// ---------------------------------------------------------------------------
const meNameEl = document.getElementById("me-name");
const oppNameEl = document.getElementById("opp-name");
const meScoreEl = document.getElementById("me-score");
const oppScoreEl = document.getElementById("opp-score");
const roundNumEl = document.getElementById("round-num");
const roundTotalEl = document.getElementById("round-total");
const modeIndicatorEl = document.getElementById("mode-indicator");
const timerEl = document.getElementById("timer");

const MODE_LABELS = {
  country_club: "Ülke - Kulüp",
  club_club: "Kulüp - Kulüp",
};

let opponentName = "";

socket.on("match_found", ({ you, opponent, mode }) => {
  myUsername = you;
  opponentName = opponent;
  currentMode = mode || "country_club";
  meNameEl.textContent = you;
  oppNameEl.textContent = opponent;
  modeIndicatorEl.textContent = MODE_LABELS[currentMode] || "";
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

socket.on("round_start", ({ round, totalRounds, seconds, roles, scores, mode }) => {
  roundNumEl.textContent = round;
  roundTotalEl.textContent = totalRounds;
  currentMode = mode || currentMode;
  modeIndicatorEl.textContent = MODE_LABELS[currentMode] || "";
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
const selectComboState = { index: -1 };
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
      }, false, selectComboState);
    });
  }, 120);
});

selectInput.addEventListener("keydown", (e) => {
  handleComboKeydown(e, selectDropdown, selectComboState, (val) => {
    selectInput.value = val;
    selectedCriteriaValue = val;
    btnSubmitCriteria.disabled = false;
    selectDropdown.classList.remove("show");
    if (!criteriaSubmitted) btnSubmitCriteria.click(); // hiz icin: sec + gonder tek Enter'da
  });
  if (e.key === "Enter" && !selectDropdown.classList.contains("show")) {
    if (!criteriaSubmitted && selectedCriteriaValue) btnSubmitCriteria.click();
  }
});

btnSubmitCriteria.addEventListener("click", () => {
  if (!selectedCriteriaValue || criteriaSubmitted) return;
  criteriaSubmitted = true;
  btnSubmitCriteria.disabled = true;
  selectInput.disabled = true;
  selectStatus.textContent = "Gönderildi. Rakibin seçimini bekliyoruz...";
  socket.emit("submit_criteria", { value: selectedCriteriaValue });
});

socket.on("opponent_submitted_criteria", ({ fromSocketId }) => {
  if (fromSocketId !== socket.id && !criteriaSubmitted) {
    selectStatus.textContent = "Rakip seçimini yaptı! Sıra sende.";
    selectStatus.className = "status-text ok";
  }
});

socket.on("criteria_rejected", ({ reason }) => {
  if (reason === "same_club") {
    criteriaSubmitted = false;
    selectedCriteriaValue = null;
    selectInput.disabled = false;
    selectInput.value = "";
    btnSubmitCriteria.disabled = true;
    selectStatus.textContent = "Rakibin de bu kulübü seçti! Farklı bir kulüp dene.";
    selectStatus.className = "status-text warn";
    selectInput.focus();
  }
});

// ---------------------------------------------------------------------------
// Kriterler kilitlendi -> tahmin aşaması
// ---------------------------------------------------------------------------
const criteriaRevealEl = document.getElementById("criteria-reveal");
const guessInput = document.getElementById("guess-input");
const guessDropdown = document.getElementById("guess-dropdown");
const btnSubmitGuess = document.getElementById("btn-submit-guess");
const guessStatus = document.getElementById("guess-status");

let guessLockedUntil = 0;

function renderCriteriaChips(chips) {
  if (!chips || chips.length < 2) { criteriaRevealEl.innerHTML = ""; return; }
  const [c1, c2] = chips;
  criteriaRevealEl.innerHTML = `
    <div class="criteria-chip club-chip">${c1.icon} <span>${escapeHtml(String(c1.value))}</span></div>
    <div class="criteria-plus">+</div>
    <div class="criteria-chip country-chip">${c2.icon} <span>${escapeHtml(String(c2.value))}</span></div>
  `;
}

socket.on("criteria_locked", ({ chips, seconds, mode }) => {
  currentMode = mode || currentMode;
  renderCriteriaChips(chips);
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
const guessComboState = { index: -1 };
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
        true,
        guessComboState
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
guessInput.addEventListener("keydown", (e) => {
  handleComboKeydown(e, guessDropdown, guessComboState, (val) => {
    guessInput.value = val;
    guessDropdown.classList.remove("show");
    trySubmitGuess(); // hiz icin: sec + gonder tek Enter'da
  });
  if (e.key === "Enter" && !guessDropdown.classList.contains("show")) {
    trySubmitGuess();
  }
});

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

socket.on("round_result", ({ winner, correctPlayerName, chips, scores }) => {
  clearInterval(countdownInterval);
  updateScores(scores);
  showPhase("result");
  timerEl.textContent = "—";

  const critText = chips ? chips.map((c) => c.value).join(" & ") : "";
  let html = `<div>Kriter: <b>${escapeHtml(critText)}</b></div>`;
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
function renderDropdown(container, items, showCountry, onPick, isPlayerList, state) {
  if (state) state.index = -1;
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

// Autocomplete kutularinda Tab/Ok tuslariyla gezinme, Enter ile secip gonderme.
function setDropdownHighlight(dropdown, index) {
  const items = Array.from(dropdown.querySelectorAll(".dropdown-item"));
  items.forEach((el, i) => el.classList.toggle("active-item", i === index));
  if (index >= 0 && items[index]) items[index].scrollIntoView({ block: "nearest" });
  return items;
}

function handleComboKeydown(e, dropdown, state, onPickAndSubmit) {
  const isOpen = dropdown.classList.contains("show");
  const items = isOpen ? Array.from(dropdown.querySelectorAll(".dropdown-item")) : [];
  if (!isOpen || items.length === 0) return;

  if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
    e.preventDefault();
    state.index = (state.index + 1) % items.length;
    setDropdownHighlight(dropdown, state.index);
    return;
  }
  if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
    e.preventDefault();
    state.index = (state.index - 1 + items.length) % items.length;
    setDropdownHighlight(dropdown, state.index);
    return;
  }
  if (e.key === "Enter" && state.index >= 0) {
    e.preventDefault();
    const val = items[state.index].getAttribute("data-name");
    state.index = -1;
    onPickAndSubmit(val);
    return;
  }
  if (e.key === "Escape") {
    dropdown.classList.remove("show");
    state.index = -1;
  }
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

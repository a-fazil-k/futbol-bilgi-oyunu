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
const googleProvider = Appwrite.OAuthProvider.Google;

const DB_ID = '6ab67acd00393caac3e0';
const COL_ID = '6ab67b1e00024e743b26';

// ---------------------------------------------------------------------------
// Ekran yönetimi
// ---------------------------------------------------------------------------
const screens = {
  loading: document.getElementById("screen-loading"),
  auth: document.getElementById("screen-auth"),
  oauthSuccess: document.getElementById("screen-oauth-success"),
  oauthFailure: document.getElementById("screen-oauth-failure"),
  usernameSetup: document.getElementById("screen-username-setup"),
  verifyNotice: document.getElementById("screen-verify-notice"),
  login: document.getElementById("screen-login"),
  createRoom: document.getElementById("screen-create-room"),
  serverBrowser: document.getElementById("screen-server-browser"),
  roomLobby: document.getElementById("screen-room-lobby"),
  lobby: document.getElementById("screen-lobby"),
  roomcode: document.getElementById("screen-room-code"),
  game: document.getElementById("screen-game"),
  gameover: document.getElementById("screen-gameover"),
};
let verifyPollingInterval = null;
function showScreen(name) {
  Object.values(screens).forEach((s) => {
    if(s) s.classList.remove("active");
  });
  if(screens[name]) screens[name].classList.add("active");
  
  // E-posta doğrulama ekranındaysa periyodik olarak kontrol et
  if (name === "verifyNotice") {
    if (!verifyPollingInterval) {
      verifyPollingInterval = setInterval(async () => {
        try {
          const u = await account.get();
          if (u.emailVerification) {
            clearInterval(verifyPollingInterval);
            verifyPollingInterval = null;
            checkSession(); // Doğrulandıysa hemen giriş yap
          }
        } catch (e) {}
      }, 3000);
    }
  } else {
    clearInterval(verifyPollingInterval);
    verifyPollingInterval = null;
  }
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
const authSubtitle = document.getElementById("auth-subtitle");
const dashboardUserName = document.getElementById("dashboard-user-name");
const formUsernameSetup = document.getElementById("form-username-setup");
const setupUsernameInput = document.getElementById("setup-username");
const usernameSetupError = document.getElementById("username-setup-error");
let pendingDashboardUser = null;
let pendingUsernameProfile = null;

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  formLogin.classList.remove("hidden");
  formRegister.classList.add("hidden");
  authSubtitle.textContent = "Giriş yap veya yeni hesap oluştur.";
  authError.textContent = "";
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  formRegister.classList.remove("hidden");
  formLogin.classList.add("hidden");
  authError.textContent = "";
});

function showUsernameSetup(user, profile = null, errorMessage = "") {
  pendingDashboardUser = user;
  pendingUsernameProfile = profile;
  setupUsernameInput.value = (
    (profile && profile.username) ||
    user.name ||
    (user.email ? user.email.split("@")[0] : "")
  ).slice(0, 20);
  usernameSetupError.textContent = errorMessage;
  showScreen("usernameSetup");
  setupUsernameInput.focus();
}

function renderDashboard(username) {
  myUsername = username;
  dashboardUserName.textContent = myUsername;
  const dashboardUsernameInput = document.getElementById("username-input");
  dashboardUsernameInput.value = myUsername;
  dashboardUsernameInput.disabled = true;
  showScreen("login");
}

async function loadDashboard(user) {
  let profile = null;
  try {
    const docs = await databases.listDocuments(DB_ID, COL_ID, [
      Appwrite.Query.equal("userID", user.$id)
    ]);
    profile = docs.documents[0] || null;
  } catch (error) {
    console.warn("Kullanıcı adı profili yüklenemedi.", error);
    showUsernameSetup(
      user,
      null,
      "Kullanıcı adı profili kontrol edilemedi. Tekrar kaydetmeyi deneyebilirsin."
    );
    return;
  }

  const justSignedInWithGoogle =
    sessionStorage.getItem("googleOAuthPendingUsername") === user.$id;
  if (!profile || justSignedInWithGoogle) {
    showUsernameSetup(user, profile);
    return;
  }

  renderDashboard(profile.username || user.name || user.email || "Oyuncu");
}

async function checkSession() {
  try {
    const user = await account.get();
    if (user.email && user.emailVerification === false) {
      document.getElementById("notice-email").textContent = user.email;
      showScreen("verifyNotice");
      return;
    }
    if (window.location.pathname !== "/dashboard") {
      window.location.assign("/dashboard");
      return;
    }
    await loadDashboard(user);
  } catch (_error) {
    if (window.location.pathname !== "/auth") {
      window.location.assign("/auth");
      return;
    }
    showScreen("auth");
  }
}

async function handleOAuthSuccess() {
  showScreen("oauthSuccess");
  const callbackUrl = new URL(window.location.href);
  const secret = callbackUrl.searchParams.get("secret");
  const userId = callbackUrl.searchParams.get("userId");
  const errorElement = document.getElementById("oauth-success-error");
  const backLink = document.getElementById("oauth-success-back");

  try {
    if (!secret || !userId) throw new Error("Missing OAuth credentials");
    await account.createSession({ userId, secret });
    sessionStorage.setItem("googleOAuthPendingUsername", userId);
    window.history.replaceState({}, document.title, "/auth/success");
    window.location.assign("/dashboard");
  } catch (error) {
    console.error("OAuth oturumu oluşturulamadı.", error);
    errorElement.textContent = error.message || "OAuth oturumu oluşturulamadı.";
    backLink.classList.remove("hidden");
  }
}

async function initializeAuthRoute() {
  const path = window.location.pathname;

  if (path === "/auth/success") {
    await handleOAuthSuccess();
    return;
  }

  if (path === "/auth/failure") {
    const callbackUrl = new URL(window.location.href);
    const message =
      callbackUrl.searchParams.get("error") ||
      callbackUrl.searchParams.get("message") ||
      "Kimlik doğrulama tamamlanamadı.";
    document.getElementById("oauth-failure-message").textContent = message;
    showScreen("oauthFailure");
    return;
  }

  if (path === "/auth") {
    try {
      await account.get();
      window.location.assign("/dashboard");
    } catch (_error) {
      showScreen("auth");
    }
    return;
  }

  if (path === "/dashboard") {
    try {
      const user = await account.get();
      await loadDashboard(user);
    } catch (_error) {
      window.location.assign("/auth");
    }
    return;
  }

  // Mevcut e-posta doğrulama bağlantıları kök route'a geri dönüyor.
  const verificationUrl = new URL(window.location.href);
  const secret = verificationUrl.searchParams.get("secret");
  const userId = verificationUrl.searchParams.get("userId");
  if (secret && userId) {
    try {
      await account.updateVerification({ userId, secret });
    } catch (error) {
      console.error("E-posta doğrulanamadı.", error);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  await checkSession();
}

// ==========================================
// EKRAN 0.5: DOĞRULAMA UYARI EKRANI İŞLEMLERİ
// ==========================================

document.getElementById("btn-resend-verify").addEventListener("click", async () => {
  const btn = document.getElementById("btn-resend-verify");
  try {
    btn.disabled = true;
    btn.textContent = "⏳ Gönderiliyor...";
    await account.createVerification(window.location.origin + window.location.pathname);
    
    const errEl = document.getElementById("verify-error");
    errEl.style.color = "green";
    errEl.textContent = "Doğrulama maili tekrar gönderildi. Lütfen e-postanızı kontrol edin.";
    
    setTimeout(() => { 
      btn.disabled = false; 
      btn.textContent = "🔄 Tekrar Gönder"; 
      errEl.style.color = "";
      errEl.textContent = "";
    }, 10000); // 10 saniye bekleme süresi
  } catch (err) {
    document.getElementById("verify-error").style.color = "red";
    document.getElementById("verify-error").textContent = "Hata: " + err.message;
    btn.disabled = false;
    btn.textContent = "🔄 Tekrar Gönder";
  }
});

document.getElementById("btn-logout-verify").addEventListener("click", async () => {
  await account.deleteSession({ sessionId: "current" });
  window.location.assign("/auth");
});

// ---------------------------------------------------------------------------
// KAYIT (Appwrite Email Verification)
// ---------------------------------------------------------------------------
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const email = document.getElementById("reg-email").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const pass = document.getElementById("reg-password").value;
  const passConfirm = document.getElementById("reg-password-confirm").value;

  if (pass.length < 8) {
    return authError.textContent = "Şifre en az 8 karakter olmalı.";
  }
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
      eMail: email
    });

    authError.textContent = "Giriş yapılıyor...";
    await account.createEmailPasswordSession(email, pass);
    
    authError.textContent = "Doğrulama bağlantısı gönderiliyor...";
    await account.createVerification(window.location.origin + window.location.pathname);
    
    checkSession();

  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes("already exists")) {
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

async function signInWithGoogle() {
  const button = document.getElementById("btn-google-login");
  const success = `${window.location.origin}/auth/success`;
  const failure = `${window.location.origin}/auth/failure`;

  try {
    button.disabled = true;
    authError.textContent = "";
    // Bu çağrı tarayıcıyı Google'a yönlendirir; ayrıca redirect yapılmamalı.
    await account.createOAuth2Token({
      provider: googleProvider,
      success,
      failure,
    });
  } catch (error) {
    console.error("Google OAuth başlatılamadı.", error);
    authError.textContent = error.message || "Google ile giriş başlatılamadı.";
    button.disabled = false;
  }
}

document.getElementById("btn-google-login").addEventListener("click", signInWithGoogle);

// Misafir Girişi (Guest Login)
document.getElementById("btn-guest-login").addEventListener("click", async () => {
  try {
    authError.textContent = "Misafir girişi yapılıyor...";
    
    // Eğer önceden açık bir session varsa sil
    try { await account.deleteSession("current"); } catch(e) {}
    
    // Appwrite Anonim Session Oluştur
    const session = await account.createAnonymousSession();
    
    // Rastgele Guest ismi oluştur
    const guestName = "Guest_" + Math.floor(10000 + Math.random() * 90000);
    
    // DB'ye misafir kaydını at
    await databases.createDocument(DB_ID, COL_ID, Appwrite.ID.unique(), {
      userID: session.userId,
      username: guestName,
      eMail: `guest_${session.userId}@guest.com`
    });
    
    // Direkt olarak Dashboard(Lobi) ekranına at, sayfa yenileme
    renderDashboard(guestName);
  } catch (err) {
    console.error(err);
    authError.textContent = "Misafir girişi başarısız. Appwrite ayarlarında 'Anonymous' girişi aktif olmayabilir.";
  }
});

formUsernameSetup.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = setupUsernameInput.value.trim();
  const saveButton = document.getElementById("btn-save-username");

  if (!username) {
    usernameSetupError.textContent = "Lütfen bir kullanıcı adı gir.";
    return;
  }

  try {
    saveButton.disabled = true;
    usernameSetupError.textContent = "Kullanıcı adı kontrol ediliyor...";
    const user = pendingDashboardUser || await account.get();
    const [matchingProfiles, ownProfiles] = await Promise.all([
      databases.listDocuments(DB_ID, COL_ID, [
        Appwrite.Query.equal("username", username)
      ]),
      databases.listDocuments(DB_ID, COL_ID, [
        Appwrite.Query.equal("userID", user.$id)
      ]),
    ]);
    const usernameBelongsToAnotherUser = matchingProfiles.documents.some(
      (profile) => profile.userID !== user.$id
    );
    if (usernameBelongsToAnotherUser) {
      usernameSetupError.textContent = "Bu kullanıcı adı zaten alınmış.";
      return;
    }

    usernameSetupError.textContent = "Kullanıcı adı kaydediliyor...";
    await account.updateName({ name: username });
    const profileData = {
      userID: user.$id,
      username,
      eMail: user.email,
    };
    const existingProfile = pendingUsernameProfile || ownProfiles.documents[0];
    if (existingProfile) {
      await databases.updateDocument(
        DB_ID,
        COL_ID,
        existingProfile.$id,
        profileData
      );
    } else {
      await databases.createDocument(
        DB_ID,
        COL_ID,
        Appwrite.ID.unique(),
        profileData
      );
    }

    sessionStorage.removeItem("googleOAuthPendingUsername");
    pendingDashboardUser = null;
    pendingUsernameProfile = null;
    const updatedUser = await account.get();
    await loadDashboard(updatedUser);
  } catch (error) {
    console.error("Kullanıcı adı kaydedilemedi.", error);
    usernameSetupError.textContent =
      error.message || "Kullanıcı adı kaydedilemedi. Tekrar deneyin.";
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById("btn-logout-setup").addEventListener("click", async () => {
  await account.deleteSession({ sessionId: "current" });
  sessionStorage.removeItem("googleOAuthPendingUsername");
  window.location.assign("/auth");
});

// Route guard ve callback işlemleri, korumalı UI gösterilmeden tamamlanır.
initializeAuthRoute();

// Çıkış Yap (Logout)
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await account.deleteSession("current");
    } catch (e) {
      console.warn("Logout error:", e);
    }
    // Sayfayı yenilemeden direkt giriş ekranına dön
    window.history.pushState({}, "", "/");
    showScreen("auth");
  });
}

// ---------------------------------------------------------------------------
// EKRAN 1: Giriş / Lobi (Mod Seçimi)
// ---------------------------------------------------------------------------
const usernameInput = document.getElementById("username-input");
const loginError = document.getElementById("login-error");
const modePills = document.querySelectorAll(".mode-pill");
const btnQuickMatch = document.getElementById("btn-quick-match");
const btnServerBrowser = document.getElementById("btn-server-browser");
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

btnServerBrowser.addEventListener("click", () => {
  const name = requireUsername();
  if (!name) return;
  showScreen("serverBrowser");
  document.getElementById("room-list-container").innerHTML = '<p class="subtitle" style="margin-top: 80px;">Odalar aranıyor...</p>';
  socket.emit("fetch_rooms");
});

btnCreateRoom.addEventListener("click", () => {
  const name = requireUsername();
  if (!name) return;
  showScreen("createRoom");
});

// ==========================================
// YENİ: ODA OLUŞTURMA & LOBİ UI EVENTLERİ
// ==========================================
const selectRoomType = document.getElementById("select-room-type");
const groupRoomCapacity = document.getElementById("group-room-capacity");

const selectRoomCapacity = document.getElementById("select-room-capacity");

selectRoomType.addEventListener("change", (e) => {
  const mode = e.target.value;
  if (mode === "1v1") {
    groupRoomCapacity.style.display = "none";
  } else {
    groupRoomCapacity.style.display = "block";
    selectRoomCapacity.innerHTML = "";
    
    if (mode === "league") {
      // Lig Usulü: 2 ile 10 arası ve Sınırsız
      for (let i = 2; i <= 10; i++) {
        selectRoomCapacity.innerHTML += `<option value="${i}">${i} Oyuncu</option>`;
      }
      selectRoomCapacity.innerHTML += `<option value="99">Farketmez (Sınırsız)</option>`;
    } else if (mode === "knockout") {
      // Eleme Usulü: Sadece 2'nin katları
      [4, 8, 16, 32].forEach(num => {
        selectRoomCapacity.innerHTML += `<option value="${num}">${num} Oyuncu</option>`;
      });
    }
  }
});

document.getElementById("btn-cancel-create-room").addEventListener("click", () => {
  showScreen("login");
});

document.getElementById("btn-confirm-create-room").addEventListener("click", () => {
  const mode = selectRoomType.value;
  const privacy = document.getElementById("select-room-privacy").value;
  const capacity = document.getElementById("select-room-capacity").value;
  
  socket.emit("create_advanced_room", { 
    username: myUsername, 
    gameMode: selectedMode, // country_club vb
    roomMode: mode,         // 1v1, league, knockout
    privacy, 
    capacity: mode === "1v1" ? 2 : parseInt(capacity) 
  });
});

document.getElementById("btn-back-from-browser").addEventListener("click", () => {
  showScreen("login");
});

document.getElementById("btn-refresh-rooms").addEventListener("click", () => {
  document.getElementById("room-list-container").innerHTML = '<p class="subtitle" style="margin-top: 80px;">Odalar aranıyor...</p>';
  socket.emit("fetch_rooms");
});

document.getElementById("btn-leave-room").addEventListener("click", () => {
  socket.emit("leave_advanced_room");
  showScreen("login");
});

let currentAdvancedRoom = null;

document.getElementById("btn-start-room").addEventListener("click", () => {
  if (currentAdvancedRoom && currentAdvancedRoom.players.length < 2) {
    alert("Oyunu başlatmak için en az 2 kişi olmalı!");
    return;
  }
  socket.emit("start_advanced_room");
});

socket.on("tournament_started", (room) => {
  currentAdvancedRoom = room;
  showScreen("tournamentLobby");
  
  if (room.roomMode === "league") {
    document.getElementById("league-standings-container").classList.remove("hidden");
    document.getElementById("knockout-bracket-container").classList.add("hidden");
    // Puan durumunu doldur (Başlangıçta hepsi 0)
    const tbody = document.getElementById("league-standings-body");
    tbody.innerHTML = "";
    room.players.forEach((p, idx) => {
      tbody.innerHTML += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px;">${idx + 1}</td>
          <td style="padding:10px;">${p.username} ${p.id === room.hostId ? '👑' : ''}</td>
          <td style="padding:10px;">0</td>
          <td style="padding:10px;">0</td>
          <td style="padding:10px;">0</td>
          <td style="padding:10px;">0</td>
          <td style="padding:10px;">0</td>
          <td style="padding:10px; font-weight:bold; color:#FFD700;">0</td>
        </tr>
      `;
    });
  } else if (room.roomMode === "knockout") {
    document.getElementById("league-standings-container").classList.add("hidden");
    document.getElementById("knockout-bracket-container").classList.remove("hidden");
    document.getElementById("knockout-bracket").innerHTML = `<p class="subtitle">Eşleşmeler oluşturuluyor...</p>`;
  }
});

// ==========================================
// SOCKET LİSTENERS (SERVER BROWSER & LOBBY)
// ==========================================
socket.on("rooms_list", (rooms) => {
  const container = document.getElementById("room-list-container");
  container.innerHTML = "";
  
  if (rooms.length === 0) {
    container.innerHTML = '<p class="subtitle" style="margin-top: 80px;">Açık oda bulunamadı. Kendi odanı kurabilirsin!</p>';
    return;
  }

  rooms.forEach(room => {
    const isFull = room.players.length >= room.capacity;
    
    let typeName = "1v1 Klasik";
    if (room.roomMode === "league") typeName = "🏆 Lig Turnuvası";
    if (room.roomMode === "knockout") typeName = "⚔️ Eleme Turnuvası";

    const div = document.createElement("div");
    div.style = "background: rgba(0,0,0,0.3); margin-bottom: 10px; padding: 10px; border-radius: 8px; text-align: left; display: flex; justify-content: space-between; align-items: center;";
    
    div.innerHTML = `
      <div>
        <strong style="color: #4CAF50;">${room.hostName}'in Odası</strong> <span style="font-size:12px; color:#aaa;">(${room.gameMode === 'country_club' ? 'Ülke+Kulüp' : 'Kulüp+Kulüp'})</span><br>
        <span style="font-size: 14px;">${typeName}</span><br>
        <span style="font-size: 12px; color: ${isFull ? '#ff4d4d' : '#FFD700'}">Kişi: ${room.players.length}/${room.capacity}</span>
      </div>
      <button class="btn-primary btn-small" ${isFull ? 'disabled' : ''} onclick="joinRoomByCode('${room.code}')">${isFull ? 'DOLU' : 'KATIL'}</button>
    `;
    container.appendChild(div);
  });
});

window.joinRoomByCode = function(code) {
  const name = requireUsername();
  if (!name) return;
  socket.emit("join_advanced_room", { username: name, code });
};

socket.on("room_lobby_update", (room) => {
  currentAdvancedRoom = room;
  showScreen("roomLobby");
  
  document.getElementById("lobby-room-name").textContent = `${room.hostName}'in Odası`;
  document.getElementById("lobby-room-code").textContent = room.code;
  
  let typeName = "1v1 Klasik";
  if (room.roomMode === "league") typeName = "Lig Turnuvası";
  if (room.roomMode === "knockout") typeName = "Eleme Turnuvası";
  
  document.getElementById("lobby-room-desc").textContent = `${typeName} (${room.players.length}/${room.capacity} Oyuncu)`;
  
  const pList = document.getElementById("lobby-player-list");
  pList.innerHTML = "";
  
  room.players.forEach(p => {
    const li = document.createElement("li");
    li.style = "padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 16px;";
    li.innerHTML = p.id === room.hostId ? `👑 <b>${p.username}</b>` : `👤 ${p.username}`;
    pList.appendChild(li);
  });
  
  // Eğer bu kişi host ise başlat butonu görünür (en az 2 kişi lazım başlatmak için)
  const isHost = socket.id === room.hostId;
  const btnStart = document.getElementById("btn-start-room");
  const waitMsg = document.getElementById("lobby-waiting-host");
  
  if (isHost) {
    btnStart.classList.remove("hidden");
    waitMsg.classList.add("hidden");
    btnStart.disabled = room.players.length < 2; 
    btnStart.textContent = room.players.length < 2 ? "⏳ BEKLENİYOR..." : "🚀 OYUNU BAŞLAT";
  } else {
    btnStart.classList.add("hidden");
    waitMsg.classList.remove("hidden");
  }
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

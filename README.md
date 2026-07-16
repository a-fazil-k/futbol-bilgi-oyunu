# ⚽ Futbol Bilgi Düellosu — Gerçek Zamanlı 2 Oyunculu

Node.js + Express + Socket.io + better-sqlite3 ile yazılmış, karanlık temalı,
neon yeşil detaylı, gerçek zamanlı 2 oyunculu futbol tahmin oyunu.

## Kurulum

```bash
npm install
npm start
```

Sunucu `http://localhost:3000` adresinde açılır. İlk çalıştırmada `db/football.db`
yoksa otomatik olarak oluşturulur ve seed edilir (kulüpler, ülkeler, oyuncular).

Oyunu test etmek için **iki farklı sekme/tarayıcı** açıp iki farklı kullanıcı adıyla
lobiye girmen yeterli — sistem otomatik eşleştirir.

## Veri Kapsamı

- **276 kulüp** (Süper Lig'in alt sıralarındaki takımlar (Samsunspor, Adana
  Demirspor, Konyaspor, Alanyaspor vb.) ve Premier League/LaLiga/Bundesliga/
  Serie A/Ligue 1'in alt sıralarındaki kulüpler dahil)
- **90+ ülke**
- **653 futbolcu** (isim, uyruk, kariyer kulüpleri JSON dizisi olarak — kulüp
  listesi oyuncunun kariyeri boyunca oynadığı TÜM kulüpleri kapsar, sadece
  güncel kulübü değil. Örn. Arda Turan -> Galatasaray, Atletico Madrid,
  Barcelona hepsi doğru cevap sayılır. Hem güncel yıldızlar hem de geniş bir
  yıl aralığına yayılan tarihi efsaneler (1970'lerden günümüze) dahil.)

> Not: Doğruluk (yanlış veri = bozuk oyun mantığı) önceliği nedeniyle
> güvenle hatırlayabildiğim oyunculara odaklandım. `db/seed.js`
> içindeki `PLAYERS` dizisine aynı formatta
> `["İsim", "Uyruk", ["Kulüp1", "Kulüp2"]]` satırları ekleyerek listeyi
> istediğin kadar genişletebilirsin — yeni kulüpler otomatik olarak `clubs`
> tablosuna da eklenir.

## Oyun Akışı

1. Kullanıcı adı gir → Lobi → otomatik eşleşme (2 oyuncu).
2. **Seçim aşaması (10 sn):** Bir oyuncu Kulüp, diğeri Ülke seçer (autocomplete).
3. **Tahmin aşaması (15 sn):** Kriterler açılır, her iki oyuncu da futbolcu adı
   yazar (autocomplete). İlk doğru cevabı veren +1 puan alır. Yanlış cevap
   3 saniye cevap kilidi getirir.
4. Roller her tur değişir. Toplam **5 tur** sonunda en yüksek skor kazanır.

## Dosya Yapısı

```
server.js         Express + Socket.io sunucusu, oda/tur/zamanlayıcı mantığı
db/seed.js         SQLite şeması + seed verisi (clubs, countries, players)
public/index.html  Arayüz iskeleti
public/style.css   Karanlık tema / neon yeşil / kırmızı geri sayım
public/app.js      İstemci tarafı socket mantığı ve autocomplete
```

## 🌐 Online Yayına Alma (Deploy)

Bu proje **canlı bir Node.js sunucusu** (websocket + SQLite state) çalıştırır,
bu yüzden Vercel/Netlify gibi statik hosting'ler **çalışmaz**. Sürekli açık
kalan bir Node sunucusu barındıran bir platform gerekir. En kolay iki seçenek:

### Seçenek A — Render.com (ücretsiz, kalıcı link)

1. Bu proje klasörünü bir GitHub reposuna yükle (`git init && git add . && git commit -m "init" && git push`).
2. [render.com](https://render.com) → **New +** → **Web Service** → GitHub reponu bağla.
3. Ayarlar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (yeterli)
4. Deploy'a bas. Birkaç dakika sonra `https://senin-proje-adin.onrender.com`
   gibi bir link verir — bu linki herkesle paylaşabilirsin.
5. Not: Render'ın ücretsiz planı, uzun süre istek gelmezse sunucuyu uyutur;
   ilk bağlantıda 30-60 saniye "uyanma" gecikmesi olabilir.

### Seçenek B — Railway.app (ücretsiz kota, hızlı)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
   (veya CLI: `npm i -g @railway/cli && railway login && railway init && railway up`).
2. Railway `package.json`'daki `start` script'ini otomatik algılar, ek ayar gerekmez.
3. **Settings → Networking → Generate Domain** ile herkese açık bir link üretir.

### Seçenek C — Replit (en hızlı, test için ideal)

1. [replit.com](https://replit.com) → **Create App** → bu klasörü zip olarak import et.
2. Replit otomatik `npm install` çalıştırır. **Run** butonuna bas.
3. Sağ üstte açılan pencere/URL, dışarıya açık bir linktir — direkt paylaşabilirsin.
4. Not: Ücretsiz Replit'lerde uygulama, sekmeyi kapatıp bir süre sonra uykuya
   dalabilir; "Always On" özelliği ücretlidir.

### Genel notlar

- `PORT` ortam değişkenini platform zaten otomatik sağlar (`process.env.PORT`
  kodda zaten kullanılıyor, ekstra ayar gerekmez).
- SQLite dosyası (`db/football.db`) ilk açılışta otomatik oluşturulur. Bazı
  platformlarda (Render/Railway free tier) dosya sistemi **kalıcı değildir** —
  her deploy'da veri sıfırlanır. Bu oyun için sorun değil çünkü veritabanı
  zaten sadece referans verisi (kulüp/ülke/oyuncu) tutuyor, oyuncu skorları
  bellekte (RAM) tutuluyor ve zaten oyun bitince sıfırlanıyor.
- Aynı anda birden fazla oda (room) desteklenir — 2'den fazla kişi siteye
  girerse, sistem onları otomatik olarak ikişerli eşleştirir.

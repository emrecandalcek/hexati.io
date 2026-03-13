# 🎮 HexDomain Multiplayer

**Real-time multiplayer territory wars** built with Node.js + Socket.io.

---

## 🚀 Railway'e Deploy (Adım Adım)

### 1. GitHub'a yükle

```bash
# Proje klasöründe:
git init
git add .
git commit -m "HexDomain v2 - Multiplayer"

# GitHub'da yeni repo oluştur (hexdomain-mp gibi)
git remote add origin https://github.com/KULLANICI_ADIN/hexdomain-mp.git
git branch -M main
git push -u origin main
```

### 2. Railway hesabı aç

- [railway.app](https://railway.app) → **Login with GitHub**

### 3. Yeni proje oluştur

1. **New Project** → **Deploy from GitHub repo**
2. Repo listesinden **hexdomain-mp**'yi seç
3. Railway otomatik algılar: `package.json` → Node.js projesi
4. **Deploy** butonuna bas

### 4. Domain al (ücretsiz)

- Railway dashboard → **Settings** → **Domains**
- **Generate Domain** → `hexdomain-mp.up.railway.app` gibi bir URL

### 5. Oyna!

- `https://hexdomain-mp.up.railway.app` → Ana menü
- `https://hexdomain-mp.up.railway.app/multiplayer.html` → Multiplayer

---

## 🏗️ Proje Yapısı

```
hexdomain-mp/
├── server.js              # Ana server (Express + Socket.io)
├── package.json
├── railway.json           # Railway config
├── shared/
│   ├── config.js          # Paylaşılan sabitler
│   ├── utils.js           # Yardımcı fonksiyonlar
│   ├── grid.js            # Grid veri yapısı
│   └── floodfill.js       # BFS flood-fill
├── server/
│   ├── gameRoom.js        # Oyun odası yöneticisi
│   ├── entity.js          # Base entity
│   ├── player.js          # Server-side oyuncu
│   └── bot.js             # Bot AI
└── public/
    ├── index.html         # Ana hub
    ├── multiplayer.html   # 🌐 Multiplayer
    ├── game.html          # Classic mod
    ├── arcade.html        # Arcade mod
    ├── survival.html      # Survival mod
    ├── sandbox.html       # Özel ayarlar
    ├── leaderboard.html   # Skorlar
    ├── settings.html      # Ayarlar
    ├── howtoplay.html     # Rehber
    ├── css/
    └── js/
```

---

## ⚙️ Yerel Geliştirme

```bash
npm install
npm run dev     # nodemon ile hot-reload
# veya
npm start       # production
```

`http://localhost:3000` → oyun açılır.

---

## 🎯 Multiplayer Mimari

- **Server-authoritative**: Tüm oyun mantığı sunucuda çalışır
- **Tick rate**: 50ms (20 tick/sn) — smooth gameplay
- **State broadcast**: Her 100ms grid patch + entity positions
- **Delta sync**: Sadece değişen grid hücreleri gönderilir (bandwidth optimized)
- **Room system**: Birden fazla bağımsız oyun odası
- **Max 8 oyuncu** per room + 4 bot

### Socket Events

| Client → Server | Açıklama |
|---|---|
| `room:join` | Odaya katıl |
| `input:dir` | Yön girişi |
| `shop:buy` | Upgrade satın al |
| `player:respawn` | Yeniden doğ |
| `chat:msg` | Sohbet |

| Server → Client | Açıklama |
|---|---|
| `game:init` | İlk tam state |
| `game:state` | Delta state (100ms) |
| `game:events` | Kill/death/capture olayları |
| `game:playerJoined` | Yeni oyuncu |
| `game:playerLeft` | Oyuncu ayrıldı |

---

## 🌐 Environment Variables

Railway'de otomatik ayarlanır:
- `PORT` — Railway tarafından otomatik atanır

Ekstra ayar **gerekmez**.

---

## 📊 Oyun Modları

| Mod | URL | Açıklama |
|---|---|---|
| **Multiplayer** | `/multiplayer.html` | 🌐 Gerçek oyuncularla |
| **Classic** | `/game.html` | Sonsuz tek oyunculu |
| **Arcade** | `/arcade.html` | 90s sayaç |
| **Survival** | `/survival.html` | 3 can, dalga sistemi |
| **Sandbox** | `/sandbox.html` | Tam özelleştirme |

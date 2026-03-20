# 🎮 HEXATİ — Territory Wars

**Real-time multiplayer territory wars** — Node.js + Socket.io ile geliştirilmiş.

---

## 🚀 Railway'e Deploy

```bash
git init && git add . && git commit -m "HEXATİ v2.2"
git remote add origin https://github.com/KULLANICI_ADIN/hexati.git
git branch -M main && git push -u origin main
```
Railway → New Project → Deploy from GitHub → Domain al → Oyna!

---

## ⚙️ Yerel Geliştirme

```bash
npm install
npm run dev     # nodemon ile hot-reload
npm start       # production
```
`http://localhost:3000` → oyun açılır.

---

## 🏗️ Proje Yapısı

```
hexati/
├── server.js              # Ana server (Express + Socket.io)
├── package.json
├── railway.json
├── shared/
│   ├── config.js          # Paylaşılan sabitler (server + client)
│   ├── utils.js           # Yardımcı fonksiyonlar
│   ├── grid.js            # Grid veri yapısı + dirty tracking
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
    ├── arcade.html        # Arcade mod (90s)
    ├── survival.html      # Survival mod (3 can)
    ├── sandbox.html       # Özel ayarlar
    ├── leaderboard.html   # Skorlar
    ├── settings.html      # Ayarlar
    ├── howtoplay.html     # Rehber
    ├── css/
    └── js/
```

---

## 🎯 Multiplayer Mimari

- **Server-authoritative**: Tüm oyun mantığı sunucuda
- **Tick rate**: 50ms (20 tick/sn)
- **State broadcast**: 100ms delta patch
- **Difficulty rooms**: easy/normal/hard × birden fazla oda
- **Max 8 oyuncu** + bot per room

---

## 📊 Oyun Modları

| Mod | Açıklama |
|---|---|
| **Classic** | Sonsuz, shop var, 6 bot |
| **Arcade** | 90s sayaç, shop yok, hızlı botlar |
| **Survival** | 3 can, her 30s bot ekle + hızlan |
| **Sandbox** | Tüm parametreler özelleştirilebilir |
| **Multiplayer** | Gerçek oyuncularla, oda sistemi, chat |

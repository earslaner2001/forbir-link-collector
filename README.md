# Förbır Link Collector

**Förbır Link Collector**, Discord ve Kick sohbetlerinden paylaşılan linkleri toplayarak merkezi bir web arayüzünde görüntülemeyi amaçlayan modüler bir projedir.  

## 🚀 Özellikler
- 📡 **Discord Modülü** → Belirlenen kanal(lar)daki tüm linkleri toplar.
- 🎥 **Kick Modülü** → Yayın sohbetinden linkleri çeker.
- 🐦 **Twitter/X Modülü** (opsiyonel) → Belirlenen hesaplardan tweetleri toplar.
- 🌐 **Web UI** → Tüm toplanan linkleri kolayca erişilebilir bir arayüzde sunar.

## 📂 Proje Yapısı
forbir-link-collector/<br>
├── server.js # Sunucu tarafı kodları<br>
├── index.js # Ana uygulama<br>
├── package.json # Node.js bağımlılıkları<br>
├── public/ # Statik dosyalar<br>
├── modules/ # Discord, Kick, Twitter modülleri<br>
└── views/ # Web arayüzü şablonları

## ⚙️ Kurulum
1. Repoyu klonla:
   ```bash
   git clone https://github.com/kullaniciadi/forbir-link-collector.git
   cd forbir-link-collector
Bağımlılıkları yükle:

```
npm install
```
Çalıştır:
```
npm run start
```
veya

```
node server.js
```
🛠️ Geliştirme Sırası
1. Discord modülü ✅
2. Kick modülü 🔄
3. Twitter/X modülü 🔄
4. Web UI 🔄

🌍 Yayına Alma:
1. Vercel / Netlify (statik kısımlar için)<br>
2. Render / Railway (Node.js sunucu için)<br>
3. VPS + Nginx (gelişmiş barındırma)<br>

📜 Lisans
MIT Lisansı ile sunulmaktadır.
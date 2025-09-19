# 📜 Changelog - Förbır Link Collector

Tüm önemli değişiklikler bu dosyada tutulmaktadır.  
Format: [Semantic Versioning](https://semver.org/lang/tr/) (`MAJOR.MINOR.PATCH`)  

---

## [1.1.0] - 2025-09-19
### Eklendi
- 🔔 **Bildirim Sistemi**: Yeni link geldiğinde tarayıcıda “ding” sesi + masaüstü bildirimi.
- 📝 **Bot Paneli**:
  - Son logların anlık görüntülenmesi.
  - Hızlı aksiyonlar (Yayın başladı, reset, test mesajları).
  - Rate limit logları (hangi kullanıcı cooldown’a takılmış anlık görülebiliyor).
- 🔑 **Rol Sistemi**:
  - **Admin** → Tam yetki
  - **Streamer** → Link ekleme, reset
  - **Moderator** → Link silme, reset
  - **User** → Normal kullanım (rate limit 20s)
  - **Anonim** → Login olmadan eklenen linkler (5 dk sonra otomatik silinir).
- 🌐 **Web UI Geliştirmeleri**:
  - Modern, mobil uyumlu sidebar + responsive tasarım.
  - Link kartları animasyonlu ve daha şık hale getirildi.
  - Sessiz mod (🔕) toggle butonu eklendi.

### Değiştirildi
- Normal kullanıcıların (`User`) link ekleme süresi **20 saniyelik cooldown** ile sınırlandı.
- `Register` artık sadece `User` rolü açıyor. Admin/Streamer/Moderator rolleri **veritabanından atanıyor**.

---

## [1.0.0] - 2025-09-10
### Eklendi
- 🎉 İlk sürüm yayınlandı.
- 📡 Discord modülü ile link toplama.
- 🌐 Web arayüzünde linkleri listeleme.
- 👥 Kullanıcı giriş/çıkış sistemi.
- 🗑️ Link sıfırlama özelliği.
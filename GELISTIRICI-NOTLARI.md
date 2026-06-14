# Geliştirici Notları — Student Survey App

Bu dosya, projeyi ileride düzenlemek isteyen kişi (veya Claude) için yol haritasıdır.

## Teknoloji
- **Node.js + Express** (saf JavaScript, derleme gerektiren native paket YOK).
- **Veri deposu:** `db/data.json` — tek bir JSON dosyası. Veritabanı sunucusu gerekmez.
- **Kimlik doğrulama:** `express-session` (cookie) + `bcryptjs` ile hash'lenmiş admin şifresi.
- **Frontend:** sade HTML/CSS/JS (framework yok), `public/` altında.

## Dosya Yapısı
```
StudentSurveyApp/
├── server.js              # Tüm backend: API + statik sunum + veri katmanı
├── package.json           # Bağımlılıklar (express, express-session, bcryptjs)
├── start.bat              # Windows başlatıcı (Node'u otomatik bulur)
├── db/
│   └── data.json          # TÜM VERİ burada (admin, questions, students, responses)
└── public/
    ├── style.css          # Tüm stiller (CSS değişkenleri :root içinde)
    ├── admin.html         # Admin giriş ekranı
    ├── dashboard.html     # Admin paneli (Students / Questions / Settings) + tüm JS
    └── survey.html        # Öğrencinin gördüğü anket formu + koşullu mantık
```

## Veri Modeli (`db/data.json`)
```jsonc
{
  "admin": { "username": "admin", "password_hash": "..." },
  "questions": [
    {
      "id": 6, "section": "Birth Certificate", "label": "...",
      "type": "text|textarea|yes_no|date|select|email|tel|number",
      "placeholder": null, "options": "A|B|C",   // select için pipe-ayrık
      "required": 0, "order_num": 10, "active": 1,
      "depends_on": 6,        // koşullu: hangi sorunun cevabına bağlı (yes/no soru id)
      "depends_value": "No"   // o soru bu değerse GÖSTER
    }
  ],
  "students": [
    { "id": 1, "name": "...", "email": "...", "phone": null,
      "token": "rastgele-hex", "completed": 0, "completed_at": null, "created_at": "ISO" }
  ],
  "responses": [
    { "student_id": 1, "question_id": 6, "answer": "..." }
  ],
  "nextQuestionId": 33, "nextStudentId": 2,
  "migrations": { "birthCertConditional": true }
}
```
- `order_num` sıralamayı belirler; bölümler (section) bu sıraya göre bloklar halinde gruplanır.
- Soru/öğrenci silinince ilgili `responses` da temizlenir.

## Çalıştırma
```bash
npm install
npm start          # veya: node server.js
# Admin: http://localhost:3000/admin   (admin / admin123)
```

## Önemli Davranışlar
- **Sıralama:** `POST /api/admin/questions/reorder` body `{ items:[{id, section}] }`.
  Sıra `order_num = (index+1)*10` olarak yeniden atanır; `section` da güncellenir
  (soru sürükleyerek başka bölüme taşınabilir).
- **Koşullu sorular:** mantık hem sunucuda saklanır hem `survey.html` içinde
  `evaluateConditionals()` ile uygulanır. Gizli soru gönderimde zorunlu sayılmaz.
- **Migration:** `server.js` açılışta eski `data.json`'a eksik alanları ekler
  (`depends_on`, `depends_value`) ve Birth Certificate örneğini bir kez kurar.
  Yeni migration eklerken aynı deseni (bir flag ile bir kez çalışacak şekilde) kullan.

## Sık Yapılacak Düzenlemeler (nereye bakmalı)
| İstek | Dosya / Yer |
|------|-------------|
| Yeni soru tipi eklemek | `survey.html > buildField()`, `dashboard.html` tip seçenekleri, gerekiyorsa `getGroupValue/clearGroup` |
| Görünüm/renk değişikliği | `public/style.css` (`:root` değişkenleri — `--primary` vb.) |
| Yeni API ucu | `server.js` (mevcut route'ların yanına; admin uçları `requireAdmin`) |
| PDF/Excel çıktısı düzeni | JSON/CSV: `server.js` export uçları · PDF: `dashboard.html > printStyles()/buildStudentBlock()` |
| Başlık/kurum adı | `survey.html`, `dashboard.html`, `printStyles` başlıkları |

## Veri Yedekleme / Geri Yükleme
- **Yedek:** Settings > "Download Backup (JSON)" veya doğrudan `db/data.json` kopyala.
- **Geri yükleme:** uygulama kapalıyken yedek `data.json`'ı `db/` içine koy, yeniden başlat.

## İNTERNETE YAYINLAMA (öğrencilerin her yerden erişmesi için)
Şu an uygulama yalnızca `localhost`'ta çalışır; gönderilen link sadece bu bilgisayardan açılır.
Öğrencilerin telefonlarından erişebilmesi için bir hosting'e deploy edilmeli. Seçenekler:
- **Render.com / Railway.app / Fly.io** (ücretsiz katman; Node app olarak deploy).
  - Start command: `node server.js`  · Build: `npm install`
  - `PORT` ortam değişkenini platform sağlar (kod zaten `process.env.PORT` kullanıyor).
  - **ÖNEMLİ:** Bu platformlarda dosya sistemi kalıcı olmayabilir → `db/data.json`
    kaybolabilir. Kalıcılık için ya kalıcı disk (persistent volume) ekle ya da
    veriyi gerçek bir veritabanına taşı (ör. SQLite + volume, ya da Postgres).
- **SESSION_SECRET** ortam değişkenini production'da sabit bir değere ayarla
  (kod yoksa rastgele üretir; her restart'ta oturumlar düşer).

## Güvenlik Notları
- Production'da mutlaka HTTPS arkasında çalıştır (cookie güvenliği için
  `session` cookie ayarlarına `secure: true` eklenebilir).
- Admin şifresini ilk kurulumdan sonra değiştir.
- Öğrenci token'ları 20 byte rastgele hex; tahmin edilemez.

## Test Hesabı
- Admin: `admin` / `admin123` (değiştirildiyse `db/data.json` silinip yeniden
  seed edilerek sıfırlanabilir — DİKKAT: tüm veriyi siler).

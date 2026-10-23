JAFN AI — REAL-TIME WEB SYNC UPDATE (FITUR LAMA DIPERTAHANKAN)

Perubahan utama:
- Setiap permintaan chat sekarang mengaktifkan pencarian web OpenRouter yang berjalan sebelum model menyusun jawaban (hingga 5 hasil), termasuk permintaan analisis gambar.
- Model diarahkan untuk mencocokkan hasil web dengan konteks percakapan, memprioritaskan sumber tepercaya/terbaru, serta memberi tautan sumber.
- Kedua backend, server.py dan server.js, diperbarui agar perilakunya konsisten.
- Fitur lama di antarmuka tidak dihapus atau dirombak. Gunakan backend Python sesuai panduan sebelumnya, kecuali memang memakai Node.js.

PENTING:
- Pencarian real-time memerlukan koneksi internet server dan API OpenRouter yang berfungsi. Tidak ada layanan yang dapat menjamin internet tersedia saat jaringan/provider sedang gangguan; dalam kondisi itu AI diarahkan untuk jujur tentang keterbatasan.
- Pencarian web dapat menambah biaya di luar token model, meskipun model chat yang dipilih gratis. Periksa harga dan batas pengeluaran OpenRouter sebelum deploy.
- Ini mengaktifkan pencarian web dan grounding jawaban, bukan akses browser bebas ke semua situs atau sinkronisasi database pribadi.

JAFN AI — PRIVACY CENTER UPDATE

Fitur baru:
- Privacy Center dapat dibuka melalui tombol 🛡️ di header.
- Riwayat chat: melihat jumlah percakapan tersimpan dan menghapus seluruh riwayat lokal dengan konfirmasi.
- Memori lokal: menyimpan/menghapus catatan di browser. Catatan ini tidak otomatis dikirim ke AI.
- Izin mikrofon: mencoba membaca status izin browser (jika didukung) dan menjelaskan cara mencabut izin melalui pengaturan situs.
- Pengaturan privasi: mengaktifkan/menonaktifkan penyimpanan riwayat dan menyimpan/reset preferensi tampilan.
- Data tetap lokal di browser/perangkat ini; pengaturan tidak otomatis berlaku di perangkat lain.

CARA PAKAI
1. Ekstrak ZIP ke folder baru.
2. Jalankan seperti versi JAFN AI sebelumnya: `py server.py` (Windows) atau `python server.py`.
3. Buka URL lokal yang dicetak server.
4. Tekan ikon 🛡️ di header untuk membuka Privacy Center.

CATATAN
- Mencabut izin mikrofon harus dilakukan dari pengaturan izin situs di browser; halaman web tidak dapat mencabut izin itu sendiri.
- Catatan memori lokal hanya disimpan sebagai catatan dan tidak digunakan otomatis dalam percakapan AI.
- Jangan simpan informasi sangat sensitif di browser bersama.
- API key tidak disertakan. Tetap simpan Api.key secara lokal atau atur OPENROUTER_API_KEY di environment hosting; jangan unggah rahasia ke GitHub.

--- CATATAN PROYEK ASLI ---
PEMBARUAN FITUR — GENERATE GAMBAR DIHAPUS
- Tombol/mode Generate Gambar dan endpoint backend /api/generate-image telah dihapus.
- Kolom chat sekarang hanya untuk percakapan AI; kolom ini tetap dapat menerima gambar untuk dianalisis dan dokumen untuk dibaca.
- Fitur lain seperti chat OpenRouter, riwayat chat, voice chat, analisis gambar, pembacaan dokumen, timer, tema/wallpaper, pemeriksa prompt, dan Ruang Arcade tetap dipertahankan.

PENTING — AGAR PEMERIKSA PROMPT TIDAK MENAMPILKAN “ENDPOINT TIDAK DITEMUKAN”
1. Hentikan server lama di semua terminal dengan Ctrl+C.
2. Ekstrak ZIP ini ke folder baru (jangan jalankan folder versi lama).
3. Buka terminal di folder ruangfix hasil ekstrak ini.
4. Jalankan: py server.py (Windows) atau python server.py.
5. Buka alamat yang dicetak server, biasanya http://localhost:3000.
6. Tes endpoint dengan membuka http://localhost:3000/api/health. Harus muncul JSON berisi "ok": true dan "service": "Ruang AI".
Jika health endpoint juga 404, berarti browser masih tersambung ke server/folder/port yang salah. Jangan jalankan server.py dan server.js bersamaan pada port yang sama.

RUANG AI — VERSI FINAL SIAP DEPLOY

ISI
- chatbot.html: antarmuka responsif, riwayat percakapan lokal, lampiran gambar serta pembacaan PDF, Word DOCX, TXT, MD, CSV, JSON, dan file kode (PDF/DOCX memakai pustaka CDN, perlu internet), timer rate limit.
- server.py: backend Python untuk OpenRouter, health endpoint, validasi input, dukungan secret environment.
- server.js: backend Node.js alternatif (bisa dipakai lokal; Render instructions memakai Python).
- requirements.txt: dependensi Python (standard library saja).
- .gitignore: mencegah Api.key dan .env masuk Git.

JALANKAN LOKAL (WINDOWS)
1. Ekstrak ZIP.
2. Buat file Api.key sendiri yang berisi API key OpenRouter (jangan bagikan / unggah ke GitHub).
3. Terminal di folder proyek: py server.py
4. Buka http://127.0.0.1:3000

DEPLOY KE RENDER
1. Unggah isi folder ke repository GitHub PRIVATE. Pastikan Api.key tidak ikut di-upload.
2. Render > New > Web Service > pilih repository.
3. Runtime: Python
4. Build command: pip install -r requirements.txt
5. Start command: python server.py
6. Environment Variables: OPENROUTER_API_KEY = API key OpenRouter milikmu (masukkan hanya di dashboard Render).
7. Deploy dan buka URL .onrender.com yang diberikan.

FITUR & BATASAN
- Menggunakan OpenRouter model router gratis `openrouter/free`; ketersediaan model gratis bisa berubah dan tidak dijamin selalu tersedia.
- Bisa mengirim gambar jika model yang dipilih router mendukung input gambar.
- Timer hanya mengikuti perkiraan Retry-After untuk rate limit; bukan jadwal reset resmi dan tidak mengisi kredit.
- Riwayat percakapan disimpan di browser lokal perangkat tersebut; jangan gunakan pada perangkat bersama jika percakapan bersifat pribadi.
- Render Free dapat sleep saat tidak ada aktivitas. Laptop tidak harus menyala, tetapi layanan gratis tidak menjamin uptime 24/7.
- Hosting tidak memberi kredit OpenRouter. Periksa saldo/batas akun di https://openrouter.ai/settings/credits.
- Jangan pernah membagikan API key. Jika pernah terunggah ke GitHub, revoke/ganti segera.

FITUR TAMBAHAN (VERSI FITUR LENGKAP)
- Chat tanpa gambar menggunakan model teks non-Gemini default nvidia/nemotron-3-ultra-550b-a55b:free. ID model bisa diatur lewat OPENROUTER_TEXT_MODEL jika katalog berubah.
- Chat dengan gambar memakai Gemini vision default google/gemini-2.5-flash.
- Tombol 🎨 Gambar memakai AI Horde (worker komunitas) tanpa API key pribadi. Chat tetap menggunakan OpenRouter. Generator gratis bergantung pada antrean dan worker komunitas; kecepatan, model, kualitas, dan ketersediaan tidak dijamin serta tidak memiliki jadwal refill kuota harian tetap.
- Pencarian web real-time dijalankan pada setiap chat melalui plugin web OpenRouter (maksimal 5 hasil), termasuk permintaan analisis gambar. Biaya pencarian dapat terpisah dari token model; cek harga sebelum penggunaan.
- Fitur internet memakai hasil web untuk grounding jawaban, bukan akses browser penuh atau kemampuan membuka setiap situs secara bebas.
- Environment variables opsional: OPENROUTER_TEXT_MODEL, OPENROUTER_VISION_MODEL, OPENROUTER_API_KEY. Generate gambar menggunakan AI Horde tanpa API key pribadi. Antrean komunitas dapat membuat proses lebih lama; laptop tidak menjalankan model gambar secara lokal.


PERBAIKAN TIMER
- Status kredit/kuota habis kini disimpan di browser dan tetap terlihat setelah halaman dibuka ulang.
- Hitung mundur hanya dipakai untuk rate limit yang mengembalikan retry_after_seconds (atau jeda cadangan).
- Kredit habis (HTTP 402) tidak diberi hitung mundur palsu karena waktu habis timer tidak mengisi saldo OpenRouter.
- Setelah permintaan berhasil, status batas penggunaan yang tersimpan akan dibersihkan.


PERBAIKAN ENDPOINT PEMBUATAN GAMBAR
- Endpoint diubah ke /api/v1/images/generations.
- Jika masih gagal, cek log server dan status layanan/antrean AI Horde; gambar gratis dapat lambat atau sementara tidak tersedia.


FIX TAMBAHAN ENDPOINT GAMBAR
- Route /api/generate-image ditambahkan ke server.js juga. Jika sebelumnya menjalankan `node server.js`, route ini yang tidak ada dan menyebabkan 'Endpoint tidak ditemukan'.
- Jika endpoint tersedia tetapi provider menolak permintaan, backend menampilkan pesan yang lebih spesifik. Images API/model tetap bergantung pada dukungan OpenRouter dan saldo akun.


PERBAIKAN GAMBAR V2
- Endpoint generate gambar dialihkan ke AI Horde (https://aihorde.net), layanan generasi gambar berbasis komunitas yang gratis dan menggunakan antrean. Model/worker tersedia bergantung pada kapasitas komunitas.
- Jika UI lokal tetap mengatakan "Endpoint tidak ditemukan", kemungkinan server lama masih berjalan atau folder lama yang dijalankan. Hentikan semua server dengan Ctrl+C, masuk ke folder hasil ekstrak ZIP ini, lalu jalankan py server.py.


PEMBACAAN PDF & WORD
- Lampiran dokumen mendukung PDF berbasis teks, Word .docx, serta file teks/kode. Batas unggah dokumen 10 MB; isi teks yang diteruskan ke AI maksimal 100.000 karakter.
- PDF hasil scan/foto tidak otomatis terbaca karena membutuhkan OCR; gunakan PDF yang teksnya dapat dipilih atau unggah gambar halaman.
- Word format lama .doc belum didukung langsung; buka di Word/LibreOffice lalu simpan sebagai .docx.
- PDF.js dan Mammoth dimuat dari CDN, jadi browser perlu internet saat membuka halaman.
- Dokumen sangat panjang bisa terpotong pada batas karakter dan AI tetap memiliki batas konteks/kuota model.


FITUR BARU: VOICE CHAT DUA ARAH JAFN AI
- Buka chatbot menggunakan Chrome atau Edge terbaru.
- Tekan tombol mikrofon 🎙️ di sebelah tombol kirim, lalu izinkan akses mikrofon.
- Berbicaralah dalam Bahasa Indonesia; ucapan akan dikirim sebagai pesan ke JAFN AI dan jawaban dibacakan dengan suara browser.
- Tekan tombol ⏹️ untuk mengakhiri Voice Chat.
- Voice Chat memakai Web Speech API browser (pengenalan suara dan text-to-speech), sehingga dukungan pengenalan suara dapat berbeda menurut browser, sistem operasi, dan koneksi internet.
- Gunakan localhost atau HTTPS agar izin mikrofon dapat diberikan. Jika browser tidak mendukung SpeechRecognition, coba Chrome/Edge terbaru.
- Tidak ada API key suara tambahan yang ditambahkan; jawaban AI tetap menggunakan backend/API chatbot yang sudah ada.


FITUR BARU — GENERATE GAMBAR
- Di chat, awali permintaan gambar dengan "Buat gambar ..." atau "Generate gambar ...", misalnya: "Buat gambar kucing astronot di bulan, gaya anime".
- Endpoint /api/generate-image pada backend Python dan Node.js memakai AI Horde gratis, terpisah dari provider chat. Hasil gambar dikirim sebagai data URL ke antarmuka chat.
- Kualitas gambar: generate memakai model AlbedoBase XL (SDXL), 30 langkah, sampler k_euler_a, dan rasio gambar menyesuaikan prompt (potret, lanskap, atau persegi). AI Horde gratis berbasis worker komunitas; antrean/kualitas dan ketersediaan tetap dapat berubah.
- AI Horde menggunakan antrean komunitas; gambar dapat memerlukan waktu tunggu dan ketersediaan tidak dijamin. Tidak perlu mengisi saldo OpenRouter untuk generate gambar.
- Fitur lama seperti chat teks, analisis gambar, voice chat/TTS, riwayat, lampiran dokumen, timer, tema, dan pemeriksa prompt tetap dipertahankan.
- Backend Python (py server.py) dan Node.js (node server.js) sama-sama menyediakan endpoint generate gambar. Pastikan hanya menjalankan satu backend pada port yang sama. Generate gambar menggunakan AI Horde gratis; chat teks dan analisis gambar tetap menggunakan konfigurasi OpenRouter yang lama.


GENERATE GAMBAR CEPAT (GRATIS)
Fitur generate gambar memakai model FLUX lewat layanan komunitas Pollinations, tanpa memakai kredit OpenRouter untuk chat. Layanan ini gratis best-effort; kecepatan dan ketersediaannya dapat berubah, dan kadang bisa gagal saat ramai.


GENERATE GAMBAR — CLOUDFLARE FLUX.1 SCHNELL (KUOTA GRATIS HARIAN)
- Mesin gambar dialihkan dari Pollinations ke Cloudflare Workers AI model @cf/black-forest-labs/flux-1-schnell. Model ini dirancang untuk generasi cepat dengan 4 langkah. Kualitas tidak selalu sama pada setiap prompt.
- Cloudflare Workers AI menyediakan alokasi gratis 10.000 Neurons per hari; batas direset setiap hari pukul 00.00 UTC (07.00 WIB). Jumlah gambar yang dapat dibuat bergantung pada ukuran/biaya pemakaian. Jika kuota habis, tunggu reset harian. Sumber: https://developers.cloudflare.com/workers-ai/platform/pricing/
- WAJIB konfigurasi dua environment variable di tempat server berjalan: CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN. Buat token Cloudflare yang memiliki izin Workers AI Read/Write dan simpan sebagai secret/environment variable di hosting. Jangan taruh token di chatbot.html atau unggah token ke GitHub.
- Di Windows PowerShell untuk tes lokal, sebelum menjalankan server:
  $env:CLOUDFLARE_ACCOUNT_ID="ID_AKUN_CLOUDFLARE"
  $env:CLOUDFLARE_API_TOKEN="TOKEN_CLOUDFLARE"
  python server.py
  (atau jalankan `node server.js` untuk backend Node.js)
- Di hosting online, masukkan kedua variable di bagian Environment Variables/Secrets, lalu restart/redeploy server. Account ID dapat dilihat di dashboard Cloudflare.
- Generate gambar tetap terpisah dari kredit OpenRouter yang digunakan untuk chat. Tidak ada jaminan layanan selalu tersedia atau bahwa hasil selalu sempurna; akses dan kuota mengikuti aturan akun Cloudflare. Jangan aktifkan billing berbayar jika ingin tetap membatasi diri pada penggunaan gratis.


PENGATURAN GENERATOR GAMBAR POLLINATIONS (PENGGANTI CLOUDFLARE)
1. Daftar/login di https://enter.pollinations.ai/ lalu buat API key sesuai petunjuk resmi. Jangan kirim atau unggah key ke GitHub.
2. Di folder ruangfix (sefolder dengan server.py), buat file teks bernama Pollinations.key. Pastikan Windows tidak menamainya Pollinations.key.txt.
3. Tempel hanya API key Pollinations ke file itu, simpan, lalu restart server dengan Ctrl+C kemudian py server.py.
4. Chat biasa tetap memakai Api.key/OpenRouter; jangan mengganti isi Api.key dengan key Pollinations.
5. Tombol generate gambar memakai model alias zimage (Z-Image Turbo) melalui https://gen.pollinations.ai/image/. Model bisa diganti di URL pada server.py/server.js bila katalog resmi berubah.
6. Pollinations API saat ini menggunakan API key dan sistem Pollen/akun sesuai ketentuan layanan. Jangan menganggapnya memiliki kuota gratis yang pasti refill setiap hari. Cek saldo, model, dan ketentuan terkini di https://gen.pollinations.ai/docs dan https://enter.pollinations.ai/.
7. Untuk hosting Render, tambahkan environment variable POLLINATIONS_API_KEY di dashboard Render; jangan mengunggah Pollinations.key atau Api.key ke repository.


GENERATOR GAMBAR TANPA API KEY (VERSI TERBARU)
- Endpoint /api/generate-image pada server.py dan server.js menggunakan AI Horde (https://aihorde.net).
- Tidak memerlukan Pollinations API key, Cloud ID, atau token pribadi.
- Gambar dibuat oleh worker komunitas. Waktu tunggu dan ketersediaan bergantung pada antrean; tidak dijamin selalu cepat atau tersedia.
- Chat teks dan analisis gambar tetap menggunakan OpenRouter seperti sebelumnya dan tetap memerlukan konfigurasi OpenRouter yang sudah digunakan proyek.


PERBAIKAN ERROR HTTP 400 (Oktober 2026)
AI Horde mengharuskan kunci anonymous 0000000000 dikirim pada HTTP header bernama apikey, bukan di payload JSON. Server Python dan Node.js sudah disesuaikan. Ini bukan API key pribadi dan tidak perlu pendaftaran. Penggunaan anonim dapat memiliki antrean lebih panjang atau dibatasi oleh layanan.


GENERATOR GAMBAR (versi ini)
- Menggunakan endpoint publik Vexa AI: https://vexa-ai.pages.dev/image
- Tidak memerlukan API key gambar pribadi.
- Model yang diminta: flux; layanan publik dapat berubah, membatasi permintaan per IP, atau tidak tersedia sewaktu-waktu.
- Chat OpenRouter tetap memerlukan Api.key atau OPENROUTER_API_KEY seperti sebelumnya.
- Respons generator diperiksa dan gambar diambil hanya dari domain proxy Vexa AI yang diharapkan.


GENERATOR GAMBAR TERBARU — OVHCLOUD SDXL ANONIM
- Endpoint generator pada server.py dan server.js menggunakan Stable Diffusion XL (SDXL) melalui endpoint publik OVHcloud: https://stable-diffusion-xl.endpoints.kepler.ai.cloud.ovh.net/api/text2image
- Tidak perlu API key gambar pribadi atau Cloud ID di konfigurasi JAFN AI.
- Model SDXL menghasilkan kualitas gambar standar/menengah dan umumnya lebih lambat daripada model turbo; waktu aktual tergantung layanan.
- Halaman model OVHcloud menyebut endpoint gratis dan batas anonim 2 permintaan per menit per IP per model. Batas, ketersediaan, atau aturan layanan dapat berubah.
- Chat teks, analisis gambar, dan fitur lama tetap memakai konfigurasi OpenRouter yang sudah ada.
- Sintaks Python dan JavaScript diperiksa. Endpoint tidak dapat diuji langsung dari lingkungan pengembangan ini, jadi keberhasilan akses dari jaringan/hosting pengguna belum terkonfirmasi.
Sumber: https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/stable-diffusion-xl/


FITUR COMPANION UPDATE
- Context-aware expression: ekspresi dan label maskot menyesuaikan isi percakapan dan konteks pertanyaan.
- Mood & personality: pilih Ramah, Santai, atau Profesional; preferensi gaya dikirim sebagai instruksi sistem ke AI.
- Voice personality: atur bahasa, pilih suara yang tersedia di browser, kecepatan, dan nada suara melalui Web Speech API. Ketersediaan suara berbeda menurut perangkat/browser.
- Focus mode: mengurangi maskot dan dekorasi agar jawaban panjang lebih nyaman dibaca.
- Interactive onboarding: panduan fitur muncul pada kunjungan pertama dan bisa dilewati.
- Response feedback: nilai jawaban dengan tombol Membantu/Kurang tepat, atau pilih Perbaiki jawaban untuk mengirim permintaan revisi. Penilaian disimpan lokal dan tidak otomatis dikirim ke server.
- Continue where you left off: panel 🎭 menampilkan hingga 5 percakapan terakhir untuk dilanjutkan.

Catatan: pengaturan disimpan di browser/perangkat yang sedang digunakan. Voice Chat menggunakan dukungan browser; suara/aksen tertentu mungkin tidak tersedia.


PERSONA JAFN AI
- persona.md kini berisi panduan karakter JAFN AI sebagai pelayan istana yang sopan, sigap, dan dapat diandalkan.
- server.py dan server.js membaca persona.md saat server mulai. Ubah isi file tersebut untuk menyesuaikan gaya dasar JAFN AI, lalu restart server.
- Jika persona.md tidak tersedia atau gagal dibaca, server menggunakan instruksi persona bawaan agar chat tetap dapat berjalan.
- Pengaturan Ramah/Santai/Profesional tetap berfungsi sebagai penyesuaian gaya di atas persona dasar.


PEMBARUAN RUANG ARCADE — 8 GAME
================================
Pembaruan ini menambahkan delapan pilihan game di Ruang Arcade: Detektif Misteri, Dungeon Quest, Peliharaan Virtual, Puzzle Kata, Memory Match, Space Dodger, Petualangan Pilihan, dan Kuis Kilat.

Progres game memakai sistem RC, XP, level, badge, Collection/Gelar, dan Achievement yang sudah ada. Data profil tetap disimpan di localStorage browser/perangkat yang sama, mengikuti perilaku versi sebelumnya. Peliharaan virtual dan gelar akhir cerita juga disimpan pada profil lokal.

Tidak memerlukan API key tambahan atau layanan eksternal untuk memainkan mini-game. Kuis Kilat memakai bank soal lokal yang sudah ada.

Pemasangan: ekstrak ZIP ke folder baru, salin Api.key dari folder lama (jangan membagikan file tersebut), jalankan `py server.py`, lalu buka alamat lokal yang ditampilkan server. Untuk Node.js, gunakan `npm install` bila diperlukan lalu `npm start` sesuai package.json.

Catatan: RC dan XP adalah poin hiburan, bukan uang sungguhan. Karena progres disimpan di browser, data tidak otomatis tersinkron ke perangkat lain dan bisa hilang jika data situs browser dihapus.


PEMBARUAN RUANG ARCADE — BANK KASUS MISTERI

- Detektif Misteri sekarang memiliki 24 kasus unik dengan cerita, bukti, empat tersangka, jawaban, dan penjelasan deduksi yang berbeda.
- Setiap permainan mengambil hingga 4 kasus acak. Kasus yang sudah dimainkan disimpan di browser dan dihindari sampai seluruh bank kasus selesai dimainkan; setelah habis, siklus baru dimulai.
- Kasus memiliki tingkat kesulitan Mudah, Sedang, dan Sulit dengan hadiah RC/XP berbeda. Jawaban pilihan diacak tanpa mengubah jawaban benar.
- Puzzle Kata sekarang menggunakan bank 30 kata/petunjuk dan memilih 5 kata acak tiap sesi.
- Dungeon Quest memilih musuh dan harta yang berbeda-beda tiap kali dimulai.
- Riwayat kasus dan progres game tersimpan secara lokal pada browser/perangkat yang sama. Menghapus data situs/browser dapat menghapus progres lokal.
- Pembaruan ini mempertahankan fitur JAFN AI, chat OpenRouter, unggah dokumen/gambar, profil arcade, RC, XP, achievement, collection, dan gelar yang sudah ada.

Cara memperbarui: ekstrak ZIP ini ke folder baru, salin file Api.key milikmu ke folder tersebut, hentikan server lama dengan Ctrl+C, lalu jalankan py server.py. Jangan membagikan Api.key.


PEMBARUAN GAMEPLAY & PROGRESI — ARCADE UPGRADE
=============================================
- Dungeon Quest sekarang berbentuk dungeon 3 lantai: pilih kelas Ksatria, Penyihir, atau Pemburu Bayangan; gunakan serangan, skill khusus, bertahan, dan ramuan; kalahkan musuh yang berbeda; lalu pilih hadiah antarlantai.
- Peliharaan Virtual diperluas menjadi simulasi perawatan: lapar, bahagia, energi, kebersihan, level, XP, ganti nama, makan, bermain, mandi, tidur, dan latihan trik.
- Puzzle Kata menggunakan 40 kata lebih panjang dan lebih menantang, 6 tantangan acak per sesi, serta petunjuk tambahan yang mengurangi bonus.
- Space Dodger sekarang real-time: meteor jatuh dari posisi acak dan kecepatannya meningkat. Gerakkan roket memakai tombol panah kiri/kanan, A/D, tombol layar, atau geser roket di area permainan. Skor selalu terlihat di kanan atas; tiga tabrakan mengakhiri permainan.
- Toko Arcade diperluas menjadi koleksi gelar, badge, kosmetik profil/peliharaan, dan booster RC/XP. Achievement juga bertambah untuk progres level, koleksi, dan jenis game.
- Pembaruan menggunakan localStorage yang sama seperti versi sebelumnya agar progres profil lama tetap dipakai. Tetap uji di browser setelah memasang; pemeriksaan sintaks tidak menggantikan uji gameplay interaktif.


PENGEMBANGAN ONLINE — LOGIN GOOGLE + CLOUD SYNC (JAFN AI)

Yang ditambahkan:
- Tombol Login/Logout Google menggunakan Firebase Authentication.
- Profil dasar pengguna disimpan di Firestore.
- Riwayat chat disinkronkan per akun ke Firestore; pesan yang disimpan ke cloud dibatasi untuk menghindari dokumen terlalu besar. Lampiran gambar mentah tidak disimpan sebagai riwayat cloud.
- Pengaturan utama (tema, gaya, personalisasi, companion, pengaturan privasi, progres arcade, dan beberapa statistik) disinkronkan ke Firestore.
- Backend /api/chat dan /api/check-prompt memerlukan Firebase ID token dan memverifikasinya menggunakan Firebase Admin SDK.
- firestore.rules membatasi setiap pengguna agar hanya dapat membaca/menulis dokumen di bawah UID miliknya.

LANGKAH FIREBASE
1. Firebase Console > Authentication > Sign-in method > Google: Enable dan Save.
2. Authentication > Settings > Authorized domains: tambahkan hostname persis yang dipakai membuka aplikasi (misalnya nama-layanan.onrender.com, localhost, atau 127.0.0.1 jika memang dipakai dan belum tercantum). Masukkan hostname saja—tanpa https://, path, atau port. Error auth/unauthorized-domain tidak bisa diselesaikan hanya dengan mengubah ZIP; domain harus diizinkan di Firebase Console. Untuk lokal, utamakan http://localhost:3000 dan pastikan localhost tercantum.
3. Firebase Console > Build > Firestore Database > Create database.
4. Buka tab Rules, salin isi file firestore.rules ke editor Rules, lalu Publish. Jangan gunakan rules yang mengizinkan semua orang membaca/menulis.
5. Project settings > Service accounts > Generate new private key. Simpan file JSON ini secara rahasia. Jangan masukkan ke ZIP/repository atau kirim ke orang lain.

JALANKAN LOKAL
1. Install dependensi: py -m pip install -r requirements.txt
2. Atur environment variable OPENROUTER_API_KEY dengan API key OpenRouter.
3. Atur FIREBASE_SERVICE_ACCOUNT_JSON dengan isi lengkap JSON service account (untuk PowerShell, gunakan cara environment variable yang sesuai; jangan tulis rahasia ke source code).
4. Jalankan: py server.py
5. Buka http://127.0.0.1:3000, lalu login dengan Google.
Catatan: jika FIREBASE_SERVICE_ACCOUNT_JSON belum disetel, backend sengaja menolak endpoint AI dengan pesan konfigurasi, bukan menerima permintaan tanpa verifikasi login.

DEPLOY PUBLIK KE RENDER
1. Unggah folder proyek ke repository GitHub PRIVATE. Pastikan Api.key, .env, dan service account JSON tidak ikut terunggah.
2. Render > New > Web Service > pilih repository.
3. Runtime: Python. Build command: pip install -r requirements.txt. Start command: python server.py.
4. Tambahkan Environment Variables di Render:
   - OPENROUTER_API_KEY = API key OpenRouter.
   - FIREBASE_SERVICE_ACCOUNT_JSON = seluruh isi JSON service account Firebase sebagai nilai rahasia.
   - FIREBASE_PROJECT_ID = jafn-ai.
   - PUBLIC_APP_URL = URL publik Render kamu.
5. Deploy. Salin URL .onrender.com yang diberikan Render.
6. Tambahkan domain .onrender.com itu ke Authentication > Settings > Authorized domains di Firebase.
7. Buka URL publik, login Google, lalu tes chat, buka riwayat, dan login dari browser/perangkat lain untuk memeriksa sinkronisasi.

PENTING
- Website dapat dibuka oleh siapa saja yang memiliki link, tetapi penggunaan chat AI dan pemeriksa prompt mengharuskan login Google.
- Render Free dapat tidur saat tidak aktif; karena itu akses publik bisa tersedia tetapi tidak dijamin benar-benar 24/7 tanpa jeda. Paket/hosting dengan always-on diperlukan jika butuh uptime lebih konsisten.
- Firestore memiliki batas kuota/biaya. Pantau penggunaan dan set budget alert.
- Service account JSON adalah rahasia berhak tinggi. Simpan hanya sebagai secret environment variable di hosting. Jangan masukkan ke GitHub, HTML, atau JavaScript.
- Firebase web config di firebase-auth.js memang konfigurasi publik. Keamanan data berasal dari Firestore Security Rules dan verifikasi token di backend, bukan menyembunyikan web config.
- Wallpaper gambar yang diunggah pengguna tetap lokal pada browser karena dapat berukuran besar; gambar/lampiran chat mentah tidak diunggah ke Firestore. Profil, riwayat teks, dan pengaturan yang didukung tersimpan di cloud.
- Sebelum digunakan publik secara luas, lakukan tes security rules, batas penggunaan API, kuota provider AI, dan backup data.


PEMBARUAN PEMERIKSA PROMPT (VERSI PENYEMPURNAAN)
- Pemeriksa AI diarahkan untuk lebih konservatif: hanya menandai isu yang memiliki bukti pada teks, tidak menganggap prompt pendek/bahasa gaul sebagai salah, serta mengurangi isu duplikat.
- Maksimal 8 isu utama dikembalikan agar hasil lebih fokus.
- Backend memvalidasi tipe isu dan hanya menerima kutipan yang benar-benar ada pada prompt.
- Tombol penggantian otomatis tidak ditampilkan untuk isu konteks, agar prompt tidak rusak karena pertanyaan klarifikasi menggantikan teks asli.
- Deteksi lokal pengulangan kata yang berjauhan dihapus karena sering salah menandai; deteksi typo umum dan kata duplikat berurutan tetap ada.

PENGUJIAN YANG DILAKUKAN PADA ZIP INI
- Sintaks server.py lolos pemeriksaan kompilasi Python.
- Ini belum membuktikan integrasi Firebase/OpenRouter, browser, atau deployment berjalan; tetap lakukan uji manual setelah mengisi konfigurasi rahasia dan menjalankan server.

PEMECAHAN MASALAH LOGIN GOOGLE — auth/unauthorized-domain
- Pesan error sekarang menampilkan hostname dan origin aplikasi yang sedang digunakan.
- Salin hostname itu ke Firebase Console > Authentication > Settings > Authorized domains > Add domain. Jangan sertakan port atau protokol.
- Pastikan Google provider aktif di Authentication > Sign-in method. Setelah menyimpan perubahan, muat ulang aplikasi dan coba login lagi.
- Domain custom/hosting harus ditambahkan secara eksplisit. Untuk uji lokal, buka http://localhost:3000 (bukan file chatbot.html langsung).

PERBAIKAN LOGIN FIREBASE BACKEND
- Backend Python kini dapat memverifikasi token login Firebase menggunakan kunci publik resmi Google jika FIREBASE_SERVICE_ACCOUNT_JSON belum diatur. Ini menghilangkan error konfigurasi tersebut tanpa mematikan verifikasi token.
- Jika FIREBASE_SERVICE_ACCOUNT_JSON tersedia, backend tetap memakai Firebase Admin SDK dengan pemeriksaan token dicabut. Tanpa service account, tanda tangan, masa berlaku, issuer, dan audience token tetap diverifikasi; pemeriksaan pencabutan token tidak tersedia.
- Pastikan FIREBASE_PROJECT_ID sama dengan project ID Firebase aplikasi (default proyek pada file ini: jafn-ai). Jika memakai proyek Firebase lain, atur variabel itu di hosting.
- Jalankan ulang deployment agar dependensi di requirements.txt terpasang. Login Google tetap memerlukan Google provider aktif dan domain hosting terdaftar di Firebase Authentication > Settings > Authorized domains.

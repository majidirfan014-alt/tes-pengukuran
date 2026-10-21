# PRD – Website "Tes Pengukuran Cabang Olahraga"

**Versi:** 1.1 · **Tanggal:** 13 Oktober 2026 · **Acuan tampilan, menu, fitur & norma:** https://koni-tuban.vercel.app/

> Perubahan v1.1: pembatasan menu untuk User Cabor (tanpa akses Kode Akses Cabor & Norma Tes, termasuk lewat URL langsung), Cabor & Item Tes dapat diedit User Cabor untuk cabornya sendiri.

## 1. Ringkasan

"Tes Pengukuran Cabang Olahraga" adalah website evaluasi tes fisik atlet per cabang olahraga (cabor). Website ini meniru tampilan, isi, menu, fitur, dan norma penilaian dari website KONI Tuban (Sistem Evaluasi Tes Fisik Khusus), dengan satu perbedaan utama: **pengguna dapat mendaftar sendiri** dengan mengisi nama cabor, nama kabupaten/kota, username, dan password, sehingga website bisa dipakai banyak cabor dari banyak daerah. Superadmin memegang kontrol penuh atas seluruh data dan akun.

### Tujuan

- Menyediakan satu platform untuk input, evaluasi, dan pemantauan hasil tes fisik atlet per cabor.
- Menghasilkan skor, persentase performa, dan kategori otomatis berdasarkan norma yang sama dengan website acuan.
- Memungkinkan cabor dan daerah baru bergabung lewat pendaftaran mandiri tanpa bantuan developer.
- Menjaga privasi: halaman publik hanya menampilkan data agregat tanpa identitas atlet.

### Di luar cakupan (v1.1)

- Aplikasi mobile native (cukup web responsif).
- Pembayaran, notifikasi WhatsApp/email, dan integrasi alat ukur otomatis.
- Pengubahan rumus norma lewat antarmuka (norma bersifat *read-only*).
- Role "KONI/admin daerah" (lihat Pertanyaan Terbuka).

## 2. Peran Pengguna

| Peran | Cara masuk | Ringkasan hak akses |
| --- | --- | --- |
| **Pengunjung** | Tanpa login | Melihat landing page: statistik agregat, ringkasan performa, daftar cabor. Membuka hasil tes cabor hanya dengan kode akses cabor (read-only). |
| **User Cabor** (hasil pendaftaran) | Daftar lalu login | Mengelola atlet dan hasil tes **hanya untuk cabor + kabupaten/kota miliknya**. Menu yang tersedia: **Daftar Atlet, Dashboard Hasil Tes Fisik, Data Comparison, dan Cabor & Item Tes** (termasuk menambah item tes baru dan mengatur item tes cabornya). Menu **Kode Akses Cabor** dan **Norma Tes tidak ditampilkan** dan **ditolak** bila dibuka lewat URL/deep link. |
| **Superadmin** | Login (akun dibuat saat setup) | Kontrol penuh: semua menu dan semua data — cabor & daerah, atlet, item tes, kode akses, akun pengguna, norma, hapus data, dan pengaturan sistem. |

> Catatan: website acuan memiliki tiga role (Pelatih, KONI, Superadmin). Pada PRD ini "User Cabor" setara "Pelatih". Role "KONI/admin daerah" tidak dimasukkan di v1.1 (lihat Pertanyaan Terbuka).

## 3. Autentikasi & Akun

### 3.1 Login (semua peran)

- Halaman/modal login dengan field **Username** dan **Password**, tombol **Masuk**, dan tautan **Kembali ke Beranda** (sama seperti website acuan). Ditambah tautan "Belum punya akun? Daftar".
- Setelah berhasil, sistem mengarahkan sesuai peran: Superadmin dan User Cabor masuk ke panel admin.
- Pesan error generik ("Username atau password salah") tanpa membocorkan mana yang salah.
- Sesi berakhir saat tombol **Keluar** ditekan atau setelah masa tidak aktif tertentu.

### 3.2 Login Superadmin

- Satu atau lebih akun superadmin dibuat saat setup awal (seed). Superadmin tidak bisa dibuat lewat form pendaftaran publik.
- Superadmin dapat menambah, mengubah, menonaktifkan, mereset password, dan menghapus akun apa pun (menu Akun User).

### 3.3 Daftar (User Cabor)

Form pendaftaran berisi empat field wajib:

| Field | Aturan |
| --- | --- |
| Nama Cabor | Teks wajib, 3–60 karakter. Dipilih dari daftar cabor yang ada atau diketik untuk membuat cabor baru. |
| Nama Kabupaten/Kota | Wajib. Disarankan dropdown daftar kabupaten/kota Indonesia agar penulisan seragam. |
| Username | Wajib, unik, huruf kecil/angka/underscore, 4–30 karakter. |
| Password | Wajib, minimal 8 karakter; ada tombol tampilkan/sembunyikan; disimpan dalam bentuk hash. |

**Perilaku setelah daftar:**

1. Sistem membuat akun role User Cabor yang terhubung ke pasangan (cabor, kabupaten/kota).
2. Jika cabor tersebut belum ada, otomatis dibuat sebagai cabor baru lengkap dengan kode akses bawaan (mengikuti perilaku "Tambah Cabor Baru" di website acuan) dan item tes bawaan.
3. Akun langsung aktif dan pengguna diarahkan ke login (opsi persetujuan superadmin: lihat Pertanyaan Terbuka).

## 4. Struktur Halaman & Menu

### 4.1 Halaman publik (landing page)

Mengikuti susunan website acuan:

- **Header:** logo + judul situs, navigasi tengah (**Beranda, Statistik, Hasil Tes Fisik, Daftar Cabor**), tombol **Login** dan **Daftar**.
- **Hero (Beranda):** judul "Sistem Tes Pengukuran Cabang Olahraga", subjudul bahwa data bersifat agregat tanpa identitas atlet, tombol **Login ke Sistem** dan **Lihat Statistik**, serta kartu "Ringkasan Live".
- **Statistik Evaluasi Tes Fisik:** tiga kartu (**Atlet Dites, Total Cabor, Sesi Tes**) dan grafik **Jumlah Atlet Dites per Tanggal**.
- **Hasil Tes Fisik:** kartu **Rata-rata Performa** dan grafik **Distribusi Kategori Performa**, dihitung otomatis dari seluruh hasil tes tercatat.
- **Daftar Cabor:** kartu cabor terdaftar dengan pencarian dan tombol **Lihat Semua Cabor** (tidak menampilkan semua sekaligus). Klik cabor membuka dialog **Kode Akses Cabor**.
- **Footer:** logo kerja sama/pengembang dan hak cipta.
- Tambahan untuk multi-daerah: filter **Kabupaten/Kota** pada Statistik, Hasil Tes Fisik, dan Daftar Cabor.

### 4.2 Halaman hasil cabor (read-only, via kode akses)

- Header cabor dengan label **Read-only**, tombol **Kembali ke Daftar Cabor** dan **Kunci lagi**.
- Kartu ringkas: Atlet Dites, Sesi Tes, Item Tes, Status Akses.
- Filter: **Cari Nama Atlet** dan **Tanggal Sesi Tes**.
- Tabel **Daftar Atlet & Hasil Tes**: No, Nama Atlet, Usia, Kelamin, Sesi Terakhir, Sesi, Performa, Aksi. Klik nama membuka **Detail Hasil Tes Atlet** (sesi, performa, tabel jenis tes/hasil/persentase/kategori) yang identik dengan tampilan di panel admin.
- Pembatasan: maksimal 5 percobaan kode salah, lalu jeda sementara.

### 4.3 Panel setelah login

Tampilan mengikuti website acuan: header dengan logo, nama sistem, tombol **Keluar**, serta navigasi menu. Tampilan responsif dan nyaman seperti aplikasi di HP.

| Menu | Superadmin | User Cabor |
| --- | --- | --- |
| Daftar Atlet | Semua cabor | Cabor sendiri |
| Dashboard Hasil Tes Fisik | Semua cabor | Cabor sendiri |
| Data Comparison | Semua cabor | Cabor sendiri |
| Cabor & Item Tes | Penuh | Item tes cabor sendiri + tambah item tes baru |
| Kode Akses Cabor (termasuk Akun User) | Penuh | **Tidak ditampilkan — ditolak jika diakses lewat URL** |
| Norma Tes | Lihat + unduh | **Tidak ditampilkan — ditolak jika diakses lewat URL** |

Pembatasan menu User Cabor diberlakukan di sisi aplikasi: menu tidak dirender di navigasi, dan pemanggilan view secara langsung (deep link/URL `#admin/…` atau `?view=…`) ditolak dengan pesan "Akses ditolak" lalu dialihkan ke Daftar Atlet.

## 5. Kebutuhan Fungsional per Modul

### 5.1 Daftar Atlet

- Tombol **Tambah Atlet**, **Lihat Semua Atlet** (show all), dan **Hapus Semua** (hanya Superadmin, dengan konfirmasi ganda).
- Pencarian berdasarkan nama atlet dan cabor.
- **Form Tambah Atlet Baru:**
  - Mode Nama Atlet: *Atlet sudah pernah tes* (dropdown atlet lama) atau *Atlet baru (input manual)*.
  - Nama Atlet, Tempat Lahir, Tanggal Lahir, Usia (otomatis dari tanggal lahir), Jenis Kelamin (Laki-laki/Perempuan).
  - Cabang Olahraga (User Cabor: terkunci ke cabornya), Nomor Perlombaan, Tanggal Tes.
  - **Formulir Tes Fisik** dinamis sesuai item tes yang dipilih untuk cabor tersebut, dengan kalkulator Bleep Test dan RAST (lihat 5.7).
  - Catatan Tambahan dan Catatan Cedera/Kondisi Khusus Atlet.
  - Tombol **Simpan Atlet** dan **Reset**.
- **Hasil Evaluasi** setelah simpan: grafik **Indikator Jaring Laba-Laba**, skor per item, persentase total, dan kategori, dengan aksi **Edit, Cetak, CSV, Hapus**.

### 5.2 Dashboard Hasil Tes Fisik

- Kartu: Total Atlet, Total Cabor, Rata-rata Performa, Kategori Dominan.
- Filter Cabor (Semua Cabor) dan Jenis Kelamin (Semua/Laki-laki/Perempuan).
- Grafik **Distribusi Kategori Performa**.
- Tabel **Data Hasil Tes Fisik Umum**: No, Nama, Tempat/Tgl Lahir, Cabor, Usia, Kelamin, Jml Tes, Performa, Kategori, Aksi; tombol **Export CSV**; pesan kosong "Belum ada data tes fisik".

### 5.3 Data Comparison

- Filter: Dari Tanggal Tes, Sampai Tanggal Tes, Cabor, Nama Atlet.
- Kartu **Sesi Sebelumnya**, **Sesi Terbaru**, dan **Selisih (Terbaru − Sebelumnya)** dengan penanda naik/turun yang benar.
- Grafik **Tren Seluruh Riwayat Tes** (sumbu X tanggal tes, sumbu Y skor %).
- Tabel **Riwayat & Selisih Skor**: No, Tanggal Tes, Skor %, Kategori, Selisih vs Sesi Sebelumnya.

### 5.4 Cabor & Item Tes

Dapat diakses Superadmin maupun User Cabor; lingkupnya berbeda per peran.

- **Tambah Cabor Baru** (hanya Superadmin): nama cabor, kode akses (opsional, ada tombol *Generate kode*; kosong = kode bawaan dari nama cabor). Cabor baru otomatis muncul di form atlet dan statistik.
- **Daftar Cabor Terdaftar:** Superadmin melihat dan mengelola seluruh cabor; User Cabor hanya melihat cabornya sendiri (kode akses tersamar, tanpa aksi hapus).
- **Master Item Tes Fisik:** form tambah item (Nama Item Tes, Satuan) — dapat digunakan **Superadmin maupun User Cabor**; daftar *Item Tambahan (diinput admin/user)* dan *Item Bawaan Sistem* (39 item sama seperti website acuan).
- **Pengaturan Item Tes per Cabor:** pilih cabor, centang item yang dipakai (dengan kolom pencarian dan *Pilih/Lepas Semua*), lalu **Simpan Pilihan Item**. User Cabor hanya dapat mengatur item untuk **cabornya sendiri** (pilihan cabor terkunci dan upaya menyimpan untuk cabor lain ditolak). Item tersimpan menjadi isi Formulir Tes Fisik di Daftar Atlet.

### 5.5 Kode Akses Cabor & Akun User (khusus Superadmin)

Menu ini **tidak ditampilkan** untuk User Cabor dan **ditolak** bila dibuka lewat URL/deep link.

- Tabel kode akses: No, Nama Cabor, Kode Akses, Aksi; label **Bawaan** atau **Diubah**; kode dapat diubah dan disinkronkan di semua perangkat.
- **Akun User:** tambah akun dengan Username, Password, Role (**Pelatih/User Cabor, Superadmin**), dan Cabor terkait; tombol Tambah Akun dan Batal. Superadmin juga bisa menonaktifkan, reset password, dan hapus.
- Akun User Cabor hasil pendaftaran otomatis muncul di tabel ini.
- Kolom kode akses pada menu Cabor & Item Tes juga disamarkan untuk User Cabor.

### 5.6 Norma Tes (khusus Superadmin)

Menu ini **tidak ditampilkan** untuk User Cabor dan **ditolak** bila dibuka lewat URL/deep link. Halaman *read-only* yang menampilkan norma, kategori, dan rumus yang benar-benar dipakai sistem:

- **Tabel Norma & Kategori:** rentang nilai per kategori diturunkan dari mean & SD norma (z = 2, 1, 0, −1), dengan filter komponen fisik.
- **Rumus Perhitungan:** rumus skor, konversi nilai, persentase, total, dan penentuan kategori akhir.
- **Keterangan & Sumber Norma:** tabel detail per cabor & nomor dengan kolom Mean (≤17), SD (≤17), Mean (>17), SD (>17), dan Arah Nilai (semakin besar/kecil lebih baik).
- Tombol **Download CSV** dan **Download Excel (.xlsx)**.
- Bagian "A. Daftar Item Tes" tidak ditampilkan (sesuai penyesuaian terakhir di website acuan).

### 5.7 Kalkulator

- **Bleep Test:** input Level (1–21) dan Shuttle/Balikan, hasil VO2max (ml/kg/min), tombol **Terapkan ke Formulir**. Jumlah balikan per level 1–21 mengikuti tabel resmi: 7, 8, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16.
- **RAST:** input berat badan dan waktu 6 sprint × 35 m; hasil Power per sprint, Peak Power, Min Power, Avg Power, dan Fatigue Index; tombol **Terapkan ke Formulir**.

## 6. Aturan Norma & Penilaian

Seluruh norma harus **sama persis** dengan website acuan agar hasil kedua sistem konsisten.

- Sumber norma: konfigurasi sistem website acuan (mean & SD per cabor, per nomor perlombaan, per kelompok usia ≤17 dan >17, serta arah nilai). Data ini diekstrak dari menu Norma Tes website acuan dan disimpan sebagai konfigurasi data (bukan di-hardcode di tampilan).
- Kategori & rentang nilai dihitung dari mean & SD (z = 2, 1, 0, −1); persentase per item dan total performa dihitung dengan rumus yang sama dengan website acuan, lalu dipetakan ke kategori akhir (misalnya Baik, Cukup, Kurang).
- Item berbasis jenis kelamin dibaca otomatis dari jenis kelamin yang diinput, misalnya Medicine Chest Pass dan Medicine Overhead Throw: 3 kg untuk perempuan, 5 kg untuk laki-laki (satuan meter).
- Cabor baru yang belum punya norma khusus memakai norma bawaan yang sama dengan cabor sebelumnya, dan **tidak boleh menghasilkan skor seragam 50%**.
- Item berbasis skor (misalnya Shoulder Mobility, skala 3) dinilai sesuai aturan skornya.
- Arah nilai (lebih besar lebih baik atau lebih kecil lebih baik) diterapkan konsisten pada skor dan pada selisih di Data Comparison.

## 7. Model Data (tingkat tinggi)

| Entitas | Atribut utama |
| --- | --- |
| users | id, username (unik), password_hash, role, cabor_id, status, dibuat_pada |
| cabor | id, nama, kabupaten_kota, kode_akses, kode_diubah (bool) — unik pada (nama, kabupaten_kota) |
| item_tes | id, nama, satuan, tipe (bawaan/tambahan) |
| cabor_item | cabor_id, item_tes_id |
| norma | cabor/nomor, item_tes_id, kelompok_usia, jenis_kelamin (opsional), mean, sd, arah_nilai |
| atlet | id, nama, tempat_lahir, tanggal_lahir, jenis_kelamin, cabor_id, catatan_cedera |
| sesi_tes | id, atlet_id, tanggal_tes, nomor_perlombaan, catatan, skor_total, kategori |
| hasil_item | sesi_id, item_tes_id, nilai_mentah, persen, kategori |

## 8. Kebutuhan Non-Fungsional

- **Sinkronisasi:** data (cabor, item tes, akun, atlet, hasil) tersimpan terpusat dan langsung tersedia di semua laptop/perangkat. Aturan basis data harus mengizinkan semua path yang dipakai aplikasi (pelajaran dari kendala 401 pada website acuan).
- **Keamanan:** password di-hash, validasi dan otorisasi di sisi server/basis data (bukan hanya di tampilan), pembatasan percobaan login dan kode akses, User Cabor tidak bisa mengakses data cabor lain maupun menu khusus Superadmin (Kode Akses Cabor, Norma Tes) — termasuk via URL langsung.
- **Privasi:** halaman publik hanya data agregat tanpa nama atlet.
- **Responsif:** nyaman di desktop dan HP; panel setelah login terasa seperti aplikasi HP.
- **Performa:** halaman publik dimuat kurang dari 3 detik pada koneksi 4G; indikator "Memuat data dari server..." seperti website acuan.
- **Ekspor:** CSV untuk tabel data, cetak untuk hasil atlet, CSV/Excel untuk norma.
- **Teknologi (asumsi, mengikuti website acuan):** web statis (HTML/CSS/JS) di Vercel dengan penyimpanan terpusat Firebase.

## 9. Kriteria Penerimaan

1. Superadmin bisa login dan melihat serta mengelola seluruh menu, cabor, atlet, akun, dan kode akses.
2. Form daftar menerima nama cabor, nama kabupaten/kota, username, dan password; username duplikat ditolak; akun baru bisa langsung login.
3. User Cabor hanya melihat dan mengubah data cabor miliknya; mencoba membuka data cabor lain ditolak. Menu Kode Akses Cabor dan Norma Tes tidak tampil di panel User Cabor, dan akses langsung lewat URL/deep link ke menu tersebut ditolak. User Cabor dapat menambah item tes baru dan mengatur item tes untuk cabornya sendiri di menu Cabor & Item Tes.
4. Landing page menampilkan statistik agregat, rata-rata performa, distribusi kategori performa, dan daftar cabor tanpa identitas atlet.
5. Hasil tes dihitung dengan norma yang sama dengan website acuan (z-score, konversi Bleep Test, Shoulder Mobility, item berbasis kelamin); cabor baru tidak menghasilkan skor seragam 50%.
6. Halaman hasil cabor hanya dapat dibuka dengan kode akses yang benar; maksimal 5 percobaan salah sebelum jeda sementara.

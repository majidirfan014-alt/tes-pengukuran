// =====================================================================
// store.js — Penyimpanan data (localStorage)
// Entitas: users, cabor, atlet, sesi_tes, item_custom
// =====================================================================
'use strict';

var DB_KEY = 'tes_pengukuran_db_v1';

function loadDB() {
    try {
        var raw = localStorage.getItem(DB_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { users: [], cabor: [], atlet: [], sesi: [], itemCustom: [], aksesLog: [] };
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// --- AUTH ---
// Password TIDAK pernah disimpan plaintext. Format hash baru:
//   $sha256$v1$<iterasi>$<salt>$<hash>   (SHA-256 bersalt + iterasi)
// Hash lama 'h_…' tetap diverifikasi agar akun lama tidak terkunci.
var HASH_ITERASI = 1000;

function sha256Hex(ascii) {
    var msg = [];
    for (var i = 0; i < ascii.length; i++) {
        var c = ascii.charCodeAt(i);
        if (c < 0x80) {
            msg.push(c);
        } else if (c < 0x800) {
            msg.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        } else if (c < 0xd800 || c >= 0xe000) {
            msg.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        } else {
            i++;
            var cp = 0x10000 + (((c & 0x3ff) << 10) | (ascii.charCodeAt(i) & 0x3ff));
            msg.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        }
    }
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hi = Math.floor(bitLen / 4294967296);
    var lo = bitLen % 4294967296;
    msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
        (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var rotr = function(x, n) { return (x >>> n) | (x << (32 - n)); };

    for (var blk = 0; blk < msg.length; blk += 64) {
        var w = new Array(64);
        var t;
        for (t = 0; t < 16; t++) {
            w[t] = (msg[blk + t * 4] << 24) | (msg[blk + t * 4 + 1] << 16) |
                (msg[blk + t * 4 + 2] << 8) | (msg[blk + t * 4 + 3]);
        }
        for (t = 16; t < 64; t++) {
            var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
            var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
        }
        var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (t = 0; t < 64; t++) {
            var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            var ch = (e & f) ^ (~e & g);
            var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
            var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            var maj = (a & b) ^ (a & c) ^ (b & c);
            var t2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0;
            d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hex = '';
    for (var j = 0; j < 8; j++) hex += ('00000000' + (H[j] >>> 0).toString(16)).slice(-8);
    return hex;
}

function genSalt() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Hash lama (kompatibilitas akun yang sudah ada sebelum upgrade)
function hashLegacy(pw) {
    var h = 0;
    for (var i = 0; i < pw.length; i++) {
        h = ((h << 5) - h) + pw.charCodeAt(i);
        h |= 0;
    }
    return 'h_' + Math.abs(h).toString(36);
}

function hashPw(pw, salt) {
    salt = salt || genSalt();
    var h = sha256Hex(pw + ':' + salt);
    for (var i = 1; i < HASH_ITERASI; i++) h = sha256Hex(h + ':' + salt + ':' + i);
    return '$sha256$v1$' + HASH_ITERASI + '$' + salt + '$' + h;
}

function verifyPw(pw, tersimpan) {
    if (tersimpan === null || tersimpan === undefined || tersimpan === '') return false;
    tersimpan = String(tersimpan);
    if (tersimpan.indexOf('$sha256$') !== 0) return hashLegacy(pw) === tersimpan;
    var p = tersimpan.split('$');
    if (p.length !== 6) return false;
    var iter = parseInt(p[3], 10);
    if (!iter || iter < 1) iter = 1;
    var salt = p[4], target = p[5];
    var h = sha256Hex(pw + ':' + salt);
    for (var i = 1; i < iter; i++) h = sha256Hex(h + ':' + salt + ':' + i);
    return h === target;
}

function seedAdmin() {
    var db = loadDB();
    if (!db.users.some(function(u) { return u.role === 'superadmin'; })) {
        db.users.push({
            id: genId(), username: 'superadmin', password: hashPw('admin123'),
            role: 'superadmin', cabor: '', kabupaten: '', status: 'aktif', dibuat: new Date().toISOString()
        });
        saveDB(db);
    }
}

function currentUser() {
    try {
        var raw = localStorage.getItem('tes_pengukuran_session');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function login(username, password) {
    var db = loadDB();
    var u = db.users.filter(function(x) {
        return x.username === username.toLowerCase().trim() && verifyPw(password, x.password) && x.status === 'aktif';
    })[0];
    if (!u) return { ok: false, error: 'Username atau password salah' };
    localStorage.setItem('tes_pengukuran_session', JSON.stringify({
        id: u.id, username: u.username, role: u.role, cabor: u.cabor, kabupaten: u.kabupaten
    }));
    return { ok: true, user: u };
}

function logout() {
    localStorage.removeItem('tes_pengukuran_session');
}

// =====================================================================
// PENDAFTARAN PUBLIK — boleh dijalankan pengunjung tanpa login.
// Role yang tersimpan SELALU dipaksa 'cabor' di sini (sisi penyimpanan),
// param role dari klien diabaikan sehingga tidak ada yang bisa daftar
// sebagai superadmin.
// =====================================================================
var RATE_DAFTAR_KEY = 'tes_pengukuran_register_rate';
var RATE_DAFTAR_WINDOW_MS = 10 * 60 * 1000; // 10 menit
var RATE_DAFTAR_MAX_COBA = 20;              // percobaan (valid atau gagal)
var RATE_DAFTAR_MAX_SUKSES = 5;             // akun baru per 10 menit

function bacaRateDaftar() {
    var data = { coba: [], sukses: [] };
    try {
        var raw = localStorage.getItem(RATE_DAFTAR_KEY);
        if (raw) {
            var p = JSON.parse(raw);
            if (p && p.coba && p.coba.length) data.coba = p.coba;
            if (p && p.sukses && p.sukses.length) data.sukses = p.sukses;
        }
    } catch (e) {}
    var batas = Date.now() - RATE_DAFTAR_WINDOW_MS;
    data.coba = data.coba.filter(function(t) { return typeof t === 'number' && t > batas; });
    data.sukses = data.sukses.filter(function(t) { return typeof t === 'number' && t > batas; });
    return data;
}

function simpanRateDaftar(data) {
    try { localStorage.setItem(RATE_DAFTAR_KEY, JSON.stringify(data)); } catch (e) {}
}

function register(cabor, kabupaten, username, password, roleKlien) {
    // roleKlien sengaja TIDAK dibaca: role selalu dipaksa 'cabor'
    // pada db.users.push di bawah (tidak bisa daftar sebagai superadmin).
    // Rate limit sederhana: cegah spam pendaftaran
    var rate = bacaRateDaftar();
    if (rate.coba.length >= RATE_DAFTAR_MAX_COBA) {
        return { ok: false, error: 'Terlalu banyak percobaan daftar. Coba lagi dalam 10 menit.' };
    }
    rate.coba.push(Date.now());
    simpanRateDaftar(rate);

    cabor = (cabor || '').trim();
    kabupaten = (kabupaten || '').trim();
    username = (username || '').toLowerCase().trim();
    password = password || '';

    if (!cabor || !kabupaten || !username || !password) {
        return { ok: false, error: 'Semua field wajib diisi' };
    }
    if (cabor.length < 3 || cabor.length > 60) return { ok: false, error: 'Nama cabor minimal 3 karakter' };
    if (!/^[a-z0-9_]{4,30}$/.test(username)) return { ok: false, error: 'Username: huruf kecil/angka/underscore, 4-30 karakter' };
    if (password.length < 8) return { ok: false, error: 'Password minimal 8 karakter' };
    if (rate.sukses.length >= RATE_DAFTAR_MAX_SUKSES) {
        return { ok: false, error: 'Batas pendaftaran tercapai. Coba lagi dalam 10 menit.' };
    }

    var db = loadDB();
    if (db.users.some(function(u) { return u.username === username; })) {
        return { ok: false, error: 'Username sudah digunakan' };
    }
    // Buat cabor jika belum ada
    var c = db.cabor.filter(function(x) { return x.nama === cabor && x.kabupaten === kabupaten; })[0];
    if (!c) {
        c = {
            id: genId(), nama: cabor, kabupaten: kabupaten,
            kode_akses: generateKode(cabor), kode_diubah: false,
            items: defaultItemsForCabor(cabor), dibuat: new Date().toISOString()
        };
        db.cabor.push(c);
    }
    db.users.push({
        id: genId(), username: username, password: hashPw(password),
        role: 'cabor', cabor: cabor, kabupaten: kabupaten, status: 'aktif', dibuat: new Date().toISOString()
    });
    saveDB(db);
    rate.sukses.push(Date.now());
    simpanRateDaftar(rate);
    return { ok: true, username: username, cabor: cabor, kabupaten: kabupaten };
}

function generateKode(nama) {
    var base = (nama || 'cabor').toLowerCase().replace(/[^a-z0-9]/g, '').substr(0, 6);
    return base + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function isAdmin() {
    var u = currentUser();
    return !!(u && u.role === 'superadmin');
}

function isCaborUser() {
    var u = currentUser();
    return !!(u && u.role === 'cabor');
}

function isTamu() {
    var u = currentUser();
    return !!(u && u.role !== 'superadmin');
}

// Guard operasi tulis GLOBAL: hanya superadmin
function canWrite() {
    var u = currentUser();
    return !!(u && u.role === 'superadmin');
}

// Guard operasi tulis terarah:
// - superadmin: semua data
// - role cabor: hanya data cabor miliknya sendiri
// - tamu/pengunjung (tanpa sesi / role lain): tidak bisa menulis apa pun
function bolehTulisCabor(caborNama) {
    var u = currentUser();
    if (!u) return false;
    if (u.role === 'superadmin') return true;
    if (u.role === 'cabor') return !!caborNama && u.cabor === caborNama;
    return false;
}

// --- CABOR ---
function listCabor() { return loadDB().cabor; }

// Daftar cabor sesuai hak akses: superadmin semua, user cabor hanya miliknya
function listCaborScope() {
    var list = listCabor();
    var u = currentUser();
    if (u && u.role === 'cabor') list = list.filter(function(c) { return c.nama === u.cabor; });
    return list;
}

function findCabor(id) {
    return loadDB().cabor.filter(function(c) { return c.id === id; })[0] || null;
}

function findCaborByNama(nama, kab) {
    return loadDB().cabor.filter(function(c) {
        return c.nama === nama && (!kab || c.kabupaten === kab);
    })[0] || null;
}

function addCabor(nama, kode) {
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    var db = loadDB();
    var c = {
        id: genId(), nama: nama, kabupaten: currentUser().kabupaten || '',
        kode_akses: kode || generateKode(nama), kode_diubah: !!kode,
        items: defaultItemsForCabor(nama), dibuat: new Date().toISOString()
    };
    db.cabor.push(c);
    saveDB(db);
    return c;
}

function updateCabor(id, data) {
    var u = currentUser();
    if (!u) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    var db = loadDB();
    var c = db.cabor.filter(function(x) { return x.id === id; })[0];
    if (u.role !== 'superadmin') {
        // User cabor: hanya boleh mengubah item tes pada cabornya sendiri.
        // Nama, kabupaten & kode akses hanya superadmin (menu Kode Akses Cabor).
        var kunci = Object.keys(data || {});
        var hanyaItem = kunci.length > 0 && kunci.every(function(k) { return k === 'items'; });
        if (u.role !== 'cabor' || !c || u.cabor !== c.nama || !hanyaItem) {
            return { ok: false, error: 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data' };
        }
    }
    if (!c) return { ok: false, error: 'Cabor tidak ditemukan' };
    Object.keys(data).forEach(function(k) { c[k] = data[k]; });
    saveDB(db);
    return { ok: true };
}

function hapusCabor(id) {
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    var db = loadDB();
    db.cabor = db.cabor.filter(function(c) { return c.id !== id; });
    saveDB(db);
    return { ok: true };
}

// --- ITEM TES ---
function defaultItemsForCabor(nama) {
    // Default: semua item bawaan kecuali antropometri & override
    return NORMA_ITEMS.filter(function(it) {
        return it.komponen_fisik !== 'Antropometri' && it.komponen_fisik !== 'Ringkasan (override)';
    }).map(function(it) { return it.nama; });
}

function listAllItems() {
    var db = loadDB();
    var builtin = NORMA_ITEMS.map(function(it) { return { nama: it.nama, satuan: it.satuan, tipe: 'bawaan' }; });
    var custom = (db.itemCustom || []).map(function(it) { return { nama: it.nama, satuan: it.satuan, tipe: 'tambahan' }; });
    return builtin.concat(custom);
}

function addItemCustom(nama, satuan) {
    // Master item tes: superadmin & user cabor (PRD 5.4). Tamu ditolak.
    if (!canWrite() && !isCaborUser()) return { ok: false, error: 'Akses ditolak: hanya superadmin atau user cabor yang dapat menulis data' };
    var db = loadDB();
    db.itemCustom = db.itemCustom || [];
    db.itemCustom.push({ id: genId(), nama: nama, satuan: satuan });
    saveDB(db);
    return { ok: true };
}

// --- ATLET ---
function listAtlet(filter) {
    var db = loadDB();
    var list = db.atlet.slice();
    var u = currentUser();
    if (u && u.role === 'cabor') {
        list = list.filter(function(a) { return a.cabor_nama === u.cabor; });
    }
    if (filter) {
        if (filter.cabor) list = list.filter(function(a) { return a.cabor_nama === filter.cabor; });
        if (filter.nama) list = list.filter(function(a) {
            return a.nama.toLowerCase().indexOf(filter.nama.toLowerCase()) >= 0;
        });
    }
    return list;
}

function findAtlet(id) {
    return loadDB().atlet.filter(function(a) { return a.id === id; })[0] || null;
}

function addAtlet(data) {
    if (!bolehTulisCabor(data && data.cabor_nama)) {
        return { ok: false, error: 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data' };
    }
    var db = loadDB();
    var a = {
        id: genId(),
        nama: data.nama, tempat_lahir: data.tempat_lahir, tanggal_lahir: data.tanggal_lahir,
        jenis_kelamin: data.jenis_kelamin, cabor_nama: data.cabor_nama, nomor: data.nomor || '',
        catatan: data.catatan || '', catatan_cedera: data.catatan_cedera || '',
        dibuat: new Date().toISOString()
    };
    db.atlet.push(a);
    saveDB(db);
    return a;
}

function updateAtlet(id, data) {
    var db = loadDB();
    var a = db.atlet.filter(function(x) { return x.id === id; })[0];
    if (!a) return { ok: false, error: 'Atlet tidak ditemukan' };
    if (!bolehTulisCabor(a.cabor_nama)) {
        return { ok: false, error: 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data' };
    }
    // User cabor tidak boleh memindahkan atlet ke cabor lain
    if (data && data.cabor_nama !== undefined && !bolehTulisCabor(data.cabor_nama)) {
        return { ok: false, error: 'Akses ditolak: tidak boleh memindahkan atlet ke cabor lain' };
    }
    Object.keys(data).forEach(function(k) { a[k] = data[k]; });
    saveDB(db);
    return { ok: true };
}

function hapusAtlet(id) {
    var db = loadDB();
    var a = db.atlet.filter(function(x) { return x.id === id; })[0];
    if (!a) return { ok: false, error: 'Atlet tidak ditemukan' };
    if (!bolehTulisCabor(a.cabor_nama)) {
        return { ok: false, error: 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menghapus data' };
    }
    db.atlet = db.atlet.filter(function(x) { return x.id !== id; });
    db.sesi = db.sesi.filter(function(s) { return s.atlet_id !== id; });
    saveDB(db);
    return { ok: true };
}

function hapusSemuaAtlet() {
    if (!canWrite()) return;
    var db = loadDB();
    db.atlet = [];
    db.sesi = [];
    saveDB(db);
}

// --- SESI TES ---
function listSesi(atletId) {
    return loadDB().sesi.filter(function(s) { return s.atlet_id === atletId; })
        .sort(function(a, b) { return (b.tanggal_tes || '').localeCompare(a.tanggal_tes || ''); });
}

function findSesi(id) {
    return loadDB().sesi.filter(function(s) { return s.id === id; })[0] || null;
}

function addSesi(data) {
    var atlet = data && data.atlet_id ? findAtlet(data.atlet_id) : null;
    var caborAtlet = atlet ? atlet.cabor_nama : (data && data.cabor_nama ? data.cabor_nama : '');
    if (!bolehTulisCabor(caborAtlet)) return null;
    var db = loadDB();
    var s = {
        id: genId(),
        atlet_id: data.atlet_id, tanggal_tes: data.tanggal_tes,
        nomor: data.nomor || '', catatan: data.catatan || '',
        nilai: data.nilai || {}, dibuat: new Date().toISOString()
    };
    db.sesi.push(s);
    saveDB(db);
    return s;
}

function updateSesi(id, data) {
    var db = loadDB();
    var s = db.sesi.filter(function(x) { return x.id === id; })[0];
    if (!s) return { ok: false, error: 'Sesi tes tidak ditemukan' };
    var atlet = findAtlet(s.atlet_id);
    if (!bolehTulisCabor(atlet ? atlet.cabor_nama : '')) {
        return { ok: false, error: 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data' };
    }
    Object.keys(data).forEach(function(k) { s[k] = data[k]; });
    saveDB(db);
    return { ok: true };
}

function hapusSesi(id) {
    var db = loadDB();
    var s = db.sesi.filter(function(x) { return x.id === id; })[0];
    if (!s) return { ok: false, error: 'Sesi tes tidak ditemukan' };
    var atlet = findAtlet(s.atlet_id);
    if (!bolehTulisCabor(atlet ? atlet.cabor_nama : '')) {
        return { ok: false, error: 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menghapus data' };
    }
    db.sesi = db.sesi.filter(function(x) { return x.id !== id; });
    saveDB(db);
    return { ok: true };
}

function evalSesi(s) {
    if (!s) return null;
    var a = findAtlet(s.atlet_id);
    if (!a) return null;
    var c = findCaborByNama(a.cabor_nama, a.kabupaten);
    var items = (c && c.items) ? c.items : defaultItemsForCabor(a.cabor_nama);

    // Sumber tinggi/berat untuk IMT: utamakan sesi yang sedang dibuka.
    // Jika kosong/tidak valid, pakai catatan terbaru atlet pada/sebelum tanggal tes.
    var nil = s.nilai || {};
    var tinggi = nil['Tinggi Badan'];
    var berat = nil['Berat Badan'];
    var imtCatatan = '';
    if (hitungIMT(berat, tinggi) === null) {
        var lain = loadDB().sesi.filter(function(x) {
            return x.atlet_id === s.atlet_id && x.id !== s.id &&
                (x.tanggal_tes || '') <= (s.tanggal_tes || '') &&
                hitungIMT((x.nilai || {})['Berat Badan'], (x.nilai || {})['Tinggi Badan']) !== null;
        }).sort(function(p, q) {
            return (q.tanggal_tes || '').localeCompare(p.tanggal_tes || '');
        })[0];
        if (lain) {
            tinggi = lain.nilai['Tinggi Badan'];
            berat = lain.nilai['Berat Badan'];
            imtCatatan = 'dari data atlet ' + lain.tanggal_tes;
        }
    }

    return computeEvaluation({
        usia: hitungUsia(a.tanggal_lahir, s.tanggal_tes),
        kelamin: a.jenis_kelamin,
        items: items,
        nilai: s.nilai,
        tinggiCm: tinggi,
        beratKg: berat,
        imtCatatan: imtCatatan,
        cabor: a.cabor_nama,
        owner: pemilikNormaUntuk(a.cabor_nama, s.nomor || a.nomor)
    });
}

function hitungUsia(tglLahir, tglTes) {
    if (!tglLahir) return 0;
    var lahir = new Date(tglLahir);
    var tes = tglTes ? new Date(tglTes) : new Date();
    var usia = tes.getFullYear() - lahir.getFullYear();
    var m = tes.getMonth() - lahir.getMonth();
    if (m < 0 || (m === 0 && tes.getDate() < lahir.getDate())) usia--;
    return usia;
}

// --- AKSES LOG (pembatasan kode akses) ---
// Sengaja tanpa guard login: pencatat percobaan kode akses dari halaman publik.
// Isinya hanya status benar/salah + waktu (append-only, tanpa data sensitif).
function logAkses(caborId, benar) {
    var db = loadDB();
    db.aksesLog = db.aksesLog || [];
    db.aksesLog.push({ caborId: caborId, benar: benar, waktu: new Date().toISOString() });
    saveDB(db);
}

function cekBatasanAkses(caborId) {
    var db = loadDB();
    var log = (db.aksesLog || []).filter(function(l) {
        return l.caborId === caborId && !l.benar;
    });
    // Hitung 5 percobaan salah terakhir dalam 10 menit
    var now = Date.now();
    var recent = log.filter(function(l) {
        return now - new Date(l.waktu).getTime() < 10 * 60 * 1000;
    });
    return recent.length >= 5;
}

// --- SCOPED ---
function scopedAtlet() {
    return listAtlet();
}

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
function hashPw(pw) {
    // Simple hash untuk demo (production: gunakan bcrypt server-side)
    var h = 0;
    for (var i = 0; i < pw.length; i++) {
        h = ((h << 5) - h) + pw.charCodeAt(i);
        h |= 0;
    }
    return 'h_' + Math.abs(h).toString(36);
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
        return x.username === username.toLowerCase().trim() && x.password === hashPw(password) && x.status === 'aktif';
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

function register(cabor, kabupaten, username, password) {
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    username = (username || '').toLowerCase().trim();
    if (!cabor || cabor.length < 3) return { ok: false, error: 'Nama cabor minimal 3 karakter' };
    if (!kabupaten) return { ok: false, error: 'Kabupaten/Kota wajib diisi' };
    if (!/^[a-z0-9_]{4,30}$/.test(username)) return { ok: false, error: 'Username: huruf kecil/angka/underscore, 4-30 karakter' };
    if (!password || password.length < 8) return { ok: false, error: 'Password minimal 8 karakter' };

    var db = loadDB();
    if (db.users.some(function(u) { return u.username === username; })) {
        return { ok: false, error: 'Username sudah dipakai' };
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
    return { ok: true };
}

function generateKode(nama) {
    var base = (nama || 'cabor').toLowerCase().replace(/[^a-z0-9]/g, '').substr(0, 6);
    return base + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function isAdmin() {
    var u = currentUser();
    return u && u.role === 'superadmin';
}

function isCaborUser() {
    var u = currentUser();
    return u && u.role === 'cabor';
}

function isTamu() {
    var u = currentUser();
    return u && u.role !== 'superadmin';
}

// Guard operasi tulis: tolak untuk non-superadmin
function canWrite() {
    var u = currentUser();
    return u && u.role === 'superadmin';
}

// --- CABOR ---
function listCabor() { return loadDB().cabor; }

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
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    var db = loadDB();
    var c = db.cabor.filter(function(x) { return x.id === id; })[0];
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
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
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
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
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
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    var db = loadDB();
    var a = db.atlet.filter(function(x) { return x.id === id; })[0];
    if (!a) return { ok: false };
    Object.keys(data).forEach(function(k) { a[k] = data[k]; });
    saveDB(db);
    return { ok: true };
}

function hapusAtlet(id) {
    if (!canWrite()) return;
    var db = loadDB();
    db.atlet = db.atlet.filter(function(a) { return a.id !== id; });
    db.sesi = db.sesi.filter(function(s) { return s.atlet_id !== id; });
    saveDB(db);
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
    if (!canWrite()) return null;
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
    if (!canWrite()) return { ok: false, error: 'Akses ditolak: hanya superadmin yang dapat menulis data' };
    var db = loadDB();
    var s = db.sesi.filter(function(x) { return x.id === id; })[0];
    if (!s) return { ok: false };
    Object.keys(data).forEach(function(k) { s[k] = data[k]; });
    saveDB(db);
    return { ok: true };
}

function hapusSesi(id) {
    if (!canWrite()) return;
    var db = loadDB();
    db.sesi = db.sesi.filter(function(s) { return s.id !== id; });
    saveDB(db);
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

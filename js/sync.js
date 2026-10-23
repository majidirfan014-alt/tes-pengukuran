// =====================================================================
// sync.js — Sinkronisasi data localStorage <-> Firestore (Firebase)
//
// Alur:
//   Backup  : semua koleksi lokal -> Firestore (batch, 400 operasi/batch,
//             dokumen remote yang tidak ada di lokal ikut dihapus)
//   Pulihkan: semua koleksi Firestore -> localStorage (MENGGANTI data lokal)
// Plus dokumen sinkron/ringkasan untuk info "sinkron terakhir".
//
// Koleksi: users, cabor, atlet, sesi, itemCustom, aksesLog.
// Hanya superadmin (canWrite) yang boleh sinkron.
// =====================================================================
'use strict';

var SINKRON_KOLEKSI = ['users', 'cabor', 'atlet', 'sesi', 'itemCustom', 'aksesLog'];
var SINKRON_META_KOLEKSI = 'sinkron';
var SINKRON_META_ID = 'ringkasan';
var SINKRON_LS_KEY = 'tes_pengukuran_sync';
var SINKRON_BATCH_LIMIT = 400;

function sinkronFirestore() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    try { return firebase.firestore(); } catch (e) { return null; }
}

function sinkronSetStatus(msg, warna) {
    var el = null;
    try { el = document.getElementById('sinkronStatus'); } catch (e) {}
    if (el) {
        el.textContent = msg || '';
        el.className = 'text-sm font-semibold ' + (warna || 'text-slate-500');
    }
    try { console.log('[sinkron] ' + msg); } catch (e) {}
}

function sinkronInfoTersimpan() {
    try {
        var raw = localStorage.getItem(SINKRON_LS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function sinkronCatatInfo(arah, jumlah, oleh) {
    var info = {
        waktu: new Date().toISOString(),
        arah: arah,
        jumlah: jumlah,
        oleh: oleh || (currentUser() ? currentUser().username : '')
    };
    try { localStorage.setItem(SINKRON_LS_KEY, JSON.stringify(info)); } catch (e) {}
    return info;
}

function renderSinkron() {
    var db = null;
    try { db = loadDB(); } catch (e) {}
    var setTxt = function (id, v) {
        var el = null;
        try { el = document.getElementById(id); } catch (e) {}
        if (el) el.textContent = v;
    };
    if (db) {
        setTxt('sinkronJmlAtlet', (db.atlet || []).length);
        setTxt('sinkronJmlSesi', (db.sesi || []).length);
        setTxt('sinkronJmlCabor', (db.cabor || []).length);
        setTxt('sinkronJmlUser', (db.users || []).length);
    }
    var info = sinkronInfoTersimpan();
    setTxt('sinkronTerakhir', info
        ? (info.waktu + ' · ' + info.arah + ' · ' + info.jumlah + ' record · oleh ' + info.oleh)
        : 'Belum pernah sinkron');
    if (!sinkronFirestore()) {
        sinkronSetStatus('Firebase SDK belum termuat — cek koneksi internet lalu muat ulang halaman.', 'text-amber-600');
    } else {
        var pid = '-';
        try { pid = firebase.app().options.projectId; } catch (e) {}
        sinkronSetStatus('Siap — proyek Firebase: ' + pid, 'text-slate-500');
    }
}

// Terapkan operasi {t:'set'|'delete', id, data?} per koleksi dalam batch 400
async function sinkronCommitKoleksi(fs, nama, ops) {
    for (var i = 0; i < ops.length; i += SINKRON_BATCH_LIMIT) {
        var bagian = ops.slice(i, i + SINKRON_BATCH_LIMIT);
        var batch = fs.batch();
        bagian.forEach(function (op) {
            var ref = fs.collection(nama).doc(op.id);
            if (op.t === 'set') batch.set(ref, op.data);
            else batch.delete(ref);
        });
        await batch.commit();
    }
}

// --- BACKUP: lokal -> Firestore ---
async function sinkronBackup() {
    if (typeof canWrite === 'function' && !canWrite()) {
        alert('Akses ditolak: hanya superadmin yang dapat sinkron data.');
        return false;
    }
    var fs = sinkronFirestore();
    if (!fs) {
        alert('Firebase SDK belum termuat. Cek koneksi internet lalu muat ulang halaman.');
        return false;
    }
    var db = loadDB();
    var lokal = JSON.parse(JSON.stringify(db || {}));
    var jumlah = {};
    var total = 0;
    sinkronSetStatus('Mengunggah data ke Firestore...', 'text-blue-600');
    try {
        for (var i = 0; i < SINKRON_KOLEKSI.length; i++) {
            var nama = SINKRON_KOLEKSI[i];
            var rows = (lokal[nama] || []).filter(function (r) { return r && r.id; });
            var snap = await fs.collection(nama).get();
            var adaRemote = {};
            snap.docs.forEach(function (d) { adaRemote[d.id] = true; });
            var ops = rows.map(function (r) { return { t: 'set', id: String(r.id), data: r }; });
            rows.forEach(function (r) { adaRemote[String(r.id)] = false; });
            Object.keys(adaRemote).forEach(function (id) {
                if (adaRemote[id]) ops.push({ t: 'delete', id: id });
            });
            await sinkronCommitKoleksi(fs, nama, ops);
            jumlah[nama] = rows.length;
            total += rows.length;
        }
        var info = sinkronCatatInfo('Backup (ke Firestore)', total);
        await fs.collection(SINKRON_META_KOLEKSI).doc(SINKRON_META_ID).set({
            arah: 'backup', waktu: info.waktu, oleh: info.oleh,
            jumlah: String(total), rincian: JSON.stringify(jumlah)
        });
        sinkronSetStatus('Backup selesai — ' + total + ' record tersimpan di Firestore.', 'text-emerald-600');
        renderSinkron();
        return true;
    } catch (e) {
        var pesan = (e && e.message) ? e.message : String(e);
        sinkronSetStatus('Backup gagal: ' + pesan, 'text-red-600');
        alert('Backup gagal: ' + pesan);
        return false;
    }
}

// --- PULIHKAN: Firestore -> lokal (MENGGANTI data lokal) ---
async function sinkronPulihkan() {
    if (typeof canWrite === 'function' && !canWrite()) {
        alert('Akses ditolak: hanya superadmin yang dapat sinkron data.');
        return false;
    }
    var fs = sinkronFirestore();
    if (!fs) {
        alert('Firebase SDK belum termuat. Cek koneksi internet lalu muat ulang halaman.');
        return false;
    }
    var yakin = false;
    try {
        yakin = confirm('Pulihkan data dari Firestore?\n\nSEMUA data lokal (atlet, sesi, cabor, user) akan DIGANTI dengan isi Firestore. Data lokal yang tidak ada di Firestore akan hilang.');
    } catch (e) { yakin = false; }
    if (!yakin) {
        sinkronSetStatus('Pulihkan dibatalkan.', 'text-slate-500');
        return false;
    }
    sinkronSetStatus('Mengambil data dari Firestore...', 'text-blue-600');
    try {
        var dbBaru = { users: [], cabor: [], atlet: [], sesi: [], itemCustom: [], aksesLog: [] };
        var total = 0;
        for (var i = 0; i < SINKRON_KOLEKSI.length; i++) {
            var nama = SINKRON_KOLEKSI[i];
            var snap = await fs.collection(nama).get();
            dbBaru[nama] = snap.docs.map(function (d) { return d.data(); });
            total += dbBaru[nama].length;
        }
        saveDB(dbBaru);
        if (!dbBaru.users.length && typeof seedAdmin === 'function') seedAdmin();
        sinkronCatatInfo('Pulihkan (dari Firestore)', total);
        sinkronSetStatus('Pulihkan selesai — ' + total + ' record dimuat. Memuat ulang halaman...', 'text-emerald-600');
        try { setTimeout(function () { location.reload(); }, 700); } catch (e) {}
        return true;
    } catch (e) {
        var pesan = (e && e.message) ? e.message : String(e);
        sinkronSetStatus('Pulihkan gagal: ' + pesan, 'text-red-600');
        alert('Pulihkan gagal: ' + pesan);
        return false;
    }
}

// =====================================================================
// AKUN CLOUD — login lintas perangkat (Firestore)
//
// Masalah: users tersimpan di localStorage sehingga akun yang dibuat di
// laptop tidak ada di HP. Solusi: cari akun di server bila login lokal
// gagal, dan unggah akun + data miliknya agar tersedia di perangkat lain.
//   - Password tetap hash SHA-256 bersalt (format lama, TIDAK plaintext)
//   - Dokumen users memakai ID = username (stabil, tanpa duplikat)
//   - Tarik data: gabung (server menang per ID), baris lokal tak dihapus
//   - Unggah data: hanya menulis, tidak pernah menghapus data server
// =====================================================================
var CLOUD_USER_KOLEKSI = 'users';
var CLOUD_AUTO_PUSH_KEY = 'tes_pengukuran_cloud_push';
var CLOUD_AUTO_PUSH_MS = 3 * 60 * 1000;

function cloudDocIdUser(username) {
    return String(username === null || username === undefined ? '' : username).toLowerCase().trim();
}

// Baris data (cabor/atlet/sesi) milik sebuah akun.
// Superadmin: seluruh data. User cabor: hanya data cabornya.
function cloudScopeRows(db, u) {
    db = db || loadDB();
    var kosong = { cabor: [], atlet: [], sesi: [] };
    if (!u) return kosong;
    if (u.role === 'superadmin') {
        return {
            cabor: (db.cabor || []).slice(),
            atlet: (db.atlet || []).slice(),
            sesi: (db.sesi || []).slice()
        };
    }
    var atlet = (db.atlet || []).filter(function(a) { return a.cabor_nama === u.cabor; });
    var idAtlet = {};
    atlet.forEach(function(a) { idAtlet[a.id] = true; });
    return {
        cabor: (db.cabor || []).filter(function(c) { return c.nama === u.cabor; }),
        atlet: atlet,
        sesi: (db.sesi || []).filter(function(s) { return idAtlet[s.atlet_id]; })
    };
}

// Gabung baris server ke lokal: per ID, server menang, lokal tidak ada yang hilang.
function cloudGabung(lokal, server) {
    var byId = {};
    (lokal || []).forEach(function(r) { if (r && r.id) byId[String(r.id)] = r; });
    (server || []).forEach(function(r) { if (r && r.id) byId[String(r.id)] = r; });
    return Object.keys(byId).map(function(k) { return byId[k]; });
}

// Cari akun AKTIF di server berdasarkan username (huruf kecil).
async function cloudCariUser(username) {
    var fs = sinkronFirestore();
    if (!fs) return [];
    var snap = await fs.collection(CLOUD_USER_KOLEKSI)
        .where('username', '==', cloudDocIdUser(username))
        .limit(10)
        .get();
    return snap.docs.map(function(d) { return d.data(); })
        .filter(function(x) { return x && x.username && x.status === 'aktif'; });
}

// Login ke server — dipanggil app.js bila login lokal gagal (akun perangkat lain).
// Selalu mengembalikan {ok, error?}; TIDAK PERNAH melempar error.
// Pesan error spesifik (sesuai permintaan pemilik) agar mudah ditelusuri:
//   "Username tidak ditemukan" / "Password salah" / pesan koneksi.
async function cloudLogin(username, password) {
    try {
        var uname = cloudDocIdUser(username);
        var pw = String(password === null || password === undefined ? '' : password);
        if (!uname) return { ok: false, error: 'Username atau password salah' };
        var fs = sinkronFirestore();
        if (!fs) {
            return { ok: false, error: 'Layanan sinkronisasi server belum siap. Muat ulang halaman atau periksa koneksi internet.' };
        }
        var daftar = await cloudCariUser(uname);
        if (!daftar.length) {
            try { console.warn('[login-server] username "' + uname + '" tidak ada di server'); } catch (e) {}
            return { ok: false, error: 'Username tidak ditemukan' };
        }
        var u = daftar.filter(function(x) { return cocokPassword(pw, x.password); })[0];
        if (!u) {
            try { console.warn('[login-server] password salah untuk username "' + uname + '"'); } catch (e) {}
            return { ok: false, error: 'Password salah' };
        }
        // Akun server menjadi acuan lokal (ID sama di semua perangkat)
        var db = loadDB();
        db.users = (db.users || []).filter(function(x) {
            return String(x.username).toLowerCase() !== uname;
        });
        db.users.push(u);
        saveDB(db);
        localStorage.setItem('tes_pengukuran_session', JSON.stringify({
            id: u.id, username: u.username, role: u.role, cabor: u.cabor, kabupaten: u.kabupaten
        }));
        var tarik = await cloudTarikDataAkun(u);
        return { ok: true, user: u, dariServer: true, dataDitarik: tarik };
    } catch (e) {
        try { console.warn('[login-server] gagal terhubung: ' + ((e && e.message) || e)); } catch (err) {}
        return { ok: false, error: 'Gagal terhubung ke server. Periksa koneksi internet lalu coba lagi.' };
    }
}

// Tarik atlet + hasil tes milik akun dari server -> lokal (migrasi perangkat baru).
async function cloudTarikDataAkun(u) {
    var hasil = { cabor: 0, atlet: 0, sesi: 0 };
    var fs = sinkronFirestore();
    if (!fs || !u) return hasil;
    var semua = u.role === 'superadmin';

    var snapCabor = semua
        ? await fs.collection('cabor').get()
        : await fs.collection('cabor').where('nama', '==', u.cabor).get();
    var snapAtlet = semua
        ? await fs.collection('atlet').get()
        : await fs.collection('atlet').where('cabor_nama', '==', u.cabor).get();
    var snapSesi = await fs.collection('sesi').get();

    var serverAtlet = snapAtlet.docs.map(function(d) { return d.data(); });
    var idAtlet = {};
    serverAtlet.forEach(function(a) { if (a && a.id) idAtlet[String(a.id)] = true; });
    var serverSesi = snapSesi.docs.map(function(d) { return d.data(); })
        .filter(function(s) { return s && idAtlet[String(s.atlet_id)]; });

    var db = loadDB();
    db.cabor = cloudGabung(db.cabor, snapCabor.docs.map(function(d) { return d.data(); }));
    db.atlet = cloudGabung(db.atlet, serverAtlet);
    db.sesi = cloudGabung(db.sesi, serverSesi);
    saveDB(db);

    hasil.cabor = snapCabor.size;
    hasil.atlet = snapAtlet.size;
    hasil.sesi = serverSesi.length;
    return hasil;
}

// Unggah akun + data miliknya ke server. Hanya MENULIS (tidak menghapus),
// sehingga data perangkat lain tidak ikut hilang.
async function cloudUnggahAkun(u) {
    var hasil = { ok: false, jumlah: 0 };
    try {
        if (!u || !u.username) return hasil;
        var fs = sinkronFirestore();
        if (!fs) return hasil;
        var db = loadDB();
        var lokal = (db.users || []).filter(function(x) {
            return String(x.username).toLowerCase() === cloudDocIdUser(u.username);
        })[0] || u;
        var scope = cloudScopeRows(db, u);

        await sinkronCommitKoleksi(fs, CLOUD_USER_KOLEKSI,
            [{ t: 'set', id: cloudDocIdUser(lokal.username), data: lokal }]);
        await Promise.all(['cabor', 'atlet', 'sesi'].map(function(kol) {
            return sinkronCommitKoleksi(fs, kol, scope[kol].filter(function(r) { return r && r.id; })
                .map(function(r) { return { t: 'set', id: String(r.id), data: r }; }));
        }));

        hasil.ok = true;
        hasil.jumlah = 1 + scope.cabor.length + scope.atlet.length + scope.sesi.length;
        return hasil;
    } catch (e) {
        try { console.warn('[cloud] unggah gagal: ' + ((e && e.message) || e)); } catch (err) {}
        return hasil;
    }
}

// Unggah otomatis saat aplikasi dibuka dengan sesi aktif (dibatasi frekuensi).
// Inilah yang membuat akun lama di laptop ikut terunggah tanpa pendaftaran ulang.
function cloudSinkronOtomatis() {
    try {
        var u = currentUser();
        if (!u || !sinkronFirestore()) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        var terakhir = 0;
        try { terakhir = parseInt(localStorage.getItem(CLOUD_AUTO_PUSH_KEY) || '0', 10) || 0; } catch (e) {}
        if (Date.now() - terakhir < CLOUD_AUTO_PUSH_MS) return;
        try { localStorage.setItem(CLOUD_AUTO_PUSH_KEY, String(Date.now())); } catch (e) {}
        cloudUnggahAkun(u).then(function(r) {
            if (r && r.ok) {
                try { console.log('[cloud] unggah otomatis ' + r.jumlah + ' record untuk ' + u.username); } catch (e) {}
            }
        });
    } catch (e) {}
}

// =====================================================================
// MIGRASI SEKALI JALAN — pindahkan akun lama (localStorage) ke server.
//
// Untuk perangkat lama yang akunnya (mis. "sepaturoda") hanya tersimpan di
// localStorage sehingga tidak bisa dipakai di HP. Jalankan MANUAL dari
// console browser (F12) di perangkat lama tersebut:
//     await cloudMigrasiAkunLama()
// Aturan aman:
//   - Akun yang SUDAH ada di server DILEWATI (tidak ditimpa).
//   - Akun lokal yang belum ada di server diunggah beserta data miliknya
//     (cabor/atlet/sesi sesuai scope akun) — hanya MENULIS, tidak menghapus.
// =====================================================================
async function cloudMigrasiAkunLama() {
    var hasil = { pindah: 0, lewati: 0, gagal: 0, detail: [] };
    var fs = sinkronFirestore();
    if (!fs) {
        console.warn('[migrasi] Firebase SDK belum termuat — muat ulang halaman dengan koneksi internet lalu ulangi.');
        return hasil;
    }
    var db = loadDB();
    var daftar = (db.users || []).slice();
    if (!daftar.length) {
        console.warn('[migrasi] tidak ada akun di penyimpanan browser ini.');
        return hasil;
    }
    for (var i = 0; i < daftar.length; i++) {
        var u = daftar[i];
        var nama = String(u.username || '(tanpa username)');
        try {
            var ada = await cloudCariUser(cloudDocIdUser(nama));
            if (ada.length) {
                hasil.lewati++;
                hasil.detail.push(nama + ': sudah ada di server (dilewati)');
                continue;
            }
            var r = await cloudUnggahAkun(u);
            if (r && r.ok) {
                hasil.pindah++;
                hasil.detail.push(nama + ': dipindah (' + r.jumlah + ' record)');
            } else {
                hasil.gagal++;
                hasil.detail.push(nama + ': GAGAL unggah');
            }
        } catch (e) {
            hasil.gagal++;
            hasil.detail.push(nama + ': GAGAL (' + ((e && e.message) || e) + ')');
        }
    }
    console.log('[migrasi] selesai — pindah: ' + hasil.pindah + ', lewati: ' +
        hasil.lewati + ', gagal: ' + hasil.gagal);
    hasil.detail.forEach(function(d) { console.log('[migrasi] ' + d); });
    return hasil;
}

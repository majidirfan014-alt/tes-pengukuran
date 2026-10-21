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

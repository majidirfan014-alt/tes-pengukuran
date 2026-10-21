// test-firebase-sync.js — Verifikasi integrasi sinkron localStorage <-> Firestore
// Jalankan: node test/test-firebase-sync.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const akar = path.join(__dirname, '..');
let pass = 0, fail = 0;

function check(nama, aktual, harap) {
    const ok = JSON.stringify(aktual) === JSON.stringify(harap);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS  | ' : 'GAGAL  | ') + nama +
        ' | harap: ' + JSON.stringify(harap) + ' | aktual: ' + JSON.stringify(aktual));
}

console.log('=== VERIFIKASI SINKRON FIREBASE/FIRESTORE ===\n');

// --- 1. Berkas konfigurasi & modul sinkron ---
console.log('--- Berkas & sumber kode ---');
const cfgPath = path.join(akar, 'js/firebase-config.js');
const syncPath = path.join(akar, 'js/sync.js');
check('js/firebase-config.js ada', fs.existsSync(cfgPath), true);
check('js/sync.js ada', fs.existsSync(syncPath), true);
const cfg = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf8') : '';
const sync = fs.existsSync(syncPath) ? fs.readFileSync(syncPath, 'utf8') : '';
const appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
const preview = fs.readFileSync(path.join(akar, 'test/preview.html'), 'utf8');
const cdp = fs.readFileSync(path.join(akar, 'test/_cdp.js'), 'utf8');

check('config: projectId tespengukuran-bb50b', cfg.indexOf("projectId: 'tespengukuran-bb50b'") >= 0, true);
check('config: apiKey ada', cfg.indexOf('AIzaSy') >= 0, true);
check('config: initializeApp dipanggil sekali', cfg.indexOf('firebase.apps.length === 0') >= 0 && cfg.indexOf('firebase.initializeApp(firebaseConfig)') >= 0, true);
check('sync: fungsi backup/pulihkan/render ada',
    sync.indexOf('async function sinkronBackup(') >= 0 &&
    sync.indexOf('async function sinkronPulihkan(') >= 0 &&
    sync.indexOf('function renderSinkron(') >= 0, true);
check('sync: 6 koleksi + meta ringkasan',
    ['users', 'cabor', 'atlet', 'sesi', 'itemCustom', 'aksesLog'].every(function(k) { return sync.indexOf("'" + k + "'") >= 0; }) &&
    sync.indexOf("var SINKRON_META_ID = 'ringkasan'") >= 0, true);
check('sync: guard hanya superadmin (canWrite) di backup & pulihkan',
    (sync.match(/typeof canWrite === 'function' && !canWrite\(\)/g) || []).length === 2, true);
check('sync: batch 400 operasi', sync.indexOf('var SINKRON_BATCH_LIMIT = 400') >= 0, true);
check('sync: pulihkan minta konfirmasi', sync.indexOf('confirm(') >= 0 && sync.indexOf('DIGANTI dengan isi Firestore') >= 0, true);
check('sync: pulihkan menulis saveDB + fallback seedAdmin', sync.indexOf('saveDB(dbBaru)') >= 0 && sync.indexOf('seedAdmin()') >= 0, true);
check('sync: dukung set & delete dokumen', sync.indexOf('batch.set(ref, op.data)') >= 0 && sync.indexOf('batch.delete(ref)') >= 0, true);
check('sync: pesan bila SDK belum termuat', sync.indexOf('Firebase SDK belum termuat') >= 0, true);
check('index.html: SDK Firebase compat (app + firestore)',
    html.indexOf('firebase-app-compat.js') >= 0 && html.indexOf('firebase-firestore-compat.js') >= 0, true);
check('index.html: muat firebase-config.js & sync.js bertanda versi',
    html.indexOf('js/firebase-config.js?v=20261021firebase') >= 0 && html.indexOf('js/sync.js?v=20261021firebase') >= 0, true);
check('index.html: nav & view Sinkron Data',
    html.indexOf('id="navSinkron"') >= 0 && html.indexOf('data-view="sinkron"') >= 0 && html.indexOf('id="view-sinkron"') >= 0, true);
check('index.html: tombol backup & pulihkan + status',
    html.indexOf('onclick="sinkronBackup()"') >= 0 && html.indexOf('onclick="sinkronPulihkan()"') >= 0 &&
    html.indexOf('id="sinkronStatus"') >= 0 && html.indexOf('id="sinkronTerakhir"') >= 0, true);
check('app.js: navSinkron hanya superadmin',
    appJs.indexOf("document.getElementById('navSinkron').style.display = isAdmin ? '' : 'none';") >= 0, true);
check('app.js: view sinkron diblokir untuk non-superadmin (2 tempat)',
    (appJs.match(/'atlet', 'dashboard', 'caboritem', 'akses', 'norma', 'sinkron'/g) || []).length === 2, true);
check('app.js: renderSinkron saat view dibuka',
    appJs.indexOf("if (name === 'sinkron' && typeof renderSinkron === 'function') renderSinkron();") >= 0, true);
check('preview: dukung parameter view (E2E)', preview.indexOf("qs.get('view') || 'rekomendasi'") >= 0, true);
check('cdp: kumpulkan teks view-sinkron', cdp.indexOf('sinkronLines') >= 0, true);
// Perubahan tugas sebelumnya tetap utuh
check('regresi: app.js evItemsTampil tetap ada', appJs.indexOf('function evItemsTampil(') >= 0, true);
check('regresi: index.html versi script rasttpe tetap', html.indexOf('app.js?v=20261021rasttpe') >= 0, true);

// --- 2. Logika sinkron (vm + Firestore mock) ---
console.log('\n--- Logika backup & pulihkan (mock Firestore) ---');
const kodeSync = fs.readFileSync(syncPath, 'utf8');

function mockFirestore() {
    const store = {};
    const stat = { commits: 0, set: 0, deleted: 0 };
    const api = {
        _store: store, _stat: stat,
        collection(nama) {
            if (!store[nama]) store[nama] = {};
            return {
                get: async () => ({
                    docs: Object.keys(store[nama]).map(function(id) {
                        return { id: id, data: () => JSON.parse(JSON.stringify(store[nama][id])) };
                    })
                }),
                doc(id) {
                    return {
                        set: async (data) => { store[nama][id] = JSON.parse(JSON.stringify(data)); stat.set++; },
                        delete: async () => { delete store[nama][id]; stat.deleted++; }
                    };
                }
            };
        },
        batch() {
            const ops = [];
            return {
                set: (ref, data) => ops.push({ t: 'set', ref: ref, data: data }),
                delete: (ref) => ops.push({ t: 'delete', ref: ref }),
                commit: async () => {
                    stat.commits++;
                    for (const op of ops) {
                        if (op.t === 'set') await op.ref.set(op.data);
                        else await op.ref.delete();
                    }
                }
            };
        }
    };
    return api;
}

function dbLokal() {
    return {
        users: [
            { id: 'u1', username: 'superadmin', password: 'h_x', role: 'superadmin', cabor: '', kabupaten: '', status: 'aktif' },
            { id: 'u2', username: 'gresik', password: 'h_y', role: 'cabor', cabor: 'Pencak Silat', kabupaten: 'Tuban', status: 'aktif' }
        ],
        cabor: [{ id: 'c1', nama: 'Pencak Silat', kabupaten: 'Tuban', items: ['RAST Test'] }],
        atlet: [
            { id: 'a1', nama: 'Atlet Satu', cabor_nama: 'Pencak Silat' },
            { id: 'a2', nama: 'Atlet Dua', cabor_nama: 'Pencak Silat' }
        ],
        sesi: [
            { id: 's1', atlet_id: 'a1', tanggal_tes: '2026-10-18', nilai: { 'RAST Test': 2.64 } },
            { id: 's2', atlet_id: 'a1', tanggal_tes: '2026-10-19', nilai: {} },
            { id: 's3', atlet_id: 'a2', tanggal_tes: '2026-10-20', nilai: {} }
        ],
        itemCustom: [{ id: 'i1', nama: 'Tes Khusus', satuan: 'x' }],
        aksesLog: []
    };
}

function buatSandbox(opts) {
    opts = opts || {};
    const ls = {};
    const events = { alerts: [], confirms: 0, reload: 0, simpanan: [], seeded: false };
    const sandbox = {
        console: { log: function () {} },
        setTimeout: function (f) { f(); return 0; },
        alert: function (m) { events.alerts.push(String(m)); },
        confirm: function () { events.confirms++; return opts.confirm !== false; },
        location: { reload: function () { events.reload++; } },
        document: { getElementById: function () { return null; } },
        localStorage: {
            getItem: function (k) { return (k in ls) ? ls[k] : null; },
            setItem: function (k, v) { ls[k] = String(v); },
            removeItem: function (k) { delete ls[k]; }
        },
        currentUser: function () { return opts.user || { id: 'u1', username: 'superadmin', role: 'superadmin' }; },
        canWrite: function () { return opts.canWrite !== false; },
        loadDB: function () { return JSON.parse(JSON.stringify(opts.db || dbLokal())); },
        saveDB: function (db) { events.simpanan.push(JSON.parse(JSON.stringify(db))); },
        seedAdmin: function () { events.seeded = true; }
    };
    if (opts.fs) {
        sandbox.firebase = {
            firestore: function () { return opts.fs; },
            app: function () { return { options: { projectId: 'tespengukuran-bb50b' } }; }
        };
    }
    const ctx = vm.createContext(sandbox);
    vm.runInContext(kodeSync, ctx, { filename: 'sync.js' });
    return { ctx: ctx, ls: ls, events: events };
}

(async function () {
    // T1 — backup sukses: semua koleksi terkirim + meta ringkasan
    const fs1 = mockFirestore();
    const s1 = buatSandbox({ fs: fs1 });
    const ok1 = await vm.runInContext('sinkronBackup()', s1.ctx);
    check('backup sukses mengembalikan true', ok1, true);
    check('backup: 2 user terkirim', Object.keys(fs1._store.users).length, 2);
    check('backup: 1 cabor terkirim', Object.keys(fs1._store.cabor).length, 1);
    check('backup: 2 atlet terkirim', Object.keys(fs1._store.atlet).length, 2);
    check('backup: 3 sesi terkirim', Object.keys(fs1._store.sesi).length, 3);
    check('backup: 1 item custom terkirim', Object.keys(fs1._store.itemCustom).length, 1);
    check('backup: dokumen ringkasan meta dibuat', !!(fs1._store.sinkron && fs1._store.sinkron.ringkasan), true);
    check('backup: meta berarah backup', fs1._store.sinkron.ringkasan.arah, 'backup');
    const info1 = JSON.parse(s1.ls['tes_pengukuran_sync']);
    check('backup: catatan sinkron tersimpan di localStorage', info1.arah, 'Backup (ke Firestore)');
    check('backup: total record = 9', info1.jumlah, 9);
    check('backup: status sukses tampil', s1.events.alerts.length, 0);

    // T2 — dokumen remote yang tidak ada lokal ikut dihapus
    const fs2 = mockFirestore();
    fs2._store.atlet = { 'atlet-lama': { id: 'atlet-lama', nama: 'Hapus Saya' } };
    fs2._store.sesi = { 'sesi-lama': { id: 'sesi-lama', atlet_id: 'x' } };
    const s2 = buatSandbox({ fs: fs2 });
    await vm.runInContext('sinkronBackup()', s2.ctx);
    check('backup: dokumen remote basi terhapus', ('atlet-lama' in fs2._store.atlet) || ('sesi-lama' in fs2._store.sesi), false);
    check('backup: jumlah delete = 2', fs2._stat.deleted, 2);
    check('backup: dokumen lokal tetap ada', Object.keys(fs2._store.atlet).sort().join(','), 'a1,a2');

    // T3 — pembagian batch (850 sesi -> 3 commit; koleksi lain kosong)
    const dbBesar = { users: [], cabor: [], atlet: [], sesi: [], itemCustom: [], aksesLog: [] };
    for (let i = 0; i < 850; i++) dbBesar.sesi.push({ id: 'sesi-' + i, atlet_id: 'a1', tanggal_tes: '2026-10-20', nilai: {} });
    const fs3 = mockFirestore();
    const s3 = buatSandbox({ fs: fs3, db: dbBesar });
    await vm.runInContext('sinkronBackup()', s3.ctx);
    check('backup: 850 sesi -> 3 batch commit', fs3._stat.commits, 3);
    check('backup: 850 sesi masuk semua', Object.keys(fs3._store.sesi).length, 850);

    // T4 — pulihkan: data remote MENGGANTI lokal + reload
    const fs4 = mockFirestore();
    fs4._store.atlet = [
        { id: 'rx1', nama: 'Atlet Firestore A' },
        { id: 'rx2', nama: 'Atlet Firestore B' },
        { id: 'rx3', nama: 'Atlet Firestore C' }
    ].reduce(function (acc, r) { acc[r.id] = r; return acc; }, {});
    fs4._store.sesi = { 'rs1': { id: 'rs1', atlet_id: 'rx1', tanggal_tes: '2026-10-21', nilai: {} } };
    fs4._store.users = { 'ru1': { id: 'ru1', username: 'superadmin', role: 'superadmin', status: 'aktif' } };
    const s4 = buatSandbox({ fs: fs4 });
    const ok4 = await vm.runInContext('sinkronPulihkan()', s4.ctx);
    check('pulihkan sukses mengembalikan true', ok4, true);
    check('pulihkan: data lokal diganti (3 atlet remote)', s4.events.simpanan[0].atlet.length, 3);
    check('pulihkan: sesi remote masuk', s4.events.simpanan[0].sesi.length, 1);
    check('pulihkan: user remote masuk', s4.events.simpanan[0].users.length, 1);
    check('pulihkan: skema DB lengkap (6 kunci)',
        ['users', 'cabor', 'atlet', 'sesi', 'itemCustom', 'aksesLog'].every(function(k) { return k in s4.events.simpanan[0]; }), true);
    check('pulihkan: halaman dimuat ulang', s4.events.reload >= 1, true);
    const info4 = JSON.parse(s4.ls['tes_pengukuran_sync']);
    check('pulihkan: catatan arah tersimpan', info4.arah, 'Pulihkan (dari Firestore)');

    // T5 — pulihkan dibatalkan user (confirm = false)
    const fs5 = mockFirestore();
    fs5._store.atlet = { rx1: { id: 'rx1', nama: 'X' } };
    const s5 = buatSandbox({ fs: fs5, confirm: false });
    const ok5 = await vm.runInContext('sinkronPulihkan()', s5.ctx);
    check('pulihkan batal -> false', ok5, false);
    check('pulihkan batal -> data lokal tidak disentuh', s5.events.simpanan.length, 0);
    check('pulihkan batal -> tidak reload', s5.events.reload, 0);

    // T6 — SDK tidak termuat
    const s6 = buatSandbox({ fs: null });
    const ok6 = await vm.runInContext('sinkronBackup()', s6.ctx);
    check('tanpa SDK -> backup false', ok6, false);
    check('tanpa SDK -> peringatan tampil', s6.events.alerts.join(' ').indexOf('Firebase SDK belum termuat') >= 0, true);
    const ok6b = await vm.runInContext('sinkronPulihkan()', s6.ctx);
    check('tanpa SDK -> pulihkan false', ok6b, false);

    // T7 — non-superadmin ditolak (tanpa menyentuh Firestore)
    const fs7 = mockFirestore();
    const s7 = buatSandbox({ fs: fs7, canWrite: false });
    const ok7 = await vm.runInContext('sinkronBackup()', s7.ctx);
    check('non-superadmin -> backup false', ok7, false);
    check('non-superadmin -> akses ditolak', s7.events.alerts.join(' ').indexOf('Akses ditolak') >= 0, true);
    check('non-superadmin -> tidak ada tulisan ke Firestore', fs7._stat.set, 0);
    const ok7b = await vm.runInContext('sinkronPulihkan()', s7.ctx);
    check('non-superadmin -> pulihkan false', ok7b, false);

    // T8 — renderSinkron aman tanpa elemen DOM
    let renderAman = true;
    try { vm.runInContext('renderSinkron()', s6.ctx); } catch (e) { renderAman = false; }
    check('renderSinkron tidak error tanpa DOM', renderAman, true);

    // T9 — user kosong setelah pulihkan -> seedAdmin dipanggil
    const fs9 = mockFirestore();
    const s9 = buatSandbox({ fs: fs9 });
    await vm.runInContext('sinkronPulihkan()', s9.ctx);
    check('pulihkan tanpa user -> seedAdmin dipanggil', s9.events.seeded, true);

    // T10 — error Firestore (permission denied) -> gagal rapi, tidak crash
    const fs10 = {
        collection: function () { throw new Error('permission denied'); },
        batch: function () { throw new Error('unused'); }
    };
    const s10 = buatSandbox({ fs: fs10 });
    const ok10 = await vm.runInContext('sinkronBackup()', s10.ctx);
    check('error Firestore -> backup false (tidak crash)', ok10, false);
    check('error Firestore -> pesan gagal tampil', s10.events.alerts.join(' ').indexOf('Backup gagal') >= 0, true);

    // T11 — daftar koleksi sinkron sesuai skema store.js
    const kol = vm.runInContext('SINKRON_KOLEKSI.slice()', s1.ctx);
    check('SINKRON_KOLEKSI = 6 koleksi skema DB', kol, ['users', 'cabor', 'atlet', 'sesi', 'itemCustom', 'aksesLog']);

    console.log('\n========================================');
    console.log('RINGKASAN: ' + pass + ' lulus, ' + fail + ' gagal');
    if (fail === 0) console.log('SEMUA TEST LULUS!');
    else console.log('ADA ' + fail + ' TEST YANG GAGAL!');
    process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) {
    console.error('ERROR: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});

// test-cloud-login.js — Login lintas perangkat (akun di Firestore)
// Jalankan: node test/test-cloud-login.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var akar = path.join(__dirname, '..');
var kodeData = fs.readFileSync(path.join(akar, 'js/data.js'), 'utf8');
var kodeStore = fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8');
var kodeSync = fs.readFileSync(path.join(akar, 'js/sync.js'), 'utf8');
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');

var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}

// --- Mock Firestore: mendukung get(), where().get(), where().limit().get(), batch() ---
function mockFirestore() {
    var store = { users: {}, cabor: {}, atlet: {}, sesi: {}, itemCustom: {}, aksesLog: {}, sinkron: {} };
    var stat = { set: 0, deleted: 0, commits: 0 };
    function daftar(nama, filter) {
        var kol = store[nama] || {};
        return Object.keys(kol).map(function(id) {
            return { id: id, data: function() { return JSON.parse(JSON.stringify(kol[id])); } };
        }).filter(function(d) { return !filter || filter(d.data()); });
    }
    return {
        _store: store, _stat: stat,
        collection: function(nama) {
            return {
                get: async function() {
                    var docs = daftar(nama);
                    return { docs: docs, size: docs.length };
                },
                where: function(f, op, v) {
                    var lolos = function(r) { return op === '==' ? r[f] === v : false; };
                    return {
                        get: async function() {
                            var docs = daftar(nama, lolos);
                            return { docs: docs, size: docs.length };
                        },
                        limit: function(n) {
                            return {
                                get: async function() {
                                    var docs = daftar(nama, lolos).slice(0, n);
                                    return { docs: docs, size: docs.length };
                                }
                            };
                        }
                    };
                },
                limit: function(n) {
                    return {
                        get: async function() {
                            var docs = daftar(nama).slice(0, n);
                            return { docs: docs, size: docs.length };
                        }
                    };
                },
                doc: function(id) {
                    return {
                        set: async function(data) { store[nama][id] = JSON.parse(JSON.stringify(data)); stat.set++; },
                        delete: async function() { delete store[nama][id]; stat.deleted++; }
                    };
                }
            };
        },
        batch: function() {
            var ops = [];
            return {
                set: function(ref, data) { ops.push({ t: 'set', ref: ref, data: data }); },
                delete: function(ref) { ops.push({ t: 'delete', ref: ref }); },
                commit: async function() {
                    stat.commits++;
                    for (var i = 0; i < ops.length; i++) {
                        if (ops[i].t === 'set') await ops[i].ref.set(ops[i].data);
                        else await ops[i].ref.delete();
                    }
                }
            };
        }
    };
}

function buatSandbox(opts) {
    opts = opts || {};
    var ls = {};
    var log = { warn: [], log: [] };
    var sandbox = {
        console: {
            warn: function(m) { log.warn.push(String(m)); },
            log: function(m) { log.log.push(String(m)); },
            error: function(m) { log.warn.push(String(m)); }
        },
        setTimeout: function(f) { if (typeof f === 'function') f(); return 0; },
        alert: function() {},
        confirm: function() { return true; },
        location: { reload: function() {} },
        document: { getElementById: function() { return null; } },
        navigator: opts.offline ? { onLine: false } : { onLine: true },
        localStorage: {
            getItem: function(k) { return (k in ls) ? ls[k] : null; },
            setItem: function(k, v) { ls[k] = String(v); },
            removeItem: function(k) { delete ls[k]; }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(kodeData, sandbox, { filename: 'data.js' });
    vm.runInContext(kodeStore, sandbox, { filename: 'store.js' });
    if (opts.fs !== null) {
        sandbox.firebase = {
            firestore: function() { return opts.fs || mockFirestore(); },
            app: function() { return { options: { projectId: 'tespengukuran-bb50b' } }; }
        };
    }
    vm.runInContext(kodeSync, sandbox, { filename: 'sync.js' });
    if (opts.db) {
        sandbox.saveDB(JSON.parse(JSON.stringify(opts.db)));
    }
    return { G: sandbox, ls: ls, log: log };
}

function dbKosong() {
    return { users: [], cabor: [], atlet: [], sesi: [], itemCustom: [], aksesLog: [] };
}

// DB "perangkat lain" (laptop): akun cabor + data miliknya
function dbLaptop(hashSepatu) {
    return {
        users: [{
            id: 'u-sep', username: 'sepaturoda', password: hashSepatu,
            role: 'cabor', cabor: 'Sepatu Roda', kabupaten: 'Gresik', status: 'aktif'
        }],
        cabor: [{ id: 'c-sep', nama: 'Sepatu Roda', kabupaten: 'Gresik', items: ['RAST Test'] }],
        atlet: [
            { id: 'a-1', nama: 'Devalenso Bagus', cabor_nama: 'Sepatu Roda' },
            { id: 'a-2', nama: 'Chelsya Mikayla A', cabor_nama: 'Sepatu Roda' }
        ],
        sesi: [
            { id: 's-1', atlet_id: 'a-1', tanggal_tes: '2026-10-10', nilai: { 'RAST Test': 2.64 } },
            { id: 's-2', atlet_id: 'a-2', tanggal_tes: '2026-10-11', nilai: {} }
        ],
        itemCustom: [], aksesLog: []
    };
}

(async function() {
    // Siapkan hash password seperti yang dihasilkan store.js (bukan plaintext)
    var awal = buatSandbox({ fs: mockFirestore() });
    var hashSepatu = awal.G.hashPw('rahasia123');
    check('contoh hash format $sha256$v1$', String(hashSepatu).indexOf('$sha256$v1$1000$') === 0, true);

    // ----------------------------------------------------------------
    console.log('\n--- 1. Perangkat baru: login lokal gagal -> akun di server ---');
    var fs1 = mockFirestore();
    fs1._store.users['sepaturoda'] = {
        id: 'u-sep', username: 'sepaturoda', password: hashSepatu,
        role: 'cabor', cabor: 'Sepatu Roda', kabupaten: 'Gresik', status: 'aktif'
    };
    fs1._store.cabor['c-sep'] = { id: 'c-sep', nama: 'Sepatu Roda', kabupaten: 'Gresik' };
    fs1._store.atlet['a-1'] = { id: 'a-1', nama: 'Devalenso Bagus', cabor_nama: 'Sepatu Roda' };
    fs1._store.atlet['a-2'] = { id: 'a-2', nama: 'Chelsya Mikayla A', cabor_nama: 'Sepatu Roda' };
    fs1._store.sesi['s-1'] = { id: 's-1', atlet_id: 'a-1', tanggal_tes: '2026-10-10', nilai: {} };

    var t1 = buatSandbox({ fs: fs1, db: dbKosong() });
    check('login lokal (akun tidak ada) -> gagal', t1.G.login('sepaturoda', 'rahasia123').ok, false);
    var r1 = await t1.G.cloudLogin('sepaturoda', 'rahasia123');
    check('login server sukses', r1.ok, true);
    check('ditandai dariServer', r1.dariServer, true);
    check('sesi terisi', t1.G.currentUser() ? t1.G.currentUser().username + '/' + t1.G.currentUser().role : null, 'sepaturoda/cabor');
    var db1 = t1.G.loadDB();
    check('akun masuk ke penyimpanan lokal', db1.users.map(function(u) { return u.username; }).join(','), 'sepaturoda');
    check('password lokal tetap hash (bukan plaintext)', String(db1.users[0].password).indexOf('$sha256$v1$1000$') === 0, true);
    check('data atlet ikut ditarik (2)', db1.atlet.length, 2);
    check('data sesi ikut ditarik (1)', db1.sesi.length, 1);
    check('data cabor ikut ditarik (1)', db1.cabor.length, 1);
    check('ringkasan tarik data', r1.dataDitarik, { cabor: 1, atlet: 2, sesi: 1 });
    check('login setelah tarik data juga lokal', t1.G.login('sepaturoda', 'rahasia123').ok, true);

    // ----------------------------------------------------------------
    console.log('\n--- 2. Login server: password salah / username tidak ada ---');
    var t2 = buatSandbox({ fs: fs1, db: dbKosong() });
    var r2a = await t2.G.cloudLogin('sepaturoda', 'salah_banget');
    check('password salah -> gagal', r2a.ok, false);
    check('password salah -> pesan spesifik', r2a.error, 'Password salah');
    check('password salah -> tidak ada sesi', t2.G.currentUser(), null);
    check('password salah -> log console berisi alasan',
        t2.log.warn.some(function(m) { return m.indexOf('[login-server] password salah') >= 0; }), true);
    var r2b = await t2.G.cloudLogin('bukan_pengguna', 'apapun');
    check('username tidak ada di server -> gagal', r2b.ok, false);
    check('username tidak ada -> pesan spesifik', r2b.error, 'Username tidak ditemukan');
    check('username tidak ada -> log console berisi alasan',
        t2.log.warn.some(function(m) { return m.indexOf('[login-server] username') >= 0 && m.indexOf('tidak ada') >= 0; }), true);

    // ----------------------------------------------------------------
    console.log('\n--- 3. Tanpa Firebase SDK / offline -> gagal rapi (tanpa crash) ---');
    var t3 = buatSandbox({ fs: null, db: dbKosong() });
    var r3 = await t3.G.cloudLogin('sepaturoda', 'rahasia123');
    check('tanpa SDK -> gagal', r3.ok, false);
    check('tanpa SDK -> pesan sinkronisasi', String(r3.error).indexOf('Layanan sinkronisasi') >= 0, true);
    var r3b = await t3.G.cloudLogin('', '');
    check('username kosong -> pesan umum', r3b.error, 'Username atau password salah');

    // ----------------------------------------------------------------
    console.log('\n--- 4. Unggah akun + data (perangkat lama -> server) ---');
    var fs4 = mockFirestore();
    fs4._store.atlet['atlet_lain'] = { id: 'atlet_lain', nama: 'Milik Perangkat Lain', cabor_nama: 'Sepatu Roda' };
    var t4 = buatSandbox({ fs: fs4, db: dbLaptop(hashSepatu) });
    var u4 = t4.G.loadDB().users[0];
    var r4 = await t4.G.cloudUnggahAkun(u4);
    check('unggah sukses', r4.ok, true);
    check('jumlah record = 1 akun + 1 cabor + 2 atlet + 2 sesi', r4.jumlah, 6);
    check('dokumen users memakai ID = username', !!fs4._store.users['sepaturoda'], true);
    check('akun terunggah dengan hash (bukan plaintext)',
        String(fs4._store.users['sepaturoda'].password).indexOf('rahasia123') < 0, true);
    check('atlet terunggah (2 lokal)', ['a-1', 'a-2'].every(function(id) { return !!fs4._store.atlet[id]; }), true);
    check('sesi terunggah (2)', Object.keys(fs4._store.sesi).length, 2);
    check('data perangkat lain TIDAK dihapus oleh unggah', !!fs4._store.atlet['atlet_lain'], true);

    // ----------------------------------------------------------------
    console.log('\n--- 5. Tarik data: data lokal tidak ada yang hilang ---');
    var fs5 = mockFirestore();
    fs5._store.users['sepaturoda'] = u4;
    fs5._store.atlet['a-1'] = { id: 'a-1', nama: 'Devalenso Bagus', cabor_nama: 'Sepatu Roda' };
    var db5 = dbLaptop(hashSepatu);
    db5.atlet.push({ id: 'a-baru', nama: 'Atlet Baru Di Perangkat Ini', cabor_nama: 'Sepatu Roda' });
    var t5 = buatSandbox({ fs: fs5, db: db5 });
    await t5.G.cloudLogin('sepaturoda', 'rahasia123');
    var ids5 = t5.G.loadDB().atlet.map(function(a) { return a.id; }).sort().join(',');
    check('atlet lokal tetap ada saat menarik server', ids5, 'a-1,a-2,a-baru');

    // ----------------------------------------------------------------
    console.log('\n--- 6. Scope data per akun ---');
    var t6 = buatSandbox({ fs: mockFirestore(), db: dbLaptop(hashSepatu) });
    var db6 = t6.G.loadDB();
    db6.atlet.push({ id: 'a-lain', nama: 'Cabor Lain', cabor_nama: 'Pencak Silat' });
    var scCabor = t6.G.cloudScopeRows(db6, { role: 'cabor', cabor: 'Sepatu Roda' });
    check('scope cabor: hanya atlet cabornya (2)', scCabor.atlet.length, 2);
    check('scope cabor: sesi mengikuti atletnya (2)', scCabor.sesi.length, 2);
    check('scope cabor: hanya cabornya (1)', scCabor.cabor.length, 1);
    var scAdmin = t6.G.cloudScopeRows(db6, { role: 'superadmin', cabor: '' });
    check('scope superadmin: semua atlet (3)', scAdmin.atlet.length, 3);
    check('scope superadmin: semua sesi (2)', scAdmin.sesi.length, 2);
    check('doc id users = username', t6.G.cloudDocIdUser(' Sepaturoda '), 'sepaturoda');

    // ----------------------------------------------------------------
    console.log('\n--- 7. Unggah otomatis (throttle + hanya saat sesi aktif) ---');
    var fs7 = mockFirestore();
    var t7 = buatSandbox({ fs: fs7, db: dbLaptop(hashSepatu) });
    check('login lokal dulu agar ada sesi', t7.G.login('sepaturoda', 'rahasia123').ok, true);
    t7.G.cloudSinkronOtomatis();
    await new Promise(function(r) { setTimeout(r, 30); });
    check('sesi aktif -> unggah otomatis berjalan', !!fs7._store.users['sepaturoda'], true);
    var set1 = fs7._stat.set;
    t7.G.cloudSinkronOtomatis();
    await new Promise(function(r) { setTimeout(r, 30); });
    check('throttle: panggilan kedua dalam 3 menit tidak mengulang', fs7._stat.set, set1);
    var t7b = buatSandbox({ fs: fs7, db: dbLaptop(hashSepatu) });
    t7b.G.logout();
    t7b.G.cloudSinkronOtomatis();
    await new Promise(function(r) { setTimeout(r, 30); });
    check('tanpa sesi -> tidak ada unggah', t7b.ls['tes_pengukuran_cloud_push'], undefined);

    // ----------------------------------------------------------------
    console.log('\n--- 8. Sumber kode (app.js + index.html) ---');
    check('doLogin mencoba login lokal lebih dulu',
        appJs.indexOf('r = login(u, p);') >= 0 && appJs.indexOf('cloudLogin(u, p)') >= 0, true);
    check('doLogin punya fallback server dengan pesan status', appJs.indexOf('Mencoba akun di server...') >= 0, true);
    check('doLogin mengunggah akun setelah login lokal sukses', appJs.indexOf('cloudUnggahAkun(r.user)') >= 0, true);
    check('doRegister mengunggah akun baru', appJs.indexOf('cloudUnggahAkun(akun)') >= 0, true);
    check('initApp menjalankan unggah otomatis saat sesi ada', appJs.indexOf('cloudSinkronOtomatis()') >= 0, true);
    check('sync.js mencari akun berdasarkan username di Firestore',
        kodeSync.indexOf(".where('username', '==', cloudDocIdUser(username))") >= 0, true);
    check('sync.js memakai hash verifikasi cocokPassword (bukan plaintext)',
        kodeSync.indexOf('cocokPassword(pw, x.password)') >= 0 && kodeSync.indexOf('=== password') < 0, true);
    check('pesan error cloud spesifik (telusur mudah)',
        kodeSync.indexOf("error: 'Username tidak ditemukan'") >= 0 &&
        kodeSync.indexOf("error: 'Password salah'") >= 0 &&
        kodeSync.indexOf('Gagal terhubung ke server') >= 0, true);
    check('store.js login lokal punya pesan spesifik',
        kodeStore.indexOf("'Username tidak ditemukan'") >= 0 &&
        kodeStore.indexOf("'Password salah'") >= 0, true);
    check('app.js memprioritaskan "Password salah" lokal di atas "Username tidak ditemukan" server',
        appJs.indexOf("if (r.error === 'Password salah' && pesanAkhir === 'Username tidak ditemukan')") >= 0, true);
    check('index.html versi app.js', html.indexOf('js/app.js?v=20261022pesan') >= 0, true);
    check('index.html versi sync.js', html.indexOf('js/sync.js?v=20261022migrasi') >= 0, true);
    check('index.html versi store.js', html.indexOf('js/store.js?v=20261022pesan') >= 0, true);
    check('input login & daftar sudah anti auto-kapitalisasi HP',
        (html.match(/autocapitalize="none"/g) || []).length >= 4, true);

    // ----------------------------------------------------------------
    console.log('\n--- 9. Migrasi sekali jalan (akun lama localStorage -> server) ---');
    var fs9 = mockFirestore();
    // Server sudah punya satu akun (tidak boleh ditimpa)
    fs9._store.users['sudah_di_server'] = {
        id: 'u-ada', username: 'sudah_di_server', password: 'hash_lama',
        role: 'cabor', cabor: 'Renang', kabupaten: 'Tuban', status: 'aktif'
    };
    var t9 = buatSandbox({ fs: fs9, db: dbLaptop(hashSepatu) });
    // Tambahkan akun lokal kedua yang belum ada di server + akun yang sudah ada
    var db9 = t9.G.loadDB();
    db9.users.push({
        id: 'u-lain', username: 'akun_lama_lain', password: t9.G.hashPw('rahasia999'),
        role: 'cabor', cabor: 'Renang', kabupaten: 'Tuban', status: 'aktif'
    });
    db9.users.push({
        id: 'u-ada', username: 'sudah_di_server', password: 'hash_lokal_berbeda',
        role: 'cabor', cabor: 'Renang', kabupaten: 'Tuban', status: 'aktif'
    });
    t9.G.saveDB(db9);
    var m9 = await t9.G.cloudMigrasiAkunLama();
    check('migrasi: pindah 2 akun lokal yang belum ada di server', m9.pindah, 2);
    check('migrasi: lewati 1 akun yang sudah ada di server', m9.lewati, 1);
    check('migrasi: tidak ada gagal', m9.gagal, 0);
    check('migrasi: dokumen server = username (id stabil)',
        !!fs9._store.users['sepaturoda'] && !!fs9._store.users['akun_lama_lain'], true);
    check('migrasi: akun server yang sudah ada TIDAK ditimpa',
        fs9._store.users['sudah_di_server'].password, 'hash_lama');
    check('migrasi: data milik akun ikut pindah (atlet sepaturoda)',
        !!fs9._store.atlet['a-1'] && !!fs9._store.atlet['a-2'], true);
    // Setelah migrasi, akun bisa dipakai dari "perangkat lain"
    var t9b = buatSandbox({ fs: fs9, db: dbKosong() });
    var r9 = await t9b.G.cloudLogin('sepaturoda', 'rahasia123');
    check('migrasi: login lintas perangkat setelah migrasi', r9.ok, true);
    // Tanpa SDK: gagal rapi tanpa crash
    var t9c = buatSandbox({ fs: null, db: dbLaptop(hashSepatu) });
    var m9c = await t9c.G.cloudMigrasiAkunLama();
    check('migrasi tanpa SDK -> tidak crash, 0 pindah', m9c.pindah, 0);

    console.log('\n========================================');
    console.log('RINGKASAN: ' + pass + ' lulus, ' + fail + ' gagal');
    if (fail === 0) console.log('SEMUA TEST LULUS!');
    else console.log('ADA ' + fail + ' TEST YANG GAGAL!');
    process.exit(fail === 0 ? 0 : 1);
})().catch(function(e) {
    console.error('ERROR: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});

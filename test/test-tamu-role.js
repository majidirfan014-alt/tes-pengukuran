// test-tamu-role.js — Verifikasi role tamu/publik
// Jalankan: node test/test-tamu-role.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var akar = path.join(__dirname, '..');
var mem = {};
var sandbox = {
    console: console,
    localStorage: {
        getItem: function(k) { return mem[k] || null; },
        setItem: function(k, v) { mem[k] = String(v); },
        removeItem: function(k) { delete mem[k]; }
    },
    fetch: function() { return Promise.reject(new Error('no fetch')); }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(akar, 'js/data.js'), 'utf8'), sandbox, { filename: 'data.js' });
vm.runInContext(fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8'), sandbox, { filename: 'store.js' });

var G = sandbox;
G.terapkanNormaDariJSON(JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8')));

var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}

console.log('=== VERIFIKASI ROLE TAMU/PUBLIK ===\n');

// --- 1. Role detection ---
console.log('--- Role Detection ---');
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 't', username: 'Tamu', role: 'tamu' }));
check('isTamu() = true', G.isTamu(), true);
check('isAdmin() = false', G.isAdmin(), false);
check('isCaborUser() = false', G.isCaborUser(), false);
check('canWrite() = false', G.canWrite(), false);

G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 's', username: 'admin', role: 'superadmin' }));
check('superadmin canWrite() = true', G.canWrite(), true);
check('superadmin isTamu() = false', G.isTamu(), false);

G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 'c', username: 'cabor', role: 'cabor' }));
check('cabor canWrite() = false (read-only)', G.canWrite(), false);
check('cabor isTamu() = true (non-superadmin)', G.isTamu(), true);

// --- 2. Write guards untuk tamu & cabor ---
console.log('\n--- Write Guards (tamu & cabor) ---');
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 't', username: 'Tamu', role: 'tamu' }));

var r1 = G.addAtlet({ nama: 'Test', jenis_kelamin: 'Laki-laki', cabor_nama: 'Test' });
check('addAtlet ditolak', r1.ok, false);
var r2 = G.addCabor('TestCabor');
check('addCabor ditolak', r2.ok, false);
var r3 = G.addSesi({ atlet_id: 'x', tanggal_tes: '2026-01-01' });
check('addSesi ditolak', r3, null);
var r4 = G.updateAtlet('x', { nama: 'y' });
check('updateAtlet ditolak', r4.ok, false);
var r5 = G.updateSesi('x', { nilai: {} });
check('updateSesi ditolak', r5.ok, false);
var r6 = G.updateCabor('x', { nama: 'y' });
check('updateCabor ditolak', r6.ok, false);
var r7 = G.register('Test', 'Test', 'user123', 'password123');
check('register ditolak', r7.ok, false);
var r8 = G.addItemCustom('Test', 'detik');
check('addItemCustom ditolak', r8.ok, false);

// --- 3. Write ops masih berfungsi untuk superadmin ---
console.log('\n--- Write Guards (superadmin) ---');
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 's', username: 'admin', role: 'superadmin' }));
check('superadmin canWrite() = true', G.canWrite(), true);

// --- 4. Data filtering: catatan cedera/tambahan tidak di tamu ---
console.log('\n--- Data Filtering ---');
// Cek bahwa renderHasilPublik tidak memanggil field catatan
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var pubFunc = appJs.substring(appJs.indexOf('function renderHasilPublik'), appJs.indexOf('function showDetailPublik'));
check('renderHasilPublik tidak akses catatan_cedera', pubFunc.indexOf('catatan_cedera') < 0, true);
check('renderHasilPublik tidak akses catatan tambahan', pubFunc.indexOf('.catatan') < 0, true);

var rekFunc = appJs.substring(appJs.indexOf('function renderRekomendasi'));
check('renderRekomendasi tidak akses catatan_cedera', rekFunc.indexOf('catatan_cedera') < 0, true);

var detailPublik = appJs.substring(appJs.indexOf('function showDetailPublik'), appJs.indexOf('function populateRekAtlet'));
check('showDetailPublik tidak akses catatan_cedera', detailPublik.indexOf('catatan_cedera') < 0, true);

// --- 5. Navigation ---
console.log('\n--- Navigation ---');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
check('Ada navHasilPublik', html.indexOf('id="navHasilPublik"') >= 0, true);
check('Ada navRekomendasi', html.indexOf('id="navRekomendasi"') >= 0, true);
check('Ada view-hasil-publik', html.indexOf('id="view-hasil-publik"') >= 0, true);
check('Ada view-rekomendasi', html.indexOf('id="view-rekomendasi"') >= 0, true);
check('Tidak ada tombol Masuk sebagai Tamu (dihapus)', html.indexOf('doLoginTamu') < 0, true);
check('navHasilPublik hidden default', html.indexOf('hidden" id="navHasilPublik"') >= 0 || html.indexOf('hidden" id="navHasilPublik">') >= 0, true);

// --- 6. Access control ---
console.log('\n--- Access Control ---');
check('showAdminView blokir atlet untuk tamu', appJs.indexOf("blokir.indexOf(name) >= 0") >= 0, true);
check('handleHashRoute blokir tamu', appJs.indexOf("blokir.indexOf(view) >= 0") >= 0, true);
check('doLoginTamu dihapus dari app.js', appJs.indexOf('function doLoginTamu') < 0, true);
var storeJs = fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8');
check('masukSebagaiTamu dihapus dari store.js', storeJs.indexOf('function masukSebagaiTamu') < 0, true);

// --- 7. Rekomendasi config ---
console.log('\n--- Rekomendasi Config ---');
check('REKOMENDASI_KOMPONEN ada', appJs.indexOf('REKOMENDASI_KOMPONEN') >= 0, true);
check('Ada Kekuatan', appJs.indexOf("'Kekuatan'") >= 0, true);
check('Ada Daya Ledak', appJs.indexOf("'Daya Ledak'") >= 0, true);
check('Ada Daya Tahan', appJs.indexOf("'Daya Tahan'") >= 0, true);
check('Ada Kelincahan', appJs.indexOf("'Kelincahan'") >= 0, true);
check('Ada Kecepatan', appJs.indexOf("'Kecepatan'") >= 0, true);
check('Ada Fleksibilitas', appJs.indexOf("'Fleksibilitas'") >= 0, true);
check('Ada Keseimbangan', appJs.indexOf("'Keseimbangan'") >= 0, true);
check('Ada Daya Anaerob', appJs.indexOf("'Daya Anaerob'") >= 0, true);
check('Ada catatan konsultasi pelatih', appJs.indexOf('konsultasikan dengan pelatih') >= 0, true);

// --- 8. Durasi format di tamu ---
console.log('\n--- Durasi Format ---');
check('showDetailPublik pakai formatHasilItem', detailPublik.indexOf('formatHasilItem') >= 0, true);
check('formatHasilItem menangani durasi (formatDurasi)',
    appJs.indexOf('} else if (isDurasiItem(it.name)) {') >= 0 &&
    appJs.indexOf('html = formatDurasi(it.raw);') >= 0, true);
check('formatHasilItem menambah sub-baris hasilKeterangan',
    appJs.indexOf('if (it.hasilKeterangan)') >= 0, true);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

// test-rekomendasi-rast-role.js — Sembunyikan baris turunan RAST
// (Peak / Relative Peak / Average Power) di halaman Rekomendasi untuk
// User Cabor & Tamu; Superadmin tetap lihat semua. Fatigue Index tampil
// semua role. Filter murni tampilan — performa tidak berubah.
// Jalankan: node test/test-rekomendasi-rast-role.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var akar = path.join(__dirname, '..');
var mem = {};

// DOM mock: elemen statis untuk renderRekomendasi
var elem = {
    rekHasil: { innerHTML: '' },
    rekAtlet: { value: 'a1' }
};
var sandbox = {
    console: console,
    localStorage: {
        getItem: function(k) { return (k in mem) ? mem[k] : null; },
        setItem: function(k, v) { mem[k] = String(v); },
        removeItem: function(k) { delete mem[k]; }
    },
    fetch: function() { return Promise.reject(new Error('no fetch')); },
    document: {
        addEventListener: function() {},
        getElementById: function(id) { return elem[id] || null; },
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; }
    },
    navigator: { onLine: true },
    location: { hash: '', reload: function() {} },
    history: { pushState: function() {} },
    alert: function() {},
    confirm: function() { return true; },
    setTimeout: function(f) { if (typeof f === 'function') f(); return 0; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(akar, 'js/data.js'), 'utf8'), sandbox, { filename: 'data.js' });
vm.runInContext(fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8'), sandbox, { filename: 'store.js' });
sandbox.window.__REKOMENDASI_JSON = JSON.parse(
    fs.readFileSync(path.join(akar, 'data/rekomendasi-template.json'), 'utf8'));
vm.runInContext(fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8'), sandbox, { filename: 'app.js' });

var G = sandbox;
G.terapkanNormaDariJSON(JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8')));

var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}

console.log('=== REKOMENDASI: FILTER RAST TURUNAN PER ROLE ===\n');

// Data atlet + sesi dengan data RAST lengkap (6 sprint)
var db = {
    users: [], cabor: [{ id: 'c1', nama: 'Sepatu Roda', kabupaten: 'Tuban', items: ['RAST Test'] }],
    atlet: [{
        id: 'a1', nama: 'Atlet Uji', tanggal_lahir: '2010-06-01', jenis_kelamin: 'L',
        cabor_nama: 'Sepatu Roda', nomor: '', dibuat: '2026-01-01T00:00:00.000Z'
    }],
    sesi: [{
        id: 's1', atlet_id: 'a1', tanggal_tes: '2026-10-01', nomor: '', catatan: '',
        nilai: {
            'Berat Badan': 60,
            'RAST Data': { berat: 60, waktu: [5.5, 5.6, 5.7, 5.8, 5.9, 6.0] }
        },
        dibuat: '2026-10-01T00:00:00.000Z'
    }],
    itemCustom: [], aksesLog: []
};
G.saveDB(db);

var ev = G.evalSesi(G.listSesi('a1')[0]);
check('evaluasi punya 4 baris RAST (3 turunan hidden + Fatigue Index)',
    ev.items.filter(function(it) { return String(it.name).indexOf('RAST') === 0; }).map(function(it) {
        return it.name + (it.hidden ? ' (hidden)' : '');
    }).sort(), ['RAST Average Power (hidden)', 'RAST Fatigue Index', 'RAST Peak Power (hidden)', 'RAST Relative Peak Power (hidden)']);

function renderDenganRole(role) {
    if (role === 'tamu') delete mem['tes_pengukuran_session'];
    else mem['tes_pengukuran_session'] = JSON.stringify({ id: 'u1', username: 'u', role: role, cabor: 'Sepatu Roda', kabupaten: 'Tuban' });
    elem.rekHasil.innerHTML = '';
    G.renderRekomendasi();
    return elem.rekHasil.innerHTML;
}
function ada(html, nama) { return html.indexOf(nama) >= 0; }
var namaTiga = ['RAST Relative Peak Power', 'RAST Peak Power', 'RAST Average Power'];

// --- Tamu ---
console.log('--- Tamu (tanpa sesi) ---');
var hTamu = renderDenganRole('tamu');
check('tamu: render menghasilkan HTML', hTamu.length > 0, true);
namaTiga.forEach(function(n) {
    check('tamu: "' + n + '" tidak tampil', ada(hTamu, n), false);
});
check('tamu: "RAST Fatigue Index" tetap tampil', ada(hTamu, 'RAST Fatigue Index'), true);
check('tamu: ringkasan performa tetap ada', ada(hTamu, 'Ringkasan Performa'), true);

// --- User Cabor ---
console.log('\n--- User Cabor ---');
var hCabor = renderDenganRole('cabor');
namaTiga.forEach(function(n) {
    check('cabor: "' + n + '" tidak tampil', ada(hCabor, n), false);
});
check('cabor: "RAST Fatigue Index" tetap tampil', ada(hCabor, 'RAST Fatigue Index'), true);
check('cabor: ringkasan performa tetap ada', ada(hCabor, 'Ringkasan Performa'), true);

// --- Superadmin ---
console.log('\n--- Superadmin ---');
var hAdmin = renderDenganRole('superadmin');
namaTiga.forEach(function(n) {
    check('superadmin: "' + n + '" tetap tampil', ada(hAdmin, n), true);
});
check('superadmin: "RAST Fatigue Index" tetap tampil', ada(hAdmin, 'RAST Fatigue Index'), true);

// --- Performa tidak berubah oleh filter ---
console.log('\n--- Integritas angka ---');
var hAdmin2 = renderDenganRole('superadmin');
var hCabor2 = renderDenganRole('cabor');
check('kartu Performa identik (cabor vs superadmin)',
    ada(hCabor2, '<p class="stat-value">' + ev.performa + '%</p>') && ada(hAdmin2, '<p class="stat-value">' + ev.performa + '%</p>'), true);
var ev2 = G.evalSesi(G.listSesi('a1')[0]);
check('evaluasi ulang menghasilkan performa sama', ev2.performa, ev.performa);

// --- Sumber kode: filter di renderRekomendasi, data tidak dihapus ---
console.log('\n--- Sumber kode ---');
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var dataJs = fs.readFileSync(path.join(akar, 'js/data.js'), 'utf8');
check('renderRekomendasi memfilter ev.items untuk non-superadmin',
    appJs.indexOf("ev.items.filter(function(it) { return !it.hidden; })") >= 0, true);
check('filter mengecek role superadmin',
    appJs.indexOf("uRek.role !== 'superadmin'") >= 0, true);
check('data.js tidak menghapus ketiga item (flag hidden tetap)',
    dataJs.split("name: 'RAST Peak Power'").length - 1 >= 2 &&
    dataJs.split("name: 'RAST Relative Peak Power'").length - 1 >= 2 &&
    dataJs.split("name: 'RAST Average Power'").length - 1 >= 2, true);
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
check('index.html versi app.js (cache-bust)', html.indexOf('js/app.js?v=20261022rekhide') >= 0, true);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else { console.log('ADA ' + fail + ' TEST YANG GAGAL!'); process.exit(1); }

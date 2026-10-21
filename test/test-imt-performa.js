// test-imt-performa.js — Verifikasi perbaikan IMT, % Performance, tabel Norma
// Jalankan: node test/test-imt-performa.js
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

console.log('=== VERIFIKASI IMT, % PERFORMANCE, & TABEL NORMA ===\n');

// --- 1. IMT ---
console.log('--- IMT (Indeks Massa Tubuh) ---');
check('IMT 70/170 = 24,2', G.hitungIMT(70, 170), 24.2);
check('IMT 70/170 kategori = Normal', G.getIMTKategori(24.2), 'Normal');
check('IMT 50/165 = 18,4', G.hitungIMT(50, 165), 18.4);
check('IMT 50/165 kategori = Berat badan kurang', G.getIMTKategori(18.4), 'Berat badan kurang');
check('IMT 90/170 = 31,1', G.hitungIMT(90, 170), 31.1);
check('IMT 90/170 kategori = Obesitas', G.getIMTKategori(31.1), 'Obesitas');
check('IMT 80/175 = 26,1', G.hitungIMT(80, 175), 26.1);
check('IMT 80/175 kategori = Berat badan berlebih', G.getIMTKategori(26.1), 'Berat badan berlebih');
check('IMT tinggi kosong = null', G.hitungIMT(70, ''), null);
check('IMT berat kosong = null', G.hitungIMT('', 170), null);
check('IMT tinggi 0 = null', G.hitungIMT(70, 0), null);
check('IMT berat 0 = null', G.hitungIMT(0, 170), null);
check('IMT kategori null = empty', G.getIMTKategori(null), '');

// --- 2. PERFORMA ---
console.log('\n--- Performa ---');
var r2 = G.ringkasanDariPersen([75, 90]);
check('Performa 75+90 = 82,5%', r2.performa, 82.5);
check('Kategori 82,5% = Baik', r2.kategori, 'Baik');

// Evaluasi dengan item tambahan (TB, BB, IMT, RAST FI) — harus tetap 82,5%
var ev1 = G.computeEvaluation({
    usia: 20, kelamin: 'Laki-laki',
    items: ['Push Up 1 Menit', 'Sit Up 1 Menit', 'Tinggi Badan', 'Berat Badan', 'IMT', 'RAST Fatigue Index'],
    nilai: {
        'Push Up 1 Menit': 35,
        'Sit Up 1 Menit': 40,
        'Tinggi Badan': 170,
        'Berat Badan': 70,
        'IMT': 24.2,
        'RAST Fatigue Index': 5.19
    }
});
// Push Up 35 @ mean 35 sd 11 -> z=0 -> 55%; Sit Up 40 @ mean 40 sd 12 -> z=0 -> 55%
// Tapi TB/BB/IMT/RASTFI tidak dihitung -> 2 item 55%+55% = 55%
check('Evaluasi dgn TB/BB/IMT/RASTFI: item dinilai', ev1.items.length, 2);
check('Evaluasi dgn TB/BB/IMT/RASTFI: performa', ev1.performa, 55);
check('Evaluasi IMT', ev1.imt, 24.2);
check('Evaluasi IMT kategori', ev1.imtKategori, 'Normal');

// Dengan % Performance override = 70
var ev2 = G.computeEvaluation({
    usia: 20, kelamin: 'Laki-laki',
    items: ['Push Up 1 Menit', 'Sit Up 1 Menit', '% Performance', 'Tinggi Badan', 'Berat Badan', 'IMT'],
    nilai: {
        'Push Up 1 Menit': 35,
        'Sit Up 1 Menit': 40,
        '% Performance': 70,
        'Tinggi Badan': 170,
        'Berat Badan': 70
    }
});
check('Override % Performance = 70', ev2.performa, 70);
check('Override kategori 70% = Baik', ev2.kategori, 'Baik');

// Override 82,5%
var ev3 = G.computeEvaluation({
    usia: 20, kelamin: 'Laki-laki',
    items: ['Push Up 1 Menit', '% Performance'],
    nilai: { 'Push Up 1 Menit': 35, '% Performance': 82.5 }
});
check('Override 82,5%', ev3.performa, 82.5);
check('Override 82,5% kategori = Baik', ev3.kategori, 'Baik');

// --- 3. TABEL NORMA: TB/BB harus tidak ada ---
console.log('\n--- Tabel Norma & Kategori ---');
var SKIP = ['Tinggi Badan', 'Berat Badan'];
var normaRows = G.NORMA_ROWS.filter(function(n) { return SKIP.indexOf(n.item) < 0; });
check('Norma rows tanpa TB/BB', normaRows.length, 110);
check('Tidak ada Tinggi Badan', normaRows.some(function(n) { return n.item === 'Tinggi Badan'; }), false);
check('Tidak ada Berat Badan', normaRows.some(function(n) { return n.item === 'Berat Badan'; }), false);

// IMT & % Performance ada tapi dengan '-'
var imtRow = normaRows.find(function(n) { return n.item === 'IMT'; });
check('IMT row ada', !!imtRow, true);
check('IMT mean = null', imtRow.mean, null);
check('IMT sumber = -', imtRow.sumber, '-');

var perfRow = normaRows.find(function(n) { return n.item === '% Performance'; });
check('% Performance row ada', !!perfRow, true);
check('% Performance mean = null', perfRow.mean, null);

// Item yang seharusnya bernorma tapi belum ada (Back Up 2 Menit, Plank) = "Norma belum diatur"
var bu2 = normaRows.find(function(n) { return n.item === 'Back Up 2 Menit'; });
check('Back Up 2 Menit ada', !!bu2, true);
check('Back Up 2 Menit mean = null', bu2.mean, null);
check('Back Up 2 Menit sumber = -', bu2.sumber, '-');

// --- 4. DOWNLOAD: Sheet Item Tes & Norma tanpa TB/BB ---
console.log('\n--- Download ---');
var itemsDL = G.NORMA_ITEMS.filter(function(it) { return SKIP.indexOf(it.nama) < 0; });
check('Item Tes tanpa TB/BB', itemsDL.length, 41);
check('Item Tes tidak ada TB', itemsDL.some(function(i) { return i.nama === 'Tinggi Badan'; }), false);
check('Item Tes tidak ada BB', itemsDL.some(function(i) { return i.nama === 'Berat Badan'; }), false);

// --- 5. RUMUS ---
console.log('\n--- Rumus ---');
check('Jumlah rumus di JSON', G.NORMA_RUMUS.length, 12);
var r11 = G.NORMA_RUMUS.find(function(r) { return r.no === 11; });
check('Rumus 11 judul', r11.judul, '11. Performa keseluruhan & kategori akhir');
check('Rumus 11 rumus', r11.rumus, 'performa = (jumlah seluruh persentase item yang dinilai) / (jumlah item x 100) x 100');
var r12 = G.NORMA_RUMUS.find(function(r) { return r.no === 12; });
check('Rumus 12 judul', r12.judul, '12. IMT (Indeks Massa Tubuh)');
check('Rumus 12 rumus', r12.rumus, 'IMT = berat badan (kg) / (tinggi badan (m))^2');

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

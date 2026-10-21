// test-verifikasi.js — Verifikasi mesin norma terhadap Norma_Tes_KONI_Tuban_2026-10-18
// Jalankan: node test/test-verifikasi.js
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

console.log('=== VERIFIKASI NORMA & RUMUS ===\n');

// --- 1. 7 CONTOH DARI SHEET RUMUS ---
console.log('--- 7 Contoh Perhitungan ---');

// 1. Push Up 34 kali usia 16 (mean 25, sd 9): z = 1,00, 75%
var z1 = (34 - 25) / 9;
check('Push Up z-score', Math.round(z1 * 100) / 100, 1);
check('Push Up pct', G.calcItemPct('Push Up', 34, 25, 9, true), 75);

// 2. Sprint 20 m 3,4 detik (mean 3,8, sd 0,4): z = -1,00, 75%
var z2 = (3.4 - 3.8) / 0.4;
check('Sprint z-score', Math.round(z2 * 100) / 100, -1);
check('Sprint pct', G.calcItemPct('Sprint', 3.4, 3.8, 0.4, false), 75);

// 3. Push Up usia <= 17: Baik Sekali >= 43, Baik >= 27,25, Cukup >= 18,25, Kurang >= 9,25
var r3 = G.normaRentangKategori(25, 9, true);
check('Push Up rentang[0]', r3[0], '>= 43');
check('Push Up rentang[1]', r3[1], '>= 27,25 dan < 43');
check('Push Up rentang[2]', r3[2], '>= 18,25 dan < 27,25');
check('Push Up rentang[3]', r3[3], '>= 9,25 dan < 18,25');
check('Push Up rentang[4]', r3[4], '< 9,25');

// 4. Bleep Test level 5 shuttle 3: maksShuttle 9, skor 5,333, VO2max 30,7
check('Bleep maksShuttle(5)', G.maksShuttleBleep(5), 9);
check('Bleep VO2max(5,3)', G.bleepVO2max(5, 3), 30.7);

// 5. Shoulder Mobility 8 cm: skor 2, 66,7%, Cukup
check('Shoulder skor(8)', G.getBrockportScore(8), 2);
var pct5 = (2 / 3) * 100;
check('Shoulder pct', Math.round(pct5 * 10) / 10, 66.7);
// CATATAN: contoh di sheet Rumus no. 7 menulis "66,7% -> Cukup", tetapi
// rumus no. 4 menetapkan >= 60% = Baik. Sistem memakai rumus no. 4 (konsisten).
check('Shoulder kategori', G.getPctCategory(66.7).label, 'Baik');

// 6. RAST 70 kg, sprint 5,0 detik: 686 watt
var p6 = 70 * 35 * 35 / (5 * 5 * 5);
check('RAST power', p6, 686);

// 7. RAST FI maks 686, min 520, total waktu 32 detik: 5,19
var fi7 = (686 - 520) / 32;
check('RAST FI', Math.round(fi7 * 100) / 100, 5.19);

// 8. Dua item 75% dan 90%: performa 82,5%, Baik
var r8 = G.ringkasanDariPersen([75, 90]);
check('Performa 75+90', r8.performa, 82.5);
check('Kategori 82.5%', r8.kategori, 'Baik');

// --- 2. AMBANG KATEGORI 90/60/40/20 ---
console.log('\n--- Ambang Kategori ---');
check('90% = Baik Sekali', G.getPctCategory(90).label, 'Baik Sekali');
check('89.9% = Baik', G.getPctCategory(89.9).label, 'Baik');
check('60% = Baik', G.getPctCategory(60).label, 'Baik');
check('59.9% = Cukup', G.getPctCategory(59.9).label, 'Cukup');
check('40% = Cukup', G.getPctCategory(40).label, 'Cukup');
check('39.9% = Kurang', G.getPctCategory(39.9).label, 'Kurang');
check('20% = Kurang', G.getPctCategory(20).label, 'Kurang');
check('19.9% = Kurang Sekali', G.getPctCategory(19.9).label, 'Kurang Sekali');

// --- 3. 530 SEL RENTANG KATEGORI ---
console.log('\n--- Rentang Kategori (530 sel) ---');
var cocok = 0, beda = 0;
G.NORMA_ROWS.forEach(function(n) {
    if (n.mean === null || n.mean === undefined) return;
    var arah = G.resolveArahGlobal(n.item);
    var hitung = G.normaRentangKategori(n.mean, n.sd, arah);
    if (!hitung) return;
    var acuan = n.rentang_acuan || [];
    for (var i = 0; i < 5; i++) {
        if (String(hitung[i]).trim() === String(acuan[i]).trim()) cocok++;
        else {
            beda++;
            if (beda <= 3) console.log('  BEDA: ' + n.item + ' ' + n.kelompok + ' kolom ' + i + ' | hitung: ' + hitung[i] + ' | acuan: ' + acuan[i]);
        }
    }
});
check('Rentang kategori cocok', cocok + ' sel', '530 sel');
check('Rentang kategori beda', beda + ' sel', '0 sel');

// --- 4. DATA INTEGRITY ---
console.log('\n--- Data Integrity ---');
check('Jumlah items', G.NORMA_ITEMS.length, 43);
check('Jumlah norma', G.NORMA_ROWS.length, 112);
check('Jumlah rumus', G.NORMA_RUMUS.length, 12);
check('Jumlah keterangan', G.NORMA_KETERANGAN.length, 27);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

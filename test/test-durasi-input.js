// test-durasi-input.js — Verifikasi input Menit:Detik untuk Stork Stand & Wall Sit
// Jalankan: node test/test-durasi-input.js
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

console.log('=== VERIFIKASI INPUT MENIT:DETIK ===\n');

// --- 1. isDurasiItem ---
console.log('--- isDurasiItem ---');
check('Stork Stand Kanan = durasi', G.isDurasiItem('Stork Stand Kanan'), true);
check('Stork Stand Kiri = durasi', G.isDurasiItem('Stork Stand Kiri'), true);
check('Wall Sit = durasi', G.isDurasiItem('Wall Sit'), true);
check('Sit & Reach = bukan durasi', G.isDurasiItem('Sit & Reach'), false);
check('Sprint 20 m = bukan durasi', G.isDurasiItem('Sprint 20 m'), false);
check('Vertical Jump = bukan durasi', G.isDurasiItem('Vertical Jump'), false);

// --- 2. formatDurasi ---
console.log('\n--- formatDurasi ---');
check('95 detik = 1:35', G.formatDurasi(95), '1:35');
check('45 detik = 0:45', G.formatDurasi(45), '0:45');
check('0 detik = 0:00', G.formatDurasi(0), '0:00');
check('125 detik = 2:05', G.formatDurasi(125), '2:05');
check('60 detik = 1:00', G.formatDurasi(60), '1:00');
check('59 detik = 0:59', G.formatDurasi(59), '0:59');
check('null = -', G.formatDurasi(null), '-');

// --- 3. pecahDurasi ---
console.log('\n--- pecahDurasi ---');
var p1 = G.pecahDurasi(95);
check('95 -> menit=1, detik=35', p1, { menit: 1, detik: 35 });
var p2 = G.pecahDurasi(45);
check('45 -> menit=0, detik=45', p2, { menit: 0, detik: 45 });
var p3 = G.pecahDurasi(0);
check('0 -> menit=0, detik=0', p3, { menit: 0, detik: 0 });
var p4 = G.pecahDurasi(125);
check('125 -> menit=2, detik=5', p4, { menit: 2, detik: 5 });

// --- 4. hitungTotalDurasi ---
console.log('\n--- hitungTotalDurasi ---');
var h1 = G.hitungTotalDurasi('1', '35');
check('1:35 -> 95 detik', h1, { ok: true, error: '', total: 95 });
var h2 = G.hitungTotalDurasi('0', '45');
check('0:45 -> 45 detik', h2, { ok: true, error: '', total: 45 });
var h3 = G.hitungTotalDurasi('', '30');
check('kosong:30 -> 30 detik', h3, { ok: true, error: '', total: 30 });
var h4 = G.hitungTotalDurasi('2', '0');
check('2:0 -> 120 detik', h4, { ok: true, error: '', total: 120 });
var h5 = G.hitungTotalDurasi('0', '0');
check('0:0 -> 0 detik (eksplisit)', h5, { ok: true, error: '', total: 0 });
var h6 = G.hitungTotalDurasi('', '');
check('kosong:kosong -> error', h6.ok, false);
var h7 = G.hitungTotalDurasi('1', '75');
check('detik 75 -> error', h7.ok, false);
check('detik 75 -> pesan', h7.error, 'Detik harus kurang dari 60');
var h8 = G.hitungTotalDurasi('-1', '30');
check('menit negatif -> error', h8.ok, false);
var h9 = G.hitungTotalDurasi('60', '0');
check('menit 60 -> error', h9.ok, false);
check('menit 60 -> pesan', h9.error, 'Menit maksimal 59');
var h10 = G.hitungTotalDurasi('abc', '30');
check('menit bukan angka -> error', h10.ok, false);
var h11 = G.hitungTotalDurasi('1', 'abc');
check('detik bukan angka -> error', h11.ok, false);
var h12 = G.hitungTotalDurasi('1.5', '30');
check('menit desimal -> error', h12.ok, false);
var h13 = G.hitungTotalDurasi('0', '45.5');
check('detik desimal 45.5 -> ok', h13, { ok: true, error: '', total: 46 });

// --- 5. Evaluasi dengan nilai durasi ---
console.log('\n--- Evaluasi ---');
var ev = G.computeEvaluation({
    usia: 20, kelamin: 'Laki-laki',
    items: ['Stork Stand Kanan', 'Wall Sit', 'Sit & Reach'],
    nilai: {
        'Stork Stand Kanan': 95,
        'Wall Sit': 45,
        'Sit & Reach': 32
    }
});
check('Evaluasi 3 item', ev.items.length, 3);
check('Stork Stand raw=95', ev.items[0].raw, 95);
check('Wall Sit raw=45', ev.items[1].raw, 45);
// Pastikan formatDurasi benar untuk display
check('formatDurasi(95) = 1:35', G.formatDurasi(95), '1:35');
check('formatDurasi(45) = 0:45', G.formatDurasi(45), '0:45');

// --- 6. Nilai 0 eksplisit ---
console.log('\n--- Edge Cases ---');
var ev0 = G.computeEvaluation({
    usia: 20, kelamin: 'Laki-laki',
    items: ['Wall Sit'],
    nilai: { 'Wall Sit': 0 }
});
check('Wall Sit 0 dinilai', ev0.items.length, 1);
check('Wall Sit 0 raw=0', ev0.items[0].raw, 0);
check('Wall Sit 0 punya pct', typeof ev0.items[0].pct, 'number');

// --- 7. Norma satuan ---
console.log('\n--- Satuan Norma ---');
var itemSSK = G.NORMA_ITEMS.find(function(i) { return i.nama === 'Stork Stand Kanan'; });
var itemSSL = G.NORMA_ITEMS.find(function(i) { return i.nama === 'Stork Stand Kiri'; });
var itemWS = G.NORMA_ITEMS.find(function(i) { return i.nama === 'Wall Sit'; });
check('Stork Stand Kanan satuan = detik', itemSSK.satuan, 'detik');
check('Stork Stand Kiri satuan = detik', itemSSL.satuan, 'detik');
check('Wall Sit satuan = detik', itemWS.satuan, 'detik');

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

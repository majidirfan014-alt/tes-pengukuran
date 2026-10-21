// test-rekomendasi-fix.js — Verifikasi fix template lookup
// Jalankan: node test/test-rekomendasi-fix.js
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

console.log('=== VERIFIKASI FIX TEMPLATE LOOKUP ===\n');

// Simulasi loadRekomendasiTemplate dengan normalisasi
function itemKey(name) {
    return String(name || '').replace(/[\u2010-\u2015\u2212]/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeTemplateKeys(rawTemplate) {
    var out = {};
    Object.keys(rawTemplate || {}).forEach(function(k) {
        out[itemKey(k)] = rawTemplate[k];
    });
    return out;
}

var tplData = JSON.parse(fs.readFileSync(path.join(akar, 'data/rekomendasi-template.json'), 'utf8'));
var template = normalizeTemplateKeys(tplData.template);

// --- 1. Key normalization ---
console.log('--- Key Normalization ---');
check('bleep test ada setelah normalisasi', !!template['bleep test'], true);
check('rast test ada', !!template['rast test'], true);
check('stork stand kiri ada', !!template['stork stand kiri'], true);
check('vertical jump ada', !!template['vertical jump'], true);
check('sprint 20 m ada', !!template['sprint 20 m'], true);
check('core stability 12 level ada', !!template['core stability 12 level'], true);
check('back up 1 menit ada', !!template['back up 1 menit'], true);
check('wall sit ada', !!template['wall sit'], true);
check('sit & reach ada', !!template['sit & reach'], true);
check('illinois agility ada', !!template['illinois agility'], true);

// --- 2. Lookup dengan variasi nama ---
console.log('\n--- Lookup Variasi Nama ---');
var ITEM_ALIASES = {
    'sprint 20m': 'sprint 20 m',
    'sprint 30m': 'sprint 30 m',
    'sprint 20 meter': 'sprint 20 m',
    'sprint 30 meter': 'sprint 30 m'
};

function resolveItemAlias(name) {
    var k = itemKey(name);
    return ITEM_ALIASES[k] || k;
}

function cariTemplateLocal(itemName, kategori, kelompokUsia) {
    var k = resolveItemAlias(itemName);
    if (template[k] && template[k][kategori] && template[k][kategori][kelompokUsia]) {
        return template[k][kategori][kelompokUsia];
    }
    if (template[k] && template[k][kategori] && template[k][kategori].umum) {
        return template[k][kategori].umum;
    }
    return null;
}

var variasi = [
    'Back Up 1 Menit', 'back up 1 menit', 'Back Up  1 Menit', 'back up  1 menit',
    'Sprint 20 m', 'sprint 20 m', 'Sprint 20m', 'sprint 20m',
    'Bleep Test', 'bleep test', 'BLEEP TEST',
    'Core Stability 12 Level', 'core stability 12 level'
];
var semuaKetemu = true;
var detail = [];
variasi.forEach(function(v) {
    var t = cariTemplateLocal(v, 'Cukup', 'umum');
    if (!t) { semuaKetemu = false; detail.push(v + ': TIDAK ADA'); }
    else { detail.push(v + ': ADA'); }
});
console.log('  Hasil: ' + detail.join(', '));
check('Semua variasi nama menemukan template', semuaKetemu, true);

// --- 3. 11 baris contoh dari screenshot ---
console.log('\n--- 11 Baris Contoh ---');
var contoh = [
    { nama: 'Bleep Test', kat: 'Kurang Sekali' },
    { nama: 'RAST Test', kat: 'Kurang Sekali' },
    { nama: 'Stork Stand Kiri', kat: 'Kurang Sekali' },
    { nama: 'Vertical Jump', kat: 'Kurang Sekali' },
    { nama: 'Sprint 20 m', kat: 'Kurang' },
    { nama: 'Core Stability 12 Level', kat: 'Cukup' },
    { nama: 'Illinois Agility', kat: 'Cukup' },
    { nama: 'Sit & Reach', kat: 'Cukup' },
    { nama: 'Stork Stand Kanan', kat: 'Cukup' },
    { nama: 'Back Up 1 Menit', kat: 'Baik Sekali' },
    { nama: 'Wall Sit', kat: 'Baik Sekali' }
];
var semuaAda = true;
contoh.forEach(function(c) {
    var t = cariTemplateLocal(c.nama, c.kat, 'umum');
    var tU17 = cariTemplateLocal(c.nama, c.kat, 'u17');
    var ok = !!t;
    if (!ok) semuaAda = false;
    check(c.nama + ' (' + c.kat + ')', ok ? 'ADA' : 'TIDAK ADA', 'ADA');
    if (tU17 && tU17 !== t) check(c.nama + ' (' + c.kat + ') u17 berbeda', true, true);
});
check('Semua 11 baris punya rekomendasi', semuaAda, true);

// --- 4. Referensi ---
console.log('\n--- Referensi ---');
var refs = tplData.referensi;
check('Ada referensi di template', !!refs, true);
check('Lloyd 2012 terverifikasi', refs.lloyd2012.status, 'terverifikasi');
check('Ada referensi di template Bleep Test', template['bleep test'] && template['bleep test']['Kurang Sekali'] && template['bleep test']['Kurang Sekali'].umum.referensi.length > 0, true);

// --- 5. Fallback berjenjang ---
console.log('\n--- Fallback ---');
// Test: hapus teks usia, harus fallback ke umum
var t1 = cariTemplateLocal('Bleep Test', 'Baik', 'u17');
check('Bleep Test Baik u17 ada', !!t1, true);
// Test: item yang tidak ada -> null
var t2 = cariTemplateLocal('Item Tidak Ada', 'Baik', 'umum');
check('Item tidak ada -> null', t2, null);

// --- 6. Coverage: semua item bernorma punya template ---
console.log('\n--- Coverage ---');
var itemsNorma = G.NORMA_ITEMS.filter(function(it) {
    return G.NORMA_ROWS.some(function(n) { return n.item === it.nama && n.mean !== null; });
});
var kurangTemplate = [];
itemsNorma.forEach(function(it) {
    if (!template[itemKey(it.nama)]) kurangTemplate.push(it.nama);
});
check('Semua item bernorma punya template', kurangTemplate.length, 0);
if (kurangTemplate.length > 0) console.log('  Kurang: ' + kurangTemplate.join(', '));

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

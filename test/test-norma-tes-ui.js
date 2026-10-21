// test-norma-tes-ui.js — Verifikasi tampilan & fitur menu Norma Tes
// Jalankan: node test/test-norma-tes-ui.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var akar = path.join(__dirname, '..');
var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}

// --- 1. CSS: Cek tombol header punya style yang benar ---
console.log('=== 1. CSS: Gaya tombol header ===');
var css = fs.readFileSync(path.join(akar, 'css/styles.css'), 'utf8');
check('Ada .btn-header-primary', css.indexOf('.btn-header-primary') >= 0, true);
check('Ada .btn-header-secondary', css.indexOf('.btn-header-secondary') >= 0, true);
check('btn-header-primary punya focus-visible', css.indexOf('.btn-header-primary:focus-visible') >= 0, true);
check('btn-header-secondary punya focus-visible', css.indexOf('.btn-header-secondary:focus-visible') >= 0, true);
check('btn-header-primary punya hover', css.indexOf('.btn-header-primary:hover') >= 0, true);
check('btn-header-secondary punya hover', css.indexOf('.btn-header-secondary:hover') >= 0, true);
check('btn punya disabled state', css.indexOf(':disabled') >= 0, true);
check('btn punya white-space: nowrap', css.indexOf('white-space: nowrap') >= 0, true);

// Hitung kontras WCAG
function luminance(r, g, b) {
    var a = [r, g, b].map(function(v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrastRatio(l1, l2) {
    var light = Math.max(l1, l2), dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
}
// btn-header-primary: #ffffff bg, #0f172a text
var crPrimary = contrastRatio(luminance(255,255,255), luminance(15,23,42));
check('Kontras btn-header-primary (putih/navy)', Math.round(crPrimary * 10) / 10 >= 4.5, true);
console.log('  -> Rasio kontras primer: ' + Math.round(crPrimary * 10) / 10 + ':1');

// btn-header-secondary: navy bg (#1e293b) + white text
var crSecondary = contrastRatio(luminance(30,41,59), luminance(255,255,255));
check('Kontras btn-header-secondary (putih/navy)', Math.round(crSecondary * 10) / 10 >= 4.5, true);
console.log('  -> Rasio kontras sekunder: ' + Math.round(crSecondary * 10) / 10 + ':1');

// --- 2. HTML: Tombol yang diperbaiki ---
console.log('\n=== 2. HTML: Tombol yang diperbaiki ===');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
check('Keluar pakai btn-header-secondary', /logout\(\).*btn-header-secondary/.test(html), true);
check('Download CSV pakai btn-header-secondary', /downloadNormaCSV\(\).*btn-header-secondary/.test(html), true);
check('Download Excel pakai btn-header-primary', /downloadNormaXLSX\(\).*btn-header-primary/.test(html), true);
check('Kembali pakai btn-header-secondary', /closeCaborView\(\).*btn-header-secondary/.test(html), true);
check('Tidak ada text-white pada tombol header', !/btn-header-.*text-white/.test(html), true);

// --- 3. JS: Download filename pattern ---
console.log('\n=== 3. Download ===');
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
check('normaFileName function ada', appJs.indexOf('function normaFileName') >= 0, true);
check('Filename pattern Norma_Tes_<nama>_<tanggal>', appJs.indexOf("'Norma_Tes_'") >= 0, true);
check('downloadNormaCSV pakai normaFileName', /downloadNormaCSV[\s\S]*normaFileName\('csv'\)/.test(appJs), true);
check('downloadNormaXLSX pakai normaFileName', /normaFileName\('xlsx'\)/.test(appJs), true);

// CSV punya 4 section
check('CSV ada DAFTAR ITEM TES', appJs.indexOf("'DAFTAR ITEM TES'") >= 0, true);
check('CSV ada NORMA & KATEGORI', appJs.indexOf("'NORMA & KATEGORI'") >= 0, true);
check('CSV ada RUMUS PERHITUNGAN', appJs.indexOf("'RUMUS PERHITUNGAN'") >= 0, true);
check('CSV ada KETERANGAN & SUMBER NORMA', appJs.indexOf("'KETERANGAN & SUMBER NORMA'") >= 0, true);

// XLSX 4 sheet
check('XLSX sheet Item Tes', appJs.indexOf("'Item Tes'") >= 0, true);
check('XLSX sheet Norma', appJs.indexOf("'Norma'") >= 0, true);
check('XLSX sheet Rumus', appJs.indexOf("'Rumus'") >= 0, true);
check('XLSX sheet Sumber', appJs.indexOf("'Sumber'") >= 0, true);

// --- 4. JS: Logout ---
console.log('\n=== 4. Logout & Akses ===');
check('Logout hapus session', appJs.indexOf("removeItem('tes_pengukuran_session')") >= 0, true);
check('Logout ada pushState (back prevention)', appJs.indexOf('pushState') >= 0, true);
check('Logout ada onpopstate handler', appJs.indexOf('onpopstate') >= 0, true);
check('showAdminView cek superadmin', appJs.indexOf("u.role !== 'superadmin'") >= 0, true);
check('Hash routing ada', appJs.indexOf('handleHashRoute') >= 0, true);
check('Hash routing cek norma access', appJs.indexOf("'norma'") >= 0 && appJs.indexOf('blokir') >= 0, true);

// --- 5. JS: Read-only ---
console.log('\n=== 5. Read-only ===');
check('Tidak ada input/edit di view-norma', !/view-norma[\s\S]*<input(?![^>]*type="checkbox")[^>]*>/.test(html.match(/<section id="view-norma"[\s\S]*?<\/section>/)?.[0] || ''), true);

// --- 6. JS: Tab active state ---
console.log('\n=== 6. Tab Navigation ===');
check('showAdminView sync hash', appJs.indexOf("history.replaceState(null, '', '#admin/' + name)") >= 0, true);
check('Nav button active class', appJs.indexOf("classList.toggle('active'") >= 0, true);

// --- 7. Data: Load & verify ---
console.log('\n=== 7. Data Integrity ===');
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
var G = sandbox;
G.terapkanNormaDariJSON(JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8')));
check('NORMA_ITEMS loaded', G.NORMA_ITEMS.length, 43);
check('NORMA_ROWS loaded', G.NORMA_ROWS.length, 112);
check('NORMA_RUMUS loaded', G.NORMA_RUMUS.length, 12);
check('NORMA_KETERANGAN loaded', G.NORMA_KETERANGAN.length, 27);
check('IMT_KATEGORI ada', Array.isArray(G.IMT_KATEGORI), true);
check('hitungIMT function ada', typeof G.hitungIMT, 'function');

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

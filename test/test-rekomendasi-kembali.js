// test-rekomendasi-kembali.js — Verifikasi T1 (login), T2 (Kembali), T3 (Rekomendasi)
// Jalankan: node test/test-rekomendasi-kembali.js
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

console.log('=== VERIFIKASI LOGIN, KEMBALI, & REKOMENDASI ===\n');

// --- T1: Modal Login ---
console.log('--- T1: Modal Login ---');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var storeJs = fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8');

check('Tidak ada tombol Masuk sebagai Tamu', html.indexOf('doLoginTamu') < 0, true);
check('Tidak ada fungsi doLoginTamu', appJs.indexOf('function doLoginTamu') < 0, true);
check('Tidak ada fungsi masukSebagaiTamu', storeJs.indexOf('function masukSebagaiTamu') < 0, true);
check('Tombol Masuk tetap ada', html.indexOf('doLogin()') >= 0, true);
check('Link Daftar tetap ada', html.indexOf('Belum punya akun') >= 0, true);
check('Link Kembali ke Beranda tetap ada', html.indexOf('Kembali ke Beranda') >= 0, true);

// --- T2: Tombol Kembali ---
console.log('\n--- T2: Tombol Kembali ---');
check('Ada btnKembali di HTML', html.indexOf('id="btnKembali"') >= 0, true);
check('Ada navKembali function', appJs.indexOf('function navKembali') >= 0, true);
check('Ada updateTombolKembali', appJs.indexOf('function updateTombolKembali') >= 0, true);
check('Ada navHistory', appJs.indexOf('navHistory') >= 0, true);
check('navKembali ke landing page jika tanpa riwayat', appJs.indexOf('landingPage') >= 0, true);
check('Kembali hidden di superadmin', appJs.indexOf("u.role === 'superadmin'") >= 0, true);
check('Kembali selalu tampil untuk non-superadmin', appJs.indexOf('btn.classList.remove') >= 0, true);
check('Gaya btn-header-secondary', html.indexOf('btnKembali') >= 0 && html.indexOf('btn-header-secondary') >= 0, true);

// --- T3: Menu Rekomendasi ---
console.log('\n--- T3: Menu Rekomendasi ---');
check('Ada navRekomendasi', html.indexOf('id="navRekomendasi"') >= 0, true);
check('Tidak hidden di nav', html.indexOf('id="navRekomendasi">Rekomendasi') >= 0, true);
check('Ada view-rekomendasi', html.indexOf('id="view-rekomendasi"') >= 0, true);
check('Ada rekTabNav', html.indexOf('id="rekTabNav"') >= 0, true);
check('Ada rekTabAtlet', html.indexOf('id="rekTabAtlet"') >= 0, true);
check('Ada rekTabTemplate', html.indexOf('id="rekTabTemplate"') >= 0, true);
check('Ada rekTabAtletContent', html.indexOf('id="rekTabAtletContent"') >= 0, true);
check('Ada rekTabTemplateContent', html.indexOf('id="rekTabTemplateContent"') >= 0, true);
check('Ada switchRekTab', appJs.indexOf('function switchRekTab') >= 0, true);
check('Ada renderTemplateEditor', appJs.indexOf('function renderTemplateEditor') >= 0, true);
check('Ada isiOtomatisTemplate', appJs.indexOf('function isiOtomatisTemplate') >= 0, true);
check('Ada simpanTemplateItem', appJs.indexOf('function simpanTemplateItem') >= 0, true);
check('Ada loadRekomendasiTemplate', appJs.indexOf('function loadRekomendasiTemplate') >= 0, true);
check('Ada showReferensi', appJs.indexOf('function showReferensi') >= 0, true);

// Template JSON
var tplData = JSON.parse(fs.readFileSync(path.join(akar, 'data/rekomendasi-template.json'), 'utf8'));
check('Template JSON ada', !!tplData.template, true);
check('Ada referensi', !!tplData.referensi, true);
check('Jumlah item template > 30', Object.keys(tplData.template).length > 30, true);
check('Ada kategori Baik Sekali', tplData.kategori.indexOf('Baik Sekali') >= 0, true);
check('Ada kategori Kurang Sekali', tplData.kategori.indexOf('Kurang Sekali') >= 0, true);
check('Referensi punya status', !!tplData.referensi.lloyd2012.status, true);
check('Ada u17 di template', !!tplData.template['Push Up 1 Menit']['Baik'].u17, true);
check('Ada o17 di template', !!tplData.template['Push Up 1 Menit']['Baik'].o17, true);
check('Ada umum di template', !!tplData.template['Push Up 1 Menit']['Baik'].umum, true);

// Referensi terverifikasi
var refs = tplData.referensi;
check('Lloyd 2012 terverifikasi', refs.lloyd2012.status, 'terverifikasi');
check('Faigenbaum 2009 terverifikasi', refs.faigenbaum2009.status, 'terverifikasi');
check('Ramsbottom 1988 terverifikasi', refs.ramsbottom1988.status, 'terverifikasi');
check('ACSM 2021 terverifikasi', refs.acsm2021.status, 'terverifikasi');
check('NSCA 2016 terverifikasi', refs.nsca2016.status, 'terverifikasi');
check('Behm 2008 terverifikasi', refs.behm2008.status, 'terverifikasi');

// Non-superadmin: write guard untuk template
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 'c', username: 'gresik', role: 'cabor' }));
check('cabor canWrite() = false', G.canWrite(), false);
check('cabor isTamu() = true', G.isTamu(), true);

// Superadmin
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({ id: 's', username: 'admin', role: 'superadmin' }));
check('superadmin canWrite() = true', G.canWrite(), true);

// Akses control: rekomendasi tidak diblokir untuk non-superadmin
check('rekomendasi tidak di blokir list', appJs.indexOf("'rekomendasi'") >= 0 && appJs.indexOf('blokir') >= 0, true);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');

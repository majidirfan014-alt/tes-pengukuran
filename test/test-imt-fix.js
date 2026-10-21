// test-imt-fix.js — Verifikasi perbaikan IMT (penyebab kartu IMT "-")
// Jalankan: node test/test-imt-fix.js
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
var dataJs = fs.readFileSync(path.join(akar, 'js/data.js'), 'utf8');
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var storeJs = fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(akar, 'css/styles.css'), 'utf8');

G.terapkanNormaDariJSON(JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8')));

var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}

console.log('=== VERIFIKASI PERBAIKAN IMT ===\n');

// --- 1. hitungIMT (fungsi pusat, hitungIMT(beratKg, tinggiCm)) ---
console.log('--- 1. hitungIMT ---');
check('70 kg/170 cm = 24,2', G.hitungIMT(70, 170), 24.2);
check('50 kg/165 cm = 18,4', G.hitungIMT(50, 165), 18.4);
check('90 kg/170 cm = 31,1', G.hitungIMT(90, 170), 31.1);
check('80 kg/175 cm = 26,1', G.hitungIMT(80, 175), 26.1);
check('koma desimal "70,5"/"170,5" dibaca benar (24,3)', G.hitungIMT('70,5', '170,5'), 24.3);
check('titik desimal "70.5"/"170.5" = 24,3', G.hitungIMT('70.5', '170.5'), 24.3);
check('tinggi meter 1.70 sama dengan 170 cm', G.hitungIMT(70, 1.70), G.hitungIMT(70, 170));
check('tinggi meter 1.65 = 18,4', G.hitungIMT(50, 1.65), 18.4);
check('tinggi kosong = null', G.hitungIMT(70, ''), null);
check('berat kosong = null', G.hitungIMT('', 170), null);
check('tinggi null = null', G.hitungIMT(70, null), null);
check('tinggi 0 = null', G.hitungIMT(70, 0), null);
check('berat 0 = null', G.hitungIMT(0, 170), null);
check('tinggi di luar rentang (300 cm) = null', G.hitungIMT(70, 300), null);
check('tinggi di luar rentang (20 cm) = null', G.hitungIMT(70, 20), null);
check('berat di luar rentang (500 kg) = null', G.hitungIMT(500, 170), null);
check('berat di luar rentang (5 kg) = null', G.hitungIMT(5, 170), null);
check('teks bukan angka = null', G.hitungIMT('abc', '170'), null);

// --- 2. Kategori (IMT_KATEGORI konstanta + sadar usia) ---
console.log('\n--- 2. Kategori IMT ---');
check('IMT_KATEGORI = 4 ambang WHO dewasa', Array.isArray(G.IMT_KATEGORI) && G.IMT_KATEGORI.length, 4);
check('usia 20, 70/170 -> Normal', G.kategoriIMT(24.2, 20), { label: 'Normal', catatan: '' });
check('usia 17, 24.2 -> label kosong (bukan ambang dewasa)', G.kategoriIMT(24.2, 17).label, '');
check('usia 17 -> keterangan kategori anak belum aktif',
    G.kategoriIMT(24.2, 17).catatan, G.IMT_KATEGORI_ANAK_NOTE);
check('keterangan anak memuat "belum diaktifkan"', /belum diaktifkan/.test(G.IMT_KATEGORI_ANAK_NOTE), true);
check('usia 0 (tanpa tgl lahir) -> nilai saja, tanpa kategori', G.kategoriIMT(24.2, 0), { label: '', catatan: '' });
check('IMT null -> kosong', G.kategoriIMT(null, 20), { label: '', catatan: '' });
check('anak 10 th 35/140 = 17,9', G.hitungIMT(35, 140), 17.9);
check('anak 10 th: label kosong', G.kategoriIMT(17.9, 10).label, '');
check('anak 10 th: keterangan anak muncul', !!G.kategoriIMT(17.9, 10).catatan, true);

// --- 3. computeEvaluation: IMT dari sesi, umur dari tgl lahir vs tgl tes ---
console.log('\n--- 3. computeEvaluation ---');
var evDewasa = G.computeEvaluation({
    usia: 26, kelamin: 'Perempuan',
    items: ['Vertical Jump'],
    nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 170, 'Berat Badan': 70 }
});
check('dewasa: imt 24,2', evDewasa.imt, 24.2);
check('dewasa: kategori Normal', evDewasa.imtKategori, 'Normal');

var evAnak = G.computeEvaluation({
    usia: 10, kelamin: 'Perempuan',
    items: ['Vertical Jump'],
    nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 140, 'Berat Badan': 35 }
});
check('anak: imt 17,9', evAnak.imt, 17.9);
check('anak: kategori kosong (bukan dewasa)', evAnak.imtKategori, '');
check('anak: catatan belum aktif', /belum diaktifkan/.test(evAnak.imtCatatan), true);

var evKosong = G.computeEvaluation({
    usia: 26, kelamin: 'Perempuan',
    items: ['Vertical Jump'],
    nilai: { 'Vertical Jump': 0.45 }
});
check('tanpa TB/BB: imt null', evKosong.imt, null);
check('tanpa TB/BB: kategori kosong', evKosong.imtKategori, '');

// Performa tidak dipengaruhi IMT (rumus 11 tidak berubah).
// Catatan: BB kini dipakai menilai VJ sebagai power Lewis — jadi pct evP1 (power)
// boleh berbeda dari evP2 (fallback cm tanpa BB); keduanya tetap hanya 1 item.
var evP1 = G.computeEvaluation({
    usia: 26, kelamin: 'Perempuan',
    items: ['Vertical Jump', 'Tinggi Badan', 'Berat Badan', 'IMT'],
    nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 170, 'Berat Badan': 70, 'IMT': 24.2 }
});
var evP2 = G.computeEvaluation({
    usia: 26, kelamin: 'Perempuan',
    items: ['Vertical Jump', 'Tinggi Badan', 'Berat Badan', 'IMT'],
    nilai: { 'Vertical Jump': 0.45 }
});
console.log('INFO | VJ dengan BB (power) = ' + evP1.items[0].hasilTeks +
    ', pct = ' + evP1.items[0].pct + '; tanpa BB (meter, fallback) = ' + evP2.items[0].hasilTeks +
    ', pct = ' + evP2.items[0].pct);
check('dengan TB/BB: nilai power (W), bukan cm', /\d+\.\d W$/.test(evP1.items[0].hasilTeks), true);
check('performa dengan TB/BB = pct power VJ saja (TB/BB/IMT tidak dihitung)', evP1.performa, evP1.items[0].pct);
check('performa tanpa TB/BB = pct fallback cm', evP2.performa, evP2.items[0].pct);
check('pct power (BB) berbeda dari pct cm (tanpa BB)', evP1.performa === evP2.performa, false);
check('performa tidak ikut IMT (item dinilai hanya 1)', evP1.jumlahItem, 1);
check('jumlah item tanpa TB/BB juga 1', evP2.jumlahItem, 1);

// Override 42.1% tetap 42.1% dengan/tanpa TB/BB (skenario screenshot)
var evO1 = G.computeEvaluation({
    usia: 26, kelamin: 'Perempuan', items: ['Vertical Jump', '% Performance'],
    nilai: { 'Vertical Jump': 0.45, '% Performance': 42.1, 'Tinggi Badan': 170, 'Berat Badan': 70 }
});
var evO2 = G.computeEvaluation({
    usia: 26, kelamin: 'Perempuan', items: ['Vertical Jump', '% Performance'],
    nilai: { 'Vertical Jump': 0.45, '% Performance': 42.1 }
});
check('Performa 42.1% (dengan TB/BB)', evO1.performa, 42.1);
check('Performa 42.1% (tanpa TB/BB)', evO2.performa, 42.1);
check('Kategori 42.1% = Cukup', evO1.kategori, 'Cukup');
check('IMT tampil 24,2 padahal performa dari override', evO1.imt, 24.2);
check('IMT null tanpa data', evO2.imt, null);

// --- 4. evalSesi: sumber data sesi + fallback + data lama ---
console.log('\n--- 4. evalSesi (sumber data & fallback) ---');
function seed(db) { mem['tes_pengukuran_db_v1'] = JSON.stringify(db); }
function atlet(id, lahir) {
    return { id: id, nama: 'Atlet ' + id, tempat_lahir: 'Tuban', tanggal_lahir: lahir,
        jenis_kelamin: 'Perempuan', cabor_nama: 'Pencak Silat', nomor: '', catatan: '', catatan_cedera: '' };
}
var base = {
    users: [{ id: 'u1', username: 'superadmin', password: 'x', role: 'superadmin', cabor: '', kabupaten: '', status: 'aktif' }],
    cabor: [{ id: 'c1', nama: 'Pencak Silat', kabupaten: 'Tuban', items: null, dibuat: '' }],
    atlet: [], sesi: [], itemCustom: [], aksesLog: []
};

// 4a. Sesi lama (dibuat sebelum perbaikan) tapi TB/BB tersimpan -> IMT ikut tampil
seed({
    users: base.users, cabor: base.cabor, itemCustom: [], aksesLog: [],
    atlet: [atlet('a1', '2000-05-10')],
    sesi: [{ id: 's1', atlet_id: 'a1', tanggal_tes: '2026-10-10',
        nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 170, 'Berat Badan': 70 } }]
});
var evLama = G.evalSesi({ id: 's1', atlet_id: 'a1', tanggal_tes: '2026-10-10',
    nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 170, 'Berat Badan': 70 } });
check('data lama dgn TB/BB: IMT tampil 24,2', evLama.imt, 24.2);
check('data lama dgn TB/BB: Normal', evLama.imtKategori, 'Normal');
check('tanpa catatan sumber', evLama.imtCatatan, '');

// 4b. Sesi KOSONG TB/BB (penyebab screenshot) + sesi lebih awal punya data -> fallback
seed({
    users: base.users, cabor: base.cabor, itemCustom: [], aksesLog: [],
    atlet: [atlet('a2', '2000-05-10')],
    sesi: [
        { id: 's-old', atlet_id: 'a2', tanggal_tes: '2026-09-01', nilai: { 'Tinggi Badan': 170, 'Berat Badan': 70 } },
        { id: 's-new', atlet_id: 'a2', tanggal_tes: '2026-10-10', nilai: { '% Performance': 42.1 } }
    ]
});
var evFb = G.evalSesi({ id: 's-new', atlet_id: 'a2', tanggal_tes: '2026-10-10', nilai: { '% Performance': 42.1 } });
check('fallback: IMT dari sesi terbaru sebelumnya = 24,2', evFb.imt, 24.2);
check('fallback: keterangan "dari data atlet 2026-09-01"', evFb.imtCatatan, 'dari data atlet 2026-09-01');
check('fallback: performa tetap 42,1% (tidak berubah)', evFb.performa, 42.1);

// 4c. Tidak ada data sama sekali -> imt null (kartu tampilkan pesan)
seed({
    users: base.users, cabor: base.cabor, itemCustom: [], aksesLog: [],
    atlet: [atlet('a3', '2000-05-10')],
    sesi: [{ id: 's3', atlet_id: 'a3', tanggal_tes: '2026-10-10', nilai: { '% Performance': 42.1 } }]
});
var evNone = G.evalSesi({ id: 's3', atlet_id: 'a3', tanggal_tes: '2026-10-10', nilai: { '% Performance': 42.1 } });
check('tanpa data sama sekali: imt null', evNone.imt, null);
check('tanpa data: kategori kosong', evNone.imtKategori, '');

// 4d. Data sesi ada tapi di luar rentang -> tidak dipakai, fallback dicari
seed({
    users: base.users, cabor: base.cabor, itemCustom: [], aksesLog: [],
    atlet: [atlet('a4', '2000-05-10')],
    sesi: [
        { id: 's4-old', atlet_id: 'a4', tanggal_tes: '2026-09-01', nilai: { 'Tinggi Badan': 170, 'Berat Badan': 70 } },
        { id: 's4', atlet_id: 'a4', tanggal_tes: '2026-10-10', nilai: { 'Tinggi Badan': 300, 'Berat Badan': 70 } }
    ]
});
var evRange = G.evalSesi({ id: 's4', atlet_id: 'a4', tanggal_tes: '2026-10-10',
    nilai: { 'Tinggi Badan': 300, 'Berat Badan': 70 } });
check('nilai di luar rentang dipakai fallback (24,2)', evRange.imt, 24.2);
check('catatan sumber fallback', evRange.imtCatatan, 'dari data atlet 2026-09-01');

// --- 5. Penyebab lama teratasi: simpanAtlet menyimpan TB/BB ---
console.log('\n--- 5. Penyebab (a) teratasi ---');
check('simpanAtlet membaca fTinggi', /fTinggi'\)\.value\.trim\(\)|getElementById\('fTinggi'\)/.test(appJs), true);
check('simpanAtlet menyimpan nilai[Tinggi Badan]', appJs.indexOf("nilai['Tinggi Badan'] = tN") >= 0, true);
check('simpanAtlet menyimpan nilai[Berat Badan]', appJs.indexOf("nilai['Berat Badan'] = bN") >= 0, true);
check('validasi rentang tinggi 50-250', appJs.indexOf('Tinggi Badan harus 50-250 cm') >= 0, true);
check('validasi rentang berat 10-300', appJs.indexOf('Berat Badan harus 10-300 kg') >= 0, true);
check('editAtlet mengisi ulang fTinggi', appJs.indexOf("document.getElementById('fTinggi').value =") >= 0, true);
check('form punya input fTinggi', html.indexOf('id="fTinggi"') >= 0, true);
check('form punya input fBerat', html.indexOf('id="fBerat"') >= 0, true);
check('fTinggi punya min/max rentang', /id="fTinggi"[^>]*min="50"[^>]*max="250"|min="50"[^>]*id="fTinggi"/.test(html) || /id="fTinggi" type="number" step="0.1" min="50" max="250"/.test(html), true);
check('fBerat punya min/max rentang', /id="fBerat" type="number" step="0.1" min="10" max="300"/.test(html), true);
check('TB/BB tetap tidak dinilai (skip di computeEvaluation)', dataJs.indexOf("name === 'Tinggi Badan' || name === 'Berat Badan'") >= 0, true);

// --- 6. Tampilan kartu ---
console.log('\n--- 6. Tampilan ---');
check('kartuIMTHTML ada (pusat tampilan modal)', appJs.indexOf('function kartuIMTHTML') >= 0, true);
check('modal pakai kartuIMTHTML (showDetailSesi)', /showDetailSesi[\s\S]{0,1500}kartuIMTHTML\(ev\)/.test(appJs), true);
check('modal pakai kartuIMTHTML (showDetailPublik)', /showDetailPublik[\s\S]{0,2000}kartuIMTHTML\(ev\)/.test(appJs), true);
check('pesan "Isi tinggi & berat badan" di kartu', appJs.indexOf('Isi tinggi &amp; berat badan') >= 0, true);
check('pesan untuk panel hasil juga', appJs.indexOf('Isi tinggi & berat badan') >= 0, true);
check('badge .imt-badge di CSS', css.indexOf('.imt-badge') >= 0, true);
check('keterangan .imt-catatan line-height 1.4', /\.imt-catatan\s*\{[^}]*line-height:\s*1\.4/.test(css), true);
check('badge kontras netral (bg slate-200, teks slate-900)', /\.imt-badge\s*\{[^}]*background:\s*#e2e8f0[^}]*color:\s*#0f172a/.test(css), true);
check('evIMT pakai stat-value besar (tanpa text-sm)', html.indexOf('class="stat-value" id="evIMT"') >= 0, true);
check('tempat keterangan anak di kartu (evIMTCatatan)', html.indexOf('id="evIMTCatatan"') >= 0, true);

// --- 7. Struktur: hanya SATU hitungIMT, satu sumber rumus ---
console.log('\n--- 7. Satu fungsi pusat ---');
var defHitung = (dataJs.match(/function hitungIMT/g) || []).length + (appJs.match(/function hitungIMT/g) || []).length + (storeJs.match(/function hitungIMT/g) || []).length;
check('hanya 1 definisi hitungIMT di seluruh app', defHitung, 1);
var rumusIMT = (dataJs.match(/b \/ \(m \* m\)/g) || []).length + (appJs.match(/\/ \(.*\*.*\)/g) || []).length;
check('rumus b/(m*m) hanya di data.js', (dataJs.match(/b \/ \(m \* m\)/g) || []).length, 1);
check('app.js tidak hitung ulang rumus IMT', /berat\s*\/\s*\(.*tinggi/.test(appJs), false);

// Norma Tes tetap menyembunyikan baris TB/BB (dari pembersihan sebelumnya) — filter tampilan & download
check('Tampilan Norma Tes memfilter TB/BB (SKIP_NORMA_TABLE)', appJs.indexOf("SKIP_NORMA_TABLE = ['Tinggi Badan', 'Berat Badan']") >= 0, true);
check('Download Norma memfilter TB/BB (SKIP_DL)', (appJs.match(/SKIP_DL = \['Tinggi Badan', 'Berat Badan'\]/g) || []).length, 2);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else { console.log('ADA ' + fail + ' TEST YANG GAGAL!'); process.exit(1); }

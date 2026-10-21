// test-edit-sesi.js — Mode edit: ubah atlet+sesi LAMA (backfill TB/BB) tanpa duplikat
// Jalankan: node test/test-edit-sesi.js
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
var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
G.terapkanNormaDariJSON(JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8')));

var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}
// Ambil isi fungsi top-level dari app.js (sampai deklarasi fungsi berikutnya)
function isiFungsi(nama) {
    var i = appJs.indexOf('function ' + nama + '(');
    if (i < 0) return '';
    var j = appJs.indexOf('\nfunction ', i + 1);
    return appJs.slice(i, j < 0 ? appJs.length : j);
}

console.log('=== VERIFIKASI MODE EDIT SESI (BACKFILL TB/BB) ===\n');

// --- 1. Struktur mode edit di app.js ---
console.log('--- 1. Mode edit (app.js) ---');
check('deklarasi idAtletEdit', /var idAtletEdit = null;/.test(appJs), true);
check('deklarasi idSesiEdit', /var idSesiEdit = null;/.test(appJs), true);
check('evalAtletSaatIni + evalSesiSaatIni dilacak', /var evalAtletSaatIni = null;/.test(appJs) && /var evalSesiSaatIni = null;/.test(appJs), true);

var fOpen = isiFungsi('openFormAtlet');
check('openFormAtlet me-reset mode edit', fOpen.indexOf('idAtletEdit = null') >= 0 && fOpen.indexOf('idSesiEdit = null') >= 0, true);
check('openFormAtlet mengembalikan label form baru', fOpen.indexOf('setLabelFormEdit(false)') >= 0, true);

var fLabel = isiFungsi('setLabelFormEdit');
check('label edit: "Simpan Perubahan"', fLabel.indexOf('Simpan Perubahan') >= 0, true);
check('label edit: judul "Form Ubah Data Atlet', fLabel.indexOf('Form Ubah Data Atlet') >= 0, true);
check('label baru: "Simpan Atlet"', fLabel.indexOf("'Simpan Atlet'") >= 0, true);

var fSimpan = isiFungsi('simpanAtlet');
check('simpanAtlet menyalin id edit ke variabel lokal', fSimpan.indexOf('var idA = idAtletEdit, idS = idSesiEdit;') >= 0, true);
check('simpanAtlet cabang edit: updateAtlet', fSimpan.indexOf('updateAtlet(idA, dataAtlet)') >= 0, true);
check('simpanAtlet cabang edit: updateSesi (tanggal, nomor, nilai)', /updateSesi\(idS, \{ tanggal_tes: tglTes, nomor: nomorTes, nilai: nilai \}\)/.test(fSimpan), true);
check('simpanAtlet cabang edit: idSesi hilang -> addSesi ke atlet yang sama', fSimpan.indexOf('sesi = addSesi({ atlet_id: idA,') >= 0, true);
check('simpanAtlet mode baru tetap addAtlet + addSesi', fSimpan.indexOf('atlet = addAtlet(dataAtlet);') >= 0, true);
check('simpanAtlet me-reset mode edit setelah simpan', fSimpan.indexOf('idAtletEdit = null;') >= 0 && fSimpan.indexOf('setLabelFormEdit(false);') >= 0, true);
check('simpanAtlet membaca TB/BB dari form', fSimpan.indexOf("nilai['Tinggi Badan'] = tN") >= 0 && fSimpan.indexOf("nilai['Berat Badan'] = bN") >= 0, true);

var fEdit = isiFungsi('editAtlet');
check('editAtlet memakai mulaiEditAtlet (sederhana)', fEdit.indexOf('mulaiEditAtlet(id,') >= 0, true);

var fMulai = isiFungsi('mulaiEditAtlet');
check('mulaiEditAtlet membuka form + set mode edit', fMulai.indexOf('openFormAtlet();') >= 0 && fMulai.indexOf('idAtletEdit = atletId;') >= 0 && fMulai.indexOf('idSesiEdit = sesiId') >= 0, true);
check('mulaiEditAtlet menampilkan label edit', fMulai.indexOf('setLabelFormEdit(true);') >= 0, true);
check('mulaiEditAtlet mengisi tanggal tes dari sesi', fMulai.indexOf("getElementById('fTglTes').value = s.tanggal_tes") >= 0, true);
check('mulaiEditAtlet mengisi TB/BB dari sesi', fMulai.indexOf("s.nilai['Tinggi Badan'] !== undefined") >= 0 && fMulai.indexOf("s.nilai['Berat Badan'] !== undefined") >= 0, true);
check('mulaiEditAtlet mengisi nilai tes lama', fMulai.indexOf('populateTestFieldsDariNilai(s.nilai || {})') >= 0, true);
check('mulaiEditAtlet menghitung ulang preview IMT', fMulai.indexOf('updateIMTDariForm();') >= 0, true);
check('mulaiEditAtlet menghitung ulang item tes & usia', fMulai.indexOf('updateItemTes();') >= 0 && fMulai.indexOf('updateUsia();') >= 0, true);

var fEditSesi = isiFungsi('editSesiTerakhir');
check('editSesiTerakhir: guard canWrite', fEditSesi.indexOf('if (!canWrite())') >= 0, true);
check('editSesiTerakhir: membuka mode edit sesi tampil', fEditSesi.indexOf('mulaiEditAtlet(evalAtletSaatIni.id, evalSesiSaatIni.id);') >= 0, true);
check('editSesiTerakhir: tidak lagi stub alert lama', fEditSesi.indexOf('Fitur edit: ubah data di form lalu simpan ulang') < 0, true);

var fHasil = isiFungsi('showHasilEvaluasi');
check('showHasilEvaluasi melacak atlet & sesi saat ini', fHasil.indexOf('evalAtletSaatIni = atlet;') >= 0 && fHasil.indexOf('evalSesiSaatIni = sesi;') >= 0, true);

var fReset = isiFungsi('resetFormAtlet');
check('resetFormAtlet keluar dari mode edit', fReset.indexOf('idAtletEdit = null;') >= 0 && fReset.indexOf('setLabelFormEdit(false)') >= 0, true);
check('resetFormAtlet membersihkan tanggal tes', fReset.indexOf("'fTglTes'") >= 0, true);

var fPop = isiFungsi('populateTestFieldsDariNilai');
check('populateTestFields aman utk key tanpa input (TB/BB)',
    fPop.indexOf('if (inp) {') >= 0 && fPop.indexOf('inp.value = val;') >= 0, true);

// --- 1b. Pengaman duplikat & select cabor ---
console.log('\n--- 1b. Pengaman duplikat + fallback cabor ---');
check('simpanAtlet: guard duplikat hanya di mode baru (!idAtletEdit)',
    fSimpan.indexOf('if (!idAtletEdit) {') >= 0, true);
check('simpanAtlet: deteksi nama+lahir+cabor sama',
    /x\.nama === nama && x\.cabor_nama === cabor && \(x\.tanggal_lahir \|\| ''\) === \(lahirIni \|\| ''\)/.test(fSimpan), true);
check('simpanAtlet: confirm menawarkan perbarui tanpa duplikat',
    fSimpan.indexOf('sudah ada di data') >= 0 && fSimpan.indexOf('tanpa duplikat') >= 0, true);
check('simpanAtlet: OK -> rute ke mode edit (idAtletEdit kembar)',
    fSimpan.indexOf('idAtletEdit = kembar.id;') >= 0, true);
check('simpanAtlet: sesi edit diarahkan ke sesi terakhir kembar',
    /idSesiEdit = slKembar\.length > 0 \? slKembar\[0\]\.id : null;/.test(fSimpan), true);
check('simpanAtlet: tanggal tes lama dipertahankan bila kosong',
    fSimpan.indexOf("fTglTes').value = slKembar[0].tanggal_tes") >= 0, true);
check('simpanAtlet: rekursi sekali dengan mode edit aktif',
    fSimpan.indexOf('return simpanAtlet();') >= 0, true);

check('mulaiEditAtlet: deteksi cabor tak ada di opsi select',
    fMulai.indexOf('if (selC.value !== a.cabor_nama && a.cabor_nama)') >= 0, true);
check('mulaiEditAtlet: opsi cabor ditambahkan sementara',
    fMulai.indexOf('selC.appendChild(opC)') >= 0 && fMulai.indexOf('opC.textContent = a.cabor_nama') >= 0, true);

// --- 2. index.html: label & id form ---
console.log('\n--- 2. index.html ---');
check('ada id="formJudul"', html.indexOf('id="formJudul"') >= 0, true);
check('judul default "Form Tambah Atlet Baru"', html.indexOf('>Form Tambah Atlet Baru</p>') >= 0, true);
check('ada id="btnSimpanAtlet"', html.indexOf('id="btnSimpanAtlet"') >= 0, true);
check('tombol default "Simpan Atlet"', html.indexOf('>Simpan Atlet</button>') >= 0, true);

// --- 3. Fungsional: backfill TB/BB ke sesi lama via updateAtlet/updateSesi ---
console.log('\n--- 3. Fungsional: backfill TB/BB (store.js) ---');
mem['tes_pengukuran_db_v1'] = JSON.stringify({
    users: [{ id: 'u1', username: 'superadmin', password: 'x', role: 'superadmin', cabor: '', kabupaten: '', status: 'aktif' }],
    cabor: [{ id: 'c1', nama: 'Pencak Silat', kabupaten: 'Tuban', kode_akses: 'K1', dibuat: '2026-01-01T00:00:00.000Z' }],
    atlet: [{ id: 'a1', nama: 'Backfill Tes', tempat_lahir: 'Tuban', tanggal_lahir: '2000-05-10',
        jenis_kelamin: 'Perempuan', cabor_nama: 'Pencak Silat', nomor: '', catatan: '', catatan_cedera: '' }],
    sesi: [{ id: 's1', atlet_id: 'a1', tanggal_tes: '2026-10-18', nomor: '', catatan: '',
        nilai: { 'Vertical Jump': 0.45 }, dibuat: '2026-10-18T00:00:00.000Z' }],
    itemCustom: [], aksesLog: []
});
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify(
    { id: 'u1', username: 'superadmin', role: 'superadmin', cabor: '', kabupaten: '' }));
check('superadmin canWrite', G.canWrite(), true);

var ev0 = G.evalSesi(G.findSesi('s1'));
check('sesi lama tanpa TB/BB: imt null', ev0 && ev0.imt, null);
check('sesi lama tanpa TB/BB: kategori kosong', ev0 && ev0.imtKategori, '');

var rA = G.updateAtlet('a1', { nama: 'Backfill Tes Diubah' });
check('updateAtlet sukses', rA.ok, true);
var rS = G.updateSesi('s1', {
    tanggal_tes: '2026-10-18', nomor: '',
    nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 165, 'Berat Badan': 55 }
});
check('updateSesi sukses', rS.ok, true);

var ev1 = G.evalSesi(G.findSesi('s1'));
check('sesudah backfill: imt = 20,2 (55 kg / 165 cm)', ev1.imt, 20.2);
check('sesudah backfill: kategori dewasa "Normal"', ev1.imtKategori, 'Normal');
check('sesudah backfill: tanpa catatan fallback', ev1.imtCatatan, '');
check('nilai tes lama tidak hilang (merge)', G.findSesi('s1').nilai['Vertical Jump'], 0.45);
check('tanggal tes tetap', G.findSesi('s1').tanggal_tes, '2026-10-18');
check('nama atlet ter-update', G.findAtlet('a1').nama, 'Backfill Tes Diubah');
check('jumlah atlet TIDAK bertambah (tanpa duplikat)', G.listAtlet().length, 1);
check('jumlah sesi TIDAK bertambah', G.loadDB().sesi.length, 1);

// Backfill anak-anak: nilai tampil, kategori kosong + catatan anak
G.updateAtlet('a1', { tanggal_lahir: '2016-01-01' }); // usia 10 saat tes 2026-10-18
G.updateSesi('s1', { nilai: { 'Vertical Jump': 0.45, 'Tinggi Badan': 140, 'Berat Badan': 35 } });
var evAnak = G.evalSesi(G.findSesi('s1'));
check('backfill anak (140 cm/35 kg): imt = 17,9', evAnak.imt, 17.9);
check('backfill anak: label kategori kosong', evAnak.imtKategori, '');
check('backfill anak: catatan anak muncul', /belum diaktifkan/.test(evAnak.imtCatatan), true);

// --- 4. Guard: role cabor/tamu tidak bisa backfill ---
console.log('\n--- 4. Guard role cabor ---');
G.localStorage.setItem('tes_pengukuran_session', JSON.stringify(
    { id: 'u2', username: 'gresik', role: 'cabor', cabor: 'Pencak Silat', kabupaten: 'Tuban' }));
check('cabor canWrite false', G.canWrite(), false);
check('updateAtlet ditolak utk cabor', G.updateAtlet('a1', { nama: 'X' }).ok, false);
check('updateSesi ditolak utk cabor', G.updateSesi('s1', { nilai: {} }).ok, false);
check('data tidak berubah', G.findAtlet('a1').nama, 'Backfill Tes Diubah');

console.log('\n=== RINGKASAN: ' + pass + ' lulus, ' + fail + ' gagal ===');
process.exit(fail > 0 ? 1 : 0);

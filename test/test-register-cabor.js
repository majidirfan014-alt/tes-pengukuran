// test-register-cabor.js — Pendaftaran publik + matriks izin per role
// Jalankan: node test/test-register-cabor.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var akar = path.join(__dirname, '..');
var mem = {};
var sandbox = {
    console: console,
    localStorage: {
        getItem: function(k) { return (k in mem) ? mem[k] : null; },
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

var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var storeJs = fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');

var pass = 0, fail = 0;
function check(label, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log((ok ? 'LULUS ' : 'GAGAL ') + ' | ' + label + ' | harap: ' + JSON.stringify(expected) + ' | aktual: ' + JSON.stringify(actual));
}
function tanpaSesi() { G.localStorage.removeItem('tes_pengukuran_session'); }
function loginSebagai(role, cabor) {
    G.localStorage.setItem('tes_pengukuran_session', JSON.stringify({
        id: 'u-' + role, username: role, role: role, cabor: cabor || '', kabupaten: 'Tuban'
    }));
}
function segarkanRate() {
    G.localStorage.setItem('tes_pengukuran_register_rate', JSON.stringify({ coba: [], sukses: [] }));
}
function jumlahRole(role) {
    return G.loadDB().users.filter(function(u) { return u.role === role; }).length;
}

console.log('=== PENDAFTARAN PUBLIK & MATRIKS IZIN ===\n');

// ------------------------------------------------------------------
console.log('--- 1. Pendaftaran tanpa login (pengunjung) ---');
tanpaSesi();
check('pengunjung belum punya sesi', G.currentUser(), null);
check('pengunjung canWrite() = false', G.canWrite(), false);

var d1 = G.register('Bulu Tangkis', 'Tuban', 'bulu_tk', 'rahasia123');
check('daftar sebagai pengunjung BERHASIL', d1.ok, true);
var akun1 = G.loadDB().users.filter(function(u) { return u.username === 'bulu_tk'; })[0];
check('akun tersimpan', !!akun1, true);
check('role dipaksa cabor', akun1.role, 'cabor');
check('status akun aktif', akun1.status, 'aktif');
check('password tidak tersimpan plaintext', String(akun1.password).indexOf('rahasia123') < 0, true);
check('password berformat hash bersalt+iterasi', String(akun1.password).indexOf('$sha256$v1$1000$') === 0, true);
check('cabor + kode akses + item otomatis dibuat',
    (function() {
        var c = G.findCaborByNama('Bulu Tangkis', 'Tuban');
        return !!(c && c.kode_akses && c.items && c.items.length);
    })(), true);

// ------------------------------------------------------------------
console.log('\n--- 2. Role dari klien TIDAK dipercaya ---');
tanpaSesi();
var d2 = G.register('Renang', 'Tuban', 'renang_acara', 'rahasia123', 'superadmin');
check('daftar sambil kirim role superadmin tetap jalan', d2.ok, true);
var akun2 = G.loadDB().users.filter(function(u) { return u.username === 'renang_acara'; })[0];
check('role tersimpan = cabor (bukan superadmin)', akun2.role, 'cabor');
check('pendaftaran tidak membuat superadmin', jumlahRole('superadmin'), 0);

// ------------------------------------------------------------------
console.log('\n--- 3. Validasi pendaftaran ---');
tanpaSesi();
check('field kosong', G.register('', '', '', '').error, 'Semua field wajib diisi');
check('password < 8 karakter', G.register('Renang', 'Tuban', 'renang_ok', 'abc').error, 'Password minimal 8 karakter');
check('username duplikat', G.register('Renang', 'Tuban', 'bulu_tk', 'rahasia123').error, 'Username sudah digunakan');
check('username salah format', G.register('Renang', 'Tuban', 'Buru TK', 'rahasia123').error.indexOf('4-30 karakter') >= 0, true);
check('nama cabor < 3 karakter', G.register('Ba', 'Tuban', 'caborsingkat', 'rahasia123').error, 'Nama cabor minimal 3 karakter');
check('pesan validasi tidak menyebut "hanya superadmin"',
    ['Semua field wajib diisi', 'Password minimal 8 karakter', 'Username sudah digunakan']
        .every(function(m) { return m.indexOf('superadmin') < 0; }), true);
check('duplikat tidak membuat akun ganda', jumlahRole('cabor'), 2);

// ------------------------------------------------------------------
console.log('\n--- 4. Rate limit pendaftaran ---');
segarkanRate();
var hasilLoop = [];
for (var i = 1; i <= 6; i++) {
    hasilLoop.push(G.register('Cabor ' + i, 'Tuban', 'rateuser' + i, 'rahasia123').ok);
}
check('5 pendaftaran pertama berhasil', hasilLoop.slice(0, 5), [true, true, true, true, true]);
check('pendaftaran ke-6 dibatasi', hasilLoop[5], false);

G.localStorage.setItem('tes_pengukuran_register_rate', JSON.stringify({
    coba: new Array(20).fill(Date.now()), sukses: []
}));
check('batas percobaan diblokir',
    G.register('Cabor X', 'Tuban', 'ratelimit1', 'rahasia123').error,
    'Terlalu banyak percobaan daftar. Coba lagi dalam 10 menit.');
G.localStorage.setItem('tes_pengukuran_register_rate', JSON.stringify({
    coba: [Date.now()], sukses: new Array(5).fill(Date.now())
}));
check('batas akun baru diblokir',
    G.register('Cabor Y', 'Tuban', 'ratelimit2', 'rahasia123').error,
    'Batas pendaftaran tercapai. Coba lagi dalam 10 menit.');
segarkanRate();

// ------------------------------------------------------------------
console.log('\n--- 5. Login (superadmin, cabor, hash lama) ---');
tanpaSesi();
G.seedAdmin();
check('login superadmin benar', G.login('superadmin', 'admin123').ok, true);
check('login superadmin salah', G.login('superadmin', 'salah123').ok, false);
check('login cabor hasil daftar', G.login('bulu_tk', 'rahasia123').ok, true);
check('login cabor password salah', G.login('bulu_tk', 'rahasia124').ok, false);
check('jumlah superadmin = 1', jumlahRole('superadmin'), 1);
// Hash lama (sebelum upgrade) tetap bisa login
(function() {
    var db = G.loadDB();
    db.users.push({ id: 'legacy1', username: 'akunlama', password: G.hashLegacy('lawas123'),
        role: 'cabor', cabor: 'Renang', kabupaten: 'Tuban', status: 'aktif', dibuat: '2026-01-01T00:00:00.000Z' });
    G.saveDB(db);
})();
check('akun hash lama tetap bisa login', G.login('akunlama', 'lawas123').ok, true);
check('sesi terisi setelah login', !!G.currentUser(), true);

// ------------------------------------------------------------------
console.log('\n--- 5b. Normalisasi input login (lintas perangkat / keyboard HP) ---');
tanpaSesi();
check('username login di-trim + huruf kecil', G.login('  BULU_TK  ', 'rahasia123').ok, true);
check('username kapital dari auto-kapitalisasi HP tetap masuk', G.login('Bulu_Tk', 'rahasia123').ok, true);
check('password dengan spasi ekor (autofill HP) tetap masuk', G.login('bulu_tk', 'rahasia123   ').ok, true);
check('isi password yang berubah tetap ditolak', G.login('bulu_tk', ' rahasia124').ok, false);
check('pesan error spesifik: username tidak ditemukan',
    G.login('user_tidak_ada', 'apapun').error, 'Username tidak ditemukan');
check('pesan error spesifik: password salah',
    G.login('bulu_tk', 'salah_total').error, 'Password salah');
// Alasan kegagalan dicatat di console untuk debugging
var warnLog = [];
var warnAsli = console.warn;
console.warn = function(m) { warnLog.push(String(m)); };
G.login('user_tidak_ada', 'apapun');
G.login('bulu_tk', 'salah_total');
console.warn = warnAsli;
check('console mencatat username tidak ditemukan',
    warnLog.some(function(m) { return m.indexOf('[login] username') >= 0 && m.indexOf('tidak ditemukan') >= 0; }), true);
check('console mencatat password salah (username ada)',
    warnLog.some(function(m) { return m.indexOf('[login] password salah') >= 0; }), true);

// Pendaftaran: username dipangkas+lowercase, password hanya spasi ujung
segarkanRate();
var dSpasi = G.register('Sepatu Roda', 'Tuban', '  Spasi_User  ', '  rahasia1  ');
check('daftar username dipangkas + lowercase', dSpasi.ok && dSpasi.username, 'spasi_user');
check('login daftar spasi: tanpa spasi ekor', G.login('spasi_user', 'rahasia1').ok, true);
check('login daftar spasi: dengan spasi ekor', G.login('spasi_user', '  rahasia1  ').ok, true);
check('password tersimpan hash (bukan plaintext berspasi)',
    (function() {
        var u = G.loadDB().users.filter(function(x) { return x.username === 'spasi_user'; })[0];
        return String(u.password).indexOf('$sha256$v1$1000$') === 0 && String(u.password).indexOf('rahasia1') < 0;
    })(), true);
tanpaSesi();

// ------------------------------------------------------------------
console.log('\n--- 5c. Atribut input anti auto-kapitalisasi (index.html) ---');
function tagInput(id) {
    var m = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
    return m ? m[0] : '';
}
function punyaAtribut(id, daftar) {
    var tag = tagInput(id);
    return daftar.every(function(a) { return tag.indexOf(a) >= 0; });
}
check('input login username: autocomplete + anti auto-kapital/autocorrect/spellcheck',
    punyaAtribut('loginUsername', ['autocomplete="username"', 'autocapitalize="none"', 'autocorrect="off"', 'spellcheck="false"']), true);
check('input login password: autocomplete current-password + anti auto-kapital',
    punyaAtribut('loginPassword', ['autocomplete="current-password"', 'autocapitalize="none"', 'autocorrect="off"', 'spellcheck="false"']), true);
check('input daftar username: autocomplete + anti auto-kapital/autocorrect/spellcheck',
    punyaAtribut('regUsername', ['autocomplete="username"', 'autocapitalize="none"', 'autocorrect="off"', 'spellcheck="false"']), true);
check('input daftar password: autocomplete new-password + anti auto-kapital',
    punyaAtribut('regPassword', ['autocomplete="new-password"', 'autocapitalize="none"', 'autocorrect="off"', 'spellcheck="false"']), true);
check('index.html versi cache store.js (perbaikan login)',
    html.indexOf('js/store.js?v=20261022pesan') >= 0, true);

// ------------------------------------------------------------------
console.log('\n--- 6. Pengunjung TANPA login: semua tulis ditolak ---');
tanpaSesi();
check('addAtlet ditolak', G.addAtlet({ nama: 'X', cabor_nama: 'Renang' }).ok, false);
check('updateAtlet ditolak', G.updateAtlet('a1', { nama: 'X' }).ok, false);
check('hapusAtlet ditolak', G.hapusAtlet('a1').ok, false);
check('addSesi ditolak', G.addSesi({ atlet_id: 'a1', tanggal_tes: '2026-01-01' }), null);
check('updateSesi ditolak', G.updateSesi('s1', { nilai: {} }).ok, false);
check('hapusSesi ditolak', G.hapusSesi('s1').ok, false);
check('addCabor ditolak', G.addCabor('Baru').ok, false);
check('updateCabor ditolak', G.updateCabor('c1', { items: [] }).ok, false);
check('hapusCabor ditolak', G.hapusCabor('c1').ok, false);
check('addItemCustom ditolak', G.addItemCustom('Baru', 'detik').ok, false);
(function() {
    var sebelum = G.loadDB().atlet.length;
    G.hapusSemuaAtlet();
    check('hapusSemuaAtlet ditolak', G.loadDB().atlet.length, sebelum);
})();
check('bolehTulisCabor pengunjung = false', G.bolehTulisCabor('Renang'), false);

// ------------------------------------------------------------------
console.log('\n--- 7. Superadmin: akses tulis penuh ---');
loginSebagai('superadmin');
check('canWrite superadmin', G.canWrite(), true);
check('bolehTulisCabor superadmin', G.bolehTulisCabor('Renang'), true);
var aSA1 = G.addAtlet({ nama: 'Atlet Renang SA', jenis_kelamin: 'Laki-laki', cabor_nama: 'Renang' });
var aSA2 = G.addAtlet({ nama: 'Atlet Bulu SA', jenis_kelamin: 'Perempuan', cabor_nama: 'Bulu Tangkis' });
check('superadmin addAtlet', !!(aSA1.id && aSA2.id), true);
check('superadmin addSesi', !!G.addSesi({ atlet_id: aSA1.id, tanggal_tes: '2026-10-22', nilai: {} }).id, true);
var cRenang = G.findCaborByNama('Renang', 'Tuban');
check('superadmin updateCabor (kode akses)', G.updateCabor(cRenang.id, { kode_akses: 'BARU123' }).ok, true);
check('kode akses tersimpan', G.findCabor(cRenang.id).kode_akses, 'BARU123');
check('superadmin addItemCustom', G.addItemCustom('Item SA', 'detik').ok, true);
var cTmp = G.addCabor('Cabor Temporary');
check('superadmin addCabor', !!cTmp.id, true);
check('superadmin hapusCabor', G.hapusCabor(cTmp.id).ok, true);
G.hapusSemuaAtlet();
check('superadmin hapusSemuaAtlet', G.loadDB().atlet.length, 0);
// Siapkan data lintas cabor untuk uji scoping user cabor
G.addAtlet({ nama: 'Atlet Bulu SA', jenis_kelamin: 'Perempuan', cabor_nama: 'Bulu Tangkis' });

// ------------------------------------------------------------------
console.log('\n--- 8. User cabor: tulis terbatas pada cabor miliknya ---');
loginSebagai('cabor', 'Renang');
check('canWrite cabor = false', G.canWrite(), false);
check('bolehTulisCabor sendiri = true', G.bolehTulisCabor('Renang'), true);
check('bolehTulisCabor cabor lain = false', G.bolehTulisCabor('Bulu Tangkis'), false);

check('daftar atlet user cabor hanya cabornya', G.listAtlet().map(function(a) { return a.cabor_nama; }), []);
check('data cabor lain tetap ada di DB', G.loadDB().atlet.length, 1);

var aCabor = G.addAtlet({ nama: 'Atlet Cabor', jenis_kelamin: 'Perempuan', cabor_nama: 'Renang' });
check('cabor menambah atlet sendiri', !!aCabor.id, true);
check('cabor ditolak menambah atlet cabor lain', G.addAtlet({ nama: 'X', cabor_nama: 'Bulu Tangkis' }).ok, false);
check('cabor mengubah atlet sendiri', G.updateAtlet(aCabor.id, { nama: 'Atlet Cabor Diubah' }).ok, true);
check('cabor tidak bisa memindahkan atlet', G.updateAtlet(aCabor.id, { cabor_nama: 'Bulu Tangkis' }).ok, false);
check('cabor menambah sesi atlet sendiri', !!G.addSesi({ atlet_id: aCabor.id, tanggal_tes: '2026-10-22', nilai: {} }).id, true);
check('cabor mengedit sesi atlet sendiri', G.updateSesi(G.listSesi(aCabor.id)[0].id, { nilai: { 'Sprint 20 m': 3.2 } }).ok, true);
check('daftar atlet scoping ke cabor sendiri',
    G.listAtlet().map(function(a) { return a.cabor_nama; }), ['Renang']);
check('cabor tidak bisa hapus semua atlet', (function() {
    var sebelum = G.loadDB().atlet.length;
    G.hapusSemuaAtlet();
    return G.loadDB().atlet.length;
})(), 2);

check('cabor mengatur item cabornya sendiri', G.updateCabor(cRenang.id, { items: ['Sprint 20 m'] }).ok, true);
check('cabor tidak bisa ubah kode akses', G.updateCabor(cRenang.id, { kode_akses: 'BONGKAR' }).ok, false);
check('cabor tidak bisa ubah nama/kabupaten', G.updateCabor(cRenang.id, { nama: 'Renang Indah' }).ok, false);
check('kode akses tetap milik superadmin', G.findCabor(cRenang.id).kode_akses, 'BARU123');
check('cabor tidak bisa tambah cabor baru', G.addCabor('Cabor Baru Lagi').ok, false);
check('cabor tidak bisa hapus cabor', G.hapusCabor(cRenang.id).ok, false);
check('cabor boleh tambah master item (PRD 5.4)', G.addItemCustom('Item Cabor', 'detik').ok, true);
check('cabor menghapus atlet sendiri', G.hapusAtlet(aCabor.id).ok, true);
check('cabor ditolak hapus atlet cabor lain',
    G.hapusAtlet(G.loadDB().atlet.filter(function(a) { return a.cabor_nama === 'Bulu Tangkis'; })[0].id).ok, false);

// ------------------------------------------------------------------
console.log('\n--- 9. Pengecekan UI (app.js / index.html) ---');
check('register() di store.js tanpa guard canWrite', /function register\([\s\S]{0,160}canWrite\(/.test(storeJs), false);
check('register() tidak menampilkan pesan "hanya superadmin"',
    storeJs.indexOf('function register(') >= 0 &&
    storeJs.slice(storeJs.indexOf('function register('), storeJs.indexOf('function generateKode'))
        .indexOf('hanya superadmin') < 0, true);
check('register() memaksa role cabor', storeJs.indexOf("role: 'cabor', cabor: cabor, kabupaten: kabupaten") >= 0, true);
check('register() menolak duplikat dgn pesan benar', storeJs.indexOf("error: 'Username sudah digunakan'") >= 0, true);
check('register() punya rate limit', storeJs.indexOf('RATE_DAFTAR_MAX_COBA') >= 0 && storeJs.indexOf('RATE_DAFTAR_MAX_SUKSES') >= 0, true);
check('doRegister menutup modal daftar', appJs.indexOf("closeModal('modalRegister')") >= 0, true);
check('doRegister membuka modal login', appJs.indexOf("openModal('modalLogin')") >= 0, true);
check('doRegister menampilkan pesan sukses', appJs.indexOf('Pendaftaran berhasil!') >= 0, true);
check('doRegister punya penanganan koneksi gagal', appJs.indexOf('Koneksi gagal') >= 0, true);
check('index.html punya pesan sukses login', html.indexOf('id="loginInfo"') >= 0, true);
check('index.html punya pesan error daftar', html.indexOf('id="regError"') >= 0, true);
check('menu user cabor: Dashboard tampil, Daftar Atlet & Cabor disembunyikan',
    appJs.indexOf("document.getElementById('navDashboard').style.display = (isAdmin || isCabor) ? '' : 'none';") >= 0 &&
    appJs.indexOf("document.getElementById('navAtlet').style.display = isAdmin ? '' : 'none';") >= 0 &&
    appJs.indexOf("document.getElementById('navCaborItem').style.display = isAdmin ? '' : 'none';") >= 0, true);
check('menu Kode Akses & Norma khusus superadmin',
    appJs.indexOf("document.getElementById('navAkses').style.display = isAdmin ? '' : 'none';") >= 0 &&
    appJs.indexOf("document.getElementById('navNorma').style.display = isAdmin ? '' : 'none';") >= 0, true);
check('menu diblokir utk user cabor = atlet, caboritem, akses, norma, sinkron',
    (appJs.match(/\['atlet', 'caboritem', 'akses', 'norma', 'sinkron'\]/g) || []).length, 2);
check('akses atlet/caboritem utk user cabor diarahkan ke Dashboard',
    appJs.indexOf("u.role === 'cabor' ? '#admin/dashboard' : '#admin/hasil-publik'") >= 0 &&
    appJs.indexOf("showAdminView(u.role === 'cabor' ? 'dashboard' : 'hasil-publik')") >= 0, true);
check('login user cabor langsung membuka Dashboard',
    appJs.indexOf("} else if (isCabor) {\n        // User cabor: halaman pertama yang dibuka adalah Dashboard\n        showAdminView('dashboard');") >= 0, true);
check('menu diblokir utk tamu tetap lengkap (2 tempat)',
    (appJs.match(/'atlet', 'dashboard', 'caboritem', 'akses', 'norma', 'sinkron'/g) || []).length, 2);
check('sync data tetap khusus superadmin',
    appJs.indexOf("document.getElementById('navSinkron').style.display = isAdmin ? '' : 'none';") >= 0, true);
check('hapus semua atlet tetap khusus superadmin',
    /function hapusSemuaAtletConfirm\(\) \{[\s\S]{0,160}if \(!isAdmin\(\)\) return alert\('Hanya Superadmin'\);/.test(appJs), true);
check('tambah cabor tetap khusus superadmin',
    /function tambahCabor\(\) \{[\s\S]{0,160}if \(!isAdmin\(\)\) return alert\('Hanya Superadmin'\);/.test(appJs), true);
check('ubah kode akses khusus superadmin', /function ubahKode\(id\) \{\s*if \(!isAdmin\(\)\) return;/.test(appJs), true);
check('template rekomendasi tetap khusus superadmin', appJs.indexOf('function simpanTemplateItem') >= 0 &&
    /function simpanTemplateItem\(\) \{\s*if \(!canWrite\(\)\)/.test(appJs), true);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');
process.exit(fail > 0 ? 1 : 0);

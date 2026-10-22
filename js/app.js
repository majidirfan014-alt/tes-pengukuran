// =====================================================================
// app.js — Render UI, routing, interaksi
// =====================================================================
'use strict';

// --- Chart instances ---
var charts = {};

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
    seedAdmin();
    muatNormaDariJSON(function(ok) {
        if (!ok) console.warn('Norma JSON gagal dimuat');
        initApp();
    });
});

function initApp() {
    fillBleepOptions();
    buildRastRows();
    updateLandingStats();
    renderPublicCabor();
    // Load template rekomendasi
    fetch('data/rekomendasi-template.json').then(function(r) { return r.json(); }).then(function(j) {
        window.__REKOMENDASI_JSON = j;
        if (!localStorage.getItem('rekomendasi_template_v1')) {
            try { localStorage.setItem('rekomendasi_template_v1', JSON.stringify(j)); } catch (e) {}
        }
        // Reset cache agar data baru terbaca
        REKOMENDASI_TEMPLATE_CACHE = null;
        // Re-render jika sedang di halaman rekomendasi
        if (document.getElementById('rekHasil') && !document.getElementById('view-rekomendasi').classList.contains('hidden')) {
            renderRekomendasi();
        }
    }).catch(function() {});
    // Cek sesi
    var u = currentUser();
    if (u) {
        showPanel();
    } else {
        document.getElementById('landingPage').classList.remove('hidden');
    }
    // Hash routing: cek akses langsung ke URL
    handleHashRoute();
    window.addEventListener('hashchange', handleHashRoute);
}

function handleHashRoute() {
    var hash = location.hash.replace('#', '');
    if (!hash || hash.indexOf('admin/') !== 0) return;
    var view = hash.replace('admin/', '');
    var u = currentUser();
    if (!u) {
        document.getElementById('landingPage').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        openModal('modalLogin');
        return;
    }
    if (u.role !== 'superadmin') {
        // User cabor: hanya Kode Akses Cabor, Norma Tes & Sinkron yang diblokir.
        // Role lain (tamu): seluruh menu admin diblokir (read-only dari landing page).
        var blokir = (u.role === 'cabor')
            ? ['akses', 'norma', 'sinkron']
            : ['atlet', 'dashboard', 'caboritem', 'akses', 'norma', 'sinkron'];
        if (blokir.indexOf(view) >= 0) {
            location.hash = u.role === 'cabor' ? '#admin/atlet' : '#admin/hasil-publik';
            showPanel();
            return;
        }
    }
    showPanel();
    showAdminView(view);
}

// =====================================================================
// NAVIGASI LANDING
// =====================================================================
function showSection(name) {
    document.querySelectorAll('.landing-section').forEach(function(s) { s.classList.add('hidden'); });
    var el = document.getElementById('sec-' + name);
    if (el) el.classList.remove('hidden');
    if (name === 'statistik') renderStatistikChart();
    if (name === 'hasil') renderHasilChart();
    if (name === 'cabor') renderPublicCabor();
}

function updateLandingStats() {
    var db = loadDB();
    var jmlSesi = db.sesi.length;
    var jmlAtlet = db.atlet.length;
    var jmlCabor = db.cabor.length;
    ['heroAtlet', 'statAtlet'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.textContent = jmlAtlet;
    });
    ['heroCabor', 'statCabor'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.textContent = jmlCabor;
    });
    ['heroSesi', 'statSesi'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.textContent = jmlSesi;
    });
}

// =====================================================================
// CHART LANDING
// =====================================================================
function renderStatistikChart() {
    var db = loadDB();
    var perTanggal = {};
    db.sesi.forEach(function(s) {
        var t = s.tanggal_tes || 'Lainnya';
        perTanggal[t] = (perTanggal[t] || 0) + 1;
    });
    var labels = Object.keys(perTanggal).sort();
    var data = labels.map(function(l) { return perTanggal[l]; });
    if (charts.statistik) charts.statistik.destroy();
    var ctx = document.getElementById('chartStatistik');
    if (!ctx) return;
    charts.statistik = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Atlet Dites', data: data, backgroundColor: '#3b82f6' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function renderHasilChart() {
    var db = loadDB();
    var dist = { 'Baik Sekali': 0, 'Baik': 0, 'Cukup': 0, 'Kurang': 0, 'Kurang Sekali': 0 };
    var totalPct = 0, cnt = 0;
    db.sesi.forEach(function(s) {
        var ev = evalSesi(s);
        if (ev) {
            if (ev.kategori) dist[ev.kategori] = (dist[ev.kategori] || 0) + 1;
            totalPct += ev.performa;
            cnt++;
        }
    });
    var rata = cnt > 0 ? Math.round(totalPct / cnt * 10) / 10 : 0;
    var el = document.getElementById('statRataRata');
    if (el) el.textContent = rata + '%';

    if (charts.distribusi) charts.distribusi.destroy();
    var ctx = document.getElementById('chartDistribusi');
    if (!ctx) return;
    charts.distribusi = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dist),
            datasets: [{
                data: Object.values(dist),
                backgroundColor: ['#059669', '#2563eb', '#d97706', '#ea580c', '#dc2626']
            }]
        },
        options: { responsive: true }
    });
}

function renderPublicCabor() {
    var q = ((document.getElementById('searchCabor') || {}).value || '').toLowerCase();
    var list = listCabor().filter(function(c) { return !q || c.nama.toLowerCase().indexOf(q) >= 0; });
    var el = document.getElementById('publicCaborList');
    if (!el) return;
    el.innerHTML = list.map(function(c) {
        return '<div class="card cursor-pointer hover:shadow-lg transition-shadow" onclick="askCaborAkses(\'' + c.id + '\')">' +
            '<div class="card-body">' +
            '<p class="font-bold">' + escHtml(c.nama) + '</p>' +
            '<p class="text-sm text-slate-500">' + escHtml(c.kabupaten || '-') + '</p>' +
            '</div></div>';
    }).join('') || '<p class="text-slate-400">Belum ada cabor terdaftar</p>';
}

function askCaborAkses(id) {
    var kode = prompt('Masukkan Kode Akses Cabor:');
    if (!kode) return;
    var c = findCabor(id);
    if (!c) return;
    if (cekBatasanAkses(id)) return alert('Terlalu banyak percobaan salah. Coba lagi dalam 10 menit.');
    if (kode.trim() !== c.kode_akses) {
        logAkses(id, false);
        return alert('Kode akses salah');
    }
    logAkses(id, true);
    openCaborView(id);
}

function openCaborView(id) {
    var c = findCabor(id);
    if (!c) return;
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('caborView').classList.remove('hidden');
    document.getElementById('caborViewNama').textContent = c.nama + ' — ' + (c.kabupaten || '');
    renderCaborViewTable();
}

function closeCaborView() {
    document.getElementById('caborView').classList.add('hidden');
    document.getElementById('landingPage').classList.remove('hidden');
}

function renderCaborViewTable() {
    var nama = document.getElementById('caborViewNama').textContent.split(' — ')[0];
    var q = ((document.getElementById('cvSearch') || {}).value || '').toLowerCase();
    var atlet = loadDB().atlet.filter(function(a) {
        return a.cabor_nama === nama && (!q || a.nama.toLowerCase().indexOf(q) >= 0);
    });
    var el = document.getElementById('cvTableBody');
    if (!el) return;
    el.innerHTML = atlet.map(function(a, i) {
        var sesi = listSesi(a.id);
        var ev = sesi.length ? evalSesi(sesi[0]) : null;
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td class="font-semibold">' + escHtml(a.nama) + '</td>' +
            '<td>' + hitungUsia(a.tanggal_lahir) + '</td>' +
            '<td>' + escHtml(a.jenis_kelamin) + '</td>' +
            '<td>' + (sesi.length ? sesi[0].tanggal_tes : '-') + '</td>' +
            '<td>' + (ev ? ev.performa + '%' : '-') + '</td>' +
            '<td><button onclick="showDetailSesi(\'' + (sesi.length ? sesi[0].id : '') + '\')" class="btn btn-outline btn-sm">Detail</button></td>' +
            '</tr>';
    }).join('');
    document.getElementById('cvAtlet').textContent = atlet.length;
    document.getElementById('cvSesi').textContent = atlet.reduce(function(t, a) { return t + listSesi(a.id).length; }, 0);
    document.getElementById('cvItem').textContent = (findCaborByNama(nama) || {}).items ? findCaborByNama(nama).items.length : 0;
}

// =====================================================================
// AUTH
// =====================================================================
function doLogin() {
    var u = document.getElementById('loginUsername').value;
    var p = document.getElementById('loginPassword').value;
    var info = document.getElementById('loginInfo');
    var r;
    try {
        r = login(u, p);
    } catch (e) {
        r = { ok: false, error: 'Koneksi gagal. Coba lagi.' };
    }
    if (!r.ok) {
        var el = document.getElementById('loginError');
        el.textContent = r.error;
        el.classList.remove('hidden');
        if (info) info.classList.add('hidden');
        return;
    }
    if (info) info.classList.add('hidden');
    closeModal('modalLogin');
    showPanel();
}

function doRegister() {
    var errEl = document.getElementById('regError');
    errEl.textContent = '';
    errEl.classList.add('hidden');

    var cabor = document.getElementById('regCabor').value;
    var kabupaten = document.getElementById('regKabupaten').value;
    var username = document.getElementById('regUsername').value;
    var password = document.getElementById('regPassword').value;

    var r;
    try {
        // Pendaftaran publik: tidak perlu login. Role selalu dipaksa 'cabor'
        // di store.register() (field role klien tidak pernah dipercaya).
        r = register(cabor, kabupaten, username, password);
    } catch (e) {
        errEl.textContent = 'Koneksi gagal atau penyimpanan data tidak tersedia. Coba lagi.';
        errEl.classList.remove('hidden');
        return;
    }

    if (!r.ok) {
        errEl.textContent = r.error || 'Pendaftaran gagal. Coba lagi.';
        errEl.classList.remove('hidden');
        return;
    }

    // Sukses: bersihkan form, tutup modal daftar, buka modal Login + pesan sukses
    ['regCabor', 'regKabupaten', 'regUsername', 'regPassword'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    closeModal('modalRegister');
    openModal('modalLogin');

    var info = document.getElementById('loginInfo');
    if (info) {
        info.textContent = 'Pendaftaran berhasil! Akun "' + (r.username || username) + '" untuk cabor ' +
            (r.cabor || cabor) + ' siap digunakan. Silakan login.';
        info.classList.remove('hidden');
    }
    var loginErr = document.getElementById('loginError');
    if (loginErr) {
        loginErr.textContent = '';
        loginErr.classList.add('hidden');
    }
    var lu = document.getElementById('loginUsername');
    if (lu) lu.value = r.username || username;
    var lp = document.getElementById('loginPassword');
    if (lp) { lp.value = ''; lp.focus(); }
}

function logout() {
    // Hapus sesi dari store
    var fnLogout = (typeof window !== 'undefined' && window.storeLogout) ? window.storeLogout : null;
    // Panggil logout dari store.js (fungsi global)
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('tes_pengukuran_session');
    }
    // Bersihkan tampilan
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('landingPage').classList.remove('hidden');
    // Cegah tombol Back browser membuka halaman admin
    try {
        history.pushState(null, '', location.href);
        window.onpopstate = function() {
            history.pushState(null, '', location.href);
            if (!localStorage.getItem('tes_pengukuran_session')) {
                document.getElementById('adminPanel').classList.add('hidden');
                document.getElementById('landingPage').classList.remove('hidden');
            }
        };
    } catch (e) {}
    updateLandingStats();
}

function showPanel() {
    navHistory = [];
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    var u = currentUser();
    var roleLabel = u.role === 'superadmin' ? 'Superadmin' : 'User Cabor';
    document.getElementById('adminUserInfo').textContent = (u.username || '') + ' — ' + roleLabel;
    var isAdmin = u.role === 'superadmin';
    var isCabor = u.role === 'cabor';
    // Menu yang boleh dilihat user cabor: Daftar Atlet, Dashboard, Cabor & Item Tes
    var bolehMenuCabor = isAdmin || isCabor;
    document.getElementById('navAtlet').style.display = bolehMenuCabor ? '' : 'none';
    document.getElementById('navDashboard').style.display = bolehMenuCabor ? '' : 'none';
    document.getElementById('navCaborItem').style.display = bolehMenuCabor ? '' : 'none';
    // Khusus superadmin (tidak ditampilkan & tidak bisa ditulis user cabor)
    document.getElementById('navAkses').style.display = isAdmin ? '' : 'none';
    document.getElementById('navNorma').style.display = isAdmin ? '' : 'none';
    document.getElementById('navSinkron').style.display = isAdmin ? '' : 'none';
    document.getElementById('btnHapusSemua').style.display = isAdmin ? '' : 'none';
    document.getElementById('cardTambahCabor').style.display = isAdmin ? '' : 'none';
    // Menu publik (non-superadmin)
    document.getElementById('navComparison').style.display = '';
    document.getElementById('navHasilPublik').style.display = isAdmin ? 'none' : '';
    document.getElementById('navRekomendasi').style.display = '';
    // Default view
    if (isAdmin) {
        showAdminView('atlet');
    } else {
        showAdminView('hasil-publik');
    }
}

// =====================================================================
// NAVIGASI & TOMBOL KEMBALI
// =====================================================================
var navHistory = [];

function navKembali() {
    if (navHistory.length > 1) {
        navHistory.pop(); // hapus halaman saat ini
        var prev = navHistory.pop(); // ambil halaman sebelumnya
        showAdminView(prev);
    } else {
        // Tidak ada riwayat -> ke halaman utama (landing page)
        logout();
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('landingPage').classList.remove('hidden');
    }
}

function updateTombolKembali(currentView) {
    var btn = document.getElementById('btnKembali');
    if (!btn) return;
    var u = currentUser();
    if (!u || u.role === 'superadmin') {
        btn.classList.add('hidden');
        return;
    }
    // Selalu tampil untuk non-superadmin
    btn.classList.remove('hidden');
}

// =====================================================================
// ADMIN NAV
// =====================================================================
function showAdminView(name) {
    var u = currentUser();
    // Pastikan user sudah login
    if (!u) {
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('landingPage').classList.remove('hidden');
        openModal('modalLogin');
        return;
    }
    // Blokir menu khusus superadmin (dan menu admin untuk tamu)
    if (u.role !== 'superadmin') {
        // User cabor: Kode Akses Cabor, Norma Tes & Sinkron tidak bisa dibuka.
        // Role lain (tamu): seluruh menu admin diblokir.
        var blokir = (u.role === 'cabor')
            ? ['akses', 'norma', 'sinkron']
            : ['atlet', 'dashboard', 'caboritem', 'akses', 'norma', 'sinkron'];
        if (blokir.indexOf(name) >= 0) {
            showAdminView(u.role === 'cabor' ? 'atlet' : 'hasil-publik');
            return;
        }
    }
    document.querySelectorAll('.admin-view').forEach(function(v) { v.classList.add('hidden'); });
    var el = document.getElementById('view-' + name);
    if (el) el.classList.remove('hidden');
    document.querySelectorAll('#adminNav .nav-admin').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-view') === name);
    });
    // Track navigation history (hindari duplikat berurutan)
    if (navHistory[navHistory.length - 1] !== name) {
        navHistory.push(name);
        if (navHistory.length > 20) navHistory.shift();
    }
    updateTombolKembali(name);
    // Render
    if (name === 'atlet') { renderAtletList(); renderCaborOptions(); }
    if (name === 'dashboard') renderDashboard();
    if (name === 'comparison') renderComparison();
    if (name === 'caboritem') renderCaborItem();
    if (name === 'akses') renderAkses();
    if (name === 'norma') { renderNormaTable(); renderRumusKartu(); renderKeteranganSumber(); }
    if (name === 'sinkron' && typeof renderSinkron === 'function') renderSinkron();
    if (name === 'hasil-publik') renderHasilPublik();
    if (name === 'rekomendasi') {
        // Tab visibility
        var isAdmin = u.role === 'superadmin';
        document.getElementById('rekTabNav').classList.toggle('hidden', !isAdmin);
        if (isAdmin) {
            switchRekTab('atlet');
        } else {
            document.getElementById('rekTabAtletContent').classList.remove('hidden');
            document.getElementById('rekTabTemplateContent').classList.add('hidden');
        }
        populateRekAtlet();
        renderRekomendasi();
    }
    // Sync hash URL (tanpa memicu hashchange loop)
    if (location.hash !== '#admin/' + name) {
        history.replaceState(null, '', '#admin/' + name);
    }
}

// =====================================================================
// DAFTAR ATLET
// =====================================================================
function renderAtletList() {
    var q = ((document.getElementById('searchAtlet') || {}).value || '').toLowerCase();
    var list = listAtlet().filter(function(a) { return !q || a.nama.toLowerCase().indexOf(q) >= 0; });
    var el = document.getElementById('atletTableBody');
    if (!el) return;
    el.innerHTML = list.map(function(a, i) {
        var sesi = listSesi(a.id);
        var ev = sesi.length ? evalSesi(sesi[0]) : null;
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td class="font-semibold">' + escHtml(a.nama) + '</td>' +
            '<td>' + escHtml(a.tempat_lahir || '-') + ', ' + (a.tanggal_lahir || '-') + '</td>' +
            '<td>' + escHtml(a.cabor_nama) + '</td>' +
            '<td>' + hitungUsia(a.tanggal_lahir) + '</td>' +
            '<td>' + escHtml(a.jenis_kelamin) + '</td>' +
            '<td>' + sesi.length + '</td>' +
            '<td>' + (ev ? ev.performa + '%' : '-') + '</td>' +
            '<td>' + (ev ? '<span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span>' : '-') + '</td>' +
            '<td class="whitespace-nowrap">' +
            '<button onclick="showDetailSesi(\'' + (sesi.length ? sesi[0].id : '') + '\')" class="btn btn-outline btn-sm">Detail</button> ' +
            '<button onclick="editAtlet(\'' + a.id + '\')" class="btn btn-primary btn-sm">Edit</button> ' +
            '<button onclick="hapusAtletConfirm(\'' + a.id + '\')" class="btn btn-danger btn-sm">Hapus</button>' +
            '</td></tr>';
    }).join('');
    document.getElementById('atletKosong').classList.toggle('hidden', list.length > 0);
}

function showAllAtlet() {
    document.getElementById('searchAtlet').value = '';
    renderAtletList();
}

function hapusSemuaAtletConfirm() {
    if (!canWrite()) return alert('Akses ditolak');
    if (!isAdmin()) return alert('Hanya Superadmin');
    if (!confirm('HAPUS SEMUA data atlet? Tindakan ini tidak bisa dibatalkan.')) return;
    if (!confirm('Konfirmasi kedua: Yakin ingin menghapus SEMUA data atlet?')) return;
    hapusSemuaAtlet();
    renderAtletList();
}

function hapusAtletConfirm(id) {
    var a = findAtlet(id);
    if (!a) return alert('Atlet tidak ditemukan');
    if (!bolehTulisCabor(a.cabor_nama)) return alert('Akses ditolak: hanya superadmin atau pemilik data yang dapat menghapus data');
    if (!confirm('Hapus atlet ini beserta semua riwayat tes?')) return;
    hapusAtlet(id);
    renderAtletList();
}

// =====================================================================
// FORM ATLET
// =====================================================================
var formMode = 'baru';
var idAtletEdit = null;          // mode edit: atlet yang diubah (null = tambah baru)
var idSesiEdit = null;           // mode edit: sesi tes yang diubah
var evalAtletSaatIni = null;     // atlet pada panel Hasil Evaluasi yang sedang tampil
var evalSesiSaatIni = null;      // sesi pada panel Hasil Evaluasi yang sedang tampil
var rastDataForm = null;         // data mentah RAST (berat + 6 waktu) dari kalkulator

function setLabelFormEdit(editing) {
    var judul = document.getElementById('formJudul');
    if (judul) judul.textContent = editing ? 'Form Ubah Data Atlet & Tes' : 'Form Tambah Atlet Baru';
    var btn = document.getElementById('btnSimpanAtlet');
    if (btn) btn.textContent = editing ? 'Simpan Perubahan' : 'Simpan Atlet';
}

function openFormAtlet() {
    idAtletEdit = null;
    idSesiEdit = null;
    rastDataForm = null;
    setLabelFormEdit(false);
    document.getElementById('formAtlet').classList.remove('hidden');
    renderCaborOptions();
    updateItemTes();
    updateUsia();
}

function setFormMode(mode) {
    formMode = mode;
    document.getElementById('modeBaru').classList.toggle('active', mode === 'baru');
    document.getElementById('modeLama').classList.toggle('active', mode === 'lama');
}

function renderCaborOptions() {
    var sel = document.getElementById('fCabor');
    if (!sel) return;
    var list = listCaborScope();
    sel.innerHTML = '<option value="">Pilih Cabor...</option>' +
        list.map(function(c) { return '<option>' + escHtml(c.nama) + '</option>'; }).join('');
}

function updateUsia() {
    var lahir = document.getElementById('fLahir').value;
    if (lahir) {
        document.getElementById('fUsia').value = hitungUsia(lahir);
    }
}

function updateIMTDariForm() {
    var t = document.getElementById('fTinggi').value;
    var b = document.getElementById('fBerat').value;
    var imt = hitungIMT(b, t);
    if (imt === null) {
        document.getElementById('fIMT').value = '';
        return;
    }
    var lahir = document.getElementById('fLahir').value;
    var tglTes = document.getElementById('fTglTes').value || undefined;
    var k = kategoriIMT(imt, hitungUsia(lahir, tglTes));
    document.getElementById('fIMT').value = imt +
        (k.label ? ' (' + k.label + ')' : '') +
        (k.catatan ? ' — ' + k.catatan : '');
}

function updateItemTes() {
    var caborNama = document.getElementById('fCabor').value;
    var c = findCaborByNama(caborNama);
    var items = (c && c.items) ? c.items : defaultItemsForCabor(caborNama);
    var el = document.getElementById('testFields');
    if (!el) return;
    el.innerHTML = items.filter(function(n) {
        return n !== '% Performance' && n !== 'Tinggi Badan' && n !== 'Berat Badan' && n !== 'IMT';
    }).map(function(n) {
        var sat = satuanItem(n);
        var isBleep = itemKey(n).indexOf('bleep') >= 0;
        if (isDurasiItem(n)) {
            return '<div data-durasi-group="' + escHtml(n) + '">' +
                '<label class="form-label">' + escHtml(n) + ' (menit : detik)</label>' +
                '<div class="flex items-center gap-1">' +
                '<input data-test="' + escHtml(n) + '-menit" type="number" min="0" max="59" step="1" class="form-input" placeholder="0" style="width:70px" oninput="validasiDurasiInput(this)">' +
                '<span class="text-slate-500 font-bold">:</span>' +
                '<input data-test="' + escHtml(n) + '-detik" type="number" min="0" max="59.99" step="0.01" class="form-input" placeholder="0" style="width:70px" oninput="validasiDurasiInput(this)">' +
                '</div>' +
                '<p class="text-red-600 text-xs mt-1 hidden" data-durasi-error="' + escHtml(n) + '"></p>' +
                '</div>';
        }
        var isVJ = itemKey(n) === 'vertical jump';
        return '<div>' +
            '<label class="form-label">' + escHtml(n) + (sat ? ' (' + sat + ')' : '') + '</label>' +
            '<input data-test="' + escHtml(n) + '" type="number" step="' + (isVJ ? '0.01' : 'any') +
            '" class="form-input" placeholder="' + (isBleep ? 'cth: 5.3' : (isVJ ? 'cth: 0.45' : '')) + '"' +
            (isVJ ? ' oninput="peringatanNilaiTidakWajar(this)"' : '') + '>' +
            (isVJ ? '<p class="text-amber-600 text-xs mt-1 hidden" data-vj-wajar></p>' : '') +
            '</div>';
    }).join('');
}

function peringatanNilaiTidakWajar(inp) {
    var pesan = inp.parentNode ? inp.parentNode.querySelector('[data-vj-wajar]') : null;
    if (!pesan) return;
    var v = parseAngkaDesimal(inp.value);
    // Satuan input meter: lompatan manusia wajar 0,1 - 1,5 m
    if (!isNaN(v) && v > 0 && (v < 0.1 || v > 1.5)) {
        pesan.textContent = 'Nilai tidak wajar untuk lompat vertikal (rentang wajar 0,1 - 1,5 m) - periksa kembali input.';
        pesan.classList.remove('hidden');
    } else {
        pesan.textContent = '';
        pesan.classList.add('hidden');
    }
}

function validasiDurasiInput(inp) {
    var group = inp.closest('[data-durasi-group]');
    if (!group) return;
    var nama = group.getAttribute('data-durasi-group');
    var menitInp = group.querySelector('[data-test$="-menit"]');
    var detikInp = group.querySelector('[data-test$="-detik"]');
    var errEl = group.querySelector('[data-durasi-error]');
    if (!errEl) return;
    var mVal = menitInp ? menitInp.value : '';
    var dVal = detikInp ? detikInp.value : '';
    // Jika keduanya kosong, tidak ada error (item belum diisi)
    if (mVal === '' && dVal === '') {
        errEl.textContent = '';
        errEl.classList.add('hidden');
        return;
    }
    var r = hitungTotalDurasi(mVal, dVal);
    if (!r.ok) {
        errEl.textContent = r.error;
        errEl.classList.remove('hidden');
    } else {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
}

function simpanAtlet() {
    var nama = document.getElementById('fNama').value.trim();
    if (!nama) return alert('Nama atlet wajib diisi');
    var kelamin = document.getElementById('fKelamin').value;
    if (!kelamin) return alert('Jenis kelamin wajib diisi');
    var cabor = document.getElementById('fCabor').value;
    if (!cabor) return alert('Cabor wajib dipilih');
    // Superadmin bebas; user cabor hanya untuk cabornya sendiri; tamu ditolak
    if (!bolehTulisCabor(cabor)) return alert('Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data');

    // Cegah atlet duplikat: nama + lahir + cabor sama saat mode "baru"
    // → tawarkan perbarui atlet & sesi tes terakhir yang sudah ada.
    if (!idAtletEdit) {
        var lahirIni = document.getElementById('fLahir').value;
        var kembar = listAtlet().filter(function(x) {
            return x.nama === nama && x.cabor_nama === cabor && (x.tanggal_lahir || '') === (lahirIni || '');
        })[0];
        if (kembar && confirm('Atlet "' + nama + '" pada ' + cabor + ' sudah ada di data.\n\n' +
            'OK = PERBARUI atlet & sesi tes terakhir yang sudah ada (tanpa duplikat)\n' +
            'Batal = tetap buat atlet baru')) {
            idAtletEdit = kembar.id;
            var slKembar = listSesi(kembar.id);
            idSesiEdit = slKembar.length > 0 ? slKembar[0].id : null;
            setLabelFormEdit(true);
            // Pertahankan tanggal tes lama bila user belum mengisi tanggal
            if (!document.getElementById('fTglTes').value && slKembar.length > 0) {
                document.getElementById('fTglTes').value = slKembar[0].tanggal_tes || '';
            }
            return simpanAtlet(); // ulangi dengan mode edit aktif
        }
    }

    var nilai = {};
    var adaError = false;

    // Baca input durasi (menit:detik) untuk Stork Stand & Wall Sit
    document.querySelectorAll('[data-durasi-group]').forEach(function(group) {
        var namaItem = group.getAttribute('data-durasi-group');
        var menitInp = group.querySelector('[data-test$="-menit"]');
        var detikInp = group.querySelector('[data-test$="-detik"]');
        var errEl = group.querySelector('[data-durasi-error]');
        var mVal = menitInp ? menitInp.value.trim() : '';
        var dVal = detikInp ? detikInp.value.trim() : '';
        if (mVal === '' && dVal === '') return; // belum diisi
        var r = hitungTotalDurasi(mVal, dVal);
        if (!r.ok) {
            if (errEl) {
                errEl.textContent = r.error;
                errEl.classList.remove('hidden');
            }
            adaError = true;
        } else {
            if (errEl) {
                errEl.textContent = '';
                errEl.classList.add('hidden');
            }
            nilai[namaItem] = r.total;
        }
    });

    // Baca input biasa (skip input durasi yang sudah diproses)
    document.querySelectorAll('#testFields [data-test]').forEach(function(inp) {
        var key = inp.getAttribute('data-test');
        // Skip input durasi (sudah diproses di atas)
        if (key.endsWith('-menit') || key.endsWith('-detik')) return;
        var v = inp.value.trim();
        if (v !== '') nilai[key] = parseFloat(v);
    });

    if (adaError) return alert('Perbaiki error pada input menit:detik terlebih dahulu');

    // Tinggi & Berat Badan (tidak dinilai, tidak ikut performa) — simpan ke sesi tes
    var tVal = document.getElementById('fTinggi').value.trim();
    var bVal = document.getElementById('fBerat').value.trim();
    if (tVal !== '') {
        var tN = parseAngkaDesimal(tVal);
        if (isNaN(tN) || tN < 50 || tN > 250) return alert('Tinggi Badan harus 50-250 cm');
        nilai['Tinggi Badan'] = tN;
    }
    if (bVal !== '') {
        var bN = parseAngkaDesimal(bVal);
        if (isNaN(bN) || bN < 10 || bN > 300) return alert('Berat Badan harus 10-300 kg');
        nilai['Berat Badan'] = bN;
    }

    // Data mentah RAST (berat + 6 waktu sprint) ikut tersimpan di sesi
    if (rastDataForm) {
        nilai['RAST Data'] = { berat: rastDataForm.berat, waktu: rastDataForm.waktu.slice() };
    }

    var dataAtlet = {
        nama: nama,
        tempat_lahir: document.getElementById('fTempat').value,
        tanggal_lahir: document.getElementById('fLahir').value,
        jenis_kelamin: kelamin,
        cabor_nama: cabor,
        nomor: document.getElementById('fNomor').value,
        catatan: document.getElementById('fCatatan').value,
        catatan_cedera: document.getElementById('fCedera').value
    };
    var tglTes = document.getElementById('fTglTes').value || new Date().toISOString().split('T')[0];
    var nomorTes = document.getElementById('fNomor').value;

    // Mode edit: perbarui atlet & sesi yang sudah ada (tanpa duplikat)
    var idA = idAtletEdit, idS = idSesiEdit;
    var atlet, sesi;
    if (idA && findAtlet(idA)) {
        var rA = updateAtlet(idA, dataAtlet);
        if (!rA.ok) return alert(rA.error || 'Gagal menyimpan perubahan');
        atlet = findAtlet(idA);
        if (idS && findSesi(idS)) {
            // Kunci tanpa input form (% Performance) harus tetap bertahan saat edit
            var nilaiLama = findSesi(idS).nilai || {};
            if (nilaiLama['% Performance'] !== undefined && nilai['% Performance'] === undefined) {
                nilai['% Performance'] = nilaiLama['% Performance'];
            }
            var rS = updateSesi(idS, { tanggal_tes: tglTes, nomor: nomorTes, nilai: nilai });
            if (!rS.ok) return alert(rS.error || 'Gagal menyimpan perubahan');
            sesi = findSesi(idS);
        } else {
            sesi = addSesi({ atlet_id: idA, tanggal_tes: tglTes, nomor: nomorTes, nilai: nilai });
            if (!sesi) return alert('Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data');
        }
    } else {
        atlet = addAtlet(dataAtlet);
        if (!atlet || atlet.ok === false) {
            return alert((atlet && atlet.error) || 'Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data');
        }
        sesi = addSesi({
            atlet_id: atlet.id,
            tanggal_tes: tglTes,
            nomor: nomorTes,
            nilai: nilai
        });
        if (!sesi) {
            hapusAtlet(atlet.id); // batalkan atlet setengah jadi
            return alert('Akses ditolak: hanya superadmin atau pemilik data yang dapat menulis data');
        }
    }

    idAtletEdit = null;
    idSesiEdit = null;
    setLabelFormEdit(false);
    resetFormAtlet();
    renderAtletList();
    showHasilEvaluasi(atlet, sesi);
}

function resetFormAtlet() {
    idAtletEdit = null;
    idSesiEdit = null;
    rastDataForm = null;
    setLabelFormEdit(false);
    ['fNama', 'fTempat', 'fLahir', 'fNomor', 'fCatatan', 'fCedera', 'fBerat', 'fTinggi', 'fIMT', 'fTglTes'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('fKelamin').value = '';
    document.getElementById('fUsia').value = '';
    document.querySelectorAll('#testFields [data-test]').forEach(function(i) { i.value = ''; });
    var wRast = document.getElementById('rastWeight');
    if (wRast) wRast.value = '';
    document.querySelectorAll('[data-rast]').forEach(function(i) { i.value = ''; });
}

function editAtlet(id) {
    var sesiList = listSesi(id);
    mulaiEditAtlet(id, sesiList.length > 0 ? sesiList[0].id : null);
}

// Buka form dalam mode edit: isi data atlet + nilai dari sesi tes tertentu
function mulaiEditAtlet(atletId, sesiId) {
    var a = findAtlet(atletId);
    if (!a) return;
    openFormAtlet();               // buka form dulu (sekalian reset mode edit)
    idAtletEdit = atletId;
    idSesiEdit = sesiId || null;
    setLabelFormEdit(true);
    document.getElementById('fNama').value = a.nama;
    document.getElementById('fTempat').value = a.tempat_lahir || '';
    document.getElementById('fLahir').value = a.tanggal_lahir || '';
    // Data lama bisa memakai singkatan P/L — petakan ke pilihan select
    var jk = a.jenis_kelamin;
    if (jk === 'P') jk = 'Perempuan';
    else if (jk === 'L') jk = 'Laki-laki';
    document.getElementById('fKelamin').value = jk;
    var selC = document.getElementById('fCabor');
    selC.value = a.cabor_nama;
    if (selC.value !== a.cabor_nama && a.cabor_nama) {
        // Cabor atlet tidak ada di daftar pilihan (mis. baris cabor terhapus) — tambahkan sementara
        var opC = document.createElement('option');
        opC.textContent = a.cabor_nama;
        selC.appendChild(opC);
        selC.value = a.cabor_nama;
    }
    document.getElementById('fNomor').value = a.nomor || '';
    document.getElementById('fCatatan').value = a.catatan || '';
    document.getElementById('fCedera').value = a.catatan_cedera || '';
    updateUsia();
    updateItemTes();
    var s = idSesiEdit ? findSesi(idSesiEdit) : null;
    if (s) {
        document.getElementById('fTglTes').value = s.tanggal_tes || '';
        populateTestFieldsDariNilai(s.nilai || {});
        // Tinggi/berat badan (input statis, bukan bagian #testFields)
        document.getElementById('fTinggi').value =
            s.nilai['Tinggi Badan'] !== undefined ? s.nilai['Tinggi Badan'] : '';
        document.getElementById('fBerat').value =
            s.nilai['Berat Badan'] !== undefined ? s.nilai['Berat Badan'] : '';
        updateIMTDariForm();
        // Kembalikan data mentah RAST (bila ada) ke kalkulator
        var dR = s.nilai['RAST Data'];
        if (dR && dR.waktu && dR.waktu.length === 6 && parseFloat(dR.berat) > 0) {
            rastDataForm = { berat: parseFloat(dR.berat), waktu: dR.waktu.slice() };
            var wInp = document.getElementById('rastWeight');
            if (wInp) wInp.value = dR.berat;
            for (var iR = 1; iR <= 6; iR++) {
                var inpR = document.querySelector('[data-rast="' + iR + '"]');
                if (inpR) inpR.value = dR.waktu[iR - 1];
            }
        } else {
            rastDataForm = null;
        }
    }
    document.getElementById('fTinggi').focus();
}

// Isi field form dari objek nilai (untuk edit). Durasi dipecah ke menit:detik.
function populateTestFieldsDariNilai(nilai) {
    Object.keys(nilai || {}).forEach(function(key) {
        var val = nilai[key];
        if (isDurasiItem(key)) {
            var pecah = pecahDurasi(val);
            var mInp = document.querySelector('[data-test="' + key + '-menit"]');
            var dInp = document.querySelector('[data-test="' + key + '-detik"]');
            if (mInp) mInp.value = pecah.menit;
            if (dInp) dInp.value = pecah.detik;
        } else {
            var inp = document.querySelector('[data-test="' + key + '"]');
            if (inp) {
                inp.value = val;
                if (itemKey(key) === 'vertical jump') peringatanNilaiTidakWajar(inp);
            }
        }
    });
}

// =====================================================================
// HASIL EVALUASI
// =====================================================================
// Baris ber-flag hidden (mis. RAST Peak / Relative Peak / Average Power)
// hanya dipakai untuk perhitungan; tampilan hasil menyaringnya agar
// hasil mudah dibaca (yang tampil: RAST Fatigue Index saja).
function evItemsTampil(ev) {
    return (ev && ev.items ? ev.items : []).filter(function(it) { return !it.hidden; });
}

function showHasilEvaluasi(atlet, sesi) {
    var ev = evalSesi(sesi);
    if (!ev) return;
    evalAtletSaatIni = atlet;
    evalSesiSaatIni = sesi;
    document.getElementById('hasilEvaluasi').classList.remove('hidden');

    document.getElementById('evSkor').textContent = ev.totalSkor;
    document.getElementById('evPerforma').textContent = ev.performa + '%';
    var katEl = document.getElementById('evKategori');
    katEl.textContent = ev.kategori;
    katEl.className = 'cat-badge cat-' + getCatColor(ev.kategori);

    // IMT (kartu: nilai besar + badge kategori + keterangan kecil)
    var evIMTEl = document.getElementById('evIMT');
    var evIMTKatEl = document.getElementById('evIMTKat');
    var evIMTCatEl = document.getElementById('evIMTCatatan');
    var imtAda = ev.imt !== null && ev.imt !== undefined;
    if (evIMTEl) {
        evIMTEl.textContent = imtAda ? ev.imt : 'Isi tinggi & berat badan';
        evIMTEl.className = imtAda ? 'stat-value' : 'imt-pesan';
    }
    if (evIMTKatEl) {
        evIMTKatEl.textContent = ev.imtKategori || '';
        evIMTKatEl.classList.toggle('hidden', !ev.imtKategori);
    }
    if (evIMTCatEl) {
        evIMTCatEl.textContent = ev.imtCatatan || '';
        evIMTCatEl.classList.toggle('hidden', !ev.imtCatatan);
    }

    document.getElementById('evTableBody').innerHTML = evItemsTampil(ev).map(function(it) {
        return '<tr>' +
            '<td class="font-semibold">' + escHtml(it.name) + '</td>' +
            '<td>' + formatHasilItem(it) + '</td>' +
            '<td>' + formatPctItem(it) + '</td>' +
            '<td>' + formatKatItem(it) + '</td>' +
            '</tr>';
    }).join('');

    // Radar chart
    var labels = evItemsTampil(ev).map(function(it) { return it.name; });
    var data = evItemsTampil(ev).map(function(it) { return it.pct || 0; });
    if (charts.radar) charts.radar.destroy();
    var ctx = document.getElementById('chartRadar');
    if (ctx) {
        charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Persentase',
                    data: data,
                    backgroundColor: 'rgba(59,130,246,0.2)',
                    borderColor: '#3b82f6',
                    pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                scales: { r: { min: 0, max: 100 } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// Kartu IMT untuk modal "Detail Hasil Tes" (nilai besar + badge kategori + keterangan kecil)
function kartuIMTHTML(ev) {
    var ada = ev.imt !== null && ev.imt !== undefined;
    var html = '<div class="stat-card"><p class="stat-label">IMT</p>';
    if (ada) {
        html += '<p class="stat-value">' + escHtml(String(ev.imt)) + '</p>';
        if (ev.imtKategori) html += '<span class="imt-badge">' + escHtml(ev.imtKategori) + '</span>';
        if (ev.imtCatatan) html += '<p class="imt-catatan">' + escHtml(ev.imtCatatan) + '</p>';
    } else {
        html += '<p class="imt-pesan">Isi tinggi &amp; berat badan</p>';
    }
    return html + '</div>';
}

function showDetailSesi(sesiId) {
    if (!sesiId) return;
    var s = findSesi(sesiId);
    if (!s) return;
    var a = findAtlet(s.atlet_id);
    var ev = evalSesi(s);
    if (!ev) return;
    var el = document.getElementById('detailSesiContent');
    el.innerHTML =
        '<p class="font-bold text-lg">' + escHtml(a.nama) + '</p>' +
        '<p class="text-slate-500 text-sm mb-4">' + escHtml(a.cabor_nama) + ' · ' + s.tanggal_tes + '</p>' +
        '<div class="grid grid-cols-3 gap-4 mb-4">' +
        '<div class="stat-card"><p class="stat-label">Performa</p><p class="stat-value">' + ev.performa + '%</p></div>' +
        '<div class="stat-card"><p class="stat-label">Kategori</p><p class="stat-value text-sm"><span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span></p></div>' +
        kartuIMTHTML(ev) +
        '</div>' +
        '<table class="data-table"><thead><tr><th>Item</th><th>Hasil</th><th>%</th><th>Kategori</th></tr></thead><tbody>' +
        evItemsTampil(ev).map(function(it) {
            return '<tr><td>' + escHtml(it.name) + '</td><td>' + formatHasilItem(it) + '</td><td>' + formatPctItem(it) + '</td><td>' + formatKatItem(it) + '</td></tr>';
        }).join('') + '</tbody></table>';
    openModal('modalDetailSesi');
}

function printHasil() { window.print(); }

function exportCSVHasil() {
    var rows = [['Item', 'Hasil', 'Persentase', 'Kategori']];
    document.querySelectorAll('#evTableBody tr').forEach(function(tr) {
        var cols = [];
        tr.querySelectorAll('td').forEach(function(td) { cols.push(td.textContent.trim()); });
        rows.push(cols);
    });
    downloadFile('hasil-evaluasi.csv', toCSV(rows));
}

function editSesiTerakhir() {
    if (!evalAtletSaatIni || !evalSesiSaatIni) return alert('Tidak ada sesi tes yang sedang ditampilkan');
    if (!bolehTulisCabor(evalAtletSaatIni.cabor_nama)) return alert('Akses ditolak: hanya superadmin atau pemilik data yang dapat mengubah data');
    mulaiEditAtlet(evalAtletSaatIni.id, evalSesiSaatIni.id);
}

function hapusSesiTerakhir() {
    if (!confirm('Hapus sesi tes terakhir?')) return;
    alert('Sesi dihapus.');
}

// =====================================================================
// DASHBOARD
// =====================================================================
function renderDashboard() {
    var list = listAtlet();
    var fc = (document.getElementById('dashFilterCabor') || {}).value || '';
    var fk = (document.getElementById('dashFilterKelamin') || {}).value || '';
    if (fc) list = list.filter(function(a) { return a.cabor_nama === fc; });
    if (fk) list = list.filter(function(a) { return a.jenis_kelamin === fk; });

    // Filter cabor options (sesuai hak akses: user cabor hanya cabornya sendiri)
    var selC = document.getElementById('dashFilterCabor');
    if (selC && selC.options.length <= 1) {
        listCaborScope().forEach(function(c) {
            selC.innerHTML += '<option>' + escHtml(c.nama) + '</option>';
        });
    }

    var dist = { 'Baik Sekali': 0, 'Baik': 0, 'Cukup': 0, 'Kurang': 0, 'Kurang Sekali': 0 };
    var totalPct = 0, cnt = 0;
    var rows = list.map(function(a, i) {
        var sesi = listSesi(a.id);
        var ev = sesi.length ? evalSesi(sesi[0]) : null;
        if (ev) {
            dist[ev.kategori] = (dist[ev.kategori] || 0) + 1;
            totalPct += ev.performa;
            cnt++;
        }
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td class="font-semibold">' + escHtml(a.nama) + '</td>' +
            '<td>' + escHtml(a.tempat_lahir || '-') + ', ' + (a.tanggal_lahir || '-') + '</td>' +
            '<td>' + escHtml(a.cabor_nama) + '</td>' +
            '<td>' + hitungUsia(a.tanggal_lahir) + '</td>' +
            '<td>' + escHtml(a.jenis_kelamin) + '</td>' +
            '<td>' + sesi.length + '</td>' +
            '<td>' + (ev ? ev.performa + '%' : '-') + '</td>' +
            '<td>' + (ev ? '<span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span>' : '-') + '</td>' +
            '<td><button onclick="showDetailSesi(\'' + (sesi.length ? sesi[0].id : '') + '\')" class="btn btn-outline btn-sm">Detail</button></td>' +
            '</tr>';
    });
    document.getElementById('dashTableBody').innerHTML = rows.join('');
    document.getElementById('dashAtlet').textContent = list.length;
    document.getElementById('dashCabor').textContent = listCaborScope().length;
    document.getElementById('dashRata').textContent = (cnt > 0 ? Math.round(totalPct / cnt * 10) / 10 : 0) + '%';

    var dominan = Object.keys(dist).reduce(function(a, b) { return dist[a] >= dist[b] ? a : b; }, 'Baik Sekali');
    document.getElementById('dashDominan').innerHTML = '<span class="cat-badge cat-' + getCatColor(dominan) + '">' + dominan + '</span>';

    // Chart
    if (charts.dashDist) charts.dashDist.destroy();
    var ctx = document.getElementById('chartDashDist');
    if (ctx) {
        charts.dashDist = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(dist),
                datasets: [{ data: Object.values(dist), backgroundColor: ['#059669', '#2563eb', '#d97706', '#ea580c', '#dc2626'] }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }
}

function exportCSVDashboard() {
    var rows = [['No', 'Nama', 'Cabor', 'Usia', 'Kelamin', 'Jml Tes', 'Performa', 'Kategori']];
    document.querySelectorAll('#dashTableBody tr').forEach(function(tr, i) {
        var cols = [i + 1];
        tr.querySelectorAll('td').forEach(function(td, j) {
            if (j > 0 && j < 9) cols.push(td.textContent.trim());
        });
        rows.push(cols);
    });
    downloadFile('dashboard-hasil-tes.csv', toCSV(rows));
}

// =====================================================================
// DATA COMPARISON
// =====================================================================
function renderComparison() {
    var selA = document.getElementById('cmpAtlet');
    if (selA && selA.options.length <= 1) {
        listAtlet().forEach(function(a) {
            selA.innerHTML += '<option value="' + a.id + '">' + escHtml(a.nama) + '</option>';
        });
    }
    var selC = document.getElementById('cmpCabor');
    if (selC && selC.options.length <= 1) {
        listCaborScope().forEach(function(c) {
            selC.innerHTML += '<option>' + escHtml(c.nama) + '</option>';
        });
    }

    var atletId = (document.getElementById('cmpAtlet') || {}).value;
    if (!atletId) {
        document.getElementById('cmpSebelum').textContent = '-';
        document.getElementById('cmpTerbaru').textContent = '-';
        document.getElementById('cmpSelisih').textContent = '-';
        document.getElementById('cmpTableBody').innerHTML = '';
        return;
    }

    var sesi = listSesi(atletId).reverse();
    var skorList = sesi.map(function(s) {
        var ev = evalSesi(s);
        return { tanggal: s.tanggal_tes, skor: ev ? ev.performa : 0, kategori: ev ? ev.kategori : '-' };
    });

    if (skorList.length >= 1) {
        document.getElementById('cmpTerbaru').textContent = skorList[skorList.length - 1].skor + '%';
    }
    if (skorList.length >= 2) {
        document.getElementById('cmpSebelum').textContent = skorList[skorList.length - 2].skor + '%';
        var selisih = bulat1(skorList[skorList.length - 1].skor - skorList[skorList.length - 2].skor);
        document.getElementById('cmpSelisih').innerHTML = (selisih >= 0 ? '↑ +' : '↓ ') + selisih + '%';
        document.getElementById('cmpSelisih').style.color = selisih >= 0 ? '#059669' : '#dc2626';
    }

    document.getElementById('cmpTableBody').innerHTML = skorList.map(function(r, i) {
        var selisih = i > 0 ? bulat1(r.skor - skorList[i - 1].skor) : null;
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + r.tanggal + '</td>' +
            '<td class="font-semibold">' + r.skor + '%</td>' +
            '<td><span class="cat-badge cat-' + getCatColor(r.kategori) + '">' + r.kategori + '</span></td>' +
            '<td>' + (selisih !== null ? (selisih >= 0 ? '<span class="text-emerald-600">↑ +' + selisih + '%</span>' : '<span class="text-red-600">↓ ' + selisih + '%</span>') : '-') + '</td>' +
            '</tr>';
    }).join('');

    // Chart tren
    if (charts.tren) charts.tren.destroy();
    var ctx = document.getElementById('chartTren');
    if (ctx && skorList.length) {
        charts.tren = new Chart(ctx, {
            type: 'line',
            data: {
                labels: skorList.map(function(r) { return r.tanggal; }),
                datasets: [{
                    label: 'Skor %',
                    data: skorList.map(function(r) { return r.skor; }),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: { y: { min: 0, max: 100 } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// =====================================================================
// CABOR & ITEM TES
// =====================================================================
function renderCaborItem() {
    // Daftar cabor (user cabor hanya melihat cabornya sendiri)
    var u = currentUser();
    var list = listCaborScope();

    document.getElementById('caborTableBody').innerHTML = list.map(function(c, i) {
        var kodeTampil = u && u.role === 'cabor' ? '••••••' : c.kode_akses;
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td class="font-semibold">' + escHtml(c.nama) + '</td>' +
            '<td>' + escHtml(c.kabupaten || '-') + '</td>' +
            '<td><code class="bg-slate-100 px-2 py-1 rounded text-xs">' + escHtml(kodeTampil) + '</code> ' +
            '<span class="cat-badge ' + (c.kode_diubah ? 'cat-amber' : 'cat-slate') + '">' + (c.kode_diubah ? 'Diubah' : 'Bawaan') + '</span></td>' +
            '<td>' + (isAdmin() ? '<button onclick="ubahKode(\'' + c.id + '\')" class="btn btn-outline btn-sm">Ubah Kode</button>' : '') + '</td>' +
            '</tr>';
    }).join('');

    // Item custom
    var db = loadDB();
    document.getElementById('itemCustomList').innerHTML = (db.itemCustom || []).map(function(it) {
        return '<div class="flex items-center gap-2 text-sm"><span class="font-semibold">' + escHtml(it.nama) + '</span><span class="text-slate-400">(' + escHtml(it.satuan) + ')</span></div>';
    }).join('') || '<p class="text-slate-400 text-sm">Belum ada item tambahan</p>';

    // Item bawaan
    document.getElementById('itemBawaanList').innerHTML = NORMA_ITEMS.map(function(it) {
        return '<div class="flex items-center gap-2 text-sm"><span>' + escHtml(it.nama) + '</span><span class="text-slate-400">(' + escHtml(it.satuan) + ')</span></div>';
    }).join('');

    // Setting item per cabor
    var sel = document.getElementById('settingCabor');
    if (sel) {
        sel.innerHTML = list.map(function(c) {
            return '<option value="' + c.id + '">' + escHtml(c.nama) + '</option>';
        }).join('');
    }
    renderItemSetting();
}

function renderItemSetting() {
    var caborId = (document.getElementById('settingCabor') || {}).value;
    var c = findCabor(caborId);
    if (!c) return;
    var q = ((document.getElementById('searchItemSetting') || {}).value || '').toLowerCase();
    var allItems = listAllItems().filter(function(it) {
        return !q || it.nama.toLowerCase().indexOf(q) >= 0;
    });
    var selected = c.items || [];
    document.getElementById('itemSettingList').innerHTML = allItems.map(function(it) {
        var checked = selected.indexOf(it.nama) >= 0 ? 'checked' : '';
        return '<label class="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">' +
            '<input type="checkbox" data-item="' + escHtml(it.nama) + '" ' + checked + '>' +
            '<span class="text-sm">' + escHtml(it.nama) + '</span>' +
            '<span class="text-xs text-slate-400">(' + escHtml(it.satuan) + ')</span>' +
            '</label>';
    }).join('');
}

function pilihSemuaItem() {
    document.querySelectorAll('#itemSettingList input[type=checkbox]').forEach(function(cb) { cb.checked = true; });
}

function lepasSemuaItem() {
    document.querySelectorAll('#itemSettingList input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
}

function simpanItemSetting() {
    var caborId = document.getElementById('settingCabor').value;
    var c = findCabor(caborId);
    if (!c) return alert('Cabor tidak ditemukan');
    if (!bolehTulisCabor(c.nama)) return alert('Akses ditolak: hanya superadmin atau pemilik data yang dapat menyimpan data');
    var items = [];
    document.querySelectorAll('#itemSettingList input[type=checkbox]:checked').forEach(function(cb) {
        items.push(cb.getAttribute('data-item'));
    });
    var r = updateCabor(caborId, { items: items });
    if (!r.ok) return alert(r.error || 'Gagal menyimpan pilihan item');
    alert('Pilihan item tersimpan (' + items.length + ' item)');
}

function tambahCabor() {
    if (!canWrite()) return alert('Akses ditolak: hanya superadmin yang dapat menulis data');
    if (!isAdmin()) return alert('Hanya Superadmin');
    var nama = document.getElementById('newCaborNama').value.trim();
    if (!nama) return alert('Nama cabor wajib diisi');
    var kode = document.getElementById('newCaborKode').value.trim();
    addCabor(nama, kode);
    document.getElementById('newCaborNama').value = '';
    document.getElementById('newCaborKode').value = '';
    renderCaborItem();
    alert('Cabor "' + nama + '" berhasil ditambahkan');
}

function genKode() {
    document.getElementById('newCaborKode').value = generateKode(document.getElementById('newCaborNama').value);
}

function ubahKode(id) {
    if (!isAdmin()) return;
    var kode = prompt('Kode akses baru:');
    if (!kode) return;
    updateCabor(id, { kode_akses: kode.trim(), kode_diubah: true });
    renderCaborItem();
}

function tambahItem() {
    // Master item: superadmin & user cabor (PRD 5.4); tamu ditolak
    if (!canWrite() && !isCaborUser()) return alert('Akses ditolak: hanya superadmin atau user cabor yang dapat menulis data');
    var nama = document.getElementById('newItemNama').value.trim();
    var satuan = document.getElementById('newItemSatuan').value.trim();
    if (!nama) return alert('Nama item wajib diisi');
    var r = addItemCustom(nama, satuan);
    if (!r.ok) return alert(r.error || 'Gagal menambah item');
    document.getElementById('newItemNama').value = '';
    document.getElementById('newItemSatuan').value = '';
    renderCaborItem();
}

// =====================================================================
// KODE AKSES & AKUN
// =====================================================================
function renderAkses() {
    document.getElementById('aksesTableBody').innerHTML = listCabor().map(function(c, i) {
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td class="font-semibold">' + escHtml(c.nama) + '</td>' +
            '<td><code class="bg-slate-100 px-2 py-1 rounded text-xs">' + escHtml(c.kode_akses) + '</code></td>' +
            '<td><span class="cat-badge ' + (c.kode_diubah ? 'cat-amber' : 'cat-slate') + '">' + (c.kode_diubah ? 'Diubah' : 'Bawaan') + '</span></td>' +
            '<td><button onclick="ubahKode(\'' + c.id + '\')" class="btn btn-outline btn-sm">Ubah</button></td>' +
            '</tr>';
    }).join('');

    var db = loadDB();
    document.getElementById('userTableBody').innerHTML = db.users.map(function(u) {
        return '<tr>' +
            '<td class="font-semibold">' + escHtml(u.username) + '</td>' +
            '<td>' + (u.role === 'superadmin' ? 'Superadmin' : 'User Cabor') + '</td>' +
            '<td>' + escHtml(u.cabor || '-') + '</td>' +
            '<td><span class="cat-badge ' + (u.status === 'aktif' ? 'cat-emerald' : 'cat-red') + '">' + u.status + '</span></td>' +
            '<td class="whitespace-nowrap">' +
            '<button onclick="resetPwUser(\'' + u.id + '\')" class="btn btn-outline btn-sm">Reset PW</button> ' +
            '<button onclick="toggleUserStatus(\'' + u.id + '\')" class="btn btn-primary btn-sm">' + (u.status === 'aktif' ? 'Nonaktif' : 'Aktif') + '</button> ' +
            '<button onclick="deleteUserById(\'' + u.id + '\')" class="btn btn-danger btn-sm">Hapus</button>' +
            '</td></tr>';
    }).join('');

    // Cabor options untuk user form
    var sel = document.getElementById('usrCabor');
    if (sel) {
        sel.innerHTML = '<option value="">-</option>' +
            listCabor().map(function(c) { return '<option>' + escHtml(c.nama) + '</option>'; }).join('');
    }
}

function addUserFromForm() {
    if (!canWrite()) return alert('Akses ditolak: hanya superadmin yang dapat menulis data');
    if (!isAdmin()) return alert('Hanya Superadmin');
    var username = document.getElementById('usrUsername').value.trim().toLowerCase();
    var password = document.getElementById('usrPassword').value;
    var role = document.getElementById('usrRole').value;
    var cabor = document.getElementById('usrCabor').value;
    if (!/^[a-z0-9_]{4,30}$/.test(username)) return alert('Username: huruf kecil/angka/underscore, 4-30 karakter');
    if (password.length < 8) return alert('Password minimal 8 karakter');

    var db = loadDB();
    if (db.users.some(function(u) { return u.username === username; })) return alert('Username sudah dipakai');
    db.users.push({
        id: genId(), username: username, password: hashPw(password),
        role: role, cabor: cabor, kabupaten: '', status: 'aktif', dibuat: new Date().toISOString()
    });
    saveDB(db);
    document.getElementById('usrUsername').value = '';
    document.getElementById('usrPassword').value = '';
    renderAkses();
}

function resetPwUser(id) {
    var pw = prompt('Password baru:');
    if (!pw || pw.length < 8) return alert('Password minimal 8 karakter');
    var db = loadDB();
    var u = db.users.filter(function(x) { return x.id === id; })[0];
    if (u) { u.password = hashPw(pw); saveDB(db); }
    alert('Password berhasil direset');
}

function toggleUserStatus(id) {
    var db = loadDB();
    var u = db.users.filter(function(x) { return x.id === id; })[0];
    if (u) {
        u.status = u.status === 'aktif' ? 'nonaktif' : 'aktif';
        saveDB(db);
    }
    renderAkses();
}

function deleteUserById(id) {
    if (!confirm('Hapus akun ini?')) return;
    var db = loadDB();
    db.users = db.users.filter(function(u) { return u.id !== id; });
    saveDB(db);
    renderAkses();
}

// =====================================================================
// NORMA TES MENU
// =====================================================================
// Baris norma untuk tampilan/unduhan: NORMA_ROWS + baris turunan
// "Vertical Jump Power" (Mean/SD = mengikuti berat badan atlet, rumus Lewis).
function normaRowsDisplay() {
    var out = [];
    (NORMA_ROWS || []).forEach(function(n) {
        out.push(n);
        if (itemKey(n.item) === 'vertical jump') {
            out.push({
                item: 'Vertical Jump Power',
                kelompok: n.kelompok,
                jenis_kelamin: n.jenis_kelamin,
                mean: null,
                sd: null,
                meanTeks: 'Mengikuti berat badan atlet',
                sumber: 'turunanLewis (dari norma Vertical Jump + rumus Lewis)',
                dipakai: null,
                catatan: 'Input Vertical Jump dalam meter. Norma Vertical Jump (cm, sheet KONI) dikonversikan ke meter lalu diturunkan dengan rumus Lewis (1974) menurut berat badan atlet; bukan norma resmi KONI.'
            });
        }
    });
    return out;
}

function renderNormaTable() {
    var filter = (document.getElementById('normaFilter') || {}).value || '';
    var SKIP_NORMA_TABLE = ['Tinggi Badan', 'Berat Badan'];
    var rows = normaRowsDisplay().filter(function(n) {
        if (SKIP_NORMA_TABLE.indexOf(n.item) >= 0) return false;
        if (!filter) return true;
        var kf = itemKey(filter);
        return itemKey(n.item) === kf ||
            (kf === 'vertical jump' && itemKey(n.item) === 'vertical jump power');
    });
    // Isi dropdown filter
    var sel = document.getElementById('normaFilter');
    if (sel && sel.options.length <= 1) {
        var seen = {};
        (NORMA_ITEMS || []).forEach(function(it) {
            var k = itemKey(it.nama);
            if (!seen[k]) {
                seen[k] = true;
                sel.innerHTML += '<option value="' + escHtml(it.nama) + '">' + escHtml(it.nama) + '</option>';
            }
        });
        if (!seen['vertical jump power']) {
            sel.innerHTML += '<option value="Vertical Jump Power">Vertical Jump Power</option>';
        }
    }
    function sumberLabel(s) {
        if (s === 'caborData') return 'caborData (norma bawaan per cabor)';
        if (s === 'atletikNomor') return 'atletikNomor (norma khusus nomor Atletik)';
        if (s === 'NORMA_ITEM_KELAMIN') return 'NORMA_ITEM_KELAMIN (norma cadangan item berbasis kelamin)';
        return s || '-';
    }
    function dipakaiLabel(dipakai, catatan) {
        var d = Array.isArray(dipakai) ? dipakai.join(', ') : (dipakai || '');
        if (catatan) return d + (d ? ' | ' : '') + catatan;
        return d || '-';
    }
    document.getElementById('normaTableBody').innerHTML = rows.map(function(n) {
        var adaNorma = n.mean !== null && n.mean !== undefined && n.sd !== null && n.sd !== undefined;
        var isInherentNoNorma = (n.item === 'IMT' || n.item === '% Performance');
        var belumTxt = '<span class="text-amber-600 text-xs font-semibold">Norma belum diatur</span>';
        var selKosong = isInherentNoNorma ? '-' : (n.sumber === '-' ? belumTxt : '-');
        var meanT = n.meanTeks ? escHtml(n.meanTeks) : (adaNorma ? fmtNumKoma(n.mean) : selKosong);
        var sdT = n.meanTeks ? escHtml(n.meanTeks) : (adaNorma ? fmtNumKoma(n.sd) : selKosong);
        function kolomRentang(i) {
            if (!adaNorma) return selKosong;
            var arah = resolveArahGlobal(n.item);
            var r = normaRentangKategori(n.mean, n.sd, arah);
            return r ? '<span class="text-[10px] leading-snug block">' + escHtml(r[i]) + '</span>' : '-';
        }
        // Keterangan khusus untuk IMT
        var ketTampil = dipakaiLabel(n.dipakai, n.catatan);
        if (n.item === 'IMT') {
            ketTampil = 'Dihitung otomatis: berat badan (kg) / tinggi badan (m)^2 — tidak dinilai';
        }
        return '<tr class="border-t border-slate-100">' +
            '<td class="px-3 py-2 font-semibold">' + escHtml(n.item) + '</td>' +
            '<td class="px-3 py-2 text-xs">' + escHtml(n.kelompok || '-') + '</td>' +
            '<td class="px-3 py-2 text-xs">' + escHtml(n.jenis_kelamin || '-') + '</td>' +
            '<td class="px-3 py-2">' + meanT + '</td>' +
            '<td class="px-3 py-2">' + sdT + '</td>' +
            '<td class="px-3 py-2">' + kolomRentang(0) + '</td>' +
            '<td class="px-3 py-2">' + kolomRentang(1) + '</td>' +
            '<td class="px-3 py-2">' + kolomRentang(2) + '</td>' +
            '<td class="px-3 py-2">' + kolomRentang(3) + '</td>' +
            '<td class="px-3 py-2">' + kolomRentang(4) + '</td>' +
            '<td class="px-3 py-2 text-xs">' + escHtml(sumberLabel(n.sumber)) + '</td>' +
            '<td class="px-3 py-2 text-xs">' + escHtml(ketTampil) + '</td>' +
            '</tr>';
    }).join('');
}

function renderRumusKartu() {
    var box = document.getElementById('rumusKartuBox');
    if (!box) return;
    var semuaRumus = (NORMA_RUMUS || []).slice();
    // Tambah rumus IMT (no. 12)
    var adaIMT = semuaRumus.some(function(r) { return r.no === 12; });
    if (!adaIMT) {
        semuaRumus.push({
            no: 12,
            judul: '12. IMT (Indeks Massa Tubuh)',
            rumus: 'IMT = berat badan (kg) / (tinggi badan (m))^2',
            penjelasan: 'Tinggi badan dalam cm dibagi 100 terlebih dahulu. Kategori IMT (standar WHO): < 18,5 Berat badan kurang; 18,5 - 24,9 Normal; 25,0 - 29,9 Berat badan berlebih; >= 30,0 Obesitas. IMT tidak dinilai z-score dan tidak ikut dirata-ratakan ke performa.',
            contoh: 'Berat 70 kg, tinggi 170 cm -> 70 / (1,70 x 1,70) = 24,2 -> Normal'
        });
    }
    // Tambah rumus Lewis (no. 13) — power Vertical Jump, turunan norma menurut BB atlet
    var adaLewis = semuaRumus.some(function(r) { return r.no === 13; });
    if (!adaLewis && typeof RUMUS_LEWIS !== 'undefined') {
        semuaRumus.push(RUMUS_LEWIS);
    }
    box.innerHTML = semuaRumus.map(function(r) {
        var penjelasan = r.penjelasan || '';
        if (r.no === 9) {
            penjelasan += ' Ditampilkan dengan persentase, kategori, dan rekomendasi sebagai informasi; tidak ikut dirata-ratakan ke performa keseluruhan.';
        }
        return '<div class="rumus-card">' +
            '<p class="font-semibold mb-1">' + escHtml(r.judul || '') + '</p>' +
            '<div class="rumus-formula">' + escHtml(r.rumus || '-') + '</div>' +
            (penjelasan ? '<p class="text-slate-500 text-xs mt-2">' + escHtml(penjelasan) + '</p>' : '') +
            (r.contoh ? '<div class="rumus-contoh"><strong>Contoh:</strong> ' + escHtml(r.contoh) + '</div>' : '') +
            '</div>';
    }).join('');
}

function renderKeteranganSumber() {
    var metaBox = document.getElementById('sumberMeta');
    var listBox = document.getElementById('keteranganList');
    if (!metaBox || !listBox) return;
    var meta = (NORMA_JSON && NORMA_JSON.meta) || {};
    metaBox.innerHTML =
        '<p><span class="font-semibold">Judul:</span> ' + escHtml(String(meta.judul || '').replace(/^["\uFEFF]+|["]+$/g, '')) + '</p>' +
        '<p><span class="font-semibold">Tanggal unduh:</span> ' + escHtml(meta.tanggal_unduh || '-') + '</p>' +
        '<p><span class="font-semibold">Sumber data:</span> ' + escHtml(meta.sumber_data || '-') + '</p>' +
        '<p><span class="font-semibold">Kategori penilaian:</span> ' + escHtml(meta.kategori_penilaian || '-') + '</p>';
    listBox.innerHTML = (NORMA_KETERANGAN || []).map(function(k) {
        return '<div class="rounded-xl border border-slate-200 p-4">' +
            '<p class="font-semibold text-sm">' + escHtml(k.no + '. ' + (k.judul || '')) + '</p>' +
            '<p class="text-slate-600 text-xs mt-1 leading-relaxed">' + escHtml(k.keterangan || '') + '</p>' +
            '</div>';
    }).join('');
}

function normaFileName(ext) {
    var u = currentUser();
    var nama = (u && u.username) ? u.username : 'superadmin';
    var tgl = new Date().toISOString().split('T')[0];
    return 'Norma_Tes_' + nama + '_' + tgl + '.' + ext;
}

function downloadNormaCSV() {
    var SKIP_DL = ['Tinggi Badan', 'Berat Badan'];
    var rows = [];

    // Section 1: DAFTAR ITEM TES
    rows.push(['DAFTAR ITEM TES']);
    rows.push(['No', 'Nama Item Tes', 'Satuan', 'Komponen Fisik', 'Arah Nilai', 'Berlaku Untuk', 'Status Penilaian']);
    (NORMA_ITEMS || []).filter(function(it) { return SKIP_DL.indexOf(it.nama) < 0; }).forEach(function(it) {
        rows.push([it.no, it.nama, it.satuan, it.komponen_fisik, it.arah_nilai, it.berlaku_untuk, it.status_penilaian]);
    });
    rows.push([]);

    // Section 2: NORMA & KATEGORI
    rows.push(['NORMA & KATEGORI']);
    rows.push(['Item Tes', 'Kelompok', 'Jenis Kelamin', 'Mean', 'SD', 'Baik Sekali', 'Baik', 'Cukup', 'Kurang', 'Kurang Sekali', 'Sumber Norma', 'Dipakai Oleh / Catatan']);
    normaRowsDisplay().filter(function(n) { return SKIP_DL.indexOf(n.item) < 0; }).forEach(function(n) {
        var adaNorma = n.mean !== null && n.mean !== undefined;
        var arah = resolveArahGlobal(n.item);
        var rentang = adaNorma ? (normaRentangKategori(n.mean, n.sd, arah) || []) : ['-', '-', '-', '-', '-'];
        var dipakai = Array.isArray(n.dipakai) ? n.dipakai.join(', ') : (n.dipakai || '');
        if (n.catatan) dipakai += (dipakai ? ' | ' : '') + n.catatan;
        if (n.item === 'IMT') dipakai = 'Dihitung otomatis: berat badan (kg) / tinggi badan (m)^2 - tidak dinilai';
        rows.push([
            n.item, n.kelompok || '-', n.jenis_kelamin || '-',
            n.meanTeks ? n.meanTeks : (adaNorma ? fmtNumKoma(n.mean) : '-'),
            n.meanTeks ? n.meanTeks : (adaNorma ? fmtNumKoma(n.sd) : '-'),
            rentang[0] || '-', rentang[1] || '-', rentang[2] || '-', rentang[3] || '-', rentang[4] || '-',
            n.sumber || '-', dipakai || '-'
        ]);
    });
    rows.push([]);

    // Section 3: RUMUS PERHITUNGAN
    rows.push(['RUMUS PERHITUNGAN']);
    rows.push(['No', 'Judul', 'Rumus', 'Penjelasan', 'Contoh Perhitungan']);
    var noRumusCsv = {};
    (NORMA_RUMUS || []).forEach(function(r) {
        noRumusCsv[r.no] = true;
        rows.push([r.no, r.judul, r.rumus, r.penjelasan, r.contoh]);
    });
    if (!noRumusCsv[12]) {
        rows.push([12, '12. IMT (Indeks Massa Tubuh)',
            'IMT = berat badan (kg) / (tinggi badan (m))^2',
            'Tinggi badan dalam cm dibagi 100 terlebih dahulu. Kategori IMT (standar WHO): < 18,5 Berat badan kurang; 18,5 - 24,9 Normal; 25,0 - 29,9 Berat badan berlebih; >= 30,0 Obesitas. IMT tidak dinilai z-score dan tidak ikut dirata-ratakan ke performa.',
            'Berat 70 kg, tinggi 170 cm -> 70 / (1,70 x 1,70) = 24,2 -> Normal']);
    }
    if (!noRumusCsv[13]) {
        rows.push([RUMUS_LEWIS.no, RUMUS_LEWIS.judul, RUMUS_LEWIS.rumus, RUMUS_LEWIS.penjelasan, RUMUS_LEWIS.contoh]);
    }
    rows.push([]);

    // Section 4: KETERANGAN & SUMBER NORMA
    rows.push(['KETERANGAN & SUMBER NORMA']);
    rows.push(['No', 'Judul', 'Keterangan']);
    (NORMA_KETERANGAN || []).forEach(function(k) {
        rows.push([k.no, k.judul, k.keterangan]);
    });

    downloadFile(normaFileName('csv'), toCSV(rows));
}

function downloadNormaXLSX() {
    if (typeof XLSX === 'undefined') {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
        s.onload = downloadNormaXLSX;
        document.head.appendChild(s);
        return;
    }
    var SKIP_DL = ['Tinggi Badan', 'Berat Badan'];
    var wb = XLSX.utils.book_new();
    // Sheet 1: Item Tes (tanpa Tinggi Badan & Berat Badan)
    var rows1 = [['No', 'Nama Item Tes', 'Satuan', 'Komponen Fisik', 'Arah Nilai', 'Berlaku Untuk', 'Status Penilaian']];
    (NORMA_ITEMS || []).filter(function(it) { return SKIP_DL.indexOf(it.nama) < 0; }).forEach(function(it) {
        rows1.push([it.no, it.nama, it.satuan, it.komponen_fisik, it.arah_nilai, it.berlaku_untuk, it.status_penilaian]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows1), 'Item Tes');
    // Sheet 2: Norma (tanpa Tinggi Badan & Berat Badan; termasuk baris turunan VJ Power)
    var rows2 = [['Item Tes', 'Kelompok', 'Jenis Kelamin', 'Mean', 'SD', 'Baik Sekali', 'Baik', 'Cukup', 'Kurang', 'Kurang Sekali', 'Sumber Norma', 'Dipakai Oleh / Catatan']];
    normaRowsDisplay().filter(function(n) { return SKIP_DL.indexOf(n.item) < 0; }).forEach(function(n) {
        var adaNorma = n.mean !== null && n.mean !== undefined;
        var arah = resolveArahGlobal(n.item);
        var rentang = adaNorma ? (normaRentangKategori(n.mean, n.sd, arah) || []) : ['-', '-', '-', '-', '-'];
        var dipakai = Array.isArray(n.dipakai) ? n.dipakai.join(', ') : (n.dipakai || '');
        if (n.catatan) dipakai += (dipakai ? ' | ' : '') + n.catatan;
        if (n.item === 'IMT') dipakai = 'Dihitung otomatis: berat badan (kg) / tinggi badan (m)^2 — tidak dinilai';
        rows2.push([
            n.item, n.kelompok || '-', n.jenis_kelamin || '-',
            n.meanTeks ? n.meanTeks : (adaNorma ? fmtNumKoma(n.mean) : '-'),
            n.meanTeks ? n.meanTeks : (adaNorma ? fmtNumKoma(n.sd) : '-'),
            rentang[0] || '-', rentang[1] || '-', rentang[2] || '-', rentang[3] || '-', rentang[4] || '-',
            n.sumber || '-', dipakai || '-'
        ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows2), 'Norma');
    // Sheet 3: Rumus (11 lama + IMT + Lewis)
    var rows3 = [['No', 'Judul', 'Rumus', 'Penjelasan', 'Contoh Perhitungan']];
    var noRumusXls = {};
    (NORMA_RUMUS || []).forEach(function(r) {
        noRumusXls[r.no] = true;
        rows3.push([r.no, r.judul, r.rumus, r.penjelasan, r.contoh]);
    });
    if (!noRumusXls[12]) {
        rows3.push([12, '12. IMT (Indeks Massa Tubuh)',
            'IMT = berat badan (kg) / (tinggi badan (m))^2',
            'Tinggi badan dalam cm dibagi 100 terlebih dahulu. Kategori IMT (standar WHO): < 18,5 Berat badan kurang; 18,5 - 24,9 Normal; 25,0 - 29,9 Berat badan berlebih; >= 30,0 Obesitas. IMT tidak dinilai z-score dan tidak ikut dirata-ratakan ke performa.',
            'Berat 70 kg, tinggi 170 cm -> 70 / (1,70 x 1,70) = 24,2 -> Normal']);
    }
    if (!noRumusXls[13]) {
        rows3.push([RUMUS_LEWIS.no, RUMUS_LEWIS.judul, RUMUS_LEWIS.rumus, RUMUS_LEWIS.penjelasan, RUMUS_LEWIS.contoh]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows3), 'Rumus');
    // Sheet 4: Sumber
    var meta = (NORMA_JSON && NORMA_JSON.meta) || {};
    var rows4 = [[String(meta.judul || '').replace(/^["\uFEFF]+|["]+$/g, '')]];
    rows4.push(['Tanggal unduh', meta.tanggal_unduh || '-']);
    rows4.push(['Sumber data', meta.sumber_data || '-']);
    rows4.push([]);
    rows4.push(['No', 'Judul', 'Keterangan']);
    (NORMA_KETERANGAN || []).forEach(function(k) {
        rows4.push([k.no, k.judul, k.keterangan]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows4), 'Sumber');
    XLSX.writeFile(wb, normaFileName('xlsx'));
}

// =====================================================================
// KALKULATOR
// =====================================================================
function fillBleepOptions() {
    var lv = document.getElementById('bleepLevel');
    var sh = document.getElementById('bleepShuttle');
    if (!lv) return;
    for (var i = 1; i <= 21; i++) {
        lv.innerHTML += '<option value="' + i + '">Level ' + i + '</option>';
    }
    for (var j = 0; j <= 20; j++) {
        sh.innerHTML += '<option value="' + j + '">' + j + '</option>';
    }
}

function calcBleep() {
    var lv = document.getElementById('bleepLevel').value;
    var sh = document.getElementById('bleepShuttle').value;
    var v = bleepVO2max(lv, sh);
    document.getElementById('bleepResult').textContent = v === null ? '-' : v;
}

function applyBleep() {
    var lv = parseInt(document.getElementById('bleepLevel').value, 10);
    var sh = parseInt(document.getElementById('bleepShuttle').value, 10);
    if (isNaN(lv)) return alert('Pilih level');
    var v = bleepVO2max(lv, isNaN(sh) ? 0 : sh);
    document.querySelectorAll('#testFields [data-test]').forEach(function(i) {
        if (i.getAttribute('data-test').toLowerCase().indexOf('bleep') >= 0) {
            i.value = v;
            i.classList.add('ring', 'ring-blue-300');
            setTimeout(function() { i.classList.remove('ring', 'ring-blue-300'); }, 1200);
        }
    });
}

function buildRastRows() {
    var body = document.getElementById('rastRows');
    if (!body) return;
    var html = '';
    for (var i = 1; i <= 6; i++) {
        html += '<tr>' +
            '<td class="py-1">Sprint ' + i + '</td>' +
            '<td class="py-1"><input data-rast="' + i + '" type="number" step="0.01" oninput="calcRast()" class="form-input"></td>' +
            '<td class="py-1 text-slate-500" id="rastPower' + i + '">-</td>' +
            '</tr>';
    }
    body.innerHTML = html;
}

function openRastCalc() {
    var wInp = document.getElementById('rastWeight');
    if (wInp && !wInp.value) {
        var fb = document.getElementById('fBerat');
        var w = fb && fb.value ? fb.value : '';
        if (!w && idAtletEdit) {
            var sesiAtlet = listSesi(idAtletEdit).slice().sort(function(p, q) {
                return (q.tanggal_tes || '').localeCompare(p.tanggal_tes || '');
            });
            for (var i = 0; i < sesiAtlet.length; i++) {
                var bb = (sesiAtlet[i].nilai || {})['Berat Badan'];
                if (bb !== undefined && bb !== '') { w = bb; break; }
            }
        }
        if (w) wInp.value = w;
    }
    openModal('modalRast');
    calcRast();
}

function calcRast() {
    var w = document.getElementById('rastWeight').value;
    var times = [];
    for (var i = 1; i <= 6; i++) {
        times.push(document.querySelector('[data-rast="' + i + '"]').value);
    }
    var r = hitungRAST(w, times);
    if (!r) {
        for (var j = 1; j <= 6; j++) document.getElementById('rastPower' + j).textContent = '-';
        document.getElementById('rastPeak').textContent = '-';
        document.getElementById('rastMin').textContent = '-';
        document.getElementById('rastAvg').textContent = 'Isi berat badan & 6 waktu sprint';
        document.getElementById('rastFatigue').textContent = '-';
        return;
    }
    r.powers.forEach(function(p, i) {
        document.getElementById('rastPower' + (i + 1)).textContent = p + ' W';
    });
    document.getElementById('rastPeak').textContent = r.peak + ' W (' + r.peakRel + ' W/kg)';
    document.getElementById('rastMin').textContent = r.min + ' W';
    document.getElementById('rastAvg').textContent = r.avg + ' W (' + r.avgRel + ' W/kg)';
    document.getElementById('rastFatigue').textContent = r.fatigue + ' W/s';
}

function applyRast() {
    var w = document.getElementById('rastWeight').value;
    if (w && document.getElementById('fBerat')) document.getElementById('fBerat').value = w;
    var times = [];
    for (var i = 1; i <= 6; i++) {
        times.push(document.querySelector('[data-rast="' + i + '"]').value);
    }
    var r = hitungRAST(w, times);
    if (!r) return alert('Lengkapi berat badan dan 6 waktu sprint');
    rastDataForm = { berat: parseFloat(w), waktu: times.map(function(t) { return parseFloat(t); }) };
    document.querySelectorAll('#testFields [data-test]').forEach(function(i) {
        var k = i.getAttribute('data-test').toLowerCase();
        if (k.indexOf('rast') >= 0 && k.indexOf('fatigue') < 0 && k.indexOf('fatique') < 0) {
            i.value = r.avg;
            i.classList.add('ring', 'ring-orange-300');
            setTimeout(function() { i.classList.remove('ring', 'ring-orange-300'); }, 1200);
        }
    });
    closeModal('modalRast');
}

// =====================================================================
// UTILITAS UI
// =====================================================================
function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getCatColor(label) {
    var map = {
        'Baik Sekali': 'emerald', 'Baik': 'blue', 'Cukup': 'amber',
        'Kurang': 'orange', 'Kurang Sekali': 'red',
        // Kategori tabel norma RAST (topendsports)
        'Elite': 'emerald', 'Excellent': 'emerald', 'Good': 'blue',
        'Average': 'amber', 'Below Average': 'red', 'Needs Improvement': 'red'
    };
    return map[label] || 'slate';
}

function formatHasilItem(it) {
    var html;
    if (it.hasilTeks !== undefined && it.hasilTeks !== null) {
        html = '<span' + (it.hasilTitle ? ' title="' + escHtml(it.hasilTitle) + '"' : '') + '>' +
            escHtml(it.hasilTeks) + '</span>';
    } else if (it.special === 'shoulder') {
        html = it.raw + ' cm (skor ' + it.brockport + ')';
    } else if (isDurasiItem(it.name)) {
        html = formatDurasi(it.raw);
    } else {
        html = it.raw;
    }
    if (it.hasilKeterangan) {
        html += '<br><span class="text-[10px] leading-tight text-slate-400">' + escHtml(it.hasilKeterangan) + '</span>';
    }
    return html;
}

function formatPctItem(it) {
    // Pesan khusus (mis. data lama RAST) mengalahkan seluruh tampilan %/norma
    if (it.pctPesan && (it.pct === null || it.pct === undefined)) {
        return '<span class="text-xs text-slate-500">' + escHtml(it.pctPesan) + '</span>';
    }
    if (it.normaTidakAda) return 'Norma belum diatur';
    if (it.pct != null) {
        // Baris RAST (pctDesimal1) selalu tampil 1 desimal: "38.0%" — bukan "38%"
        var teksPct = it.pctDesimal1 ? it.pct.toFixed(1) : it.pct;
        return '<span' + (it.pct === 0 ? ' title="Nilai jauh di bawah norma"' : '') + '>' + teksPct + '%</span>';
    }
    return '-';
}

function formatKatItem(it) {
    if (it.pctPesan && (it.pct === null || it.pct === undefined)) {
        return '<span class="text-xs text-slate-500">' + escHtml(it.pctPesan) + '</span>';
    }
    if (it.normaTidakAda) return 'Norma belum diatur';
    if (it.cat) return '<span class="cat-badge cat-' + getCatColor(it.cat.label) + '">' + it.cat.label + '</span>';
    return '-';
}

function toCSV(rows) {
    return rows.map(function(r) {
        return r.map(function(c) {
            var s = String(c == null ? '' : c);
            return s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0
                ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
    }).join('\n');
}

function downloadFile(filename, content) {
    var blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

// =====================================================================
// DATA HASIL TES FISIK (Tamu - Read Only)
// =====================================================================
function renderHasilPublik() {
    var q = ((document.getElementById('pubSearch') || {}).value || '').toLowerCase();
    var fc = ((document.getElementById('pubFilterCabor') || {}).value || '');
    var fk = ((document.getElementById('pubFilterKat') || {}).value || '');

    // Isi filter cabor (sekali)
    var selC = document.getElementById('pubFilterCabor');
    if (selC && selC.options.length <= 1) {
        listCabor().forEach(function(c) {
            selC.innerHTML += '<option>' + escHtml(c.nama) + '</option>';
        });
    }

    var list = listAtlet().filter(function(a) {
        if (q && a.nama.toLowerCase().indexOf(q) < 0) return false;
        if (fc && a.cabor_nama !== fc) return false;
        return true;
    });

    // Filter kategori memerlukan evaluasi
    var rows = [];
    list.forEach(function(a, i) {
        var sesi = listSesi(a.id);
        var ev = sesi.length ? evalSesi(sesi[0]) : null;
        if (!ev) return;
        if (fk && ev.kategori !== fk) return;
        var usia = hitungUsia(a.tanggal_lahir, sesi[0].tanggal_tes);
        var kelompok = usia <= 17 ? '≤17' : '>17';
        rows.push({
            no: rows.length + 1,
            id: a.id,
            nama: a.nama,
            cabor: a.cabor_nama,
            usia: usia,
            kelompok: kelompok,
            kelamin: a.jenis_kelamin,
            performa: ev.performa,
            kategori: ev.kategori
        });
    });

    var el = document.getElementById('pubTableBody');
    if (!el) return;
    el.innerHTML = rows.map(function(r) {
        return '<tr class="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onclick="showDetailPublik(\'' + r.id + '\')">' +
            '<td>' + r.no + '</td>' +
            '<td class="font-semibold">' + escHtml(r.nama) + '</td>' +
            '<td>' + escHtml(r.cabor) + '</td>' +
            '<td>' + r.usia + ' (' + r.kelompok + ')</td>' +
            '<td>' + escHtml(r.kelamin) + '</td>' +
            '<td class="font-semibold">' + r.performa + '%</td>' +
            '<td><span class="cat-badge cat-' + getCatColor(r.kategori) + '">' + r.kategori + '</span></td>' +
            '<td><button onclick="event.stopPropagation();showDetailPublik(\'' + r.id + '\')" class="btn btn-outline btn-sm">Detail</button></td>' +
            '</tr>';
    }).join('');
    document.getElementById('pubKosong').classList.toggle('hidden', rows.length > 0);
}

function showDetailPublik(atletId) {
    var a = findAtlet(atletId);
    if (!a) return;
    var sesi = listSesi(a.id);
    if (!sesi.length) return;
    var ev = evalSesi(sesi[0]);
    if (!ev) return;

    var usia = hitungUsia(a.tanggal_lahir, sesi[0].tanggal_tes);
    var kelompok = usia <= 17 ? '≤17' : '>17';

    var el = document.getElementById('detailSesiContent');
    el.innerHTML =
        '<div class="mb-4">' +
        '<p class="font-bold text-lg">' + escHtml(a.nama) + '</p>' +
        '<p class="text-slate-500 text-sm">' + escHtml(a.cabor_nama) + ' · Usia ' + usia + ' (' + kelompok + ') · ' + escHtml(a.jenis_kelamin) + '</p>' +
        '</div>' +
        '<div class="grid grid-cols-3 gap-4 mb-4">' +
        '<div class="stat-card"><p class="stat-label">Performa</p><p class="stat-value">' + ev.performa + '%</p></div>' +
        '<div class="stat-card"><p class="stat-label">Kategori</p><p class="stat-value text-sm"><span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span></p></div>' +
        kartuIMTHTML(ev) +
        '</div>' +
        '<p class="font-semibold text-sm mb-2">Detail per Item Tes</p>' +
        '<table class="data-table"><thead><tr><th>Item</th><th>Hasil</th><th>%</th><th>Kategori</th></tr></thead><tbody>' +
        evItemsTampil(ev).map(function(it) {
            return '<tr><td>' + escHtml(it.name) + '</td><td>' + formatHasilItem(it) + '</td><td>' + formatPctItem(it) + '</td><td>' + formatKatItem(it) + '</td></tr>';
        }).join('') + '</tbody></table>';
    openModal('modalDetailSesi');
}

// =====================================================================
// REKOMENDASI (Tamu - Read Only, rule-based)
// =====================================================================
var REKOMENDASI_KOMPONEN = {
    'Kekuatan': 'Fokus pada latihan kekuatan otot secara progresif: angkat beban dengan beban sedang (60-80% 1RM), 3-4 set x 8-12 repetisi, 2-3 kali per minggu. Sertakan latihan compound seperti squat, bench press, dan deadlift.',
    'Daya Ledak': 'Latih power dengan plyometrics: box jump, broad jump, medicine ball throw, dan clean & jerk. 3-5 set x 3-5 repetisi dengan intensitas tinggi dan istirahat cukup (2-3 menit).',
    'Daya Tahan': 'Tingkatkan daya tahan dengan latihan kardiovaskular interval: lari jarak jauh, berenang, atau bersepeda 3-5 kali per minggu. Kombinasikan dengan latihan circuit training untuk daya tahan otot.',
    'Kelincahan': 'Latih kelincahan dengan ladder drill, cone drill, shuttle run, dan latihan perubahan arah. 3-4 kali per minggu, 20-30 menit per sesi, fokus pada kecepatan reaksi dan koordinasi.',
    'Kecepatan': 'Tingkatkan kecepatan dengan sprint interval 20-60 meter, hill sprint, dan resisted running. 2-3 kali per minggu dengan istirahat penuh antar repetisi (2-3 menit).',
    'Fleksibilitas': 'Lakukan peregangan statis dan dinamis secara rutin setiap hari. Sertakan yoga atau pilates 2-3 kali per minggu untuk meningkatkan rentang gerak dan mencegah cedera.',
    'Keseimbangan': 'Latih keseimbangan dengan single-leg stand, BOSU ball exercise, balance board, dan pose yoga. Lakukan 3-4 kali per minggu, 10-15 menit per sesi.',
    'Daya Anaerob': 'Tingkatkan daya anaerob dengan interval training intensitas tinggi (HIIT): sprint 30-60 detik dengan istirahat 30-60 detik, 6-10 repetisi. Bisa juga dengan circuit training atau CrossFit-style workout.'
};

function populateRekAtlet() {
    var sel = document.getElementById('rekAtlet');
    if (!sel) return;
    var cur = sel.value;
    var q = ((document.getElementById('rekSearch') || {}).value || '').toLowerCase();
    var fc = ((document.getElementById('rekFilterCabor') || {}).value || '');
    // Isi filter cabor
    var selC = document.getElementById('rekFilterCabor');
    if (selC && selC.options.length <= 1) {
        listCabor().forEach(function(c) {
            selC.innerHTML += '<option>' + escHtml(c.nama) + '</option>';
        });
    }
    var list = listAtlet().filter(function(a) {
        if (!listSesi(a.id).length) return false;
        if (q && a.nama.toLowerCase().indexOf(q) < 0) return false;
        if (fc && a.cabor_nama !== fc) return false;
        return true;
    });
    sel.innerHTML = '<option value="">-- Pilih Atlet --</option>' +
        list.map(function(a) {
            return '<option value="' + a.id + '">' + escHtml(a.nama + ' · ' + a.cabor_nama) + '</option>';
        }).join('');
    if (cur && list.some(function(a) { return a.id === cur; })) sel.value = cur;
}

function renderRekomendasi() {
    var box = document.getElementById('rekHasil');
    if (!box) return;
    var atletId = document.getElementById('rekAtlet').value;
    if (!atletId) {
        box.innerHTML = '<div class="card"><div class="card-body"><p class="text-slate-400 text-center py-8">Pilih atlet untuk melihat rekomendasi</p></div></div>';
        return;
    }
    var a = findAtlet(atletId);
    if (!a) return;
    var sesi = listSesi(a.id);
    if (!sesi.length) {
        box.innerHTML = '<div class="card"><div class="card-body"><p class="text-slate-400 text-center py-8">Belum ada data tes</p></div></div>';
        return;
    }
    var ev = evalSesi(sesi[0]);
    if (!ev) return;

    var usia = hitungUsia(a.tanggal_lahir, sesi[0].tanggal_tes);
    var kelompokUsia = usia <= 17 ? 'u17' : 'o17';

    // Load template dari localStorage atau JSON
    var template = loadRekomendasiTemplate();

    // Kategori urutan: Kurang Sekali -> Baik Sekali
    var urutanKat = { 'Kurang Sekali': 0, 'Kurang': 1, 'Cukup': 2, 'Baik': 3, 'Baik Sekali': 4 };
    var kategoriIndo = ['Kurang Sekali', 'Kurang', 'Cukup', 'Baik', 'Baik Sekali'];

    // Susun item dengan rekomendasi
    var itemsDenganRekom = ev.items.map(function(it) {
        var kat = it.cat ? it.cat.label : null;
        // Kategori non-Indonesia (tabel norma RAST topendsports: Elite, Good, dst.)
        // dipetakan ke kategori Indonesia lewat persentase agar template, urutan,
        // dan ringkasan tetap jalan; badge tetap menampilkan label aslinya.
        var katId = null;
        if (kat) {
            katId = kategoriIndo.indexOf(kat) >= 0 ? kat
                : (it.pct != null ? getPctCategory(it.pct).label : null);
        }
        var tmpl = katId ? cariTemplate(it.name, katId, kelompokUsia) : null;
        if (!tmpl && katId) {
            console.warn('[Rekomendasi] Template tidak ditemukan: item=' + it.name + ' kategori=' + katId);
        }
        return {
            src: it,
            name: it.name,
            raw: it.raw,
            pct: it.pct,
            kat: kat,
            katId: katId,
            normaTidakAda: !!it.normaTidakAda,
            ikutPerforma: it.ikutPerforma !== false,
            tmpl: tmpl,
            komponen: (NORMA_ITEMS.find(function(x) { return itemKey(x.nama) === resolveItemAlias(it.name); }) || {}).komponen_fisik || '-'
        };
    });

    // Urutkan dari kategori terendah ke tertinggi
    itemsDenganRekom.sort(function(x, y) {
        var ox = urutanKat[x.katId] !== undefined ? urutanKat[x.katId] : 2.5;
        var oy = urutanKat[y.katId] !== undefined ? urutanKat[y.katId] : 2.5;
        return ox - oy;
    });

    // Ringkasan (item informasi & tanpa norma tidak masuk — kategori belum ada;
    // termasuk RAST Fatigue Index yang tampil di ringkasan tapi tidak dirata-ratakan)
    var prioritas = itemsDenganRekom.filter(function(i) {
        return i.katId === 'Kurang' || i.katId === 'Kurang Sekali';
    });
    var dipertahankan = itemsDenganRekom.filter(function(i) {
        return i.katId === 'Baik' || i.katId === 'Baik Sekali';
    });

    var html = '';

    // Ringkasan
    html += '<div class="card"><div class="card-header"><p class="font-bold">Ringkasan Performa</p></div><div class="card-body">' +
        '<div class="stat-grid-ringkas mb-4">' +
        '<div class="stat-card"><p class="stat-label">Atlet</p><p class="stat-value" title="' + escHtml(a.nama) + '">' + escHtml(a.nama) + '</p></div>' +
        '<div class="stat-card"><p class="stat-label">Cabor</p><p class="stat-value" title="' + escHtml(a.cabor_nama) + '">' + escHtml(a.cabor_nama) + '</p></div>' +
        '<div class="stat-card"><p class="stat-label">Performa</p><p class="stat-value">' + ev.performa + '%</p></div>' +
        '<div class="stat-card"><p class="stat-label">Kategori</p><p class="stat-value"><span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span></p></div>' +
        '</div>';

    if (prioritas.length > 0) {
        html += '<div class="rounded-xl border border-orange-200 bg-orange-50 p-3 mb-2">' +
            '<p class="font-semibold text-sm text-orange-800 rek-summary-note">Prioritas Pengembangan: ' +
            escHtml(prioritas.map(function(i) { return i.name + ' (' + i.kat + ')'; }).join(', ')) +
            '</p></div>';
    }
    if (dipertahankan.length > 0) {
        html += '<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">' +
            '<p class="font-semibold text-sm text-emerald-800 rek-summary-note">Dipertahankan: ' +
            escHtml(dipertahankan.map(function(i) { return i.name; }).join(', ')) +
            '</p></div>';
    }
    html += '</div></div>';

    // Tabel rekomendasi per item
    html += '<div class="card"><div class="card-header"><p class="font-bold">Rekomendasi per Item Tes</p></div><div class="card-body table-scroll">' +
        '<table class="data-table"><thead><tr>' +
        '<th>Item</th><th>Nilai</th><th>%</th><th>Kategori</th><th>Rekomendasi</th><th>Referensi</th>' +
        '</tr></thead><tbody>';

    itemsDenganRekom.forEach(function(it) {
        var katBadge = it.normaTidakAda ? 'Norma belum diatur'
            : (it.kat ? '<span class="cat-badge cat-' + getCatColor(it.kat) + '">' + it.kat + '</span>' : 'Tidak ada kategori');

        var rekHtml = '';
        if (it.tmpl) {
            rekHtml = '<div class="text-xs space-y-1">' +
                '<p><strong>Interpretasi:</strong> ' + escHtml(it.tmpl.interpretasi) + '</p>' +
                '<p><strong>Sasaran:</strong> ' + escHtml(it.tmpl.sasaran) + '</p>' +
                '<p><strong>Contoh Latihan:</strong> ' + escHtml(it.tmpl.contoh) + '</p>' +
                '<p><strong>Keamanan:</strong> ' + escHtml(it.tmpl.keamanan) + '</p>' +
                '</div>';
        } else {
            rekHtml = '<span class="text-slate-400 text-xs">Rekomendasi belum tersedia untuk item ini</span>';
        }

        var refHtml = '';
        if (it.tmpl && it.tmpl.referensi && it.tmpl.referensi.length > 0) {
            refHtml = '<button onclick="showReferensi(\'' + escHtml(JSON.stringify(it.tmpl.referensi)) + '\')" class="btn btn-outline btn-sm text-xs">Referensi</button>';
        } else {
            refHtml = '<span class="text-slate-300 text-xs">-</span>';
        }

        html += '<tr class="border-t border-slate-100">' +
            '<td class="font-semibold">' + escHtml(it.name) + '</td>' +
            '<td>' + formatHasilItem(it.src) + '</td>' +
            '<td>' + formatPctItem(it.src) + '</td>' +
            '<td>' + katBadge + '</td>' +
            '<td>' + rekHtml + '</td>' +
            '<td>' + refHtml + '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div></div>';

    // Catatan
    html += '<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">' +
        '<p class="text-xs text-slate-500">Rekomendasi bersifat umum berdasarkan hasil tes, konsultasikan dengan pelatih. Cedera atau nyeri diarahkan ke tenaga medis atau fisioterapis.</p>' +
        '</div>';

    box.innerHTML = html;
}

function showReferensi(refJson) {
    try {
        var refKeys = JSON.parse(refJson);
        var allRefs = (window.REKOMENDASI_REFERENSI || {});
        var html = '<ul class="space-y-2">';
        refKeys.forEach(function(k) {
            var r = allRefs[k];
            if (!r) return;
            html += '<li class="text-sm border-l-4 border-blue-300 pl-3 py-1">' +
                '<span class="font-semibold">' + escHtml(r.penulis) + '</span> (' + r.tahun + '). ' +
                escHtml(r.judul) + '. <em>' + escHtml(r.jurnal) + '</em>.' +
                (r.doi ? ' DOI: ' + escHtml(r.doi) : '') +
                ' <span class="cat-badge ' + (r.status === 'terverifikasi' ? 'cat-emerald' : 'cat-amber') + '">' + r.status + '</span>' +
                '</li>';
        });
        html += '</ul>';
        document.getElementById('detailSesiContent').innerHTML = '<h3 class="font-bold text-lg mb-4">Daftar Referensi</h3>' + html;
        openModal('modalDetailSesi');
    } catch (e) {}
}

// =====================================================================
// TEMPLATE REKOMENDASI (superadmin)
// =====================================================================
var REKOMENDASI_TEMPLATE_CACHE = null;
var REKOMENDASI_REFERENSI = {};

// Normalisasi kunci template ke format itemKey agar cocok dengan lookup
function normalizeTemplateKeys(rawTemplate) {
    var out = {};
    Object.keys(rawTemplate || {}).forEach(function(k) {
        out[itemKey(k)] = rawTemplate[k];
    });
    return out;
}

// Alias untuk variasi penamaan umum
var ITEM_ALIASES = {
    'sprint 20m': 'sprint 20 m',
    'sprint 30m': 'sprint 30 m',
    'sprint 20 meter': 'sprint 20 m',
    'sprint 30 meter': 'sprint 30 m',
    'rast avg power': 'rast_avg_power',
    'rast peak power': 'rast_avg_power',
    'rast relative peak power': 'rast_avg_power',
    'rast average power': 'rast_avg_power',
    'rast fatigue index': 'rast_fatigue_index',
    'vertical jump (power)': 'vertical jump',
    'vertical_jump_power': 'vertical jump'
};

function resolveItemAlias(name) {
    var k = itemKey(name);
    return ITEM_ALIASES[k] || k;
}

function loadRekomendasiTemplate() {
    if (REKOMENDASI_TEMPLATE_CACHE && REKOMENDASI_TEMPLATE_CACHE._normalized) return REKOMENDASI_TEMPLATE_CACHE.template;
    var data = null;
    try {
        var raw = localStorage.getItem('rekomendasi_template_v1');
        if (raw) data = JSON.parse(raw);
    } catch (e) {}
    if (!data || !data.template || !Object.keys(data.template).length) {
        data = window.__REKOMENDASI_JSON || null;
    }
    if (!data || !data.template) data = { template: {}, referensi: {} };
    // Normalisasi kunci: display name -> itemKey + alias
    var normalized = normalizeTemplateKeys(data.template);
    // ID baru: bila belum ada di data tersimpan, pakai isi template lama sebagai dasar
    var legacyBaru = { 'rast_avg_power': 'rast test', 'rast_fatigue_index': 'rast fatigue index' };
    Object.keys(legacyBaru).forEach(function(id) {
        if (!normalized[id] && normalized[legacyBaru[id]]) normalized[id] = normalized[legacyBaru[id]];
    });
    // Tambahkan alias sebagai pointer
    Object.keys(ITEM_ALIASES).forEach(function(alias) {
        var target = ITEM_ALIASES[alias];
        if (normalized[target] && !normalized[alias]) {
            normalized[alias] = normalized[target];
        }
    });
    // Lengkapi kunci yang belum ada dari template bawaan (JSON) tanpa menimpa isi tersimpan
    if (window.__REKOMENDASI_JSON && window.__REKOMENDASI_JSON.template) {
        var bawaan = normalizeTemplateKeys(window.__REKOMENDASI_JSON.template);
        Object.keys(bawaan).forEach(function(k) {
            if (!normalized[k]) normalized[k] = bawaan[k];
        });
    }
    REKOMENDASI_TEMPLATE_CACHE = { template: normalized, referensi: data.referensi || {}, _normalized: true };
    REKOMENDASI_REFERENSI = REKOMENDASI_TEMPLATE_CACHE.referensi;
    return normalized;
}

// Cari template dengan fallback berjenjang: item+kategori+usia -> item+kategori+umum -> komponen+kategori
function cariTemplate(itemName, kategori, kelompokUsia) {
    var template = loadRekomendasiTemplate();
    var k = resolveItemAlias(itemName);
    // 1. Item + kategori + kelompok usia
    if (template[k] && template[k][kategori] && template[k][kategori][kelompokUsia]) {
        return template[k][kategori][kelompokUsia];
    }
    // 2. Item + kategori + umum
    if (template[k] && template[k][kategori] && template[k][kategori].umum) {
        return template[k][kategori].umum;
    }
    // 3. Komponen fisik + kategori (fallback)
    var komponen = (NORMA_ITEMS.find(function(x) { return itemKey(x.nama) === k; }) || {}).komponen_fisik;
    if (komponen && template[itemKey(komponen)] && template[itemKey(komponen)][kategori]) {
        var t = template[itemKey(komponen)][kategori];
        return t[kelompokUsia] || t.umum || null;
    }
    return null;
}

function switchRekTab(tab) {
    var isAdmin = currentUser() && currentUser().role === 'superadmin';
    document.getElementById('rekTabAtletContent').classList.toggle('hidden', tab !== 'atlet');
    document.getElementById('rekTabTemplateContent').classList.toggle('hidden', tab !== 'template' || !isAdmin);
    document.getElementById('rekTabAtlet').classList.toggle('active', tab === 'atlet');
    document.getElementById('rekTabTemplate').classList.toggle('active', tab === 'template');
    if (tab === 'template' && isAdmin) renderTemplateEditor();
}

function renderTemplateEditor() {
    var itemSel = document.getElementById('rekTemplateItem');
    var katSel = document.getElementById('rekTemplateKategori');
    if (!itemSel) return;

    // Isi dropdown item (sekali)
    if (itemSel.options.length <= 0) {
        var template = loadRekomendasiTemplate();
        var items = Object.keys(template).sort();
        itemSel.innerHTML = items.map(function(n) { return '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>'; }).join('');
    }
    if (katSel.options.length <= 0) {
        katSel.innerHTML = ['Baik Sekali', 'Baik', 'Cukup', 'Kurang', 'Kurang Sekali'].map(function(k) {
            return '<option>' + k + '</option>';
        }).join('');
    }

    var nama = itemSel.value;
    var kat = katSel.value;
    var usia = document.getElementById('rekTemplateUsia').value;
    var template = loadRekomendasiTemplate();

    var data = (template[nama] && template[nama][kat] && template[nama][kat][usia]) || {};

    document.getElementById('rekTemplateEditor').innerHTML =
        '<div><label class="form-label">Ringkasan Interpretasi</label>' +
        '<textarea id="tplInterpretasi" class="form-input" rows="2">' + escHtml(data.interpretasi || '') + '</textarea></div>' +
        '<div><label class="form-label">Sasaran Latihan</label>' +
        '<textarea id="tplSasaran" class="form-input" rows="2">' + escHtml(data.sasaran || '') + '</textarea></div>' +
        '<div><label class="form-label">Contoh Bentuk Latihan</label>' +
        '<textarea id="tplContoh" class="form-input" rows="2">' + escHtml(data.contoh || '') + '</textarea></div>' +
        '<div><label class="form-label">Catatan Keamanan</label>' +
        '<textarea id="tplKeamanan" class="form-input" rows="2">' + escHtml(data.keamanan || '') + '</textarea></div>' +
        '<div><label class="form-label">Referensi (kunci, pisahkan dengan koma)</label>' +
        '<input id="tplReferensi" class="form-input" value="' + escHtml((data.referensi || []).join(', ')) + '"></div>' +
        '<button onclick="simpanTemplateItem()" class="btn btn-primary btn-sm">Simpan Item Ini</button>';
}

function simpanTemplateItem() {
    if (!canWrite()) return alert('Akses ditolak');
    var nama = document.getElementById('rekTemplateItem').value;
    var kat = document.getElementById('rekTemplateKategori').value;
    var usia = document.getElementById('rekTemplateUsia').value;
    var template = loadRekomendasiTemplate();

    if (!template[nama]) template[nama] = {};
    if (!template[nama][kat]) template[nama][kat] = {};
    if (!template[nama][kat][usia]) template[nama][kat][usia] = {};

    template[nama][kat][usia] = {
        interpretasi: document.getElementById('tplInterpretasi').value,
        sasaran: document.getElementById('tplSasaran').value,
        contoh: document.getElementById('tplContoh').value,
        keamanan: document.getElementById('tplKeamanan').value,
        referensi: document.getElementById('tplReferensi').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
    };

    REKOMENDASI_TEMPLATE_CACHE.template = template;
    try {
        localStorage.setItem('rekomendasi_template_v1', JSON.stringify(REKOMENDASI_TEMPLATE_CACHE));
        document.getElementById('rekTemplateStatus').textContent = 'Tersimpan ' + new Date().toLocaleTimeString();
    } catch (e) {
        document.getElementById('rekTemplateStatus').textContent = 'Gagal menyimpan';
    }
}

function simpanTemplate() {
    if (!canWrite()) return alert('Akses ditolak');
    simpanTemplateItem();
}

function isiOtomatisTemplate() {
    if (!canWrite()) return alert('Akses ditolak');
    if (!confirm('Isi otomatis akan menimpa template yang sudah ada. Lanjutkan?')) return;
    // Load template bawaan dari JSON
    if (!window.__REKOMENDASI_JSON) {
        fetch('data/rekomendasi-template.json').then(function(r) { return r.json(); }).then(function(j) {
            window.__REKOMENDASI_JSON = j;
            REKOMENDASI_TEMPLATE_CACHE = null; // reset cache
            try { localStorage.setItem('rekomendasi_template_v1', JSON.stringify(j)); } catch (e) {}
            renderTemplateEditor();
            document.getElementById('rekTemplateStatus').textContent = 'Template diisi otomatis';
        });
    } else {
        REKOMENDASI_TEMPLATE_CACHE = null; // reset cache
        try { localStorage.setItem('rekomendasi_template_v1', JSON.stringify(window.__REKOMENDASI_JSON)); } catch (e) {}
        renderTemplateEditor();
        document.getElementById('rekTemplateStatus').textContent = 'Template diisi otomatis';
    }
}

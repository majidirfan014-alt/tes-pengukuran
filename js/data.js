// =====================================================================
// data.js — MESIN NORMA & RUMUS (satu sumber kebenaran)
// Sumber: data/norma_tes_koni_tuban.json (dari Norma_Tes_KONI_Tuban_2026-10-18.csv)
// Semua perhitungan & tampilan menu Norma Tes membaca dari sini.
// =====================================================================
'use strict';

// --- Konfigurasi pusat ---
var PCT_KATEGORI = [
    { minPct: 90, minZ: 2, label: 'Baik Sekali', color: 'emerald' },
    { minPct: 60, minZ: 0.25, label: 'Baik', color: 'blue' },
    { minPct: 40, minZ: -0.75, label: 'Cukup', color: 'amber' },
    { minPct: 20, minZ: -1.75, label: 'Kurang', color: 'orange' },
    { minPct: -Infinity, minZ: -Infinity, label: 'Kurang Sekali', color: 'red' }
];

var WARNA_KATEGORI = {
    'Baik Sekali': 'emerald', 'Baik': 'blue', 'Cukup': 'amber',
    'Kurang': 'orange', 'Kurang Sekali': 'red'
};

// Bleep Test: balikan maksimal per level 1-21
var BLEEP_MAKS_SHUTTLE = [7, 8, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16];

// IMT (Indeks Massa Tubuh) — standar WHO dewasa (usia >= 18)
var IMT_KATEGORI = [
    { max: 18.5, label: 'Berat badan kurang' },
    { max: 25.0, label: 'Normal' },
    { max: 30.0, label: 'Berat badan berlebih' },
    { max: Infinity, label: 'Obesitas' }
];

// Keterangan bila usia < 18 tahun (ambang anak BELUM diaktifkan — jangan mengarang tabel WHO anak)
var IMT_KATEGORI_ANAK_NOTE = 'Kategori anak/remaja memakai IMT menurut umur (standar WHO) - belum diaktifkan';

var RAST_FI_IKUT_PERFORMA = false;
// =====================================================================
// NORMA RAST — topendsports.com (Draper & Whyte, 1997)
// SATU konstanta/config untuk semua batas, persentase, dan kategori RAST:
// - relativePeak: Relative Peak Power (W/kg), makin tinggi makin baik
// - fatigue: Fatigue Index (W/s), makin rendah makin baik
// anchors = titik [batas nilai, persentase]; persentase antar titik dihitung
// dengan interpolasi linear, di luar rentang ekstrapolasi segmen terluar,
// hasil di-clamp 0-100 dan dibulatkan 1 desimal.
// batas = aturan kategori berurutan dari yang paling tinggi mutunya;
// open = batas tidak ikut (strict). Cabor dengan norma khusus KONI (dipakai)
// tetap memakai z-score; cabor lain memakai tabel ini (norma cadangan z-score
// umum sudah dihapus — lihat normaRast).
// =====================================================================
var RAST_NORMA_TOPENDSPORTS = {
    sumberTeks: 'Norma: topendsports.com (Draper & Whyte, 1997)',
    relativePeak: {
        anchors: [[8, 20], [11, 50], [14, 80], [17, 95]],
        batas: [
            { min: 17, open: true, label: 'Elite', color: 'emerald' },
            { min: 14, label: 'Excellent', color: 'emerald' },
            { min: 11, label: 'Good', color: 'blue' },
            { min: 8, label: 'Average', color: 'amber' },
            { label: 'Below Average', color: 'red' }
        ]
    },
    fatigue: {
        anchors: [[8, 80], [10, 50], [12, 20]],
        batas: [
            { max: 8, open: true, label: 'Excellent', color: 'emerald' },
            { max: 10, label: 'Good', color: 'blue' },
            { max: 12, label: 'Average', color: 'amber' },
            { label: 'Needs Improvement', color: 'red' }
        ]
    }
};
// Override norma power Vertical Jump (diisi kelak bila ada mean/sd power resmi).
// Isi: { mean: <watt>, sd: <watt> }. null = pakai turunan rumus Lewis dari norma cm.
var VJ_POWER_NORMA_OVERRIDE = null;
// Rumus 13 (penambahan; rumus 1-12 tidak diubah) untuk halaman Norma Tes & unduhan
var RUMUS_LEWIS = {
    no: 13,
    judul: '13. Power Vertical Jump (Lewis, 1974)',
    rumus: 'Power (kg.m/s) = akar(4,9) x berat badan (kg) x akar(tinggi lompatan (m)) | Power (Watt) = Power (kg.m/s) x 9,81',
    penjelasan: 'Tinggi lompatan (h) dipakai dalam satuan meter sesuai input atlet (mis. 0,40 m) — langsung dipakai tanpa konversi. Dipakai untuk menilai item "Vertical Jump (Power)" (1 Watt). Norma power diturunkan dari norma Vertical Jump (cm, sheet KONI) yang dikonversikan ke meter: mean_P = Lewis(mean_cm/100, BB), sd_P = (Lewis((mean_cm + sd_cm)/100, BB) - Lewis(max(mean_cm - sd_cm, 0)/100, BB)) / 2 sesuai berat badan atlet; bukan norma resmi KONI.',
    contoh: 'Berat 60 kg, tinggi 40 cm -> 0,40 m: akar(4,9) x 60 x akar(0,40) = 84,0 kg.m/s -> x 9,81 = 824,0 Watt'
};

// Normalisasi input angka: terima koma atau titik desimal, teks atau angka
function parseAngkaDesimal(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    var s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return NaN;
    return parseFloat(s);
}

// SATU fungsi pusat IMT. Urutan argumen: hitungIMT(beratKg, tinggiCm).
// - tinggi dalam cm; jika < 3 dianggap meter (1.70 -> 170)
// - rentang wajar: tinggi 50-250 cm, berat 10-300 kg; di luar itu / kosong / 0 -> null (tidak dihitung)
function hitungIMT(beratKg, tinggiCm) {
    var b = parseAngkaDesimal(beratKg);
    var t = parseAngkaDesimal(tinggiCm);
    if (isNaN(t) || isNaN(b)) return null;
    if (t > 0 && t < 3) t = t * 100; // meter -> cm
    if (t < 50 || t > 250) return null;
    if (b < 10 || b > 300) return null;
    var m = t / 100;
    return Math.round((b / (m * m)) * 10) / 10;
}

// Ambang dewasa (IMT_KATEGORI) — hanya untuk usia >= 18
function getIMTKategori(imt) {
    if (imt === null || imt === undefined || isNaN(imt)) return '';
    for (var i = 0; i < IMT_KATEGORI.length; i++) {
        if (imt < IMT_KATEGORI[i].max) return IMT_KATEGORI[i].label;
    }
    return IMT_KATEGORI[IMT_KATEGORI.length - 1].label;
}

// Kategori IMT sadar usia:
// - usia >= 18 -> ambang WHO dewasa
// - 0 < usia < 18 -> tanpa label dewasa + keterangan kategori anak belum aktif
// - usia tidak ada (0/undefined, mis. tanggal lahir kosong) -> nilai saja tanpa kategori
function kategoriIMT(imt, usia) {
    if (imt === null || imt === undefined || isNaN(imt)) return { label: '', catatan: '' };
    if (usia >= 18) return { label: getIMTKategori(imt), catatan: '' };
    if (usia > 0 && usia < 18) return { label: '', catatan: IMT_KATEGORI_ANAK_NOTE };
    return { label: '', catatan: '' };
}

// Data mentah dari JSON
var NORMA_JSON = null;
var NORMA_ROWS = [];       // 112 baris sheet Norma
var NORMA_ITEMS = [];      // 43 baris sheet Item Tes
var NORMA_RUMUS = [];      // 12 rumus dari JSON (renderRumusKartu menambah Lewis no.13)
var NORMA_KETERANGAN = []; // 27 keterangan
var NORMA_INDEX = {};      // itemKey -> { nama, gender, arah, grup{u17,o17}{varian} }

// =====================================================================
// LOADER
// =====================================================================
function terapkanNormaDariJSON(json) {
    NORMA_JSON = json;
    NORMA_ROWS = (json.norma || []).slice();
    NORMA_ITEMS = (json.items || []).slice();
    NORMA_RUMUS = (json.rumus || []).slice();
    NORMA_KETERANGAN = (json.keterangan || []).slice();

    // Bangun NORMA_INDEX dari items + norma
    var idx = {};
    (json.items || []).forEach(function(it) {
        var k = itemKey(it.nama);
        var gender = '';
        if (it.berlaku_untuk === 'Perempuan') gender = 'Perempuan';
        else if (it.berlaku_untuk === 'Laki-laki') gender = 'Laki-laki';
        var arah = null;
        if (it.arah_nilai === 'Makin tinggi makin baik') arah = true;
        else if (it.arah_nilai === 'Makin rendah makin baik') arah = false;
        idx[k] = {
            nama: it.nama, gender: gender, arah: arah,
            satuan: it.satuan, komponen: it.komponen_fisik,
            grup: { u17: {}, o17: {} }
        };
    });
    (json.norma || []).forEach(function(n) {
        var k = itemKey(n.item);
        if (!idx[k]) return;
        var grup = (n.kelompok || '').indexOf('<= 17') >= 0 ? 'u17' : 'o17';
        var varian = 'umum';
        if ((n.sumber || '').indexOf('atletikNomor') >= 0) varian = 'khusus_nomor_atletik';
        else if ((n.sumber || '').indexOf('NORMA_ITEM_KELAMIN') >= 0) varian = 'kelamin';
        if (n.mean !== null && n.sd !== null) {
            idx[k].grup[grup][varian] = { mean: n.mean, sd: n.sd, varian: varian, dipakai: n.dipakai || null };
        }
    });
    NORMA_INDEX = idx;

    // Override PCT_KATEGORI dari JSON jika ada
    var kat = (json.konfigurasi && json.konfigurasi.kategori_dari_persen) || [];
    var kz = (json.konfigurasi && json.konfigurasi.breakpoint_z_kategori) || {};
    if (kat.length >= 5) {
        var zList = [kz.baik_sekali, kz.baik, kz.cukup, kz.kurang];
        PCT_KATEGORI = kat.map(function(kk, i) {
            return {
                minPct: i < 4 ? kk.min_persen : -Infinity,
                minZ: i < 4 ? zList[i] : -Infinity,
                label: kk.kategori,
                color: WARNA_KATEGORI[kk.kategori] || 'slate'
            };
        });
    }
    if (json.konfigurasi && json.konfigurasi.bleep_maks_shuttle) {
        BLEEP_MAKS_SHUTTLE = json.konfigurasi.bleep_maks_shuttle.slice();
    }
}

function muatNormaDariJSON(setelah) {
    function pakai(json) {
        terapkanNormaDariJSON(json);
        try { localStorage.setItem('norma_json_v1', JSON.stringify(json)); } catch (e) {}
        if (setelah) setelah(true);
    }
    function cadangan() {
        try {
            var cache = localStorage.getItem('norma_json_v1');
            if (cache) { pakai(JSON.parse(cache)); return; }
        } catch (e) {}
        if (setelah) setelah(false);
    }
    fetch('data/norma_tes_koni_tuban.json?v=20261021vjmeter')
        .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(pakai)
        .catch(cadangan);
}

// =====================================================================
// UTILITAS
// =====================================================================
function itemKey(name) {
    return String(name || '')
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .toLowerCase()
        .replace(/\s+/g, ' ').trim();
}

function bulat1(x) {
    var n = parseFloat(x);
    if (!isFinite(n)) return 0;
    return Number(Math.round(Number(n + 'e1')) + 'e-1');
}

function fmtNumKoma(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    var r = Math.round(Number(n) * 100) / 100;
    var s = String(r);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
}

function isUsiaMuda(usia) {
    if (usia == null || usia === '') return false;
    var n = parseFloat(usia);
    return !isNaN(n) && n <= 17;
}

// =====================================================================
// KATEGORI DARI PERSENTASE (rumus no. 4)
// =====================================================================
function getPctCategory(pct) {
    for (var i = 0; i < PCT_KATEGORI.length; i++) {
        if (pct >= PCT_KATEGORI[i].minPct) return { label: PCT_KATEGORI[i].label, color: PCT_KATEGORI[i].color };
    }
    return { label: 'Kurang Sekali', color: 'red' };
}

// =====================================================================
// RENTANG KATEGORI (rumus no. 5) — turunan dari mean & sd
// =====================================================================
function normaBatasKategori(mean, sd) {
    var b = [];
    for (var i = 0; i < 4; i++) b.push(mean + PCT_KATEGORI[i].minZ * sd);
    return b;
}

function normaRentangKategori(mean, sd, higher) {
    if (mean === null || mean === undefined || isNaN(parseFloat(mean))) return null;
    var m = parseFloat(mean), s = parseFloat(sd);
    if (!s || isNaN(s) || s <= 0) return null;
    var b = normaBatasKategori(m, s);
    function f(x) { return fmtNumKoma(x); }
    if (higher) {
        return [
            '>= ' + f(b[0]),
            '>= ' + f(b[1]) + ' dan < ' + f(b[0]),
            '>= ' + f(b[2]) + ' dan < ' + f(b[1]),
            '>= ' + f(b[3]) + ' dan < ' + f(b[2]),
            '< ' + f(b[3])
        ];
    }
    var c = b.map(function(x) { return 2 * m - x; });
    return [
        '<= ' + f(c[0]),
        '> ' + f(c[0]) + ' dan <= ' + f(c[1]),
        '> ' + f(c[1]) + ' dan <= ' + f(c[2]),
        '> ' + f(c[2]) + ' dan <= ' + f(c[3]),
        '> ' + f(c[3])
    ];
}

// =====================================================================
// ARAH NILAI
// =====================================================================
function resolveArahGlobal(name) {
    var e = NORMA_INDEX[itemKey(name)];
    if (e && e.arah !== null && e.arah !== undefined) return e.arah;
    var li = itemKey(name);
    // Default berdasarkan jenis item
    if (li.indexOf('sprint') >= 0 || li.indexOf('agility') >= 0 || li.indexOf('zig zag') >= 0 ||
        li.indexOf('shuttle run') >= 0 || li.indexOf('shoulder mobility') >= 0) return false;
    return true;
}

// =====================================================================
// GET NORMA — satu pintu baca norma
// =====================================================================
function getNorma(item, usia, jenisKelamin, owner) {
    var k = itemKey(item);
    var e = NORMA_INDEX[k];
    if (!e) return null;
    // Cek gender
    if (e.gender) {
        if (!jenisKelamin) return { butuhGender: true };
        if (e.gender.toLowerCase() !== String(jenisKelamin).toLowerCase()) return null;
    }
    var grup = isUsiaMuda(usia) ? 'u17' : 'o17';
    var peta = e.grup[grup] || {};
    // Prioritas: khusus_nomor_atletik (jika owner Atletik), lalu umum, lalu kelamin
    var khusus = owner && owner.jenis === 'nomor' && owner.nomor &&
        ['Lompat Tinggi', '5000m & 3000m', 'Dasa Lomba', 'Lempar Lembing'].indexOf(owner.nomor) >= 0;
    var d = (khusus && peta.khusus_nomor_atletik) ? peta.khusus_nomor_atletik : (peta.umum || peta.kelamin || null);
    if (d && !isNaN(parseFloat(d.mean)) && parseFloat(d.sd) > 0) {
        return {
            mean: parseFloat(d.mean), sd: parseFloat(d.sd),
            arah: e.arah, sumber: 'JSON', varian: d.varian || 'umum', nama: e.nama,
            dipakai: d.dipakai || null
        };
    }
    return null;
}

// Norma RAST khusus KONI hanya berlaku untuk cabor dalam daftar "dipakai"
// (bila ada daftarnya). Cabor lain TIDAK memakai norma KONI — penilaian
// memakai tabel topendsports (RAST_NORMA_TOPENDSPORTS).
function normaRast(s, cabor) {
    if (!s) return null;
    if (!s.dipakai || !cabor) return s;
    if (s.dipakai.indexOf(cabor) >= 0) return s;
    return null;
}

function itemKelamin(name) {
    var e = NORMA_INDEX[itemKey(name)];
    return (e && e.gender) ? e.gender : '';
}

// =====================================================================
// RUMUS 2 & 3: KONVERSI Z KE PERSENTASE
// =====================================================================
function calcItemPct(name, raw, mean, sd, higherIsBetter) {
    if (sd <= 0) return null;
    var z = (raw - mean) / sd;
    var pct;
    if (higherIsBetter) {
        if (z >= 3) pct = 100;
        else if (z >= 2) pct = 90 + ((z - 2) * 10);
        else if (z >= 1) pct = 75 + ((z - 1) * 15);
        else if (z >= 0) pct = 55 + (z * 20);
        else if (z >= -1) pct = 35 + ((z + 1) * 20);
        else if (z >= -2) pct = 15 + ((z + 2) * 20);
        else pct = Math.max(0, 5 + ((z + 3) * 10));
    } else {
        if (z <= -3) pct = 100;
        else if (z <= -2) pct = 90 + ((-2 - z) * 10);
        else if (z <= -1) pct = 75 + ((-1 - z) * 15);
        else if (z <= 0) pct = 55 + (-z * 20);
        else if (z <= 1) pct = 35 + ((1 - z) * 20);
        else if (z <= 2) pct = 15 + ((2 - z) * 20);
        else pct = Math.max(0, 5 + ((3 - z) * 10));
    }
    return Math.min(Math.max(pct, 0), 100);
}

// =====================================================================
// RUMUS 6: BLEED TEST → VO2max
// =====================================================================
function maksShuttleBleep(level) {
    var n = parseInt(level, 10);
    if (isNaN(n) || n < 1 || n > BLEEP_MAKS_SHUTTLE.length) return null;
    return BLEEP_MAKS_SHUTTLE[n - 1];
}

function bleepVO2max(level, shuttle) {
    level = parseInt(level, 10); shuttle = parseInt(shuttle, 10);
    if (isNaN(level) || isNaN(shuttle) || level < 1 || level > 21) return null;
    var maxSh = maksShuttleBleep(level);
    if (maxSh == null) return null;
    if (isNaN(shuttle) || shuttle < 0) shuttle = 0;
    shuttle = Math.min(shuttle, maxSh);
    return +(3.46 * (level + shuttle / maxSh) + 12.2).toFixed(1);
}

// =====================================================================
// RUMUS 7: SHOULDER MOBILITY → SKOR BROCKPORT
// =====================================================================
function getBrockportScore(distanceCm) {
    if (distanceCm === 0) return 3;
    if (distanceCm <= 5) return 2.5;
    if (distanceCm <= 10) return 2;
    if (distanceCm <= 15) return 1.5;
    if (distanceCm <= 20) return 1;
    if (distanceCm <= 25) return 0.5;
    return 0;
}

// =====================================================================
// RUMUS 8 & 9: RAST TEST & FATIGUE INDEX
// =====================================================================
var RAST_MAKS_WKG = 50;

function rastCompute(weightKg, times) {
    var w = parseFloat(weightKg);
    if (!(w > 0)) return null;
    var powers = [], ok = true, totalTime = 0;
    (times || []).forEach(function(t) {
        t = parseFloat(t);
        if (!(t > 0)) { ok = false; return; }
        powers.push(+((w * 35 * 35) / (t * t * t)).toFixed(1));
        totalTime += t;
    });
    if (!ok || powers.length !== 6) return null;
    totalTime = +totalTime.toFixed(2);
    var peak = Math.max.apply(null, powers);
    var min = Math.min.apply(null, powers);
    var avg = +(powers.reduce(function(a, b) { return a + b; }, 0) / powers.length).toFixed(1);
    var avgRel = +(avg / w).toFixed(2);
    var peakRel = +(peak / w).toFixed(2);
    var fatigue = totalTime > 0 ? +((peak - min) / totalTime).toFixed(2) : 0;
    return { powers: powers, peak: peak, min: min, avg: avg, avgRel: avgRel, peakRel: peakRel, totalTime: totalTime, fatigue: fatigue };
}

// =====================================================================
// NORMA TOPENDSPORTS (RAST): interpolasi persentase + kategori
// =====================================================================
function pctInterpolasiNorma(anchors, v) {
    v = parseFloat(v);
    if (isNaN(v) || !anchors || anchors.length < 2) return null;
    var n = anchors.length, pct;
    if (v <= anchors[0][0]) {
        var s0 = (anchors[1][1] - anchors[0][1]) / (anchors[1][0] - anchors[0][0]);
        pct = anchors[0][1] + (v - anchors[0][0]) * s0;
    } else if (v >= anchors[n - 1][0]) {
        var s1 = (anchors[n - 1][1] - anchors[n - 2][1]) / (anchors[n - 1][0] - anchors[n - 2][0]);
        pct = anchors[n - 1][1] + (v - anchors[n - 1][0]) * s1;
    } else {
        for (var i = 0; i < n - 1; i++) {
            if (v <= anchors[i + 1][0]) {
                pct = anchors[i][1] + (v - anchors[i][0]) *
                    ((anchors[i + 1][1] - anchors[i][1]) / (anchors[i + 1][0] - anchors[i][0]));
                break;
            }
        }
    }
    return bulat1(Math.min(Math.max(pct, 0), 100));
}

function kategoriDariTabel(batas, v) {
    v = parseFloat(v);
    for (var i = 0; i < batas.length; i++) {
        var b = batas[i], cocok;
        if (b.min !== undefined) cocok = b.open ? v > b.min : v >= b.min;
        else if (b.max !== undefined) cocok = b.open ? v < b.max : v <= b.max;
        else cocok = true;
        if (cocok) return { label: b.label, color: b.color };
    }
    var last = batas[batas.length - 1];
    return { label: last.label, color: last.color };
}

// Fungsi pusat hitung RAST (rumus 8 & 9) — dipakai kalkulator, form, dan evaluasi
function hitungRAST(weightKg, times) {
    return rastCompute(weightKg, times);
}

// =====================================================================
// RUMUS 11: RINGKASAN PERFORMA
// =====================================================================
function ringkasanDariPersen(daftar) {
    var total = 0, cnt = 0;
    (daftar || []).forEach(function(p) {
        if (p === null || p === undefined || isNaN(parseFloat(p))) return;
        total += parseFloat(p);
        cnt++;
    });
    var totalSkor = bulat1(total);
    var performa = cnt > 0 ? bulat1((total / (cnt * 100)) * 100) : 0;
    return {
        totalSkor: totalSkor,
        performa: performa,
        kategori: getPctCategory(performa).label,
        jumlahItem: cnt
    };
}

// =====================================================================
// EVALUASI SATU SESI TES
// =====================================================================
function computeEvaluation(a) {
    var items = [];
    var peringatan = [];
    var kelamin = a.kelamin || '';
    var ownerNorma = a.owner || null;
    var evalItems = a.items || [];
    var nilai = a.nilai || {};

    // % Performance override: jika ada nilai dari Excel, pakai langsung
    var overridePct = null;
    if (nilai['% Performance'] !== undefined && nilai['% Performance'] !== null) {
        var vOvr = parseFloat(nilai['% Performance']);
        if (!isNaN(vOvr)) overridePct = bulat1(vOvr);
    }

    var dR = nilai['RAST Data'];
    var rastDone = false;
    function evalRastRows(name) {
        if (rastDone) return;
        rastDone = true;
        var tpe = RAST_NORMA_TOPENDSPORTS;

        // Berat untuk hitung RAST: dari data mentah, fallback berat badan sesi
        // (sudah di-resolve evalSesi: sesi -> catatan terbaru atlet).
        var beratRast = (dR && parseFloat(dR.berat) > 0) ? dR.berat : a.beratKg;
        var rr = (dR && dR.waktu && dR.waktu.length === 6 && parseFloat(beratRast) > 0)
            ? hitungRAST(beratRast, dR.waktu) : null;
        var manual = parseAngkaDesimal(nilai['RAST Test']);
        var fiLegacy = parseAngkaDesimal(nilai['RAST Fatigue Index']);
        var adaInput = !!(dR && (parseFloat(dR.berat) || (dR.waktu && dR.waktu.length)));

        // Baris Fatigue Index: norma khusus KONI (z-score) ATAU tabel topendsports
        function barisFI(v, hasilTeks) {
            var sF = normaRast(getNorma('RAST Fatigue Index', a.usia, kelamin, ownerNorma), a.cabor);
            var row = {
                name: 'RAST Fatigue Index', raw: v, hasilTeks: hasilTeks,
                ikutPerforma: RAST_FI_IKUT_PERFORMA, pctDesimal1: true
            };
            if (sF) {
                var higherF = resolveArahGlobal('RAST Fatigue Index');
                row.pct = bulat1(calcItemPct('RAST Fatigue Index', v, sF.mean, sF.sd, higherF));
                row.cat = getPctCategory(row.pct);
                row.mean = sF.mean;
                row.sd = sF.sd;
                row.higher = higherF;
                row.sumberNorma = sF.sumber;
            } else {
                row.pct = pctInterpolasiNorma(tpe.fatigue.anchors, v);
                row.cat = kategoriDariTabel(tpe.fatigue.batas, v);
                row.hasilKeterangan = tpe.sumberTeks;
            }
            return row;
        }

        // Data RAST dicoba tapi tidak valid -> tampilkan pesan error, BUKAN 0%
        if (!rr && adaInput) {
            items.push({
                name: 'RAST Test', raw: null,
                hasilTeks: 'Data tidak valid',
                hasilTitle: 'Berat badan > 0 dan 6 waktu sprint harus terisi lengkap',
                pct: null, cat: null,
                pctPesan: 'Isi berat badan > 0 dan 6 waktu sprint',
                ikutPerforma: false
            });
            return;
        }

        // Tanpa data RAST sama sekali -> tanpa baris (tanpa angka tebakan)
        if (!rr && isNaN(manual) && isNaN(fiLegacy)) return;

        if (rr) {
            // 1) Peak Power (W) — informasi, tanpa persentase/kategori
            items.push({
                name: 'RAST Peak Power', raw: rr.peak,
                hasilTeks: rr.peak.toFixed(1) + ' W',
                hasilTitle: 'Peak power sprint tercepat = berat (kg) x 35^2 / t^3',
                pct: null, cat: null, ikutPerforma: false, hidden: true
            });

            // 2) Relative Peak Power (W/kg) — dinilai (z khusus KONI / topendsports)
            var sR = normaRast(getNorma('RAST Test', a.usia, kelamin, ownerNorma), a.cabor);
            var rowRPP = {
                name: 'RAST Relative Peak Power', raw: rr.peakRel,
                hasilTeks: rr.peakRel.toFixed(2) + ' W/kg',
                ikutPerforma: true, pctDesimal1: true, hidden: true
            };
            if (sR) {
                var higherR = (sR.arah !== null && sR.arah !== undefined) ? !!sR.arah : resolveArahGlobal('RAST Test');
                rowRPP.pct = bulat1(calcItemPct('RAST Relative Peak Power', rr.peakRel, sR.mean, sR.sd, higherR));
                rowRPP.cat = getPctCategory(rowRPP.pct);
                rowRPP.mean = sR.mean;
                rowRPP.sd = sR.sd;
                rowRPP.higher = higherR;
                rowRPP.sumberNorma = sR.sumber;
            } else {
                rowRPP.pct = pctInterpolasiNorma(tpe.relativePeak.anchors, rr.peakRel);
                rowRPP.cat = kategoriDariTabel(tpe.relativePeak.batas, rr.peakRel);
                rowRPP.hasilKeterangan = tpe.sumberTeks;
            }
            items.push(rowRPP);

            // 3) Average Power (W) — informasi; % = Average / Peak x 100 (ideal 70-85%)
            var pctAvg = bulat1((rr.avg / rr.peak) * 100);
            items.push({
                name: 'RAST Average Power', raw: rr.avg,
                hasilTeks: rr.avg.toFixed(1) + ' W',
                hasilKeterangan: 'Average/Peak ' + pctAvg + '% (ideal 70-85%)',
                pct: pctAvg, cat: null, pctDesimal1: true, ikutPerforma: false, hidden: true
            });

            // 4) Fatigue Index (W/s) — dinilai sesuai konstanta performa
            items.push(barisFI(rr.fatigue, rr.fatigue.toFixed(2) + ' W/s'));
            return;
        }

        // Data lama: angka tanpa data mentah 6 sprint -> tampil apa adanya;
        // sel persen/kategori meminta input ulang 6 waktu sprint (nilai lama
        // tidak dihapus dan tidak di-z-kan)
        items.push({
            name: 'RAST Peak Power', raw: null,
            hasilTeks: '-',
            hasilTitle: 'Peak power dihitung dari berat badan dan 6 waktu sprint',
            pct: null, cat: null, pctPesan: 'Input ulang 6 waktu sprint', ikutPerforma: false, hidden: true
        });
        items.push({
            name: 'RAST Relative Peak Power', raw: isNaN(manual) ? null : manual,
            hasilTeks: isNaN(manual) ? 'Isi berat badan & 6 waktu sprint' : manual + ' (data lama)',
            hasilTitle: 'Data mentah 6 sprint tidak tersedia \u2014 nilai lama ditampilkan apa adanya',
            pct: null, cat: null, pctPesan: 'Input ulang 6 waktu sprint',
            ikutPerforma: true, hidden: true
        });
        items.push({
            name: 'RAST Average Power', raw: null,
            hasilTeks: '-',
            hasilTitle: 'Average power dihitung dari berat badan dan 6 waktu sprint',
            pct: null, cat: null, pctPesan: 'Input ulang 6 waktu sprint', ikutPerforma: false, hidden: true
        });
        if (!isNaN(fiLegacy)) {
            items.push(barisFI(fiLegacy, fiLegacy + ' W/s'));
        } else {
            items.push({
                name: 'RAST Fatigue Index', raw: null,
                hasilTeks: 'Isi berat badan & 6 waktu sprint',
                hasilTitle: 'Fatigue Index dihitung dari berat badan dan 6 waktu sprint',
                pct: null, cat: null, ikutPerforma: RAST_FI_IKUT_PERFORMA
            });
        }
    }

    // Vertical Jump: SATU baris "Vertical Jump (Power)" (Lewis 1974).
    // Input tes dalam METER (strict). Norma KONI untuk tinggi lompatan tetap cm,
    // jadi z-score memakai cm = meter x 100; power Lewis memakai meter.
    // Bila berat badan kosong -> fallback tampil meter dengan norma cm + keterangan,
    // agar persentase/kategori dan performa tetap bisa dihitung.
    function evalVJPowerRow(meter) {
        var namaBaris = 'Vertical Jump (Power)';
        var sCm = getNorma('Vertical Jump', a.usia, kelamin, ownerNorma);
        var cm = meter * 100; // norma sumber (sheet KONI) dalam cm
        var bb = (parseFloat(a.beratKg) > 0) ? a.beratKg : nilai['Berat Badan'];
        var power = (bb !== null && bb !== undefined && parseFloat(bb) > 0)
            ? hitungVerticalJumpPower(meter, bb) : null;

        if (power === null) {
            var base = {
                name: namaBaris, raw: meter, hasilTeks: meter + ' m',
                hasilKeterangan: 'isi berat badan untuk menghitung power',
                ikutPerforma: true
            };
            if (!sCm || isNaN(parseFloat(sCm.mean)) || !(parseFloat(sCm.sd) > 0)) {
                base.tanpaNorma = true;
                base.pct = null;
                base.cat = null;
                return base;
            }
            var higherCm = (sCm.arah !== null && sCm.arah !== undefined) ? !!sCm.arah : resolveArahGlobal('Vertical Jump');
            var pctCm = bulat1(calcItemPct('Vertical Jump', cm, sCm.mean, sCm.sd, higherCm));
            base.mean = sCm.mean;
            base.sd = sCm.sd;
            base.higher = higherCm;
            base.pct = pctCm;
            base.cat = getPctCategory(pctCm);
            base.sumberNorma = sCm.sumber;
            return base;
        }

        // Norma power: override resmi (VJ_POWER_NORMA_OVERRIDE) ATAU turunan dari norma cm
        var normaP = null;
        if (VJ_POWER_NORMA_OVERRIDE && parseFloat(VJ_POWER_NORMA_OVERRIDE.sd) > 0 &&
            !isNaN(parseFloat(VJ_POWER_NORMA_OVERRIDE.mean))) {
            normaP = {
                mean: parseFloat(VJ_POWER_NORMA_OVERRIDE.mean),
                sd: parseFloat(VJ_POWER_NORMA_OVERRIDE.sd),
                turunan: false
            };
        } else if (sCm) {
            normaP = turunanNormaVJPower(sCm.mean, sCm.sd, bb);
        }

        var row = {
            name: namaBaris, raw: power, hasilTeks: power.toFixed(1) + ' W',
            hasilKeterangan: 'tinggi ' + meter + ' m',
            ikutPerforma: true
        };
        if (normaP && normaP.sd > 0) {
            var pctP = bulat1(calcItemPct('Vertical Jump (Power)', power, normaP.mean, normaP.sd, true));
            row.mean = normaP.mean;
            row.sd = normaP.sd;
            row.higher = true;
            row.pct = pctP;
            row.cat = getPctCategory(pctP);
            row.sumberNorma = normaP.turunan ? 'turunanLewis' : 'VJ_POWER_NORMA_OVERRIDE';
        } else {
            row.tanpaNorma = true;
            row.pct = null;
            row.cat = null;
        }
        return row;
    }

    evalItems.forEach(function(name) {
        // Item yang tidak dinilai
        if (name === '% Performance' || name === 'Tinggi Badan' || name === 'Berat Badan' ||
            name === 'IMT') return;

        // Semua item RAST dihitung sekali dari data mentah -> 4 baris hasil
        // (Peak Power, Relative Peak Power, Average Power, Fatigue Index)
        var kRast = itemKey(name);
        if (kRast.indexOf('rast') === 0 && kRast !== 'rast fatigue index') {
            evalRastRows(name);
            return;
        }
        if (kRast === 'rast fatigue index') return;

        // Item berbasis gender
        var wajib = itemKelamin(name);
        if (wajib && !kelamin) {
            var pesanG = 'Jenis kelamin atlet belum diisi \u2014 item ' + name + ' (khusus ' + wajib + ') tidak dinilai.';
            if (peringatan.indexOf(pesanG) < 0) peringatan.push(pesanG);
            return;
        }
        if (wajib && kelamin !== wajib) return;

        var raw = parseFloat(nilai[name]);
        if (isNaN(raw)) return;

        // Vertical Jump: satu baris power (Lewis 1974) — menggantikan baris cm
        if (itemKey(name) === 'vertical jump') {
            items.push(evalVJPowerRow(raw));
            return;
        }

        // Bleep Test: konversi level.shuttle → VO2max
        var li = itemKey(name);
        if (li.indexOf('bleep') >= 0 && li.indexOf('shuttle') < 0 && raw > 0 && raw < 22) {
            var lvl = Math.floor(raw);
            var shuttle = Math.round((raw - lvl) * 10);
            var maxSh = maksShuttleBleep(lvl);
            if (!maxSh) return;
            shuttle = Math.min(shuttle, maxSh);
            raw = +(3.46 * (lvl + shuttle / maxSh) + 12.2).toFixed(1);
        }

        // Shoulder Mobility: skor Brockport
        if (li.indexOf('shoulder mobility') >= 0) {
            var skor = getBrockportScore(raw);
            var pctS = bulat1((skor / 3) * 100);
            items.push({ name: name, raw: nilai[name], brockport: skor, pct: pctS, cat: getPctCategory(pctS), special: 'shoulder' });
            return;
        }

        // Ambil norma
        var s = getNorma(name, a.usia, kelamin, ownerNorma);
        if (!s || isNaN(parseFloat(s.mean)) || !(parseFloat(s.sd) > 0)) {
            items.push({ name: name, raw: raw, tanpaNorma: true, pct: null, cat: null });
            return;
        }

        var higher = (s.arah !== null && s.arah !== undefined) ? !!s.arah : resolveArahGlobal(name);
        var pct = bulat1(calcItemPct(name, raw, s.mean, s.sd, higher));
        items.push({
            name: name, raw: raw, mean: s.mean, sd: s.sd, higher: higher,
            pct: pct, cat: getPctCategory(pct), sumberNorma: s.sumber
        });
    });

    // Item tanpa norma → 50% (rumus no. 10)
    items.forEach(function(it) {
        if (it.tanpaNorma) {
            it.pct = 50;
            it.cat = getPctCategory(50);
        }
    });

    // Hitung IMT sebagai informasi (nilai turunan — dihitung saat ditampilkan)
    // Sumber: sesi yang sedang dibuka (a.tinggiCm/a.beratKg) atau fallback dari nilai sesi
    var tb = (a.tinggiCm !== undefined) ? a.tinggiCm : nilai['Tinggi Badan'];
    var bb = (a.beratKg !== undefined) ? a.beratKg : nilai['Berat Badan'];
    var imt = hitungIMT(bb, tb);
    var imtInfo = kategoriIMT(imt, a.usia);
    var imtCatatan = [a.imtCatatan, imtInfo.catatan].filter(Boolean).join(' · ');

    // Performa: override % Performance jika ada, selain itu hitung dari item yang dinilai
    var ringkas;
    if (overridePct !== null) {
        ringkas = {
            totalSkor: overridePct,
            performa: overridePct,
            kategori: getPctCategory(overridePct).label,
            jumlahItem: 0
        };
    } else {
        ringkas = ringkasanDariPersen(items.filter(function(it) {
            return it.ikutPerforma !== false;
        }).map(function(it) { return it.pct; }));
    }
    return {
        items: items,
        performa: ringkas.performa,
        totalSkor: ringkas.totalSkor,
        kategori: ringkas.kategori,
        jumlahItem: ringkas.jumlahItem,
        peringatan: peringatan,
        imt: imt,
        imtKategori: imtInfo.label,
        imtCatatan: imtCatatan,
        overridePct: overridePct
    };
}

// =====================================================================
// HELPER UNTUK TAMPILAN
// =====================================================================
function satuanItem(name) {
    var e = NORMA_INDEX[itemKey(name)];
    return e ? (e.satuan || '') : '';
}

function isDurasiItem(name) {
    var k = itemKey(name);
    return k === 'stork stand kanan' || k === 'stork stand kiri' || k === 'wall sit';
}

// Format detik -> "m:ss" (detik 2 digit). Contoh: 95 -> "1:35", 45 -> "0:45"
function formatDurasi(totalDetik) {
    if (totalDetik === null || totalDetik === undefined || isNaN(totalDetik)) return '-';
    var t = Math.round(Number(totalDetik));
    if (t < 0) return '-';
    var m = Math.floor(t / 60);
    var s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// Pecah total detik menjadi {menit, detik} untuk form edit
function pecahDurasi(totalDetik) {
    if (totalDetik === null || totalDetik === undefined || isNaN(totalDetik)) return { menit: '', detik: '' };
    var t = Math.round(Number(totalDetik));
    return { menit: Math.floor(t / 60), detik: t % 60 };
}

// Hitung total detik dari input menit & detik. Return null jika keduanya kosong.
// Menit: bilangan bulat >= 0, maks 59. Detik: >= 0 dan < 60.
function hitungTotalDurasi(menitStr, detikStr) {
    var mKosong = (menitStr === '' || menitStr === null || menitStr === undefined);
    var dKosong = (detikStr === '' || detikStr === null || detikStr === undefined);
    if (mKosong && dKosong) return { ok: false, error: 'Kolom belum diisi', total: null };
    var m = mKosong ? 0 : parseFloat(menitStr);
    var d = dKosong ? 0 : parseFloat(detikStr);
    if (isNaN(m)) return { ok: false, error: 'Menit harus angka', total: null };
    if (isNaN(d)) return { ok: false, error: 'Detik harus angka', total: null };
    if (m < 0) return { ok: false, error: 'Menit tidak boleh negatif', total: null };
    if (d < 0) return { ok: false, error: 'Detik tidak boleh negatif', total: null };
    if (m > 59) return { ok: false, error: 'Menit maksimal 59', total: null };
    if (d >= 60) return { ok: false, error: 'Detik harus kurang dari 60', total: null };
    if (m !== Math.floor(m)) return { ok: false, error: 'Menit harus bilangan bulat', total: null };
    var total = Math.round(m * 60 + d);
    return { ok: true, error: '', total: total };
}

// =====================================================================
// POWER VERTICAL JUMP — rumus Lewis (1974)
// Power (kg.m/s) = akar(4,9) x berat badan (kg) x akar(tinggi lompatan (m))
// Power (Watt)   = Power (kg.m/s) x 9,81
// Input tinggi lompatan dalam METER (sesuai satuan input tes, mis. 0,40).
// =====================================================================
function vjLewisKgms(meter, kg) {
    var h = parseFloat(meter), b = parseFloat(kg);
    if (isNaN(h) || isNaN(b) || h < 0 || b <= 0) return null;
    return Math.sqrt(4.9) * b * Math.sqrt(h);
}

function vjLewisWatt(meter, kg) {
    var kgms = vjLewisKgms(meter, kg);
    if (kgms === null) return null;
    return kgms * 9.81;
}

function hitungVerticalJumpPower(meter, kg) {
    var w = vjLewisWatt(meter, kg);
    if (w === null) return null;
    return Math.round(w * 10) / 10;
}

// Norma power diturunkan dari norma cm (mean & sd — sheet KONI tetap cm)
// menurut berat badan atlet; batas norma dikonversikan cm -> meter dulu:
// mean_P = Lewis(mean_cm/100, BB)
// sd_P   = (Lewis((mean_cm + sd_cm)/100, BB) - Lewis(max(mean_cm - sd_cm, 0)/100, BB)) / 2
function turunanNormaVJPower(meanCm, sdCm, beratKg) {
    var m = parseFloat(meanCm), s = parseFloat(sdCm), b = parseFloat(beratKg);
    if (isNaN(m) || isNaN(s) || !(s > 0) || !(b > 0)) return null;
    var meanP = vjLewisWatt(m / 100, b);
    var hi = vjLewisWatt(Math.max(m + s, 0) / 100, b);
    var lo = vjLewisWatt(Math.max(m - s, 0) / 100, b);
    if (meanP === null || hi === null || lo === null) return null;
    return { mean: meanP, sd: (hi - lo) / 2, turunan: true };
}

function pemilikNormaUntuk(cabor, nomor) {
    if (cabor === 'Atletik' && nomor) return { jenis: 'nomor', nomor: nomor };
    return null;
}

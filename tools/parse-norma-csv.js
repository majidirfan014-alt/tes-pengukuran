// parse-norma-csv.js — Parse Norma_Tes_KONI_Tuban_2026-10-18.csv → data/norma_tes_koni_tuban.json
// Jalankan: node tools/parse-norma-csv.js
'use strict';
var fs = require('fs');
var path = require('path');

var akar = path.join(__dirname, '..');
var csvPath = path.join(akar, 'Norma_Tes_KONI_Tuban_2026-10-18.csv');
var outPath = path.join(akar, 'data', 'norma_tes_koni_tuban.json');

function parseCSV(text) {
    var rows = [];
    var row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (inQ) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQ = false;
            } else field += c;
        } else {
            if (c === '"') inQ = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.length > 1 || row[0] !== '') rows.push(row);
                row = [];
            } else field += c;
        }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

function num(s) {
    if (s === undefined || s === null || s === '' || s === '-') return null;
    var v = parseFloat(String(s).replace(',', '.'));
    return isNaN(v) ? null : v;
}

var raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
var rows = parseCSV(raw);

// Cari section
var idxItem = -1, idxNorma = -1, idxRumus = -1, idxSumber = -1;
rows.forEach(function(r, i) {
    var t = (r[0] || '').trim();
    if (t === 'DAFTAR ITEM TES') idxItem = i;
    else if (t === 'NORMA & KATEGORI') idxNorma = i;
    else if (t === 'RUMUS PERHITUNGAN') idxRumus = i;
    else if (t === 'KETERANGAN & SUMBER NORMA') idxSumber = i;
});

// --- META ---
var meta = {
    judul: (rows[0] && rows[0][0]) || 'Norma Tes Fisik - KONI Kabupaten Tuban',
    tanggal_unduh: (rows[1] && rows[1][1]) || '',
    sumber_data: (rows[2] && rows[2][1]) || '',
    kategori_penilaian: (rows[3] && rows[3][1]) || '',
    catatan: (rows[4] && rows[4][1]) || ''
};

// --- ITEM TES ---
var items = [];
for (var i = idxItem + 2; i < idxNorma; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    items.push({
        no: parseInt(r[0], 10),
        nama: r[1],
        satuan: r[2],
        komponen_fisik: r[3],
        arah_nilai: r[4],
        berlaku_untuk: r[5],
        status_penilaian: r[6]
    });
}

// --- NORMA ---
var norma = [];
for (var i = idxNorma + 2; i < idxRumus; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    var mean = num(r[3]), sd = num(r[4]);
    var rentang = [r[5], r[6], r[7], r[8], r[9]].map(function(x) { return x || '-'; });
    var dipakaiRaw = r[11] || '';
    // Pisahkan "Dipakai: ..." dan catatan setelah "|"
    var dipakai = [], catatan = '';
    var bagian = dipakaiRaw.split('|');
    var dp = bagian[0].replace(/^Dipakai:\s*/, '').trim();
    if (dp && dp !== '-') dipakai = dp.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (bagian.length > 1) catatan = bagian.slice(1).join('|').trim();
    norma.push({
        item: r[0],
        kelompok: r[1],
        jenis_kelamin: r[2],
        mean: mean,
        sd: sd,
        rentang_acuan: rentang,
        sumber: r[10],
        dipakai: dipakai,
        catatan: catatan
    });
}

// --- RUMUS ---
var rumus = [];
for (var i = idxRumus + 2; i < idxSumber; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    rumus.push({
        no: parseInt(r[0], 10),
        judul: r[1],
        rumus: r[2],
        penjelasan: r[3],
        contoh: r[4]
    });
}

// --- KETERANGAN ---
var keterangan = [];
for (var i = idxSumber + 2; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r[0]) continue;
    keterangan.push({
        no: parseInt(r[0], 10),
        judul: r[1],
        keterangan: r[2]
    });
}

// --- KONFIGURASI ---
var konfigurasi = {
    kategori_dari_persen: [
        { kategori: 'Baik Sekali', min_persen: 90 },
        { kategori: 'Baik', min_persen: 60 },
        { kategori: 'Cukup', min_persen: 40 },
        { kategori: 'Kurang', min_persen: 20 },
        { kategori: 'Kurang Sekali', min_persen: 0 }
    ],
    breakpoint_z_kategori: { baik_sekali: 2, baik: 0.25, cukup: -0.75, kurang: -1.75 },
    bleep_maks_shuttle: [7, 8, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16],
    catatan_ambang: 'Breakpoint z = 2, 0.25, -0.75, -1.75 (konsisten dengan rumus no. 5 dan ambang 90/60/40/20).'
};

var json = {
    meta: meta,
    konfigurasi: konfigurasi,
    items: items,
    norma: norma,
    rumus: rumus,
    keterangan: keterangan
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf8');

console.log('OK → ' + outPath);
console.log('  items: ' + items.length);
console.log('  norma: ' + norma.length);
console.log('  rumus: ' + rumus.length);
console.log('  keterangan: ' + keterangan.length);

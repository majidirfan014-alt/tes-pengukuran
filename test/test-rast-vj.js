// test-rast-vj.js — Verifikasi Vertical Jump (Power/Lewis) & RAST topendsports (4 baris)
// Jalankan: node test/test-rast-vj.js
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
function ev(o) { return G.computeEvaluation(o); }
function item(e, nama) {
    return e.items.filter(function(x) { return x.name === nama; })[0] || null;
}

console.log('=== VERIFIKASI VJ POWER (LEWIS) & RAST TOPENDSPORTS ===\n');

// --- 1. Rumus Lewis (1974) — input tinggi dalam METER ---
console.log('--- Rumus Lewis (meter) ---');
var kgms60 = G.vjLewisKgms(0.40, 60);
console.log('INFO | Lewis 60 kg / 0,40 m = ' + kgms60.toFixed(4) + ' kg.m/s -> ' +
    G.hitungVerticalJumpPower(0.40, 60) + ' Watt');
check('Lewis: 60 kg & 0,40 m = 84,0 kg.m/s', G.bulat1(kgms60), 84);
check('Lewis: 60 kg & 0,40 m = 824 Watt', G.hitungVerticalJumpPower(0.40, 60), 824);
check('Lewis tanpa berat -> null', G.hitungVerticalJumpPower(0.40, 0), null);
check('Lewis tinggi negatif -> null', G.hitungVerticalJumpPower(-0.5, 60), null);
check('Lewis tanpa konversi /100 lagi (0,40 m hasil sama dengan 40 cm lama)',
    G.hitungVerticalJumpPower(0.40, 60), 824);

// --- 2. Norma power turunan dari norma cm (sheet KONI tetap cm) ---
console.log('\n--- Norma turunan (mean 30 cm, sd 6 cm, BB 50 kg) ---');
var td = G.turunanNormaVJPower(30, 6, 50);
console.log('INFO | mean_P = ' + td.mean.toFixed(3) + ' W, sd_P = ' + td.sd.toFixed(3) + ' W');
check('mean_P ~ 594,7 W', G.bulat1(td.mean), 594.7);
check('sd_P ~ 59,8 W', G.bulat1(td.sd), 59.8);
var p36 = G.hitungVerticalJumpPower(0.36, 50);
console.log('INFO | power 0,36 m / 50 kg = ' + p36 + ' W');
check('power 0,36 m / 50 kg ~ 651,5 W', p36, 651.5);
var z36 = (p36 - td.mean) / td.sd;
var pct36 = G.bulat1(G.calcItemPct('Vertical Jump (Power)', p36, td.mean, td.sd, true));
console.log('INFO | z = ' + z36.toFixed(4) + ', persen = ' + pct36 + ', kategori = ' + G.getPctCategory(pct36).label);
check('z ~ 0,95', Math.round(z36 * 100) / 100, 0.95);
check('persen = 74', pct36, 74);
check('kategori = Baik', G.getPctCategory(pct36).label, 'Baik');
var tdFloor = G.turunanNormaVJPower(5, 6, 50); // mean - sd <= 0 -> batas bawah 0 cm
check('mean-sd <= 0 -> batas bawah 0 cm tetap valid', tdFloor && tdFloor.sd > 0, true);

// --- 3. Baris evaluasi Vertical Jump (Power) — input meter ---
console.log('\n--- Baris Vertical Jump (Power) ---');
var vjP = ev({
    usia: 26, kelamin: '', items: ['Vertical Jump', 'Push Up 1 Menit'],
    nilai: { 'Vertical Jump': 0.45, 'Berat Badan': 60, 'Push Up 1 Menit': 20 }
});
var rowP = item(vjP, 'Vertical Jump (Power)');
console.log('INFO | VJ 0,45 m / 60 kg -> ' + (rowP ? rowP.hasilTeks : 'hilang') +
    ', pct = ' + (rowP ? rowP.pct : '-'), ', kat = ' + (rowP && rowP.cat ? rowP.cat.label : '-'));
check('baris cm lama TIDAK ada (tidak dobel)', item(vjP, 'Vertical Jump'), null);
check('satu baris power ada', !!rowP, true);
check('hasil power 874,0 W', rowP.hasilTeks, '874.0 W');
check('keterangan tinggi lompatan (meter)', rowP.hasilKeterangan, 'tinggi 0.45 m');
check('pct adalah angka', typeof rowP.pct, 'number');
check('sumber norma turunan Lewis', rowP.sumberNorma, 'turunanLewis');
check('ikut performa', rowP.ikutPerforma, true);
check('jumlah item dinilai = 2 (VJ power + push up)', vjP.jumlahItem, 2);
var vjNaik = ev({ usia: 26, kelamin: '', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.55, 'Berat Badan': 60 } });
check('arah power: 0,55 m pct > 0,45 m pct', vjNaik.items[0].pct > rowP.pct, true);

// Fallback: berat badan kosong -> tetap tampil meter + keterangan, performa tetap jalan
var vjFb = ev({ usia: 26, kelamin: '', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.45 } });
var rowFb = item(vjFb, 'Vertical Jump (Power)');
check('BB kosong -> fallback baris meter', rowFb.hasilTeks, '0.45 m');
check('fallback -> keterangan isi berat badan', rowFb.hasilKeterangan, 'isi berat badan untuk menghitung power');
check('fallback pct dari norma cm (angka)', typeof rowFb.pct, 'number');
check('fallback tetap ikut performa', rowFb.ikutPerforma, true);
check('BB kosong -> tanpa error, tanpa power', rowFb.raw, 0.45);
check('fallback z memakai cm (0,45 m -> 45 cm, norma o17 mean 55)', rowFb.pct, 38.3);

// --- 4. Strict meter: nilai absurd & rentang wajar ---
console.log('\n--- VJ strict meter (tanpa konversi otomatis) ---');
var vj17 = ev({ usia: 10, kelamin: 'Perempuan', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.05 }, cabor: 'Sepatu Roda' });
check('VJ 0,05 m (5 cm, tidak wajar) u17 -> 0%', vj17.items[0].pct, 0);
check('VJ 0,05 m u17 -> Kurang Sekali', vj17.items[0].cat.label, 'Kurang Sekali');
check('VJ bukan tanpa norma (tetap dinilai semua cabor)', !!vj17.items[0].normaTidakAda, false);
var vjO = ev({ usia: 30, kelamin: 'Laki-laki', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.05 }, cabor: 'Sepatu Roda' });
check('VJ 0,05 m >17 -> 0%', vjO.items[0].pct, 0);
// Strict: 5,35 dianggap METER (bukan cm) -> dinilai mentah, TIDAK dibagi 100
var vjBesar = ev({ usia: 10, kelamin: '', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 5.35 } });
check('strict meter: 5,35 (m) TIDAK dikonversi -> pct 100', vjBesar.items[0].pct, 100);
check('strict meter: hasil fallback tampil meter', vjBesar.items[0].hasilTeks, '5.35 m');
var vj40 = ev({ usia: 10, kelamin: '', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.40 } }).items[0].pct;
var vj50 = ev({ usia: 10, kelamin: '', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.50 } }).items[0].pct;
var vj60 = ev({ usia: 10, kelamin: '', items: ['Vertical Jump'], nilai: { 'Vertical Jump': 0.60 } }).items[0].pct;
check('VJ arah: 0,50 (65) > 0,40 (45)', vj50 > vj40, true);
check('VJ arah: 0,60 (82.5) > 0,50 (65)', vj60 > vj50, true);

// --- 5. RAST dengan data mentah: 4 baris terpisah ---
console.log('\n--- RAST dengan data mentah (70 kg, 5 x 5,0 dtk) ---');
var dataR = { berat: 70, waktu: [5, 5, 5, 5, 5, 5] };
var eD = ev({
    usia: 16, kelamin: 'Laki-laki', cabor: 'Pencak Silat',
    items: ['Push Up 1 Menit', 'RAST Test'],
    nilai: { 'Push Up 1 Menit': 30, 'RAST Data': dataR }
});
var peakD = item(eD, 'RAST Peak Power');
var rppD = item(eD, 'RAST Relative Peak Power');
var avgD = item(eD, 'RAST Average Power');
var fiD = item(eD, 'RAST Fatigue Index');
console.log('INFO | 70 kg x 5 x 5,0 dtk -> ' + peakD.hasilTeks + ' | RPP ' + rppD.hasilTeks +
    ' pct=' + rppD.pct + ' ' + rppD.cat.label + ' | FI pct=' + fiD.pct);
check('4 baris RAST tampil (Peak, Relative, Average, FI)',
    [!!peakD, !!rppD, !!avgD, !!fiD].every(Boolean), true);
check('baris "RAST Test" lama tidak ada lagi (data valid)', item(eD, 'RAST Test'), null);
check('Peak Power hasil 686,0 W', peakD.hasilTeks, '686.0 W');
check('Peak Power tanpa % (informasi)', peakD.pct, null);
check('Peak Power tidak ikut performa', peakD.ikutPerforma, false);
check('Relative Peak Power hasil 9,80 W/kg', rppD.hasilTeks, '9.80 W/kg');
check('Relative Peak Power pct u17 = 81 (z norma khusus KONI)', rppD.pct, 81);
check('Relative Peak Power kat = Baik', rppD.cat.label, 'Baik');
check('Relative Peak Power ikut performa', rppD.ikutPerforma, true);
check('Relative Peak Power sumber norma JSON', rppD.sumberNorma, 'JSON');
check('Average Power hasil 686,0 W', avgD.hasilTeks, '686.0 W');
check('Average Power % = Average/Peak = 100', avgD.pct, 100);
check('Average Power tanpa kategori', avgD.cat, null);
check('Average Power tidak ikut performa', avgD.ikutPerforma, false);
check('Average Power punya keterangan Average/Peak', avgD.hasilKeterangan, 'Average/Peak 100% (ideal 70-85%)');
check('FI hasil 0,00 W/s', fiD.hasilTeks, '0.00 W/s');
check('FI pct u17 = 88.1', fiD.pct, 88.1);
check('FI TIDAK ikut performa (konstanta)', fiD.ikutPerforma, G.RAST_FI_IKUT_PERFORMA);
check('konstanta RAST_FI_IKUT_PERFORMA = false', G.RAST_FI_IKUT_PERFORMA, false);
check('baris norma khusus tanpa flag cadangan', 'cadanganNorma' in rppD, false);
check('baris norma khusus tanpa normaTidakAda', 'normaTidakAda' in rppD, false);
check('baris Peak/Relative/Average disembunyikan dari tampilan', [peakD.hidden, rppD.hidden, avgD.hidden].join(','), 'true,true,true');
check('baris Fatigue Index tetap tampil', !fiD.hidden, true);
check('sel % RAST memakai 1 desimal (pctDesimal1)', [rppD.pctDesimal1, avgD.pctDesimal1, fiD.pctDesimal1].join(','), 'true,true,true');
var pushSendiri = ev({ usia: 16, kelamin: 'Laki-laki', items: ['Push Up 1 Menit'], nilai: { 'Push Up 1 Menit': 30 }, cabor: 'Pencak Silat' });
var pctPush = pushSendiri.items[0].pct;
var performaHarap = G.bulat1((81 + pctPush) / 2);
check('performa = rata2 (Relative Peak + Push Up), Peak/Avg/FI dikeluarkan', eD.performa, performaHarap);
check('jumlah baris = 5 (push + 4 RAST)', eD.items.length, 5);
check('jumlah item dinilai = 2', eD.jumlahItem, 2);

// --- 6. RAST cabor TANPA norma khusus -> tabel topendsports ---
console.log('\n--- RAST norma topendsports (cabor non-KONI) ---');
check('konstanta RAST_NORMA_CADANGAN_UMUM sudah dihapus', G.RAST_NORMA_CADANGAN_UMUM, undefined);
check('konstanta RAST_NORMA_TOPENDSPORTS ada', !!G.RAST_NORMA_TOPENDSPORTS, true);
var eN = ev({
    usia: 16, kelamin: 'Laki-laki', cabor: 'Senam Gymnastic',
    items: ['Push Up 1 Menit', 'RAST Test'],
    nilai: { 'Push Up 1 Menit': 30, 'RAST Data': dataR }
});
var rppN = item(eN, 'RAST Relative Peak Power');
var fiN = item(eN, 'RAST Fatigue Index');
check('RPP pct = 38 (interpolasi 9,8 W/kg antar 8->20% & 11->50%)', rppN.pct, 38);
check('RPP kategori = Average (8 s.d. <11 W/kg)', rppN.cat.label, 'Average');
check('RPP warna badge = amber', rppN.cat.color, 'amber');
check('RPP keterangan sumber topendsports', rppN.hasilKeterangan, 'Norma: topendsports.com (Draper & Whyte, 1997)');
check('RPP non-khusus tanpa flag cadangan', 'cadanganNorma' in rppN, false);
check('RPP non-khusus tetap ikut performa', rppN.ikutPerforma, true);
check('FI = 0 (di bawah batas 8) -> pct 100', fiN.pct, 100);
check('FI kategori = Excellent', fiN.cat.label, 'Excellent');
check('FI keterangan sumber topendsports', fiN.hasilKeterangan, 'Norma: topendsports.com (Draper & Whyte, 1997)');
var performaNHarap = G.bulat1((38 + pctPush) / 2);
check('performa non-khusus = rata2 (38 + push), FI dikeluarkan', eN.performa, performaNHarap);

// Batas interpolasi & kategori (tabel A & B topendsports)
var T = G.RAST_NORMA_TOPENDSPORTS;
check('anchor RPP 8 -> 20%', G.pctInterpolasiNorma(T.relativePeak.anchors, 8), 20);
check('anchor RPP 11 -> 50%', G.pctInterpolasiNorma(T.relativePeak.anchors, 11), 50);
check('anchor RPP 14 -> 80%', G.pctInterpolasiNorma(T.relativePeak.anchors, 14), 80);
check('anchor RPP 17 -> 95%', G.pctInterpolasiNorma(T.relativePeak.anchors, 17), 95);
check('ekstrapolasi RPP 7,5 -> 15%', G.pctInterpolasiNorma(T.relativePeak.anchors, 7.5), 15);
check('ekstrapolasi RPP 18 -> clamp 100%', G.pctInterpolasiNorma(T.relativePeak.anchors, 18), 100);
check('RPP 9,8 -> 38%', G.pctInterpolasiNorma(T.relativePeak.anchors, 9.8), 38);
check('clamp bawah RPP 0 -> 0%', G.pctInterpolasiNorma(T.relativePeak.anchors, 0), 0);
check('anchor FI 8 -> 80%', G.pctInterpolasiNorma(T.fatigue.anchors, 8), 80);
check('anchor FI 10 -> 50%', G.pctInterpolasiNorma(T.fatigue.anchors, 10), 50);
check('anchor FI 12 -> 20%', G.pctInterpolasiNorma(T.fatigue.anchors, 12), 20);
check('FI 9 -> 65%', G.pctInterpolasiNorma(T.fatigue.anchors, 9), 65);
check('ekstrapolasi FI 6 -> clamp 100%', G.pctInterpolasiNorma(T.fatigue.anchors, 6), 100);
check('ekstrapolasi FI 14 -> clamp 0%', G.pctInterpolasiNorma(T.fatigue.anchors, 14), 0);
check('kat RPP 17,5 (apit 17) -> Elite', G.kategoriDariTabel(T.relativePeak.batas, 17.5).label, 'Elite');
check('kat RPP 17 (tepat 17, bukan apit) -> Excellent', G.kategoriDariTabel(T.relativePeak.batas, 17).label, 'Excellent');
check('kat RPP 14 -> Excellent', G.kategoriDariTabel(T.relativePeak.batas, 14).label, 'Excellent');
check('kat RPP 13,9 -> Good', G.kategoriDariTabel(T.relativePeak.batas, 13.9).label, 'Good');
check('kat RPP 11 -> Good', G.kategoriDariTabel(T.relativePeak.batas, 11).label, 'Good');
check('kat RPP 8 -> Average', G.kategoriDariTabel(T.relativePeak.batas, 8).label, 'Average');
check('kat RPP 7,9 -> Below Average', G.kategoriDariTabel(T.relativePeak.batas, 7.9).label, 'Below Average');
check('kat FI 7,9 (di bawah 8) -> Excellent', G.kategoriDariTabel(T.fatigue.batas, 7.9).label, 'Excellent');
check('kat FI 8 -> Good', G.kategoriDariTabel(T.fatigue.batas, 8).label, 'Good');
check('kat FI 10 -> Good', G.kategoriDariTabel(T.fatigue.batas, 10).label, 'Good');
check('kat FI 10,5 -> Average', G.kategoriDariTabel(T.fatigue.batas, 10.5).label, 'Average');
check('kat FI 12 -> Average', G.kategoriDariTabel(T.fatigue.batas, 12).label, 'Average');
check('kat FI 12,1 -> Needs Improvement', G.kategoriDariTabel(T.fatigue.batas, 12.1).label, 'Needs Improvement');
check('item lain rumus 10 tetap 50', ev({ usia: 16, kelamin: '', items: ['Item Ngawur'], nilai: { 'Item Ngawur': 10 }, cabor: 'Senam Gymnastic' }).items[0].pct, 50);

// --- 7. Data lama: nilai manual tanpa data mentah -> TIDAK di-z-kan ---
console.log('\n--- Data lama (tanpa RAST Data) ---');
var eL = ev({
    usia: 16, kelamin: 'Laki-laki', cabor: 'Pencak Silat',
    items: ['RAST Test'],
    nilai: { 'RAST Test': 2.64 }
});
var peakL = item(eL, 'RAST Peak Power');
var rppL = item(eL, 'RAST Relative Peak Power');
var avgL = item(eL, 'RAST Average Power');
var fiL = item(eL, 'RAST Fatigue Index');
check('4 baris data lama tetap tampil',
    [!!peakL, !!rppL, !!avgL, !!fiL].every(Boolean), true);
check('baris data lama disembunyikan kecuali FI', [peakL.hidden, rppL.hidden, avgL.hidden, !fiL.hidden].join(','), 'true,true,true,true');
check('Peak Power (data lama) minta input ulang', peakL.pctPesan, 'Input ulang 6 waktu sprint');
check('Relative Peak Power tampil (data lama)', rppL.hasilTeks, '2.64 (data lama)');
check('data lama TIDAK dihitung z (pct null)', rppL.pct, null);
check('data lama TIDAK punya kategori', rppL.cat, null);
check('data lama -> pesan sel persen/kategori', rppL.pctPesan, 'Input ulang 6 waktu sprint');
check('data lama tetap ada di baris (ikutPerforma true)', rppL.ikutPerforma, true);
check('peringatan data lama tersedia', typeof rppL.hasilTitle === 'string' && rppL.hasilTitle.length > 0, true);
check('Average Power (data lama) tanpa angka', avgL.hasilTeks, '-');
check('FI tanpa data -> pesan', fiL.hasilTeks, 'Isi berat badan & 6 waktu sprint');
check('FI tanpa data -> pct null', fiL.pct, null);
// FI legacy tersimpan (W/s) tetap dinilai
var eLFi = ev({
    usia: 26, kelamin: 'Laki-laki', cabor: 'Pencak Silat',
    items: ['RAST Test'],
    nilai: { 'RAST Test': 2.64, 'RAST Fatigue Index': 0.99 }
});
var fiLf = item(eLFi, 'RAST Fatigue Index');
console.log('INFO | FI legacy 0.99 o17 khusus -> pct = ' + fiLf.pct + ', kat = ' + (fiLf.cat ? fiLf.cat.label : '-'));
check('FI legacy 0.99 tampil (W/s)', fiLf.hasilTeks, '0.99 W/s');
check('FI legacy o17 pct = 73 (z khusus)', fiLf.pct, 73);
check('FI legacy o17 kat = Baik', fiLf.cat.label, 'Baik');
// FI legacy pada cabor NON-khusus -> topendsports (bukan z cadangan)
var eLFiN = ev({
    usia: 26, kelamin: 'Laki-laki', cabor: 'Sepatu Roda',
    items: ['RAST Test'],
    nilai: { 'RAST Test': 2.64, 'RAST Fatigue Index': 0.99 }
});
var fiLfN = item(eLFiN, 'RAST Fatigue Index');
check('FI legacy non-khusus -> topendsports pct 100', fiLfN.pct, 100);
check('FI legacy non-khusus kat = Excellent', fiLfN.cat.label, 'Excellent');
check('FI legacy non-khusus bersumber topendsports', fiLfN.hasilKeterangan, 'Norma: topendsports.com (Draper & Whyte, 1997)');
var eLKosong = ev({ usia: 16, kelamin: '', cabor: 'Pencak Silat', items: ['RAST Test'], nilai: {} });
check('RAST kosong -> tanpa baris (tanpa angka tebakan)', eLKosong.items.length, 0);
var eTanpaItem = ev({ usia: 16, kelamin: '', cabor: 'Pencak Silat', items: ['Push Up 1 Menit'], nilai: { 'Push Up 1 Menit': 30 } });
check('tanpa item RAST -> tanpa baris RAST', eTanpaItem.items.some(function(x) { return x.name.indexOf('RAST') >= 0; }), false);

// Data RAST dicoba tapi TIDAK valid -> pesan error, bukan 0%
var eErr = ev({
    usia: 16, kelamin: '', cabor: 'Pencak Silat',
    items: ['RAST Test'],
    nilai: { 'RAST Data': { berat: 0, waktu: [5, 5, 5, 5, 5, 5] } }
});
var rowErr = item(eErr, 'RAST Test');
check('berat 0 -> baris pesan error tampil', !!rowErr, true);
check('error: pct null (bukan 0%)', rowErr.pct, null);
check('error: kategori null (bukan badge)', rowErr.cat, null);
check('error: pesan di sel %/kategori', rowErr.pctPesan, 'Isi berat badan > 0 dan 6 waktu sprint');
check('error: pesan di sel hasil', rowErr.hasilTeks, 'Data tidak valid');
var eErr2 = ev({
    usia: 16, kelamin: '', cabor: 'Pencak Silat',
    items: ['RAST Test'],
    nilai: { 'RAST Data': { berat: 70, waktu: [5, 5] } }
});
check('6 waktu sprint belum lengkap -> pesan error', item(eErr2, 'RAST Test').hasilTeks, 'Data tidak valid');
check('error tidak ikut performa', rowErr.ikutPerforma, false);
check('baris pesan error tetap tampil (bukan hidden)', !!rowErr && !rowErr.hidden, true);

// --- 8. Arah nilai (rumus 2 higher true / rumus 3 higher false) ---
console.log('\n--- Arah nilai & uji z ---');
check('rumus 2: z = +1,00 -> 75%', G.bulat1(G.calcItemPct('RAST Relative Peak Power', 7 + 2, 7, 2, true)), 75);
check('rumus 3: z = -1,00 pada FI -> 75%', G.bulat1(G.calcItemPct('RAST Fatigue Index', 1.8 - 0.9, 1.8, 0.9, false)), 75);
var cepat = ev({ usia: 16, kelamin: '', cabor: 'Pencak Silat', items: ['RAST Test'], nilai: { 'RAST Data': { berat: 70, waktu: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5] } } });
var lambat = ev({ usia: 16, kelamin: '', cabor: 'Pencak Silat', items: ['RAST Test'], nilai: { 'RAST Data': { berat: 70, waktu: [7, 7, 7, 7, 7, 7] } } });
check('Relative Peak Power lebih tinggi -> pct lebih tinggi',
    item(cepat, 'RAST Relative Peak Power').pct > item(lambat, 'RAST Relative Peak Power').pct, true);
var turun = ev({ usia: 16, kelamin: '', cabor: 'Pencak Silat', items: ['RAST Test'], nilai: { 'RAST Data': { berat: 70, waktu: [4, 4.5, 5, 5.5, 6, 7] } } });
check('FI lebih rendah -> pct lebih tinggi',
    item(lambat, 'RAST Fatigue Index').pct > item(turun, 'RAST Fatigue Index').pct, true);
check('FI turun (kelelahan tinggi) -> pct 0', item(turun, 'RAST Fatigue Index').pct, 0);
check('rata-rata turun -> sel Average/Peak < 100', item(turun, 'RAST Average Power').pct < 100, true);

// --- 9. Usia >17 dengan data ---
console.log('\n--- RAST usia >17 ---');
var eO = ev({ usia: 26, kelamin: 'Perempuan', cabor: 'Pencak Silat', items: ['RAST Test'], nilai: { 'RAST Data': dataR } });
check('Relative Peak Power pct o17 = 61.4', item(eO, 'RAST Relative Peak Power').pct, 61.4);
check('FI pct o17 (FI=0) = 90', item(eO, 'RAST Fatigue Index').pct, 90);

// --- 9b. Contoh uji spesifikasi: BB 75 kg, 6 x 5,00 dtk ---
console.log('\n--- Contoh spesifikasi topendsports (75 kg x 5,00 s) ---');
var eSpec = ev({
    usia: 26, kelamin: 'Laki-laki', cabor: 'Senam Gymnastic',
    items: ['RAST Test'],
    nilai: { 'RAST Data': { berat: 75, waktu: [5, 5, 5, 5, 5, 5] } }
});
var pk = item(eSpec, 'RAST Peak Power');
var rp = item(eSpec, 'RAST Relative Peak Power');
var av = item(eSpec, 'RAST Average Power');
var f2 = item(eSpec, 'RAST Fatigue Index');
console.log('INFO | 75 kg x 5,00 s -> ' + pk.hasilTeks + ', RPP ' + rp.hasilTeks +
    ' -> ' + rp.pct + '% (' + rp.cat.label + '), FI ' + f2.pct + '% (' + f2.cat.label + ')');
check('power 75 kg x 5,0 s = 735,0 W', pk.hasilTeks, '735.0 W');
check('Relative Peak Power = 9,80 W/kg (raw 9,8)', [rp.hasilTeks, rp.raw].join('|'), '9.80 W/kg|9.8');
check('RPP 9,8 W/kg -> persentase 38', rp.pct, 38);
check('RPP 9,8 W/kg -> kategori Average', rp.cat.label, 'Average');
check('Average Power 735,0 W, sel 100%', [av.hasilTeks, av.pct].join('|'), '735.0 W|100');
check('FI 0 -> Excellent, 100%', [f2.pct, f2.cat.label].join('|'), '100|Excellent');
check('performa = pct RPP saja (jml 1)', eSpec.performa, 38);

// --- 10. dipakai tersimpan di NORMA_INDEX + perilaku normaRast ---
console.log('\n--- Field dipakai & normaRast ---');
var dRast = G.NORMA_INDEX['rast test'].grup.u17.umum.dipakai;
check('dipakai RAST Test ada (7 cabor)', Array.isArray(dRast) ? dRast.length : 0, 7);
check('normaRast cocok cabor bernorma khusus', !!G.normaRast({ dipakai: dRast }, 'Judo'), true);
check('normaRast cabor lain -> null (pakai topendsports)', G.normaRast({ dipakai: dRast, mean: 7, sd: 2 }, 'Senam Gymnastic'), null);
check('normaRast tanpa daftar dipakai -> tetap dipakai', !!G.normaRast({ mean: 7, sd: 2 }, 'Sepatu Roda'), true);
check('normaRast tanpa data norma -> null', G.normaRast(null, 'Judo'), null);

// --- 11. Template & sumber (source check) ---
console.log('\n--- Template & sumber kode ---');
var tpl = JSON.parse(fs.readFileSync(path.join(akar, 'data/rekomendasi-template.json'), 'utf8'));
var kats = ['Baik Sekali', 'Baik', 'Cukup', 'Kurang', 'Kurang Sekali'];
check('template id rast_avg_power ada 5 kategori',
    kats.every(function(k) { return tpl.template['rast_avg_power'] && tpl.template['rast_avg_power'][k]; }), true);
check('template id rast_fatigue_index ada 5 kategori',
    kats.every(function(k) { return tpl.template['rast_fatigue_index'] && tpl.template['rast_fatigue_index'][k]; }), true);
check('template lama "RAST Test" tetap ada', !!tpl.template['RAST Test'], true);
check('template "Vertical Jump" tetap ada', !!tpl.template['Vertical Jump'], true);

function itemKeyLocal(name) {
    return String(name || '').replace(/[\u2010-\u2015\u2212]/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
}
var ALIAS = {
    'rast avg power': 'rast_avg_power',
    'rast peak power': 'rast_avg_power',
    'rast relative peak power': 'rast_avg_power',
    'rast average power': 'rast_avg_power',
    'rast fatigue index': 'rast_fatigue_index',
    'vertical jump (power)': 'Vertical Jump', 'vertical_jump_power': 'Vertical Jump'
};
function lookup(nama, kat, usiaG) {
    var k = ALIAS[itemKeyLocal(nama)] || itemKeyLocal(nama);
    var t = tpl.template[k];
    if (t && t[kat] && t[kat][usiaG]) return t[kat][usiaG];
    if (t && t[kat] && t[kat].umum) return t[kat].umum;
    return null;
}
check('lookup "RAST Avg Power" -> rast_avg_power u17', !!lookup('RAST Avg Power', 'Kurang Sekali', 'u17'), true);
check('lookup "RAST Relative Peak Power" -> rast_avg_power u17', !!lookup('RAST Relative Peak Power', 'Kurang Sekali', 'u17'), true);
check('lookup "RAST Peak Power" -> rast_avg_power', !!lookup('RAST Peak Power', 'Baik', 'u17'), true);
check('lookup "RAST Average Power" -> rast_avg_power', !!lookup('RAST Average Power', 'Cukup', 'u17'), true);
check('lookup "RAST Fatigue Index" -> rast_fatigue_index umum', !!lookup('RAST Fatigue Index', 'Baik', 'umum'), true);
check('lookup "Vertical Jump (Power)" -> template Vertical Jump', !!lookup('Vertical Jump (Power)', 'Baik', 'o17'), true);

var appJs = fs.readFileSync(path.join(akar, 'js/app.js'), 'utf8');
var dataJs = fs.readFileSync(path.join(akar, 'js/data.js'), 'utf8');
var storeJs = fs.readFileSync(path.join(akar, 'js/store.js'), 'utf8');
var html = fs.readFileSync(path.join(akar, 'index.html'), 'utf8');
check('data.js punya konstanta RAST_FI_IKUT_PERFORMA', dataJs.indexOf('var RAST_FI_IKUT_PERFORMA = false;') >= 0, true);
check('data.js punya konstanta RAST_NORMA_CADANGAN_UMUM dihapus', dataJs.indexOf('var RAST_NORMA_CADANGAN_UMUM') < 0, true);
check('data.js punya konstanta RAST_NORMA_TOPENDSPORTS', dataJs.indexOf('var RAST_NORMA_TOPENDSPORTS') >= 0, true);
check('data.js punya pembantu interpolasi & kategori tabel',
    dataJs.indexOf('function pctInterpolasiNorma(') >= 0 && dataJs.indexOf('function kategoriDariTabel(') >= 0, true);
check('sumber norma topendsports tertulis', dataJs.indexOf('topendsports.com (Draper & Whyte, 1997)') >= 0, true);
check('nama baris RAST baru ada di data.js',
    dataJs.indexOf("'RAST Peak Power'") >= 0 && dataJs.indexOf("'RAST Relative Peak Power'") >= 0 && dataJs.indexOf("'RAST Average Power'") >= 0, true);
check('routing evaluasi mengecualikan baris RAST Fatigue Index (imt-performa)',
    dataJs.indexOf("kRast !== 'rast fatigue index'") >= 0, true);
check('data.js punya konstanta VJ_POWER_NORMA_OVERRIDE (default null)', dataJs.indexOf('var VJ_POWER_NORMA_OVERRIDE = null;') >= 0, true);
check('data.js punya fungsi pusat hitungRAST', dataJs.indexOf('function hitungRAST(') >= 0, true);
check('data.js pakai hitungRAST di evaluasi', dataJs.indexOf('hitungRAST(beratRast, dR.waktu)') >= 0, true);
check('data.js punya rumus Lewis + RUMUS_LEWIS', dataJs.indexOf('var RUMUS_LEWIS') >= 0 && dataJs.indexOf('function hitungVerticalJumpPower(') >= 0, true);
check('Lewis pakai METER (tanpa konversi cm/100)', dataJs.indexOf('Math.sqrt(h)') >= 0 && dataJs.indexOf('Math.sqrt(c / 100)') < 0, true);
check('turunanNormaVJPower konversi cm -> meter', dataJs.indexOf('vjLewisWatt(m / 100, b)') >= 0, true);
check('evalVJPowerRow terima meter, z pakai cm = meter x 100', dataJs.indexOf('var cm = meter * 100;') >= 0, true);
check('tampilan hasil memakai meter', dataJs.indexOf("hasilTeks: meter + ' m'") >= 0 && dataJs.indexOf("'tinggi ' + meter + ' m'") >= 0, true);
check('RUMUS_LEWIS penjelasan meter', dataJs.indexOf('langsung dipakai tanpa konversi') >= 0, true);
check('fetch norma JSON cache-bust vjmeter', dataJs.indexOf('norma_tes_koni_tuban.json?v=20261021vjmeter') >= 0, true);
var normaJson = JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8'));
var itVJ = (normaJson.items || []).filter(function(x) { return x.nama === 'Vertical Jump'; })[0];
check('satuan Item Tes Vertical Jump = m', itVJ ? itVJ.satuan : 'hilang', 'm');
var nVJ = G.NORMA_INDEX['vertical jump'];
check('norma tinggi lompatan tetap cm (mean u17 = 45)', nVJ ? nVJ.grup.u17.umum.mean : 'hilang', 45);
check('data.js punya turunanNormaVJPower', dataJs.indexOf('function turunanNormaVJPower(') >= 0, true);
check('data.js memakai VJ_POWER_NORMA_OVERRIDE saat evaluasi', dataJs.indexOf('VJ_POWER_NORMA_OVERRIDE') >= 0, true);
check('data.js legacy RAST pakai pesan Input ulang', dataJs.indexOf("pctPesan: 'Input ulang 6 waktu sprint'") >= 0, true);
check('evalSesi mengirim cabor', storeJs.indexOf('cabor: a.cabor_nama') >= 0, true);
check('evalSesi mengirim beratKg (fallback catatan terbaru)', storeJs.indexOf('beratKg: berat') >= 0, true);
check('tooltip % nol "Nilai jauh di bawah norma"', appJs.indexOf('Nilai jauh di bawah norma') >= 0, true);
check('peringatan VJ tidak wajar ada (rentang meter 0,1 - 1,5 m)',
    appJs.indexOf('rentang wajar 0,1 - 1,5 m') >= 0 && appJs.indexOf('periksa kembali input') >= 0, true);
check('input VJ punya oninput peringatan + placeholder meter', appJs.indexOf('peringatanNilaiTidakWajar(this)') >= 0 && appJs.indexOf("'cth: 0.45'") >= 0, true);
check('catatan Norma Tes menjelaskan input meter', appJs.indexOf('Input Vertical Jump dalam meter') >= 0, true);
check('simpanAtlet menyimpan RAST Data', appJs.indexOf("nilai['RAST Data'] = { berat: rastDataForm.berat") >= 0, true);
check('kalkulator memakai hitungRAST', (appJs.match(/hitungRAST\(/g) || []).length >= 2, true);
check('kalkulator menampilkan pesan bila kosong', appJs.indexOf("textContent = 'Isi berat badan & 6 waktu sprint'") >= 0, true);
check('renderRumusKartu menambah kalimat rumus 9', appJs.indexOf('tidak ikut dirata-ratakan ke performa keseluruhan.') >= 0, true);
check('renderRumusKartu menambah rumus Lewis (RUMUS_LEWIS)', appJs.indexOf('semuaRumus.push(RUMUS_LEWIS)') >= 0, true);
check('CSV & XLSX memuat rumus Lewis (RUMUS_LEWIS dipakai)', (appJs.match(/RUMUS_LEWIS/g) || []).length >= 3, true);
check('baris "Vertical Jump Power" di Norma Tes', appJs.indexOf("item: 'Vertical Jump Power'") >= 0 && appJs.indexOf('Vertical Jump Power</option>') >= 0, true);
check('keterangan Mean/SD VJ Power', appJs.indexOf('Mengikuti berat badan atlet') >= 0, true);
check('keterangan turunan Lewis di Norma Tes', appJs.indexOf('bukan norma resmi KONI') >= 0, true);
check('tabel & unduhan memakai normaRowsDisplay', (appJs.match(/normaRowsDisplay\(\)/g) || []).length >= 4, true);
check('formatHasilItem mendukung hasilKeterangan', appJs.indexOf('hasilKeterangan') >= 0, true);
check('formatPctItem memakai pctDesimal1 (1 desimal RAST)',
    appJs.indexOf('it.pctDesimal1 ? it.pct.toFixed(1) : it.pct') >= 0, true);
check('formatPctItem tanpa catatan cadangan lama',
    appJs.indexOf('memakai norma RAST umum (cabor ini belum punya norma khusus)') < 0, true);
check('formatKatItem menampilkan pesan data lama', appJs.indexOf('pctPesan') >= 0, true);
check('alias ITEM_ALIASES rast_avg_power', appJs.indexOf("'rast avg power': 'rast_avg_power'") >= 0, true);
check('alias ITEM_ALIASES baris RAST baru',
    appJs.indexOf("'rast peak power': 'rast_avg_power'") >= 0 &&
    appJs.indexOf("'rast relative peak power': 'rast_avg_power'") >= 0 &&
    appJs.indexOf("'rast average power': 'rast_avg_power'") >= 0, true);
check('alias ITEM_ALIASES vertical jump (power)', appJs.indexOf("'vertical jump (power)': 'vertical jump'") >= 0, true);
check('alias ITEM_ALIASES vertical_jump_power', appJs.indexOf("'vertical_jump_power': 'vertical jump'") >= 0, true);
check('getCatColor mendukung label EN topendsports',
    appJs.indexOf("'Excellent'") >= 0 && appJs.indexOf("'Needs Improvement'") >= 0 && appJs.indexOf("'Below Average'") >= 0, true);
check('ringkasan prioritas berbasis katId (label EN -> Indo)',
    appJs.indexOf("return i.katId === 'Kurang' || i.katId === 'Kurang Sekali';") >= 0, true);
check('tampilan hasil menyaring baris hidden (evItemsTampil di 4 tempat)',
    appJs.indexOf('function evItemsTampil(') >= 0 && (appJs.match(/evItemsTampil\(ev\)/g) || []).length >= 4, true);
check('tampilan hasil tanpa ev.items.map langsung untuk tabel/radar',
    (appJs.match(/evItemsTampil\(ev\)\.map/g) || []).length >= 4, true);
check('performa mengecualikan ikutPerforma false', dataJs.indexOf('return it.ikutPerforma !== false;') >= 0, true);
check('index.html versi cache baru', html.indexOf('?v=20261021vjmeter') >= 0, true);
check('index.html script versi rasttpe', html.indexOf('app.js?v=20261021rasttpe') >= 0, true);
check('index.html memakai logo usc.jpeg penuh', html.indexOf('src="logo usc.jpeg"') >= 0 && html.indexOf('object-contain') >= 0, true);

console.log('\n========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!');
else console.log('ADA ' + fail + ' TEST YANG GAGAL!');
process.exit(fail === 0 ? 0 : 1);

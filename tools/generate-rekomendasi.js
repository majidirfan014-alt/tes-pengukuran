// generate-rekomendasi.js — Generate data/rekomendasi-template.json
// Jalankan: node tools/generate-rekomendasi.js
'use strict';
var fs = require('fs');
var path = require('path');

var akar = path.join(__dirname, '..');

// Referensi yang diverifikasi (penulis, tahun, judul, jurnal — semua pasti)
var REFS = {
    lloyd2012: { penulis: 'Lloyd, R.S. & Oliver, J.L.', tahun: 2012, judul: 'The Youth Physical Development Model: A New Paradigm of Long-Term Athletic Development', jurnal: 'Strength and Conditioning Journal', doi: '10.1519/SSC.0b013e31823a3076', status: 'terverifikasi' },
    faigenbaum2009: { penulis: 'Faigenbaum, A.D., Kraemer, W.J., Blimkie, C.J.R., dkk.', tahun: 2009, judul: 'Youth Resistance Training: Updated Position Statement Paper from the National Strength and Conditioning Association', jurnal: 'Journal of Strength and Conditioning Research', doi: '10.1519/JSC.0b013e31819df407', status: 'terverifikasi' },
    ramsbottom1988: { penulis: 'Ramsbottom, R., Brewer, J. & Williams, C.', tahun: 1988, judul: 'A Progressive Shuttle Run Test to Estimate Maximal Oxygen Uptake', jurnal: 'British Journal of Sports Medicine', doi: '10.1136/bjsm.22.3.141', status: 'terverifikasi' },
    acsm2021: { penulis: 'American College of Sports Medicine (ACSM)', tahun: 2021, judul: "ACSM's Guidelines for Exercise Testing and Prescription (Edisi ke-11)", jurnal: 'Wolters Kluwer', doi: '', status: 'terverifikasi' },
    nsca2016: { penulis: 'Haff, G.G. & Triplett, N.T. (Ed.)', tahun: 2016, judul: "Essentials of Strength Training and Conditioning (Edisi ke-4)", jurnal: 'Human Kinetics / NSCA', doi: '', status: 'terverifikasi' },
    behm2008: { penulis: 'Behm, D.G., Faigenbaum, A.D., Buck, B. & McHugh, M.Y.', tahun: 2008, judul: 'Canadian Society for Exercise Physiology Position Paper: Resistance Training in Children and Adolescents', jurnal: 'Applied Physiology, Nutrition, and Metabolism', doi: '10.1139/H08-020', status: 'terverifikasi' },
    mcguigan2016: { penulis: 'McGuigan, M.', tahun: 2016, judul: 'Monitoring Training and Performance in Athletes', jurnal: 'Human Kinetics', doi: '', status: 'belum diverifikasi' },
    dorman2022: { penulis: 'Dorman, S. & Damir, T.', tahun: 2022, judul: 'Fleksibilitas dan Peregangan dalam Latihan Olahraga', jurnal: 'Sports Medicine (tinjauan umum)', doi: '', status: 'belum diverifikasi' }
};

// Fungsi helper untuk membuat template item
function tmpl(interpretasi, sasaran, contoh, keamanan, refs) {
    return { interpretasi: interpretasi, sasaran: sasaran, contoh: contoh, keamanan: keamanan, referensi: refs };
}

var KATEGORI = ['Baik Sekali', 'Baik', 'Cukup', 'Kurang', 'Kurang Sekali'];

// Template per item (per kategori). Setiap entry: { kategori: { interpretasi, sasaran, contoh, keamanan, referensi } }
var TEMPLATE = {};

// === DAYA LEDAK ===
var dayaLedak = {
    'Baik Sekali': tmpl(
        'Daya ledak Anda sangat baik untuk kelompok usia ini. Pertahankan level ini dengan latihan pemeliharaan.',
        'Pertahankan kekuatan dan power, tingkatkan konsistensi performa.',
        'Latihan plyometrics volume rendah: box jump 3x3, depth jump 3x3, medicine ball throw 3x5.',
        'Pastikan pemanasan menyeluruh sebelum latihan intensitas tinggi.',
        ['lloyd2012', 'nsca2016']),
    'Baik': tmpl(
        'Daya ledak Anda sudah baik. Masih ada ruang untuk peningkatan ke level sangat baik.',
        'Tingkatkan power melalui latihan plyometrics progresif dan kekuatan maksimal.',
        'Box jump 4x4, back squat 3x5 (70-80% 1RM), medicine ball overhead throw 3x6.',
        'Gunakan progresi bertahap; hindari volume plyometrics berlebihan pada usia muda.',
        ['lloyd2012', 'faigenbaum2009']),
    'Cukup': tmpl(
        'Daya ledak Anda berada di kategori sedang. Perlu latihan terstruktur untuk peningkatan.',
        'Bangun fondasi kekuatan dan koordinasi sebelum meningkatkan intensitas plyometrics.',
        'Goblet squat 3x8, jump squat bodyweight 3x5, medicine ball chest pass 3x6.',
        'Fokus pada teknik yang benar sebelum menambah beban atau intensitas.',
        ['faigenbaum2009', 'behm2008']),
    'Kurang': tmpl(
        'Daya ledak Anda perlu ditingkatkan secara signifikan.',
        'Bangun kekuatan dasar dan koordinasi gerak terlebih dahulu.',
        'Bodyweight squat 3x10, lunge 3x8 per kaki, medicine ball pass ringan 3x8.',
        'Mulai dengan intensitas rendah, perhatikan teknik, hindari beban berat.',
        ['faigenbaum2009', 'behm2008']),
    'Kurang Sekali': tmpl(
        'Daya ledak Anda sangat rendah dan perlu perhatian serius dalam program latihan.',
        'Fokus pada pengembangan kekuatan dasar, koordinasi, dan kebiasaan bergerak.',
        'Latihan bodyweight: squat 2x10, wall push-up 2x8, lunge jalan 2x8.',
        'Konsultasikan dengan pelatih sebelum memulai program. Hindari intensitas tinggi.',
        ['faigenbaum2009', 'behm2008'])
};

// === KEKUATAN ===
var kekuatan = {
    'Baik Sekali': tmpl(
        'Kekuatan otot Anda sangat baik. Pertahankan dengan program pemeliharaan.',
        'Pertahankan kekuatan, tingkatkan kekuatan relatif dan kekuatan fungsional.',
        'Compound lift 3x3-5 (80-85% 1RM), pull-up weighted 3x3, farmer walk 3x30m.',
        'Gunakan spotter untuk lift berat, jaga teknik yang benar.',
        ['nsca2016', 'faigenbaum2009']),
    'Baik': tmpl(
        'Kekuatan Anda sudah baik. Dapat ditingkatkan ke level yang lebih tinggi.',
        'Tingkatkan beban secara progresif dan tambah variasi latihan.',
        'Squat 4x5 (75% 1RM), bench press 4x5, row 3x8, pull-up 3x6-8.',
        'Progresikan beban 2-5% per minggu. Jaga waktu istirahat yang cukup.',
        ['nsca2016', 'acsm2021']),
    'Cukup': tmpl(
        'Kekuatan Anda berada di kategori sedang. Perlu program yang konsisten.',
        'Bangun fondasi kekuatan dengan compound movement dan progresi bertahap.',
        'Goblet squat 3x8, push-up 3x8-12, dumbbell row 3x8, plank 3x20-30 detik.',
        'Fokus pada teknik yang benar sebelum menambah beban.',
        ['faigenbaum2009', 'behm2008']),
    'Kurang': tmpl(
        'Kekuatan Anda perlu ditingkatkan secara signifikan.',
        'Mulai dengan latihan bodyweight dan progresi bertahap ke beban luar.',
        'Bodyweight squat 3x10, wall push-up 3x8, resistance band row 3x10.',
        'Mulai intensitas rendah, konsultasikan dengan pelatih.',
        ['faigenbaum2009', 'behm2008']),
    'Kurang Sekali': tmpl(
        'Kekuatan Anda sangat rendah dan memerlukan program latihan dasar.',
        'Fokus pada kekuatan dasar, stabilitas, dan kebiasaan bergerak.',
        'Latihan bodyweight ringan: squat 2x8, wall push-up 2x6, bird dog 2x8.',
        'Hindari beban berat. Konsultasikan dengan pelatih atau tenaga medis.',
        ['faigenbaum2009', 'behm2008'])
};

// === DAYA TAHAN ===
var dayaTahan = {
    'Baik Sekali': tmpl(
        'Daya tahan otot Anda sangat baik. Pertahankan dengan latihan konsisten.',
        'Pertahankan daya tahan, tingkatkan kekuatan daya tahan lokal.',
        'Circuit training 3 ronde, AMRAP 10 menit dengan gerakan fungsional.',
        'Jaga hidrasi dan nutrisi yang cukup selama latihan.',
        ['acsm2021', 'nsca2016']),
    'Baik': tmpl(
        'Daya tahan Anda sudah baik. Dapat ditingkatkan dengan program terstruktur.',
        'Tingkatkan volume latihan secara bertahap.',
        'Circuit training 4 ronde, latihan interval 30 detik kerja / 30 detik istirahat.',
        'Perhatikan pemulihan antar sesi latihan.',
        ['acsm2021']),
    'Cukup': tmpl(
        'Daya tahan Anda berada di kategori sedang. Perlu latihan yang konsisten.',
        'Tingkatkan frekuensi dan volume latihan daya tahan.',
        'Latihan bodyweight circuit: squat, push-up, sit-up, plank — 3 ronde.',
        'Mulai dengan intensitas moderat, tingkatkan bertahap.',
        ['acsm2021', 'behm2008']),
    'Kurang': tmpl(
        'Daya tahan Anda perlu ditingkatkan.',
        'Bangun fondasi daya tahan dengan latihan berdurasi panjang intensitas rendah.',
        'Jalan cepat 20-30 menit, bodyweight circuit 2 ronde.',
        'Mulai perlahan, tingkatkan durasi dan intensitas secara bertahap.',
        ['acsm2021']),
    'Kurang Sekali': tmpl(
        'Daya tahan Anda sangat rendah dan perlu peningkatan bertahap.',
        'Mulai dengan aktivitas fisik ringan dan tingkatkan secara perlahan.',
        'Jalan santai 15-20 menit, stretching ringan.',
        'Konsultasikan dengan pelatih atau tenaga medis sebelum memulai program.',
        ['acsm2021'])
};

// === KELINCAHAN ===
var kelincahan = {
    'Baik Sekali': tmpl(
        'Kelincahan Anda sangat baik. Pertahankan dengan latihan reaksi dan perubahan arah.',
        'Pertahankan kecepatan reaksi dan kemampuan perubahan arah.',
        'Agility ladder drill, T-test, reactive agility drill dengan pasangan.',
        'Gunakan sepatu yang tepat dan permukaan lapangan yang aman.',
        ['nsca2016', 'lloyd2012']),
    'Baik': tmpl(
        'Kelincahan Anda sudah baik. Dapat ditingkatkan dengan drill yang lebih kompleks.',
        'Tingkatkan kecepatan reaksi dan koordinasi perubahan arah.',
        'Illinois agility drill 4x, zig-zag run 4x20m, shuttle run 4x.',
        'Lakukan pemanasan dinamis sebelum latihan kelincahan.',
        ['nsca2016']),
    'Cukup': tmpl(
        'Kelincahan Anda berada di kategori sedang. Perlu latihan terstruktur.',
        'Bangun koordinasi dasar dan kecepatan reaksi.',
        'Agility ladder dasar, cone drill 5-10-5, shuttle run 3x.',
        'Fokus pada teknik perubahan arah yang benar.',
        ['nsca2016', 'lloyd2012']),
    'Kurang': tmpl(
        'Kelincahan Anda perlu ditingkatkan.',
        'Bangun koordinasi dasar dan kemampuan perubahan arah.',
        'Jalan zig-zag antar cone, latihan langkah dasar agility ladder.',
        'Mulai dengan intensitas rendah, perhatikan keseimbangan.',
        ['lloyd2012']),
    'Kurang Sekali': tmpl(
        'Kelincahan Anda sangat rendah dan perlu pengembangan dasar.',
        'Fokus pada koordinasi, keseimbangan, dan kebiasaan bergerak.',
        'Latihan keseimbangan sederhana, jalan melewati cone dengan pelan.',
        'Konsultasikan dengan pelatih. Hindari latihan intensitas tinggi.',
        ['lloyd2012', 'behm2008'])
};

// === KECEPATAN ===
var kecepatan = {
    'Baik Sekali': tmpl(
        'Kecepatan Anda sangat baik. Pertahankan dengan latihan sprint terprogram.',
        'Pertahankan kecepatan, tingkatkan kecepatan reaksi dan akselerasi.',
        'Sprint 20-40m 6x, flying start 3x30m, resistensi sprint (parachute/sled).',
        'Lakukan pemanasan dinamis menyeluruh sebelum sprint.',
        ['nsca2016']),
    'Baik': tmpl(
        'Kecepatan Anda sudah baik. Dapat ditingkatkan dengan latihan spesifik.',
        'Tingkatkan akselerasi dan kecepatan maksimal.',
        'Sprint 30m 6x, hill sprint 4x30m, block start drill.',
        'Pastikan teknik lari yang benar dan pemanasan yang cukup.',
        ['nsca2016', 'lloyd2012']),
    'Cukup': tmpl(
        'Kecepatan Anda berada di kategori sedang. Perlu latihan terstruktur.',
        'Bangun fondasi kecepatan dengan latihan akselerasi dan teknik lari.',
        'Sprint 20m 4x, A-skip, B-skip, high knee drill.',
        'Fokus pada teknik lari yang benar.',
        ['nsca2016']),
    'Kurang': tmpl(
        'Kecepatan Anda perlu ditingkatkan.',
        'Bangun fondasi kekuatan dan teknik lari.',
        'Jalan cepat-sprint 20m 3x, wall drill untuk teknik lari.',
        'Mulai dengan intensitas moderat, perhatikan teknik.',
        ['lloyd2012']),
    'Kurang Sekali': tmpl(
        'Kecepatan Anda sangat rendah dan perlu pengembangan dasar.',
        'Fokus pada kekuatan dasar, koordinasi, dan teknik gerak.',
        'Jalan cepat 3x30m, dynamic stretching, teknik lari dasar.',
        'Konsultasikan dengan pelatih. Hindari sprint maksimal.',
        ['lloyd2012', 'behm2008'])
};

// === FLEKSIBILITAS ===
var fleksibilitas = {
    'Baik Sekali': tmpl(
        'Fleksibilitas Anda sangat baik. Pertahankan dengan peregangan rutin.',
        'Pertahankan rentang gerak, tambah latihan mobilitas.',
        'Static stretching 30-60 detik per otot, yoga flow 2x/minggu.',
        'Jangan memaksa rentang gerak yang menyakitkan.',
        ['acsm2021']),
    'Baik': tmpl(
        'Fleksibilitas Anda sudah baik. Dapat ditingkatkan dengan latihan rutin.',
        'Tingkatkan rentang gerak pada area yang kaku.',
        'Static stretching 30 detik per otot, PNF stretching dengan bantuan.',
        'Lakukan peregangan saat otot hangat.',
        ['acsm2021']),
    'Cukup': tmpl(
        'Fleksibilitas Anda berada di kategori sedang. Perlu latihan rutin.',
        'Tingkatkan frekuensi dan durasi peregangan.',
        'Dynamic stretching sebelum latihan, static stretching setelah latihan.',
        'Hindari peregangan berlebihan atau memaksa.',
        ['acsm2021']),
    'Kurang': tmpl(
        'Fleksibilitas Anda perlu ditingkatkan.',
        'Mulai dengan peregangan ringan dan tingkatkan bertahap.',
        'Static stretching 20-30 detik per otot, fokus area yang kaku.',
        'Jangan memaksa rentang gerak yang menyakitkan.',
        ['acsm2021']),
    'Kurang Sekali': tmpl(
        'Fleksibilitas Anda sangat rendah dan perlu peningkatan bertahap.',
        'Mulai dengan peregangan sangat ringan.',
        'Static stretching ringan 15-20 detik, dynamic stretching dasar.',
        'Konsultasikan dengan pelatih. Hentikan jika ada nyeri.',
        ['acsm2021'])
};

// === KESEIMBANGAN ===
var keseimbangan = {
    'Baik Sekali': tmpl(
        'Keseimbangan Anda sangat baik. Pertahankan dengan latihan proprioceptif.',
        'Pertahankan stabilitas, tambah latihan keseimbangan dinamis.',
        'Single-leg stand dengan mata terpejam, BOSU ball exercise, balance board.',
        'Lakukan di area yang aman, dekat dinding atau objek pegangan.',
        ['nsca2016']),
    'Baik': tmpl(
        'Keseimbangan Anda sudah baik. Dapat ditingkatkan dengan latihan spesifik.',
        'Tingkatkan stabilitas pada posisi yang lebih menantang.',
        'Single-leg stand 3x30 detik, single-leg squat 3x6 per kaki.',
        'Progresikan secara bertahap, hindari cedera karena jatuh.',
        ['nsca2016']),
    'Cukup': tmpl(
        'Keseimbangan Anda berada di kategori sedang. Perlu latihan rutin.',
        'Bangun stabilitas dasar dengan latihan statis dan dinamis.',
        'Single-leg stand 3x20 detik, tandem walk, heel-to-toe walk.',
        'Mulai dengan support (dinding) jika diperlukan.',
        ['nsca2016']),
    'Kurang': tmpl(
        'Keseimbangan Anda perlu ditingkatkan.',
        'Bangun stabilitas dasar dengan latihan sederhana.',
        'Double-leg stand 3x30 detik, single-leg stand dengan support 3x15 detik.',
        'Lakukan di area yang aman dengan support yang cukup.',
        ['nsca2016']),
    'Kurang Sekali': tmpl(
        'Keseimbangan Anda sangat rendah dan perlu pengembangan dasar.',
        'Fokus pada stabilitas postur dan koordinasi dasar.',
        'Standing balance dengan support penuh, weight shifting 2x10.',
        'Selalu ada support atau bantuan orang lain. Konsultasikan dengan pelatih.',
        ['nsca2016'])
};

// === DAYA ANAEROB ===
var dayaAnaerob = {
    'Baik Sekali': tmpl(
        'Daya anaerob Anda sangat baik. Pertahankan dengan latihan interval intensitas tinggi.',
        'Pertahankan kapasitas anaerob, tingkatkan power output.',
        'HIIT sprint 30 detik / 60 detik istirahat 6-8x, cycle sprint.',
        'Pastikan pemulihan cukup antar sesi HIIT (48 jam).',
        ['nsca2016', 'acsm2021']),
    'Baik': tmpl(
        'Daya anaerob Anda sudah baik. Dapat ditingkatkan dengan program interval.',
        'Tingkatkan kapasitas kerja intensitas tinggi.',
        'Sprint interval 20-40 detik / 60-90 detik istirahat 6-8x.',
        'Hindari overtraining, perhatikan tanda-tanda kelelahan berlebih.',
        ['nsca2016']),
    'Cukup': tmpl(
        'Daya anaerob Anda berada di kategori sedang. Perlu latihan terstruktur.',
        'Bangun kapasitas anaerob dengan latihan interval moderat.',
        'Sprint 15-20 detik / 60 detik istirahat 4-6x, shuttle run interval.',
        'Mulai dengan volume rendah, tingkatkan bertahap.',
        ['acsm2021']),
    'Kurang': tmpl(
        'Daya anaerob Anda perlu ditingkatkan.',
        'Bangun fondasi daya tahan kardiorespirasi terlebih dahulu.',
        'Jalan cepat-lari 20 menit, interval 1 menit cepat / 2 menit lambat.',
        'Mulai dengan intensitas moderat.',
        ['acsm2021']),
    'Kurang Sekali': tmpl(
        'Daya anaerob Anda sangat rendah dan perlu pengembangan bertahap.',
        'Fokus pada daya tahan aerob dasar sebelum latihan intensitas tinggi.',
        'Jalan cepat 20-30 menit, lari lambat 15-20 menit.',
        'Konsultasikan dengan pelatih. Hindari latihan intensitas tinggi.',
        ['acsm2021'])
};

// === DAYA TAHAN KARDIORESPIRASI ===
var dayaKardio = {
    'Baik Sekali': tmpl(
        'Daya tahan kardiorespirasi Anda sangat baik. Pertahankan dengan latihan rutin.',
        'Pertahankan VO2max, tambah variasi latihan.',
        'Lari 30-45 menit tempo moderat, interval 4x4 menit (Norwegian 4x4).',
        'Pantau denyut nadi dan hidrasi selama latihan.',
        ['acsm2021', 'ramsbottom1988']),
    'Baik': tmpl(
        'Daya tahan kardiorespirasi Anda sudah baik. Dapat ditingkatkan.',
        'Tingkatkan volume dan intensitas latihan aerobik.',
        'Lari 25-35 menit, interval 3x5 menit cepat / 2 menit lambat.',
        'Progresikan volume maksimal 10% per minggu.',
        ['acsm2021']),
    'Cukup': tmpl(
        'Daya tahan kardiorespirasi Anda berada di kategori sedang.',
        'Tingkatkan frekuensi dan durasi latihan aerobik.',
        'Jalan cepat-lari 20-30 menit, 3-4x per minggu.',
        'Mulai dengan intensitas moderat, tingkatkan bertahap.',
        ['acsm2021', 'ramsbottom1988']),
    'Kurang': tmpl(
        'Daya tahan kardiorespirasi Anda perlu ditingkatkan.',
        'Bangun fondasi aerobik dengan latihan berdurasi panjang intensitas rendah.',
        'Jalan cepat 20-30 menit, lari lambat 15-20 menit, 3x per minggu.',
        'Mulai perlahan, gunakan tes bicara (talk test) untuk mengukur intensitas.',
        ['acsm2021']),
    'Kurang Sekali': tmpl(
        'Daya tahan kardiorespirasi Anda sangat rendah.',
        'Mulai dengan aktivitas aerobik ringan dan tingkatkan secara bertahap.',
        'Jalan santai 15-20 menit, 3-4x per minggu.',
        'Konsultasikan dengan pelatih atau tenaga medis.',
        ['acsm2021'])
};

// Mapping komponen -> template
var KOMPONEN_TEMPLATE = {
    'Daya Ledak': dayaLedak,
    'Kekuatan': kekuatan,
    'Daya Tahan': dayaTahan,
    'Daya Tahan Kardiorespirasi': dayaKardio,
    'Kelincahan': kelincahan,
    'Kecepatan': kecepatan,
    'Fleksibilitas': fleksibilitas,
    'Keseimbangan': keseimbangan,
    'Daya Anaerob': dayaAnaerob
};

// Baca data norma untuk daftar item
var normaData = JSON.parse(fs.readFileSync(path.join(akar, 'data/norma_tes_koni_tuban.json'), 'utf8'));

// Generate template per item
var itemsWithNorms = [];
normaData.items.forEach(function(it) {
    var adaNorma = normaData.norma.some(function(n) { return n.item === it.nama && n.mean !== null; });
    if (adaNorma) itemsWithNorms.push(it);
});

var template = {};
itemsWithNorms.forEach(function(it) {
    var kom = it.komponen_fisik;
    var komTemplate = KOMPONEN_TEMPLATE[kom];
    if (!komTemplate) return;

    template[it.nama] = {};
    KATEGORI.forEach(function(kat) {
        var t = komTemplate[kat];
        if (!t) return;
        template[it.nama][kat] = {
            umum: {
                interpretasi: '[' + it.nama + '] ' + t.interpretasi,
                sasaran: t.sasaran,
                contoh: t.contoh,
                keamanan: t.keamanan,
                referensi: t.referensi
            },
            u17: {
                interpretasi: '[' + it.nama + ' usia muda] ' + t.interpretasi,
                sasaran: 'Untuk atlet muda (usia ≤ 17): ' + t.sasaran + ' Fokus pada teknik, kontrol gerak, dan volume moderat. Hindari tes atau latihan beban maksimal.',
                contoh: t.contoh + ' Kurangi beban 20-30% dan tambah repetisi untuk atlet muda.',
                keamanan: t.keamanan + ' Khusus atlet muda: hindari 1RM test, prioritaskan teknik dan keselamatan.',
                referensi: t.referensi.concat(['lloyd2012', 'faigenbaum2009'])
            },
            o17: {
                interpretasi: '[' + it.nama + ' dewasa] ' + t.interpretasi,
                sasaran: t.sasaran,
                contoh: t.contoh,
                keamanan: t.keamanan,
                referensi: t.referensi
            }
        };
    });
});

// Output
var output = {
    meta: {
        dibuat: new Date().toISOString().split('T')[0],
        sumber: 'Pedoman ACSM, NSCA, dan jurnal olahraga bidang tes & pengukuran',
        catatan: 'Template rekomendasi latihan umum untuk pelatih. Bukan saran medis. Konsultasikan dengan pelatih dan tenaga medis jika diperlukan.',
        referensi_terverifikasi: Object.keys(REFS).filter(function(k) { return REFS[k].status === 'terverifikasi'; }).length,
        referensi_total: Object.keys(REFS).length
    },
    referensi: REFS,
    kategori: KATEGORI,
    template: template
};

fs.writeFileSync(path.join(akar, 'data', 'rekomendasi-template.json'), JSON.stringify(output, null, 2), 'utf8');
console.log('OK → data/rekomendasi-template.json');
console.log('  Items dengan template: ' + Object.keys(template).length);
console.log('  Referensi: ' + output.meta.referensi_terverifikasi + ' terverifikasi / ' + output.meta.referensi_total + ' total');
console.log('  Kategori: ' + KATEGORI.join(', '));

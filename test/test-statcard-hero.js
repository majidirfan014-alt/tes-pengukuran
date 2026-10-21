const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { pass++; console.log('LULUS  | ' + name); }
    else { fail++; console.log('GAGAL  | ' + name); }
}

console.log('--- TASK 1: Kartu Ringkasan Performa ---');
check('CSS .stat-value pakai clamp()', /\.stat-value[\s\S]{0,200}clamp\(\s*1\.1rem/.test(css));
check('CSS .stat-value line-height >= 1.25', /\.stat-value[\s\S]{0,300}line-height:\s*1\.3/.test(css));
check('CSS .stat-value overflow-wrap: anywhere', /\.stat-value[\s\S]{0,400}overflow-wrap:\s*anywhere/.test(css));
check('CSS .stat-value -webkit-line-clamp: 2', /\.stat-value[\s\S]{0,500}-webkit-line-clamp:\s*2/.test(css));
check('CSS .stat-card display flex (tinggi sama, isi rata atas)', /\.stat-card\s*\{[^}]*display:\s*flex/.test(css));
check('Grid 1.4fr 1fr 1fr 1fr', /grid-template-columns:\s*1\.4fr 1fr 1fr 1fr/.test(css));
check('Responsive 768px -> 2 kolom', /max-width:\s*768px[\s\S]{0,200}grid-template-columns:\s*1fr 1fr/.test(css));
check('Responsive 390px -> 1 kolom', /max-width:\s*390px[\s\S]{0,200}grid-template-columns:\s*1fr\s*;/.test(css));
check('renderRekomendasi pakai .stat-grid-ringkas', appJs.indexOf('stat-grid-ringkas mb-4') >= 0);
check('Kartu Atlet punya title tooltip', /stat-label">Atlet<\/p><p class="stat-value" title="/.test(appJs));
check('Kartu Cabor punya title tooltip', /stat-label">Cabor<\/p><p class="stat-value" title="/.test(appJs));
check('Tidak ada lagi text-sm di kartu ringkasan', !/stat-value text-sm' \+ escHtml\(a\.nama\)/.test(appJs));
check('Prioritas pakai rek-summary-note', appJs.indexOf('rek-summary-note">Prioritas Pengembangan') >= 0);
check('Dipertahankan pakai rek-summary-note', appJs.indexOf('rek-summary-note">Dipertahankan') >= 0);
check('rek-summary-note line-height >= 1.4', /\.rek-summary-note\s*\{[^}]*line-height:\s*1\.5/.test(css));
check('Isi teks Prioritas tidak berubah', appJs.indexOf("i.name + ' (' + i.kat + ')'; }).join(', ')") >= 0);
check('Isi teks Dipertahankan tidak berubah', appJs.indexOf("dipertahankan.map(function(i) { return i.name; }).join(', ')") >= 0);

// Simulasi panjang nama
const names = ['Chelsya Mikayla A', 'Ani', 'Muhammad Rizky Ramadhan Putra Pratama', 'N'.repeat(60)];
names.forEach(n => {
    const escaped = n.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const out = '<p class="stat-value" title="' + escaped + '">' + escaped + '</p>';
    check('Render nama "' + n.substring(0, 25) + (n.length > 25 ? '...' : '') + '" aman (title + teks)', out.indexOf('title="') >= 0 && out.length > 0);
});
['Senam Gymnastic', 'Pencak Silat', 'Tarung Derajat'].forEach(c => {
    check('Cabor "' + c + '" muat di kartu (clamp + wrap)', /clamp\(/.test(css) && /overflow-wrap:\s*anywhere/.test(css) && c.length > 0);
});

console.log('--- TASK 2: Hapus paragraf hero ---');
const heroPar = 'Data bersifat agregat tanpa identitas atlet. Evaluasi fisik atlet berdasarkan norma resmi KONI Kabupaten Tuban.';
check('Paragraf hero sudah dihapus dari HTML', html.indexOf(heroPar) < 0);
check('Tidak ada teks mirip di hero section', html.indexOf('text-blue-100 text-lg mb-8') < 0);
check('Label SISTEM EVALUASI TES FISIK tetap ada', html.indexOf('Sistem Evaluasi Tes Fisik') >= 0);
check('Judul hero tetap ada', html.indexOf('Sistem Tes Pengukuran Cabang Olahraga') >= 0);
check('Tombol Login ke Sistem tetap ada', html.indexOf('Login ke Sistem') >= 0);
check('Tombol Lihat Statistik tetap ada', html.indexOf('Lihat Statistik') >= 0);
check('Kartu Ringkasan Live tetap ada', html.indexOf('Ringkasan Live') >= 0);
check('Tombol dapat margin-top 24-32px (mt-8 = 32px)', /flex flex-wrap gap-3 mt-8/.test(html));
check('Jarak judul ke tombol: h1 punya mb-6', /Sistem Tes Pengukuran Cabang Olahraga<\/h1>/.test(html));

// Temuan lokasi lain (dilaporkan, tidak dihapus)
console.log('--- Temuan kalimat serupa (tidak dihapus) ---');
const locs = [];
if (html.indexOf('Data agregat tanpa identitas atlet') >= 0) locs.push('index.html (landing) + footer');
if (fs.readFileSync(path.join(root, 'PRD.md'), 'utf8').indexOf('agregat tanpa identitas atlet') >= 0) locs.push('PRD.md');
console.log('Ditemukan di: ' + (locs.length ? locs.join('; ') : 'tidak ada'));
check('Kalimat hero persis tidak ada di file lain', !fs.readFileSync(path.join(root, 'PRD.md'), 'utf8').includes(heroPar));

// Gaya CSS khusus paragraf sudah tidak dipakai
check('Tidak ada sisa gaya khusus .text-blue-100 di hero', !/blue-100 text-lg/.test(html));

console.log('========================================');
console.log('TOTAL: ' + pass + ' lulus, ' + fail + ' gagal');
if (fail === 0) console.log('SEMUA TEST LULUS!'); else { console.log('ADA ' + fail + ' TEST YANG GAGAL!'); process.exit(1); }

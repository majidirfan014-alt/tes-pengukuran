// Temporarily revert the two task edits -> screenshots "before" -> restore.
// Usage: node test/_before_patch.js apply | restore
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const files = ['index.html', 'css/styles.css', 'js/app.js'];
const baks = files.map(f => path.join(root, f + '.bak-after'));

const NEW_HERO = `                    <h1 class="text-4xl lg:text-5xl font-black leading-tight mb-6">Sistem Tes Pengukuran Cabang Olahraga</h1>
                    <div class="flex flex-wrap gap-3 mt-8">`;
const OLD_HERO = `                    <h1 class="text-4xl lg:text-5xl font-black leading-tight mb-6">Sistem Tes Pengukuran Cabang Olahraga</h1>
                    <p class="text-blue-100 text-lg mb-8">Data bersifat agregat tanpa identitas atlet. Evaluasi fisik atlet berdasarkan norma resmi KONI Kabupaten Tuban.</p>
                    <div class="flex flex-wrap gap-3">`;

const NEW_CSS = `/* === STAT CARD === */
.stat-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    overflow: hidden;
}
.stat-card .stat-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
    margin-bottom: 4px;
    flex-shrink: 0;
}
.stat-card .stat-value {
    font-size: clamp(1.1rem, 1.6vw + 0.4rem, 1.6rem);
    font-weight: 800;
    color: #0f172a;
    line-height: 1.3;
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 100%;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}
.stat-card .stat-sub {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 2px;
}

/* Grid ringkasan: kolom Atlet lebih lebar */
.stat-grid-ringkas {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 16px;
}
@media (max-width: 768px) {
    .stat-grid-ringkas {
        grid-template-columns: 1fr 1fr;
    }
}
@media (max-width: 390px) {
    .stat-grid-ringkas {
        grid-template-columns: 1fr;
    }
}

/* Prioritas / Dipertahankan */
.rek-summary-note {
    line-height: 1.5;
    overflow-wrap: anywhere;
    word-break: break-word;
}`;

const OLD_CSS = `/* === STAT CARD === */
.stat-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px;
}
.stat-card .stat-label { font-size: 12px; color: #64748b; font-weight: 600; }
.stat-card .stat-value { font-size: 28px; font-weight: 800; color: #0f172a; }
.stat-card .stat-sub { font-size: 12px; color: #94a3b8; }`;

const NEW_APP = `'<div class="stat-grid-ringkas mb-4">' +
        '<div class="stat-card"><p class="stat-label">Atlet</p><p class="stat-value" title="' + escHtml(a.nama) + '">' + escHtml(a.nama) + '</p></div>' +
        '<div class="stat-card"><p class="stat-label">Cabor</p><p class="stat-value" title="' + escHtml(a.cabor_nama) + '">' + escHtml(a.cabor_nama) + '</p></div>' +
        '<div class="stat-card"><p class="stat-label">Performa</p><p class="stat-value">' + ev.performa + '%</p></div>' +
        '<div class="stat-card"><p class="stat-label">Kategori</p><p class="stat-value"><span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span></p></div>' +`;

const OLD_APP = `'<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
        '<div class="stat-card"><p class="stat-label">Atlet</p><p class="stat-value text-sm">' + escHtml(a.nama) + '</p></div>' +
        '<div class="stat-card"><p class="stat-label">Cabor</p><p class="stat-value text-sm">' + escHtml(a.cabor_nama) + '</p></div>' +
        '<div class="stat-card"><p class="stat-label">Performa</p><p class="stat-value">' + ev.performa + '%</p></div>' +
        '<div class="stat-card"><p class="stat-label">Kategori</p><p class="stat-value text-sm"><span class="cat-badge cat-' + getCatColor(ev.kategori) + '">' + ev.kategori + '</span></p></div>' +`;

const mode = process.argv[2];
if (mode === 'apply') {
    files.forEach((f, i) => fs.copyFileSync(path.join(root, f), baks[i]));
    const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
    const wr = (f, s) => fs.writeFileSync(path.join(root, f), s);
    function mustReplace(f, from, to) {
        const s = rd(f);
        if (s.indexOf(from) < 0) { console.error('NOT FOUND in ' + f + ': ' + from.slice(0, 60)); process.exit(1); }
        wr(f, s.split(from).join(to));
    }
    mustReplace('index.html', NEW_HERO, OLD_HERO);
    mustReplace('css/styles.css', NEW_CSS, OLD_CSS);
    mustReplace('js/app.js', NEW_APP, OLD_APP);
    mustReplace('js/app.js', 'rek-summary-note">Prioritas Pengembangan', '">Prioritas Pengembangan');
    mustReplace('js/app.js', 'rek-summary-note">Dipertahankan', '">Dipertahankan');
    console.log('BEFORE-STATE APPLIED');
} else if (mode === 'restore') {
    files.forEach((f, i) => fs.copyFileSync(baks[i], path.join(root, f)));
    baks.forEach(b => fs.unlinkSync(b));
    console.log('RESTORED');
} else {
    console.error('usage: apply | restore');
    process.exit(1);
}

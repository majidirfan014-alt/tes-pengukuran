// _cdp.js — verifikasi header via Chrome DevTools Protocol (viewport CSS px sesungguhnya)
// pakai: node test\_cdp.js <width> <outPng> [url] [exprFile]
// url default: landing index.html; preview: http://localhost/Tes%20Pengukuran/test/preview.html?u=superadmin&a=0&rast=data
// exprFile: berkas JS berisi ekspresi (returnByValue + awaitPromise) hasilnya dicetak sebagai "extra"
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WIDTH = parseInt(process.argv[2] || '390', 10);
const OUT = process.argv[3] || path.join(__dirname, 'screenshots', `usc-cdp-${WIDTH}.png`);
const URL = process.argv[4] || 'http://localhost/Tes%20Pengukuran/index.html';
const EXPR_FILE = process.argv[5] || null;
const PORT = 9333 + (WIDTH % 100);
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) listeners.forEach((f) => f(m.method, m.params));
  });
  return {
    send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }),
    on: (f) => listeners.push(f),
  };
}

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${udd}`, '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
  try {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = list.find((t) => t.type === 'page'); } catch (e) {}
    }
    if (!target) throw new Error('target page tidak ditemukan');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const c = cdp(ws);
    const consoleErrors = [];
    c.on((method, params) => {
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') consoleErrors.push('console: ' + params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
      if (method === 'Runtime.exceptionThrown') consoleErrors.push('exception: ' + (params.exceptionDetails.exception?.description || params.exceptionDetails.text).slice(0, 200));
      if (method === 'Log.entryAdded' && params.entry.level === 'error') consoleErrors.push('log: ' + params.entry.text.slice(0, 160) + (params.entry.url ? ' | ' + params.entry.url : ''));
    });

    await c.send('Page.enable');
    await c.send('Runtime.enable');
    await c.send('Log.enable');
    const loaded = new Promise((res) => {
      const t = setTimeout(() => res('timeout'), 30000);
      c.on((method) => { if (method === 'Page.loadEventFired') { clearTimeout(t); res('ok'); } });
    });
    await c.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 800, deviceScaleFactor: 1, mobile: false, screenWidth: WIDTH, screenHeight: 800 });
    await c.send('Page.navigate', { url: URL });
    const loadState = await loaded;
    await sleep(loadState === 'ok' ? 1500 : 3000);

    const expr = `(() => {
      const de = document.documentElement, b = document.body;
      if (!b) return JSON.stringify({ noBody: true, href: location.href, ready: document.readyState, title: document.title });
      const fr = document.getElementById('app');
      const d = (fr && fr.contentDocument && fr.contentDocument.body) ? fr.contentDocument : document;
      const inFrame = d !== document;
      const row = d.querySelector('#landingPage header > div');
      const kids = [];
      if (row) Array.from(row.children).forEach((c, i) => { const r = c.getBoundingClientRect(); kids.push(i + ':' + c.tagName + ' x=' + Math.round(r.x) + ' r=' + Math.round(r.right) + ' w=' + Math.round(r.width) + ' ' + getComputedStyle(c).display); });
      const img = d.querySelector('#landingPage header img');
      const ir = img ? img.getBoundingClientRect() : null;
      const boxEl = img ? img.parentElement : null;
      const boxCs = boxEl ? getComputedStyle(boxEl) : null;
      const res = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /logo/.test(n));
      const rastLines = d.body ? d.body.innerText.split('\\n').map(function(s){ return s.trim(); }).filter(function(s){ return /RAST/i.test(s); }).slice(0, 40) : [];
      const snk = d.getElementById('view-sinkron');
      const sinkronLines = snk ? snk.innerText.split('\\n').map(function(s){ return s.trim(); }).filter(function(s){ return s.length; }).slice(0, 30) : [];
      return JSON.stringify({
        page: inFrame ? 'iframe' : 'top',
        title: d.title,
        topTitle: document.title,
        vw: window.innerWidth,
        bodyScrollW: b.scrollWidth,
        htmlScrollW: de.scrollWidth,
        img: img ? { x: Math.round(ir.x), r: Math.round(ir.right), w: Math.round(ir.width), h: Math.round(ir.height), natural: img.naturalWidth + 'x' + img.naturalHeight, complete: img.complete, src: img.currentSrc.split('/').pop() } : 'NO-IMG',
        box: boxCs ? { bg: boxCs.backgroundColor, pad: boxCs.padding, radius: boxCs.borderRadius, display: boxCs.display } : null,
        adaHurufT: !!document.querySelector('#landingPage header div > div:last-child') && Array.from(document.querySelectorAll('#landingPage header div')).some((d) => d.children.length === 0 && d.textContent.trim() === 'T'),
        kids,
        rastLines,
        sinkronLines,
        logoRes: res
      });
    })()`;
    let ev = null;
    for (let i = 0; i < 15 && !ev; i++) {
      const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true });
      const v = r.result && typeof r.result.value === 'string' ? JSON.parse(r.result.value) : null;
      if (v && !v.noBody) { ev = r; break; }
      await sleep(1000);
    }
    if (!ev) throw new Error('evaluate gagal: body tidak siap / ' + (ev ? '' : 'timeout'));
    const info = JSON.parse(ev.result.value);
    info.consoleErrors = consoleErrors;

    if (EXPR_FILE) {
      const code = fs.readFileSync(EXPR_FILE, 'utf8');
      const r = await c.send('Runtime.evaluate', { expression: code, returnByValue: true, awaitPromise: true });
      info.extra = r.exceptionDetails
        ? 'EXTRA-ERR ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
        : r.result.value;
    }

    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    info.screenshot = OUT + ' (' + fs.statSync(OUT).size + ' bytes)';
    ws.close();
    console.log(JSON.stringify(info, null, 1));
  } finally {
    try { chrome.kill(); } catch (e) {}
    await sleep(500);
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  }
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });

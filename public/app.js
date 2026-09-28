const CATS = ['typography', 'spacing', 'alignment', 'color', 'readability', 'hierarchy', 'composition'];
const $ = (s) => document.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { file: null, src: null, pdf: false, result: null, demo: false, sel: null, err: '', busy: false, stage: 0 };
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], MB = 1048576;

/* ---------- demo ---------- */
const DEMO_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'><rect width='600' height='800' fill='#f4efe6'/><text x='60' y='300' font-size='84' font-weight='800' font-family='Arial' fill='#1f2a44'>SUMMER</text><text x='60' y='390' font-size='84' font-weight='800' font-family='Arial' fill='#1f2a44'>SALE</text><text x='60' y='450' font-size='26' font-family='Arial' fill='#e2d79c'>Up to 50% off everything in store</text><rect x='270' y='620' width='240' height='60' rx='8' fill='#c9b458'/><text x='300' y='658' font-size='22' font-family='Arial' fill='#fff'>Shop now</text><text x='60' y='775' font-size='11' font-family='Arial' fill='#999'>Terms and conditions apply. Offer valid while stocks lasts.</text></svg>";
const iss = (title, severity, description, how, location) => ({ title, severity, description, how_to_improve: how, location });
const DEMO = {
  design_type: 'Poster',
  title_text: 'SUMMER SALE',
  overall: { score: 62, summary: 'A bold headline gives this poster a strong start, but low-contrast supporting text and a misaligned button weaken it.' },
  categories: {
    typography: { score: 70, issues: [] },
    spacing: { score: 65, issues: [] },
    alignment: { score: 55, issues: [iss('Button does not align with the text', 'important', 'The button starts further right than the headline and subtitle.', 'Move the button to the same left edge as the headline (or center everything).', { x: 45, y: 77, width: 40, height: 8 })] },
    color: { score: 55, issues: [] },
    readability: { score: 40, issues: [iss('Subtitle is nearly invisible', 'critical', 'Pale yellow text on a beige background has very low contrast.', 'Use a dark navy for the subtitle, or place it on a dark block.', { x: 9, y: 52, width: 62, height: 7 })] },
    hierarchy: { score: 72, issues: [iss('Button blends into the background', 'important', 'The gold button with white text is weak compared with the headline.', 'Use a dark or strongly contrasting button with clear text.', { x: 45, y: 77, width: 40, height: 8 })] },
    composition: { score: 68, issues: [] }
  },
  recommendations: ['Darken the subtitle so it is readable.', 'Align the button to the left edge shared by the text.', 'Make the button higher-contrast.', 'Enlarge the footer text so it can be read.'],
  typography_errors: [
    { error: 'Footer text too small', detail: 'The terms line is ~11px — too small to read at poster size.', fix: 'Use at least 14–16px for supporting text.' },
    { error: 'Weak size hierarchy', detail: 'Subtitle and button text sizes are too close to each other.', fix: 'Use a clear size scale, e.g. 84 / 32 / 18 px.' }
  ]
};

/* ---------- helpers ---------- */
const issues = (r) => { let a = []; for (const c of CATS) for (const i of r.categories[c]?.issues || []) a.push({ ...i, cat: c }); const o = { critical: 0, important: 1, minor: 2 }; return a.sort((x, y) => o[x.severity] - o[y.severity]).map((x, n) => ({ ...x, n: n + 1 })); };
const readData = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function shrink(src, max, q) { const i = await loadImg(src), k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); }
const go = (h) => { location.hash = h; };
const scoreColor = (s) => s >= 75 ? 'var(--ok)' : s >= 50 ? 'var(--imp)' : 'var(--crit)';
const scoreLabel = (s) => s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Fair' : s >= 30 ? 'Needs Work' : 'Poor';
const sevLabel = { critical: 'Critical', important: 'Important', minor: 'Minor' };

/* ---------- title text variations ---------- */
const titleVars = (t) => {
  const small = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'of', 'in', 'on', 'at', 'to', 'for', 'up', 'via', 'per', 'vs', 'with', 'from', 'into', 'over', 'after', 'before']);
  const sentence = t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
  const title = t.toLowerCase().replace(/\S+/g, (w, i) => {
    const bare = w.replace(/[^a-z']/g, '');
    return (i > 0 && small.has(bare)) ? w : (w ? w[0].toUpperCase() + w.slice(1) : w);
  });
  return { upper: t.toUpperCase(), sentence, title };
};

/* ---------- paste support ---------- */
async function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const ext = item.type.split('/')[1] || 'png';
        pick(new File([file], `pasted-design.${ext}`, { type: item.type }));
        return;
      }
    }
  }
}
document.addEventListener('paste', handlePaste);

async function pick(f) {
  S.err = '';
  if (!f) return;
  if (!TYPES.includes(f.type) && !f.type.startsWith('image/')) S.err = 'Unsupported file. Please choose a PNG, JPG, WEBP or PDF.';
  else if (!f.size) S.err = 'That file is empty.';
  else if (f.size > 10 * MB) S.err = 'That file is larger than 10 MB.';
  else if (f.type === 'application/pdf' && f.size > 4 * MB) S.err = 'PDFs are limited to about 4 MB. Export your design as PNG or JPG instead, or compress the PDF.';
  if (S.err) return render();
  try {
    const d = await readData(f);
    S.pdf = f.type === 'application/pdf'; S.file = { name: f.name, size: f.size }; S.demo = false;
    S.src = S.pdf ? d : await shrink(d, 1800, 0.85);
  } catch { S.err = 'We could not read that file. It may be corrupted.'; S.file = null; S.src = null; }
  render();
}

async function analyze() {
  S.busy = true; S.err = ''; S.stage = 0; render();
  const timer = setInterval(() => { S.stage = Math.min(S.stage + 1, 3); render(); }, 2500);
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ image: S.src }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Something went wrong while analyzing your design. Please try again.');
    S.result = j; S.demo = false; S.sel = null;
    S.busy = false; clearInterval(timer); go('analysis'); render();
  } catch (e) {
    S.err = e.name === 'AbortError' ? 'The analysis took too long. Try a smaller image or try again.' : (e instanceof TypeError ? 'Network problem. Check your connection and try again.' : e.message);
    S.busy = false;
  } finally { clearInterval(timer); clearTimeout(to); render(); }
}

/* ---------- views ---------- */
function home() {
  if (S.busy) {
    const st = ['Reading your design', 'Checking typography & layout', 'Scoring categories', 'Preparing feedback'];
    return `<div class="load card" role="status" aria-live="polite"><div class="spin"></div><h2 style="margin-top:0">Analyzing your design...</h2><ul style="padding:0">${st.map((s, i) => `<li class="${i < S.stage ? 'done' : i === S.stage ? 'on' : ''}">${i < S.stage ? '✓' : i === S.stage ? '●' : '○'} ${s}</li>`).join('')}</ul></div>`;
  }
  const up = S.src ? `<div class="card prev">${S.pdf ? `<p class="mut" style="text-align:center">📄 PDF selected (preview not available)</p>` : `<img src="${S.src}" alt="Preview of your uploaded design">`}<p style="text-align:center;margin:0"><b>${esc(S.file.name)}</b> · <span class="mut">${(S.file.size / MB).toFixed(2)} MB</span></p><div class="row"><button class="pri" data-act="analyze">🔍 Analyze Design</button><label class="btn">Replace<input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf" data-file></label><button class="dng" data-act="remove">Remove</button></div></div>`
    : `<label class="drop" id="drop"><input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" data-file><b style="font-size:18px">Drag &amp; drop your design here</b><p class="mut">PNG • JPG • WEBP • PDF · up to 10 MB</p><span class="btn pri">Choose a file</span></label>`;
  return `<section class="hero"><div class="eyebrow">GLOWUP</div><h1>Design analysis, to the point.</h1><p class="mut">Upload your design and get clear, actionable feedback.</p></section>
  ${up}
  ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
  <div class="row"><button data-act="demo">🎨 Try a sample design</button></div>
  <p class="mut small" style="text-align:center">🔒 Your design is used only for analysis and is not saved.</p>`;
}

function analysis() {
  const r = S.result; if (!r) return `<p class="hero">No analysis yet. <a href="#home">Analyze a design</a>.</p>`;
  const is = issues(r);
  const marks = is.filter((i) => i.location).map((i) => { const l = i.location; return `<div class="box ${i.severity}" style="left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%;${S.sel === i.n ? '' : 'opacity:.35'}"></div><button class="mk ${i.severity}" style="left:${l.x}%;top:${l.y}%" data-act="sel" data-n="${i.n}" aria-label="Issue ${i.n}: ${esc(i.title)}">${i.n}</button>`; }).join('');
  const issueRows = is.map((i) => `<div class="issue ${i.severity} ${S.sel === i.n ? 'sel' : ''}" id="i${i.n}" data-act="sel" data-n="${i.n}"><div class="issue-top"><span class="sev-dot"></span><h3>${i.n}. ${esc(i.title)}</h3><span class="cat">${esc(i.cat)}</span><span class="pill">${sevLabel[i.severity]}</span></div><p class="issue-desc">${esc(i.description)}</p>${i.how_to_improve ? `<div class="fix-strip"><span class="fix-label">✦ Fix</span><span>${esc(i.how_to_improve)}</span></div>` : ''}</div>`).join('');
  const sc = scoreColor(r.overall.score);
  const tv = r.title_text ? titleVars(r.title_text) : null;
  const typoList = (r.typography_errors || []).filter((t) => t.error || t.detail || t.fix);

  return `<div class="dash"><div class="stage"><div class="card" style="text-align:center">${S.demo ? '<p class="mut small" style="margin:0 0 8px">Demo — sample data</p>' : ''}<div class="wrap"><img src="${S.src}" alt="The analyzed design with numbered issue markers">${marks}</div>${S.pdf ? '<p class="mut small">Issue markers are not available for PDFs.</p>' : ''}</div></div>
<div>
<div class="card">
  <div class="summary-header"><div class="big" style="color:${sc}">${r.overall.score}</div><div><div class="mut small">Overall Score</div><div style="font-weight:600;color:${sc}">${scoreLabel(r.overall.score)}${r.design_type ? ` · <span class="badge">${esc(r.design_type)}</span>` : ''}</div></div></div>
  <p style="margin:10px 0 0">${esc(r.overall.summary)}</p>

  <div class="a-sec"><h3>Category Scores</h3><div class="scores">${CATS.map((c) => { const s = r.categories[c].score; return `<div class="sc"><b style="color:${scoreColor(s)}">${s}</b><span class="small mut">${c[0].toUpperCase() + c.slice(1)}</span></div>`; }).join('')}</div></div>

  <div class="a-sec"><h3>✅ Changes Required</h3><ul class="clean">${(r.recommendations || []).map((s) => `<li class="chg">${esc(s)}</li>`).join('') || '<li class="ok">No changes required — nice work!</li>'}</ul></div>

  <div class="a-sec"><h3>🔍 Issues</h3>${issueRows || '<p class="mut" style="margin:0">No issues found. Nice work!</p>'}</div>

  ${typoList.length ? `<div class="a-sec"><h3>✒️ Typography Errors</h3><ul class="clean">${typoList.map((t) => `<li class="typo-item"><b>${esc(t.error)}</b>${t.detail ? ` <span class="mut">— ${esc(t.detail)}</span>` : ''}${t.fix ? `<br><span class="small">Fix: ${esc(t.fix)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}

  ${tv ? `<div class="a-sec"><h3>🔤 Title Variations</h3><div class="var-grid"><div class="var-card"><div class="lbl">UPPER CASE</div><div class="txt">${esc(tv.upper)}</div><button data-act="copy-var" data-var="upper">📋 Copy</button></div><div class="var-card"><div class="lbl">Sentence case</div><div class="txt">${esc(tv.sentence)}</div><button data-act="copy-var" data-var="sentence">📋 Copy</button></div><div class="var-card"><div class="lbl">Title Case (main words)</div><div class="txt">${esc(tv.title)}</div><button data-act="copy-var" data-var="title">📋 Copy</button></div></div></div>` : ''}
</div>
<p class="row" style="justify-content:flex-start;margin-top:16px"><a class="btn pri" href="#home" data-act="new">🔍 Analyze another</a></p>
</div></div>`;
}

/* ---------- router + events ---------- */
function render() {
  const p = (location.hash.slice(1) || 'home').split(':')[0], y = scrollY;
  app.innerHTML = { home, analysis }[p]?.() ?? home();
  scrollTo(0, y);
}
addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
document.addEventListener('change', (e) => { if (e.target.matches('[data-file]')) pick(e.target.files[0]); });
['dragover', 'dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { const d = e.target.closest?.('#drop'); if (!d) return; e.preventDefault(); d.classList.toggle('over', t === 'dragover'); if (t === 'drop') pick(e.dataTransfer.files[0]); }));
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, n = +b.dataset.n;
  if (a === 'analyze') analyze();
  else if (a === 'remove') { S.file = S.src = null; S.err = ''; render(); }
  else if (a === 'new') { S.file = S.src = null; S.result = null; }
  else if (a === 'demo') { S.src = 'data:image/svg+xml,' + encodeURIComponent(DEMO_SVG); S.result = DEMO; S.demo = true; S.pdf = false; S.sel = null; go('analysis'); }
  else if (a === 'sel') { S.sel = n; render(); document.getElementById('i' + n)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }
  else if (a === 'copy-var') {
    const t = titleVars(S.result?.title_text || '')[b.dataset.var] || '';
    if (t) navigator.clipboard.writeText(t).then(() => { b.textContent = '✅ Copied!'; setTimeout(() => { b.textContent = '📋 Copy'; }, 1500); }).catch(() => {});
  }
});
render();

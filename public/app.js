const CATS = ['typography', 'spacing', 'alignment', 'color', 'readability', 'hierarchy', 'composition'];
const $ = (s) => document.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { file: null, src: null, pdf: false, result: null, demo: false, sel: null, err: '', busy: false, stage: 0, mode: null, brief: '', tab: 'design', web: { url: '', file: null, src: null } };
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], MB = 1048576;

/* ---------- demo ---------- */
const DEMO_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'><rect width='600' height='800' fill='#f4efe6'/><text x='60' y='300' font-size='84' font-weight='800' font-family='Arial' fill='#1f2a44'>SUMMER</text><text x='60' y='390' font-size='84' font-weight='800' font-family='Arial' fill='#1f2a44'>SALE</text><text x='60' y='450' font-size='26' font-family='Arial' fill='#e2d79c'>Up to 50% off everything in store</text><rect x='270' y='620' width='240' height='60' rx='8' fill='#c9b458'/><text x='300' y='658' font-size='22' font-family='Arial' fill='#fff'>Shop now</text><text x='60' y='775' font-size='11' font-family='Arial' fill='#999'>Terms and conditions apply. Offer valid while stocks lasts.</text></svg>";
const DEMO = {
  design_type: 'Poster',
  title_text: 'SUMMER SALE',
  overall: { score: 62, summary: 'Bold headline, strong start. Two things hold it back: the subtitle is nearly invisible, and the button breaks the left alignment.' },
  scores: { typography: 70, spacing: 65, alignment: 55, color: 55, readability: 40, hierarchy: 72, composition: 68 },
  works: [
    { area: 'hierarchy', point: 'Headline lands instantly', why: 'Bold navy caps own the first read.' },
    { area: 'color', point: 'Calm, limited palette', why: 'Cream, navy and gold keep it uncluttered.' },
    { area: 'composition', point: 'Room to breathe', why: 'Generous space around the headline.' }
  ],
  changes: [
    { area: 'readability', title: 'Subtitle is nearly invisible', severity: 'critical', action: 'Darken the subtitle to navy, or put it on a dark block.', location: { x: 9, y: 52, width: 62, height: 7 } },
    { area: 'alignment', title: 'Button breaks left alignment', severity: 'important', action: 'Move the button to the headline\u2019s left edge.', location: { x: 45, y: 77, width: 40, height: 8 } },
    { area: 'typography', title: 'Footer text too small', severity: 'minor', action: 'Raise the footer text to 14\u201316px.', location: { x: 9, y: 95, width: 72, height: 3 } }
  ]
};
const DEMO_WEB = {
  site_url: 'demo.glowup.app',
  overall: { score: 71, summary: 'Confident, modern layout with a clear offer. The CTA loses to the top banner, uneven section gaps break the rhythm, and one card line is still placeholder text.' },
  scores: { typography: 78, spacing: 62, alignment: 80, contrast: 74, hierarchy: 66, usability: 70 },
  works: [
    { area: 'typography', point: 'Type scale feels confident', why: 'Headline-to-body steps are clear and readable.' },
    { area: 'alignment', point: 'Everything sits on one grid', why: 'Hero, cards and footer share clean edges.' },
    { area: 'contrast', point: 'Body text reads easily', why: 'Dark text on light panels stays comfortable.' }
  ],
  changes: [
    { area: 'hierarchy', title: 'CTA loses to the banner', severity: 'critical', action: 'Give the primary button its own space above the fold.', location: null },
    { area: 'spacing', title: 'Section gaps are uneven', severity: 'important', action: 'Use one consistent gap between all page sections.', location: null },
    { area: 'content', title: 'Placeholder text in a card', severity: 'minor', action: 'Replace the filler line with a real supporting sentence.', location: null }
  ]
};

/* ---------- helpers ---------- */
const numberChanges = (list) => { const o = { critical: 0, important: 1, minor: 2 }; return (list || []).slice().sort((x, y) => o[x.severity] - o[y.severity]).map((x, n) => ({ ...x, n: n + 1 })); };
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
        const isWeb = S.tab === 'website';
        (isWeb ? pickWeb : pick)(new File([file], `${isWeb ? 'pasted-website' : 'pasted-design'}.${ext}`, { type: item.type }));
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
    S.mode = null; S.brief = '';
    S.src = S.pdf ? d : await shrink(d, 1800, 0.85);
  } catch { S.err = 'We could not read that file. It may be corrupted.'; S.file = null; S.src = null; S.mode = null; S.brief = ''; }
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

async function analyzeAd() {
  if (!S.src) return;
  S.busy = true; S.err = ''; S.stage = 0; render();
  const timer = setInterval(() => { S.stage = Math.min(S.stage + 1, 3); render(); }, 2500);
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ image: S.src, type: 'ad' }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Something went wrong while analyzing your ad. Please try again.');
    S.result = j; S.demo = false; S.sel = null;
    S.busy = false; clearInterval(timer); go('ad'); render();
  } catch (e) {
    S.err = e.name === 'AbortError' ? 'The analysis took too long. Try a smaller image or try again.' : (e instanceof TypeError ? 'Network problem. Check your connection and try again.' : e.message);
    S.busy = false;
  } finally { clearInterval(timer); clearTimeout(to); render(); }
}

async function analyzeLogo() {
  if (!S.src) return;
  if (!S.brief.trim()) { S.err = 'Please tell us what you designed — even one line helps.'; return render(); }
  S.busy = true; S.err = ''; S.stage = 0; render();
  const timer = setInterval(() => { S.stage = Math.min(S.stage + 1, 3); render(); }, 2500);
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ image: S.src, type: 'logo', brief: S.brief }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Something went wrong while reviewing your logo. Please try again.');
    S.result = j; S.demo = false; S.sel = null;
    S.busy = false; clearInterval(timer); go('logo'); render();
  } catch (e) {
    S.err = e.name === 'AbortError' ? 'The review took too long. Try a smaller image or try again.' : (e instanceof TypeError ? 'Network problem. Check your connection and try again.' : e.message);
    S.busy = false;
  } finally { clearInterval(timer); clearTimeout(to); render(); }
}

async function pickWeb(f) {
  S.err = '';
  if (!f) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) S.err = 'Unsupported file. Please choose a PNG, JPG or WEBP screenshot.';
  else if (!f.size) S.err = 'That file is empty.';
  else if (f.size > 10 * MB) S.err = 'That file is larger than 10 MB.';
  if (S.err) return render();
  try {
    const d = await readData(f);
    S.web.file = { name: f.name, size: f.size };
    S.web.src = await shrink(d, 1800, 0.85);
    S.web.auto = false;
    S.demo = false;
  } catch { S.err = 'We could not read that file. It may be corrupted.'; S.web.file = null; S.web.src = null; }
  render();
}

async function analyzeWebsite() {
  const url = (S.web.url || '').trim();
  if (!url && !S.web.src) { S.err = 'Add a website link or a screenshot — or both.'; return render(); }
  if (url) {
    const bare = url.replace(/^https?:\/\//i, '');
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(bare)) { S.err = 'That link does not look valid. Try e.g. yourwebsite.com'; return render(); }
  }
  S.busy = true; S.err = ''; S.stage = 0; render();
  const timer = setInterval(() => { S.stage = Math.min(S.stage + 1, 3); render(); }, 2500);
  const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify({ image: S.web.src || undefined, type: 'website', url }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Something went wrong while analyzing your website. Please try again.');
    const autoShot = j.screenshot; delete j.screenshot;
    S.result = j; S.demo = false; S.sel = null;
    if (autoShot && !S.web.src) {
      S.web.src = autoShot; S.web.auto = true;
      S.web.file = { name: 'Captured from your link', size: 0 };
    }
    S.busy = false; clearInterval(timer); go('website'); render();
  } catch (e) {
    S.err = e.name === 'AbortError' ? 'The analysis took too long. Try again in a moment.' : (e instanceof TypeError ? 'Network problem. Check your connection and try again.' : e.message);
    S.busy = false;
  } finally { clearInterval(timer); clearTimeout(to); render(); }
}

/* ---------- views ---------- */
function home() {
  if (S.busy) {
    const isWeb = S.tab === 'website';
    const isLogo = S.mode === 'logo', isAd = S.mode === 'ad';
    const st = isWeb ? ['Capturing your website', 'Reading content & structure', 'Reviewing UI/UX details', 'Preparing feedback']
      : isLogo ? ['Reading your logo', 'Studying brand context', 'Reviewing typography, icon & color', 'Preparing creative direction']
      : isAd ? ['Reading your ad creative', 'Checking hook & hierarchy', 'Reviewing CTA & readability', 'Scoring visual impact']
      : ['Reading your design', 'Checking typography & layout', 'Scoring categories', 'Preparing feedback'];
    const title = isWeb ? 'Analyzing your website...' : isLogo ? 'Analyzing your logo...' : isAd ? 'Analyzing your ad...' : 'Analyzing your design...';
    return `<div class="load card" role="status" aria-live="polite"><div class="spin"></div><h2 style="margin-top:0">${title}</h2><ul style="padding:0">${st.map((s, i) => `<li class="${i < S.stage ? 'done' : i === S.stage ? 'on' : ''}">${i < S.stage ? '✓' : i === S.stage ? '●' : '○'} ${s}</li>`).join('')}</ul></div>`;
  }
  const isWeb = S.tab === 'website';
  const hero = isWeb
    ? `<section class="hero"><div class="eyebrow">GLOWUP</div><h1>Website review, to the point.</h1><p class="mut">Paste your link and we capture the page — or drop your own screenshot. UI/UX feedback, fast.</p></section>`
    : `<section class="hero"><div class="eyebrow">GLOWUP</div><h1>Design analysis, to the point.</h1><p class="mut">Upload your design and get clear, actionable feedback.</p></section>`;
  const tabs = `<div class="tabs" role="tablist" aria-label="Review type">
    <button class="tab ${!isWeb ? 'active' : ''}" data-act="tab" data-tab="design" role="tab" aria-selected="${!isWeb}">🎨 Design Review</button>
    <button class="tab ${isWeb ? 'active' : ''}" data-act="tab" data-tab="website" role="tab" aria-selected="${isWeb}">🌐 Website Review</button>
  </div>`;
  const err = S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : '';
  const demoRow = `<div class="row"><button data-act="demo">${isWeb ? '🌐 Try a sample website' : '🎨 Try a sample design'}</button></div>`;
  const priv = `<p class="mut small" style="text-align:center">🔒 Your ${isWeb ? 'website data' : 'design'} is used only for analysis and is not saved.</p>`;

  // Website Review — link + screenshot, or both
  if (isWeb) {
    const shot = S.web.src
      ? `<div class="web-shot"><img src="${S.web.src}" alt="Preview of your website screenshot"><p style="text-align:center;margin:8px 0 0"><b>${S.web.auto ? '⚡ ' : ''}${esc(S.web.file?.name || 'Pasted screenshot')}</b>${S.web.auto ? '<br><span class="mut small">We grabbed this from your link automatically</span>' : ''}</p><div class="row"><label class="btn">Replace<input type="file" hidden accept=".png,.jpg,.jpeg,.webp" data-webfile></label><button class="dng" data-act="web-remove">Remove</button></div></div>`
      : `<label class="drop sm" id="webdrop"><input type="file" hidden accept=".png,.jpg,.jpeg,.webp" data-webfile><b style="font-size:16px">Drag &amp; drop a screenshot</b><p class="mut small">PNG · JPG · WEBP · up to 10 MB</p><span class="btn pri">Choose a file</span></label>`;
    return `${hero}${tabs}
    <div class="web-grid">
      <div class="card web-card">
        <h3>🔗 Paste your link</h3>
        <p class="mut small">We capture the live site and read its content — full UI/UX review.</p>
        <input class="url-input" id="webUrl" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://yourwebsite.com" value="${esc(S.web.url)}">
        <p class="mut small" style="margin:10px 0 0">Example: <b>yourwebsite.com</b> or any page URL</p>
      </div>
      <div class="card web-card">
        <h3>🖼️ Add a screenshot</h3>
        <p class="mut small">Optional — skip it and we capture the page from your link automatically.</p>
        ${shot}
      </div>
    </div>
    <div class="row" style="margin-top:18px"><button class="pri big" data-act="analyze-website">🔍 Analyze Website</button></div>
    <p class="hint">💡 Just paste your link — we grab the screenshot ourselves. Drop your own to review a specific view (mobile, a section, a state).</p>
    ${err}${demoRow}${priv}`;
  }

  // ---- Design Review: existing flow, unchanged below the tabs ----
  const thumb = S.pdf ? `<p class="mut" style="text-align:center">📄 PDF selected (preview not available)</p>` : `<img src="${S.src}" alt="Preview of your uploaded design">`;
  const nameLine = S.file ? `<p style="text-align:center;margin:0"><b>${esc(S.file.name)}</b> · <span class="mut">${(S.file.size / MB).toFixed(2)} MB</span></p>` : '';

  if (!S.src) {
    return `${hero}${tabs}<label class="drop" id="drop"><input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" data-file><b style="font-size:18px">Drag &amp; drop your design here</b><p class="mut">PNG • JPG • WEBP • PDF · up to 10 MB</p><span class="btn pri">Choose a file</span></label>${err}${demoRow}${priv}`;
  }

  // Step: choose what kind of upload this is
  if (!S.mode) {
    return `${hero}${tabs}
    <div class="card prev">${thumb}${nameLine}</div>
    <div class="card pick-card"><h3 style="margin:0">What are you uploading?</h3><div class="pick-row">
      <button class="pick-btn" data-act="mode" data-mode="post"><span class="pick-ico">🎨</span><b>Creative Post</b><span class="mut small">Posts, posters, UI, flyers &amp; more</span></button>
      <button class="pick-btn" data-act="mode" data-mode="ad"><span class="pick-ico">📢</span><b>Ad Creative</b><span class="mut small">Ads — hook, CTA &amp; impact</span></button>
      <button class="pick-btn" data-act="mode" data-mode="logo"><span class="pick-ico">✦</span><b>Logo</b><span class="mut small">Logo &amp; brand mark review</span></button>
    </div></div>
    ${err}${demoRow}${priv}`;
  }

  // Creative Post — existing workflow, unchanged
  if (S.mode === 'post') {
    const up = `<div class="card prev">${S.pdf ? `<p class="mut" style="text-align:center">📄 PDF selected (preview not available)</p>` : `<img src="${S.src}" alt="Preview of your uploaded design">`}<p style="text-align:center;margin:0"><b>${esc(S.file.name)}</b> · <span class="mut">${(S.file.size / MB).toFixed(2)} MB</span></p><div class="row"><button class="pri" data-act="analyze">🔍 Analyze Design</button><label class="btn">Replace<input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf" data-file></label><button class="dng" data-act="remove">Remove</button></div></div>`;
    return `${hero}${tabs}
    ${up}
    ${err}${demoRow}${priv}`;
  }

  // Ad Creative — same flow as Creative Post
  if (S.mode === 'ad') {
    const upAd = `<div class="card prev">${S.pdf ? `<p class="mut" style="text-align:center">📄 PDF selected (preview not available)</p>` : `<img src="${S.src}" alt="Preview of your uploaded ad creative">`}<p style="text-align:center;margin:0"><b>${esc(S.file.name)}</b> · <span class="mut">${(S.file.size / MB).toFixed(2)} MB</span></p><div class="row"><button class="pri" data-act="analyze-ad">🔍 Analyze Ad</button><label class="btn">Replace<input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf" data-file></label><button class="dng" data-act="remove">Remove</button></div></div>`;
    return `${hero}${tabs}
    ${upAd}
    ${err}${priv}`;
  }

  // Logo — brief step
  return `${hero}${tabs}
  <div class="card prev">${thumb}${nameLine}</div>
  <div class="card pick-card" style="text-align:left">
    <h3 style="margin:0 0 4px">Tell us what you designed</h3>
    <p class="mut small" style="margin:0 0 10px">Example: <i>“Here is the logo of a courier company called Faster.”</i></p>
    <textarea class="brief" data-brief maxlength="2000" rows="5" placeholder="Here is the logo of a courier company called Faster.">${esc(S.brief)}</textarea>
    <p class="mut small" style="margin:10px 0 0">You can include: business name · industry or niche · what the business does · target audience · brand personality · any client requirements or preferences</p>
    <div class="row" style="justify-content:flex-start;margin-top:14px"><button class="pri" data-act="analyze-logo">🔍 Analyze Logo</button><label class="btn">Replace<input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf" data-file></label><button data-act="mode" data-mode="">Change type</button><button class="dng" data-act="remove">Remove</button></div>
  </div>
  ${err}${priv}`;
}

function analysis() {
  const r = S.result; if (!r) return `<p class="hero">No analysis yet. <a href="#home">Analyze a design</a>.</p>`;
  const ch = numberChanges(r.changes);
  const marks = ch.filter((i) => i.location).map((i) => { const l = i.location; return `<div class="box ${i.severity}" style="left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%;${S.sel === i.n ? '' : 'opacity:.35'}"></div><button class="mk ${i.severity}" style="left:${l.x}%;top:${l.y}%" data-act="sel" data-n="${i.n}" aria-label="Change ${i.n}: ${esc(i.title)}">${i.n}</button>`; }).join('');
  const changeRows = ch.map((i) => `<div class="issue ${i.severity} ${S.sel === i.n ? 'sel' : ''}" id="i${i.n}" data-act="sel" data-n="${i.n}"><div class="issue-top"><span class="sev-dot"></span><h3>${i.n}. ${esc(i.title)}</h3><span class="cat">${esc(i.area)}</span><span class="pill">${sevLabel[i.severity]}</span></div>${i.action ? `<div class="fix-strip"><span class="fix-label">✦ Fix</span><span>${esc(i.action)}</span></div>` : ''}</div>`).join('');
  const workRows = (r.works || []).map((w) => `<li class="ok"><span class="cat">${esc(w.area)}</span> <b>${esc(w.point)}</b>${w.why ? ` <span class="why" style="display:inline">— ${esc(w.why)}</span>` : ''}</li>`).join('') || '<li class="ok">Solid all round.</li>';
  const sc = scoreColor(r.overall.score);
  const tv = r.title_text ? titleVars(r.title_text) : null;

  return `<div class="dash"><div class="stage"><div class="card" style="text-align:center">${S.demo ? '<p class="mut small" style="margin:0 0 8px">Demo — sample data</p>' : ''}<div class="wrap"><img src="${S.src}" alt="The analyzed design with numbered change markers">${marks}</div>${S.pdf ? '<p class="mut small">Issue markers are not available for PDFs.</p>' : ''}</div></div>
<div>
<div class="card">
  <div class="summary-header"><div class="big" style="color:${sc}">${r.overall.score}</div><div><div class="mut small">Overall Score</div><div style="font-weight:600;color:${sc}">${scoreLabel(r.overall.score)}${r.design_type ? ` · <span class="badge">${esc(r.design_type)}</span>` : ''}</div></div></div>
  <p style="margin:10px 0 0">${esc(r.overall.summary)}</p>

  <div class="a-sec"><h3>📊 Category Scores</h3><div class="scores">${CATS.map((c) => { const s = r.scores?.[c] ?? 0; return `<div class="sc"><b style="color:${scoreColor(s)}">${s}</b><span class="small mut">${c[0].toUpperCase() + c.slice(1)}</span></div>`; }).join('')}</div></div>

  <div class="a-sec"><h3>✅ Works</h3><ul class="clean">${workRows}</ul></div>

  <div class="a-sec"><h3>🔧 Changes Required</h3>${changeRows || '<p class="ok" style="margin:0">Nothing to change — nice work!</p>'}</div>

  ${tv ? `<div class="a-sec"><h3>🔤 Title Variations</h3><div class="var-grid"><div class="var-card"><div class="lbl">UPPER CASE</div><div class="txt">${esc(tv.upper)}</div><button data-act="copy-var" data-var="upper">📋 Copy</button></div><div class="var-card"><div class="lbl">Sentence case</div><div class="txt">${esc(tv.sentence)}</div><button data-act="copy-var" data-var="sentence">📋 Copy</button></div><div class="var-card"><div class="lbl">Title Case (main words)</div><div class="txt">${esc(tv.title)}</div><button data-act="copy-var" data-var="title">📋 Copy</button></div></div></div>` : ''}
</div>
<p class="row" style="justify-content:flex-start;margin-top:16px"><a class="btn pri" href="#home" data-act="new">🔍 Analyze another</a></p>
</div></div>`;
}

/* ---------- logo review view ---------- */
function logoText(r) {
  let t = 'GLOWUP — LOGO REVIEW\n' + '='.repeat(40) + '\n\n';
  t += 'QUICK TAKE\n' + r.quick_take + '\n\n';
  if (r.parts?.length) { t += "WHAT'S IN THE IMAGE\n"; r.parts.forEach((p) => { t += `  - ${p.name}: ${p.take}\n`; }); t += '\n'; }
  if (r.works?.length) { t += 'WORKS\n'; r.works.forEach((x) => { t += `  - ${x.point} — ${x.why}\n`; }); t += '\n'; }
  if (r.fixes?.length) { t += 'FIX THESE\n'; r.fixes.forEach((x) => { t += `  [${x.priority.toUpperCase()}] ${x.point} — ${x.why}\n`; }); t += '\n'; }
  if (r.requirements?.length) { t += 'REQUIREMENTS\n'; r.requirements.forEach((q) => { const m = q.status === 'met' ? 'YES' : q.status === 'not_met' ? 'NO' : 'PARTIAL'; t += `  [${m}] ${q.requirement} — ${q.note}\n`; }); t += '\n'; }
  t += 'NEXT STEP\n' + r.next_step + '\n';
  return t;
}

function logoView() {
  const r = S.result;
  if (!r || r.quick_take === undefined) return `<p class="hero">No logo review yet. <a href="#home">Analyze a logo</a>.</p>`;
  const reqRow = (q) => {
    const cls = q.status === 'met' ? 'yes' : q.status === 'not_met' ? 'no' : 'partial';
    const lbl = q.status === 'met' ? '✓ Met' : q.status === 'not_met' ? '✕ Not met' : '⚠ Partial';
    return `<li style="margin:8px 0"><span class="chip ${cls}">${lbl}</span> <b>${esc(q.requirement)}</b>${q.note ? ` <span class="why" style="display:inline">— ${esc(q.note)}</span>` : ''}</li>`;
  };

  return `<div class="dash"><div class="stage"><div class="card" style="text-align:center">${S.demo ? '<p class="mut small" style="margin:0 0 8px">Demo — sample data</p>' : ''}<div class="wrap"><img src="${S.src}" alt="The uploaded logo"></div></div></div>
<div>
<div class="card">
  <div class="summary-header"><div class="big" style="background:linear-gradient(120deg,var(--acc),var(--acc2));-webkit-background-clip:text;background-clip:text;color:transparent">✦</div><div><h2 style="margin:0">Logo Review</h2><div class="mut small">Quick honest take</div></div></div>

  <div class="a-sec"><h3>🪪 Quick Take</h3><p style="margin:0;font-size:15.5px;line-height:1.55">${esc(r.quick_take) || '—'}</p></div>

  ${(r.parts || []).length ? `<div class="a-sec"><h3>🧩 What's in the Image</h3><ul class="clean">${r.parts.map((p) => `<li class="part-row"><b>${esc(p.name)}</b>${p.take ? ` <span class="why" style="display:inline">— ${esc(p.take)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}

  ${(r.works || []).length ? `<div class="a-sec"><h3>✅ Works</h3><ul class="clean">${r.works.map((x) => `<li><b>${esc(x.point)}</b>${x.why ? ` <span class="why" style="display:inline">— ${esc(x.why)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}

  ${(r.fixes || []).length ? `<div class="a-sec"><h3>🔧 Fix These</h3><ul class="clean">${r.fixes.map((x) => `<li class="warn"><b>${esc(x.point)}<span class="prio ${x.priority}">${x.priority === 'now' ? 'now' : 'later'}</span></b>${x.why ? ` <span class="why" style="display:inline">— ${esc(x.why)}</span>` : ''}</li>`).join('')}</ul></div>` : `<div class="a-sec"><h3>🔧 Fix These</h3><p class="ok" style="margin:0">Nothing pressing — the logo is in good shape.</p></div>`}

  ${(r.requirements || []).length ? `<div class="a-sec"><h3>🎯 Client Requirements</h3><ul class="clean" style="list-style:none">${r.requirements.map(reqRow).join('')}</ul></div>` : ''}

  ${r.next_step ? `<div class="kv next"><b>Suggested next design step</b><p style="margin:4px 0 0">${esc(r.next_step)}</p></div>` : ''}
</div>
<p class="row" style="justify-content:flex-start;margin-top:16px"><a class="btn pri" href="#home" data-act="new">🔍 Analyze another</a><button data-act="copy-review">📋 Copy Review</button></p>
</div></div>`;
}

/* ---------- ad review view ---------- */
function adView() {
  const r = S.result;
  if (!r || !r.scores) return `<p class="hero">No ad review yet. <a href="#home">Analyze an ad</a>.</p>`;
  const ch = numberChanges(r.changes);
  const marks = ch.filter((i) => i.location).map((i) => { const l = i.location; return `<div class="box ${i.severity}" style="left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%;${S.sel === i.n ? '' : 'opacity:.35'}"></div><button class="mk ${i.severity}" style="left:${l.x}%;top:${l.y}%" data-act="sel" data-n="${i.n}" aria-label="Change ${i.n}: ${esc(i.title)}">${i.n}</button>`; }).join('');
  const changeRows = ch.map((i) => `<div class="issue ${i.severity} ${S.sel === i.n ? 'sel' : ''}" id="i${i.n}" data-act="sel" data-n="${i.n}"><div class="issue-top"><span class="sev-dot"></span><h3>${i.n}. ${esc(i.title)}</h3><span class="cat">${esc(i.area)}</span><span class="pill">${sevLabel[i.severity]}</span></div>${i.action ? `<div class="fix-strip"><span class="fix-label">✦ Fix</span><span>${esc(i.action)}</span></div>` : ''}</div>`).join('');
  const workRows = (r.works || []).map((w) => `<li class="ok"><span class="cat">${esc(w.area)}</span> <b>${esc(w.point)}</b>${w.why ? ` <span class="why" style="display:inline">— ${esc(w.why)}</span>` : ''}</li>`).join('') || '<li class="ok">Solid all round.</li>';
  const sc = scoreColor(r.overall.score);
  const dims = [['hook', '🪝 Hook'], ['hierarchy', '📐 Hierarchy'], ['cta', '🎯 CTA'], ['readability', '👁️ Readability'], ['impact', '⚡ Visual Impact']];

  return `<div class="dash"><div class="stage"><div class="card" style="text-align:center">${S.demo ? '<p class="mut small" style="margin:0 0 8px">Demo — sample data</p>' : ''}<div class="wrap"><img src="${S.src}" alt="The analyzed ad creative with numbered change markers">${marks}</div>${S.pdf ? '<p class="mut small">Issue markers are not available for PDFs.</p>' : ''}</div></div>
<div>
<div class="card">
  <div class="summary-header"><div class="big" style="color:${sc}">${r.overall.score}</div><div><div class="mut small">Ad Score</div><div style="font-weight:600;color:${sc}">${scoreLabel(r.overall.score)}${r.ad_format ? ` · <span class="badge">${esc(r.ad_format)}</span>` : ''}</div></div></div>
  <p style="margin:10px 0 0">${esc(r.overall.summary)}</p>

  <div class="a-sec"><h3>📊 Ad Scores</h3><div class="scores">${dims.map(([k, label]) => { const s = r.scores?.[k] ?? 0; return `<div class="sc"><b style="color:${scoreColor(s)}">${s}</b><span class="small mut">${label}</span></div>`; }).join('')}</div></div>

  <div class="a-sec"><h3>✅ Works</h3><ul class="clean">${workRows}</ul></div>

  <div class="a-sec"><h3>🔧 Changes Required</h3>${changeRows || '<p class="ok" style="margin:0">Nothing to change — nice work!</p>'}</div>
</div>
<p class="row" style="justify-content:flex-start;margin-top:16px"><a class="btn pri" href="#home" data-act="new">🔍 Analyze another</a></p>
</div></div>`;
}

/* ---------- website review view ---------- */
function websiteView() {
  const r = S.result; if (!r) return `<p class="hero">No analysis yet. <a href="#home">Analyze a website</a>.</p>`;
  const dims = [['typography', 'Typography'], ['spacing', 'Spacing'], ['alignment', 'Alignment'], ['contrast', 'Contrast'], ['hierarchy', 'Hierarchy'], ['usability', 'Usability']];
  const ch = numberChanges(r.changes);
  const marks = S.web.src ? ch.filter((i) => i.location).map((i) => { const l = i.location; return `<div class="box ${i.severity}" style="left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%;${S.sel === i.n ? '' : 'opacity:.35'}"></div><button class="mk ${i.severity}" style="left:${l.x}%;top:${l.y}%" data-act="sel" data-n="${i.n}" aria-label="Change ${i.n}: ${esc(i.title)}">${i.n}</button>`; }).join('') : '';
  const changeRows = ch.map((i) => `<div class="issue ${i.severity} ${S.sel === i.n ? 'sel' : ''}" id="i${i.n}" data-act="sel" data-n="${i.n}"><div class="issue-top"><span class="sev-dot"></span><h3>${i.n}. ${esc(i.title)}</h3><span class="cat">${esc(i.area)}</span><span class="pill">${sevLabel[i.severity]}</span></div>${i.action ? `<div class="fix-strip"><span class="fix-label">✦ Fix</span><span>${esc(i.action)}</span></div>` : ''}</div>`).join('');
  const workRows = (r.works || []).map((w) => `<li class="ok"><span class="cat">${esc(w.area)}</span> <b>${esc(w.point)}</b>${w.why ? ` <span class="why" style="display:inline">— ${esc(w.why)}</span>` : ''}</li>`).join('') || '<li class="ok">Solid all round.</li>';
  const sc = scoreColor(r.overall.score);
  const stage = S.web.src
    ? `<div class="card" style="text-align:center">${S.demo ? '<p class="mut small" style="margin:0 0 8px">Demo — sample data</p>' : ''}<div class="wrap"><img src="${S.web.src}" alt="The analyzed website screenshot with numbered change markers">${marks}</div></div>`
    : `<div class="card site-card">${S.demo ? '<p class="mut small" style="margin:0 0 8px">Demo — sample data</p>' : ''}<div class="site-ico">🌐</div><div class="site-url">${esc(r.site_url || S.web.url || 'Website')}</div><p class="mut small" style="margin:6px 0 0">Live site reviewed — content &amp; structure</p></div>`;

  return `<div class="dash"><div class="stage">${stage}</div>
<div>
<div class="card">
  <div class="summary-header"><div class="big" style="color:${sc}">${r.overall.score}</div><div><div class="mut small">Overall Score</div><div style="font-weight:600;color:${sc}">${scoreLabel(r.overall.score)} · <span class="badge">${esc(r.site_url || 'Website')}</span></div></div></div>
  <p style="margin:10px 0 0">${esc(r.overall.summary)}</p>

  <div class="a-sec"><h3>📊 UI/UX Scores</h3><div class="scores">${dims.map(([k, label]) => { const s = r.scores?.[k] ?? 0; return `<div class="sc"><b style="color:${scoreColor(s)}">${s}</b><span class="small mut">${label}</span></div>`; }).join('')}</div></div>

  <div class="a-sec"><h3>✅ Works</h3><ul class="clean">${workRows}</ul></div>

  <div class="a-sec"><h3>🔧 Changes Required</h3>${changeRows || '<p class="ok" style="margin:0">Nothing to change — nice work!</p>'}</div>
</div>
<p class="row" style="justify-content:flex-start;margin-top:16px"><a class="btn pri" href="#home" data-act="new">🔍 Analyze another</a></p>
</div></div>`;
}

/* ---------- router + events ---------- */
function render() {
  const p = (location.hash.slice(1) || 'home').split(':')[0], y = scrollY;
  app.innerHTML = { home, analysis, logo: logoView, ad: adView, website: websiteView }[p]?.() ?? home();
  scrollTo(0, y);
}
addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-file]')) pick(e.target.files[0]);
  else if (e.target.matches('[data-webfile]')) pickWeb(e.target.files[0]);
});
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-brief]')) S.brief = e.target.value;
  else if (e.target.id === 'webUrl') S.web.url = e.target.value;
});
['dragover', 'dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => {
  const d = e.target.closest?.('#drop, #webdrop'); if (!d) return;
  e.preventDefault(); d.classList.toggle('over', t === 'dragover');
  if (t === 'drop') (d.id === 'webdrop' ? pickWeb : pick)(e.dataTransfer.files[0]);
}));
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, n = +b.dataset.n;
  if (a === 'analyze') analyze();
  else if (a === 'analyze-logo') analyzeLogo();
  else if (a === 'analyze-ad') analyzeAd();
  else if (a === 'copy-review') { if (S.result) navigator.clipboard.writeText(logoText(S.result)).then(() => { b.textContent = '✅ Copied!'; setTimeout(() => { b.textContent = '📋 Copy Review'; }, 1500); }).catch(() => {}); }
  else if (a === 'mode') { S.mode = b.dataset.mode || null; S.err = ''; render(); }
  else if (a === 'tab') { S.tab = b.dataset.tab === 'website' ? 'website' : 'design'; S.err = ''; render(); }
  else if (a === 'analyze-website') analyzeWebsite();
  else if (a === 'web-remove') { S.web.file = null; S.web.src = null; S.web.auto = false; S.err = ''; render(); }
  else if (a === 'remove') { S.file = S.src = null; S.err = ''; S.mode = null; S.brief = ''; render(); }
  else if (a === 'new') { S.file = S.src = null; S.result = null; S.mode = null; S.brief = ''; S.web = { url: '', file: null, src: null }; }
  else if (a === 'demo') {
    if (S.tab === 'website') {
      S.result = DEMO_WEB; S.demo = true; S.sel = null;
      S.web = { url: 'demo.glowup.app', file: null, src: null };
      go('website');
    } else {
      S.src = 'data:image/svg+xml,' + encodeURIComponent(DEMO_SVG); S.result = DEMO; S.demo = true; S.pdf = false; S.sel = null; go('analysis');
    }
  }
  else if (a === 'sel') { S.sel = n; render(); document.getElementById('i' + n)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }
  else if (a === 'copy-var') {
    const t = titleVars(S.result?.title_text || '')[b.dataset.var] || '';
    if (t) navigator.clipboard.writeText(t).then(() => { b.textContent = '✅ Copied!'; setTimeout(() => { b.textContent = '📋 Copy'; }, 1500); }).catch(() => {});
  }
});
render();

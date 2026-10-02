// AI provider layer — Gemini API (shared by Vercel serverless functions)
const KB = require('../knowledge.js');
const CATS = ['typography', 'spacing', 'alignment', 'color', 'readability', 'hierarchy', 'composition'];
const AREAS = [...CATS, 'general'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
const str = (v) => (typeof v === 'string' ? v : '');

const POST_TEXT = 'Analyze this design fairly and objectively following the instructions. Remember: only real, visible problems count as issues. JSON only.';

const NO_REPEAT = `CRITICAL — NO REPETITION:
- Every point appears in EXACTLY ONE place.
- What the work does WELL appears ONLY in "works".
- Everything that should CHANGE appears ONLY in "changes".
- "summary" is your overall verdict only — never restate items from works/changes there.
- Different fields must always contain different points. Never say the same thing twice.

TONE:
- You think and speak like an experienced creative director: confident, human, specific. NOT like an AI or a computer.
- No fluff, no filler, no generic advice. Short sentences with real reasoning behind them.`;

const STATIC_RULE = `STATIC MEDIUM RULE (critical):
- You are reviewing a STATIC artwork — one fixed image. Most ads and designs are static; assume STATIC always.
- NEVER suggest interactivity: no "clickable", "interactive", "tappable", "hover", "link", "animation", "video", "carousel". These do not exist in this medium. The ad platform may add click behavior later — that is not your concern.
- A "button" or "CTA" here is a VISUAL element in the artwork (a button-shaped block, a promo code badge, directive text). Judge it as an image: its size, contrast, placement, and wording — NEVER its clickability.
- Every suggested change must be doable inside the static artwork: recolor, resize, reposition, retype, or add/remove visual elements.`;

const SYSTEM = `You are GlowUp — a creative director reviewing design work.

${NO_REPEAT}

${STATIC_RULE}

ANALYSIS STEPS:
1. Identify the design type. Choose exactly ONE: "Poster", "Social Media Post", "UI/Web Design", "Logo", "Business Card", "Flyer", "Presentation Slide", "Infographic", "Packaging", "Banner", "Icon", "Other".
2. Critique for that type. Check readability: contrast, font size, visual hierarchy.
3. Judge fairly. Good designs are common — score high and find little wrong when it deserves it. Never invent problems. Taste is not an issue. Never give 0 unless an element is completely absent.

Reply with ONLY one JSON object, no markdown, in this EXACT shape:
{
  "design_type": "Poster",
  "title_text": "the exact main headline text as written in the design, or empty string if none",
  "overall": {"score": 0-100, "summary": "2-3 sentences: your verdict — what this design achieves, and the one most important thing to know"},
  "scores": {"typography": 0-100, "spacing": 0-100, "alignment": 0-100, "color": 0-100, "readability": 0-100, "hierarchy": 0-100, "composition": 0-100},
  "works": [{"area": "typography|spacing|alignment|color|readability|hierarchy|composition|general", "point": "max 10 words", "why": "max 15 words"}],
  "changes": [{"area": "typography|spacing|alignment|color|readability|hierarchy|composition|general", "title": "max 6 words", "severity": "critical|important|minor", "action": "max 15 words — the exact change to make", "location": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100} OR null}]
}

RULES:
- works: 2-5 items — the genuine strengths, each with a short reason.
- changes: 1-6 items — ONLY real, visible problems. severity: "critical" = broken, "important" = noticeably hurts, "minor" = polish.
- location: PERCENTAGES (x,y = top-left corner). Only if HIGHLY CONFIDENT (imagine a 10x10 grid), else null.
- Use the FULL score range — good work deserves 75+. Do not cluster around 55-70.
- title_text: copy the headline EXACTLY as written (keep its casing). Empty string if the design has no text.

Design type-specific criteria:
- POSTERS: Impact, readability at distance, hierarchy, bold typography
- SOCIAL MEDIA: Quick readability, brand consistency, mobile-first, CTA visibility
- UI/WEB: Usability, consistency, accessibility, responsive considerations
- LOGO: Simplicity, scalability, memorability, versatility
- BUSINESS CARD: Information hierarchy, readability at small size, professional feel
- FLYER: Clear CTA, information flow, scannability
- PRESENTATION: Slide readability, minimal text, visual impact
- INFOGRAPHIC: Data clarity, visual flow, accuracy, readability

Design principles to apply:
${KB.lessons.map((l) => `- ${l.title}: ${l.what} Common mistake: ${l.mistake} Good practice: ${l.good}`).join('\n')}`;

async function callModel({ mime, data, system = SYSTEM, text = POST_TEXT, maxTokens = 12000, temperature = 0.4 }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [];
    if (mime && data) parts.push({ inline_data: { mime_type: mime, data: data } });
    parts.push({ text });

    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          responseMimeType: 'application/json',
        }
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errBody}`);
    }

    const j = await res.json();
    return (j.candidates || [])
      .flatMap(c => (c.content?.parts || []))
      .map(p => p.text || '')
      .join('');
  } finally { clearTimeout(t); }
}

function jsonOf(raw) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('no json');
  return JSON.parse(raw.slice(s, e + 1));
}

function locationOf(L) {
  const ok = L && [L.x, L.y, L.width, L.height].every((n) => Number.isFinite(+n)) && +L.width > 0 && +L.height > 0;
  return ok ? { x: clamp(L.x, 0, 100), y: clamp(L.y, 0, 100), width: clamp(L.width, 1, 100), height: clamp(L.height, 1, 100) } : null;
}

function normalize(raw) {
  const j = jsonOf(raw);
  const list = (a) => (Array.isArray(a) ? a.map(str).filter(Boolean) : []);
  const out = {
    design_type: str(j.design_type) || 'Unknown',
    title_text: str(j.title_text),
    overall: { score: clamp(j.overall?.score, 0, 100), summary: str(j.overall?.summary) },
    scores: {},
    works: (Array.isArray(j.works) ? j.works : [])
      .map((w) => ({ area: AREAS.includes(w?.area) ? w.area : 'general', point: staticSafe(str(w?.point)), why: staticSafe(str(w?.why)) }))
      .filter((w) => w.point),
    changes: (Array.isArray(j.changes) ? j.changes : [])
      .map((c) => ({
        area: AREAS.includes(c?.area) ? c.area : 'general',
        title: staticSafe(str(c?.title) || 'Change'),
        severity: ['critical', 'important', 'minor'].includes(c?.severity) ? c.severity : 'minor',
        action: staticSafe(str(c?.action)),
        location: locationOf(c?.location)
      }))
      .filter((c) => c.title !== 'Change' || c.action)
      .slice(0, 6)
  };
  for (const c of CATS) out.scores[c] = clamp(j.scores?.[c], 0, 100);
  return out;
}

exports.analyzeDesign = async (file) => normalize(await callModel(file));

/* =====================  LOGO REVIEW (brand identity)  ===================== */

const LOGO_SYSTEM = `You are GlowUp — a senior brand-identity designer and creative director reviewing a logo for a fellow designer. Quick, honest, human.

${NO_REPEAT}

INFORMATION FROM THE DESIGNER (business, audience, industry, personality, client requirements):
"""
{{BRIEF}}
"""
If the information is empty, review as a standalone logo and add one short line about what context would sharpen the judgment.

HOW TO LOOK AT THE IMAGE (important):
- Study EVERYTHING visible. Logo boards often show several items: the main logo lockup, the icon alone, the wordmark alone, color or layout variations, mockups. List EVERY visible item in "parts" with a one-line take. If it is a single logo, list its parts (icon, wordmark) instead. Part takes are per-item observations — do NOT repeat them in works or fixes.

FAIRNESS:
- Do NOT invent problems. Taste is not a flaw. If something works, say so and say keep it. Good logos are common — fixes must be honest (0-5). Zero fixes is valid.

HARD LENGTH RULES — quick review, not a report:
- quick_take: 2-3 sentences. every point: max 10 words. every why: max 15 words.
- parts: one line each. works: 2-4 (fewer if honest). fixes: 0-5.
- next_step: one short sentence. No filler. No text outside the JSON.

Reply with ONLY one JSON object in this EXACT shape:
{
  "quick_take": "2-3 sentences: your overall call as a creative director — what it says, for whom, and whether it works",
  "parts": [{"name": "Main logo | Icon | Wordmark | Variation: mono | Mockup | ...", "take": "one line about this item"}],
  "works": [{"point": "max 10 words", "why": "max 15 words"}],
  "fixes": [{"point": "max 10 words", "why": "max 15 words", "priority": "now|later"}],
  "requirements": [{"requirement": "one requirement the designer stated", "status": "met|partial|not_met", "note": "max 12 words"}],
  "next_step": "one short sentence — the single next design step"
}

FIELD RULES:
- requirements: ONLY requirements explicitly stated by the designer. If none, return [].
- priority "now" = fix before shipping; "later" = refine when possible.
- fixes must improve the EXISTING logo, not redesign it.
- Fold design reasoning (business -> audience -> personality) into the short why's.`;

function buildLogoSystem(brief) {
  const b = (brief || '').trim();
  return LOGO_SYSTEM.replace('{{BRIEF}}', b || '(no additional context provided)');
}

function normalizeLogo(raw) {
  const j = jsonOf(raw);
  const pairs = (a) => (Array.isArray(a) ? a.map((x) => ({ point: str(x?.point), why: str(x?.why) })).filter((x) => x.point) : []);
  return {
    quick_take: str(j.quick_take),
    parts: (Array.isArray(j.parts) ? j.parts : [])
      .map((p) => ({ name: str(p?.name), take: str(p?.take) }))
      .filter((p) => p.name || p.take),
    works: pairs(j.works),
    fixes: (Array.isArray(j.fixes) ? j.fixes : [])
      .map((x) => ({ point: str(x?.point), why: str(x?.why), priority: x?.priority === 'now' ? 'now' : 'later' }))
      .filter((x) => x.point),
    requirements: (Array.isArray(j.requirements) ? j.requirements : [])
      .map((q) => ({ requirement: str(q?.requirement), status: ['met', 'partial', 'not_met'].includes(q?.status) ? q.status : 'partial', note: str(q?.note) }))
      .filter((q) => q.requirement),
    next_step: str(j.next_step)
  };
}

exports.analyzeLogo = async ({ file, brief }) => normalizeLogo(await callModel({
  ...file,
  system: buildLogoSystem(brief),
  text: 'Give your quick honest logo review now. Look at every item in the image. JSON only.',
  maxTokens: 6000,
  temperature: 0.5
}));

/* =====================  AD CREATIVE REVIEW  ===================== */

const AD_AREAS = ['hook', 'hierarchy', 'cta', 'readability', 'impact', 'general'];

// Safety net: strip any residual interactivity advice — impossible in a static artwork
const staticSafe = (s) => String(s || '')
  .replace(/\b(clickable|interactive|tappable)\s+(button|cta|element|banner|block|badge)\b/gi, '$2-style visual element')
  .replace(/\bmake (it |them )?(more )?clickable\b/gi, 'make it read clearly as a button')
  .replace(/\b(add|include|use)\s+a\s+(clickable\s+|interactive\s+)?link\b/gi, '$1 a clear visual directive');

const AD_SYSTEM = `You are GlowUp — a senior performance-creative director reviewing an AD CREATIVE. Quick, honest, human read.

${NO_REPEAT}

${STATIC_RULE}

WHAT TO JUDGE (in this order):
1. HOOK — does it stop the scroll in 1-2 seconds? Is the first thing you see instantly clear and attention-earning?
2. HIERARCHY — what do you see first, second, third? Does the eye travel naturally toward the CTA?
3. CTA — is there a clear call to action as a VISUAL element (button graphic, promo code badge, directive copy)? Is it prominent, high-contrast, well placed, with action words? Judge only the artwork — NEVER comment on clickability (this is a static image).
4. READABILITY — at feed size, can every piece of copy be read instantly?
5. VISUAL IMPACT — thumb-stopping power: emotion, energy, contrast, brand feel. Memorable 10 seconds later?

FAIRNESS:
- Do NOT invent problems. Taste is not a flaw. Good ads are common — issues must be honest.
- Score across the FULL range: 90-100 excellent, 75-89 good with small flaws, 60-74 decent with real problems, below 60 meaningfully weak. Do not cluster.

HARD LENGTH RULES — quick review, not a report:
- summary: 2-3 sentences. every point: max 10 words. every why: max 15 words.
- works: 2-4 items. changes: 1-5 items; title max 6 words, action max 15 words.
- No filler. No text outside the JSON.

Reply with ONLY one JSON object in this EXACT shape:
{
  "ad_format": "what kind of ad this is (e.g. Instagram Feed Ad, Story Ad, Banner Ad, Print Ad, Outdoor)",
  "overall": {"score": 0-100, "summary": "2-3 sentences: your verdict — does this ad work, for whom, and the one most important thing to know"},
  "scores": {"hook": 0-100, "hierarchy": 0-100, "cta": 0-100, "readability": 0-100, "impact": 0-100},
  "works": [{"area": "hook|hierarchy|cta|readability|impact|general", "point": "max 10 words", "why": "max 15 words"}],
  "changes": [{"area": "hook|hierarchy|cta|readability|impact|general", "title": "max 6 words", "severity": "critical|important|minor", "action": "max 15 words — the exact change to make", "location": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100} OR null}]
}

RULES:
- location: PERCENTAGES (x,y = top-left). Only if HIGHLY CONFIDENT (10x10 grid), else null.
- changes must point at real, visible problems. Never taste-only complaints.
- If the ad is strong: high scores, few changes, and cover what works in "works".`;

function normalizeAd(raw) {
  const j = jsonOf(raw);
  return {
    ad_format: str(j.ad_format) || 'Ad Creative',
    overall: { score: clamp(j.overall?.score, 0, 100), summary: str(j.overall?.summary) },
    scores: {
      hook: clamp(j.scores?.hook, 0, 100),
      hierarchy: clamp(j.scores?.hierarchy, 0, 100),
      cta: clamp(j.scores?.cta, 0, 100),
      readability: clamp(j.scores?.readability, 0, 100),
      impact: clamp(j.scores?.impact, 0, 100)
    },
    works: (Array.isArray(j.works) ? j.works : [])
      .map((w) => ({ area: AD_AREAS.includes(w?.area) ? w.area : 'general', point: staticSafe(str(w?.point)), why: staticSafe(str(w?.why)) }))
      .filter((w) => w.point),
    changes: (Array.isArray(j.changes) ? j.changes : [])
      .map((c) => ({
        area: AD_AREAS.includes(c?.area) ? c.area : 'general',
        title: staticSafe(str(c?.title) || 'Change'),
        severity: ['critical', 'important', 'minor'].includes(c?.severity) ? c.severity : 'minor',
        action: staticSafe(str(c?.action)),
        location: locationOf(c?.location)
      }))
      .filter((c) => c.title !== 'Change' || c.action)
      .slice(0, 5)
  };
}

exports.analyzeAd = async (file) => normalizeAd(await callModel({
  ...file,
  system: AD_SYSTEM,
  text: 'Review this ad creative now. JSON only.',
  maxTokens: 7000,
  temperature: 0.5
}));

/* =====================  WEBSITE REVIEW  ===================== */

const WEBSITE_AREAS = ['typography', 'spacing', 'alignment', 'contrast', 'hierarchy', 'usability', 'content', 'general'];

const WEBSITE_SYSTEM = `You are GlowUp — a senior UI/UX designer reviewing a WEBSITE's design. Quick, honest, human read.

${NO_REPEAT}

You may receive a screenshot of the site, the page's visible content fetched from the live URL, or both.
- This is a VISUAL UI/UX review — exactly like reviewing a design file. NOT a code review. Never comment on code, SEO, meta tags, page speed, security or tech stack.
- Screenshot present → this is your main source. Judge spacing, alignment, contrast, typography, hierarchy and usability of the layout exactly as shown.
- Page content present → use it to spot content MISTAKES (typos, grammar slips, placeholder text, broken wording) and to understand the page's sections and journey (UX).
- Websites are interactive — weak CTA affordance, unclear buttons, missing hover cues or confusing navigation are proper UI/UX feedback here.

Reply with ONLY one JSON object in this EXACT shape:
{
  "site_url": "short label of the site",
  "overall": {"score": 0-100, "summary": "ONE short paragraph (~30 words): your verdict as a UI/UX designer — do NOT repeat points listed below"},
  "scores": {"typography": 0-100, "spacing": 0-100, "alignment": 0-100, "contrast": 0-100, "hierarchy": 0-100, "usability": 0-100},
  "works": [{"area": "typography|spacing|alignment|contrast|hierarchy|usability|content|general", "point": "max 10 words", "why": "max 15 words"}],
  "changes": [{"area": "same values", "title": "max 6 words", "severity": "critical|important|minor", "action": "max 15 words — the exact change to make", "location": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100} OR null}]
}

SCORING (integers 0-100, fair and honest):
1. typography — font choices, sizes and text readability.
2. spacing — whitespace, padding, breathing room and rhythm between elements.
3. alignment — grid, shared edges, consistency of positioning.
4. contrast — text and element contrast for readability and clarity.
5. hierarchy — does the eye flow the right way: headline → value → action?
6. usability — how easy the page is to use: clear actions, logical order, low friction.

RULES:
- works 2-5 items, changes 1-6 items. Flag only real, visible problems. Taste is not a flaw. Few changes on a strong page is correct.
- Content MISTAKES only (typos, grammar slips, placeholder text) go in area "content" with a severity. Do not rewrite style or tone choices unless they are actual errors.
- location: percentages of the SCREENSHOT (x,y = top-left), only when highly confident. Content-only issues or no screenshot → null.
- severity: critical only when it blocks the page's main goal.
- Every change must be actionable inside the design: fix spacing, alignment, contrast, type, layout or the wording.
- When there is no screenshot, keep spacing/alignment/contrast scores conservative (mid-range) and focus on hierarchy, usability, type structure and content mistakes.`;

// Compact digest of the page's VISIBLE content — for content mistakes + page journey (UI/UX), not a technical audit
function digestHtml(html, url, status) {
  const textOf = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const title = textOf((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 140);
  const grab = (tag, n) => [...html.matchAll(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi'))]
    .map((m) => textOf(m[1])).filter(Boolean).slice(0, n);
  const h1s = grab('h1', 3), h2s = grab('h2', 8);
  const labels = [...html.matchAll(/<(a|button)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => textOf(m[2])).filter((t) => t && t.length < 40).slice(0, 10);
  const body = textOf((html.match(/<body[^>]*>([\s\S]*)/i) || [])[1] || '');
  return [
    'URL: ' + url,
    'Page title: ' + (title || '(missing)'),
    'Main heading (H1): ' + (h1s.join(' | ') || '(missing)'),
    'Section headings (H2s): ' + (h2s.join(' | ') || '(none)'),
    'Button/link labels: ' + (labels.join(', ') || '(none)'),
    'Visible page text: ' + (body.slice(0, 1600) || '(empty)')
  ].join('\n');
}

async function fetchSite(rawUrl) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl); }
  catch { return { error: 'That link does not look like a valid URL.' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'Only http and https links are supported.' };
  if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i.test(u.hostname)) return { error: 'That address cannot be fetched.' };
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(u.href, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlowUp-Analyzer/1.0)', Accept: 'text/html,application/xhtml+xml' }
    });
    const html = (await r.text()).slice(0, 500000);
    clearTimeout(to);
    return { url: u.href, finalUrl: r.url, status: r.status, digest: digestHtml(html, r.url || u.href, r.status) };
  } catch (e) {
    clearTimeout(to);
    return { error: 'We could not open that link. Check the URL and try again.' };
  }
}

function normalizeWeb(raw) {
  const j = jsonOf(raw);
  return {
    site_url: str(j.site_url),
    overall: { score: clamp(j.overall?.score, 0, 100), summary: str(j.overall?.summary) },
    scores: {
      typography: clamp(j.scores?.typography, 0, 100),
      spacing: clamp(j.scores?.spacing, 0, 100),
      alignment: clamp(j.scores?.alignment, 0, 100),
      contrast: clamp(j.scores?.contrast, 0, 100),
      hierarchy: clamp(j.scores?.hierarchy, 0, 100),
      usability: clamp(j.scores?.usability, 0, 100)
    },
    works: (Array.isArray(j.works) ? j.works : [])
      .map((w) => ({ area: WEBSITE_AREAS.includes(w?.area) ? w.area : 'general', point: str(w?.point), why: str(w?.why) }))
      .filter((w) => w.point),
    changes: (Array.isArray(j.changes) ? j.changes : [])
      .map((c) => ({
        area: WEBSITE_AREAS.includes(c?.area) ? c.area : 'general',
        title: str(c?.title) || 'Change',
        severity: ['critical', 'important', 'minor'].includes(c?.severity) ? c.severity : 'minor',
        action: str(c?.action),
        location: locationOf(c?.location)
      }))
      .filter((c) => c.title !== 'Change' || c.action)
      .slice(0, 6)
  };
}

exports.analyzeWebsite = async ({ file, url }) => {
  let digestBlock = '', siteUrl = url || '';
  if (url) {
    const site = await fetchSite(url);
    if (site.error) {
      if (!file) { const e = new Error(site.error); e.expose = true; throw e; }
      digestBlock = '(The link could not be opened: ' + site.error + ' Reviewing the screenshot only.)';
    } else {
      siteUrl = site.finalUrl || site.url;
      digestBlock = site.digest;
    }
  }
  const inputNote = digestBlock && file
    ? 'INPUT: a screenshot of the website AND the page content fetched from the live URL below. Review BOTH — UI/UX from the screenshot, content mistakes and page journey from the text.'
    : digestBlock
      ? 'INPUT: the page content fetched from the live website below. No screenshot — review the page journey and catch content mistakes; keep visual scores conservative.'
      : 'INPUT: a screenshot of the website. Review the UI/UX exactly as shown.';
  const text = `${inputNote}\n\n${digestBlock ? 'PAGE CONTENT:\n' + digestBlock + '\n\n' : ''}Review it like a senior UI/UX designer: fair, objective, every visible detail covered. JSON only.`;
  const out = normalizeWeb(await callModel({
    mime: file?.mime, data: file?.data,
    system: WEBSITE_SYSTEM,
    text,
    maxTokens: 7000,
    temperature: 0.3
  }));
  if (siteUrl && !out.site_url) out.site_url = siteUrl;
  return out;
};

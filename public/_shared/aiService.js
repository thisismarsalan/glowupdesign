// AI provider layer — Gemini API (shared by Vercel serverless functions)
const KB = require('../knowledge.js');
const CATS = ['alignment', 'spacing', 'typography', 'color', 'readability', 'hierarchy', 'composition'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
const str = (v) => (typeof v === 'string' ? v : '');

const SYSTEM = `You are GlowUp, an expert graphic design mentor. Critique the supplied design (image or PDF). Be specific and to the point.

ANALYSIS STEPS (follow in order):
STEP 1 — Identify the design type. Choose exactly ONE: "Poster", "Social Media Post", "UI/Web Design", "Logo", "Business Card", "Flyer", "Presentation Slide", "Infographic", "Packaging", "Banner", "Icon", "Other".
STEP 2 — Apply critique criteria appropriate to THAT design type.
STEP 3 — Check readability: contrast, font size, visual hierarchy.
STEP 4 — Judge fairly. Good designs are common — when a design is well executed, score it high and find little or nothing wrong with it. Never give 0 unless the element is completely absent from the design.

Reply with ONLY one JSON object, no markdown, in this EXACT shape:
{
  "design_type": "Poster",
  "title_text": "The exact main headline/title text of the design, copied EXACTLY as written. Empty string if none.",
  "overall": {"score": 0-100, "summary": "2-3 sentences max"},
  "categories": {
    ${CATS.map((c) => `"${c}": {"score": 0-100, "issues": []}`).join(',\n    ')}
  },
  "recommendations": ["actionable change 1", "actionable change 2"],
  "typography_errors": [
    {"error": "Short error name", "detail": "What is wrong and where", "fix": "Exact fix"}
  ]
}

Each issue object: {
  "title": "Short descriptive title",
  "severity": "critical|important|minor",
  "description": "What the problem is (be specific)",
  "how_to_improve": "Exact steps to fix",
  "location": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100} OR null
}

FAIRNESS RULES (most important):
- Your job is FAIR, balanced feedback — NOT fault-finding. Designers make good designs all the time.
- ONLY report issues that are clearly, objectively visible and genuinely hurt the design (unreadable text, true misalignment, real contrast failure, typos, broken hierarchy, clearly cramped spacing). If you are not sure something is a real problem, leave it out.
- NEVER report subjective taste as an issue (e.g. "could be more modern", "not exciting enough", "colors feel dated"). Taste is not an issue.
- Empty issues lists are correct and COMMON. Most categories in most designs should have NO issues.
- Maximum 6 issues TOTAL across all categories — only the ones that truly matter. Never invent or pad the list.
- Use the full score range and do NOT cluster scores around 55-70: 90-100 excellent execution, 75-89 good with minor flaws, 60-74 decent with some real problems, 40-59 flawed, below 40 broken. A clean, competent design deserves 75+.
- The summary MUST be balanced: first one sentence on what works well, then the main improvement. If the design is strong, say so plainly.

CRITICAL RULES:
- Coordinates are PERCENTAGES (x,y = top-left corner). Only provide coordinates if you are HIGHLY CONFIDENT. If unsure, use null.
- To verify coordinates: imagine the image divided into a 10x10 grid. x=0 is left edge, x=100 is right edge, y=0 is top, y=100 is bottom.
- Never name an exact font; say e.g. "appears to be a modern sans-serif".
- Give HEX colors only as approximate values.
- ALWAYS include real strengths inside the summary when the design deserves them.
- Reserve "critical" for problems that seriously hurt readability or communication, never for taste.
- Scores measure adherence to design principles, not artistic talent.
- Be ACCURATE with severity: "critical" = broken, "important" = noticeably hurts quality, "minor" = small polish issue.
- title_text: copy the main headline EXACTLY as written in the design (keep its original casing). If the design has no text at all, use an empty string.
- recommendations: 3-6 of the MOST IMPACTFUL changes for THIS design, each one short actionable sentence, most important first.
- typography_errors covers ONLY typography: font count, pairing, sizes, weights, line spacing, letter spacing, all-caps abuse, legibility of type. Every entry must be specific to THIS design. Not color or alignment.
- Keep every string short and to the point. No filler.

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

const POST_TEXT = 'Analyze this design fairly and objectively following the instructions. Remember: only real, visible problems count as issues. JSON only.';

async function callModel({ mime, data, system = SYSTEM, text = POST_TEXT, maxTokens = 12000, temperature = 0.4 }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [
      { inline_data: { mime_type: mime, data: data } },
      { text }
    ];

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

function normalize(raw) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('no json');
  const j = JSON.parse(raw.slice(s, e + 1));
  if (!j.categories || !j.overall) throw new Error('bad shape');
  const list = (a) => (Array.isArray(a) ? a.map(str).filter(Boolean) : []);
  const out = {
    design_type: str(j.design_type) || 'Unknown',
    title_text: str(j.title_text),
    overall: { score: clamp(j.overall.score, 0, 100), summary: str(j.overall.summary) },
    categories: {},
    recommendations: list(j.recommendations),
    typography_errors: (Array.isArray(j.typography_errors) ? j.typography_errors : [])
      .map((t) => ({ error: str(t.error), detail: str(t.detail), fix: str(t.fix) }))
      .filter((t) => t.error || t.detail || t.fix)
  };
  for (const c of CATS) {
    const cat = j.categories[c] || {};
    out.categories[c] = {
      score: clamp(cat.score, 0, 100),
      issues: (Array.isArray(cat.issues) ? cat.issues : []).map((i) => {
        const L = i.location;
        const ok = L && [L.x, L.y, L.width, L.height].every((n) => Number.isFinite(+n)) && +L.width > 0 && +L.height > 0;
        return {
          title: str(i.title) || 'Issue',
          severity: ['critical', 'important', 'minor'].includes(i.severity) ? i.severity : 'minor',
          description: str(i.description),
          how_to_improve: str(i.how_to_improve),
          location: ok ? { x: clamp(L.x, 0, 100), y: clamp(L.y, 0, 100), width: clamp(L.width, 1, 100), height: clamp(L.height, 1, 100) } : null
        };
      })
    };
  }
  // Keep feedback honest: at most 6 issues total, most severe first
  const sev = { critical: 0, important: 1, minor: 2 };
  const flat = [];
  for (const c of CATS) for (const i of out.categories[c].issues) flat.push(i);
  flat.sort((x, y) => sev[x.severity] - sev[y.severity]);
  const keep = new Set(flat.slice(0, 6));
  for (const c of CATS) out.categories[c].issues = out.categories[c].issues.filter((i) => keep.has(i));
  return out;
}

exports.analyzeDesign = async (file) => normalize(await callModel(file));

/* =====================  LOGO REVIEW (brand identity)  ===================== */

const LOGO_SYSTEM = `You are a senior brand-identity designer giving a fellow designer a quick, honest review of their logo. Think and write like a human with sharp taste: react first, then cover only what matters. Plain, direct language — like a smart friend over coffee, NOT a formal critique document.

INFORMATION FROM THE DESIGNER (business, audience, industry, personality, client requirements):
"""
{{BRIEF}}
"""
If the information is empty, review as a standalone logo and add one short line about what context would sharpen the judgment.

HOW TO LOOK AT THE IMAGE (important):
- Study EVERYTHING visible in the image. Logo boards often show several items: the main logo lockup, the icon/symbol alone, the wordmark alone, color or layout variations (mono, inverted), and mockups. List EVERY visible item in "parts" and give each a one-line take. If it is a single logo, list its parts (icon, wordmark) instead.

FAIRNESS:
- Do NOT invent problems. Taste is not a flaw. If something works, say so and say keep it.
- Good logos are common. The number of "fixes" must be honest (0-5). Zero fixes is a valid answer.

HARD LENGTH RULES — this is a quick review, not a report:
- quick_take: 2-3 sentences only.
- every point: max 10 words. every why: max 15 words.
- works: 2-4 items (fewer if honest). fixes: 0-5 items. parts: one line each.
- verdict.direction: 2-3 sentences. verdict.next_step: one short sentence.
- No filler. No text outside the JSON.

Reply with ONLY one JSON object in this EXACT shape:
{
  "quick_take": "2-3 sentences: honest first reaction — what this logo says, for whom, and whether it works",
  "parts": [{"name": "Main logo | Icon | Wordmark | Variation: mono | Mockup | ...", "take": "one line about this item"}],
  "works": [{"point": "max 10 words", "why": "max 15 words"}],
  "fixes": [{"point": "max 10 words", "why": "max 15 words", "priority": "now|later"}],
  "requirements": [{"requirement": "one requirement the designer stated", "status": "met|partial|not_met", "note": "max 12 words"}],
  "verdict": {"direction": "2-3 sentences: the creative direction to take", "next_step": "one short sentence — the single next design step"}
}

FIELD RULES:
- requirements: ONLY requirements explicitly stated by the designer. If none, return [].
- priority "now" = fix before shipping; "later" = refine when possible.
- fixes must improve the EXISTING logo, not redesign it.
- Fold design reasoning (business \u2192 audience \u2192 personality) into the short why's — never write long paragraphs.
- If the image shows multiple items, also mention in quick_take whether the pieces feel consistent as one identity.`;

function buildLogoSystem(brief) {
  const b = (brief || '').trim();
  return LOGO_SYSTEM.replace('{{BRIEF}}', b || '(no additional context provided)');
}

function normalizeLogo(raw) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('no json');
  const j = JSON.parse(raw.slice(s, e + 1));
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
    verdict: {
      direction: str(j.verdict?.direction),
      next_step: str(j.verdict?.next_step)
    }
  };
}

exports.analyzeLogo = async ({ file, brief }) => normalizeLogo(await callModel({
  ...file,
  system: buildLogoSystem(brief),
  text: 'Give your quick honest logo review now. Look at every item in the image. JSON only.',
  maxTokens: 6000,
  temperature: 0.5
}));

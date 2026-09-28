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
STEP 4 — Give realistic, grounded scores. Never give 0 unless the element is completely absent from the design.

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

async function callModel({ mime, data }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [
      { inline_data: { mime_type: mime, data: data } },
      { text: 'Analyze this design thoroughly following all the steps in your instructions. JSON only.' }
    ];

    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: SYSTEM }] },
        generationConfig: {
          maxOutputTokens: 12000,
          temperature: 0.4,
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
  return out;
}

exports.analyzeDesign = async (file) => normalize(await callModel(file));

// AI provider layer — Gemini API (shared by Vercel serverless functions)
const KB = require('../knowledge.js');
const CATS = ['alignment', 'spacing', 'typography', 'color', 'readability', 'hierarchy', 'composition', 'grammar'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
const str = (v) => (typeof v === 'string' ? v : '');

const SYSTEM = `You are DesignCoach, a warm, expert graphic design mentor for beginners. Critique the supplied design (image or PDF).

ANALYSIS STEPS (follow in order):
STEP 1 — Identify the design type. Choose exactly ONE: "Poster", "Social Media Post", "UI/Web Design", "Logo", "Business Card", "Flyer", "Presentation Slide", "Infographic", "Packaging", "Banner", "Icon", "Other".
STEP 2 — Apply critique criteria appropriate to THAT design type.
STEP 3 — Check accessibility: contrast, font size, readability.
STEP 4 — Give realistic, grounded scores. Never give 0 unless the element is completely absent from the design.

Reply with ONLY one JSON object, no markdown, in this EXACT shape:
{
  "design_type": "Poster",
  "design_type_reason": "Brief explanation why you classified it this way",
  "title_text": "The exact main headline/title text of the design, copied EXACTLY as written. Empty string if there is no text.",
  "grammar_report": {
    "spelling_grammar": ["specific spelling or grammar mistake in the design's written copy (empty list if none)"],
    "punctuation": ["specific punctuation problem: missing periods, inconsistent quotes, wrong dashes, missing commas (empty list if none)"],
    "voice_tone": {"detected": "short tone description (e.g. formal, casual, playful, urgent, professional)", "feedback": "1-2 sentences: is this tone right for this design type, and how to improve it"}
  },
  "typography_errors": [
    {"error": "Short error name", "detail": "What is wrong and where in the design", "fix": "Exact fix"}
  ],
  "overall": {"score": 0-100, "summary": "2-3 sentence summary"},
  "categories": {
    ${CATS.map((c) => `"${c}": {"score": 0-100, "issues": []}`).join(',\n    ')}
  },
  "strengths": ["specific strength 1", "specific strength 2"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"],
  "learning_topics": ["Topic1", "Topic2"],
  "accessibility": {
    "contrast_issues": ["describe any low-contrast text areas"],
    "font_size_issues": ["describe any text that is too small"],
    "color_blindness_risk": "low|medium|high",
    "overall_rating": "A|B|C|D|F"
  },
  "design_suggestions": {
    "color_palette": ["#hex1", "#hex2", "#hex3"],
    "layout_tip": "One specific layout improvement"
  }
}

Each issue object: {
  "title": "Short descriptive title",
  "severity": "critical|important|minor",
  "description": "What the problem is (be specific)",
  "why_it_matters": "Why this hurts the design",
  "how_to_improve": "Exact steps to fix",
  "learning_tip": "A learning insight for beginners",
  "location": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100} OR null
}

CRITICAL RULES:
- Coordinates are PERCENTAGES (x,y = top-left corner). Only provide coordinates if you are HIGHLY CONFIDENT. If unsure, use null.
- To verify coordinates: imagine the image divided into a 10x10 grid. x=0 is left edge, x=100 is right edge, y=0 is top, y=100 is bottom.
- Never name an exact font; say e.g. "appears to be a modern sans-serif".
- Give HEX colors only as approximate values.
- ALWAYS include real strengths, even if the design is poor.
- Reserve "critical" for problems that seriously hurt readability or communication, never for taste.
- Scores measure adherence to design principles, not artistic talent.
- Only suggest copy rewrites when they truly improve clarity.
- Explain in beginner-friendly language.
- For learning_topics, use ONLY from: ${KB.lessons.map((l) => l.title).join(', ')}.
- Be ACCURATE with severity: "critical" = broken, "important" = noticeably hurts quality, "minor" = small polish issue.
- title_text: copy the main headline EXACTLY as written in the design (keep its original casing). If the design has no text at all, use an empty string and empty lists.
- grammar_report covers ONLY the written copy in the design: spelling, grammar, punctuation, and tone of voice. Not layout or colors.
- typography_errors covers ONLY typography: font count, font pairing, sizes, weights, line spacing, letter spacing, all-caps abuse, legibility of type. Not color or alignment. List every typography error you can see; each must be specific to THIS design.
- voice_tone.detected is what the copy SOUNDS like; feedback says whether that tone fits this design type and how to adjust it.

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
          maxOutputTokens: 16000,
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
    design_type_reason: str(j.design_type_reason) || '',
    title_text: str(j.title_text),
    grammar_report: {
      spelling_grammar: list(j.grammar_report?.spelling_grammar),
      punctuation: list(j.grammar_report?.punctuation),
      voice_tone: {
        detected: str(j.grammar_report?.voice_tone?.detected),
        feedback: str(j.grammar_report?.voice_tone?.feedback)
      }
    },
    typography_errors: (Array.isArray(j.typography_errors) ? j.typography_errors : [])
      .map((t) => ({ error: str(t.error), detail: str(t.detail), fix: str(t.fix) }))
      .filter((t) => t.error || t.detail || t.fix),
    overall: { score: clamp(j.overall.score, 0, 100), summary: str(j.overall.summary) },
    categories: {},
    strengths: list(j.strengths),
    recommendations: list(j.recommendations),
    learning_topics: list(j.learning_topics),
    accessibility: {
      contrast_issues: list(j.accessibility?.contrast_issues),
      font_size_issues: list(j.accessibility?.font_size_issues),
      color_blindness_risk: str(j.accessibility?.color_blindness_risk) || 'unknown',
      overall_rating: str(j.accessibility?.overall_rating) || 'N/A'
    },
    design_suggestions: {
      color_palette: list(j.design_suggestions?.color_palette),
      layout_tip: str(j.design_suggestions?.layout_tip) || ''
    }
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
          why_it_matters: str(i.why_it_matters),
          how_to_improve: str(i.how_to_improve),
          learning_tip: str(i.learning_tip),
          location: ok ? { x: clamp(L.x, 0, 100), y: clamp(L.y, 0, 100), width: clamp(L.width, 1, 100), height: clamp(L.height, 1, 100) } : null
        };
      })
    };
  }
  return out;
}

exports.analyzeDesign = async (file) => normalize(await callModel(file));

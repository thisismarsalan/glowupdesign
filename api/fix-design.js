// DesignCoach /api/fix-design — Vercel serverless adapter (repo-root api/ variant)
const { generateFix } = require('../public/_shared/aiService');

module.exports = async (req, res) => {
  const R = (c, b) => res.status(c).json(b);
  if (req.method !== 'POST') return R(405, { error: 'Method not allowed.' });
  if (!process.env.AI_API_KEY) return R(500, { error: 'API key not configured.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const image = body.image;
    const issues = body.issues;
    const fixAll = body.fixAll;

    if (!image || !issues || !issues.length) return R(400, { error: 'Missing image or issues.' });

    const cut = image.indexOf(';base64,');
    if (!image.startsWith('data:') || cut < 0) return R(400, { error: 'Invalid image format.' });

    const mime = image.slice(5, cut);
    const data = image.slice(cut + 8);

    const result = await generateFix({ mime, data, issues, fixAll: !!fixAll });
    return R(200, result);
  } catch (err) {
    console.error('fix-design failed:', err && err.message);
    return R(502, { error: 'Could not generate fixed design: ' + (err?.message || 'Unknown error') });
  }
};

module.exports.config = { maxDuration: 60 };

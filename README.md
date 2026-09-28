# DesignCoach — Design better. Learn why.

An AI design critique and learning tool powered by Gemini. No build step: a static site (`public/`) plus one secure Netlify serverless function (`netlify/functions/`).

## Features
- 🎨 **AI Design Analysis** — Upload any design (PNG, JPG, WEBP, PDF) and get detailed feedback
- 📋 **Summary First** — Overall verdict and summary shown at the top of the results
- ✅ **Changes Required** — Actionable changes listed as clear bullet points
- 📐 **8 Design Categories** — Typography, Spacing, Alignment, Color, Readability, Hierarchy, Composition, Grammar
- 🏷️ **Design Type Detection** — AI identifies whether it's a poster, UI, logo, social media post, etc.
- ♿ **Accessibility Check** — WCAG ratings, contrast issues, color blindness risk assessment
- 📍 **Visual Issue Markers** — Numbered markers on your design showing exactly where problems are
- 📝 **Grammar & Tone** — Spelling/grammar mistakes, punctuation issues, and voice-tone feedback on your copy
- 🔤 **Title Variations** — Your title text in 3 casings: UPPER CASE, Sentence case, Title Case (main words capitalized)
- ✒️ **Typography Errors** — Specific type problems: font count, sizes, weights, spacing, legibility
- 📚 **Learn Section** — 10 beginner-friendly design lessons
- 🧠 **Practice Mode** — 35+ quiz questions to test your design knowledge
- 🎨 **Color Suggestions** — AI-suggested color palettes for your design
- 📄 **Export Reports** — Download analysis as TXT or JSON, copy to clipboard
- 📋 **History** — Save and revisit past analyses (stored locally on device)
- 🌙 **Dark Mode** — Automatic dark/light theme based on system preference

## Deploy to Netlify
1. **GitHub repository:** Fork or clone this repo.
2. **Connect Netlify:** at netlify.com → **Add new site → Import an existing project → GitHub** → choose this repo.
3. **Build settings** (auto-detected from `netlify.toml`):
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. **API key:** Site configuration → **Environment variables** → Add:
   - `AI_API_KEY` = your Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
   - `AI_MODEL` = `gemini-2.5-flash` (optional, this is the default)
5. Click **Deploy**.

## Notes
- The API key stays server-side; the browser only calls `/api/analyze`.
- Netlify functions have a time limit (default 10s, up to 26s on paid plans). The default model `gemini-2.5-flash` is fast.
- PDFs: analyzed by the AI, limited to ~4 MB (Netlify request limit); no preview or markers for PDFs.
- Swap AI provider by editing only `callModel()` in `netlify/functions/aiService.js`.
- Add design lessons in `public/knowledge.js`.
- Test locally: `npx netlify-cli dev` with a `.env` file containing `AI_API_KEY`.

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Backend:** Netlify Functions (serverless)
- **AI:** Google Gemini API
- **Hosting:** Netlify

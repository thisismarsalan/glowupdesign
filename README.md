# GlowUp — AI design analysis

Upload a design and get a clear, to-the-point AI critique. No build step: a static site (`public/`) plus one secure Vercel serverless function (`api/`).

## What you get
- 📢 **Ad Creative Review** — Hook, hierarchy, CTA, readability and visual impact with issue markers
- ✦ **Logo Review** — Brand-identity analysis: fit, typography, icon, balance, color, scalability, uniqueness, requirement matching and creative direction
- 📋 **Summary & Score** — Overall verdict at the top, with a 0–100 score
- 📐 **Category Scores** — Typography, Spacing, Alignment, Color, Readability, Hierarchy, Composition
- ✅ **Changes Required** — The most impactful fixes as bullet points
- 🔍 **Issues** — Specific problems with severity and exact fixes, shown as numbered markers on your design
- ✒️ **Typography Errors** — Font count, sizes, weights, spacing, legibility problems
- 🔤 **Title Variations** — Your title text in 3 casings: UPPER CASE, Sentence case, Title Case
- 🎨 **Design Type Detection** — Poster, UI, logo, social post, and more

## Features
- Upload PNG, JPG, WEBP or PDF (drag & drop, file picker, or paste from clipboard)
- Sample design to try instantly
- Dark mode based on system preference

## Deploy to Vercel
1. Push this repo to GitHub and import it in Vercel (framework preset: **Other**).
2. **Build settings**:
   - Output directory: `public`
   - Functions directory: `api` (auto-detected)
3. **Environment variables** (Site configuration → Environment variables):
   - `AI_API_KEY` = your Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
   - `AI_MODEL` = `gemini-3.5-flash-lite` (optional, this is the default)
4. Click **Deploy** — every push to `main` auto-deploys.

## Notes
- The API key stays server-side; the browser only calls `/api/analyze`.
- Vercel serverless functions accept request bodies up to ~4.5 MB; smaller images work best.
- Swap AI provider by editing only `callModel()` in `public/_shared/aiService.js`.
- Design principles used in the prompt live in `public/knowledge.js`.
- Test locally: `npx vercel dev` with a `.env` file containing `AI_API_KEY`.

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Backend:** Vercel Serverless Functions
- **AI:** Google Gemini API
- **Hosting:** Vercel

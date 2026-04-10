# Deploy LayerLens for a public test URL

This app runs **Playwright (headless Chromium)** on the server for `/api/audit`. That does **not** work on typical **Vercel** serverless functions (no full browser, size/time limits). Use a **container** host instead.

## What you need

1. A **GitHub** (or GitLab) repo containing this project (this `data-layer-agent` folder can be the repo root).
2. A **Google AI Studio** API key for Gemini: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. On the host, set environment variable **`GEMINI_API_KEY`** (same names also work: `GEMINIAPI_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`).

After deploy, open your site, run a scan, then open the **AI** tab and generate the report — the server calls Gemini using that key. If the key is missing, automated audits still work; only the AI summary is disabled.

## Option A — Render (free tier, Docker)

1. Push this project to GitHub.
2. In [Render](https://render.com): **New +** → **Web Service** → connect the repo.
3. **Runtime**: Docker (Render detects `Dockerfile`).
4. If the repo root is the monorepo parent folder, set **Root Directory** to `data-layer-agent`.
5. **Instance type**: Free (cold starts after idle; first request may be slow).
6. Under **Environment**, add **`GEMINI_API_KEY`** = your key.
7. Deploy. Render assigns a URL like `https://layerlens.onrender.com`.

Optional: **New** → **Blueprint** and point at `render.yaml` in the repo (still add `GEMINI_API_KEY` in the dashboard).

## Option B — Railway

1. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub** → pick the repo.
2. If needed, set **Root Directory** to `data-layer-agent`.
3. Railway detects `Dockerfile` and builds it.
4. **Variables** → add **`GEMINI_API_KEY`**.
5. **Settings** → generate a public domain.

Railway’s free tier is credit-based; if you exceed it, use Render Free or a small paid plan.

## Option C — Fly.io

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/), then from this directory:

   ```bash
   fly launch --no-deploy
   ```

2. Set secrets:

   ```bash
   fly secrets set GEMINI_API_KEY=your_key_here
   ```

3. Ensure `fly.toml` uses `internal_port = 3000` (this Dockerfile listens on `PORT` default 3000).
4. `fly deploy`

Use a VM with at least **1 GB RAM**; Chromium needs memory.

## Verify production

- Open `https://YOUR_HOST/api/health` — should return OK.
- Open `https://YOUR_HOST/api/analyze` (GET) — JSON should show `"configured": true` if `GEMINI_API_KEY` is set.
- In the UI: run **Run check**, then **AI** tab → generate report.

## Dockerfile and Playwright versions

The `Dockerfile` uses `mcr.microsoft.com/playwright:v1.59.1-jammy`, which should match the **Playwright npm version** in `package-lock.json`. After a major `npm update` of Playwright, bump the image tag to the same version and redeploy.

## Security

- Never commit `.env.local` or real API keys to git.
- If a key was ever committed or shared, **rotate** it in Google AI Studio and update the host’s environment variable.

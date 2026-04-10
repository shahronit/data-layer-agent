# Deploy LayerLens for a public test URL

This app runs **Playwright (headless Chromium)** on the server for `/api/audit`. That does **not** work on typical **Vercel** serverless functions (no full browser, size/time limits). Use a **container** host instead.

## What you need

1. A **GitHub** (or GitLab) repo containing this project (canonical repo: [shahronit/data-layer-agent](https://github.com/shahronit/data-layer-agent); the app can live at the repo root).
2. A **Google AI Studio** API key for Gemini: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. On the host, set environment variable **`GEMINI_API_KEY`** (same names also work: `GEMINIAPI_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`).

After deploy, open your site, run a scan, then open the **AI** tab and generate the report — the server calls Gemini using that key. If the key is missing, automated audits still work; only the AI summary is disabled.

## Option A — Render (free tier, Docker)

1. Push this project to GitHub.
2. In [Render](https://render.com): **New +** → **Web Service** → connect the repo.
3. **Runtime**: **Docker** (Render should detect the root `Dockerfile`).

### Root Directory — you usually **do not** need it

- If your GitHub repo looks like **our default layout** (`Dockerfile` and `package.json` are at the **top level** of the repo — e.g. [shahronit/data-layer-agent](https://github.com/shahronit/data-layer-agent)), then **leave Root Directory empty** (or leave the default). The repo root **is** the app; there is no extra nested `data-layer-agent/` folder, so setting Root Directory to `data-layer-agent` would **fail** the build.
- Only set **Root Directory** when the app lives in a **subfolder** (monorepo), e.g. repo contains `apps/layerlens/` or `data-layer-agent/` with the `Dockerfile` inside that folder. Then set Root Directory to that path (no leading slash), e.g. `data-layer-agent`.

**Where to set it on Render (if you need it):** open your Web Service → **Settings** → **Build & Deploy** → **Root Directory** (see [Monorepo support](https://render.com/docs/monorepo-support)). On the *first* “Create Web Service” screen, expand **Advanced** if you do not see it.

4. **Instance type**: Free (cold starts after idle; first request may be slow).
5. Under **Environment**, add **`GEMINI_API_KEY`** = your key.
6. Deploy. Render assigns a URL like `https://layerlens.onrender.com`.

Optional: **New** → **Blueprint** and point at `render.yaml` in the repo (still add `GEMINI_API_KEY` in the dashboard). For a monorepo, add `rootDir` under that service in `render.yaml` (see comments in that file).

## Option B — Railway

1. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub** → pick the repo.
2. If the app is in a **monorepo subfolder** (not the case for [shahronit/data-layer-agent](https://github.com/shahronit/data-layer-agent) at root), set **Root Directory** to that folder name.
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

Chromium is installed in the **builder** stage with `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers` and `playwright install chromium --force`, then that folder is copied into the runner. That avoids copying `/root/.cache/ms-playwright` (often missing on the Playwright base image) and avoids relying on Next standalone’s trimmed `playwright` package (it does not include the install CLI).

## Optional: Adobe Analytics / Launch APIs

If you set **`ADOBE_ACCESS_TOKEN`**, **`ADOBE_API_KEY`**, and **`ADOBE_ANALYTICS_GLOBAL_COMPANY_ID`**, the UI can call [Analytics 2.0 report suite settings](https://developer.adobe.com/analytics-apis/docs/2.0/guides/reportsuite/). With **`ADOBE_IMS_ORG_ID`** and **`ADOBE_TAGS_PROPERTY_ID`**, it can list [Tags rules/extensions](https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/rules.html). Add these in the host’s **Environment** (same as `GEMINI_API_KEY`). **Processing rules / Vista / server-side hit acceptance** are not available as public REST endpoints for this use case—see **`GET /api/adobe/integration`** in the app.

## Security

- Never commit `.env.local` or real API keys to git.
- If a key was ever committed or shared, **rotate** it in Google AI Studio and update the host’s environment variable.

# LayerLens

**LayerLens** is a local **Next.js** console for **data-layer verification**: headless **Playwright** snapshots `window.dataLayer`, `window.digitalData`, GTM container IDs, `data-track*` attributes, and console noise—then scores health, **ranks issues P1–P4 with severity and remediation**, and (optionally) runs a **Gemini** narrative. It also detects **Adobe Analytics** collection URLs (`/b/ss/` and related hosts), **decodes query and urlencoded POST parameters** (eVars, props, events, page fields) for side-by-side QA with [Experience Platform Debugger](https://experienceleague.adobe.com/docs/debugger/using/experience-cloud-debugger.html)—not Adobe Admin (processing rules / Vista / report suite config). Download **Issues CSV/MD**, **full HTML dossier**, or **JSON** (includes `prioritizedIssues`).

The npm package name is `layerlens`; this repo folder may still be named `data-layer-agent` for path compatibility with parent workspace scripts.

## Quick start

```bash
cd "data-layer-agent"
npm install
npm run playwright:install
cp .env.example .env.local   # optional, for AI tab
npm run dev
```

Open [http://localhost:3331](http://localhost:3331) (default dev port). If it’s busy, run `PORT=3456 npm run dev` and use that port instead.

Enter a URL, **Run audit**.

After a scan, use the **Issues** tab for the remediation queue, **Dossier** for the full in-app report (scrolls inside the panel), and the export buttons for **Issues CSV**, **Issues MD**, **Full HTML**, or **JSON**. HTML and JSON include prioritized severity and remediation.

- Dev server uses **Turbopack** (`next dev --turbopack`).
- **GET /api/health** returns `{ ok: true, service: "layerlens" }` for quick readiness checks (no browser launch).

## Adobe Cloud (optional)

Set **`ADOBE_ACCESS_TOKEN`**, **`ADOBE_API_KEY`**, **`ADOBE_ANALYTICS_GLOBAL_COMPANY_ID`** to enable **report suite settings** via [Analytics 2.0](https://developer.adobe.com/analytics-apis/docs/2.0/guides/reportsuite/). Add **`ADOBE_IMS_ORG_ID`** and **`ADOBE_TAGS_PROPERTY_ID`** for **Launch rules / extensions** via [Reactor](https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/rules.html). Use the sidebar **Adobe Cloud** panel. Edge/Web SDK JSON bodies are **flattened** in audit hits; **processing rules / Vista / Adobe-side hit acceptance** still require Adobe’s own tools—`GET /api/adobe/integration` explains limits.

## AI narrative (optional)

Set `GEMINI_API_KEY` in `.env.local` (aliases: `GEMINIAPI_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`), then restart the server. Optional: `GEMINI_MODEL` (default **`gemini-2.5-pro`**). **GET /api/analyze** reports whether the key is loaded. The AI uses **vendor-neutral** tagging QA defaults; the textarea is pre-filled and editable.

## Jira (optional)

To **create Jira issues** from each finding on the **Issues** tab, add to `.env.local`:

- `JIRA_HOST` — e.g. `https://your-company.atlassian.net`
- `JIRA_EMAIL` — your Atlassian account email
- `JIRA_API_TOKEN` — [API token](https://id.atlassian.com/manage-profile/security/api-tokens)
- `JIRA_PROJECT_KEY` — project key (e.g. `QA`)
- `JIRA_ISSUE_TYPE` — optional, default **`Bug`**

Restart the app. **GET /api/jira** returns whether Jira is configured. This matches how QA often logs tool findings into a tracker during test cycles.

## MCP recommendations (Cursor)

| MCP | Role |
| --- | --- |
| [**@playwright/mcp**](https://github.com/microsoft/playwright-mcp) | Browser automation from the IDE (navigate, snapshot, network)—great for exploratory verification alongside this app. |
| **Cursor IDE Browser** | Built-in browser tools for manual spot-checks. |
| [**gtm-mcp**](https://github.com/pouyanafisi/gtm-mcp) / [**gtm-mcp-server**](https://github.com/paolobietolini/gtm-mcp-server) | GTM **container** CRUD/audit via API (OAuth)—complements **page** audits, not a substitute. |

See `cursor-mcp-recommendation.json` for a starter fragment to merge into your MCP config.

## Playwright browser errors (“Executable doesn’t exist”)

The audit API needs **Chrome/Chromium**. By default the app **tries Google Chrome, then Edge, then Playwright’s Chromium** so you are not blocked if the downloaded Chromium path is wrong (common in sandboxes or arch mismatches).

1. **Easiest:** install [Google Chrome](https://www.google.com/chrome/), then add to `.env.local`:
   ```bash
   PLAYWRIGHT_CHROMIUM_CHANNEL=chrome
   ```
2. **Or** download Playwright’s browser: `npm run playwright:install`
3. **If installs land in a bad cache** (e.g. Cursor sandbox): `npm run playwright:install:project` (stores browsers under `node_modules` via `PLAYWRIGHT_BROWSERS_PATH=0`). The repo’s `.env.example` enables both `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` and `PLAYWRIGHT_BROWSERS_PATH=0` for smoother local runs.

Quick check: `node scripts/test-browser.mjs` (after `export $(grep -v '^#' .env.local | xargs)` or with env vars set).

## Limits

- **Single-page snapshot** after a configurable wait; SPAs or tags that fire only after deep interaction may need longer waits or future multi-step flows.
- **Launch-style checks** (e.g. `global-route-view`, `_satellite.track` list, `data-track` on clickables) use one load of the URL you enter. Run again after client-side navigation to validate other routes. Omission lists for specific controls are not read—only a DOM sample is evaluated.
- **Deployment**: Playwright needs a Node host with Chromium (e.g. Docker). Vercel serverless is not suitable without a custom browser layer.

## Stack

Next.js 15 (App Router), Playwright, Tailwind, optional Gemini.

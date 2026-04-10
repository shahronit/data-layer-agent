/**
 * Quick check: Playwright can launch (same env as Next .env.local).
 * Run: node scripts/test-browser.mjs
 */
import { chromium } from "playwright";

const args = ["--disable-dev-shm-usage", "--no-sandbox"];
const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || "chrome";

async function main() {
  try {
    const b = await chromium.launch({ channel, headless: true, args });
    const v = b.version();
    await b.close();
    console.log("OK: launched channel=%s version=%s", channel, v);
    return;
  } catch (e) {
    console.warn("Channel launch failed:", e.message);
  }
  const b2 = await chromium.launch({ headless: true, args });
  console.log("OK: bundled chromium version=%s", b2.version());
  await b2.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

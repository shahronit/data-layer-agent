import { chromium, type Browser } from "playwright";

const LAUNCH_ARGS = ["--disable-dev-shm-usage", "--no-sandbox"] as const;

let browserSingleton: Browser | null = null;

/**
 * Returns true when a headed (visible) browser can be launched.
 * Headed mode requires a display; on Linux servers without an X server
 * (and no DISPLAY env var) or when FORCE_HEADLESS=1 is set, this returns false.
 */
export function isHeadedModeAvailable(): boolean {
  if (process.env.FORCE_HEADLESS === "1") return false;
  if (process.platform === "linux" && !process.env.DISPLAY) return false;
  return true;
}

function buildChannelOrder(): Array<"chrome" | "msedge" | "chrome-beta"> {
  const preferred = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL?.trim().toLowerCase();
  const ordered: Array<"chrome" | "msedge" | "chrome-beta"> = [];
  const push = (c: "chrome" | "msedge" | "chrome-beta") => {
    if (!ordered.includes(c)) ordered.push(c);
  };
  if (preferred === "chrome" || preferred === "msedge" || preferred === "chrome-beta") {
    push(preferred);
  }
  push("chrome");
  push("msedge");
  push("chrome-beta");
  return ordered;
}

/**
 * Prefer system Chrome/Edge so audits work even when Playwright's downloaded
 * Chromium is missing or mismatched (e.g. sandbox cache vs Apple Silicon).
 */
async function launchFreshBrowser(headless = true): Promise<Browser> {
  const args = [...LAUNCH_ARGS];

  const customPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (customPath) {
    return chromium.launch({
      executablePath: customPath,
      headless,
      args,
    });
  }

  let lastError: Error | null = null;
  for (const channel of buildChannelOrder()) {
    try {
      return await chromium.launch({ channel, headless, args });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  try {
    return await chromium.launch({ headless, args });
  } catch (e) {
    const inner = e instanceof Error ? e.message : String(e);
    const channelFail = lastError ? `System browser attempts failed: ${lastError.message}\n` : "";
    const hint = [
      "Could not start a browser. Try one of:",
      "1) Install Google Chrome, then set in .env.local: PLAYWRIGHT_CHROMIUM_CHANNEL=chrome",
      "2) From this folder run: npm run playwright:install",
      "3) If browsers download to a bad cache (Cursor sandbox), run: npm run playwright:install:project",
      "4) Point to a binary: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].join("\n");
    throw new Error(`${channelFail}${inner}\n\n${hint}`);
  }
}

export async function getSharedBrowser(): Promise<Browser> {
  if (browserSingleton?.isConnected()) {
    return browserSingleton;
  }
  browserSingleton = null;
  browserSingleton = await launchFreshBrowser();
  return browserSingleton;
}

/**
 * Launch a standalone headed (visible) browser for interactive login.
 * Falls back to headless when no display is available (server environment).
 * The caller owns the returned Browser and must close it when done.
 */
export async function launchHeadedBrowser(): Promise<Browser> {
  return launchFreshBrowser(!isHeadedModeAvailable());
}

export function resetSharedBrowser(): void {
  void browserSingleton?.close().catch(() => {});
  browserSingleton = null;
}

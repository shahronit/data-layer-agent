/** Product identity — single source for UI, exports, and generated reports. */

export const APP_NAME = "LayerLens";

/** Shown under the logo in the shell */
export const APP_TAGLINE = "Data layer insight";

/** Browser tab / metadata */
export const APP_TITLE = `${APP_NAME} — Site checks for testers`;

export const APP_DESCRIPTION =
  "Capture a page once, review tagging and data-layer findings, export results, or send items to Jira.";

/** Standalone HTML report & model footer */
export const REPORT_PRODUCT_NAME = APP_NAME;

/** npm package name (folder may still be data-layer-agent) */
export const PACKAGE_NAME = "layerlens";

/** Kebab-case prefix for downloaded files */
export const EXPORT_FILE_PREFIX = "layerlens";

export function exportFilename(suffix: string): string {
  const safe = suffix.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${EXPORT_FILE_PREFIX}-${safe}-${Date.now()}`;
}

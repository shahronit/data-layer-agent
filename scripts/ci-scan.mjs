#!/usr/bin/env node

/**
 * CI-friendly scan runner.
 *
 * Usage:
 *   node scripts/ci-scan.mjs --url https://example.com [--schema ga4,adobe] [--max-elements 60] [--min-coverage 50] [--max-failures 5] [--output results.json]
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = validation/coverage thresholds not met
 *   2 = scan error
 */

import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    schema: { type: "string", default: "ga4,adobe" },
    "max-elements": { type: "string", default: "60" },
    "min-coverage": { type: "string", default: "0" },
    "max-failures": { type: "string", default: "999" },
    output: { type: "string" },
    timeout: { type: "string", default: "60000" },
  },
});

if (!values.url) {
  console.error("Usage: node scripts/ci-scan.mjs --url <URL> [options]");
  console.error("Options:");
  console.error("  --schema ga4,adobe      Validation schemas (comma-separated)");
  console.error("  --max-elements 60       Max interactive elements to test");
  console.error("  --min-coverage 50       Minimum coverage % to pass");
  console.error("  --max-failures 5        Max validation failures to pass");
  console.error("  --output results.json   Output file for results");
  console.error("  --timeout 60000         Navigation timeout (ms)");
  process.exit(2);
}

async function main() {
  // Dynamic import to allow the module to resolve @/ paths via Next.js
  const { runCIScan } = await import("../lib/ci/runner.ts");

  const schemas = values.schema.split(",").map((s) => s.trim()).filter(Boolean);

  console.log(`\nLayerLens CI Scan`);
  console.log(`URL: ${values.url}`);
  console.log(`Schemas: ${schemas.join(", ")}`);
  console.log(`Max elements: ${values["max-elements"]}`);
  console.log(`Min coverage: ${values["min-coverage"]}%`);
  console.log(`Max failures: ${values["max-failures"]}`);
  console.log("");

  try {
    const report = await runCIScan({
      url: values.url,
      schemas,
      maxElements: parseInt(values["max-elements"], 10),
      minCoverage: parseInt(values["min-coverage"], 10),
      maxValidationFailures: parseInt(values["max-failures"], 10),
      timeoutMs: parseInt(values.timeout, 10),
    });

    console.log(`\nResults:`);
    console.log(`  Score: ${report.score}`);
    console.log(`  Coverage: ${report.coverage}%`);
    console.log(`  Interactions: ${report.interactions.successful}/${report.interactions.total}`);
    console.log(`  Validation: ${report.validation.pass} pass, ${report.validation.fail} fail, ${report.validation.warn} warn`);
    console.log(`  Status: ${report.passed ? "PASSED" : "FAILED"}`);

    if (report.failReasons.length > 0) {
      console.log(`\nFail reasons:`);
      for (const reason of report.failReasons) {
        console.log(`  - ${reason}`);
      }
    }

    if (values.output) {
      writeFileSync(values.output, JSON.stringify(report, null, 2));
      console.log(`\nResults written to ${values.output}`);
    }

    process.exit(report.passed ? 0 : 1);
  } catch (err) {
    console.error(`\nScan error: ${err.message || err}`);
    process.exit(2);
  }
}

main();

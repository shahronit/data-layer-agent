import { NextResponse } from "next/server";
import {
  isAdobeAnalytics2Configured,
  isAdobeTagsApiConfigured,
  readAdobeIntegrationEnv,
} from "@/lib/adobe-integration-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Describes optional Adobe I/O integration. No secrets returned.
 * @see https://developer.adobe.com/analytics-apis/docs/2.0/guides/reportsuite/
 * @see https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/rules.html
 */
export async function GET() {
  const e = readAdobeIntegrationEnv();
  return NextResponse.json({
    analytics2: { configured: isAdobeAnalytics2Configured(e) },
    tagsReactor: { configured: isAdobeTagsApiConfigured(e) },
    limitations: {
      processingRules:
        "Processing rules are edited in Adobe Analytics Admin. They are not available through Analytics 2.0 REST in the same way as report suite settings; customers often track API parity via Adobe community / release notes.",
      vistaRules:
        "Vista (DB VISTA) rules run on Adobe’s collection servers and are not exposed to this app without internal tooling.",
      hitAcceptance:
        "LayerLens records HTTP status from the browser only. Whether Adobe accepted and processed a hit for reporting is not available via a public validation API for arbitrary URLs.",
      launchRuleCatalog:
        "In-page _satellite does not expose a stable rule catalog. Use this app’s Tags API call (Reactor) with a Property ID, or Experience Platform Debugger.",
    },
    docs: {
      reportSuiteApi: "https://developer.adobe.com/analytics-apis/docs/2.0/guides/reportsuite/",
      tagsRulesApi:
        "https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/rules.html",
      experiencePlatformDebugger:
        "https://experienceleague.adobe.com/docs/debugger/using/experience-cloud-debugger.html",
      processingRulesOverview:
        "https://experienceleague.adobe.com/docs/analytics/admin/admin-tools/manage-report-suites/edit-report-suite/report-suite-general/processing-rules/pr-overview.html",
    },
  });
}

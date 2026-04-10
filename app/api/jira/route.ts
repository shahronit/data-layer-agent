import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { APP_NAME } from "@/lib/brand";
import { plainTextToAdf } from "@/lib/jira-adf";
import { getJiraConfig } from "@/lib/jira-env";

export const dynamic = "force-dynamic";

const createBody = z.object({
  ruleId: z.string(),
  title: z.string().min(1),
  detail: z.string(),
  remediation: z.string(),
  severity: z.string(),
  priority: z.number().int().min(1).max(4),
  pageTitle: z.string().optional(),
  pageUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  capturedAt: z.string(),
});

export async function GET() {
  const cfg = getJiraConfig();
  return NextResponse.json(
    {
      configured: Boolean(cfg),
      projectKey: cfg?.projectKey ?? null,
      issueType: cfg?.issueType ?? null,
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}

export async function POST(req: NextRequest) {
  const cfg = getJiraConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        code: "JIRA_NOT_CONFIGURED",
        message:
          "Jira is not set up. Add JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY to .env.local, then restart the app.",
      },
      { status: 501 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const b = parsed.data;
  const urlLine = b.finalUrl && b.finalUrl !== b.pageUrl ? `Page URL: ${b.finalUrl}\nRequested as: ${b.pageUrl}` : `Page URL: ${b.pageUrl}`;

  const description = `Found with ${APP_NAME} (automated page check — the same kind of snapshot QA teams use with tag tools and browser checks).

${urlLine}
Page title: ${b.pageTitle?.trim() || "(none)"}
When: ${b.capturedAt}

Check: ${b.ruleId}
Rank: P${b.priority} · Impact: ${b.severity}

What we saw
${b.detail}

Suggested fix
${b.remediation}
`;

  const summary = `[${APP_NAME}] P${b.priority} — ${b.title}`.slice(0, 240);

  const body = {
    fields: {
      project: { key: cfg.projectKey },
      summary,
      description: plainTextToAdf(description.slice(0, 30000)),
      issuetype: { name: cfg.issueType },
    },
  };

  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");

  try {
    const res = await fetch(`${cfg.host}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      key?: string;
      id?: string;
      errors?: Record<string, string>;
      errorMessages?: string[];
    };

    if (!res.ok) {
      const msg =
        data.errorMessages?.join("; ") ||
        Object.values(data.errors || {}).join("; ") ||
        `Jira returned ${res.status}`;
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    if (!data.key) {
      return NextResponse.json({ ok: false, error: "Jira did not return an issue key." }, { status: 502 });
    }

    const browseUrl = `${cfg.host}/browse/${data.key}`;
    return NextResponse.json({ ok: true, key: data.key, browseUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jira request failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

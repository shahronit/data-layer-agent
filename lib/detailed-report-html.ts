import { buildDetailedReportModel } from "./detailed-report-model";
import { buildPrioritizedIssues } from "./issues-engine";
import type { AuditReport } from "./types";
import type { DetailedReportModel } from "./detailed-report-model";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status: string): string {
  switch (status) {
    case "pass":
      return "st-pass";
    case "warn":
      return "st-warn";
    case "fail":
      return "st-fail";
    default:
      return "st-info";
  }
}

function sevClass(sev: string): string {
  if (sev === "critical") return "sev-crit";
  if (sev === "high") return "sev-high";
  if (sev === "medium") return "sev-med";
  if (sev === "low") return "sev-low";
  return "sev-info";
}

function buildBody(model: DetailedReportModel, report: AuditReport): string {
  const issues = buildPrioritizedIssues(report);
  const issueRows = issues
    .map(
      (i) => `<tr>
  <td><span class="pri">P${i.priority}</span></td>
  <td><span class="sev ${sevClass(i.severity)}">${esc(i.severity)}</span></td>
  <td><code>${esc(i.ruleId)}</code></td>
  <td>${esc(i.title)}</td>
  <td class="mono pre">${esc(i.detail)}</td>
  <td class="mono pre">${esc(i.remediation)}</td>
</tr>`,
    )
    .join("\n");

  const rows = model.checks
    .map(
      (c) => `<tr>
  <td><code>${esc(c.id)}</code></td>
  <td>${esc(c.name)}</td>
  <td><span class="badge ${statusClass(c.status)}">${esc(c.status)}</span></td>
  <td>${esc(c.detail)}</td>
</tr>`,
    )
    .join("\n");

  const dlRows = model.snapshot.dataLayerRows
    .map(
      (r) => `<tr><td class="mono">${r.index}</td><td class="mono pre">${esc(r.json)}</td></tr>`,
    )
    .join("\n");

  const trackRows = model.snapshot.trackedElements
    .map(
      (t) => `<tr>
  <td>${esc(t.tag)}</td>
  <td class="mono">${esc(t.dataTrack ?? "—")}</td>
  <td class="mono">${esc(t.dataTrackId ?? "—")}</td>
  <td class="mono">${esc(t.dataTrackRemoval ?? "—")}</td>
  <td class="mono">${esc(t.dataProductId ?? "—")}</td>
  <td>${esc(t.textSnippet || "—")}</td>
</tr>`,
    )
    .join("\n");

  const recs = model.summary.recommendations.map((r) => `<li>${esc(r)}</li>`).join("\n");
  const consoleLi = model.snapshot.consoleErrors.map((e) => `<li class="mono pre">${esc(e)}</li>`).join("");
  const pageLi = model.snapshot.pageErrors.map((e) => `<li class="mono pre">${esc(e)}</li>`).join("");

  const issuesBlock =
    issues.length > 0
      ? `<h2>Issues queue (priority &amp; severity)</h2>
    <p class="muted">Ordered P1 (most urgent) → P4. Address in order for fastest risk reduction.</p>
    <table>
      <thead><tr><th>P</th><th>Severity</th><th>Rule</th><th>Title</th><th>Detail</th><th>Remediation</th></tr></thead>
      <tbody>${issueRows}</tbody>
    </table>`
      : `<h2>Issues queue</h2><div class="panel"><p>No open issues—all automated rules passed on this snapshot.</p></div>`;

  return `
    ${issuesBlock}

    <h2>Page context</h2>
    <div class="panel">
      <table>
        <tr><th style="width:200px">Requested URL</th><td class="mono">${esc(model.page.requestedUrl)}</td></tr>
        <tr><th>Resolved URL</th><td class="mono">${esc(model.page.resolvedUrl)}</td></tr>
        <tr><th>Document title</th><td>${esc(model.page.title)}</td></tr>
        <tr><th>Snapshot captured</th><td>${esc(model.page.capturedAtDisplay)}</td></tr>
        <tr><th>Load duration</th><td>${model.page.loadMs} ms (navigation + configured wait)</td></tr>
        ${model.page.pageError ? `<tr><th>Load error</th><td class="st-fail">${esc(model.page.pageError)}</td></tr>` : ""}
      </table>
    </div>

    <h2>Summary</h2>
    <div class="cards">
      <div class="card"><div class="lbl">Health score</div><div class="val">${model.summary.score}</div></div>
      <div class="card"><div class="lbl">Pass</div><div class="val">${model.summary.passCount}</div></div>
      <div class="card"><div class="lbl">Warn</div><div class="val">${model.summary.warnCount}</div></div>
      <div class="card"><div class="lbl">Fail</div><div class="val">${model.summary.failCount}</div></div>
      <div class="card"><div class="lbl">Info</div><div class="val">${model.summary.infoCount}</div></div>
      <div class="card"><div class="lbl">Rules run</div><div class="val">${model.summary.totalChecks}</div></div>
    </div>
    <div class="panel">
      <p class="exec">${esc(model.summary.executiveParagraph)}</p>
      <h3 style="font-size:13px;margin:16px 0 8px;">Follow-ups</h3>
      <ul class="recs">${recs}</ul>
    </div>

    <h2>Automated rule results</h2>
    <table>
      <thead><tr><th>Rule ID</th><th>Name</th><th>Status</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <h2>Snapshot — GTM / dataLayer</h2>
    <div class="panel">
      <p><strong>Entries:</strong> ${model.snapshot.dataLayerLength} &nbsp;|&nbsp; <strong>Inline GTM IDs:</strong> ${model.snapshot.gtmContainerIds.length ? esc(model.snapshot.gtmContainerIds.join(", ")) : "—"}</p>
    </div>
    ${
      model.snapshot.dataLayerLength
        ? `<table><thead><tr><th style="width:60px">#</th><th>Object (JSON)</th></tr></thead><tbody>${dlRows}</tbody></table>`
        : `<div class="panel"><p>No <code>window.dataLayer</code> entries at capture time.</p></div>`
    }

    <h2>Snapshot — digitalData (JSON)</h2>
    <div class="panel mono pre">${esc(model.snapshot.digitalDataJson)}</div>

    <h2>Snapshot — tag command queue</h2>
    <div class="panel">
      <p><code>window._satellite</code> present: <strong>${model.snapshot.adobeSatellitePresent ? "Yes" : "No"}</strong></p>
    </div>

    <h2>Snapshot — data-track inventory</h2>
    <p class="muted">Sampled elements with tracking attributes (capture cap applies).</p>
    ${
      model.snapshot.trackedElements.length
        ? `<table><thead><tr><th>Tag</th><th>data-track</th><th>data-track-id</th><th>data-track-removal</th><th>data-product-id</th><th>Text snippet</th></tr></thead><tbody>${trackRows}</tbody></table>`
        : `<div class="panel"><p>No matching elements in sample.</p></div>`
    }

    <h2>Diagnostics</h2>
    <div class="panel">
      <p><strong>Console errors</strong> (${model.snapshot.consoleErrors.length})</p>
      ${model.snapshot.consoleErrors.length ? `<ul>${consoleLi}</ul>` : "<p>None captured.</p>"}
      <p style="margin-top:16px;"><strong>Uncaught page exceptions</strong> (${model.snapshot.pageErrors.length})</p>
      ${model.snapshot.pageErrors.length ? `<ul>${pageLi}</ul>` : "<p>None captured.</p>"}
    </div>

    <footer>
      Generated ${esc(model.generatedAtIso)} · ${esc(model.toolName)} · Single snapshot; validate hits with your own QA workflow.
    </footer>`;
}

/** Printable / archivable HTML including prioritized issues. */
export function detailedReportToHtml(report: AuditReport): string {
  const model = buildDetailedReportModel(report);
  const body = buildBody(model, report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(model.toolName)} — Verification report</title>
  <style>
    :root { --accent:#6366f1; --accent2:#22d3ee; --border:#e2e8f0; --bg:#f8fafc; --text:#0f172a; --muted:#64748b; }
    * { box-sizing:border-box; }
    body { font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; margin:0; color:var(--text); background:#fff; line-height:1.55; font-size:14px; }
    header { background:linear-gradient(125deg,#0f172a 0%,#312e81 45%,#0e7490 100%); color:#fff; padding:32px 40px; }
    header h1 { margin:0 0 10px; font-size:24px; font-weight:700; letter-spacing:-0.02em; }
    header .sub { opacity:.88; font-size:13px; }
    .wrap { max-width:1120px; margin:0 auto; padding:28px 40px 56px; }
    h2 { font-size:14px; text-transform:uppercase; letter-spacing:.08em; color:var(--accent); border-left:4px solid var(--accent2); padding-left:14px; margin:36px 0 18px; font-weight:700; }
    .muted { color:var(--muted); font-size:13px; margin:0 0 12px; }
    .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; margin:16px 0; }
    .card { background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:14px 16px; }
    .card .lbl { font-size:10px; text-transform:uppercase; color:var(--muted); letter-spacing:.06em; font-weight:600; }
    .card .val { font-size:22px; font-weight:700; margin-top:6px; background:linear-gradient(90deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .panel { border:1px solid var(--border); border-radius:12px; padding:18px 22px; margin:12px 0; background:linear-gradient(180deg,#fafafa 0%,#fff 100%); }
    p.exec { margin:0; color:#334155; }
    table { width:100%; border-collapse:collapse; font-size:13px; margin:12px 0; }
    th, td { border:1px solid var(--border); padding:10px 12px; text-align:left; vertical-align:top; }
    th { background:linear-gradient(180deg,#f1f5f9,#e2e8f0); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#475569; }
    tr:nth-child(even) td { background:#fcfcfd; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
    .pre { white-space:pre-wrap; word-break:break-word; }
    .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    .st-pass { background:#dcfce7; color:#166534; }
    .st-warn { background:#fef9c3; color:#a16207; }
    .st-fail { background:#fee2e2; color:#991b1b; }
    .st-info { background:#e0e7ff; color:#3730a3; }
    .pri { display:inline-block; font-weight:800; color:#4f46e5; font-size:12px; }
    .sev { display:inline-block; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:700; text-transform:uppercase; }
    .sev-crit { background:#fee2e2; color:#991b1b; }
    .sev-high { background:#ffedd5; color:#c2410c; }
    .sev-med { background:#fef9c3; color:#a16207; }
    .sev-low { background:#e0f2fe; color:#0369a1; }
    .sev-info { background:#f1f5f9; color:#475569; }
    ul.recs { margin:8px 0 0 20px; }
    ul.recs li { margin:8px 0; }
    footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--border); font-size:12px; color:var(--muted); }
    @media print { header { break-inside:avoid; } h2 { break-after:avoid; } tr { break-inside:avoid; } }
  </style>
</head>
<body>
  <header>
    <h1>Data layer verification report</h1>
    <div class="sub">${esc(model.toolName)} · ${esc(model.generatedAtDisplay)}</div>
  </header>
  <div class="wrap">
    ${body}
  </div>
</body>
</html>`;
}

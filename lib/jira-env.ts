function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
}

/**
 * Jira Cloud (REST v3). Create an API token at
 * https://id.atlassian.com/manage-profile/security/api-tokens
 */
export function getJiraConfig(): JiraConfig | null {
  const hostRaw = process.env.JIRA_HOST ?? process.env.JIRA_BASE_URL ?? "";
  const email = stripQuotes(process.env.JIRA_EMAIL ?? process.env.ATLASSIAN_EMAIL ?? "");
  const apiToken = stripQuotes(process.env.JIRA_API_TOKEN ?? process.env.ATLASSIAN_API_TOKEN ?? "");
  const projectKey = stripQuotes(process.env.JIRA_PROJECT_KEY ?? "").toUpperCase();
  const issueType = stripQuotes(process.env.JIRA_ISSUE_TYPE ?? "Bug") || "Bug";

  if (!hostRaw || !email || !apiToken || !projectKey) {
    return null;
  }

  let host = stripQuotes(hostRaw).replace(/\/$/, "");
  if (!/^https?:\/\//i.test(host)) {
    host = `https://${host}`;
  }

  return { host, email, apiToken, projectKey, issueType };
}

/**
 * Optional Adobe I/O credentials for server-side calls (Analytics 2.0, Reactor Tags).
 * Create a project in Adobe Developer Console, add Analytics + Experience Platform Launch APIs,
 * complete OAuth (or use a short-lived token) and paste values into env — never commit secrets.
 */

export interface AdobeIntegrationEnv {
  accessToken: string | undefined;
  apiKey: string | undefined;
  imsOrgId: string | undefined;
  analyticsGlobalCompanyId: string | undefined;
  tagsPropertyId: string | undefined;
}

export function readAdobeIntegrationEnv(): AdobeIntegrationEnv {
  return {
    accessToken:
      process.env.ADOBE_ACCESS_TOKEN?.trim() ||
      process.env.ADOBE_IO_ACCESS_TOKEN?.trim(),
    apiKey:
      process.env.ADOBE_API_KEY?.trim() ||
      process.env.ADOBE_IO_CLIENT_ID?.trim(),
    imsOrgId: process.env.ADOBE_IMS_ORG_ID?.trim(),
    analyticsGlobalCompanyId: process.env.ADOBE_ANALYTICS_GLOBAL_COMPANY_ID?.trim(),
    tagsPropertyId: process.env.ADOBE_TAGS_PROPERTY_ID?.trim(),
  };
}

export function isAdobeAnalytics2Configured(e = readAdobeIntegrationEnv()): boolean {
  return Boolean(e.accessToken && e.apiKey && e.analyticsGlobalCompanyId);
}

export function isAdobeTagsApiConfigured(e = readAdobeIntegrationEnv()): boolean {
  return Boolean(e.accessToken && e.apiKey && e.imsOrgId && e.tagsPropertyId);
}

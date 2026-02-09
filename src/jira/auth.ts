import { EnvConfig } from "../config/index.js";

export interface JiraAuthConfig {
  email: string;
  apiToken: string;
  domain: string;
}

export function createAuthConfig(env: EnvConfig): JiraAuthConfig {
  return {
    email: env.JIRA_EMAIL,
    apiToken: env.JIRA_API_TOKEN,
    domain: env.JIRA_DOMAIN,
  };
}

export function getAuthHeader(config: JiraAuthConfig): string {
  const credentials = `${config.email}:${config.apiToken}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
}

export function getBaseUrl(config: JiraAuthConfig): string {
  return `https://${config.domain}/rest/api/3`;
}

import { z } from "zod";

export const EnvSchema = z.object({
  JIRA_EMAIL: z.string().email("JIRA_EMAIL must be a valid email"),
  JIRA_API_TOKEN: z.string().min(1, "JIRA_API_TOKEN is required"),
  JIRA_DOMAIN: z.string().min(1, "JIRA_DOMAIN is required"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

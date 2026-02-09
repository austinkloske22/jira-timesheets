import { z } from "zod";

// Project configuration from environment
export const EnvProjectSchema = z.object({
  code: z.string().optional(), // Optional for non-JIRA entries like "Administration"
  name: z.string(),
  hours: z.number().min(0),
  jiraProjects: z.array(z.string()).optional(),
  isWBSO: z.boolean().optional(),
});

export type EnvProject = z.infer<typeof EnvProjectSchema>;

// Full project config used internally
export interface ProjectConfig {
  code: string;
  name: string;
  hours: number;
  jiraProjects: string[];
  isWBSO: boolean;
  isDefault: boolean;
}

export const TimeSettingsSchema = z.object({
  weeklyHours: z.number().default(40),
  dailyHours: z.number().default(8),
});

export const ActivityWeightsSchema = z.object({
  worklog: z.number().default(10),
  transition: z.number().default(5),
  comment: z.number().default(3),
  update: z.number().default(2),
  assignment: z.number().default(4),
});

export const OutputSettingsSchema = z.object({
  defaultFormat: z.enum(["text", "csv"]).default("text"),
  directory: z.string().default("./output"),
});

export interface Config {
  timeSettings: z.infer<typeof TimeSettingsSchema>;
  projects: ProjectConfig[];
  activityWeights: z.infer<typeof ActivityWeightsSchema>;
  output: z.infer<typeof OutputSettingsSchema>;
}

export type TimeSettings = z.infer<typeof TimeSettingsSchema>;
export type ActivityWeights = z.infer<typeof ActivityWeightsSchema>;
export type OutputSettings = z.infer<typeof OutputSettingsSchema>;

export const EnvSchema = z.object({
  JIRA_EMAIL: z.string().email("JIRA_EMAIL must be a valid email"),
  JIRA_API_TOKEN: z.string().min(1, "JIRA_API_TOKEN is required"),
  JIRA_DOMAIN: z.string().min(1, "JIRA_DOMAIN is required"),
  TIMESHEET_PROJECTS: z.string().min(1, "TIMESHEET_PROJECTS is required"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

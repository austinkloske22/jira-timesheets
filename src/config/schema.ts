import { z } from "zod";

export const DefaultEntrySchema = z.object({
  description: z.string(),
  hoursPerWeek: z.number(),
});

export const ProjectConfigSchema = z.object({
  code: z.string(),
  name: z.string(),
  jiraProjects: z.array(z.string()),
  targetAllocation: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  isWBSO: z.boolean().optional(),
  defaultEntries: z.array(DefaultEntrySchema).optional(),
});

export type DefaultEntry = z.infer<typeof DefaultEntrySchema>;

export const TimeSettingsSchema = z.object({
  weeklyHours: z.number().default(40),
  dailyHours: z.number().default(8),
  workDays: z.array(z.string()).default([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]),
});

export const ActivityWeightsSchema = z.object({
  worklog: z.number().default(10),
  transition: z.number().default(5),
  comment: z.number().default(3),
  update: z.number().default(2),
  assignment: z.number().default(4),
});

export const OutputSettingsSchema = z.object({
  defaultFormat: z.enum(["excel", "csv"]).default("excel"),
  directory: z.string().default("./output"),
  filenameTemplate: z.string().default("timesheet-{year}-W{week}"),
});

export const ConfigSchema = z.object({
  timeSettings: TimeSettingsSchema,
  projects: z.array(ProjectConfigSchema),
  activityWeights: ActivityWeightsSchema,
  output: OutputSettingsSchema,
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type TimeSettings = z.infer<typeof TimeSettingsSchema>;
export type ActivityWeights = z.infer<typeof ActivityWeightsSchema>;
export type OutputSettings = z.infer<typeof OutputSettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export const EnvSchema = z.object({
  JIRA_EMAIL: z.string().email("JIRA_EMAIL must be a valid email"),
  JIRA_API_TOKEN: z.string().min(1, "JIRA_API_TOKEN is required"),
  JIRA_DOMAIN: z.string().min(1, "JIRA_DOMAIN is required"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

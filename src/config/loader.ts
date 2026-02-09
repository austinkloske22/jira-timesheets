import dotenv from "dotenv";
import { z } from "zod";
import {
  Config,
  EnvConfig,
  EnvSchema,
  EnvProjectSchema,
  EnvProject,
  ProjectConfig,
  TimeSettingsSchema,
  ActivityWeightsSchema,
  OutputSettingsSchema,
} from "./schema.js";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadEnv(): EnvConfig {
  // Load .env file
  dotenv.config();

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new ConfigurationError(
      `Invalid environment configuration:\n${errors}\n\nMake sure you have a .env file with JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, and TIMESHEET_PROJECTS`
    );
  }

  return result.data;
}

function parseProjects(projectsJson: string): ProjectConfig[] {
  let parsed: unknown;

  try {
    // Remove surrounding quotes if present (from shell escaping)
    const cleaned = projectsJson.replace(/^'|'$/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new ConfigurationError(
      `Failed to parse TIMESHEET_PROJECTS as JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new ConfigurationError("TIMESHEET_PROJECTS must be a JSON array");
  }

  const projects: ProjectConfig[] = [];
  let totalHours = 0;

  for (let i = 0; i < parsed.length; i++) {
    const result = EnvProjectSchema.safeParse(parsed[i]);

    if (!result.success) {
      const errors = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new ConfigurationError(
        `Invalid project at index ${i}: ${errors}`
      );
    }

    const envProject: EnvProject = result.data;
    totalHours += envProject.hours;

    // Convert to internal ProjectConfig
    const project: ProjectConfig = {
      code: envProject.code || "",
      name: envProject.name,
      hours: envProject.hours,
      jiraProjects: envProject.jiraProjects || [],
      isDefault: envProject.jiraProjects && envProject.jiraProjects.length > 0 ? true : false,
    };

    projects.push(project);
  }

  // Validate total hours
  if (Math.abs(totalHours - 40) > 0.5) {
    throw new ConfigurationError(
      `TIMESHEET_PROJECTS hours must total 40, but got ${totalHours}`
    );
  }

  if (projects.length === 0) {
    throw new ConfigurationError("TIMESHEET_PROJECTS must have at least one project");
  }

  return projects;
}

export function loadConfig(): Config {
  const env = loadEnv();
  const projects = parseProjects(env.TIMESHEET_PROJECTS);

  // Calculate total hours for validation
  const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);

  return {
    timeSettings: TimeSettingsSchema.parse({
      weeklyHours: totalHours,
      dailyHours: 8,
    }),
    projects,
    activityWeights: ActivityWeightsSchema.parse({}),
    output: OutputSettingsSchema.parse({}),
  };
}

export interface FullConfig {
  env: EnvConfig;
  config: Config;
}

export function loadFullConfig(): FullConfig {
  const env = loadEnv();
  const projects = parseProjects(env.TIMESHEET_PROJECTS);
  const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);

  return {
    env,
    config: {
      timeSettings: TimeSettingsSchema.parse({
        weeklyHours: totalHours,
        dailyHours: 8,
      }),
      projects,
      activityWeights: ActivityWeightsSchema.parse({}),
      output: OutputSettingsSchema.parse({}),
    },
  };
}

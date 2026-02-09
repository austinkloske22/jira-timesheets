import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import dotenv from "dotenv";
import { Config, ConfigSchema, EnvConfig, EnvSchema } from "./schema.js";

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
      `Invalid environment configuration:\n${errors}\n\nMake sure you have a .env file with JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN`
    );
  }

  return result.data;
}

export function loadConfig(configPath?: string): Config {
  const defaultPath = resolve(process.cwd(), "config", "config.yaml");
  const filePath = configPath || defaultPath;

  if (!existsSync(filePath)) {
    throw new ConfigurationError(
      `Configuration file not found: ${filePath}\n\nCreate a config/config.yaml file or specify a path with --config`
    );
  }

  const fileContent = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(fileContent);

  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new ConfigurationError(
      `Invalid configuration in ${filePath}:\n${errors}`
    );
  }

  return result.data;
}

export interface FullConfig {
  env: EnvConfig;
  config: Config;
}

export function loadFullConfig(configPath?: string): FullConfig {
  return {
    env: loadEnv(),
    config: loadConfig(configPath),
  };
}

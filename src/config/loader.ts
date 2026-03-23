import dotenv from "dotenv";
import { EnvConfig, EnvSchema } from "./schema.js";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadEnv(): EnvConfig {
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

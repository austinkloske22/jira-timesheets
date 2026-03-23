import { Command } from "commander";
import { loadEnv, ConfigurationError } from "../config/index.js";
import { JiraClient, createAuthConfig, JiraAPIError } from "../jira/index.js";
import {
  getWeekDateRange,
  parseWeekString,
  formatDateRange,
  getISOWeek,
  buildCombinedActivityQuery,
} from "../jira/queries.js";
import { enrichIssues } from "../activity.js";
import { render } from "../output/renderer.js";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("jira-activity")
    .description("Query JIRA activity for a given week")
    .version("2.0.0");

  program
    .command("test-connection")
    .description("Test connection to JIRA")
    .action(async () => {
      try {
        console.log("Testing JIRA connection...\n");

        const env = loadEnv();
        const authConfig = createAuthConfig(env);
        const client = new JiraClient(authConfig);

        const user = await client.testConnection();

        console.log("Successfully connected to JIRA!\n");
        console.log(`  Domain:  ${env.JIRA_DOMAIN}`);
        console.log(`  User:    ${user.displayName}`);
        console.log(`  Email:   ${user.emailAddress}`);
        console.log(`  Account: ${user.accountId}`);
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command("activity", { isDefault: true })
    .description("List JIRA issues you were involved in during a week")
    .option("-w, --week <week>", "ISO week (e.g., 2026-W13)")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .option("--save", "Save output to file")
    .option("-o, --output <dir>", "Output directory", "./output")
    .action(async (options) => {
      try {
        const env = loadEnv();
        const authConfig = createAuthConfig(env);
        const client = new JiraClient(authConfig);

        // Determine date range
        let dateRange;
        if (options.week) {
          dateRange = parseWeekString(options.week);
        } else if (options.start && options.end) {
          dateRange = {
            start: new Date(options.start),
            end: new Date(options.end),
          };
        } else {
          dateRange = getWeekDateRange(-1);
        }

        const weekInfo = getISOWeek(dateRange.start);
        console.log(
          `\nFetching JIRA activity for Week ${weekInfo.week}, ${weekInfo.year}...`
        );
        console.log(`Date range: ${formatDateRange(dateRange)}`);

        // Search for issues
        const jql = buildCombinedActivityQuery(dateRange);
        const issues = await client.searchIssues(jql);

        console.log(
          `Found ${issues.length} issue${issues.length === 1 ? "" : "s"}. Detecting activity types...`
        );

        // Enrich with activity types
        const currentUser = await client.testConnection();
        const enriched = await enrichIssues(
          client,
          issues,
          currentUser,
          dateRange,
          env.JIRA_DOMAIN
        );

        const output = render(enriched, dateRange);

        if (options.save) {
          const outputDir = resolve(process.cwd(), options.output);
          mkdirSync(outputDir, { recursive: true });
          const filename = `activity-${weekInfo.year}-W${String(weekInfo.week).padStart(2, "0")}.txt`;
          const filepath = join(outputDir, filename);
          writeFileSync(filepath, output, "utf-8");
          console.log(`\nSaved to: ${filepath}`);
        } else {
          console.log(output);
        }
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command("config")
    .description("Show current configuration")
    .action(() => {
      try {
        const env = loadEnv();

        console.log("\n--- Configuration ---\n");
        console.log("JIRA Settings:");
        console.log(`  Domain: ${env.JIRA_DOMAIN}`);
        console.log(`  Email:  ${env.JIRA_EMAIL}`);
        console.log(`  Token:  ${"*".repeat(20)}`);
      } catch (error) {
        handleError(error);
      }
    });

  return program;
}

function handleError(error: unknown): void {
  if (error instanceof ConfigurationError) {
    console.error(`\nConfiguration Error:\n${error.message}`);
    process.exit(1);
  }

  if (error instanceof JiraAPIError) {
    console.error(`\nJIRA API Error:\n${error.message}`);
    if (error.statusCode) {
      console.error(`  Status Code: ${error.statusCode}`);
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(`\nError: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error(`\nUnknown error: ${String(error)}`);
  process.exit(1);
}

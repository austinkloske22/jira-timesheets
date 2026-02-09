import { Command } from "commander";
import { loadFullConfig, ConfigurationError } from "../config/index.js";
import { JiraClient, createAuthConfig, JiraAPIError } from "../jira/index.js";
import {
  getWeekDateRange,
  parseWeekString,
  formatDateRange,
  getISOWeek,
} from "../jira/queries.js";
import { TimesheetGenerator } from "../timesheet/generator.js";
import { TextRenderer } from "../output/textRenderer.js";
import { CsvRenderer } from "../output/csvRenderer.js";
import { resolve } from "path";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("jira-timesheet")
    .description("Generate timesheets from JIRA activity")
    .version("1.0.0");

  program
    .command("test-connection")
    .description("Test connection to JIRA")
    .action(async () => {
      try {
        console.log("Testing JIRA connection...\n");

        const { env } = loadFullConfig();
        const authConfig = createAuthConfig(env);
        const client = new JiraClient(authConfig);

        const user = await client.testConnection();

        console.log("✓ Successfully connected to JIRA!\n");
        console.log(`  Domain:  ${env.JIRA_DOMAIN}`);
        console.log(`  User:    ${user.displayName}`);
        console.log(`  Email:   ${user.emailAddress}`);
        console.log(`  Account: ${user.accountId}`);
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command("generate")
    .description("Generate a timesheet for a week")
    .option("-w, --week <week>", "ISO week (e.g., 2026-W03)")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .option("-f, --format <format>", "Output format (text, csv)", "text")
    .option("--save", "Save output to file instead of printing to terminal")
    .option("-o, --output <dir>", "Output directory")
    .option("--dry-run", "Preview without saving")
    .action(async (options) => {
      try {
        const { env, config } = loadFullConfig();
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
          // Default to previous week
          dateRange = getWeekDateRange(-1);
        }

        const weekInfo = getISOWeek(dateRange.start);
        console.log(`\nGenerating timesheet for Week ${weekInfo.week}, ${weekInfo.year}`);
        console.log(`Date range: ${formatDateRange(dateRange)}\n`);

        // Generate timesheet
        const generator = new TimesheetGenerator(client, config, env.JIRA_DOMAIN);
        console.log("Fetching JIRA activity...");
        const timesheet = await generator.generate(dateRange);

        const renderer = new TextRenderer();

        if (options.dryRun || !options.save) {
          // Print to terminal
          console.log("");
          renderer.renderToConsole(timesheet);
          if (options.dryRun) {
            console.log("\n[Dry run mode]");
          }
          return;
        }

        // Save to file
        const outputDir = options.output || resolve(process.cwd(), config.output.directory);
        const format = options.format || "text";

        let filepath: string;
        if (format === "csv") {
          const csvRenderer = new CsvRenderer();
          filepath = csvRenderer.render(timesheet, outputDir);
        } else {
          filepath = renderer.renderToFile(timesheet, outputDir);
        }

        console.log(`\n✓ Timesheet saved to: ${filepath}`);
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command("config")
    .description("Show current configuration")
    .action(() => {
      try {
        const { env, config } = loadFullConfig();

        console.log("\n--- Configuration ---\n");
        console.log("JIRA Settings:");
        console.log(`  Domain: ${env.JIRA_DOMAIN}`);
        console.log(`  Email:  ${env.JIRA_EMAIL}`);
        console.log(`  Token:  ${"*".repeat(20)}`);

        console.log("\nTime Settings:");
        console.log(`  Weekly Hours: ${config.timeSettings.weeklyHours}`);
        console.log(`  Daily Hours:  ${config.timeSettings.dailyHours}`);

        console.log("\nProjects:");
        for (const project of config.projects) {
          const code = project.code || "(no code)";
          console.log(`  ${code} - ${project.name}`);
          console.log(`    Hours: ${project.hours}`);
          if (project.jiraProjects.length > 0) {
            console.log(`    JIRA Projects: ${project.jiraProjects.join(", ")}`);
          }
          if (project.isDefault) {
            console.log(`    (Default project)`);
          }
        }

        console.log("\nOutput Settings:");
        console.log(`  Format:    ${config.output.defaultFormat}`);
        console.log(`  Directory: ${config.output.directory}`);
      } catch (error) {
        handleError(error);
      }
    });

  return program;
}

function handleError(error: unknown): void {
  if (error instanceof ConfigurationError) {
    console.error(`\n✗ Configuration Error:\n${error.message}`);
    process.exit(1);
  }

  if (error instanceof JiraAPIError) {
    console.error(`\n✗ JIRA API Error:\n${error.message}`);
    if (error.statusCode) {
      console.error(`  Status Code: ${error.statusCode}`);
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(`\n✗ Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error(`\n✗ Unknown error: ${String(error)}`);
  process.exit(1);
}

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { Timesheet } from "../timesheet/types.js";
import { DayOfWeek } from "../distribution/distributor.js";

const DAYS: DayOfWeek[] = ["S", "Su", "M", "T", "W", "Th", "F"];

export class TextRenderer {
  renderToString(timesheet: Timesheet): string {
    const lines: string[] = [];

    // Header
    lines.push("═".repeat(90));
    lines.push(`TIMESHEET: ${timesheet.weekLabel}`);
    lines.push(`${timesheet.dateRange}`);
    lines.push("═".repeat(90));
    lines.push("");

    // Column headers
    const dayHeaders = DAYS.map((d) => d.padStart(4)).join(" ");
    lines.push(`${"Project / Description".padEnd(60)} ${dayHeaders}  Total`);
    lines.push("─".repeat(90));

    // Project entries
    for (const project of timesheet.projects) {
      // Project header
      lines.push("");
      lines.push(`${project.code} - ${project.name}`);
      lines.push("─".repeat(90));

      // Line items
      for (const item of project.lineItems) {
        const desc = item.description.length > 55
          ? item.description.substring(0, 52) + "..."
          : item.description;

        const dayValues = DAYS.map((d) => {
          const val = item.hours[d];
          return val > 0 ? val.toFixed(1).padStart(4) : "   -";
        }).join(" ");

        lines.push(`  ${desc.padEnd(58)} ${dayValues} ${item.total.toFixed(1).padStart(5)}`);

        // Add URL on separate line if present
        if (item.url) {
          lines.push(`    └─ ${item.url}`);
        }
      }

      lines.push(`${"  Subtotal:".padEnd(60)} ${"".padStart(35)} ${project.projectTotal.toFixed(1).padStart(5)}`);
    }

    // Footer with totals
    lines.push("");
    lines.push("═".repeat(90));
    const totalDayValues = DAYS.map((d) => {
      const val = timesheet.dailyTotals[d];
      return val.toFixed(1).padStart(4);
    }).join(" ");
    lines.push(`${"TOTAL".padEnd(60)} ${totalDayValues} ${timesheet.grandTotal.toFixed(1).padStart(5)}`);
    lines.push("═".repeat(90));

    return lines.join("\n");
  }

  renderToConsole(timesheet: Timesheet): void {
    console.log(this.renderToString(timesheet));
  }

  renderToFile(timesheet: Timesheet, outputDir: string): string {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const filename = `timesheet-${timesheet.year}-W${String(timesheet.weekNumber).padStart(2, "0")}.txt`;
    const filepath = resolve(outputDir, filename);

    writeFileSync(filepath, this.renderToString(timesheet), "utf-8");

    return filepath;
  }
}

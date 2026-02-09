import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { Timesheet } from "../timesheet/types.js";

export class CsvRenderer {
  render(timesheet: Timesheet, outputDir: string): string {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const lines: string[] = [];

    // Header
    lines.push(
      `"Week","${timesheet.weekLabel}","Date Range","${timesheet.dateRange}"`
    );
    lines.push("");

    // Column headers
    lines.push('"Project","S","Su","M","T","W","Th","F","Total"');

    // Project entries
    for (const project of timesheet.projects) {
      // Project header
      lines.push(`"${project.code} - ${project.name}","","","","","","","",""`);

      // Line items
      for (const item of project.lineItems) {
        const description = `${item.description} - ${item.url}`;
        lines.push(
          `"  ${this.escapeCSV(description)}",` +
            `${item.hours.S || ""},` +
            `${item.hours.Su || ""},` +
            `${item.hours.M || ""},` +
            `${item.hours.T || ""},` +
            `${item.hours.W || ""},` +
            `${item.hours.Th || ""},` +
            `${item.hours.F || ""},` +
            `${item.total}`
        );
      }
    }

    // Total row
    lines.push(
      `"Total",` +
        `${timesheet.dailyTotals.S},` +
        `${timesheet.dailyTotals.Su},` +
        `${timesheet.dailyTotals.M},` +
        `${timesheet.dailyTotals.T},` +
        `${timesheet.dailyTotals.W},` +
        `${timesheet.dailyTotals.Th},` +
        `${timesheet.dailyTotals.F},` +
        `${timesheet.grandTotal}`
    );

    // Generate filename
    const filename = `timesheet-${timesheet.year}-W${String(timesheet.weekNumber).padStart(2, "0")}.csv`;
    const filepath = resolve(outputDir, filename);

    // Write file
    writeFileSync(filepath, lines.join("\n"), "utf-8");

    return filepath;
  }

  private escapeCSV(value: string): string {
    // Escape double quotes by doubling them
    return value.replace(/"/g, '""');
  }
}

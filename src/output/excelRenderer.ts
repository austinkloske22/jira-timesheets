import ExcelJS from "exceljs";
import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import { Timesheet } from "../timesheet/types.js";
import { DayOfWeek } from "../distribution/distributor.js";

const COLUMNS: { key: DayOfWeek | "project" | "total"; header: string; width: number }[] = [
  { key: "project", header: "Project", width: 80 },
  { key: "S", header: "S", width: 8 },
  { key: "Su", header: "Su", width: 8 },
  { key: "M", header: "M", width: 8 },
  { key: "T", header: "T", width: 8 },
  { key: "W", header: "W", width: 8 },
  { key: "Th", header: "Th", width: 8 },
  { key: "F", header: "F", width: 8 },
  { key: "total", header: "Total", width: 10 },
];

export class ExcelRenderer {
  async render(timesheet: Timesheet, outputDir: string): Promise<string> {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "JIRA Timesheet Generator";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Timesheet");

    // Set column widths
    sheet.columns = COLUMNS.map((col) => ({
      key: col.key,
      width: col.width,
    }));

    // Add header row with week info
    const headerRow = sheet.addRow([
      `← ${timesheet.weekLabel} →`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      timesheet.dateRange,
    ]);
    headerRow.font = { bold: true };
    sheet.mergeCells(headerRow.number, 1, headerRow.number, 3);
    sheet.mergeCells(headerRow.number, 9, headerRow.number, 9);

    // Add empty row
    sheet.addRow([]);

    // Add column headers
    const columnHeaderRow = sheet.addRow(COLUMNS.map((col) => col.header));
    columnHeaderRow.font = { bold: true };
    columnHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    columnHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Add project entries
    for (const project of timesheet.projects) {
      // Project header row
      const projectRow = sheet.addRow([
        `${project.code} - ${project.name}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      projectRow.font = { bold: true };
      projectRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E2F3" },
      };

      // Line items
      for (const item of project.lineItems) {
        const description = `    ${item.description} - ${item.url}`;
        const row = sheet.addRow([
          description,
          item.hours.S || "",
          item.hours.Su || "",
          item.hours.M || "",
          item.hours.T || "",
          item.hours.W || "",
          item.hours.Th || "",
          item.hours.F || "",
          item.total,
        ]);

        // Style hours cells
        for (let i = 2; i <= 9; i++) {
          const cell = row.getCell(i);
          cell.alignment = { horizontal: "center" };
          if (cell.value && typeof cell.value === "number") {
            cell.numFmt = "0.0";
          }
        }
      }
    }

    // Add total row
    const totalRow = sheet.addRow([
      "Total",
      timesheet.dailyTotals.S || 0,
      timesheet.dailyTotals.Su || 0,
      timesheet.dailyTotals.M,
      timesheet.dailyTotals.T,
      timesheet.dailyTotals.W,
      timesheet.dailyTotals.Th,
      timesheet.dailyTotals.F,
      timesheet.grandTotal,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Center align all hour cells in total row
    for (let i = 2; i <= 9; i++) {
      totalRow.getCell(i).alignment = { horizontal: "center" };
    }

    // Add borders to all cells
    const lastRow = sheet.lastRow?.number || 1;
    for (let row = 3; row <= lastRow; row++) {
      for (let col = 1; col <= 9; col++) {
        const cell = sheet.getCell(row, col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    // Generate filename
    const filename = `timesheet-${timesheet.year}-W${String(timesheet.weekNumber).padStart(2, "0")}.xlsx`;
    const filepath = resolve(outputDir, filename);

    // Save file
    await workbook.xlsx.writeFile(filepath);

    return filepath;
  }
}

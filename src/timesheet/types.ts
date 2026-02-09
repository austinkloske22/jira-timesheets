import { HoursByDay, TimesheetEntry } from "../distribution/distributor.js";

export interface TimesheetLineItem {
  description: string;
  url: string;
  hours: HoursByDay;
  total: number;
}

export interface TimesheetProject {
  code: string;
  name: string;
  lineItems: TimesheetLineItem[];
  projectTotal: number;
}

export interface Timesheet {
  weekLabel: string;
  dateRange: string;
  startDate: Date;
  endDate: Date;
  year: number;
  weekNumber: number;
  projects: TimesheetProject[];
  dailyTotals: HoursByDay;
  grandTotal: number;
}

export function entriesToTimesheet(
  entries: TimesheetEntry[],
  dailyTotals: HoursByDay,
  grandTotal: number,
  startDate: Date,
  endDate: Date
): Timesheet {
  // Get ISO week info
  const d = new Date(startDate);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  const year = d.getFullYear();

  // Group entries by project
  const projectMap = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const existing = projectMap.get(entry.projectCode) || [];
    existing.push(entry);
    projectMap.set(entry.projectCode, existing);
  }

  // Build project groups
  const projects: TimesheetProject[] = [];
  for (const [code, projectEntries] of projectMap) {
    const firstEntry = projectEntries[0];
    const lineItems: TimesheetLineItem[] = projectEntries.map((e) => ({
      description: e.issueSummary,
      url: e.issueUrl,
      hours: e.hoursByDay,
      total: e.total,
    }));

    const projectTotal = projectEntries.reduce((sum, e) => sum + e.total, 0);

    projects.push({
      code,
      name: firstEntry.projectName,
      lineItems,
      projectTotal,
    });
  }

  // Format date range
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const startStr = startDate.toLocaleDateString("en-US", options);
  const endStr = endDate.toLocaleDateString("en-US", options);

  return {
    weekLabel: `Week ${weekNumber} Period 1, ${year}`,
    dateRange: `${startStr} to ${endStr}`,
    startDate,
    endDate,
    year,
    weekNumber,
    projects,
    dailyTotals,
    grandTotal,
  };
}

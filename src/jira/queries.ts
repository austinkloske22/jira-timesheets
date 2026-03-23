export interface DateRange {
  start: Date;
  end: Date;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function buildAssignedIssuesQuery(dateRange: DateRange): string {
  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);

  return `assignee = currentUser() AND updated >= "${start}" AND updated <= "${end}" ORDER BY updated DESC`;
}

export function buildWorklogQuery(dateRange: DateRange): string {
  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);

  return `worklogAuthor = currentUser() AND worklogDate >= "${start}" AND worklogDate <= "${end}" ORDER BY updated DESC`;
}

export function buildReporterQuery(dateRange: DateRange): string {
  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);

  return `reporter = currentUser() AND updated >= "${start}" AND updated <= "${end}" ORDER BY updated DESC`;
}

export function buildProjectQuery(
  projectKey: string,
  dateRange: DateRange
): string {
  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);

  return `project = "${projectKey}" AND (assignee = currentUser() OR worklogAuthor = currentUser()) AND updated >= "${start}" AND updated <= "${end}" ORDER BY updated DESC`;
}

export function buildCombinedActivityQuery(dateRange: DateRange): string {
  const start = formatDate(dateRange.start);
  const end = formatDate(dateRange.end);

  return `(assignee = currentUser() OR reporter = currentUser() OR worklogAuthor = currentUser() OR watcher = currentUser()) AND updated >= "${start}" AND updated <= "${end}" ORDER BY updated DESC`;
}

export function getWeekDateRange(weekOffset = 0): DateRange {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate the Saturday of the current week (weeks run Sat-Fri)
  // If today is Saturday (6), we're at the start of a new week
  // Otherwise, go back to the previous Saturday
  const saturday = new Date(now);
  const daysToSaturday = currentDay === 6 ? 0 : currentDay + 1;
  saturday.setDate(now.getDate() - daysToSaturday);
  saturday.setHours(0, 0, 0, 0);

  // Apply week offset (negative = previous weeks)
  saturday.setDate(saturday.getDate() + weekOffset * 7);

  // Calculate Friday (end of week)
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  friday.setHours(23, 59, 59, 999);

  return {
    start: saturday,
    end: friday,
  };
}

export function parseWeekString(weekString: string): DateRange {
  // Parse ISO week format: 2026-W03
  const match = weekString.match(/^(\d{4})-W(\d{2})$/);

  if (!match) {
    throw new Error(
      `Invalid week format: ${weekString}. Expected format: YYYY-WNN (e.g., 2026-W03)`
    );
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  if (week < 1 || week > 53) {
    throw new Error(`Invalid week number: ${week}. Must be between 1 and 53.`);
  }

  // Get January 4th of the year (always in week 1 per ISO)
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // Convert Sunday from 0 to 7

  // Calculate the Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day + 1);

  // Calculate the Monday of the requested week
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);

  // Calculate Sunday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday,
    end: sunday,
  };
}

export function formatDateRange(dateRange: DateRange): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  const startStr = dateRange.start.toLocaleDateString("en-US", options);
  const endStr = dateRange.end.toLocaleDateString("en-US", options);

  return `${startStr} to ${endStr}`;
}

export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));

  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return {
    year: d.getFullYear(),
    week: weekNumber,
  };
}

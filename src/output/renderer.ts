import { EnrichedIssue } from "../activity.js";
import { DateRange, getISOWeek, formatDateRange } from "../jira/queries.js";

interface IssueGroup {
  projectKey: string;
  issues: EnrichedIssue[];
}

function groupByProject(issues: EnrichedIssue[]): IssueGroup[] {
  const map = new Map<string, IssueGroup>();

  for (const issue of issues) {
    if (!map.has(issue.projectKey)) {
      map.set(issue.projectKey, { projectKey: issue.projectKey, issues: [] });
    }
    map.get(issue.projectKey)!.issues.push(issue);
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) => a.projectKey.localeCompare(b.projectKey));
  for (const group of groups) {
    group.issues.sort((a, b) => a.key.localeCompare(b.key));
  }

  return groups;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

function pad(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - str.length));
}

export function render(
  issues: EnrichedIssue[],
  dateRange: DateRange
): string {
  const weekInfo = getISOWeek(dateRange.start);
  const dateStr = formatDateRange(dateRange);
  const lines: string[] = [];

  // Header
  const title = `JIRA Activity: Week ${weekInfo.week}, ${weekInfo.year}`;
  lines.push("");
  lines.push(title);
  lines.push(dateStr);
  lines.push("");

  if (issues.length === 0) {
    lines.push("No JIRA activity found for this period.");
    return lines.join("\n");
  }

  // Column widths
  const keyW = 18;
  const summaryW = 48;
  const statusW = 20;
  const activityW = 30;
  const totalW = keyW + summaryW + statusW + activityW + 6; // +6 for separators

  const groups = groupByProject(issues);

  for (const group of groups) {
    // Project header
    lines.push(`  ${group.projectKey}`);
    lines.push("  " + "\u2500".repeat(totalW));

    // Column headers
    lines.push(
      "  " +
        pad("Issue", keyW) +
        "  " +
        pad("Summary", summaryW) +
        "  " +
        pad("Status", statusW) +
        "  " +
        "Activity"
    );
    lines.push("  " + "\u2500".repeat(totalW));

    for (const issue of group.issues) {
      const activity = issue.activityTypes.join(", ");

      lines.push(
        "  " +
          pad(issue.key, keyW) +
          "  " +
          pad(truncate(issue.summary, summaryW), summaryW) +
          "  " +
          pad(issue.status, statusW) +
          "  " +
          activity
      );
      lines.push("  " + " ".repeat(keyW) + "  " + issue.url);
    }

    lines.push("  " + "\u2500".repeat(totalW));
    lines.push("");
  }

  lines.push(
    `  ${issues.length} issue${issues.length === 1 ? "" : "s"} total`
  );
  lines.push("");

  return lines.join("\n");
}

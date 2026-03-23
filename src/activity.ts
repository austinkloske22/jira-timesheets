import { JiraClient, JiraIssue, JiraUser } from "./jira/client.js";
import { DateRange } from "./jira/queries.js";

const DAY_LABELS = ["Su", "M", "Tu", "W", "Th", "F", "Sa"] as const;

export interface EnrichedIssue {
  key: string;
  summary: string;
  status: string;
  projectKey: string;
  url: string;
  activityTypes: string[];
  activeDays: string[];
}

interface ChangelogHistory {
  author?: { accountId: string };
  created?: string;
  items?: Array<{ field: string; fromString?: string; toString?: string }>;
}

export async function enrichIssues(
  client: JiraClient,
  issues: JiraIssue[],
  currentUser: JiraUser,
  dateRange: DateRange,
  domain: string
): Promise<EnrichedIssue[]> {
  const enriched = await Promise.all(
    issues.map((issue) =>
      detectActivities(client, issue, currentUser, dateRange, domain)
    )
  );
  return enriched;
}

async function detectActivities(
  client: JiraClient,
  issue: JiraIssue,
  currentUser: JiraUser,
  dateRange: DateRange,
  domain: string
): Promise<EnrichedIssue> {
  const activities: string[] = [];
  const daySet = new Set<number>(); // day-of-week indices

  // Assignee / Reporter from existing search data (no extra API calls)
  if (issue.fields.assignee?.accountId === currentUser.accountId) {
    activities.push("Assignee");
  }
  if (issue.fields.reporter?.accountId === currentUser.accountId) {
    activities.push("Reporter");
  }

  // Fetch changelog, worklogs, and comments in parallel
  const [changelog, worklogs, comments] = await Promise.all([
    client.getIssueChangelog(issue.key),
    client.getIssueWorklogs(issue.key, dateRange.start, dateRange.end),
    client.getIssueComments(issue.key),
  ]);

  // Check worklogs by user in date range
  const userWorklogs = worklogs.filter(
    (w) => w.author.accountId === currentUser.accountId
  );
  if (userWorklogs.length > 0) {
    activities.push("Worklog");
    for (const w of userWorklogs) {
      daySet.add(new Date(w.started).getDay());
    }
  }

  // Check changelog for status changes by user within date range
  const histories = changelog as ChangelogHistory[];
  for (const history of histories) {
    if (history.author?.accountId !== currentUser.accountId) continue;

    const created = history.created ? new Date(history.created) : null;
    if (created && (created < dateRange.start || created > dateRange.end))
      continue;

    if (created) {
      daySet.add(created.getDay());
    }

    for (const item of history.items || []) {
      if (item.field === "status" && !activities.includes("Status Change")) {
        activities.push("Status Change");
      }
    }
  }

  // Check comments by user within date range
  const userComments = comments.filter((c) => {
    if (c.author?.accountId !== currentUser.accountId) return false;
    const created = new Date(c.created);
    return created >= dateRange.start && created <= dateRange.end;
  });
  if (userComments.length > 0) {
    activities.push("Comment");
    for (const c of userComments) {
      daySet.add(new Date(c.created).getDay());
    }
  }

  // If we got here via watcher but none of the above matched, label it
  if (activities.length === 0) {
    activities.push("Watcher");
  }

  // Convert day indices to labels, ordered M-F (skip weekends unless present)
  const dayOrder = [1, 2, 3, 4, 5, 0, 6]; // M, Tu, W, Th, F, Su, Sa
  const activeDays = dayOrder
    .filter((d) => daySet.has(d))
    .map((d) => DAY_LABELS[d]);

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    projectKey: issue.fields.project.key,
    url: `https://${domain}/browse/${issue.key}`,
    activityTypes: activities,
    activeDays,
  };
}

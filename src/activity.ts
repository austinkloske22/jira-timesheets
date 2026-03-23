import { JiraClient, JiraIssue, JiraUser } from "./jira/client.js";
import { DateRange } from "./jira/queries.js";

export interface EnrichedIssue {
  key: string;
  summary: string;
  status: string;
  projectKey: string;
  url: string;
  activityTypes: string[];
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
  }

  // Check changelog for status changes by user within date range
  const histories = changelog as ChangelogHistory[];
  for (const history of histories) {
    if (history.author?.accountId !== currentUser.accountId) continue;

    const created = history.created ? new Date(history.created) : null;
    if (created && (created < dateRange.start || created > dateRange.end))
      continue;

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
  }

  // If we got here via watcher but none of the above matched, label it
  if (activities.length === 0) {
    activities.push("Watcher");
  }

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    projectKey: issue.fields.project.key,
    url: `https://${domain}/browse/${issue.key}`,
    activityTypes: activities,
  };
}

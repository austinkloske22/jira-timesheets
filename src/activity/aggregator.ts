import { JiraClient, JiraIssue, JiraUser } from "../jira/client.js";
import {
  DateRange,
  buildWorklogQuery,
  buildCombinedActivityQuery,
} from "../jira/queries.js";
import { ActivityWeights, Config } from "../config/index.js";
import { Activity, AggregatedActivity, ActivitySummary } from "./types.js";

export class ActivityAggregator {
  private client: JiraClient;
  private weights: ActivityWeights;
  private domain: string;

  constructor(client: JiraClient, config: Config, domain: string) {
    this.client = client;
    this.weights = config.activityWeights;
    this.domain = domain;
  }

  async collectActivities(dateRange: DateRange): Promise<ActivitySummary> {
    const activities: Activity[] = [];

    // Get current user info for filtering worklogs
    const currentUser = await this.client.testConnection();

    // Query 1: Issues where user is assignee/reporter
    const assignedIssues = await this.client.searchIssues(
      buildCombinedActivityQuery(dateRange)
    );

    // Query 2: Issues with worklogs by user
    const worklogIssues = await this.client.searchIssues(
      buildWorklogQuery(dateRange)
    );

    // Merge unique issues
    const issueMap = new Map<string, JiraIssue>();
    for (const issue of [...assignedIssues, ...worklogIssues]) {
      issueMap.set(issue.key, issue);
    }

    // Process each issue
    for (const issue of issueMap.values()) {
      const issueActivities = await this.processIssue(
        issue,
        dateRange,
        currentUser
      );
      activities.push(...issueActivities);
    }

    // Aggregate activities by issue
    const aggregated = this.aggregateByIssue(activities);

    // Group by project
    const byProject = this.groupByProject(aggregated);

    return {
      dateRange,
      activities: aggregated,
      byProject,
      totalActivityWeight: aggregated.reduce((sum, a) => sum + a.totalWeight, 0),
    };
  }

  private async processIssue(
    issue: JiraIssue,
    dateRange: DateRange,
    currentUser: JiraUser
  ): Promise<Activity[]> {
    const activities: Activity[] = [];
    const issueUrl = this.client.getIssueUrl(issue.key, this.domain);

    // Check if user is assignee (assignment activity)
    if (issue.fields.assignee?.accountId === currentUser.accountId) {
      activities.push({
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        issueUrl,
        projectKey: issue.fields.project.key,
        projectName: issue.fields.project.name,
        type: "assignment",
        date: new Date(issue.fields.updated),
        weight: this.weights.assignment,
      });
    }

    // Get worklogs for this issue
    try {
      const worklogs = await this.client.getIssueWorklogs(
        issue.key,
        dateRange.start,
        dateRange.end
      );

      for (const worklog of worklogs) {
        if (worklog.author.accountId === currentUser.accountId) {
          const worklogDate = new Date(worklog.started);

          // Check if worklog is within date range
          if (worklogDate >= dateRange.start && worklogDate <= dateRange.end) {
            activities.push({
              issueKey: issue.key,
              issueSummary: issue.fields.summary,
              issueUrl,
              projectKey: issue.fields.project.key,
              projectName: issue.fields.project.name,
              type: "worklog",
              date: worklogDate,
              weight: this.weights.worklog,
              details: worklog.timeSpent,
            });
          }
        }
      }
    } catch {
      // Worklogs might not be accessible, continue
    }

    // Add a base activity for recently updated issues
    const updatedDate = new Date(issue.fields.updated);
    if (updatedDate >= dateRange.start && updatedDate <= dateRange.end) {
      // Only add if no other activities exist for this issue
      if (
        activities.filter((a) => a.issueKey === issue.key).length === 0 ||
        activities.every((a) => a.type === "assignment")
      ) {
        activities.push({
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueUrl,
          projectKey: issue.fields.project.key,
          projectName: issue.fields.project.name,
          type: "update",
          date: updatedDate,
          weight: this.weights.update,
        });
      }
    }

    return activities;
  }

  private aggregateByIssue(activities: Activity[]): AggregatedActivity[] {
    const issueMap = new Map<string, AggregatedActivity>();

    for (const activity of activities) {
      const existing = issueMap.get(activity.issueKey);

      if (existing) {
        existing.totalWeight += activity.weight;
        existing.activities.push(activity);

        // Add unique dates
        const dateStr = activity.date.toISOString().split("T")[0];
        const hasDate = existing.activeDates.some(
          (d) => d.toISOString().split("T")[0] === dateStr
        );
        if (!hasDate) {
          existing.activeDates.push(activity.date);
        }
      } else {
        issueMap.set(activity.issueKey, {
          issueKey: activity.issueKey,
          issueSummary: activity.issueSummary,
          issueUrl: activity.issueUrl,
          projectKey: activity.projectKey,
          projectName: activity.projectName,
          totalWeight: activity.weight,
          activeDates: [activity.date],
          activities: [activity],
        });
      }
    }

    // Sort by total weight (most active issues first)
    return Array.from(issueMap.values()).sort(
      (a, b) => b.totalWeight - a.totalWeight
    );
  }

  private groupByProject(
    activities: AggregatedActivity[]
  ): Map<string, AggregatedActivity[]> {
    const projectMap = new Map<string, AggregatedActivity[]>();

    for (const activity of activities) {
      const existing = projectMap.get(activity.projectKey) || [];
      existing.push(activity);
      projectMap.set(activity.projectKey, existing);
    }

    return projectMap;
  }
}

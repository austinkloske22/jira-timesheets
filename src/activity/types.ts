export type ActivityType =
  | "worklog"
  | "transition"
  | "comment"
  | "update"
  | "assignment";

export interface Activity {
  issueKey: string;
  issueSummary: string;
  issueUrl: string;
  projectKey: string;
  projectName: string;
  type: ActivityType;
  date: Date;
  weight: number;
  details?: string;
}

export interface AggregatedActivity {
  issueKey: string;
  issueSummary: string;
  issueUrl: string;
  projectKey: string;
  projectName: string;
  totalWeight: number;
  activeDates: Date[];
  activities: Activity[];
}

export interface ActivitySummary {
  dateRange: {
    start: Date;
    end: Date;
  };
  activities: AggregatedActivity[];
  byProject: Map<string, AggregatedActivity[]>;
  totalActivityWeight: number;
}

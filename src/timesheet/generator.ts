import { JiraClient } from "../jira/client.js";
import { DateRange } from "../jira/queries.js";
import { Config } from "../config/index.js";
import { ActivityAggregator } from "../activity/aggregator.js";
import { ProjectMapper } from "../mapping/projectMapper.js";
import { HourDistributor } from "../distribution/distributor.js";
import { Timesheet, entriesToTimesheet } from "./types.js";

export interface GenerateOptions {
  dryRun?: boolean;
}

export class TimesheetGenerator {
  private client: JiraClient;
  private config: Config;
  private domain: string;

  constructor(client: JiraClient, config: Config, domain: string) {
    this.client = client;
    this.config = config;
    this.domain = domain;
  }

  async generate(dateRange: DateRange, options: GenerateOptions = {}): Promise<Timesheet> {
    // Step 1: Collect activities from JIRA
    const aggregator = new ActivityAggregator(
      this.client,
      this.config,
      this.domain
    );
    const activitySummary = await aggregator.collectActivities(dateRange);

    // Step 2: Map activities to project codes
    const mapper = new ProjectMapper(this.config);
    const mappedActivities = mapper.mapActivities(activitySummary.activities);

    // Step 3: Distribute hours
    const distributor = new HourDistributor(this.config);
    const distribution = distributor.distribute(mappedActivities, dateRange);

    // Step 4: Build timesheet
    const timesheet = entriesToTimesheet(
      distribution.entries,
      distribution.dailyTotals,
      distribution.grandTotal,
      dateRange.start,
      dateRange.end
    );

    return timesheet;
  }
}

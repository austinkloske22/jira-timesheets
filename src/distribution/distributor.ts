import { Config, ProjectConfig } from "../config/index.js";
import { MappedActivity } from "../mapping/projectMapper.js";
import { DateRange } from "../jira/queries.js";

export type DayOfWeek = "S" | "Su" | "M" | "T" | "W" | "Th" | "F";

export interface HoursByDay {
  S: number;
  Su: number;
  M: number;
  T: number;
  W: number;
  Th: number;
  F: number;
}

export interface TimesheetEntry {
  projectCode: string;
  projectName: string;
  issueKey: string;
  issueSummary: string;
  issueUrl: string;
  hoursByDay: HoursByDay;
  total: number;
}

export interface DistributionResult {
  entries: TimesheetEntry[];
  dailyTotals: HoursByDay;
  grandTotal: number;
}

const WEEKDAYS: DayOfWeek[] = ["M", "T", "W", "Th", "F"];
const ALL_DAYS: DayOfWeek[] = ["S", "Su", "M", "T", "W", "Th", "F"];

function createEmptyHours(): HoursByDay {
  return { S: 0, Su: 0, M: 0, T: 0, W: 0, Th: 0, F: 0 };
}

function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ["Su", "M", "T", "W", "Th", "F", "S"];
  return days[date.getDay()];
}

function isWeekday(day: DayOfWeek): boolean {
  return WEEKDAYS.includes(day);
}

export class HourDistributor {
  private config: Config;
  private dailyHours: number;

  constructor(config: Config) {
    this.config = config;
    this.dailyHours = config.timeSettings.dailyHours;
  }

  distribute(
    activities: MappedActivity[],
    dateRange: DateRange
  ): DistributionResult {
    const allEntries: TimesheetEntry[] = [];

    // Process each project from config
    for (const project of this.config.projects) {
      const projectHours = project.hours;

      if (projectHours <= 0) continue;

      // Check if this project has JIRA activity
      if (project.jiraProjects.length > 0) {
        // Find activities matching this project
        const projectActivities = activities.filter(
          (a) => a.projectCode === project.code
        );

        if (projectActivities.length > 0) {
          // Distribute hours to JIRA activities
          const entries = this.distributeToActivities(
            projectActivities,
            projectHours,
            dateRange
          );
          allEntries.push(...entries);
        } else {
          // No JIRA activity - create a generic entry
          const entry = this.createGenericEntry(project, projectHours);
          allEntries.push(entry);
        }
      } else {
        // Non-JIRA project (like Administration) - create direct entry
        const entry = this.createGenericEntry(project, projectHours);
        allEntries.push(entry);
      }
    }

    // Balance daily totals to exactly 8 hours per weekday
    this.balanceDailyHours(allEntries);

    // Recalculate entry totals after balancing
    for (const entry of allEntries) {
      entry.total = Object.values(entry.hoursByDay).reduce((a, b) => a + b, 0);
    }

    // Calculate totals
    const dailyTotals = this.calculateDailyTotals(allEntries);
    const grandTotal = Object.values(dailyTotals).reduce((a, b) => a + b, 0);

    return {
      entries: allEntries,
      dailyTotals,
      grandTotal,
    };
  }

  private createGenericEntry(
    project: ProjectConfig,
    totalHours: number
  ): TimesheetEntry {
    const hoursByDay = this.distributeHoursToDays(totalHours, WEEKDAYS);

    return {
      projectCode: project.code,
      projectName: project.name,
      issueKey: "",
      issueSummary: project.name,
      issueUrl: "",
      hoursByDay,
      total: totalHours,
    };
  }

  private distributeToActivities(
    activities: MappedActivity[],
    totalHours: number,
    dateRange: DateRange
  ): TimesheetEntry[] {
    if (activities.length === 0 || totalHours === 0) {
      return [];
    }

    const entries: TimesheetEntry[] = [];

    // Calculate total weight for proportional distribution
    const totalWeight = activities.reduce((sum, a) => sum + a.totalWeight, 0);

    // Calculate proportional hours (without rounding yet)
    const rawHours: number[] = activities.map((a) => {
      const proportion = a.totalWeight / totalWeight;
      return totalHours * proportion;
    });

    // Round to 0.5 increments
    const roundedHours = rawHours.map((h) => Math.round(h * 2) / 2);

    // Ensure minimum 1 hour per activity (if we have enough total hours)
    if (totalHours >= activities.length) {
      for (let i = 0; i < roundedHours.length; i++) {
        if (roundedHours[i] < 1) {
          roundedHours[i] = 1;
        }
      }
    }

    // Iteratively adjust to exactly match target hours
    let iterations = 0;
    while (iterations < 100) {
      const currentTotal = roundedHours.reduce((a, b) => a + b, 0);
      const diff = totalHours - currentTotal;

      if (Math.abs(diff) < 0.25) break;

      // Sort activities by weight to find which one to adjust
      const sortedIndices = activities
        .map((_, idx) => idx)
        .sort((a, b) => activities[b].totalWeight - activities[a].totalWeight);

      if (diff > 0) {
        // Need to add hours - add to highest weight activity
        for (const idx of sortedIndices) {
          roundedHours[idx] += 0.5;
          break;
        }
      } else {
        // Need to remove hours - remove from highest weight activity that has > 1h
        for (const idx of sortedIndices) {
          if (roundedHours[idx] > 1) {
            roundedHours[idx] -= 0.5;
            break;
          }
        }
      }
      iterations++;
    }

    // Create entries
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const activityHours = roundedHours[i];

      if (activityHours <= 0) continue;

      // Get preferred days based on activity dates
      const preferredDays = this.getPreferredDays(activity, dateRange);

      // Distribute hours to days
      const hoursByDay = this.distributeHoursToDays(activityHours, preferredDays);

      entries.push({
        projectCode: activity.projectCode,
        projectName: activity.timesheetProjectName,
        issueKey: activity.issueKey,
        issueSummary: activity.issueSummary,
        issueUrl: activity.issueUrl,
        hoursByDay,
        total: activityHours,
      });
    }

    return entries;
  }

  private getPreferredDays(
    activity: MappedActivity,
    dateRange: DateRange
  ): DayOfWeek[] {
    const days: DayOfWeek[] = [];

    // Get days where activity occurred
    for (const date of activity.activeDates) {
      if (date >= dateRange.start && date <= dateRange.end) {
        const day = getDayOfWeek(date);
        if (isWeekday(day) && !days.includes(day)) {
          days.push(day);
        }
      }
    }

    // If no specific days, default to spreading across week
    if (days.length === 0) {
      return ["M", "T", "W"];
    }

    return days;
  }

  private distributeHoursToDays(
    totalHours: number,
    preferredDays: DayOfWeek[]
  ): HoursByDay {
    const hours = createEmptyHours();

    if (totalHours <= 0 || preferredDays.length === 0) {
      return hours;
    }

    // Distribute evenly across preferred days, ensuring total is preserved
    let remaining = totalHours;
    for (let i = 0; i < preferredDays.length; i++) {
      const day = preferredDays[i];
      const isLast = i === preferredDays.length - 1;

      if (isLast) {
        // Last day gets all remaining hours
        hours[day] = remaining;
      } else {
        // Distribute roughly evenly
        const share = remaining / (preferredDays.length - i);
        hours[day] = Math.round(share * 2) / 2; // Round to 0.5
        remaining -= hours[day];
      }
    }

    return hours;
  }

  private balanceDailyHours(entries: TimesheetEntry[]): void {
    // Get unique project codes
    const projectCodes = [...new Set(entries.map((e) => e.projectCode))];

    // Balance each weekday to exactly dailyHours
    for (const day of WEEKDAYS) {
      let dayTotal = entries.reduce((sum, e) => sum + e.hoursByDay[day], 0);
      const target = this.dailyHours;

      let iterations = 0;
      while (Math.abs(dayTotal - target) >= 0.5 && iterations < 50) {
        const diff = target - dayTotal;

        // Try to balance by adjusting entries from different projects proportionally
        if (diff > 0) {
          // Need to add hours - cycle through projects
          let added = false;
          for (const projectCode of projectCodes) {
            const projectEntries = entries.filter(
              (e) => e.projectCode === projectCode && (e.hoursByDay[day] > 0 || e.total < 16)
            );
            if (projectEntries.length > 0) {
              const targetEntry = projectEntries[0];
              const addAmount = Math.min(diff / projectCodes.length, 0.5);
              if (addAmount >= 0.5) {
                targetEntry.hoursByDay[day] += 0.5;
                targetEntry.total += 0.5;
                dayTotal += 0.5;
                added = true;
              }
            }
          }
          if (!added) {
            // Fallback: add to any entry
            const candidates = entries.filter((e) => e.hoursByDay[day] > 0 || e.total < 16);
            if (candidates.length > 0) {
              candidates[0].hoursByDay[day] += 0.5;
              candidates[0].total += 0.5;
              dayTotal += 0.5;
            } else {
              break;
            }
          }
        } else {
          // Need to remove hours - cycle through projects
          let removed = false;
          for (const projectCode of projectCodes) {
            const projectEntries = entries
              .filter((e) => e.projectCode === projectCode && e.hoursByDay[day] >= 1)
              .sort((a, b) => b.hoursByDay[day] - a.hoursByDay[day]);
            if (projectEntries.length > 0) {
              projectEntries[0].hoursByDay[day] -= 0.5;
              projectEntries[0].total -= 0.5;
              dayTotal -= 0.5;
              removed = true;
              break;
            }
          }
          if (!removed) break;
        }
        iterations++;
      }
    }
  }

  private calculateDailyTotals(entries: TimesheetEntry[]): HoursByDay {
    const totals = createEmptyHours();

    for (const entry of entries) {
      for (const day of ALL_DAYS) {
        totals[day] += entry.hoursByDay[day];
      }
    }

    return totals;
  }
}

import { Config, ProjectConfig } from "../config/index.js";
import { AggregatedActivity } from "../activity/types.js";

export interface MappedActivity extends AggregatedActivity {
  projectCode: string;
  timesheetProjectName: string;
}

export class ProjectMapper {
  private projects: ProjectConfig[];
  private defaultProject: ProjectConfig | undefined;
  private projectKeyMap: Map<string, ProjectConfig>;

  constructor(config: Config) {
    this.projects = config.projects;
    this.defaultProject = this.projects.find((p) => p.isDefault);
    this.projectKeyMap = new Map();

    // Build lookup map from JIRA project keys to timesheet projects
    for (const project of this.projects) {
      for (const jiraProject of project.jiraProjects) {
        this.projectKeyMap.set(jiraProject.toUpperCase(), project);
      }
    }
  }

  mapActivity(activity: AggregatedActivity): MappedActivity {
    const projectKey = activity.projectKey.toUpperCase();
    const project =
      this.projectKeyMap.get(projectKey) || this.defaultProject;

    if (!project) {
      throw new Error(
        `No project mapping found for JIRA project: ${activity.projectKey}, and no default project configured.`
      );
    }

    return {
      ...activity,
      projectCode: project.code,
      timesheetProjectName: project.name,
    };
  }

  mapActivities(activities: AggregatedActivity[]): MappedActivity[] {
    return activities.map((a) => this.mapActivity(a));
  }

  getProjectByCode(code: string): ProjectConfig | undefined {
    return this.projects.find((p) => p.code === code);
  }

  getAllProjectCodes(): string[] {
    return this.projects.map((p) => p.code);
  }

  getWBSOProject(): ProjectConfig | undefined {
    return this.projects.find((p) => p.isWBSO);
  }
}

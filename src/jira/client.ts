import axios, { AxiosInstance, AxiosError } from "axios";
import { JiraAuthConfig, getAuthHeader, getBaseUrl } from "./auth.js";

export interface JiraUser {
  accountId: string;
  emailAddress: string;
  displayName: string;
  active: boolean;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    project: JiraProject;
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
    status: {
      name: string;
    };
    updated: string;
    created: string;
    labels?: string[];
    components?: Array<{ name: string }>;
  };
}

export interface JiraWorklog {
  id: string;
  author: JiraUser;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  comment?: {
    content?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  created: string;
  updated: string;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total?: number;
  maxResults?: number;
  startAt?: number;
  nextPageToken?: string;
}

export class JiraAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "JiraAPIError";
  }
}

export class JiraClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(authConfig: JiraAuthConfig) {
    this.baseUrl = getBaseUrl(authConfig);
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: getAuthHeader(authConfig),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  async testConnection(): Promise<JiraUser> {
    try {
      const response = await this.client.get<JiraUser>("/myself");
      return response.data;
    } catch (error) {
      throw this.handleError(error, "Failed to connect to JIRA");
    }
  }

  async searchIssues(
    jql: string,
    fields: string[] = [
      "summary",
      "project",
      "assignee",
      "reporter",
      "status",
      "updated",
      "created",
      "labels",
      "components",
    ],
    maxResults = 100
  ): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let nextPageToken: string | undefined = undefined;

    try {
      while (true) {
        const payload: Record<string, unknown> = {
          jql,
          fields,
          maxResults,
        };

        if (nextPageToken) {
          payload.nextPageToken = nextPageToken;
        }

        const response = await this.client.post<JiraSearchResponse>(
          "/search/jql",
          payload
        );

        allIssues.push(...response.data.issues);

        // New API uses nextPageToken for pagination
        nextPageToken = response.data.nextPageToken;
        if (!nextPageToken) {
          break;
        }
      }

      return allIssues;
    } catch (error) {
      throw this.handleError(error, `Failed to search issues with JQL: ${jql}`);
    }
  }

  async getIssueWorklogs(
    issueKey: string,
    startedAfter?: Date,
    startedBefore?: Date
  ): Promise<JiraWorklog[]> {
    try {
      const params: Record<string, string> = {};

      if (startedAfter) {
        params.startedAfter = startedAfter.getTime().toString();
      }
      if (startedBefore) {
        params.startedBefore = startedBefore.getTime().toString();
      }

      const response = await this.client.get<{ worklogs: JiraWorklog[] }>(
        `/issue/${issueKey}/worklog`,
        { params }
      );

      return response.data.worklogs;
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to get worklogs for issue: ${issueKey}`
      );
    }
  }

  async getIssueChangelog(issueKey: string): Promise<unknown[]> {
    try {
      const response = await this.client.get(
        `/issue/${issueKey}?expand=changelog`
      );
      return response.data.changelog?.histories || [];
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to get changelog for issue: ${issueKey}`
      );
    }
  }

  async getIssueComments(issueKey: string): Promise<JiraComment[]> {
    try {
      const response = await this.client.get<{ comments: JiraComment[] }>(
        `/issue/${issueKey}/comment`,
        { params: { maxResults: 100 } }
      );
      return response.data.comments;
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to get comments for issue: ${issueKey}`
      );
    }
  }

  getIssueUrl(issueKey: string, domain: string): string {
    return `https://${domain}/browse/${issueKey}`;
  }

  private handleError(error: unknown, context: string): JiraAPIError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ errorMessages?: string[] }>;
      const status = axiosError.response?.status;
      const messages = axiosError.response?.data?.errorMessages?.join(", ");

      if (status === 401) {
        return new JiraAPIError(
          `${context}: Authentication failed. Check your JIRA_EMAIL and JIRA_API_TOKEN.`,
          status
        );
      }

      if (status === 403) {
        return new JiraAPIError(
          `${context}: Access denied. Check your permissions.`,
          status
        );
      }

      if (status === 404) {
        return new JiraAPIError(`${context}: Resource not found.`, status);
      }

      return new JiraAPIError(
        `${context}: ${messages || axiosError.message}`,
        status,
        axiosError.response?.data
      );
    }

    return new JiraAPIError(`${context}: ${String(error)}`);
  }
}

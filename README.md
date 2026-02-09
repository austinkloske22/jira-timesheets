# JIRA Timesheet Generator

Generate timesheets from JIRA activity for WBSO (Dutch R&D subsidy) compliance reporting.

## Overview

This CLI tool reads your JIRA activity for a specified time period and generates formatted timesheet entries. It's designed to support WBSO reporting requirements where thorough, auditable time tracking documentation is needed.

**Key Features:**
- Fetches JIRA activity (issues, worklogs, assignments) for a user
- Maps JIRA projects to timesheet project codes
- Distributes 40 hours/week across Monday-Friday (8 hrs/day)
- Maintains ~50% split between WBSO and non-WBSO projects
- Outputs clean, formatted text to terminal or file
- **Read-only** - never writes to JIRA

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd jira-timesheets

# Install dependencies
npm install

# Build (optional, for production use)
npm run build
```

## Configuration

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your JIRA credentials:

```bash
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token_here
JIRA_DOMAIN=yourcompany.atlassian.net
```

**Getting a JIRA API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label and copy the token

### 2. Project Configuration

Projects are configured in the `.env` file using the `TIMESHEET_PROJECTS` variable. Each project specifies:
- `code`: Timesheet project code (optional for non-billable items like Administration)
- `name`: Display name for the project
- `hours`: Target hours per week for this project
- `jiraProjects`: Array of JIRA project keys that map to this project (optional)
- `isWBSO`: Mark as WBSO-eligible for R&D tracking (optional)

Example `.env` configuration:

```bash
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token_here
JIRA_DOMAIN=yourcompany.atlassian.net

# Project Configuration - adjust hours as needed each week (must total 40)
TIMESHEET_PROJECTS='[
  {"code":"12291","name":"WBSO 2026 Skipum: 2601 Clean-Core SAP Add-On for Multi-Platform Landscapes","hours":20,"jiraProjects":["COSSCLEAN"],"isWBSO":true},
  {"code":"12241","name":"ShipExec For ECC/EWM - Software Development 2026","hours":18},
  {"name":"Administration","hours":2}
]'
```

**Notes:**
- Hours must total exactly 40
- Projects with `jiraProjects` will have hours distributed across matching JIRA tickets
- Projects without `jiraProjects` create generic timesheet entries
- Adjust hours each week as needed to reflect actual time allocation

## Usage

### Generate Timesheet (Previous Week)

```bash
npm run dev -- generate
```

### Generate for Specific Week

```bash
# ISO week format
npm run dev -- generate --week 2026-W05

# Date range
npm run dev -- generate --start 2026-01-31 --end 2026-02-06
```

### Save to File

```bash
npm run dev -- generate --save
# Creates: output/timesheet-2026-W05.txt
```

### Test JIRA Connection

```bash
npm run dev -- test-connection
```

### View Configuration

```bash
npm run dev -- config
```

## Output Format

```
══════════════════════════════════════════════════════════════════════════════════════════
TIMESHEET: Week 5 Period 1, 2026
January 31, 2026 to February 6, 2026
══════════════════════════════════════════════════════════════════════════════════════════

Project / Description                                           S   Su    M    T    W   Th    F  Total
──────────────────────────────────────────────────────────────────────────────────────────

12291 - WBSO 2026 Skipum: 2601 Clean-Core SAP Add-On for Multi-Platform Landscapes
──────────────────────────────────────────────────────────────────────────────────────────
  ATC Check Errors                                              -    -    -    -  1.5  0.5  2.5   4.5
    └─ https://shipexec.atlassian.net/browse/COSSCLEAN-181
  Add App Tile, Catalog and Authorizations                      -    -    -  4.0    -    -    -   4.0
    └─ https://shipexec.atlassian.net/browse/COSSCLEAN-170
  Subtotal:                                                                                       17.0

12241 - ShipExec For ECC/EWM - Software Development 2026
──────────────────────────────────────────────────────────────────────────────────────────
  Administration                                                -    -  0.5  0.5  1.5  1.0  2.5   6.0
  Clean Core Project Development and Guidance                   -    -  3.5  3.5  3.5  3.5  3.0  17.0
  Subtotal:                                                                                       23.0

══════════════════════════════════════════════════════════════════════════════════════════
TOTAL                                                         0.0  0.0  8.0  8.0  8.0  8.0  8.0  40.0
══════════════════════════════════════════════════════════════════════════════════════════
```

## How It Works

### 1. Activity Collection
The tool queries JIRA for your activity in the specified date range:
- Issues assigned to you
- Issues where you logged work
- Issues you reported or updated

### 2. Project Mapping
Each JIRA ticket is mapped to a timesheet project based on:
- JIRA project key (e.g., `COSSCLEAN` → project code `12291`)
- Default project for unmapped tickets

### 3. Hour Distribution
Hours are distributed to achieve:
- **40 hours/week** total
- **8 hours/day** Monday-Friday (weekends = 0)
- **~50% WBSO** allocation (configurable, ±20% tolerance)
- Proportional distribution based on activity weight

### 4. Default Entries
When no JIRA activity exists for a project (e.g., non-WBSO internal work), the tool uses configured default entries like "Administration" to fill the remaining hours.

## Project Structure

```
jira-timesheets/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli/commands.ts       # CLI commands
│   ├── config/               # Config loading & validation
│   ├── jira/                 # JIRA API client (read-only)
│   ├── activity/             # Activity aggregation
│   ├── mapping/              # Project mapper
│   ├── distribution/         # Hour distribution algorithm
│   ├── timesheet/            # Timesheet generator
│   └── output/               # Text/CSV renderers
├── output/                   # Generated timesheets
├── .env                      # JIRA credentials & project config (not committed)
└── package.json
```

## CLI Reference

```
Usage: jira-timesheet [options] [command]

Commands:
  generate [options]    Generate a timesheet for a week
  test-connection       Test connection to JIRA
  config                Show current configuration
  help [command]        Display help for command

Generate Options:
  -w, --week <week>     ISO week (e.g., 2026-W03)
  --start <date>        Start date (YYYY-MM-DD)
  --end <date>          End date (YYYY-MM-DD)
  -f, --format <format> Output format: text, csv (default: text)
  --save                Save to file instead of terminal
  -o, --output <dir>    Output directory
  --dry-run             Preview without saving
```

## WBSO Compliance Notes

This tool is designed to support WBSO (Wet Bevordering Speur- en Ontwikkelingswerk) reporting:

- **Auditable trail**: Each timesheet entry links to a specific JIRA ticket
- **Detailed descriptions**: Ticket summaries provide context for R&D activities
- **Consistent allocation**: ~50% of time allocated to WBSO-eligible work
- **Weekly format**: Standard 40-hour weeks with daily breakdowns

## License

MIT

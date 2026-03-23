# JIRA Activity

Query your JIRA activity for a given week and get a copy-paste friendly list of issues with links.

## Setup

```bash
npm install
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
3. Copy the token into your `.env`

## Usage

```bash
# List activity for previous week (default)
npm run dev

# Specific ISO week
npm run dev -- --week 2026-W13

# Custom date range
npm run dev -- --start 2026-03-16 --end 2026-03-20

# Plain text output (instead of markdown)
npm run dev -- -f plain

# Save to file
npm run dev -- --save

# Test JIRA connection
npm run dev -- test-connection

# Show config
npm run dev -- config
```

## What It Queries

Issues where you are:
- **Assignee** - assigned to you
- **Reporter** - you created
- **Worklog author** - you logged time
- **Watcher** - you're watching (includes issues you commented on)

All issues updated within the specified date range are included.

## Output

Issues are grouped by JIRA project with links on their own line for easy copying:

```markdown
## JIRA Activity: Week 13, 2026
**March 16, 2026 to March 22, 2026**

### COSSCLEAN

- **COSSCLEAN-181** - ATC Check Errors _(In Progress)_
  https://yourcompany.atlassian.net/browse/COSSCLEAN-181

- **COSSCLEAN-175** - Transport handling fix _(Done)_
  https://yourcompany.atlassian.net/browse/COSSCLEAN-175

**2 issues total**
```

## License

MIT

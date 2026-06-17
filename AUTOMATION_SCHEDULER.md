# ProjectFlow Scheduled Automation

ProjectFlow now includes a local automation runner for SLA breaches, license renewals, asset lifecycle reviews, and maintenance reminders.

## Manual Run

From the project folder:

```powershell
npm.cmd run automation:run
```

Or double-click:

```text
run-automation-scheduler.bat
```

The batch file writes logs to:

```text
logs\automation-run.log
```

## Windows Task Scheduler Setup

1. Open **Task Scheduler**.
2. Choose **Create Basic Task**.
3. Name: `ProjectFlow Automation`.
4. Trigger: **Daily**.
5. Time: choose the morning IT review time, for example `07:00`.
6. Action: **Start a program**.
7. Program/script:

```text
C:\Users\MSHAREEF\Documents\Codex\2026-06-08\system-project-prompt-you-are-a\run-automation-scheduler.bat
```

8. Start in:

```text
C:\Users\MSHAREEF\Documents\Codex\2026-06-08\system-project-prompt-you-are-a
```

9. Finish.

## HTTP Cron Endpoint

For future hosting or external schedulers:

```text
GET /api/automation/scheduled?token=YOUR_AUTOMATION_SECRET
```

Set this in `.env`:

```text
AUTOMATION_SECRET="choose-a-private-automation-token"
```

The endpoint also accepts:

```text
Authorization: Bearer YOUR_AUTOMATION_SECRET
```

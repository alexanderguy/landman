# Monitoring Framework

The monitoring framework allows you to schedule automated property searches and receive notifications when new properties are found or prices change.

## Overview

The monitoring system consists of:

- **Scheduler**: Runs searches on a cron schedule
- **Job Management**: Create, enable, disable, and track monitoring jobs
- **Notifications**: Pluggable notification system (console, file, email, SMS, webhook)
- **Job History**: Track execution history and results

By default, the monitoring framework is **disabled**. You must explicitly create and enable monitoring jobs to use this functionality.

## Quick Start

### 1. Create a Monitoring Job

```bash
landbot monitor create <profile> <schedule> [options]
```

**Arguments:**
- `<profile>`: Name of the search profile to monitor
- `<schedule>`: Cron expression for when to run (see Cron Syntax below)

**Options:**
- `-n, --notifications <channels>`: Comma-separated list of notification channels (default: "console")

**Example:**
```bash
# Run daily at 9am
landbot monitor create montana-only "0 9 * * *"

# Run twice daily (9am and 5pm) with file notifications
landbot monitor create montana-only "0 9,17 * * *" -n console,file
```

### 2. List Monitoring Jobs

```bash
landbot monitor list
```

Shows all monitoring jobs with their ID, profile, schedule, enabled status, last run time, and notification channels.

### 3. Start the Monitoring Daemon

```bash
landbot monitor run [options]
```

**Options:**
- `-l, --log-dir <dir>`: Directory for log files (default: `~/.landbot/logs`)

This command starts the monitoring daemon and runs all enabled jobs according to their schedules. The daemon will continue running until you press Ctrl+C.

**Example:**
```bash
landbot monitor run
```

### 4. Manage Jobs

```bash
# Enable a job
landbot monitor enable <jobId>

# Disable a job
landbot monitor disable <jobId>

# Delete a job
landbot monitor delete <jobId>

# View job run history
landbot monitor history <jobId> [-n <limit>]
```

**Note:** Job IDs are displayed when you list jobs. You only need the first 8 characters.

## Cron Syntax

Cron expressions use the following format:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Common Examples:**

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Every day at 9:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 9,17 * * *` | Daily at 9:00 AM and 5:00 PM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 0 1 * *` | First day of every month at midnight |
| `*/30 * * * *` | Every 30 minutes |

**Cron Expression Helpers:**
- `*` means "every"
- `*/n` means "every n"
- `a,b,c` means "at a, b, and c"
- `a-b` means "from a to b"

## Notification Channels

### Console

Logs notifications to the console (stdout/stderr). Enabled by default.

```bash
landbot monitor create my-profile "0 9 * * *" -n console
```

### File

Writes notifications to a JSON log file. Useful for programmatic processing or long-term archival.

```bash
landbot monitor create my-profile "0 9 * * *" -n file
```

Log files are stored in `~/.landbot/logs/monitoring.log` by default. You can customize the log directory with the `--log-dir` option when running the daemon.

**Log Format:**
Each line is a JSON object with the following structure:

```json
{
  "timestamp": "2026-02-14T12:00:00.000Z",
  "type": "searchComplete",
  "profile": "montana-only",
  "totalProperties": 50,
  "newProperties": 3,
  "priceChanges": 2,
  "duration": 45000
}
```

**Event Types:**
- `newProperties`: New properties found
- `priceChanges`: Price changes detected
- `searchComplete`: Search completed successfully
- `searchError`: Search failed with an error

### Future Notification Channels

The notification system is designed to be extensible. Future implementations could include:

- **Email**: Send digest emails with new properties and price changes
- **SMS**: Text message alerts via Twilio or similar services
- **Webhook**: POST notifications to a custom webhook URL
- **Slack/Discord**: Send messages to chat platforms

## Use Cases

### Daily Morning Digest

Check for new properties every morning at 9am:

```bash
landbot monitor create montana-only "0 9 * * *" -n console,file
landbot monitor run
```

### Frequent Price Monitoring

Check every 4 hours for price changes:

```bash
landbot monitor create montana-only "0 */4 * * *"
landbot monitor run
```

### Weekly Summary

Run once per week on Monday morning:

```bash
landbot monitor create montana-only "0 9 * * 1"
landbot monitor run
```

## Job Run History

View the execution history of a monitoring job:

```bash
landbot monitor history <jobId> [-n <limit>]
```

This shows:
- When the job ran
- Status (running, completed, failed)
- Duration
- Number of new properties found
- Number of price changes detected
- Total properties in results

**Example:**
```bash
landbot monitor history a1b2c3d4 -n 20
```

## Database Schema

Monitoring jobs and run history are stored in two tables:

### monitoring_jobs

Stores job configuration:

- `id`: Unique job identifier
- `profile_name`: Profile to use for search
- `schedule`: Cron expression
- `enabled`: Whether the job is active
- `created_at`, `updated_at`: Timestamps
- `last_run_at`, `next_run_at`: Execution tracking
- `notification_channels`: JSON array of notification channels

### monitoring_job_runs

Stores execution history:

- `id`: Unique run identifier
- `job_id`: Reference to monitoring_jobs
- `started_at`, `completed_at`: Execution timestamps
- `status`: running, completed, or failed
- `error`: Error message (if failed)
- `new_properties`, `price_changes`, `total_properties`: Result counts

## Architecture

The monitoring framework is designed to be:

1. **Inactive by default**: No background processes run unless explicitly started
2. **Transparent**: All actions logged with clear feedback
3. **Extensible**: Plugin-based notification system
4. **Reliable**: Job history and error tracking
5. **Controllable**: Easy enable/disable without deletion

## Troubleshooting

### Daemon won't start

**Check for enabled jobs:**
```bash
landbot monitor list
```

If no jobs are enabled, create one or enable an existing job.

### Job not running

**Verify cron expression:**
Use an online cron expression validator to ensure your schedule is correct.

**Check job status:**
```bash
landbot monitor list
```

Ensure the job shows `✓` in the Enabled column.

### No notifications received

**Verify notification channels:**
```bash
landbot monitor list
```

Check that the Notifications column shows your desired channels.

**Check log files:**
If using file notifications, check `~/.landbot/logs/monitoring.log` for entries.

### View job errors

```bash
landbot monitor history <jobId>
```

Failed runs will show `failed` status with error details.

## Security Considerations

- Log files may contain property URLs and pricing information
- Keep the `~/.landbot` directory secure with appropriate file permissions
- Be mindful of rate limits when scheduling frequent searches
- Consider target site terms of service when setting search intervals

## Best Practices

1. **Start with daily searches**: Use `0 9 * * *` to run once per day
2. **Enable file notifications**: Provides a permanent record of all monitoring events
3. **Monitor job history**: Regularly check `landbot monitor history` to ensure jobs are running successfully
4. **Respect rate limits**: Don't schedule searches more frequently than every 4-6 hours
5. **Use descriptive profile names**: Makes job management easier when running multiple monitoring jobs
6. **Test your schedule**: Create a job with a short interval (e.g., every 5 minutes) to test before switching to your desired schedule

## Advanced Configuration

### Running as a System Service

To run the monitoring daemon as a background service, you can use systemd (Linux), launchd (macOS), or Windows Services.

**Example systemd service (Linux):**

Create `/etc/systemd/system/landbot-monitor.service`:

```ini
[Unit]
Description=Landbot Property Monitoring
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username
ExecStart=/usr/local/bin/bun run /path/to/landbot/src/cli/index.ts monitor run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable landbot-monitor
sudo systemctl start landbot-monitor
```

### Custom Notification Providers

To create a custom notification provider, implement the `NotificationProvider` interface:

```typescript
import type { NotificationProvider, MonitoringEvent } from "./monitoring/types";

export const createCustomProvider = (): NotificationProvider => {
  return {
    name: "custom",
    channel: "webhook", // or other channel type
    enabled: true,
    send: async (event: MonitoringEvent) => {
      // Your custom notification logic here
      console.log("Custom notification:", event);
    },
  };
};
```

Then register it in the scheduler when starting the daemon.

## Limitations

- Current implementation requires the daemon process to be running
- No built-in email or SMS notifications (coming in future releases)
- Cron expressions must be valid according to node-cron syntax
- Jobs are bound to a single profile (can't monitor multiple profiles in one job)

## Future Enhancements

Potential improvements for future versions:

- Email digest formatting with property images and details
- SMS notifications via Twilio integration
- Webhook support for custom integrations
- Advanced filtering for notifications (only notify on properties above certain score)
- Comparative analysis (highlight significant price drops)
- Property alerts (notify when specific properties change)
- Multi-profile jobs (monitor several profiles in one scheduled task)
- Web dashboard for job management

import { Command } from "commander";
import { DatabaseClient } from "../../db/client";
import { ConfigManager } from "../../utils/config";
import { logger } from "../../utils/logger";
import type { Property } from "../../models/property";
import {
  createScheduler,
  createConsoleProvider,
  createFileProvider,
  type NotificationChannel,
} from "../../monitoring";
import { runSearch } from "../../core/search-engine";
import { PropertyRepository } from "../../db/repository";
import { discoverPlugins } from "../../plugins/registry";
import Table from "cli-table3";
import { join } from "path";
import { homedir } from "os";

const configDir = join(homedir(), ".landbot");
const dbPath = join(configDir, "landbot.db");
const configPath = join(configDir, "search-criteria.json");

export const monitorCommand = new Command("monitor")
  .description("Manage scheduled property monitoring")
  .addCommand(
    new Command("create")
      .description("Create a new monitoring job")
      .argument("<profile>", "Profile name to monitor")
      .argument("<schedule>", "Cron schedule (e.g., '0 9 * * *' for daily at 9am)")
      .option(
        "-n, --notifications <channels>",
        "Notification channels (console,file)",
        "console",
      )
      .action(async (profile, schedule, options) => {
        const db = new DatabaseClient(dbPath);
        const config = new ConfigManager(configPath);

        try {
          config.getProfile(profile);
        } catch {
          logger.error(`Profile not found: ${profile}`);
          process.exit(1);
        }

        const channels = options.notifications
          .split(",")
          .map((c: string) => c.trim()) as NotificationChannel[];

        const scheduler = createScheduler({
          db,
          notifications: [],
        });

        const job = await scheduler.createJob(profile, schedule, channels);

        logger.success(
          `Created monitoring job ${job.id} for profile '${profile}'`,
        );
        logger.info(`Schedule: ${schedule}`);
        logger.info(`Notifications: ${channels.join(", ")}`);
      }),
  )
  .addCommand(
    new Command("list")
      .description("List all monitoring jobs")
      .action(async () => {
        const db = new DatabaseClient(dbPath);

        const rows = db.query("SELECT * FROM monitoring_jobs ORDER BY created_at DESC");

        if (rows.length === 0) {
          logger.info("No monitoring jobs found");
          return;
        }

        const table = new Table({
          head: ["ID", "Profile", "Schedule", "Enabled", "Last Run", "Notifications"],
          colWidths: [18, 20, 15, 10, 20, 20],
        });

        for (const row of rows as Record<string, unknown>[]) {
          table.push([
            String(row.id).substring(0, 8),
            row.profile_name,
            row.schedule,
            row.enabled ? "✓" : "✗",
            row.last_run_at ? new Date(row.last_run_at as string).toLocaleString() : "Never",
            JSON.parse((row.notification_channels as string) || "[]").join(", "),
          ]);
        }

        console.log(table.toString());
      }),
  )
  .addCommand(
    new Command("enable")
      .description("Enable a monitoring job")
      .argument("<jobId>", "Job ID (first 8 chars)")
      .action(async (jobId) => {
        const db = new DatabaseClient(dbPath);
        const scheduler = createScheduler({
          db,
          notifications: [],
        });

        await scheduler.enableJob(jobId);
        logger.success(`Enabled monitoring job ${jobId}`);
      }),
  )
  .addCommand(
    new Command("disable")
      .description("Disable a monitoring job")
      .argument("<jobId>", "Job ID (first 8 chars)")
      .action(async (jobId) => {
        const db = new DatabaseClient(dbPath);
        const scheduler = createScheduler({
          db,
          notifications: [],
        });

        await scheduler.disableJob(jobId);
        logger.success(`Disabled monitoring job ${jobId}`);
      }),
  )
  .addCommand(
    new Command("delete")
      .description("Delete a monitoring job")
      .argument("<jobId>", "Job ID (first 8 chars)")
      .action(async (jobId) => {
        const db = new DatabaseClient(dbPath);
        const scheduler = createScheduler({
          db,
          notifications: [],
        });

        await scheduler.deleteJob(jobId);
        logger.success(`Deleted monitoring job ${jobId}`);
      }),
  )
  .addCommand(
    new Command("run")
      .description("Start the monitoring daemon (runs scheduled jobs)")
      .option("-l, --log-dir <dir>", "Directory for log files", join(configDir, "logs"))
      .action(async (options) => {
        const db = new DatabaseClient(dbPath);
        const config = new ConfigManager(configPath);

        await discoverPlugins();

        const notifications = [
          createConsoleProvider(),
          createFileProvider({
            outputDir: options.logDir,
            filename: "monitoring.log",
          }),
        ];

        const scheduler = createScheduler({
          db,
          notifications,
        });

        const jobs = await scheduler.loadJobs();

        if (jobs.length === 0) {
          logger.warn("No enabled monitoring jobs found");
          logger.info("Use 'landbot monitor create' to create a job");
          return;
        }

        logger.info("Starting monitoring daemon...");

        await scheduler.start(async (job) => {
          logger.info(`Executing scheduled search for profile: ${job.profileName}`);

          const profile = config.getProfile(job.profileName);
          const repository = new PropertyRepository(db);

          const lastSearchDateStr = await repository.getLastSearchDate(job.profileName);
          const lastSearchDate = lastSearchDateStr ? new Date(lastSearchDateStr) : null;

          const result = await runSearch({
            repository,
            profile,
          });

          const allProperties = repository.findProperties({});
          const newProperties = lastSearchDate
            ? allProperties.filter((p: Property) => {
                const firstSeen = p.firstSeen ? new Date(p.firstSeen) : null;
                return firstSeen && firstSeen > lastSearchDate;
              })
            : [];

          const sinceDate = lastSearchDate ? lastSearchDate.toISOString() : undefined;
          const priceChanges = repository.getPropertiesWithPriceChanges(sinceDate);

          return {
            totalProperties: result.propertiesFound,
            newProperties: newProperties.length,
            priceChanges: priceChanges.length,
          };
        });

        logger.success("Monitoring daemon started");
        logger.info("Active jobs:");
        for (const job of jobs) {
          logger.info(`  - ${job.profileName}: ${job.schedule}`);
        }
        logger.info("Press Ctrl+C to stop");

        process.on("SIGINT", async () => {
          logger.info("\nShutting down monitoring daemon...");
          await scheduler.stop();
          process.exit(0);
        });
      }),
  )
  .addCommand(
    new Command("history")
      .description("Show job run history")
      .argument("<jobId>", "Job ID (first 8 chars)")
      .option("-n, --limit <n>", "Number of runs to show", "10")
      .action(async (jobId, options) => {
        const db = new DatabaseClient(dbPath);

        const rows = db.query(
          `SELECT * FROM monitoring_job_runs 
           WHERE job_id LIKE ? 
           ORDER BY started_at DESC 
           LIMIT ?`,
          [`${jobId}%`, parseInt(options.limit, 10)],
        );

        if (rows.length === 0) {
          logger.info(`No run history found for job ${jobId}`);
          return;
        }

        const table = new Table({
          head: ["Started", "Status", "Duration", "New", "Changes", "Total"],
          colWidths: [20, 12, 12, 8, 10, 8],
        });

        for (const row of rows as Record<string, unknown>[]) {
          const started = new Date(row.started_at as string);
          const completed = row.completed_at ? new Date(row.completed_at as string) : null;
          const duration = completed
            ? ((completed.getTime() - started.getTime()) / 1000).toFixed(1) + "s"
            : "N/A";

          table.push([
            started.toLocaleString(),
            String(row.status),
            duration,
            String(row.new_properties || 0),
            String(row.price_changes || 0),
            String(row.total_properties || 0),
          ]);
        }

        console.log(table.toString());
      }),
  );

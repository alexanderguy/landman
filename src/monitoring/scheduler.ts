import cron, { type ScheduledTask } from "node-cron";
import type { ScheduledJob, JobRun, MonitoringEvent, NotificationChannel } from "./types";
import type { DatabaseClient } from "../db/client";
import type { NotificationProvider } from "./types";
import { logger } from "../utils/logger";
import { randomBytes } from "crypto";

export type SchedulerConfig = {
  db: DatabaseClient;
  notifications: NotificationProvider[];
};

export type JobHandler = (
  job: ScheduledJob,
) => Promise<{
  totalProperties: number;
  newProperties: number;
  priceChanges: number;
}>;

export const createScheduler = (config: SchedulerConfig) => {
  const activeTasks = new Map<string, ScheduledTask>();

  const loadJobs = async (): Promise<ScheduledJob[]> => {
    const rows = config.db.query(
      "SELECT * FROM monitoring_jobs WHERE enabled = 1",
    );

    return (rows as unknown[]).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        profileName: r.profile_name as string,
        schedule: r.schedule as string,
        enabled: Boolean(r.enabled),
        lastRun: r.last_run_at ? new Date(r.last_run_at as string) : null,
        nextRun: r.next_run_at ? new Date(r.next_run_at as string) : null,
        notifications: JSON.parse((r.notification_channels as string) || "[]") as NotificationChannel[],
      };
    });
  };

  const createJob = async (
    profileName: string,
    schedule: string,
    notificationChannels: NotificationChannel[],
  ): Promise<ScheduledJob> => {
    const id = randomBytes(8).toString("hex");
    const now = new Date().toISOString();

    config.db.execute(
      `INSERT INTO monitoring_jobs (id, profile_name, schedule, enabled, created_at, updated_at, notification_channels)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [id, profileName, schedule, now, now, JSON.stringify(notificationChannels)],
    );

    return {
      id,
      profileName,
      schedule,
      enabled: true,
      lastRun: null,
      nextRun: null,
      notifications: notificationChannels,
    };
  };

  const updateJobSchedule = async (
    jobId: string,
    schedule: string,
  ): Promise<void> => {
    config.db.execute(
      `UPDATE monitoring_jobs SET schedule = ?, updated_at = ? WHERE id = ?`,
      [schedule, new Date().toISOString(), jobId],
    );
  };

  const enableJob = async (jobId: string): Promise<void> => {
    config.db.execute(
      `UPDATE monitoring_jobs SET enabled = 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), jobId],
    );
  };

  const disableJob = async (jobId: string): Promise<void> => {
    config.db.execute(
      `UPDATE monitoring_jobs SET enabled = 0, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), jobId],
    );
  };

  const deleteJob = async (jobId: string): Promise<void> => {
    config.db.execute(`DELETE FROM monitoring_jobs WHERE id = ?`, [jobId]);
  };

  const recordJobRun = async (
    jobId: string,
    result: {
      totalProperties: number;
      newProperties: number;
      priceChanges: number;
    },
  ): Promise<void> => {
    const runId = randomBytes(8).toString("hex");
    const now = new Date().toISOString();

    config.db.execute(
      `INSERT INTO monitoring_job_runs 
       (id, job_id, started_at, completed_at, status, new_properties, price_changes, total_properties)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`,
      [
        runId,
        jobId,
        now,
        now,
        result.newProperties,
        result.priceChanges,
        result.totalProperties,
      ],
    );

    config.db.execute(
      `UPDATE monitoring_jobs SET last_run_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, jobId],
    );
  };

  const recordJobError = async (
    jobId: string,
    error: Error,
  ): Promise<void> => {
    const runId = randomBytes(8).toString("hex");
    const now = new Date().toISOString();

    config.db.execute(
      `INSERT INTO monitoring_job_runs 
       (id, job_id, started_at, completed_at, status, error, new_properties, price_changes, total_properties)
       VALUES (?, ?, ?, ?, 'failed', ?, 0, 0, 0)`,
      [runId, jobId, now, now, error.message],
    );
  };

  const sendNotifications = async (
    job: ScheduledJob,
    event: MonitoringEvent,
  ): Promise<void> => {
    const providers = config.notifications.filter(
      (p) => p.enabled && job.notifications.includes(p.channel),
    );

    await Promise.all(providers.map((p) => p.send(event)));
  };

  const start = async (handler: JobHandler): Promise<void> => {
    const jobs = await loadJobs();

    for (const job of jobs) {
      if (!cron.validate(job.schedule)) {
        logger.warn(
          `Invalid cron schedule for job ${job.id}: ${job.schedule}`,
        );
        continue;
      }

      const task = cron.schedule(job.schedule, async () => {
        logger.info(`Running scheduled job ${job.id} for ${job.profileName}`);

        const startTime = Date.now();

        try {
          const result = await handler(job);
          const duration = Date.now() - startTime;

          await recordJobRun(job.id, result);

          await sendNotifications(job, {
            type: "searchComplete",
            timestamp: new Date(),
            profileName: job.profileName,
            data: {
              totalProperties: result.totalProperties,
              newProperties: result.newProperties,
              priceChanges: result.priceChanges,
              duration,
            },
          });

          logger.success(
            `Completed job ${job.id} - ${result.newProperties} new, ${result.priceChanges} price changes`,
          );
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          await recordJobError(job.id, err);

          await sendNotifications(job, {
            type: "searchError",
            timestamp: new Date(),
            profileName: job.profileName,
            data: {
              error: err.message,
              stack: err.stack,
            },
          });

          logger.error(`Job ${job.id} failed: ${err.message}`);
        }
      });

      task.start();
      activeTasks.set(job.id, task);
      logger.info(`Scheduled job ${job.id} with cron: ${job.schedule}`);
    }

    logger.success(`Started ${jobs.length} scheduled monitoring jobs`);
  };

  const stop = async (): Promise<void> => {
    for (const [jobId, task] of activeTasks.entries()) {
      task.stop();
      logger.info(`Stopped job ${jobId}`);
    }
    activeTasks.clear();
  };

  const getActiveJobs = (): string[] => {
    return Array.from(activeTasks.keys());
  };

  return {
    start,
    stop,
    createJob,
    updateJobSchedule,
    enableJob,
    disableJob,
    deleteJob,
    loadJobs,
    getActiveJobs,
  };
};

import type { Property } from "../models/property";

export type MonitoringEvent = {
  type: "newProperties" | "priceChanges" | "searchComplete" | "searchError";
  timestamp: Date;
  profileName: string;
  data: unknown;
};

export type NewPropertiesEvent = MonitoringEvent & {
  type: "newProperties";
  data: {
    properties: Property[];
    count: number;
  };
};

export type PriceChangesEvent = MonitoringEvent & {
  type: "priceChanges";
  data: {
    changes: Array<{
      property: Property;
      oldPrice: number | null;
      newPrice: number | null;
      change: number;
    }>;
    count: number;
  };
};

export type SearchCompleteEvent = MonitoringEvent & {
  type: "searchComplete";
  data: {
    totalProperties: number;
    newProperties: number;
    priceChanges: number;
    duration: number;
  };
};

export type SearchErrorEvent = MonitoringEvent & {
  type: "searchError";
  data: {
    error: string;
    stack?: string;
  };
};

export type NotificationChannel =
  | "console"
  | "email"
  | "sms"
  | "webhook"
  | "file";

export type NotificationProvider = {
  name: string;
  channel: NotificationChannel;
  enabled: boolean;
  send: (event: MonitoringEvent) => Promise<void>;
};

export type ScheduledJob = {
  id: string;
  profileName: string;
  schedule: string;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  notifications: NotificationChannel[];
};

export type JobRun = {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: "running" | "completed" | "failed";
  error: string | null;
  newProperties: number;
  priceChanges: number;
  totalProperties: number;
};

import type {
  MonitoringEvent,
  NotificationProvider,
  NewPropertiesEvent,
  PriceChangesEvent,
  SearchCompleteEvent,
  SearchErrorEvent,
} from "../types";
import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

export type FileProviderConfig = {
  outputDir: string;
  filename?: string;
};

export const createFileProvider = (
  config: FileProviderConfig,
): NotificationProvider => {
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  const filename = config.filename ?? "monitoring.log";
  const filepath = join(config.outputDir, filename);

  const formatEvent = (event: MonitoringEvent): string => {
    const timestamp = event.timestamp.toISOString();
    const base = {
      timestamp,
      type: event.type,
      profile: event.profileName,
    };

    switch (event.type) {
      case "newProperties": {
        const e = event as NewPropertiesEvent;
        return JSON.stringify({
          ...base,
          count: e.data.count,
          properties: e.data.properties.map((p) => ({
            id: p.id,
            title: p.title,
            url: p.url,
            price: p.price,
            acres: p.acres,
          })),
        });
      }
      case "priceChanges": {
        const e = event as PriceChangesEvent;
        return JSON.stringify({
          ...base,
          count: e.data.count,
          changes: e.data.changes.map((c) => ({
            propertyId: c.property.id,
            title: c.property.title,
            oldPrice: c.oldPrice,
            newPrice: c.newPrice,
            change: c.change,
          })),
        });
      }
      case "searchComplete": {
        const e = event as SearchCompleteEvent;
        return JSON.stringify({
          ...base,
          totalProperties: e.data.totalProperties,
          newProperties: e.data.newProperties,
          priceChanges: e.data.priceChanges,
          duration: e.data.duration,
        });
      }
      case "searchError": {
        const e = event as SearchErrorEvent;
        return JSON.stringify({
          ...base,
          error: e.data.error,
          stack: e.data.stack,
        });
      }
    }
  };

  return {
    name: "file",
    channel: "file",
    enabled: true,
    send: async (event: MonitoringEvent) => {
      const line = formatEvent(event) + "\n";
      appendFileSync(filepath, line, "utf-8");
    },
  };
};

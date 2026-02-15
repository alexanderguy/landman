import type {
  MonitoringEvent,
  NotificationProvider,
  NewPropertiesEvent,
  PriceChangesEvent,
  SearchCompleteEvent,
  SearchErrorEvent,
} from "../types";
import { logger } from "../../utils/logger";

export const createConsoleProvider = (): NotificationProvider => {
  const formatEvent = (event: MonitoringEvent): string => {
    const timestamp = event.timestamp.toISOString();
    const prefix = `[${timestamp}] [${event.profileName}]`;

    switch (event.type) {
      case "newProperties": {
        const e = event as NewPropertiesEvent;
        return `${prefix} Found ${e.data.count} new properties`;
      }
      case "priceChanges": {
        const e = event as PriceChangesEvent;
        return `${prefix} Detected ${e.data.count} price changes`;
      }
      case "searchComplete": {
        const e = event as SearchCompleteEvent;
        const duration = (e.data.duration / 1000).toFixed(1);
        return `${prefix} Search completed in ${duration}s - ${e.data.totalProperties} total, ${e.data.newProperties} new, ${e.data.priceChanges} price changes`;
      }
      case "searchError": {
        const e = event as SearchErrorEvent;
        return `${prefix} Search failed: ${e.data.error}`;
      }
    }
  };

  return {
    name: "console",
    channel: "console",
    enabled: true,
    send: async (event: MonitoringEvent) => {
      const message = formatEvent(event);

      if (event.type === "searchError") {
        logger.error(message);
        const e = event as SearchErrorEvent;
        if (e.data.stack) {
          logger.debug(e.data.stack);
        }
      } else {
        logger.info(message);
      }
    },
  };
};

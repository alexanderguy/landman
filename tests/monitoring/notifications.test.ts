import { test, expect } from "bun:test";
import { createConsoleProvider, createFileProvider } from "../../src/monitoring/notifications";
import type { NewPropertiesEvent, PriceChangesEvent, SearchCompleteEvent, SearchErrorEvent } from "../../src/monitoring/types";
import { mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("console provider formats new properties event", async () => {
  const provider = createConsoleProvider();
  
  const event: NewPropertiesEvent = {
    type: "newProperties",
    timestamp: new Date("2026-02-14T12:00:00Z"),
    profileName: "test-profile",
    data: {
      properties: [],
      count: 5,
    },
  };

  await provider.send(event);
  expect(provider.name).toBe("console");
  expect(provider.channel).toBe("console");
});

test("console provider formats price changes event", async () => {
  const provider = createConsoleProvider();
  
  const event: PriceChangesEvent = {
    type: "priceChanges",
    timestamp: new Date("2026-02-14T12:00:00Z"),
    profileName: "test-profile",
    data: {
      changes: [],
      count: 3,
    },
  };

  await provider.send(event);
  expect(provider.enabled).toBe(true);
});

test("console provider formats search complete event", async () => {
  const provider = createConsoleProvider();
  
  const event: SearchCompleteEvent = {
    type: "searchComplete",
    timestamp: new Date("2026-02-14T12:00:00Z"),
    profileName: "test-profile",
    data: {
      totalProperties: 50,
      newProperties: 5,
      priceChanges: 2,
      duration: 45000,
    },
  };

  await provider.send(event);
  expect(provider.channel).toBe("console");
});

test("console provider formats search error event", async () => {
  const provider = createConsoleProvider();
  
  const event: SearchErrorEvent = {
    type: "searchError",
    timestamp: new Date("2026-02-14T12:00:00Z"),
    profileName: "test-profile",
    data: {
      error: "Something went wrong",
      stack: "Error: Something went wrong\n  at ...",
    },
  };

  await provider.send(event);
  expect(provider.name).toBe("console");
});

test("file provider writes new properties event to file", async () => {
  const testDir = join(tmpdir(), `landbot-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  try {
    const provider = createFileProvider({
      outputDir: testDir,
      filename: "test.log",
    });

    const event: NewPropertiesEvent = {
      type: "newProperties",
      timestamp: new Date("2026-02-14T12:00:00Z"),
      profileName: "test-profile",
      data: {
        properties: [
          {
            id: "test-id-1",
            source: "test",
            source_id: "123",
            url: "https://example.com/1",
            title: "Test Property",
            price: 100000,
            acres: 10,
            firstSeen: "2026-02-14T12:00:00Z",
            lastSeen: "2026-02-14T12:00:00Z",
            lastChecked: "2026-02-14T12:00:00Z",
          },
        ],
        count: 1,
      },
    };

    await provider.send(event);

    const logFile = join(testDir, "test.log");
    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    
    expect(lines.length).toBe(1);
    
    const logged = JSON.parse(lines[0]!);
    expect(logged.type).toBe("newProperties");
    expect(logged.count).toBe(1);
    expect(logged.properties.length).toBe(1);
    expect(logged.properties[0].id).toBe("test-id-1");
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("file provider writes price changes event to file", async () => {
  const testDir = join(tmpdir(), `landbot-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  try {
    const provider = createFileProvider({
      outputDir: testDir,
    });

    const event: PriceChangesEvent = {
      type: "priceChanges",
      timestamp: new Date("2026-02-14T12:00:00Z"),
      profileName: "test-profile",
      data: {
        changes: [
          {
            property: {
              id: "test-id-1",
              source: "test",
              source_id: "123",
              url: "https://example.com/1",
              title: "Test Property",
              firstSeen: "2026-02-14T12:00:00Z",
              lastSeen: "2026-02-14T12:00:00Z",
              lastChecked: "2026-02-14T12:00:00Z",
            },
            oldPrice: 100000,
            newPrice: 95000,
            change: -5000,
          },
        ],
        count: 1,
      },
    };

    await provider.send(event);

    const logFile = join(testDir, "monitoring.log");
    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    
    expect(lines.length).toBe(1);
    
    const logged = JSON.parse(lines[0]!);
    expect(logged.type).toBe("priceChanges");
    expect(logged.count).toBe(1);
    expect(logged.changes[0].change).toBe(-5000);
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("file provider appends multiple events", async () => {
  const testDir = join(tmpdir(), `landbot-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  try {
    const provider = createFileProvider({
      outputDir: testDir,
    });

    const event1: SearchCompleteEvent = {
      type: "searchComplete",
      timestamp: new Date("2026-02-14T12:00:00Z"),
      profileName: "test-profile",
      data: {
        totalProperties: 50,
        newProperties: 5,
        priceChanges: 2,
        duration: 45000,
      },
    };

    const event2: SearchErrorEvent = {
      type: "searchError",
      timestamp: new Date("2026-02-14T13:00:00Z"),
      profileName: "test-profile",
      data: {
        error: "Test error",
      },
    };

    await provider.send(event1);
    await provider.send(event2);

    const logFile = join(testDir, "monitoring.log");
    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    
    expect(lines.length).toBe(2);
    
    const logged1 = JSON.parse(lines[0]!);
    const logged2 = JSON.parse(lines[1]!);
    
    expect(logged1.type).toBe("searchComplete");
    expect(logged2.type).toBe("searchError");
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

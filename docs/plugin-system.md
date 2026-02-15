# Plugin System Architecture

This document describes the plugin system architecture implemented in Phase 2.

## Overview

The plugin system provides a flexible architecture for:
1. Adding new property data sources
2. Implementing deduplication strategies
3. Managing rate limiting and browser automation

## Core Interfaces

### PropertySource

Plugins that scrape property data from external sources implement the `PropertySource` interface:

```typescript
type PropertySource = {
  metadata: PluginMetadata
  search(
    criteria: SearchCriteria,
    callbacks?: SearchCallbacks,
  ): AsyncGenerator<Property, void, unknown>
}
```

**Key Characteristics:**
- Uses async generators to yield properties one at a time
- Normalizes raw data to the `Property` model (plugin responsibility)
- Declares supported filters via metadata
- Reports progress via callbacks

### PluginMetadata

Each property source declares its capabilities:

```typescript
type PluginMetadata = {
  name: string
  displayName: string
  version: string
  description: string
  supportedFilters: SupportedFilters
}

type SupportedFilters = {
  states?: boolean
  priceRange?: boolean
  acreageRange?: boolean
  waterFeatures?: boolean
  structures?: boolean
  terrain?: boolean
  distanceToTown?: boolean
}
```

The `supportedFilters` field tells the search orchestrator which filters can be applied server-side (via the source's search API) vs. which need client-side filtering.

### SearchCallbacks

Progress reporting and error handling:

```typescript
type SearchCallbacks = {
  onProgress?: (message: string) => void
  onError?: (error: Error) => void
  onPropertyFound?: (property: Property) => void
}
```

### DeduplicationPlugin

Plugins that identify duplicate properties across sources:

```typescript
type DeduplicationPlugin = {
  name: string
  findDuplicates(property: Property, candidates: Property[]): Promise<DuplicateMatch[]>
}

type DuplicateMatch = {
  propertyId: string
  confidence: number
}
```

## Plugin Registry

The registry manages plugin discovery and retrieval:

```typescript
registerPropertySource(plugin: PropertySource): void
registerDeduplicationPlugin(plugin: DeduplicationPlugin): void

getPropertySource(name: string): PropertySource | undefined
getAllPropertySources(): PropertySource[]

getDeduplicationPlugin(name: string): DeduplicationPlugin | undefined
getAllDeduplicationPlugins(): DeduplicationPlugin[]

discoverPlugins(): Promise<void>
```

### Auto-Discovery

The `discoverPlugins()` function automatically loads:
- Property source plugins from `src/plugins/sources/`
- Deduplication plugins from `src/plugins/deduplication/`

Plugins export a default object that implements the appropriate interface.

## Utilities

### Rate Limiter

Enforces minimum delays between requests:

```typescript
const limiter = createRateLimiter(1000) // 1 second between requests

await limiter.wait() // Blocks until delay satisfied
limiter.reset() // Clear timing state
```

### Playwright Helpers

Browser automation utilities:

- `launchBrowser(options)` - Start headless or headed browser
- `closeBrowser(session)` - Clean up browser resources
- `navigateWithRetry(page, url, maxRetries)` - Navigate with automatic retries
- `waitForSelector(page, selector, timeoutMs)` - Wait for element
- `extractText(page, selector)` - Extract text content
- `extractAttribute(page, selector, attribute)` - Extract attribute value

## Built-in Deduplication Plugins

### MLS Matcher

Finds exact matches based on MLS numbers:

- Checks `rawData.mlsNumber`, `rawData.mls_number`, `rawData.mls`
- Falls back to regex extraction from description
- Returns confidence: 1.0 (exact match)

### Coordinate Matcher

Finds matches based on geographic proximity:

- Uses Haversine distance formula
- Confidence levels:
  - ≤10m: 1.0 (exact match)
  - ≤50m: 0.9 (very close)
  - ≤100m: 0.7 (close)

## Directory Structure

```
src/
  plugins/
    types.ts                      # Core interfaces
    registry.ts                   # Plugin registration and discovery
    index.ts                      # Barrel export
    sources/                      # PropertySource plugins go here
    deduplication/
      mls-matcher.ts             # MLS-based deduplication
      coordinate-matcher.ts      # Coordinate-based deduplication
  utils/
    rate-limiter.ts              # Rate limiting utility
    playwright-helpers.ts        # Browser automation helpers
```

## Creating a Property Source Plugin

Example skeleton:

```typescript
import type { PropertySource } from "../types"
import type { SearchCriteria } from "../../models/search-criteria"
import type { Property } from "../../models/property"

const mySourcePlugin: PropertySource = {
  metadata: {
    name: "my-source",
    displayName: "My Source",
    version: "1.0.0",
    description: "Scrapes properties from My Source",
    supportedFilters: {
      states: true,
      priceRange: true,
      acreageRange: false,
    },
  },

  async *search(criteria, callbacks) {
    // 1. Translate criteria to source's search format
    // 2. Make paginated requests
    // 3. For each property:
    //    - Normalize to Property model
    //    - Apply local filters for unsupported criteria
    //    - Yield property
    //    - Call callbacks.onPropertyFound()
    // 4. Report progress via callbacks.onProgress()
  },
}

export default mySourcePlugin
```

## Testing

The plugin system includes comprehensive tests:

- `tests/plugins/registry.test.ts` - Registry functionality
- `tests/plugins/deduplication.test.ts` - Deduplication plugins
- `tests/utils/rate-limiter.test.ts` - Rate limiting

Run tests: `bun test tests/plugins/`

## Next Steps

Phase 3 will implement the first concrete property source plugin (LandWatch) to validate this architecture.

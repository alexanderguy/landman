# Implementation

## Technology Stack

### Runtime & Language

- **Bun 1.2+**: JavaScript/TypeScript runtime with built-in SQLite, fast module resolution, and integrated test runner
- **TypeScript 5.3+**: Strict mode enabled for type safety

### Core Dependencies

- **Playwright**: Browser automation for scraping sites with bot protection. Provides headless Chrome/Firefox with realistic user behavior to bypass anti-scraping measures.
- **commander**: CLI framework for parsing arguments and managing commands
- **cli-table3**: Pretty table formatting for terminal output

### Built-in Features (No External Deps)

- **bun:sqlite**: Native SQLite support, no separate driver needed
- **Bun's test runner**: For unit and integration tests
- **Bun's fetch**: Native HTTP client, no axios needed

## Project Structure

```
landbot/
├── src/
│   ├── cli/
│   │   ├── index.ts              # CLI entry point, command dispatcher
│   │   ├── commands/
│   │   │   ├── search.ts         # Execute property search
│   │   │   ├── list.ts           # List saved properties
│   │   │   ├── show.ts           # Show property details
│   │   │   ├── config.ts         # View/edit configuration
│   │   │   └── export.ts         # Export to CSV/JSON
│   │   └── formatters/
│   │       ├── table.ts          # Table output formatter
│   │       ├── detail.ts         # Detailed multi-line formatter
│   │       └── json.ts           # JSON formatter
│   ├── plugins/
│   │   ├── base.ts               # Plugin interfaces and types
│   │   ├── registry.ts           # Plugin discovery and registration
│   │   ├── sources/
│   │   │   ├── landwatch.plugin.ts
│   │   │   ├── landsofamerica.plugin.ts
│   │   │   ├── landsearch.plugin.ts
│   │   │   └── zillow.plugin.ts
│   │   └── utils/
│   │       ├── playwright-helpers.ts   # Shared browser automation utilities
│   │       ├── rate-limiter.ts         # Rate limiting for scraping
│   │       └── selectors.ts            # Common selector patterns
│   ├── db/
│   │   ├── client.ts             # SQLite client wrapper
│   │   ├── schema.sql            # Database schema DDL
│   │   ├── migrations.ts         # Migration runner
│   │   └── repository.ts         # Data access layer
│   ├── models/
│   │   ├── property.ts           # Property type and normalization
│   │   ├── search-criteria.ts    # SearchCriteria type
│   │   └── types.ts              # Shared types
│   ├── filters/
│   │   ├── matcher.ts            # Apply filtering criteria
│   │   ├── scorer.ts             # Calculate property scores
│   │   └── deduplicator.ts       # Cross-source deduplication
│   ├── utils/
│   │   ├── logger.ts             # Logging utility
│   │   ├── config.ts             # Configuration loader
│   │   └── hash.ts               # Hashing for deduplication
│   └── index.ts                  # Main entry point
├── config/
│   └── search-criteria.json      # Default search configuration
├── data/
│   └── landbot.db                # SQLite database (created at runtime)
├── tests/
│   ├── plugins/
│   └── filters/
├── .env.example                  # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
├── bunfig.toml                   # Bun-specific configuration
├── AGENTS.md                     # Session initialization instructions
├── PRODUCT.md                    # Product documentation
├── ARCHITECTURE.md               # Architecture documentation
└── IMPLEMENTATION.md             # This file
```

## Database Schema

Using SQLite via `bun:sqlite`. Schema file: `src/db/schema.sql`

```sql
-- Properties: Current state of each property
CREATE TABLE properties (
  -- Stable identity (hash of source + source_id)
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- Plugin name (e.g., 'landwatch')
  source_id TEXT NOT NULL,           -- ID from source system
  
  -- Required fields (plugins must provide)
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  
  -- Optional core attributes
  description TEXT,
  acres REAL,
  price INTEGER,
  
  -- Location
  state TEXT,
  county TEXT,
  city TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  
  -- Features (JSON for complex types)
  has_water BOOLEAN DEFAULT 0,
  water_types TEXT,                  -- JSON: ["creek", "well", "pond"]
  water_year_round BOOLEAN,
  
  has_structures BOOLEAN DEFAULT 0,
  structure_type TEXT,               -- "house", "cabin", "barn", "raw-land"
  structure_count INTEGER,
  
  utilities TEXT,                    -- JSON: {"power": true, "internet": false}
  distance_to_town_minutes INTEGER,
  terrain_tags TEXT,                 -- JSON: ["forested", "mountain"]
  
  -- Metadata
  images TEXT,                       -- JSON: array of image URLs
  raw_data TEXT,                     -- JSON: original scraped data (for debugging)
  
  -- Calculated fields
  score INTEGER,                     -- Match score (calculated by scoring engine)
  field_completeness INTEGER,        -- Count of non-null fields (for dedup canonical selection)
  
  -- Timestamps
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_checked TEXT NOT NULL,
  
  UNIQUE(source, source_id)
);

CREATE INDEX idx_state ON properties(state);
CREATE INDEX idx_price ON properties(price);
CREATE INDEX idx_acres ON properties(acres);
CREATE INDEX idx_score ON properties(score DESC);
CREATE INDEX idx_last_seen ON properties(last_seen DESC);
CREATE INDEX idx_coordinates ON properties(latitude, longitude);

-- Property snapshots: Historical record of changes
CREATE TABLE property_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  
  -- Snapshot of all fields at this point in time
  url TEXT,
  title TEXT,
  description TEXT,
  acres REAL,
  price INTEGER,
  state TEXT,
  county TEXT,
  city TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  has_water BOOLEAN,
  water_types TEXT,
  water_year_round BOOLEAN,
  has_structures BOOLEAN,
  structure_type TEXT,
  structure_count INTEGER,
  utilities TEXT,
  distance_to_town_minutes INTEGER,
  terrain_tags TEXT,
  images TEXT,
  
  -- Always preserve raw data in snapshots
  raw_data TEXT,
  
  FOREIGN KEY(property_id) REFERENCES properties(id)
);

CREATE INDEX idx_snapshots_property ON property_snapshots(property_id, scraped_at DESC);

-- Cross-source deduplication
CREATE TABLE property_duplicates (
  canonical_id TEXT NOT NULL,       -- Most complete property
  duplicate_id TEXT NOT NULL,       -- Duplicate property
  match_method TEXT NOT NULL,       -- "mls_number", "coordinates", "manual"
  confidence REAL NOT NULL,         -- 0.0-1.0
  detected_at TEXT NOT NULL,
  
  PRIMARY KEY(canonical_id, duplicate_id),
  FOREIGN KEY(canonical_id) REFERENCES properties(id),
  FOREIGN KEY(duplicate_id) REFERENCES properties(id)
);

CREATE INDEX idx_duplicates_canonical ON property_duplicates(canonical_id);

-- Price history tracking
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY(property_id) REFERENCES properties(id)
);

CREATE INDEX idx_price_history_property ON price_history(property_id, recorded_at DESC);

-- Search run tracking
CREATE TABLE search_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  properties_found INTEGER,
  sources_used TEXT,                 -- JSON: ["landwatch", "zillow"]
  filters_applied TEXT,              -- JSON: which filters each source supported
  criteria_snapshot TEXT,            -- JSON: SearchCriteria
  errors TEXT,                       -- JSON: any errors encountered
  
  FOREIGN KEY(profile_name) REFERENCES profiles(name)
);

CREATE INDEX idx_search_runs_profile ON search_runs(profile_name);
CREATE INDEX idx_search_runs_completed ON search_runs(completed_at DESC);
```

## Configuration Format

File: `config/search-criteria.json`

Profile-based structure supporting multiple search scenarios:

```json
{
  "profiles": {
    "default": {
      "name": "Comprehensive Mountain West Search",
      "description": "Search all target states with full criteria",
      "criteria": {
        "minAcres": 20,
        "maxAcres": 640,
        "states": ["ID", "MT", "WY", "SD", "WA"],
        "priceRange": {
          "default": { "min": 100000, "max": 1500000 },
          "byRegion": {
            "ID": { "max": 800000 },
            "MT": { "max": 1200000 },
            "WY": { "max": 1000000 },
            "SD": { "max": 600000 },
            "WA": { "max": 1500000 }
          }
        },
        "distanceToTown": {
          "min": 30,
          "max": 60,
          "unit": "minutes"
        },
        "waterPreferences": [
          { "type": "year-round-water", "weight": 50 },
          { "type": "pond-lake", "weight": 30 },
          { "type": "well", "weight": 30 },
          { "type": "any-water", "weight": 20 }
        ],
        "structurePreference": "raw-land",
        "terrain": ["forested", "mountain", "green"],
        "utilityWeights": {
          "power": 10,
          "water": 10,
          "internet": 5
        }
      },
      "plugins": {
        "landwatch": { "enabled": true, "priority": 1 },
        "landsofamerica": { "enabled": true, "priority": 2 },
        "landsearch": { "enabled": true, "priority": 3 },
        "zillow": { "enabled": true, "priority": 4 }
      }
    },
    "montana-only": {
      "name": "Montana Focus",
      "description": "Montana properties only with relaxed distance requirements",
      "criteria": {
        "minAcres": 20,
        "states": ["MT"],
        "priceRange": {
          "default": { "max": 1200000 }
        },
        "distanceToTown": {
          "min": 20,
          "max": 90,
          "unit": "minutes"
        },
        "waterPreferences": [
          { "type": "year-round-water", "weight": 50 }
        ],
        "terrain": ["mountain"]
      },
      "plugins": {
        "landwatch": { "enabled": true, "priority": 1 }
      }
    },
    "budget-friendly": {
      "name": "Budget Properties",
      "description": "Lower price point across all states",
      "criteria": {
        "minAcres": 20,
        "states": ["ID", "MT", "WY", "SD"],
        "priceRange": {
          "default": { "min": 100000, "max": 500000 }
        },
        "waterPreferences": [
          { "type": "any-water", "weight": 30 }
        ]
      },
      "plugins": {
        "landwatch": { "enabled": true, "priority": 1 },
        "landsofamerica": { "enabled": true, "priority": 2 }
      }
    }
  },
  "activeProfile": "default",
  "scraping": {
    "defaultRateLimitMs": 5000,
    "headless": true,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  }
}
```

## Plugin Interface

File: `src/plugins/base.ts`

Plugins yield normalized Property objects (not raw data):

```typescript
export interface PropertySource {
  name: string
  enabled: boolean
  metadata: PluginMetadata
  
  // Yields normalized Property objects via async generator
  search(
    criteria: SearchCriteria,
    callbacks?: SearchCallbacks
  ): AsyncGenerator<Property>
  
  healthCheck(): Promise<boolean>
}

export type PluginMetadata = {
  description: string
  
  // What filters can this site search by?
  supportedFilters: {
    states: boolean              // Can filter by state list?
    minAcres: boolean            // Can filter by minimum acreage?
    maxAcres: boolean            // Can filter by maximum acreage?
    minPrice: boolean            // Can filter by minimum price?
    maxPrice: boolean            // Can filter by maximum price?
    waterFeatures: boolean       // Can filter by water presence?
    distanceToTown: boolean      // Can filter by distance to town?
    terrain: boolean             // Can filter by terrain type?
    structureType: boolean       // Can filter by structure presence/type?
  }
  
  rateLimit?: {
    requestsPerMinute: number
  }
}

export interface SearchCallbacks {
  onProgress?: (update: ProgressUpdate) => void
  onError?: (error: Error, recoverable: boolean) => void
}

export type ProgressUpdate = {
  source: string
  message: string              // Human-readable status
  currentPage?: number
  totalPages?: number          // undefined if unknown
  propertiesFound: number
}

// Property model: normalized representation
export type Property = {
  // ===== REQUIRED FIELDS =====
  id: string                    // hash(source + source_id)
  source: string                // e.g., "landwatch"
  source_id: string             // Site's internal ID
  url: string
  title: string                 // Use "Untitled Property" if missing
  
  // ===== OPTIONAL CORE ATTRIBUTES =====
  description?: string
  acres?: number
  price?: number
  
  // Location
  state?: string
  county?: string
  city?: string
  address?: string
  coordinates?: {
    latitude: number
    longitude: number
  }
  
  // ===== OPTIONAL FEATURES =====
  waterFeatures?: {
    hasWater: boolean
    types?: string[]            // ["creek", "pond", "well"]
    yearRound?: boolean
  }
  
  structures?: {
    hasStructures: boolean
    type?: string              // "house", "cabin", "barn", "raw-land"
    count?: number
  }
  
  utilities?: {
    power?: boolean
    water?: boolean
    sewer?: boolean
    internet?: boolean
    gas?: boolean
  }
  
  distanceToTownMinutes?: number
  terrainTags?: string[]       // ["forested", "mountain"]
  
  // ===== METADATA =====
  images?: string[]
  rawData?: unknown            // Preserve for debugging
  
  // ===== CALCULATED FIELDS =====
  // NOT provided by plugins - added by system
  score?: number               // Added by scoring engine
  fieldCompleteness?: number   // Added by repository
  
  // ===== TIMESTAMPS =====
  // Added by repository on save
  firstSeen?: string
  lastSeen?: string
  lastChecked?: string
}

export type SearchCriteria = {
  // Hard constraints
  minAcres: number
  maxAcres?: number
  states: string[]             // ["ID", "MT"]
  
  priceRange: {
    default: {
      min?: number
      max?: number
    }
    byRegion?: Record<string, {
      min?: number
      max?: number
    }>
  }
  
  distanceToTown?: {
    min: number
    max: number
    unit: "minutes"
  }
  
  // Weighted preferences (for scoring)
  waterPreferences?: Array<{
    type: "year-round-water" | "pond-lake" | "well" | "creek" | "any-water"
    weight: number
  }>
  
  structurePreference?: "raw-land" | "with-cabin" | "with-house" | "any"
  
  terrain?: string[]           // ["forested", "mountain"]
  
  utilityWeights?: {
    power?: number
    water?: number
    internet?: number
    sewer?: number
  }
}
```

## Plugin Implementation Pattern

### Example: LandWatch Plugin

Shows criteria translation, normalization, and local filtering:

```typescript
class LandWatchPlugin implements PropertySource {
  name = 'landwatch'
  enabled = true
  
  metadata: PluginMetadata = {
    description: 'LandWatch rural property listings',
    supportedFilters: {
      states: true,           // ✅ Site supports state filter
      minAcres: true,         // ✅ Site supports acreage range
      maxAcres: true,
      minPrice: true,         // ✅ Site supports price filter
      maxPrice: true,
      waterFeatures: false,   // ❌ Site doesn't filter by water
      distanceToTown: false,  // ❌ Site doesn't filter by distance
      terrain: false,         // ❌ Site doesn't filter by terrain
      structureType: true,    // ✅ Site has land type filter
    },
    rateLimit: { requestsPerMinute: 12 }
  }
  
  async *search(criteria: SearchCriteria, callbacks?: SearchCallbacks): AsyncGenerator<Property> {
    // 1. Translate generic criteria to LandWatch-specific search params
    const searchParams = this.buildSearchParams(criteria)
    
    let page = 1
    let totalFound = 0
    
    while (true) {
      // 2. Fetch page from site using its search API
      callbacks?.onProgress?.({
        source: this.name,
        message: `Fetching page ${page}`,
        currentPage: page,
        propertiesFound: totalFound
      })
      
      const listings = await this.fetchSearchResults(searchParams, page)
      
      if (listings.length === 0) break
      
      // 3. Normalize and filter each listing
      for (const listing of listings) {
        const property = this.normalize(listing)
        
        // 4. Apply filters site doesn't support
        if (!this.matchesUnsupportedCriteria(property, criteria)) {
          continue
        }
        
        totalFound++
        yield property
      }
      
      page++
      await this.rateLimiter.throttle()
    }
  }
  
  private buildSearchParams(criteria: SearchCriteria): LandWatchSearchParams {
    // Translate generic criteria to site-specific format
    const maxPrice = this.getPriceForRegion(criteria)
    
    return {
      state: criteria.states.join(','),
      minAcres: criteria.minAcres,
      maxAcres: criteria.maxAcres,
      minPrice: criteria.priceRange.default.min,
      maxPrice,
      propertyType: criteria.structurePreference === 'raw-land' ? 'land' : 'land-with-home'
      // Only include filters this site supports
    }
  }
  
  private normalize(listing: LandWatchListing): Property {
    // Map site-specific data to common Property model
    return {
      // Required fields
      id: hash(`${this.name}-${listing.id}`),
      source: this.name,
      source_id: listing.id,
      url: listing.url,
      title: listing.title || "Untitled Property",
      
      // Optional fields
      description: listing.description,
      acres: parseFloat(listing.acreageText),
      price: this.parsePrice(listing.priceText),
      state: listing.state,
      county: listing.county,
      city: listing.city,
      coordinates: listing.coordinates ? {
        latitude: listing.coordinates.lat,
        longitude: listing.coordinates.lng
      } : undefined,
      
      waterFeatures: this.extractWaterFeatures(listing),
      structures: this.extractStructures(listing),
      utilities: this.extractUtilities(listing),
      terrainTags: this.extractTerrain(listing),
      
      images: listing.images,
      rawData: listing
    }
  }
  
  private matchesUnsupportedCriteria(property: Property, criteria: SearchCriteria): boolean {
    // Filter for criteria the site doesn't support
    
    // Distance to town filter (site doesn't support)
    if (criteria.distanceToTown) {
      if (!property.distanceToTownMinutes) {
        return false  // Missing data, can't verify
      }
      if (property.distanceToTownMinutes < criteria.distanceToTown.min ||
          property.distanceToTownMinutes > criteria.distanceToTown.max) {
        return false
      }
    }
    
    // Terrain filter (site doesn't support)
    if (criteria.terrain?.length > 0) {
      if (!property.terrainTags || property.terrainTags.length === 0) {
        return true  // No terrain data, include it
      }
      const hasMatchingTerrain = criteria.terrain.some(t => 
        property.terrainTags?.includes(t)
      )
      if (!hasMatchingTerrain) {
        return false
      }
    }
    
    return true
  }
}
```

## Scraping Strategy

### Playwright Configuration

All data sources use Playwright for scraping due to bot protection on target sites.

**Browser Settings**:
- Headless mode (configurable)
- Realistic user agent
- Viewport size: 1920x1080
- Slow down interactions to appear human-like
- Random delays between requests

**Stealth Techniques**:
- Disable automation flags (`navigator.webdriver`)
- Randomize request timing
- Respect rate limits (default: 1 request per 5 seconds per source)
- Maintain session cookies across requests
- Rotate user agents if needed

### Rate Limiting

Each plugin respects rate limits to avoid detection:

```typescript
class RateLimiter {
  private lastRequest = 0
  
  async throttle(delayMs: number): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequest
    if (elapsed < delayMs) {
      await new Promise(resolve => setTimeout(resolve, delayMs - elapsed))
    }
    this.lastRequest = Date.now()
  }
}
```

### Error Handling

Scraping errors are handled gracefully:
- Network errors: Retry with exponential backoff (3 attempts)
- Parsing errors: Log and skip property, continue with others
- Site structure changes: Log error, mark plugin unhealthy, continue with other sources
- Rate limit errors (429): Back off for longer period, then retry

## CLI Commands

### Entry Point

File: `src/cli/index.ts`

Uses `commander` for CLI argument parsing:

```bash
bun run src/cli/index.ts search [--profile <name>] [--output <format>]
bun run src/cli/index.ts list [--new] [--state <STATE>] [--min-score <N>]
bun run src/cli/index.ts show <property-id>
bun run src/cli/index.ts profile list
bun run src/cli/index.ts profile activate <name>
bun run src/cli/index.ts profile create <name>
bun run src/cli/index.ts config [--profile <name>] [--edit]
bun run src/cli/index.ts export [--format csv|json] [--output <file>]
bun run src/cli/index.ts merge <id1> <id2>
```

### Output Formats

**Table**: Compact view for listing multiple properties
```
ID       State  Acres  Price     Score  Water    Terrain         Distance
a1b2c3   ID     25     $750k     85     Creek    Forested        45 min
d4e5f6   MT     40     $1.2M     90     Pond     Mountain        50 min
```

**Detail**: Full information for single property
```
Property: a1b2c3
Title: 25 Acres with Creek in Northern Idaho
State: ID
County: Bonner County
...
```

**JSON**: Machine-readable format for export/processing
```json
[
  {
    "id": "a1b2c3",
    "state": "ID",
    "acres": 25,
    ...
  }
]
```

## Testing Strategy

Using Bun's built-in test runner.

### Unit Tests

- **Filters**: Test criteria matching logic with various property combinations
- **Scoring**: Verify score calculation with different feature sets
- **Deduplication**: Test hash generation and duplicate detection
- **Normalization**: Test property data normalization from raw format

### Integration Tests

- **Database**: Test CRUD operations and migrations
- **Configuration**: Test config loading and validation

### Plugin Tests

Mock HTTP responses for scraping tests:
- Capture actual HTML from sites (saved in `tests/fixtures/`)
- Test parsing logic against saved HTML
- Verify normalization of scraped data

### Running Tests

```bash
bun test                    # Run all tests
bun test filters            # Run specific test suite
bun test --watch            # Watch mode
```

## Development Workflow

### Initial Setup

```bash
git clone <repo>
cd landbot
bun install
bun run src/db/migrations.ts    # Initialize database
cp .env.example .env            # Configure if needed
```

### Running Searches

```bash
bun run src/cli/index.ts search
```

### Adding a New Data Source

1. Create `src/plugins/sources/<name>.plugin.ts`
2. Implement `SourcePlugin` interface
3. Export plugin with metadata
4. Add to `config/search-criteria.json` plugins section
5. Test with `bun test plugins/<name>`

### Database Migrations

Migrations are simple SQL scripts in `src/db/migrations.ts`. Add new migrations to the array and run the migration script.

## Deduplication Plugins

File: `src/plugins/dedup/base.ts`

```typescript
export interface DeduplicationPlugin {
  name: string
  priority: number              // Higher = runs first
  
  findDuplicates(properties: Property[]): DuplicateGroup[]
}

export type DuplicateGroup = {
  properties: Property[]        // All properties in this duplicate group
  method: string                // "mls_number", "coordinates", "manual"
  confidence: number            // 0.0-1.0
}
```

### Built-in Dedup Plugins

**MLS Matcher** (`src/plugins/dedup/mls.plugin.ts`):
```typescript
class MLSDeduplicationPlugin implements DeduplicationPlugin {
  name = "mls_matcher"
  priority = 100
  
  findDuplicates(properties: Property[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = []
    const mlsMap = new Map<string, Property[]>()
    
    // Extract MLS numbers from rawData
    for (const property of properties) {
      const mlsNumber = this.extractMLSNumber(property.rawData)
      if (mlsNumber) {
        if (!mlsMap.has(mlsNumber)) {
          mlsMap.set(mlsNumber, [])
        }
        mlsMap.get(mlsNumber)!.push(property)
      }
    }
    
    // Create groups for properties with matching MLS numbers
    for (const [mlsNumber, props] of mlsMap) {
      if (props.length > 1) {
        groups.push({
          properties: props,
          method: "mls_number",
          confidence: 1.0
        })
      }
    }
    
    return groups
  }
  
  private extractMLSNumber(rawData: unknown): string | null {
    // Parse site-specific rawData for MLS number
    // Different sites store it differently
    return null  // Implementation depends on site structure
  }
}
```

**Coordinate Matcher** (`src/plugins/dedup/coordinates.plugin.ts`):
```typescript
class CoordinateDeduplicationPlugin implements DeduplicationPlugin {
  name = "coordinate_matcher"
  priority = 50
  
  findDuplicates(properties: Property[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = []
    const remaining = [...properties.filter(p => p.coordinates)]
    
    while (remaining.length > 0) {
      const current = remaining.shift()!
      const nearby: Property[] = [current]
      
      // Find properties within ~100m (0.001°)
      for (let i = remaining.length - 1; i >= 0; i--) {
        const other = remaining[i]
        if (this.areNearby(current.coordinates!, other.coordinates!)) {
          nearby.push(other)
          remaining.splice(i, 1)
        }
      }
      
      if (nearby.length > 1) {
        groups.push({
          properties: nearby,
          method: "coordinates",
          confidence: 0.9
        })
      }
    }
    
    return groups
  }
  
  private areNearby(coord1: Coordinates, coord2: Coordinates): boolean {
    const latDiff = Math.abs(coord1.latitude - coord2.latitude)
    const lonDiff = Math.abs(coord1.longitude - coord2.longitude)
    return latDiff < 0.001 && lonDiff < 0.001  // ~100m
  }
}
```

### Canonical Selection

After dedup plugins identify groups, the system selects the canonical property:

```typescript
function selectCanonical(group: DuplicateGroup): Property {
  const properties = group.properties
  
  // Sort by field completeness (descending), then first_seen (ascending)
  const sorted = properties.sort((a, b) => {
    if (b.fieldCompleteness !== a.fieldCompleteness) {
      return b.fieldCompleteness! - a.fieldCompleteness!
    }
    return a.firstSeen!.localeCompare(b.firstSeen!)
  })
  
  return sorted[0]
}
```

## Performance Considerations

### Parallel Searching

Plugins can execute in parallel, but must be consumed sequentially due to async generator pattern:
```typescript
// Execute plugins sequentially (can't parallelize async generators easily)
for (const plugin of plugins) {
  for await (const property of plugin.search(criteria, callbacks)) {
    await processProperty(property)
  }
}
```

### Database Optimization

- Indexes on frequently queried fields (state, price, score)
- Batch inserts for multiple properties
- Use transactions for consistency

### Caching (Future)

Store raw HTML responses for 24 hours to enable re-parsing without re-fetching if selectors need adjustment.

## Security & Privacy

- All data stored locally, no external services
- No user tracking or analytics
- `.gitignore` includes database file and config with potential API keys
- Environment variables for any sensitive configuration

## Monitoring Framework (Future)

Uses `node-cron` for scheduling (compatible with Bun):

```typescript
import cron from 'node-cron'

// Run search every 6 hours
cron.schedule('0 */6 * * *', async () => {
  const results = await search(criteria)
  const newProperties = results.filter(isNew)
  if (newProperties.length > 0) {
    await notify(newProperties)
  }
})
```

**Notification Abstraction**:
```typescript
interface Notifier {
  send(message: NotificationMessage): Promise<void>
}

class EmailNotifier implements Notifier { ... }
class WebhookNotifier implements Notifier { ... }
```

Not activated in initial release but architecture supports it.

## Deployment

Single-user tool, no deployment needed:
- Run directly with `bun run src/cli/index.ts`
- Add alias to shell config: `alias landbot='bun run /path/to/landbot/src/cli/index.ts'`
- Or create executable with `bun build` for distribution

## Dependencies

From `package.json`:

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "playwright": "^1.41.0",
    "cli-table3": "^0.6.3"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0"
  }
}
```

Playwright auto-downloads browser binaries (~300MB) on first install.

## Environment Variables

File: `.env.example`

```bash
# Database location (optional, defaults to ./data/landbot.db)
DATABASE_PATH=./data/landbot.db

# Logging level (optional, defaults to info)
LOG_LEVEL=info

# Future: API keys for data sources if available
# ZILLOW_API_KEY=
# REALTOR_API_KEY=
```

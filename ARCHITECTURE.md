# Architecture

## System Overview

Landbot is a modular property search system built around a plugin architecture. Plugins leverage each site's native search capabilities to fetch relevant properties, normalize results to a common format, and yield them for scoring and storage. The system applies weighted scoring to rank matches, tracks changes over time, and deduplicates properties found across multiple sources.

## Core Components

### Search Engine

Orchestrates the search workflow:

1. Load search criteria from active profile configuration
2. Discover and instantiate enabled data source plugins for the profile
3. Execute plugin searches (can run in parallel)
4. Receive normalized Property objects from plugins via async generators
5. Apply weighted scoring to each property
6. Persist properties to database (creates snapshots on change)
7. Run deduplication plugins to identify cross-source duplicates
8. Return formatted output

The search engine treats all data sources uniformly through the plugin interface. Plugins handle source-specific logic (query translation, scraping, normalization), while the engine handles generic logic (scoring, storage, deduplication).

### Plugin System

**Registry**: Discovers plugins by scanning the plugins directory for files matching `*.plugin.ts`. Maintains a registry of available plugins and provides methods to instantiate them with configuration.

**Base Interface**: All data source plugins implement a common interface:
- `search(criteria, callbacks)`: Execute search and yield normalized Property objects via async generator
- `healthCheck()`: Verify the source is accessible
- `metadata`: Plugin capabilities including supported filters

**Plugin Responsibilities**:
1. **Translate criteria to site-specific queries**: Map generic SearchCriteria to the site's search parameters
2. **Use site search capabilities**: Leverage filters the site supports (state, price, acreage) to fetch only relevant results
3. **Normalize results**: Convert site-specific data to common Property model
4. **Filter locally**: Apply criteria the site doesn't support (e.g., distance to town, terrain)
5. **Yield Property objects**: Stream normalized properties via async generator

**Filter Capability Metadata**: Plugins declare which filters they support:
- `supportedFilters.states`: Can filter by state?
- `supportedFilters.minPrice`, `maxPrice`: Can filter by price range?
- `supportedFilters.minAcres`, `maxAcres`: Can filter by acreage?
- `supportedFilters.waterFeatures`: Can filter by water presence?
- And more...

This metadata allows the system to log which filters were applied server-side vs client-side, helping users understand search efficiency.

**Callbacks**: Plugins report progress during search execution:
- `onProgress(update)`: Report current page, properties found, total pages if known
- `onError(error, recoverable)`: Report errors without crashing search

**Benefits**:
- Add new data sources by dropping in a new plugin file
- Enable/disable sources per search profile
- Isolate failures (one broken plugin doesn't crash entire search)
- Test each source independently
- Support both API-based and scraping-based sources with same interface
- Stream results for memory efficiency and live progress updates
- Efficient searches - only fetch relevant properties from sites

### Data Model

**Property**: Normalized representation of a property listing
- **Required fields**: id, source, source_id, url, title (plugins must provide these)
- **Optional core attributes**: acres, price, location (state, county, city, coordinates)
- **Optional features**: water (type and availability), structures, utilities, terrain, distance to town
- **Metadata**: images, raw data (preserved for debugging)
- **Calculated fields**: score (by scoring engine), field completeness count (by repository)
- **Timestamps**: first seen, last seen, last checked (managed by repository)
- **Identity**: Stable ID based on hash(source + source_id) - never changes even if price changes

**PropertySnapshot**: Historical record of property state at a point in time
- Created only when property fields change (price, title, description, etc.)
- Comparison ignores `rawData` field (only compare actual property fields)
- Stores complete property state plus raw scraped data
- Enables tracking what changed and when

**SearchCriteria**: User-defined filters and preferences
- Hard constraints (must have): minimum acres, state list, price range, distance to town range
- Weighted preferences (nice to have): water features, terrain types, structure presence
- Scoring weights for each preference
- Organized into profiles for different search scenarios

**Profile**: Named search configuration
- Criteria: Filters and scoring preferences
- Enabled plugins: Which data sources to use
- No inheritance: Each profile is independent

**Normalization**: Plugins normalize data - they know the source site's structure and convert it to the common Property model. Plugins yield normalized Property objects (not raw data). Missing optional fields are fine; required fields should use sensible defaults if unavailable.

### Filtering and Scoring

**Filtering**: Two-stage process
1. **Plugin-level filtering**: Plugins apply hard constraints when fetching from sites
   - Use site's search/filter capabilities when available (state, price, acreage)
   - Apply additional filters locally for criteria site doesn't support (distance to town, terrain, water features)
   - Only yield properties that match all hard constraints
2. **Engine-level validation**: Search engine can apply additional validation if needed, but plugins should handle most filtering

**Scoring Engine**: Calculates weighted match score for properties that passed filtering
- Scores are configurable per profile
- Default weights (example):
  - Year-round water: +50 points
  - Pond or lake: +30 points
  - Well or water rights: +30 points
  - Any water feature: +20 points
  - Forested/mountain terrain: +25 points
  - Raw land (preferred): +10 points
  - Cabin or structure: +15 points
  - Utilities available: +5-10 points per utility

Properties with higher scores are better matches. Score helps rank results when many properties qualify. Different profiles can use different scoring weights.

### Storage Layer

**Database Client**: Provides abstraction over SQLite operations
- Execute queries and commands
- Run migrations
- Transaction support

**Repository**: Higher-level data access patterns
- `saveProperty(property)`: Insert or update property, create snapshot if changed
- `findProperties(criteria)`: Query with filters
- `getNewProperties(since)`: Find properties added after a date
- `getPriceChanges(propertyId)`: Get price history
- `getPropertySnapshots(propertyId)`: Get historical snapshots showing what changed
- `recordSearchRun(metadata)`: Track search execution
- `markDuplicates(canonical, duplicates, method)`: Record cross-source deduplication

**Deduplication**: Handled by pluggable dedup strategies running after property collection:
- **MLS Matcher**: Exact match on MLS number (confidence: 1.0)
- **Coordinate Matcher**: Properties within ~100m (confidence: 0.9)
- **Canonical Selection**: Property with most complete data becomes canonical
- **Duplicate Tracking**: All duplicates preserved in database with linkage to canonical

Properties maintain stable identity based on `source + source_id`. Cross-source duplicates are linked via `property_duplicates` table.

### CLI Interface

Command dispatcher that provides:
- `search [--profile <name>]`: Execute search with active or specified profile
- `list`: Display previously found properties with filtering
- `show <id>`: Display detailed information for a specific property, including history
- `profile list|activate|create`: Manage search profiles
- `config`: View or edit search criteria for a profile
- `export`: Export results to CSV or JSON
- `merge <id1> <id2>`: Manually mark properties as duplicates

Formatters handle output presentation (table, detailed list, JSON).

**Progress Display**: During search execution, plugins report progress via callbacks. CLI displays sequential console logs: `[LandWatch] Page 3/10 - 45 properties found`.

### Notification System (Framework)

Abstraction layer for notifications, initially inactive:
- **Notifier Interface**: Send notification with title, message, and priority
- **Implementations**: Email, SMS, webhook (Slack/Discord)
- **Scheduler**: Triggers periodic searches and sends notifications for new matches

This framework exists to support future monitoring mode but is not activated in initial release.

## Data Flow

### Search Flow

```
User runs `search [--profile <name>]` command
  ↓
CLI loads search criteria from active/specified profile
  ↓
Search engine discovers enabled plugins for this profile
  ↓
Log which filters each plugin supports (based on metadata.supportedFilters)
  ↓
For each plugin (can run in parallel):
  ↓
  Plugin receives SearchCriteria
    ↓
    Plugin translates criteria to site-specific search parameters
      (e.g., criteria.states=["MT"] → siteParams.state="MT")
      (only include filters the site supports)
    ↓
    Plugin fetches page 1 from site using search parameters
    ↓
    Plugin reports progress: onProgress({source, currentPage: 1, propertiesFound: 0})
    ↓
    CLI displays: [PluginName] Page 1/? - 0 properties found
    ↓
    For each result on page:
      ↓
      Plugin normalizes site-specific data → Property object
        (required fields: id, source, source_id, url, title)
        (optional fields: acres, price, coordinates, features, etc.)
      ↓
      Plugin applies local filters for criteria site doesn't support
        (e.g., distanceToTown if site can't filter by it)
        (skip property if doesn't match)
      ↓
      Plugin yields normalized Property object
    ↓
    Plugin updates progress and fetches next page
    ↓
    Repeat until no more pages
  ↓
  Search engine receives yielded Property object
    ↓
  Scoring engine calculates match score based on weighted preferences
    property.score = calculateScore(property, criteria)
    ↓
  Repository saves property to database
    ↓
    Calculate field completeness (count non-null fields, ignore rawData)
    ↓
    Check if property exists (by id = hash(source + source_id))
    ↓
    If new: INSERT property + create initial snapshot
    ↓
    If exists:
      Compare fields (ignore rawData)
      ↓
      If fields changed:
        UPDATE property + CREATE snapshot
        ↓
        If price changed: INSERT price_history
      ↓
      If no changes: UPDATE last_checked only
  ↓
All plugins complete
  ↓
Run deduplication plugins on all collected properties:
  ↓
  MLSDeduplicationPlugin finds MLS number matches (confidence: 1.0)
  ↓
  CoordinateDeduplicationPlugin finds coordinate matches within ~100m (confidence: 0.9)
  ↓
  For each duplicate group:
    ↓
    Select canonical: property with highest field_completeness
      (if tie: earliest first_seen wins)
    ↓
    INSERT into property_duplicates (canonical_id, duplicate_id, method, confidence)
  ↓
Formatted output displayed to user (shows canonical properties)
  ↓
INSERT search_run metadata (profile, properties_found, sources_used, filters_applied)
```

### Monitoring Flow (Future)

```
Scheduler triggers search at configured interval
  ↓
Search executes (same as manual search)
  ↓
New properties identified (not in database)
  ↓
Notification sent with summary of new matches
  ↓
User views details via CLI when convenient
```

## Extension Points

### Adding Data Sources

1. Create new file `src/plugins/sources/<name>.plugin.ts`
2. Implement the `PropertySource` interface with async generator
3. Export plugin metadata
4. Add to profile's plugin config to enable

No changes to core system required.

### Adding Deduplication Methods

1. Create new file `src/plugins/dedup/<name>.plugin.ts`
2. Implement the `DeduplicationPlugin` interface
3. Return groups of duplicate properties with confidence score
4. System handles canonical selection automatically

Examples: domain-specific ID matching (Zillow ZPID), user manual confirmation.

### Custom Scoring

Scoring weights are configurable in search criteria per profile. Users can adjust which features matter most without code changes. Different profiles can have different scoring strategies.

### Search Profiles

Users can create unlimited profiles for different scenarios:
- Different geographic focus (Montana-only vs comprehensive)
- Different price ranges
- Different data sources enabled
- Different scoring preferences

All via config file, no code changes needed.

### Alternative Storage

Repository interface can be implemented with different backing stores (PostgreSQL, cloud database) without changing other components.

### Output Formats

New formatters can be added to support additional output formats (HTML, markdown, email templates) without changing search logic.

## Design Decisions

### Plugin Architecture

**Decision**: Use a plugin system for data sources and deduplication strategies rather than hardcoding.

**Rationale**: Real estate sites change frequently. A plugin system allows quick updates to individual sources without risking the entire system. New sources and dedup methods can be added by users without modifying core code.

**Trade-offs**: Additional abstraction layer adds complexity but pays off in maintainability and extensibility.

### Async Generator for Pagination

**Decision**: Use async generators for plugin search results rather than returning arrays.

**Rationale**: Real estate searches return hundreds of paginated results. Async generators allow streaming processing (save each property as it's found), progress reporting per page, and memory efficiency. Plugins naturally handle pagination by yielding results page-by-page.

**Trade-offs**: Slightly more complex plugin implementation, but much better user experience (live progress) and system resource usage.

### Plugin Normalization

**Decision**: Plugins normalize site-specific data to Property model, not the search engine.

**Rationale**: Each plugin knows the source site's structure intimately (CSS selectors, API response format, field mappings). Plugin is the right place to handle normalization. Search engine would need source-specific logic for each site, defeating the purpose of plugins.

**Trade-offs**: More responsibility per plugin, but much simpler search engine. Plugins are easier to test in isolation when they own end-to-end processing.

### Leverage Site Search Capabilities

**Decision**: Plugins translate SearchCriteria to site-specific queries and use site's native search/filter features.

**Rationale**: Fetching all properties and filtering locally wastes bandwidth, time, and risks rate limiting or bans. Using site search capabilities is respectful to the site and dramatically faster for users. Sites want users to filter - they provide these features intentionally.

**Trade-offs**: Each plugin must implement criteria translation, but this is straightforward mapping logic. Much better than scraping everything.

### Filter Capability Metadata

**Decision**: Plugins expose which filters they support via metadata.

**Rationale**: Different sites have different filtering capabilities. LandWatch might support acreage filters, while another site doesn't. Exposing this metadata allows logging which filters were applied where, helping users understand why some searches return broader results.

**Trade-offs**: Additional metadata to maintain per plugin, but provides transparency and debugging capability.

### Scoring vs Binary Filtering

**Decision**: Use weighted scoring for preferences rather than only hard filters.

**Rationale**: User preferences are nuanced. A property with great water access but slightly farther from town might be better than one closer but without water. Scoring captures these trade-offs.

**Trade-offs**: More complex than simple pass/fail filtering, but provides much better ranking of results.

### Local Database

**Decision**: Use local SQLite instead of cloud database.

**Rationale**: Single-user tool, no sharing requirements. Local database is simpler, faster, and has no ongoing costs. User has full control of their data.

**Trade-offs**: Not suitable for multi-user scenarios, but that's not a current requirement.

### Property Snapshots on Change

**Decision**: Create property snapshots only when fields change, not on every scrape.

**Rationale**: Most properties don't change between searches. Creating snapshots only on change reduces storage and makes "what changed" queries trivial. Users care about changes, not that we verified nothing changed.

**Trade-offs**: Lose complete audit trail of every check, but gain efficiency and clarity. Always update `last_checked` timestamp so we know when property was verified.

### Canonical Selection by Completeness

**Decision**: When duplicates are found across sources, the property with most complete data becomes canonical.

**Rationale**: Different sources provide different detail levels. LandWatch might have better description, Zillow better photos. Selecting the most complete property gives users the best data. Canonical can change over time as sources improve their data.

**Trade-offs**: Canonical property might switch between sources across searches, but users see better data. All original properties preserved in database via duplicate linkage.

### CLI First

**Decision**: Build CLI before web interface.

**Rationale**: Faster to develop, easier to test, and sufficient for power users. Web interface can layer on top later without architectural changes.

**Trade-offs**: Less accessible to non-technical users, but target user is comfortable with command line.

### Scraping over APIs

**Decision**: Start with web scraping rather than waiting for API access.

**Rationale**: Most real estate sites don't offer public APIs. Scraping provides immediate functionality. Plugin system allows switching to APIs when available.

**Trade-offs**: Scraping is fragile (breaks when sites change) but necessary for comprehensive coverage.

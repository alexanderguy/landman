# Landbot CLI Guide

Command-line interface for searching and managing property listings.

## Installation

Ensure you have initialized the database:

```bash
bun run db:init
```

## Commands

### Profile Management

#### List Profiles
```bash
bun run src/cli/index.ts profile list
```

Shows all available search profiles with their configurations.

#### Activate Profile
```bash
bun run src/cli/index.ts profile activate <name>
```

Sets the active profile for searches.

Example:
```bash
bun run src/cli/index.ts profile activate montana-only
```

#### Show Profile Details
```bash
bun run src/cli/index.ts profile show <name>
```

Displays detailed search criteria and plugin configuration for a profile.

### Search

#### Run Search
```bash
bun run src/cli/index.ts search [--profile <name>]
```

Searches for properties using the active profile or a specified profile.

Examples:
```bash
# Use active profile
bun run src/cli/index.ts search

# Use specific profile
bun run src/cli/index.ts search --profile montana-only
```

The search will:
- Use the profile's search criteria
- Query enabled data sources in priority order
- Apply scoring based on preferences
- Run deduplication plugins
- Save results to the database

### Listing Properties

#### List All Properties
```bash
bun run src/cli/index.ts list
```

Shows all saved properties in a table format.

#### Filter Properties
```bash
bun run src/cli/index.ts list [options]
```

Options:
- `-s, --state <state>` - Filter by state code (e.g., MT, ID)
- `--min-price <price>` - Minimum price filter
- `--max-price <price>` - Maximum price filter
- `--min-acres <acres>` - Minimum acreage filter
- `--max-acres <acres>` - Maximum acreage filter
- `--min-score <score>` - Minimum score filter
- `-l, --limit <count>` - Limit number of results

Examples:
```bash
# Montana properties only
bun run src/cli/index.ts list --state MT

# Properties under $500k with at least 40 acres
bun run src/cli/index.ts list --max-price 500000 --min-acres 40

# Top 10 highest scored properties
bun run src/cli/index.ts list --min-score 50 --limit 10
```

### Property Details

#### Show Property
```bash
bun run src/cli/index.ts show <id> [--history]
```

Displays detailed information about a property. You can use either the full ID or a partial ID prefix.

Options:
- `-h, --history` - Include snapshot history

Examples:
```bash
# Show current details
bun run src/cli/index.ts show abc123

# Show with change history
bun run src/cli/index.ts show abc123 --history
```

The show command displays:
- Property metadata (source, URL, title)
- Location details
- Acreage and price
- Score and completeness percentage
- Water features
- Structures
- Utilities
- Terrain tags
- Price change history

### Deduplication

#### Manually Merge Duplicates
```bash
bun run src/cli/index.ts merge <canonical-id> <duplicate-id>
```

Manually marks two properties as duplicates, with the first being the canonical (most complete) version.

Example:
```bash
bun run src/cli/index.ts merge abc123 def456
```

## Workflow Example

Typical workflow for finding properties:

```bash
# 1. Check available profiles
bun run src/cli/index.ts profile list

# 2. View profile details
bun run src/cli/index.ts profile show default

# 3. Run search with active profile
bun run src/cli/index.ts search

# 4. List results filtered by criteria
bun run src/cli/index.ts list --state MT --min-acres 40

# 5. View details of interesting properties
bun run src/cli/index.ts show abc123 --history

# 6. Switch to different profile for another search
bun run src/cli/index.ts profile activate budget-friendly
bun run src/cli/index.ts search
```

## Tips

- Use partial property IDs for the `show` command (e.g., first 8 characters)
- Results are automatically sorted by score (highest first) and last seen date
- Price changes are tracked automatically when re-running searches
- Snapshot history shows all changes to a property over time
- The `--history` flag on `show` displays all snapshots, useful for tracking price/detail changes

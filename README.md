# Landman

A modular property search system that aggregates land listings from multiple sources, scores them against your preferences, and tracks changes over time.

## Features

- **Multi-source aggregation**: Search LandWatch, Lands of America, LandSearch, and Zillow
- **Profile-based search**: Save multiple search configurations for different scenarios
- **Weighted scoring**: Rank properties by your preferences (water features, terrain, utilities)
- **Change tracking**: Monitor price changes and new listings
- **Deduplication**: Identify the same property across different sources
- **Local database**: All data stored locally in SQLite

## Installation

```bash
bun install
```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `config/search-criteria.json` to define your search profiles

## Usage

```bash
# Run the application
bun run src/index.ts

# Run tests
bun test
```

## Project Structure

```
landman/
├── src/
│   ├── cli/          # Command-line interface
│   ├── db/           # Database client and schema
│   ├── models/       # Type definitions
│   ├── plugins/      # Data source and deduplication plugins
│   ├── filters/      # Scoring and filtering logic
│   └── utils/        # Helper utilities
├── config/           # Search configuration files
├── data/             # SQLite database (created at runtime)
└── tests/            # Test files
```

## Documentation

- `PRODUCT.md` - Product vision and user value
- `ARCHITECTURE.md` - System architecture and design decisions
- `IMPLEMENTATION.md` - Technical implementation details
- `AGENTS.md` - Session initialization requirements

## Technology Stack

- **Runtime**: Bun 1.2+
- **Language**: TypeScript 5.3+
- **Database**: SQLite (via bun:sqlite)
- **Browser Automation**: Playwright
- **CLI Framework**: Commander

## License

MIT

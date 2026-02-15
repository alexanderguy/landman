# Landbot - Property Search Agent

## Vision

An intelligent property search agent that finds rural homestead properties across the Mountain West, matching specific lifestyle and geographic preferences. Automates the tedious process of manually checking multiple real estate platforms, scoring properties based on weighted criteria, and tracking changes over time.

## Problem

Finding the right rural property (20+ acres) in mountain/forested areas across multiple states is time-consuming and fragmented:

- Properties are scattered across multiple listing platforms (LandWatch, Lands of America, LandSearch, Zillow)
- Manual searching is repetitive and error-prone
- No single platform has comprehensive coverage
- Price changes and new listings are easy to miss
- Difficult to apply complex, weighted criteria across sources
- Hard to track which properties have already been reviewed

## Target User

Property buyers looking for rural homesteads with specific criteria:

- Seeking 20+ acres in mountain/forested regions
- Targeting specific states (Idaho, Montana, Wyoming, South Dakota, Washington)
- Have complex preferences (water features, distance to town, utilities, terrain)
- Want to track properties over time and catch new listings
- Value automation to reduce time spent on manual searches

## User Value

**Time Savings**: Automate hours of manual searching across multiple platforms into a single command.

**Comprehensive Coverage**: Search multiple data sources in parallel, ensuring no listings are missed.

**Efficient Searching**: Leverages each site's native search capabilities to fetch only relevant properties, minimizing bandwidth and respecting site resources.

**Intelligent Filtering**: Apply complex, weighted criteria that go beyond simple property attributes. Properties are scored based on how well they match preferences (water features, terrain, structures, proximity to town). Sites filter what they can server-side; additional criteria applied locally.

**Change Tracking**: Monitor property changes over time. System creates historical snapshots only when properties change (price, description, features), enabling tracking of what changed and when.

**Smart Deduplication**: Identify the same property listed across multiple sources using MLS numbers and coordinate matching. System selects the most complete listing as canonical while preserving all source links.

**Configurable Profiles**: Create multiple search profiles for different scenarios (Montana focus, budget properties, comprehensive search). Each profile has its own criteria, enabled sources, and scoring preferences.

**Future Monitoring**: Architecture supports scheduled searches with notifications when new matching properties appear.

## Use Cases

### Initial Search
User runs a search to discover all current properties matching their criteria across all target states. Results are scored and ranked by how well they match preferences.

### Regular Monitoring
User periodically re-runs searches to find new listings and track price changes on previously discovered properties.

### Comparison and Analysis
User exports results to CSV or JSON for further analysis, comparison, or sharing with family/advisors.

### Custom Profiles
User creates multiple search profiles for different scenarios (e.g., "Montana focus", "budget-friendly", "comprehensive search"). Each profile can enable different data sources, use different criteria, and apply different scoring weights. Switch between profiles with `--profile` flag.

### Future: Continuous Monitoring
User activates background monitoring mode that automatically searches on a schedule and sends notifications when new properties match criteria.

## Success Metrics

- **Coverage**: Successfully search and normalize data from 4+ major listing platforms
- **Search Efficiency**: Leverage site search capabilities to fetch only relevant properties (not scraping everything)
- **Accuracy**: 95%+ of returned properties correctly match stated criteria
- **Performance**: Complete multi-state, multi-source search in under 5 minutes
- **Deduplication**: Identify same property across sources using MLS numbers (100% confidence) and coordinates (~100m proximity, 90% confidence)
- **Change Tracking**: Detect and record property changes (price, description, features) across search runs
- **Usability**: Single command to execute search and view formatted results
- **Reliability**: Handle site changes, rate limits, and network errors gracefully without crashing

## Non-Goals

- Building a web interface (CLI-first, web interface may come later)
- Real-time notifications in initial version (framework exists but not activated)
- Direct MLS integration (public sites only to start)
- Property valuation or investment analysis (just search and track)
- User accounts or multi-user support (single-user tool)
- Complex fuzzy deduplication (address text matching, description similarity, image comparison)
- Scraping all properties then filtering (leverage site search capabilities instead)

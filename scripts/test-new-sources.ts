import { discoverPlugins, getPropertySource } from "../src/plugins/registry"
import type { SearchCriteria } from "../src/models/search-criteria"

async function testNewSources() {
  console.log("Discovering plugins...")
  await discoverPlugins()

  const zillow = getPropertySource("zillow")

  console.log("\n=== Zillow Plugin ===")
  console.log("Name:", zillow?.metadata.name)
  console.log("Display Name:", zillow?.metadata.displayName)
  console.log("Version:", zillow?.metadata.version)
  console.log("Supported Filters:", zillow?.metadata.supportedFilters)

  console.log("\n=== Test Search Criteria ===")
  const testCriteria: SearchCriteria = {
    minAcres: 20,
    maxAcres: 100,
    states: ["MT"],
    priceRange: {
      default: {
        min: 100000,
        max: 500000,
      },
    },
  }

  console.log("Test criteria:", JSON.stringify(testCriteria, null, 2))
  console.log("\nNote: To actually test scraping, use the CLI search command:")
  console.log("  bun run src/cli/index.ts search --profile default")
  console.log("\nMake sure to enable the new sources in config/search-criteria.json")
}

testNewSources()

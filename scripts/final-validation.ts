import landwatchPlugin from "../src/plugins/sources/landwatch"
import type { SearchCriteria } from "../src/models/search-criteria"

async function finalValidation() {
  console.log("Running final validation of LandWatch server-side filtering...\n")

  const criteria: SearchCriteria = {
    states: ["MT"],
    minAcres: 10,
    maxAcres: 100,
    priceRange: {
      default: { min: 50000, max: 500000 },
    },
  }

  console.log("Search Criteria:")
  console.log(`  States: ${criteria.states.join(", ")}`)
  console.log(`  Price: $${criteria.priceRange.default.min?.toLocaleString()} - $${criteria.priceRange.default.max?.toLocaleString()}`)
  console.log(`  Acres: ${criteria.minAcres} - ${criteria.maxAcres}\n`)

  const properties = []
  let count = 0
  const maxProperties = 50

  console.log("Fetching properties...")

  try {
    for await (const property of landwatchPlugin.search(criteria, {
      onProgress: (msg) => console.log(msg),
    })) {
      properties.push(property)
      count++

      if (count >= maxProperties) {
        break
      }
    }

    console.log(`\n✅ Fetched ${properties.length} properties\n`)

    let validPrice = 0
    let invalidPrice = 0
    let validAcres = 0
    let invalidAcres = 0
    const outOfRange: Array<{ title: string; price?: number; acres?: number }> = []

    properties.forEach((p) => {
      const priceOk = !p.price || (p.price >= 50000 && p.price <= 500000)
      const acresOk = !p.acres || (p.acres >= 10 && p.acres <= 100)

      if (p.price) {
        if (priceOk) validPrice++
        else invalidPrice++
      }

      if (p.acres) {
        if (acresOk) validAcres++
        else invalidAcres++
      }

      if (!priceOk || !acresOk) {
        outOfRange.push({
          title: p.title,
          price: p.price,
          acres: p.acres,
        })
      }
    })

    console.log("=" .repeat(70))
    console.log("VALIDATION RESULTS")
    console.log("=".repeat(70))
    console.log(`Total properties: ${properties.length}`)
    console.log(`\nPrice validation:`)
    console.log(`  ✅ Valid: ${validPrice}`)
    console.log(`  ❌ Invalid: ${invalidPrice}`)
    console.log(`\nAcreage validation:`)
    console.log(`  ✅ Valid: ${validAcres}`)
    console.log(`  ❌ Invalid: ${invalidAcres}`)

    if (outOfRange.length > 0) {
      console.log(`\nOut of range properties (${outOfRange.length}):`)
      outOfRange.slice(0, 5).forEach((p) => {
        console.log(`  - ${p.title}`)
        console.log(`    Price: ${p.price ? `$${p.price.toLocaleString()}` : "N/A"}`)
        console.log(`    Acres: ${p.acres ?? "N/A"}`)
      })
      if (outOfRange.length > 5) {
        console.log(`  ... and ${outOfRange.length - 5} more`)
      }
    }

    console.log("\n" + "=".repeat(70))
    if (invalidPrice === 0 && invalidAcres === 0) {
      console.log("✅ SUCCESS: Server-side filtering is working perfectly!")
      console.log("   All properties are within the specified price and acreage ranges.")
    } else {
      const percentage = (((validPrice + validAcres) / (validPrice + invalidPrice + validAcres + invalidAcres)) * 100).toFixed(1)
      console.log(`⚠️  ${percentage}% of properties are within range`)
      console.log(`   Server-side filtering may need adjustment`)
    }
    console.log("=".repeat(70))

  } catch (error) {
    console.error("\n❌ Error during search:", error)
  }
}

finalValidation().catch(console.error)

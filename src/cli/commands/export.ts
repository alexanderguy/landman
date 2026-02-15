import { Command } from "commander"
import { DatabaseClient } from "../../db/client"
import { PropertyRepository } from "../../db/repository"
import type { PropertyFilters } from "../../db/repository"
import type { Property } from "../../models/property"
import { logger } from "../../utils/logger"
import path from "path"
import fs from "fs"

export const exportCommand = new Command("export")
  .description("Export properties to CSV or JSON")
  .argument("<output>", "Output file path")
  .option("-f, --format <format>", "Export format (csv or json)", "csv")
  .option("-s, --state <state>", "Filter by state code (e.g., MT, ID)")
  .option("--min-price <price>", "Minimum price filter", parseFloat)
  .option("--max-price <price>", "Maximum price filter", parseFloat)
  .option("--min-acres <acres>", "Minimum acreage filter", parseFloat)
  .option("--max-acres <acres>", "Maximum acreage filter", parseFloat)
  .option("--min-score <score>", "Minimum score filter", parseFloat)
  .option("-l, --limit <count>", "Limit number of results", parseInt)
  .action(async (output: string, options) => {
    const dbPath = path.join(process.cwd(), "data", "landbot.db")
    const db = new DatabaseClient(dbPath)
    const repository = new PropertyRepository(db)

    try {
      const format = options.format.toLowerCase()
      if (format !== "csv" && format !== "json") {
        logger.error("Format must be either 'csv' or 'json'")
        process.exit(1)
      }

      const filters: PropertyFilters = {}

      if (options.state) filters.state = options.state
      if (options.minPrice !== undefined) filters.minPrice = options.minPrice
      if (options.maxPrice !== undefined) filters.maxPrice = options.maxPrice
      if (options.minAcres !== undefined) filters.minAcres = options.minAcres
      if (options.maxAcres !== undefined) filters.maxAcres = options.maxAcres
      if (options.minScore !== undefined) filters.minScore = options.minScore

      let properties = repository.findProperties(filters)

      if (options.limit) {
        properties = properties.slice(0, options.limit)
      }

      if (properties.length === 0) {
        logger.error("No properties found matching the filters")
        process.exit(1)
      }

      let content: string
      if (format === "csv") {
        content = exportToCSV(properties)
      } else {
        content = exportToJSON(properties)
      }

      fs.writeFileSync(output, content, "utf-8")
      logger.info(`Exported ${properties.length} properties to ${output}`)
    } catch (error) {
      logger.error(`Failed to export properties: ${error}`)
      process.exit(1)
    } finally {
      db.close()
    }
  })

function exportToCSV(properties: Property[]): string {
  const headers = [
    "ID",
    "Source",
    "Source ID",
    "URL",
    "Title",
    "Description",
    "State",
    "County",
    "City",
    "Address",
    "Latitude",
    "Longitude",
    "Acres",
    "Price",
    "Score",
    "Field Completeness",
    "Has Water",
    "Water Types",
    "Year Round Water",
    "Has Structures",
    "Structure Type",
    "Structure Count",
    "Has Power",
    "Has Water Utility",
    "Has Internet",
    "Has Sewer",
    "Has Gas",
    "Distance To Town (minutes)",
    "Terrain Tags",
    "First Seen",
    "Last Seen",
    "Last Checked",
  ]

  const rows = properties.map((p) => [
    escapeCSV(p.id),
    escapeCSV(p.source),
    escapeCSV(p.source_id),
    escapeCSV(p.url),
    escapeCSV(p.title),
    escapeCSV(p.description || ""),
    escapeCSV(p.state || ""),
    escapeCSV(p.county || ""),
    escapeCSV(p.city || ""),
    escapeCSV(p.address || ""),
    p.coordinates?.latitude?.toString() || "",
    p.coordinates?.longitude?.toString() || "",
    p.acres?.toString() || "",
    p.price?.toString() || "",
    p.score?.toString() || "",
    p.fieldCompleteness?.toString() || "",
    p.waterFeatures?.hasWater?.toString() || "",
    escapeCSV(p.waterFeatures?.types?.join("; ") || ""),
    p.waterFeatures?.yearRound?.toString() || "",
    p.structures?.hasStructures?.toString() || "",
    escapeCSV(p.structures?.type || ""),
    p.structures?.count?.toString() || "",
    p.utilities?.power?.toString() || "",
    p.utilities?.water?.toString() || "",
    p.utilities?.internet?.toString() || "",
    p.utilities?.sewer?.toString() || "",
    p.utilities?.gas?.toString() || "",
    p.distanceToTownMinutes?.toString() || "",
    escapeCSV(p.terrainTags?.join("; ") || ""),
    escapeCSV(p.firstSeen || ""),
    escapeCSV(p.lastSeen || ""),
    escapeCSV(p.lastChecked || ""),
  ])

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportToJSON(properties: Property[]): string {
  return JSON.stringify(properties, null, 2)
}

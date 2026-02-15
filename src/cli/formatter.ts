import Table from "cli-table3"
import type { Property } from "../models/property"
import type { Profile } from "../models/search-criteria"
import type { PropertySnapshot, PropertyRepository } from "../db/repository"

export function formatPropertyTable(properties: Property[]): string {
  const table = new Table({
    head: ["ID", "Title", "State", "Acres", "Price", "Score", "Source"],
    colWidths: [12, 40, 7, 8, 12, 7, 12],
  })

  for (const property of properties) {
    table.push([
      property.id.substring(0, 8),
      truncate(property.title, 38),
      property.state || "N/A",
      property.acres?.toFixed(1) || "N/A",
      property.price ? `$${formatNumber(property.price)}` : "N/A",
      property.score?.toFixed(1) || "N/A",
      property.source,
    ])
  }

  return table.toString()
}

export function formatPropertyTableWithChanges(
  properties: Property[],
  repository: PropertyRepository,
  sinceDate: string | null,
): string {
  const table = new Table({
    head: ["ID", "Title", "State", "Acres", "Price", "Changes", "Source"],
    colWidths: [12, 35, 7, 8, 12, 15, 12],
  })

  for (const property of properties) {
    const changes: string[] = []

    if (sinceDate && property.firstSeen && property.firstSeen > sinceDate) {
      changes.push("🆕 NEW")
    }

    if (property.price !== undefined) {
      const priceHistory = repository.getPriceChanges(property.id)
      if (priceHistory.length > 1) {
        const currentPrice = priceHistory[0]?.price
        const previousPrice = priceHistory[1]?.price

        if (currentPrice !== undefined && previousPrice !== undefined && currentPrice !== previousPrice) {
          const delta = currentPrice - previousPrice
          const sign = delta > 0 ? "+" : ""
          changes.push(`💰 ${sign}$${formatNumber(Math.abs(delta))}`)
        }
      }
    }

    table.push([
      property.id.substring(0, 8),
      truncate(property.title, 33),
      property.state || "N/A",
      property.acres?.toFixed(1) || "N/A",
      property.price ? `$${formatNumber(property.price)}` : "N/A",
      changes.join(" ") || "-",
      property.source,
    ])
  }

  return table.toString()
}

export function formatPropertyDetails(property: Property): string {
  const lines: string[] = []

  lines.push(`Property: ${property.id}`)
  lines.push(`Source: ${property.source} (${property.source_id})`)
  lines.push(`URL: ${property.url}`)
  lines.push("")
  lines.push(`Title: ${property.title}`)
  if (property.description) {
    lines.push(`Description: ${property.description}`)
  }
  lines.push("")
  lines.push(`Location: ${property.city || "Unknown"}, ${property.state || "Unknown"}`)
  if (property.county) {
    lines.push(`County: ${property.county}`)
  }
  if (property.address) {
    lines.push(`Address: ${property.address}`)
  }
  if (property.coordinates) {
    lines.push(`Coordinates: ${property.coordinates.latitude}, ${property.coordinates.longitude}`)
  }
  lines.push("")
  lines.push(`Acres: ${property.acres?.toFixed(2) || "N/A"}`)
  lines.push(`Price: ${property.price ? `$${formatNumber(property.price)}` : "N/A"}`)
  if (property.score !== undefined) {
    lines.push(`Score: ${property.score.toFixed(2)}`)
  }
  if (property.fieldCompleteness !== undefined) {
    lines.push(`Completeness: ${(property.fieldCompleteness * 100).toFixed(1)}%`)
  }
  lines.push("")

  if (property.waterFeatures) {
    lines.push("Water Features:")
    lines.push(`  Has Water: ${property.waterFeatures.hasWater ? "Yes" : "No"}`)
    if (property.waterFeatures.types && property.waterFeatures.types.length > 0) {
      lines.push(`  Types: ${property.waterFeatures.types.join(", ")}`)
    }
    if (property.waterFeatures.yearRound !== undefined) {
      lines.push(`  Year Round: ${property.waterFeatures.yearRound ? "Yes" : "No"}`)
    }
    lines.push("")
  }

  if (property.structures) {
    lines.push("Structures:")
    lines.push(`  Has Structures: ${property.structures.hasStructures ? "Yes" : "No"}`)
    if (property.structures.type) {
      lines.push(`  Type: ${property.structures.type}`)
    }
    if (property.structures.count !== undefined) {
      lines.push(`  Count: ${property.structures.count}`)
    }
    lines.push("")
  }

  if (property.utilities && Object.keys(property.utilities).length > 0) {
    lines.push("Utilities:")
    for (const [key, value] of Object.entries(property.utilities)) {
      lines.push(`  ${capitalize(key)}: ${value ? "Yes" : "No"}`)
    }
    lines.push("")
  }

  if (property.distanceToTownMinutes !== undefined) {
    lines.push(`Distance to Town: ${property.distanceToTownMinutes} minutes`)
    lines.push("")
  }

  if (property.terrainTags && property.terrainTags.length > 0) {
    lines.push(`Terrain: ${property.terrainTags.join(", ")}`)
    lines.push("")
  }

  if (property.firstSeen) {
    lines.push(`First Seen: ${formatDate(property.firstSeen)}`)
  }
  if (property.lastSeen) {
    lines.push(`Last Seen: ${formatDate(property.lastSeen)}`)
  }
  if (property.lastChecked) {
    lines.push(`Last Checked: ${formatDate(property.lastChecked)}`)
  }

  return lines.join("\n")
}

export function formatSnapshotTable(snapshots: PropertySnapshot[]): string {
  const table = new Table({
    head: ["Date", "Price", "Acres", "Title"],
    colWidths: [20, 12, 8, 50],
  })

  for (const snapshot of snapshots) {
    table.push([
      formatDate(snapshot.scrapedAt),
      snapshot.price ? `$${formatNumber(snapshot.price)}` : "N/A",
      snapshot.acres?.toFixed(1) || "N/A",
      truncate(snapshot.title || "N/A", 48),
    ])
  }

  return table.toString()
}

export function formatProfileTable(profiles: Record<string, Profile>, activeProfile: string): string {
  const table = new Table({
    head: ["Active", "Name", "Description", "States", "Plugins"],
    colWidths: [8, 30, 40, 20, 15],
  })

  for (const [key, profile] of Object.entries(profiles)) {
    const isActive = key === activeProfile
    const enabledPlugins = Object.entries(profile.plugins)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name)

    table.push([
      isActive ? "*" : "",
      profile.name,
      truncate(profile.description, 38),
      profile.criteria.states.join(", "),
      enabledPlugins.length.toString(),
    ])
  }

  return table.toString()
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString()
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.substring(0, maxLength - 3) + "..."
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

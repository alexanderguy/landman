import type { Property } from "../models/property"
import type { SearchCriteria } from "../models/search-criteria"
import type { DatabaseClient } from "./client"
import { calculateFieldCompleteness, compareProperties } from "../models/property"
import { logger } from "../utils/logger"

export type PropertyFilters = {
  state?: string
  minPrice?: number
  maxPrice?: number
  minAcres?: number
  maxAcres?: number
  minScore?: number
}

export type PropertySnapshot = {
  id: number
  propertyId: string
  scrapedAt: string
  url: string | null
  title: string | null
  description: string | null
  acres: number | null
  price: number | null
  state: string | null
  county: string | null
  city: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  hasWater: boolean | null
  waterTypes: string | null
  waterYearRound: boolean | null
  hasStructures: boolean | null
  structureType: string | null
  structureCount: number | null
  utilities: string | null
  distanceToTownMinutes: number | null
  terrainTags: string | null
  images: string | null
  rawData: string | null
}

export type PriceChange = {
  price: number
  recordedAt: string
}

export type SearchRunMetadata = {
  profileName: string
  startedAt: string
  completedAt?: string
  propertiesFound: number
  sourcesUsed: string[]
  filtersApplied: Record<string, string[]>
  criteriaSnapshot: SearchCriteria
  errors?: string[]
}

export class PropertyRepository {
  constructor(private db: DatabaseClient) {}

  saveProperty(property: Property): void {
    const completeness = calculateFieldCompleteness(property)
    const now = new Date().toISOString()

    const existing = this.findById(property.id)

    if (!existing) {
      this.insertNewProperty(property, completeness, now)
      this.createSnapshot(property, now)
      logger.debug(`Inserted new property: ${property.id}`)
    } else {
      const hasChanged = compareProperties(existing, property)

      if (hasChanged) {
        this.updateProperty(property, completeness, now)
        this.createSnapshot(property, now)

        if (existing.price !== property.price && property.price !== undefined) {
          this.recordPriceChange(property.id, property.price, now)
          logger.debug(`Price changed for ${property.id}: ${existing.price} -> ${property.price}`)
        }

        logger.debug(`Updated property: ${property.id}`)
      } else {
        this.updateLastChecked(property.id, now)
        logger.debug(`No changes for property: ${property.id}`)
      }
    }
  }

  private insertNewProperty(property: Property, completeness: number, now: string): void {
    const sql = `
      INSERT INTO properties (
        id, source, source_id, url, title, description, acres, price,
        state, county, city, address, latitude, longitude,
        has_water, water_types, water_year_round,
        has_structures, structure_type, structure_count,
        utilities, distance_to_town_minutes, terrain_tags,
        images, raw_data, score, field_completeness,
        first_seen, last_seen, last_checked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    this.db.execute(sql, [
      property.id,
      property.source,
      property.source_id,
      property.url,
      property.title,
      property.description || null,
      property.acres || null,
      property.price || null,
      property.state || null,
      property.county || null,
      property.city || null,
      property.address || null,
      property.coordinates?.latitude || null,
      property.coordinates?.longitude || null,
      property.waterFeatures?.hasWater ? 1 : 0,
      property.waterFeatures?.types ? JSON.stringify(property.waterFeatures.types) : null,
      property.waterFeatures?.yearRound !== undefined ? (property.waterFeatures.yearRound ? 1 : 0) : null,
      property.structures?.hasStructures ? 1 : 0,
      property.structures?.type || null,
      property.structures?.count || null,
      property.utilities ? JSON.stringify(property.utilities) : null,
      property.distanceToTownMinutes || null,
      property.terrainTags ? JSON.stringify(property.terrainTags) : null,
      property.images ? JSON.stringify(property.images) : null,
      property.rawData ? JSON.stringify(property.rawData) : null,
      property.score || null,
      completeness,
      now,
      now,
      now,
    ])
  }

  private updateProperty(property: Property, completeness: number, now: string): void {
    const sql = `
      UPDATE properties SET
        url = ?, title = ?, description = ?, acres = ?, price = ?,
        state = ?, county = ?, city = ?, address = ?, latitude = ?, longitude = ?,
        has_water = ?, water_types = ?, water_year_round = ?,
        has_structures = ?, structure_type = ?, structure_count = ?,
        utilities = ?, distance_to_town_minutes = ?, terrain_tags = ?,
        images = ?, raw_data = ?, score = ?, field_completeness = ?,
        last_seen = ?, last_checked = ?
      WHERE id = ?
    `

    this.db.execute(sql, [
      property.url,
      property.title,
      property.description || null,
      property.acres || null,
      property.price || null,
      property.state || null,
      property.county || null,
      property.city || null,
      property.address || null,
      property.coordinates?.latitude || null,
      property.coordinates?.longitude || null,
      property.waterFeatures?.hasWater ? 1 : 0,
      property.waterFeatures?.types ? JSON.stringify(property.waterFeatures.types) : null,
      property.waterFeatures?.yearRound !== undefined ? (property.waterFeatures.yearRound ? 1 : 0) : null,
      property.structures?.hasStructures ? 1 : 0,
      property.structures?.type || null,
      property.structures?.count || null,
      property.utilities ? JSON.stringify(property.utilities) : null,
      property.distanceToTownMinutes || null,
      property.terrainTags ? JSON.stringify(property.terrainTags) : null,
      property.images ? JSON.stringify(property.images) : null,
      property.rawData ? JSON.stringify(property.rawData) : null,
      property.score || null,
      completeness,
      now,
      now,
      property.id,
    ])
  }

  private updateLastChecked(id: string, now: string): void {
    this.db.execute("UPDATE properties SET last_checked = ? WHERE id = ?", [now, id])
  }

  private createSnapshot(property: Property, scrapedAt: string): void {
    const sql = `
      INSERT INTO property_snapshots (
        property_id, scraped_at, url, title, description, acres, price,
        state, county, city, address, latitude, longitude,
        has_water, water_types, water_year_round,
        has_structures, structure_type, structure_count,
        utilities, distance_to_town_minutes, terrain_tags,
        images, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    this.db.execute(sql, [
      property.id,
      scrapedAt,
      property.url,
      property.title,
      property.description || null,
      property.acres || null,
      property.price || null,
      property.state || null,
      property.county || null,
      property.city || null,
      property.address || null,
      property.coordinates?.latitude || null,
      property.coordinates?.longitude || null,
      property.waterFeatures?.hasWater ? 1 : 0,
      property.waterFeatures?.types ? JSON.stringify(property.waterFeatures.types) : null,
      property.waterFeatures?.yearRound !== undefined ? (property.waterFeatures.yearRound ? 1 : 0) : null,
      property.structures?.hasStructures ? 1 : 0,
      property.structures?.type || null,
      property.structures?.count || null,
      property.utilities ? JSON.stringify(property.utilities) : null,
      property.distanceToTownMinutes || null,
      property.terrainTags ? JSON.stringify(property.terrainTags) : null,
      property.images ? JSON.stringify(property.images) : null,
      property.rawData ? JSON.stringify(property.rawData) : null,
    ])
  }

  private recordPriceChange(propertyId: string, price: number, recordedAt: string): void {
    this.db.execute("INSERT INTO price_history (property_id, price, recorded_at) VALUES (?, ?, ?)", [
      propertyId,
      price,
      recordedAt,
    ])
  }

  findById(id: string): Property | null {
    const row = this.db.queryOne<DbPropertyRow>(
      "SELECT * FROM properties WHERE id = ?",
      [id]
    )

    return row ? this.rowToProperty(row) : null
  }

  findProperties(filters?: PropertyFilters): Property[] {
    let sql = "SELECT * FROM properties WHERE 1=1"
    const params: (string | number)[] = []

    if (filters?.state) {
      sql += " AND state = ?"
      params.push(filters.state)
    }

    if (filters?.minPrice !== undefined) {
      sql += " AND price >= ?"
      params.push(filters.minPrice)
    }

    if (filters?.maxPrice !== undefined) {
      sql += " AND price <= ?"
      params.push(filters.maxPrice)
    }

    if (filters?.minAcres !== undefined) {
      sql += " AND acres >= ?"
      params.push(filters.minAcres)
    }

    if (filters?.maxAcres !== undefined) {
      sql += " AND acres <= ?"
      params.push(filters.maxAcres)
    }

    if (filters?.minScore !== undefined) {
      sql += " AND score >= ?"
      params.push(filters.minScore)
    }

    sql += " ORDER BY score DESC, last_seen DESC"

    const rows = this.db.query<DbPropertyRow>(sql, params)
    return rows.map((row) => this.rowToProperty(row))
  }

  getPropertySnapshots(propertyId: string): PropertySnapshot[] {
    return this.db.query<PropertySnapshot>(
      "SELECT * FROM property_snapshots WHERE property_id = ? ORDER BY scraped_at DESC, id DESC",
      [propertyId]
    )
  }

  getNewProperties(since: string): Property[] {
    const rows = this.db.query<DbPropertyRow>("SELECT * FROM properties WHERE first_seen > ? ORDER BY first_seen DESC", [
      since,
    ])
    return rows.map((row) => this.rowToProperty(row))
  }

  getPriceChanges(propertyId: string): PriceChange[] {
    return this.db.query<PriceChange>(
      "SELECT price, recorded_at as recordedAt FROM price_history WHERE property_id = ? ORDER BY recorded_at DESC",
      [propertyId]
    )
  }

  recordSearchRun(metadata: SearchRunMetadata): void {
    const sql = `
      INSERT INTO search_runs (
        profile_name, started_at, completed_at, properties_found,
        sources_used, filters_applied, criteria_snapshot, errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `

    this.db.execute(sql, [
      metadata.profileName,
      metadata.startedAt,
      metadata.completedAt || null,
      metadata.propertiesFound,
      JSON.stringify(metadata.sourcesUsed),
      JSON.stringify(metadata.filtersApplied),
      JSON.stringify(metadata.criteriaSnapshot),
      metadata.errors ? JSON.stringify(metadata.errors) : null,
    ])
  }

  getLastSearchDate(profileName?: string): string | null {
    const sql = profileName
      ? "SELECT MAX(completed_at) as last_search FROM search_runs WHERE profile_name = ? AND completed_at IS NOT NULL"
      : "SELECT MAX(completed_at) as last_search FROM search_runs WHERE completed_at IS NOT NULL"

    const params = profileName ? [profileName] : []
    const result = this.db.queryOne<{ last_search: string | null }>(sql, params)
    return result?.last_search || null
  }

  getPropertiesWithPriceChanges(since?: string): Property[] {
    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const sql = `
      SELECT DISTINCT p.* FROM properties p
      INNER JOIN price_history ph ON p.id = ph.property_id
      WHERE ph.recorded_at > ?
      ORDER BY ph.recorded_at DESC
    `

    const rows = this.db.query<DbPropertyRow>(sql, [sinceDate])
    return rows.map((row) => this.rowToProperty(row))
  }

  markDuplicates(canonicalId: string, duplicateIds: string[], method: string, confidence: number): void {
    const detectedAt = new Date().toISOString()

    for (const duplicateId of duplicateIds) {
      if (duplicateId === canonicalId) continue

      this.db.execute(
        `INSERT OR IGNORE INTO property_duplicates (canonical_id, duplicate_id, match_method, confidence, detected_at)
         VALUES (?, ?, ?, ?, ?)`,
        [canonicalId, duplicateId, method, confidence, detectedAt]
      )
    }
  }

  private rowToProperty(row: DbPropertyRow): Property {
    return {
      id: row.id,
      source: row.source,
      source_id: row.source_id,
      url: row.url,
      title: row.title,
      description: row.description || undefined,
      acres: row.acres || undefined,
      price: row.price || undefined,
      state: row.state || undefined,
      county: row.county || undefined,
      city: row.city || undefined,
      address: row.address || undefined,
      coordinates:
        row.latitude && row.longitude
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
            }
          : undefined,
      waterFeatures: row.has_water
        ? {
            hasWater: Boolean(row.has_water),
            types: row.water_types ? JSON.parse(row.water_types) : undefined,
            yearRound: row.water_year_round !== null ? Boolean(row.water_year_round) : undefined,
          }
        : undefined,
      structures:
        row.has_structures || row.structure_type || row.structure_count
          ? {
              hasStructures: Boolean(row.has_structures),
              type: (row.structure_type as any) || undefined,
              count: row.structure_count || undefined,
            }
          : undefined,
      utilities: row.utilities ? JSON.parse(row.utilities) : undefined,
      distanceToTownMinutes: row.distance_to_town_minutes || undefined,
      terrainTags: row.terrain_tags ? JSON.parse(row.terrain_tags) : undefined,
      images: row.images ? JSON.parse(row.images) : undefined,
      rawData: row.raw_data ? JSON.parse(row.raw_data) : undefined,
      score: row.score || undefined,
      fieldCompleteness: row.field_completeness || undefined,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      lastChecked: row.last_checked,
    }
  }
}

type DbPropertyRow = {
  id: string
  source: string
  source_id: string
  url: string
  title: string
  description: string | null
  acres: number | null
  price: number | null
  state: string | null
  county: string | null
  city: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  has_water: number | null
  water_types: string | null
  water_year_round: number | null
  has_structures: number | null
  structure_type: string | null
  structure_count: number | null
  utilities: string | null
  distance_to_town_minutes: number | null
  terrain_tags: string | null
  images: string | null
  raw_data: string | null
  score: number | null
  field_completeness: number | null
  first_seen: string
  last_seen: string
  last_checked: string
}

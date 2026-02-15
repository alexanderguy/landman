// Shared types and enums for the property search system

export type WaterType = "creek" | "pond" | "lake" | "well" | "river" | "spring"

export type StructureType = "house" | "cabin" | "barn" | "raw-land"

export type TerrainType = "forested" | "mountain" | "green" | "desert" | "prairie"

export type Coordinates = {
  latitude: number
  longitude: number
}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

import type { PropertySource, DeduplicationPlugin } from "./types"
import { logger } from "../utils/logger"
import { readdirSync } from "fs"
import { join } from "path"

export type PluginRegistry = {
  sources: Map<string, PropertySource>
  deduplicationPlugins: Map<string, DeduplicationPlugin>
}

const registry: PluginRegistry = {
  sources: new Map(),
  deduplicationPlugins: new Map(),
}

export function registerPropertySource(plugin: PropertySource): void {
  const name = plugin.metadata.name
  if (registry.sources.has(name)) {
    logger.warn(`Property source plugin '${name}' is already registered`)
    return
  }
  registry.sources.set(name, plugin)
  logger.debug(
    `Registered property source: ${plugin.metadata.displayName} (${name}) v${plugin.metadata.version}`,
  )
}

export function registerDeduplicationPlugin(plugin: DeduplicationPlugin): void {
  if (registry.deduplicationPlugins.has(plugin.name)) {
    logger.warn(`Deduplication plugin '${plugin.name}' is already registered`)
    return
  }
  registry.deduplicationPlugins.set(plugin.name, plugin)
  logger.debug(`Registered deduplication plugin: ${plugin.name}`)
}

export function getPropertySource(name: string): PropertySource | undefined {
  return registry.sources.get(name)
}

export function getAllPropertySources(): PropertySource[] {
  return Array.from(registry.sources.values())
}

export function getDeduplicationPlugin(name: string): DeduplicationPlugin | undefined {
  return registry.deduplicationPlugins.get(name)
}

export function getAllDeduplicationPlugins(): DeduplicationPlugin[] {
  return Array.from(registry.deduplicationPlugins.values())
}

export function clearRegistry(): void {
  registry.sources.clear()
  registry.deduplicationPlugins.clear()
}

export async function discoverPlugins(): Promise<void> {
  const sourcesDir = join(__dirname, "sources")
  const deduplicationDir = join(__dirname, "deduplication")

  try {
    const sourceFiles = readdirSync(sourcesDir).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js"),
    )

    for (const file of sourceFiles) {
      try {
        const modulePath = join(sourcesDir, file)
        const module = await import(modulePath)

        if (module.default && typeof module.default === "object" && "metadata" in module.default) {
          registerPropertySource(module.default as PropertySource)
        }
      } catch (error) {
        logger.error(`Failed to load property source plugin from ${file}: ${error}`)
      }
    }
  } catch (error) {
    logger.debug(`Sources directory not found or empty: ${sourcesDir}`)
  }

  try {
    const dedupFiles = readdirSync(deduplicationDir).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js"),
    )

    for (const file of dedupFiles) {
      try {
        const modulePath = join(deduplicationDir, file)
        const module = await import(modulePath)

        if (module.default && typeof module.default === "object" && "name" in module.default) {
          registerDeduplicationPlugin(module.default as DeduplicationPlugin)
        }
      } catch (error) {
        logger.error(`Failed to load deduplication plugin from ${file}: ${error}`)
      }
    }
  } catch (error) {
    logger.debug(`Deduplication directory not found or empty: ${deduplicationDir}`)
  }
}

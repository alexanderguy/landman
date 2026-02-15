import { createHash } from "crypto"

export function generatePropertyId(source: string, sourceId: string): string {
  const input = `${source}:${sourceId}`
  const hash = createHash("sha256")
  hash.update(input)
  return hash.digest("hex").substring(0, 16)
}

export function hashObject(obj: unknown): string {
  const json = JSON.stringify(obj)
  const hash = createHash("sha256")
  hash.update(json)
  return hash.digest("hex")
}

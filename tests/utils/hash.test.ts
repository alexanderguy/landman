import { test, expect } from "bun:test"
import { generatePropertyId, hashObject } from "../../src/utils/hash"

test("generatePropertyId creates stable hash", () => {
  const id1 = generatePropertyId("landwatch", "12345")
  const id2 = generatePropertyId("landwatch", "12345")

  expect(id1).toBe(id2)
  expect(id1.length).toBe(16)
})

test("generatePropertyId creates different hashes for different inputs", () => {
  const id1 = generatePropertyId("landwatch", "12345")
  const id2 = generatePropertyId("landwatch", "67890")
  const id3 = generatePropertyId("zillow", "12345")

  expect(id1).not.toBe(id2)
  expect(id1).not.toBe(id3)
  expect(id2).not.toBe(id3)
})

test("hashObject creates consistent hash", () => {
  const obj = { foo: "bar", baz: 123 }
  const hash1 = hashObject(obj)
  const hash2 = hashObject(obj)

  expect(hash1).toBe(hash2)
})

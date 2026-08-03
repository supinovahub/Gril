import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const scannedExtensions = new Set([".css", ".js", ".json", ".jsx", ".md", ".sql", ".ts", ".tsx"]);
const scannedRoots = ["docs", "src", path.join("supabase", "migrations")];
const mojibakeMarkers = [
  "c383c2a0", "c383c2a1", "c383c2a2", "c383c2a3", "c383c2a4", "c383c2a7",
  "c383c2a8", "c383c2a9", "c383c2aa", "c383c2ab", "c383c2ac", "c383c2ad",
  "c383c2ae", "c383c2af", "c383c2b1", "c383c2b2", "c383c2b3", "c383c2b4",
  "c383c2b5", "c383c2b6", "c383c2b9", "c383c2ba", "c383c2bb", "c383c2bc",
  "c383c692", "c383e280a1", "c3a2e282ace2809d", "c3a2c280c294",
].map((hex) => Buffer.from(hex, "hex").toString("utf8"));

function findMalformedFiles(relativeDirectory: string): string[] {
  const directory = path.join(process.cwd(), relativeDirectory);
  const malformedFiles: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      malformedFiles.push(...findMalformedFiles(relativePath));
      continue;
    }
    if (!scannedExtensions.has(path.extname(entry.name))) continue;

    const content = readFileSync(path.join(process.cwd(), relativePath), "utf8");
    if (mojibakeMarkers.some((marker) => content.includes(marker))) malformedFiles.push(relativePath);
  }

  return malformedFiles;
}

describe("integridade de codificação", () => {
  it("mantém os textos do produto em UTF-8 válido, sem mojibake conhecido", () => {
    const malformedFiles = scannedRoots.flatMap(findMalformedFiles);
    expect(malformedFiles).toEqual([]);
  });
});

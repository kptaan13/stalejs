const UNITS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
}

/**
 * Parse a human-readable TTL string into milliseconds.
 * Accepts: '500ms', '30s', '5m', '1h', or a raw number (treated as ms).
 */
export function parseTTL(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) {
      throw new RangeError(`stale: invalid TTL number "${input}"`)
    }
    return input
  }

  const match = input.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/)
  if (!match) {
    throw new Error(`stale: unrecognized TTL format "${input}". Use '500ms', '30s', '5m', or '1h'.`)
  }

  return parseFloat(match[1]) * UNITS[match[2]]
}

import { describe, it, expect } from 'vitest'
import { parseTTL } from '../src/parse-ttl'

describe('parseTTL', () => {
  it('parses ms suffix', () => {
    expect(parseTTL('500ms')).toBe(500)
    expect(parseTTL('1ms')).toBe(1)
    expect(parseTTL('1000ms')).toBe(1000)
  })

  it('parses s suffix', () => {
    expect(parseTTL('1s')).toBe(1_000)
    expect(parseTTL('30s')).toBe(30_000)
    expect(parseTTL('90s')).toBe(90_000)
  })

  it('parses m suffix', () => {
    expect(parseTTL('1m')).toBe(60_000)
    expect(parseTTL('5m')).toBe(300_000)
    expect(parseTTL('60m')).toBe(3_600_000)
  })

  it('parses h suffix', () => {
    expect(parseTTL('1h')).toBe(3_600_000)
    expect(parseTTL('2h')).toBe(7_200_000)
  })

  it('passes raw numbers through as ms', () => {
    expect(parseTTL(0)).toBe(0)
    expect(parseTTL(2000)).toBe(2000)
    expect(parseTTL(500)).toBe(500)
  })

  it('parses decimal values', () => {
    expect(parseTTL('1.5s')).toBe(1500)
    expect(parseTTL('0.5m')).toBe(30_000)
  })

  it('throws on unrecognized format', () => {
    expect(() => parseTTL('30 seconds')).toThrow()
    expect(() => parseTTL('abc')).toThrow()
    expect(() => parseTTL('')).toThrow()
    expect(() => parseTTL('5d')).toThrow()
  })

  it('throws on negative numbers', () => {
    expect(() => parseTTL(-1)).toThrow()
  })

  it('throws on Infinity', () => {
    expect(() => parseTTL(Infinity)).toThrow()
  })
})

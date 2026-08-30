import { describe, expect, it } from 'vitest'
import {
  formatFromPlayerCount,
  formatLabel,
  formatLabelFromPlayerCount,
  isScrimFormat,
  playerCountForFormat,
} from './format'

describe('scrim format', () => {
  it('maps even player counts to NvN', () => {
    expect(formatFromPlayerCount(8)).toBe(4)
    expect(formatFromPlayerCount(10)).toBe(5)
    expect(formatFromPlayerCount(12)).toBe(6)
    expect(formatFromPlayerCount(14)).toBe(7)
    expect(formatFromPlayerCount(16)).toBe(8)
  })

  it('rejects odd or out-of-range counts', () => {
    expect(formatFromPlayerCount(7)).toBeNull()
    expect(formatFromPlayerCount(6)).toBeNull()
    expect(formatFromPlayerCount(18)).toBeNull()
    expect(isScrimFormat(3)).toBe(false)
  })

  it('labels formats and falls back for unknown sizes', () => {
    expect(formatLabel(6)).toBe('6v6')
    expect(playerCountForFormat(6)).toBe(12)
    expect(formatLabelFromPlayerCount(12)).toBe('6v6')
    expect(formatLabelFromPlayerCount(9)).toBe('9 players')
  })
})

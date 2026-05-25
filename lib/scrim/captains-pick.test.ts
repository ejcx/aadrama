import { describe, expect, it } from 'vitest'
import { isCaptainsPickBlocked } from './captains-pick'

describe('isCaptainsPickBlocked', () => {
  it('blocks joe131 regardless of case', () => {
    expect(isCaptainsPickBlocked('joe131')).toBe(true)
    expect(isCaptainsPickBlocked('Joe131')).toBe(true)
  })

  it('allows other usernames', () => {
    expect(isCaptainsPickBlocked('other_user')).toBe(false)
    expect(isCaptainsPickBlocked(null)).toBe(false)
    expect(isCaptainsPickBlocked(undefined)).toBe(false)
  })
})

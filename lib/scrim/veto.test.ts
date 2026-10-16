import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TIERED_MAPS } from './tiered-maps'
import { mapImagePath, tallyVetoVotes, tallyWithPendingVote, vetoLeaders } from './veto'

const OPTIONS = ['Pipeline', 'Insurgent Camp', 'Dusk', 'Canyon']

function votes(...maps: (string | null)[]) {
  return maps.map((veto_map_vote, i) => ({ user_name: `p${i + 1}`, veto_map_vote }))
}

describe('tallyVetoVotes', () => {
  it('counts votes per option in the offered order', () => {
    const tally = tallyVetoVotes(OPTIONS, votes('Dusk', 'Pipeline', 'Dusk', null, 'Canyon'))
    expect(tally.map((t) => t.map)).toEqual(OPTIONS)
    expect(tally.map((t) => t.votes)).toEqual([1, 0, 2, 1])
    expect(tally[2].voters).toEqual(['p1', 'p3'])
  })

  it('ignores missing votes and votes for maps that were not offered', () => {
    const tally = tallyVetoVotes(OPTIONS, votes(null, 'Urban Assault', 'Pipeline'))
    expect(tally.reduce((sum, t) => sum + t.votes, 0)).toBe(1)
  })

  it('returns zero for every option when nobody has voted', () => {
    expect(tallyVetoVotes(OPTIONS, []).every((t) => t.votes === 0 && t.voters.length === 0)).toBe(true)
  })
})

describe('vetoLeaders', () => {
  it('returns the single map with the most votes', () => {
    expect(vetoLeaders(tallyVetoVotes(OPTIONS, votes('Dusk', 'Dusk', 'Pipeline')))).toEqual(['Dusk'])
  })

  it('returns every map tied for first (4/4 and 6/6)', () => {
    const four = votes(...Array(4).fill('Pipeline'), ...Array(4).fill('Canyon'))
    expect(vetoLeaders(tallyVetoVotes(OPTIONS, four))).toEqual(['Pipeline', 'Canyon'])
    const six = votes(...Array(6).fill('Dusk'), ...Array(6).fill('Insurgent Camp'))
    expect(vetoLeaders(tallyVetoVotes(OPTIONS, six))).toEqual(['Insurgent Camp', 'Dusk'])
  })

  it('has no leader before the first vote', () => {
    expect(vetoLeaders(tallyVetoVotes(OPTIONS, votes(null, null)))).toEqual([])
  })
})

describe('mapImagePath', () => {
  it('slugs the display name', () => {
    expect(mapImagePath('MOUT McKenna')).toBe('/maps/mout-mckenna.webp')
    expect(mapImagePath('[AA3] Impact')).toBe('/maps/aa3-impact.webp')
    expect(mapImagePath('SMU GH SFOldTown')).toBe('/maps/smu-gh-sfoldtown.webp')
  })

  it('returns null for maps outside the tiered pool', () => {
    expect(mapImagePath('ESL Dusk')).toBeNull()
    expect(mapImagePath('')).toBeNull()
  })

  it('has an image file for every tiered-pool map', () => {
    const missing = TIERED_MAPS.map((m) => mapImagePath(m.name)).filter(
      (p) => !p || !existsSync(path.join(__dirname, '..', '..', 'public', p))
    )
    expect(missing).toEqual([])
  })
})

describe('tallyWithPendingVote', () => {
  const tally = tallyVetoVotes(OPTIONS, votes('Dusk', 'Pipeline', 'Dusk'))
  const counts = (t: { votes: number }[]) => t.map((o) => o.votes)

  it('adds a first vote', () => {
    expect(counts(tallyWithPendingVote(tally, null, 'Canyon'))).toEqual([1, 0, 2, 1])
  })

  it('moves a changed vote from the old map to the new one', () => {
    expect(counts(tallyWithPendingVote(tally, 'Dusk', 'Pipeline'))).toEqual([2, 0, 1, 0])
  })

  it('changes nothing with no pending vote, or once the server already shows it', () => {
    expect(counts(tallyWithPendingVote(tally, 'Dusk', null))).toEqual([1, 0, 2, 0])
    expect(counts(tallyWithPendingVote(tally, 'Dusk', 'Dusk'))).toEqual([1, 0, 2, 0])
  })

  it('only adds when the old vote was for a map that is no longer offered', () => {
    expect(counts(tallyWithPendingVote(tally, 'Urban Assault', 'Canyon'))).toEqual([1, 0, 2, 1])
  })

  it('ignores a pending vote for a map that is not offered', () => {
    expect(counts(tallyWithPendingVote(tally, 'Dusk', 'Urban Assault'))).toEqual([1, 0, 2, 0])
  })

  it('does not change the tally it was given', () => {
    tallyWithPendingVote(tally, 'Dusk', 'Pipeline')
    expect(counts(tally)).toEqual([1, 0, 2, 0])
  })
})

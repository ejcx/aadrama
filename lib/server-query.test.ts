import { describe, expect, it } from 'vitest'
import { enrichLiveServerInfo } from './server-query'

describe('enrichLiveServerInfo', () => {
  it('maps all_fields.roe_N onto players by original index', () => {
    const enriched = enrichLiveServerInfo({
      server_name: 'Test',
      map_name: 'Pool Day',
      game_mode: '8.23',
      players: 2,
      max_players: 32,
      password: false,
      ping: '10ms',
      player_list: [
        { name: 'A', ping: 40, kills: 30, deaths: 10, honor: 100, roe: 0 },
        { name: 'B', ping: 50, kills: 10, deaths: 20, honor: 50, roe: 0 },
      ],
      all_fields: {
        roe_0: '0',
        roe_1: '-20',
      },
      goal_team0: 58,
      goal_team1: 57,
      current_round: '3/12',
      roe_team1: -20,
    })

    expect(enriched.player_list[0].roe).toBe(0)
    expect(enriched.player_list[1].roe).toBe(20)
    expect(enriched.goal_team0).toBe(58)
    expect(enriched.roe_team1).toBe(20)
    expect(enriched.current_round).toBe('3/12')
  })
})

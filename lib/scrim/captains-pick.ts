const BLOCKED_CAPTAINS_PICK_USERNAME = 'joe131'

export function isCaptainsPickBlocked(username: string | null | undefined): boolean {
  return username?.toLowerCase() === BLOCKED_CAPTAINS_PICK_USERNAME
}

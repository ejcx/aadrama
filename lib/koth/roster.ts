/** Build a stable roster key from Clerk user IDs (sorted, joined). */
export function buildRosterKey(userIds: string[]): string {
  return [...userIds].sort().join('|')
}

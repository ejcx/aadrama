"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { ADMIN_USER_ID } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import {
  FALL_CLASSIC_ID,
  matchMediaKey,
  normalizeMatchMedia,
  type MatchMedia,
  type MatchMediaLink,
} from "@/lib/tournaments/media"

export async function isTournamentAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth()
    return userId === ADMIN_USER_ID
  } catch {
    return false
  }
}

export async function getTournamentMatchMedia(
  tournamentId: string = FALL_CLASSIC_ID
): Promise<Record<string, MatchMedia>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tournament_match_media")
    .select("week, home, away, streams, clips")
    .eq("tournament_id", tournamentId)

  if (error || !data) return {}

  return Object.fromEntries(
    data.map((row) => [
      matchMediaKey(row.week, row.home, row.away),
      normalizeMatchMedia({ streams: row.streams, clips: row.clips }),
    ])
  )
}

export async function saveTournamentMatchMedia(input: {
  tournamentId?: string
  week: number
  home: string
  away: string
  streams: MatchMediaLink[]
  clips: MatchMediaLink[]
}): Promise<{ success: boolean; error?: string; media?: MatchMedia }> {
  if (!(await isTournamentAdmin())) {
    return { success: false, error: "Unauthorized: Admin access required" }
  }

  const media = normalizeMatchMedia({
    streams: input.streams,
    clips: input.clips,
  })
  const tournamentId = input.tournamentId ?? FALL_CLASSIC_ID
  const supabase = await createClient()
  const { error } = await supabase.from("tournament_match_media").upsert(
    {
      tournament_id: tournamentId,
      week: input.week,
      home: input.home,
      away: input.away,
      streams: media.streams,
      clips: media.clips,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tournament_id,week,home,away" }
  )

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/2026-fall-classic")
  return { success: true, media }
}

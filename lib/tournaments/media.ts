export const FALL_CLASSIC_ID = "fall-2026"

export type MediaSlot = "stream" | "clip"

export type MatchMediaLink = {
  id: string
  url: string
  title?: string
}

export type MatchMedia = {
  streams: MatchMediaLink[]
  clips: MatchMediaLink[]
}

export type MatchMediaRecord = MatchMedia & {
  week: number
  home: string
  away: string
}

export type MediaProvider = "twitch" | "youtube"

export type ParsedMedia = {
  provider: MediaProvider
  kind: "channel" | "video" | "clip"
  id: string
  watchUrl: string
}

export function matchMediaKey(week: number, home: string, away: string) {
  return `${week}:${home}:${away}`
}

export function emptyMatchMedia(): MatchMedia {
  return { streams: [], clips: [] }
}

function youtubeWatchUrl(id: string, kind: ParsedMedia["kind"]) {
  if (kind === "clip") return `https://www.youtube.com/clip/${id}`
  return `https://www.youtube.com/watch?v=${id}`
}

function twitchWatchUrl(id: string, kind: ParsedMedia["kind"]) {
  if (kind === "clip") return `https://clips.twitch.tv/${id}`
  if (kind === "channel") return `https://www.twitch.tv/${id}`
  return `https://www.twitch.tv/videos/${id}`
}

export function parseMediaUrl(raw: string): ParsedMedia | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase()
  const parts = url.pathname.split("/").filter(Boolean)

  if (host === "clips.twitch.tv") {
    const id = parts[0]
    if (!id || id === "embed") return null
    return {
      provider: "twitch",
      kind: "clip",
      id,
      watchUrl: twitchWatchUrl(id, "clip"),
    }
  }

  if (host === "twitch.tv") {
    if (parts[0] === "videos" && parts[1]) {
      const id = parts[1].replace(/^v/, "")
      return {
        provider: "twitch",
        kind: "video",
        id,
        watchUrl: twitchWatchUrl(id, "video"),
      }
    }
    if (parts[1] === "clip" && parts[2]) {
      return {
        provider: "twitch",
        kind: "clip",
        id: parts[2],
        watchUrl: twitchWatchUrl(parts[2], "clip"),
      }
    }
    const reserved = new Set([
      "directory",
      "p",
      "settings",
      "turbo",
      "search",
      "downloads",
    ])
    if (parts.length === 1 && parts[0] && !reserved.has(parts[0])) {
      return {
        provider: "twitch",
        kind: "channel",
        id: parts[0],
        watchUrl: twitchWatchUrl(parts[0], "channel"),
      }
    }
    return null
  }

  const youtubeHosts = new Set(["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"])
  if (!youtubeHosts.has(host)) return null

  if (host === "youtu.be" && parts[0]) {
    return {
      provider: "youtube",
      kind: "video",
      id: parts[0],
      watchUrl: youtubeWatchUrl(parts[0], "video"),
    }
  }

  if (parts[0] === "clip" && parts[1]) {
    return {
      provider: "youtube",
      kind: "clip",
      id: parts[1],
      watchUrl: youtubeWatchUrl(parts[1], "clip"),
    }
  }

  const clipParam = url.searchParams.get("clip")
  if (clipParam) {
    return {
      provider: "youtube",
      kind: "clip",
      id: clipParam,
      watchUrl: youtubeWatchUrl(clipParam, "clip"),
    }
  }

  const videoId =
    url.searchParams.get("v") ||
    (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live"
      ? parts[1]
      : undefined)
  if (videoId) {
    return {
      provider: "youtube",
      kind: "video",
      id: videoId,
      watchUrl: youtubeWatchUrl(videoId, "video"),
    }
  }

  return null
}

export function twitchParentParams(hostnames: string[]) {
  const unique = Array.from(
    new Set(hostnames.filter(Boolean).map((h) => h.replace(/^www\./, "")))
  )
  const withWww = unique.flatMap((h) =>
    h === "localhost" || h.endsWith(".localhost") ? [h] : [h, `www.${h}`]
  )
  return Array.from(new Set(withWww))
}

export function embedSrc(parsed: ParsedMedia, parents: string[]): string {
  if (parsed.provider === "youtube") {
    if (parsed.kind === "clip") {
      return `https://www.youtube.com/embed?clip=${encodeURIComponent(parsed.id)}`
    }
    return `https://www.youtube.com/embed/${encodeURIComponent(parsed.id)}`
  }

  const parent = twitchParentParams(parents)
    .map((p) => `parent=${encodeURIComponent(p)}`)
    .join("&")

  if (parsed.kind === "clip") {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(parsed.id)}&${parent}`
  }
  if (parsed.kind === "channel") {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(parsed.id)}&${parent}`
  }
  return `https://player.twitch.tv/?video=${encodeURIComponent(parsed.id)}&${parent}`
}

export function normalizeMediaLink(
  item: Partial<MatchMediaLink> & { url: string }
): MatchMediaLink | null {
  const parsed = parseMediaUrl(item.url)
  if (!parsed) return null
  const title = item.title?.trim()
  return {
    id: item.id || crypto.randomUUID(),
    url: parsed.watchUrl,
    ...(title ? { title } : {}),
  }
}

export function normalizeMatchMedia(input: {
  streams?: unknown
  clips?: unknown
}): MatchMedia {
  const asLinks = (value: unknown): MatchMediaLink[] => {
    if (!Array.isArray(value)) return []
    return value
      .map((entry) => {
        if (typeof entry === "string") return normalizeMediaLink({ url: entry })
        if (entry && typeof entry === "object" && "url" in entry) {
          const rec = entry as { id?: string; url?: string; title?: string }
          if (typeof rec.url !== "string") return null
          return normalizeMediaLink({
            id: typeof rec.id === "string" ? rec.id : undefined,
            url: rec.url,
            title: typeof rec.title === "string" ? rec.title : undefined,
          })
        }
        return null
      })
      .filter((item): item is MatchMediaLink => Boolean(item))
  }

  return {
    streams: asLinks(input.streams),
    clips: asLinks(input.clips),
  }
}

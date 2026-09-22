import { describe, expect, it } from "vitest"
import {
  embedSrc,
  matchMediaKey,
  normalizeMatchMedia,
  parseMediaUrl,
  twitchParentParams,
} from "./media"

describe("parseMediaUrl", () => {
  it("parses twitch clips, vods, and channels", () => {
    expect(parseMediaUrl("https://clips.twitch.tv/CoolClip-abc")).toMatchObject({
      provider: "twitch",
      kind: "clip",
      id: "CoolClip-abc",
    })
    expect(
      parseMediaUrl("https://www.twitch.tv/re1ativity2/clip/CoolClip-abc")
    ).toMatchObject({
      provider: "twitch",
      kind: "clip",
      id: "CoolClip-abc",
    })
    expect(parseMediaUrl("https://www.twitch.tv/videos/123456789")).toMatchObject({
      provider: "twitch",
      kind: "video",
      id: "123456789",
    })
    expect(parseMediaUrl("https://www.twitch.tv/re1ativity2")).toMatchObject({
      provider: "twitch",
      kind: "channel",
      id: "re1ativity2",
    })
  })

  it("parses youtube watch, short, and clip urls", () => {
    expect(parseMediaUrl("https://youtu.be/dQw4w9wgGcQ")).toMatchObject({
      provider: "youtube",
      kind: "video",
      id: "dQw4w9wgGcQ",
    })
    expect(
      parseMediaUrl("https://www.youtube.com/watch?v=dQw4w9wgGcQ")
    ).toMatchObject({
      provider: "youtube",
      kind: "video",
      id: "dQw4w9wgGcQ",
    })
    expect(parseMediaUrl("https://youtube.com/shorts/dQw4w9wgGcQ")).toMatchObject({
      provider: "youtube",
      kind: "video",
      id: "dQw4w9wgGcQ",
    })
    expect(parseMediaUrl("https://www.youtube.com/clip/UgkxClipId")).toMatchObject({
      provider: "youtube",
      kind: "clip",
      id: "UgkxClipId",
    })
  })

  it("rejects unknown hosts", () => {
    expect(parseMediaUrl("https://vimeo.com/123")).toBeNull()
    expect(parseMediaUrl("not a url")).toBeNull()
  })
})

describe("embedSrc", () => {
  it("builds twitch embeds with parent hosts", () => {
    const parsed = parseMediaUrl("https://www.twitch.tv/videos/99")!
    const src = embedSrc(parsed, ["aadrama.com", "localhost"])
    expect(src).toContain("player.twitch.tv/?video=99")
    expect(src).toContain("parent=aadrama.com")
    expect(src).toContain("parent=www.aadrama.com")
    expect(src).toContain("parent=localhost")
  })
})

describe("normalizeMatchMedia", () => {
  it("accepts url strings and objects", () => {
    const media = normalizeMatchMedia({
      streams: ["https://www.twitch.tv/videos/1"],
      clips: [{ url: "https://youtu.be/dQw4w9wgGcQ", title: "Ace" }],
    })
    expect(media.streams[0].url).toBe("https://www.twitch.tv/videos/1")
    expect(media.clips[0].title).toBe("Ace")
    expect(matchMediaKey(2, "bart", "drob")).toBe("2:bart:drob")
  })

  it("drops unparseable entries", () => {
    const media = normalizeMatchMedia({
      streams: ["https://example.com/nope"],
      clips: [],
    })
    expect(media.streams).toEqual([])
  })
})

describe("twitchParentParams", () => {
  it("includes www variants except localhost", () => {
    expect(twitchParentParams(["www.aadrama.com", "localhost"])).toEqual(
      expect.arrayContaining(["aadrama.com", "www.aadrama.com", "localhost"])
    )
  })
})

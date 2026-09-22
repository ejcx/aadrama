"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import {
  getMatchResult,
  getTeam,
  SCHEDULE,
  seriesScore,
} from "@/lib/tournaments/fall-2026";
import {
  embedSrc,
  emptyMatchMedia,
  matchMediaKey,
  parseMediaUrl,
  type MatchMedia,
  type MatchMediaLink,
  type ParsedMedia,
} from "@/lib/tournaments/media";
import {
  isTournamentAdmin,
  saveTournamentMatchMedia,
} from "./actions";
import { SessionContent } from "../tracker/session/SessionContent";

function sessionHref(sessionId: string) {
  return `/tracker/session/${encodeURIComponent(sessionId)}`;
}

function twitchParents() {
  if (typeof window === "undefined") return ["aadrama.com", "localhost"];
  return [window.location.hostname, "aadrama.com", "localhost"];
}

function mediaLabel(item: MatchMediaLink, parsed: ParsedMedia | null) {
  if (item.title) return item.title;
  if (!parsed) return item.url;
  if (parsed.kind === "channel") return parsed.id;
  if (parsed.kind === "clip") return `${parsed.provider} clip`;
  return `${parsed.provider} VOD`;
}

function MediaEmbed({ parsed }: { parsed: ParsedMedia }) {
  const src = embedSrc(parsed, twitchParents());
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        title={parsed.watchUrl}
        src={src}
        className="h-full w-full"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function MediaList({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: MatchMediaLink[];
  selectedId: string | null;
  onSelect: (item: MatchMediaLink) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">None yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const parsed = parseMediaUrl(item.url);
            const active = item.id === selectedId;
            return (
              <li key={item.id}>
                <div
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                    active
                      ? "border-cyan-500/40 bg-cyan-500/10"
                      : "border-gray-800 bg-gray-900/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="min-w-0 flex-1 text-left text-sm text-gray-200 hover:text-white"
                  >
                    <span className="block truncate">
                      {mediaLabel(item, parsed)}
                    </span>
                    <span className="block truncate text-[10px] uppercase text-gray-500">
                      {parsed?.provider ?? "unknown"} ·{" "}
                      {parsed ? "watch here" : "unrecognized url"}
                    </span>
                  </button>
                  <a
                    href={parsed?.watchUrl ?? item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-cyan-300"
                    aria-label="Open in new tab"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AdminEditor({
  streams,
  clips,
  onChange,
  onSave,
  pending,
  error,
}: {
  streams: MatchMediaLink[];
  clips: MatchMediaLink[];
  onChange: (next: MatchMedia) => void;
  onSave: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [slot, setSlot] = useState<"stream" | "clip">("stream");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const add = () => {
    const parsed = parseMediaUrl(url);
    if (!parsed) return;
    const item: MatchMediaLink = {
      id: crypto.randomUUID(),
      url: parsed.watchUrl,
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    onChange(
      slot === "stream"
        ? { streams: [...streams, item], clips }
        : { streams, clips: [...clips, item] }
    );
    setUrl("");
    setTitle("");
  };

  const remove = (kind: "stream" | "clip", id: string) => {
    onChange(
      kind === "stream"
        ? { streams: streams.filter((s) => s.id !== id), clips }
        : { streams, clips: clips.filter((c) => c.id !== id) }
    );
  };

  return (
    <div className="mt-6 border-t border-gray-800 pt-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400">
        Admin
      </h4>
      <p className="mb-3 text-xs text-gray-500">
        Paste a Twitch or YouTube URL. Streams and clips both embed in this
        panel.
      </p>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => setSlot("stream")}
          className={`rounded-full px-2.5 py-1 text-xs ${
            slot === "stream"
              ? "bg-cyan-500/20 text-cyan-200"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          Stream / VOD
        </button>
        <button
          type="button"
          onClick={() => setSlot("clip")}
          className={`rounded-full px-2.5 py-1 text-xs ${
            slot === "clip"
              ? "bg-cyan-500/20 text-cyan-200"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          Clip
        </button>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.twitch.tv/videos/… or youtube.com/…"
        className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500/50"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Optional title"
        className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500/50"
      />
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={!parseMediaUrl(url)}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {(["stream", "clip"] as const).map((kind) => {
        const list = kind === "stream" ? streams : clips;
        if (list.length === 0) return null;
        return (
          <ul key={kind} className="mb-2 space-y-1">
            {list.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-xs text-gray-400"
              >
                <span className="truncate">
                  {kind === "stream" ? "Stream" : "Clip"} ·{" "}
                  {item.title || item.url}
                </span>
                <button
                  type="button"
                  onClick={() => remove(kind, item.id)}
                  className="rounded p-1 hover:bg-white/5 hover:text-red-400"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

export default function ScheduleMatches({
  initialMedia,
}: {
  initialMedia: Record<string, MatchMedia>;
}) {
  const [mediaByKey, setMediaByKey] = useState(initialMedia);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    isTournamentAdmin().then(setIsAdmin);
  }, []);

  const openMatch = useMemo(() => {
    if (!openKey) return null;
    for (const week of SCHEDULE) {
      for (const match of week.matches) {
        if (matchMediaKey(week.week, match.home, match.away) === openKey) {
          return { week, match };
        }
      }
    }
    return null;
  }, [openKey]);

  const media = openKey
    ? (mediaByKey[openKey] ?? emptyMatchMedia())
    : emptyMatchMedia();

  useEffect(() => {
    setSelectedId(null);
    setSaveError(null);
  }, [openKey]);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openKey]);

  const selected =
    [...media.streams, ...media.clips].find((item) => item.id === selectedId) ??
    null;
  const selectedParsed = selected ? parseMediaUrl(selected.url) : null;

  const homeTeam = openMatch ? getTeam(openMatch.match.home) : null;
  const awayTeam = openMatch ? getTeam(openMatch.match.away) : null;
  const openResult = openMatch
    ? getMatchResult(
        openMatch.week.week,
        openMatch.match.home,
        openMatch.match.away
      )
    : undefined;
  const openMaps = openResult?.maps ?? [];
  const activeSessionId =
    openMaps.find((map) => map.sessionId === selectedSessionId)?.sessionId ??
    openMaps[0]?.sessionId ??
    null;

  const openMatchPanel = (key: string, sessionId?: string) => {
    setOpenKey(key);
    setSelectedSessionId(sessionId ?? null);
    setSelectedId(null);
  };

  const updateOpenMedia = (next: MatchMedia) => {
    if (!openKey) return;
    setMediaByKey((prev) => ({ ...prev, [openKey]: next }));
    const items = [...next.streams, ...next.clips];
    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null);
    }
  };

  const save = () => {
    if (!openMatch) return;
    setSaveError(null);
    startTransition(async () => {
      const result = await saveTournamentMatchMedia({
        week: openMatch.week.week,
        home: openMatch.match.home,
        away: openMatch.match.away,
        streams: media.streams,
        clips: media.clips,
      });
      if (!result.success) {
        setSaveError(result.error ?? "Save failed");
        return;
      }
      if (result.media && openKey) {
        setMediaByKey((prev) => ({ ...prev, [openKey]: result.media! }));
      }
    });
  };

  return (
    <>
      <div className="space-y-4">
        {SCHEDULE.map((week) => (
          <div
            key={week.week}
            className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900"
          >
            <div className="flex flex-col gap-2 border-b border-gray-800 bg-gray-800/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-semibold text-white">Round {week.week}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-cyan-300">
                  NA {week.naDate}
                </span>
                <span className="rounded-full bg-violet-500/15 px-2 py-1 text-violet-300">
                  EU {week.euDate} 4 PM EST
                </span>
              </div>
            </div>
            <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
              {week.maps.map((m, i) => (
                <span key={m.name}>
                  {i > 0 && <span className="text-gray-600"> · </span>}
                  <span className="text-gray-300">{m.name}</span> {m.time}
                  {m.note ? ` (${m.note})` : ""}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
              {week.matches.map((match) => {
                const home = getTeam(match.home);
                const away = getTeam(match.away);
                const result = getMatchResult(
                  week.week,
                  match.home,
                  match.away
                );
                const played = Boolean(result && result.maps.length > 0);
                const series = result ? seriesScore(result) : null;
                const homeWon =
                  series != null && series.homeScore > series.awayScore;
                const awayWon =
                  series != null && series.awayScore > series.homeScore;
                const tied =
                  series != null && series.homeScore === series.awayScore;
                const key = matchMediaKey(week.week, match.home, match.away);
                const matchMedia = mediaByKey[key];
                const mediaCount =
                  (matchMedia?.streams.length ?? 0) +
                  (matchMedia?.clips.length ?? 0);
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => openMatchPanel(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openMatchPanel(key);
                      }
                    }}
                    className={`cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                      openKey === key
                        ? "border-cyan-500/50 bg-gray-800"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-semibold uppercase ${
                          match.involvesEu
                            ? "text-violet-400"
                            : "text-cyan-400"
                        }`}
                      >
                        {match.involvesEu ? week.euDate : week.naDate}
                      </span>
                      <span className="flex items-center gap-2">
                        {mediaCount > 0 && (
                          <span className="text-[10px] text-cyan-400">
                            {mediaCount} vod
                            {mediaCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {!played && (
                          <span className="text-[10px] text-gray-500">
                            Upcoming
                          </span>
                        )}
                        {played && series && (
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              tied ? "text-yellow-400" : "text-white"
                            }`}
                          >
                            {series.homeScore}–{series.awayScore}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`flex min-w-0 items-center gap-2 text-sm font-medium ${
                          homeWon ? "text-white" : "text-gray-200"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${home?.color}`}
                        />
                        <span className="truncate">
                          {home?.shortName ?? home?.name}
                        </span>
                      </span>
                      <span className="text-xs text-gray-500">vs</span>
                      <span
                        className={`flex min-w-0 items-center justify-end gap-2 text-sm font-medium ${
                          awayWon ? "text-white" : "text-gray-200"
                        }`}
                      >
                        <span className="truncate">
                          {away?.shortName ?? away?.name}
                        </span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${away?.color}`}
                        />
                      </span>
                    </div>
                    {played && result && (
                      <div className="mt-2 space-y-1 border-t border-gray-700/80 pt-2">
                        {result.maps.map((map) => (
                          <div
                            key={map.sessionId}
                            className="flex items-center justify-between gap-2 text-xs text-gray-400"
                          >
                            <span className="truncate">{map.name}</span>
                            <span className="shrink-0 tabular-nums">
                              {map.homeScore}–{map.awayScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {openMatch && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close match media"
            onClick={() => setOpenKey(null)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-media-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-gray-800 bg-gray-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Round {openMatch.week.week}
                </p>
                <h3
                  id="match-media-title"
                  className="text-lg font-bold text-white"
                >
                  {homeTeam?.name} vs {awayTeam?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {openMaps.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {openMaps.map((map) => (
                    <button
                      key={map.sessionId}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(map.sessionId);
                        setSelectedId(null);
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        map.sessionId === activeSessionId
                          ? "bg-cyan-500/20 text-cyan-200"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {map.name} {map.homeScore}–{map.awayScore}
                    </button>
                  ))}
                </div>
              )}
              {activeSessionId ? (
                <div className="mb-6">
                  <SessionContent
                    sessionIds={[activeSessionId]}
                    compact
                  />
                  <a
                    href={sessionHref(activeSessionId)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Open session in new tab
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="mb-6 text-sm text-gray-500">
                  No tracker session recorded for this match yet.
                </p>
              )}
              {selectedParsed && (
                <div className="mb-4">
                  <MediaEmbed parsed={selectedParsed} />
                  <a
                    href={selectedParsed.watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Open stream in new tab
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <div className="space-y-5">
                <MediaList
                  title="Streams"
                  items={media.streams}
                  selectedId={selectedId}
                  onSelect={(item) => setSelectedId(item.id)}
                />
                <MediaList
                  title="Clips"
                  items={media.clips}
                  selectedId={selectedId}
                  onSelect={(item) => setSelectedId(item.id)}
                />
              </div>
              {isAdmin && (
                <AdminEditor
                  streams={media.streams}
                  clips={media.clips}
                  onChange={updateOpenMedia}
                  onSave={save}
                  pending={pending}
                  error={saveError}
                />
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

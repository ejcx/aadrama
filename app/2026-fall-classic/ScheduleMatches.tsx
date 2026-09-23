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
  extractIframeSrc,
  looksLikeEmbedHtml,
  matchMediaKey,
  parseMediaUrl,
  withTwitchParents,
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
  if (parsed?.kind === "channel") return parsed.id;
  if (parsed?.kind === "clip") return `${parsed.provider} clip`;
  if (parsed) return `${parsed.provider} VOD`;
  if (item.embedHtml) return "Embed";
  return item.url ?? "Media";
}

function MediaEmbed({ item }: { item: MatchMediaLink }) {
  if (item.embedHtml) {
    const html = withTwitchParents(item.embedHtml, twitchParents());
    return (
      <div
        className="aspect-video w-full overflow-hidden rounded-lg bg-black [&_iframe]:h-full [&_iframe]:w-full"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  const parsed = item.url ? parseMediaUrl(item.url) : null;
  if (!parsed) return null;
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

function payloadOf(item: MatchMediaLink) {
  return item.embedHtml || item.url || "";
}

function itemFromPayload(
  raw: string,
  title: string,
  id = crypto.randomUUID()
): MatchMediaLink {
  const value = raw.trim();
  const label = title.trim();
  if (!value) {
    return { id, ...(label ? { title: label } : {}) };
  }
  if (looksLikeEmbedHtml(value)) {
    const src = extractIframeSrc(value);
    return {
      id,
      embedHtml: value,
      ...(src ? { url: src } : {}),
      ...(label ? { title: label } : {}),
    };
  }
  const parsed = parseMediaUrl(value);
  return {
    id,
    url: parsed?.watchUrl ?? value,
    ...(label ? { title: label } : {}),
  };
}

function filledMedia(media: MatchMedia): MatchMedia {
  const keep = (items: MatchMediaLink[]) =>
    items.filter((item) => payloadOf(item).trim());
  return { streams: keep(media.streams), clips: keep(media.clips) };
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
            const parsed = item.url ? parseMediaUrl(item.url) : null;
            const active = item.id === selectedId;
            const openHref = parsed?.watchUrl ?? item.url;
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
                      {item.embedHtml
                        ? "embed"
                        : parsed?.provider ?? "unknown"}{" "}
                      · watch here
                    </span>
                  </button>
                  {openHref && (
                    <a
                      href={openHref}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-cyan-300"
                      aria-label="Open in new tab"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
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
  onSave: (next: MatchMedia) => void;
  pending: boolean;
  error: string | null;
}) {
  const setList = (kind: "stream" | "clip", list: MatchMediaLink[]) => {
    onChange(
      kind === "stream" ? { streams: list, clips } : { streams, clips: list }
    );
  };

  const addRow = (kind: "stream" | "clip") => {
    const list = kind === "stream" ? streams : clips;
    setList(kind, [...list, { id: crypto.randomUUID() }]);
  };

  const updateRow = (
    kind: "stream" | "clip",
    id: string,
    patch: { payload?: string; title?: string }
  ) => {
    const list = kind === "stream" ? streams : clips;
    setList(
      kind,
      list.map((item) => {
        if (item.id !== id) return item;
        return itemFromPayload(
          patch.payload ?? payloadOf(item),
          patch.title ?? item.title ?? "",
          item.id
        );
      })
    );
  };

  const removeRow = (kind: "stream" | "clip", id: string) => {
    const list = kind === "stream" ? streams : clips;
    setList(
      kind,
      list.filter((item) => item.id !== id)
    );
  };

  const editor = (kind: "stream" | "clip", list: MatchMediaLink[]) => (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {kind === "stream" ? "Streams" : "Clips"}
        </h4>
        <button
          type="button"
          onClick={() => addRow(kind)}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-200 hover:bg-gray-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add {kind === "stream" ? "stream" : "clip"}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-gray-600">None yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((item, index) => (
            <li
              key={item.id}
              className="rounded-lg border border-gray-800 bg-gray-900/80 p-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <input
                  value={item.title ?? ""}
                  onChange={(e) =>
                    updateRow(kind, item.id, { title: e.target.value })
                  }
                  placeholder={
                    kind === "stream"
                      ? `Stream ${index + 1} title`
                      : `Clip ${index + 1} title`
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-sm text-gray-200 outline-none focus:border-cyan-500/50"
                />
                <button
                  type="button"
                  onClick={() => removeRow(kind, item.id)}
                  className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-red-400"
                  aria-label={`Remove ${kind}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                value={payloadOf(item)}
                onChange={(e) =>
                  updateRow(kind, item.id, { payload: e.target.value })
                }
                rows={4}
                placeholder={
                  kind === "stream"
                    ? "Twitch/YouTube URL or iframe embed HTML"
                    : "Clip iframe embed HTML or URL"
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-2 font-mono text-xs text-gray-200 outline-none focus:border-cyan-500/50"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="mt-6 border-t border-gray-800 pt-4">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
        Admin
      </h4>
      <p className="mb-4 text-xs text-gray-500">
        Edit streams and clips separately. Paste a URL or iframe embed, then
        Save.
      </p>
      {editor("stream", streams)}
      {editor("clip", clips)}
      <button
        type="button"
        onClick={() => onSave(filledMedia({ streams, clips }))}
        disabled={pending}
        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
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
  const playable = [...media.streams, ...media.clips].filter((item) =>
    payloadOf(item).trim()
  );
  const selected =
    playable.find((item) => item.id === selectedId) ?? playable[0] ?? null;

  useEffect(() => {
    setSaveError(null);
    setSelectedId(
      playable.find((item) => item.id === selectedId)?.id ??
        playable[0]?.id ??
        null
    );
    // Reset selection when opening a different match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  };

  const updateOpenMedia = (next: MatchMedia) => {
    if (!openKey) return;
    setMediaByKey((prev) => ({ ...prev, [openKey]: next }));
    const items = [...next.streams, ...next.clips].filter((item) =>
      payloadOf(item).trim()
    );
    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null);
    }
  };

  const save = (next: MatchMedia) => {
    if (!openMatch) return;
    setSaveError(null);
    startTransition(async () => {
      const result = await saveTournamentMatchMedia({
        week: openMatch.week.week,
        home: openMatch.match.home,
        away: openMatch.match.away,
        streams: next.streams,
        clips: next.clips,
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
              {selected && (selected.embedHtml || selected.url) && (
                <div className="mb-6">
                  <MediaEmbed item={selected} />
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Open stream in new tab
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
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
              <div className="space-y-5">
                <MediaList
                  title="Streams"
                  items={media.streams}
                  selectedId={selected?.id ?? null}
                  onSelect={(item) => setSelectedId(item.id)}
                />
                <MediaList
                  title="Clips"
                  items={media.clips}
                  selectedId={selected?.id ?? null}
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

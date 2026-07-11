"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { BadgeCatalogEntry } from "@/lib/badges/catalog";
import { BADGE_CATALOG_SECTIONS } from "@/lib/badges/catalog";
import type { BadgeType } from "@/lib/badges/constants";

type BadgesClientProps = {
  catalog: BadgeCatalogEntry[];
};

function formatEarnedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function BadgeIcon({ entry, selected }: { entry: BadgeCatalogEntry; selected: boolean }) {
  return (
    <div
      className={`relative flex-shrink-0 rounded-full border-2 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 transition-colors ${
        selected
          ? "border-yellow-600/70 bg-gray-800"
          : "border-gray-600/60 bg-gray-800/80 group-hover:border-gray-500"
      }`}
      style={{
        boxShadow: selected ? `0 0 16px color-mix(in srgb, ${entry.accent} 35%, transparent)` : undefined,
      }}
    >
      <img src={entry.src} alt="" className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
    </div>
  );
}

function BadgeCard({
  entry,
  selected,
  onSelect,
}: {
  entry: BadgeCatalogEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const holderLabel =
    entry.uniqueHolders === 0
      ? "No holders yet"
      : entry.repeatable
        ? `${entry.uniqueHolders} player${entry.uniqueHolders === 1 ? "" : "s"} · ${entry.totalAwards} total`
        : `${entry.uniqueHolders} holder${entry.uniqueHolders === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left rounded-lg border p-3 sm:p-4 transition-colors ${
        selected
          ? "border-yellow-700/60 bg-gray-800/90 ring-1 ring-yellow-700/30"
          : "border-gray-700 bg-gray-900/80 hover:border-gray-600 hover:bg-gray-800/70"
      }`}
    >
      <div className="flex items-start gap-3">
        <BadgeIcon entry={entry} selected={selected} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-sm sm:text-base">{entry.label}</h3>
            {entry.repeatable && (
              <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-gray-950 text-gray-400 border border-gray-700">
                Repeatable
              </span>
            )}
          </div>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-snug line-clamp-2">
            {entry.description}
          </p>
          <p className="text-gray-500 text-[11px] sm:text-xs mt-2 tabular-nums">{holderLabel}</p>
        </div>
      </div>
    </button>
  );
}

function HolderTable({ entry }: { entry: BadgeCatalogEntry }) {
  const { holders, repeatable } = entry;

  if (holders.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-10 text-center text-gray-400 text-sm">
        Nobody has earned this badge yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-white text-xs sm:text-sm min-w-[320px]">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800">
              <th className="text-left py-2 sm:py-3 px-3 sm:px-4 w-12">#</th>
              <th className="text-left py-2 sm:py-3 px-3 sm:px-4">Player</th>
              {repeatable && (
                <th className="text-center py-2 sm:py-3 px-3 sm:px-4">Times earned</th>
              )}
              <th className="text-right py-2 sm:py-3 px-3 sm:px-4">
                {repeatable ? "Most recent" : "Earned"}
              </th>
            </tr>
          </thead>
          <tbody>
            {holders.map((holder, index) => (
              <tr
                key={holder.game_name_lower}
                className="border-b border-gray-800 hover:bg-gray-800/70"
              >
                <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-500 tabular-nums">
                  {index + 1}
                </td>
                <td className="py-2 sm:py-3 px-3 sm:px-4">
                  <Link
                    href={`/tracker/player/${encodeURIComponent(holder.game_name)}`}
                    className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                  >
                    {holder.game_name}
                  </Link>
                </td>
                {repeatable && (
                  <td className="text-center py-2 sm:py-3 px-3 sm:px-4 tabular-nums font-semibold">
                    <span style={{ color: entry.accent }}>{holder.count}</span>
                  </td>
                )}
                <td className="text-right py-2 sm:py-3 px-3 sm:px-4 text-gray-400 tabular-nums whitespace-nowrap">
                  {formatEarnedDate(repeatable ? holder.lastEarnedAt : holder.firstEarnedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BadgesClient({ catalog }: BadgesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBadge = searchParams.get("badge");
  const catalogByType = useMemo(
    () => new Map(catalog.map((entry) => [entry.badgeType, entry])),
    [catalog]
  );

  const [selectedType, setSelectedType] = useState<BadgeType>(() => {
    if (initialBadge && catalogByType.has(initialBadge as BadgeType)) {
      return initialBadge as BadgeType;
    }
    const firstWithHolders = catalog.find((entry) => entry.uniqueHolders > 0);
    return firstWithHolders?.badgeType ?? catalog[0]?.badgeType ?? "potato";
  });

  const selectedEntry = catalogByType.get(selectedType) ?? catalog[0];

  const selectBadge = useCallback(
    (badgeType: BadgeType) => {
      setSelectedType(badgeType);
      const params = new URLSearchParams(searchParams.toString());
      params.set("badge", badgeType);
      router.replace(`/tracker/badges?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const sectionEntries = useMemo(() => {
    const used = new Set<string>();
    const sections = BADGE_CATALOG_SECTIONS.map((section) => ({
      title: section.title,
      entries: section.badgeTypes
        .map((type) => catalogByType.get(type))
        .filter((entry): entry is BadgeCatalogEntry => {
          if (!entry) return false;
          used.add(entry.badgeType);
          return true;
        }),
    }));

    const remaining = catalog.filter((entry) => !used.has(entry.badgeType));
    if (remaining.length > 0) {
      sections.push({ title: "Other", entries: remaining });
    }

    return sections;
  }, [catalog, catalogByType]);

  if (!selectedEntry) {
    return (
      <div className="text-gray-400 text-center py-12">No badges configured yet.</div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-4 sm:gap-6">
      <div className="space-y-5">
        {sectionEntries.map((section) =>
          section.entries.length > 0 ? (
            <section key={section.title}>
              <h2 className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium mb-2 px-0.5">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.entries.map((entry) => (
                  <BadgeCard
                    key={entry.badgeType}
                    entry={entry}
                    selected={entry.badgeType === selectedType}
                    onSelect={() => selectBadge(entry.badgeType)}
                  />
                ))}
              </div>
            </section>
          ) : null
        )}
      </div>

      <div className="min-w-0">
        <div className="sticky top-4 sm:top-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/90 p-4 sm:p-5 mb-4">
            <div className="flex items-start gap-4">
              <div
                className="relative flex-shrink-0 rounded-full border-2 border-yellow-700/50 bg-gray-800 flex items-center justify-center w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]"
                style={{
                  boxShadow: `0 0 24px color-mix(in srgb, ${selectedEntry.accent} 30%, transparent)`,
                }}
              >
                <img
                  src={selectedEntry.src}
                  alt=""
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white">{selectedEntry.label}</h2>
                <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                  {selectedEntry.description}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                  <span>
                    {selectedEntry.uniqueHolders} player
                    {selectedEntry.uniqueHolders === 1 ? "" : "s"}
                  </span>
                  {selectedEntry.repeatable && (
                    <span>{selectedEntry.totalAwards} total awards</span>
                  )}
                  {selectedEntry.repeatable && selectedEntry.uniqueHolders > 0 && (
                    <span>
                      Leader: {selectedEntry.holders[0]?.game_name} (
                      {selectedEntry.holders[0]?.count}×)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-300 mb-2 px-0.5">
            {selectedEntry.repeatable ? "Leaderboard" : "Earned by"}
          </h3>
          <HolderTable entry={selectedEntry} />
        </div>
      </div>
    </div>
  );
}

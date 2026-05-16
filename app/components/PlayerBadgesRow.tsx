"use client";

import type { ReactNode } from "react";
import type { PlayerBadge } from "@/lib/supabase/types";
import { getBadgeMeta } from "@/lib/badges/constants";
import {
  isScrimActivityBadgeType,
  pickScrimActivityBadge,
  SCRIM_ACTIVITY_TIERS,
} from "@/lib/badges/activity";
import {
  ELO_MILESTONE_TIERS,
  isEloMilestoneBadgeType,
  pickEloMilestoneBadge,
} from "@/lib/badges/elo-milestone";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

const STACKED_BADGE_MAX = 3;
const STACKED_BADGE_LAYER_OFFSET = 18;
const BADGE_RIBBON_CLASS = "w-2.5 h-4 sm:w-3 sm:h-5";

type BadgeMeta = ReturnType<typeof getBadgeMeta>;

/** Invisible ribbon spacer so patch badges align with medals in the rack. */
function BadgeTopRibbonSpacer() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 -translate-x-1/2 -top-0.5 z-0 flex gap-px pointer-events-none invisible"
    >
      {[0, 1].map((i) => (
        <span key={i} className={`${BADGE_RIBBON_CLASS} block`} />
      ))}
    </div>
  );
}

function BadgeMedalCore({
  meta,
  className = "",
  size = "md",
}: {
  meta: BadgeMeta;
  className?: string;
  size?: "md" | "ml" | "lg";
}) {
  const disc =
    size === "lg"
      ? "w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]"
      : size === "ml"
        ? "w-14 h-14 sm:w-[3.75rem] sm:h-[3.75rem]"
        : "w-11 h-11 sm:w-12 sm:h-12";
  const img =
    size === "lg"
      ? "w-12 h-12 sm:w-14 sm:h-14"
      : size === "ml"
        ? "w-10 h-10 sm:w-11 sm:h-11"
        : "w-8 h-8 sm:w-9 sm:h-9";
  const ribbon =
    size === "lg"
      ? "w-3.5 h-6"
      : size === "ml"
        ? "w-3 h-5 sm:w-3.5 sm:h-5"
        : BADGE_RIBBON_CLASS;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -top-0.5 z-0 flex gap-px pointer-events-none"
      >
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`${ribbon} block`}
            style={{
              background: `linear-gradient(180deg, ${meta.accent}, color-mix(in srgb, ${meta.accent} 55%, #0f172a))`,
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)",
            }}
          />
        ))}
      </div>
      <div
        className={`
          relative z-10 mt-2.5 rounded-full
          bg-gradient-to-br from-gray-600 via-gray-800 to-gray-950
          border-2 border-yellow-700/50
          shadow-[0_3px_8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]
          flex items-center justify-center
          ${disc} ${className}
        `}
      >
        <img src={meta.src} alt="" className={`${img} drop-shadow-md pointer-events-none`} />
      </div>
    </div>
  );
}

function BadgePatchCore({
  meta,
  className = "",
}: {
  meta: BadgeMeta;
  className?: string;
}) {
  return (
    <div className="relative">
      <BadgeTopRibbonSpacer />
      <div
        className={`
          relative z-10 mt-2.5 w-11 h-11 sm:w-12 sm:h-12
          rounded-sm rotate-[-2deg]
          bg-gradient-to-br from-stone-600 via-stone-800 to-stone-950
          border-2 border-dashed border-stone-400/70
          shadow-[0_3px_8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]
          flex items-center justify-center
          ${className}
        `}
      >
        <img
          src={meta.src}
          alt=""
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-md pointer-events-none"
        />
      </div>
    </div>
  );
}

function BadgeTooltip({
  trigger,
  children,
  borderClassName = "border-gray-600",
}: {
  trigger: ReactNode;
  children: ReactNode;
  borderClassName?: string;
}) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          "z-[100] w-auto min-w-[140px] max-w-[min(260px,calc(100vw-2rem))]",
          "p-2.5 bg-gray-950/98 text-gray-200 text-xs shadow-xl border",
          borderClassName
        )}
      >
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}

function BadgeMedal({ badge }: { badge: PlayerBadge }) {
  const meta = getBadgeMeta(badge.badge_type);
  const earned = new Date(badge.earned_at).toLocaleDateString();

  return (
    <BadgeTooltip
      trigger={
        <div className="relative group flex-shrink-0 self-start outline-none cursor-default">
          <BadgeMedalCore
            meta={meta}
            className="transition-transform duration-200 group-hover:scale-110"
          />
        </div>
      }
    >
      <p className="font-semibold whitespace-nowrap" style={{ color: meta.accent }}>
        {meta.label}
      </p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      <p className="text-gray-500 text-[10px] mt-1">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function Season1CombatPatchBadge({ badge }: { badge: PlayerBadge }) {
  const meta = getBadgeMeta("season_1_combat_patch");
  const earned = new Date(badge.earned_at).toLocaleDateString();

  return (
    <BadgeTooltip
      borderClassName="border-stone-600"
      trigger={
        <div className="relative group flex-shrink-0 self-start outline-none cursor-default">
          <BadgePatchCore
            meta={meta}
            className="transition-transform duration-200 group-hover:scale-105 group-hover:rotate-0"
          />
        </div>
      }
    >
      <p className="font-semibold text-stone-300">{meta.label}</p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      <p className="text-gray-500 text-[10px] mt-1">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function HeldFirstPlaceBadge({
  badge,
  scrimsAtFirstPlace,
}: {
  badge: PlayerBadge;
  scrimsAtFirstPlace?: number | null;
}) {
  const meta = getBadgeMeta("held_first_place");
  const earned = new Date(badge.earned_at).toLocaleDateString();
  const showScrimsCount = scrimsAtFirstPlace != null;

  return (
    <BadgeTooltip
      borderClassName="border-orange-700/50"
      trigger={
        <div className="relative group flex-shrink-0 self-start mx-0.5 sm:mx-1 outline-none cursor-default">
          <div
            className="absolute -inset-1.5 sm:-inset-2 rounded-2xl bg-orange-500/20 blur-lg pointer-events-none"
            aria-hidden
          />
          <div
            className="
              absolute -inset-0.5 rounded-xl pointer-events-none
              bg-gradient-to-br from-orange-400/15 via-amber-500/10 to-yellow-600/15
            "
            aria-hidden
          />

          <div className="relative flex flex-col items-center">
            <div className="relative">
              <span
                className="
                  absolute -top-2 left-1/2 -translate-x-1/2 z-20
                  text-sm sm:text-base font-black text-orange-300
                  drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]
                  tabular-nums
                "
                aria-hidden
              >
                #1
              </span>
              <BadgeMedalCore
                meta={meta}
                size="ml"
                className="
                  border-orange-400/80 ring-2 ring-orange-500/35 ring-offset-2 ring-offset-gray-950
                  shadow-[0_0_22px_rgba(245,158,11,0.4),0_3px_12px_rgba(0,0,0,0.45)]
                  transition-transform duration-200 group-hover:scale-105
                "
              />
            </div>

            <p
              className="
                mt-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em]
                text-orange-200/95 text-center leading-tight
              "
            >
              #1 ELO
            </p>
            {showScrimsCount && (
              <p className="mt-0.5 text-[9px] sm:text-[10px] text-orange-300/80 text-center tabular-nums leading-tight">
                {scrimsAtFirstPlace} scrim{scrimsAtFirstPlace === 1 ? "" : "s"} at #1
              </p>
            )}
          </div>
        </div>
      }
    >
      <p className="font-semibold text-orange-300">{meta.label}</p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      {showScrimsCount && (
        <p className="text-orange-200/90 text-[11px] mt-1 tabular-nums">
          Scrims at #1: {scrimsAtFirstPlace}
        </p>
      )}
      <p className="text-gray-500 text-[10px] mt-1">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function Season1Top10Badge({ badge }: { badge: PlayerBadge }) {
  const meta = getBadgeMeta("season_1_top_10");
  const earned = new Date(badge.earned_at).toLocaleDateString();

  return (
    <BadgeTooltip
      borderClassName="border-slate-500/50"
      trigger={
        <div className="relative group flex-shrink-0 self-start mx-0.5 outline-none cursor-default">
          <div
            className="absolute -inset-1 rounded-2xl bg-slate-400/15 blur-md pointer-events-none"
            aria-hidden
          />
          <div
            className="
              absolute -inset-0.5 rounded-xl pointer-events-none
              bg-gradient-to-br from-slate-300/20 via-sky-400/10 to-slate-500/15
            "
            aria-hidden
          />

          <div className="relative flex flex-col items-center">
            <div className="relative">
              <BadgeMedalCore
                meta={meta}
                size="md"
                className="
                  border-slate-300/70 ring-1 ring-sky-300/30 ring-offset-1 ring-offset-gray-950
                  shadow-[0_0_18px_rgba(148,163,184,0.45),0_3px_10px_rgba(0,0,0,0.45)]
                  transition-transform duration-200 group-hover:scale-105
                "
              />
            </div>

            <p
              className="
                mt-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em]
                text-slate-300/95 text-center leading-tight
              "
            >
              S1 Top 10
            </p>
          </div>
        </div>
      }
    >
      <p className="font-semibold text-slate-200">{meta.label}</p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      <p className="text-gray-500 text-[10px] mt-1">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function Season1ChampionBadge({ badge }: { badge: PlayerBadge }) {
  const meta = getBadgeMeta("season_1_champion");
  const earned = new Date(badge.earned_at).toLocaleDateString();

  return (
    <BadgeTooltip
      borderClassName="border-amber-700/50"
      trigger={
        <div className="relative group flex-shrink-0 self-start mr-1 sm:mr-2 outline-none cursor-default">
          <div
            className="absolute -inset-2 sm:-inset-3 rounded-2xl bg-amber-500/25 blur-xl pointer-events-none animate-pulse"
            aria-hidden
          />
          <div
            className="
              absolute -inset-1 rounded-xl pointer-events-none
              bg-gradient-to-br from-amber-400/20 via-yellow-600/10 to-orange-700/20
            "
            aria-hidden
          />

          <div className="relative flex flex-col items-center">
            <div className="relative">
              <div
                className="
                  absolute -top-3 left-1/2 -translate-x-1/2 z-20
                  text-lg sm:text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]
                "
                aria-hidden
              >
                👑
              </div>
              <BadgeMedalCore
                meta={meta}
                size="lg"
                className="
                  border-amber-400/90 ring-2 ring-amber-400/40 ring-offset-2 ring-offset-gray-950
                  shadow-[0_0_28px_rgba(251,191,36,0.45),0_4px_14px_rgba(0,0,0,0.5)]
                  transition-transform duration-200 group-hover:scale-105
                "
              />
            </div>

            <p
              className="
                mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em]
                text-amber-200/95 text-center leading-tight max-w-[7rem] sm:max-w-[8rem]
                drop-shadow-sm
              "
            >
              Season 1
              <br />
              <span className="text-amber-400">Champion</span>
            </p>
          </div>
        </div>
      }
    >
      <p className="font-semibold text-amber-300">{meta.label}</p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      <p className="text-gray-500 text-[10px] mt-1">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function PotatoBadgeStack({ badges }: { badges: PlayerBadge[] }) {
  const meta = getBadgeMeta("potato");
  const count = badges.length;
  const stackLayers = Math.min(count, STACKED_BADGE_MAX);
  const showCount = count > 1;
  const stackWidth =
    48 + (stackLayers - 1) * STACKED_BADGE_LAYER_OFFSET + (showCount ? 22 : 0);

  const recentDates = badges
    .slice(0, 5)
    .map((b) => new Date(b.earned_at).toLocaleDateString());

  return (
    <BadgeTooltip
      trigger={
        <div
          className="relative group flex-shrink-0 self-start outline-none cursor-default"
          style={{ width: stackWidth, minHeight: 56 }}
          aria-label={`${count} potato award${count !== 1 ? "s" : ""}`}
        >
          {Array.from({ length: stackLayers }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 transition-transform duration-200 group-hover:scale-105"
              style={{
                left: i * STACKED_BADGE_LAYER_OFFSET,
                zIndex: i + 1,
                opacity: i === stackLayers - 1 ? 1 : 0.92 - i * 0.08,
                transform: `rotate(${i * 4 - (stackLayers - 1) * 2}deg)`,
              }}
            >
              <BadgeMedalCore meta={meta} />
            </div>
          ))}

          {showCount && (
            <div
              className="
                absolute -top-0.5 z-20 min-w-[1.35rem] h-[1.35rem] px-1
                rounded-full bg-amber-900 border-2 border-amber-600/80
                flex items-center justify-center shadow-md
              "
              style={{ left: (stackLayers - 1) * STACKED_BADGE_LAYER_OFFSET + 38 }}
            >
              <span className="text-[10px] sm:text-xs font-bold text-amber-100 leading-none tabular-nums">
                {count}
              </span>
            </div>
          )}
        </div>
      }
    >
      <p className="font-semibold whitespace-nowrap" style={{ color: meta.accent }}>
        Potato ×{count}
      </p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      {count > 1 && (
        <p className="text-gray-500 text-[10px] mt-1">
          Recent: {recentDates.join(", ")}
          {count > 5 ? ` +${count - 5} more` : ""}
        </p>
      )}
    </BadgeTooltip>
  );
}

function TopFragBadgeStack({ badges }: { badges: PlayerBadge[] }) {
  const meta = getBadgeMeta("scrim_top_frag");
  const count = badges.length;
  const stackLayers = Math.min(count, STACKED_BADGE_MAX);
  const showCount = count > 1;
  const stackWidth =
    48 + (stackLayers - 1) * STACKED_BADGE_LAYER_OFFSET + (showCount ? 22 : 0);

  const recentDates = badges
    .slice(0, 5)
    .map((b) => new Date(b.earned_at).toLocaleDateString());

  return (
    <BadgeTooltip
      borderClassName="border-red-900/50"
      trigger={
        <div
          className="relative group flex-shrink-0 self-start outline-none cursor-default"
          style={{ width: stackWidth, minHeight: 56 }}
          aria-label={`${count} top frag award${count !== 1 ? "s" : ""}`}
        >
          {Array.from({ length: stackLayers }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 transition-transform duration-200 group-hover:scale-105"
              style={{
                left: i * STACKED_BADGE_LAYER_OFFSET,
                zIndex: i + 1,
                opacity: i === stackLayers - 1 ? 1 : 0.92 - i * 0.08,
                transform: `rotate(${i * 4 - (stackLayers - 1) * 2}deg)`,
              }}
            >
              <BadgeMedalCore meta={meta} />
            </div>
          ))}

          {showCount && (
            <div
              className="
                absolute -top-0.5 z-20 min-w-[1.35rem] h-[1.35rem] px-1
                rounded-full bg-red-950 border-2 border-red-600/80
                flex items-center justify-center shadow-md
              "
              style={{ left: (stackLayers - 1) * STACKED_BADGE_LAYER_OFFSET + 38 }}
            >
              <span className="text-[10px] sm:text-xs font-bold text-red-100 leading-none tabular-nums">
                {count}
              </span>
            </div>
          )}
        </div>
      }
    >
      <p className="font-semibold whitespace-nowrap" style={{ color: meta.accent }}>
        Top Frag ×{count}
      </p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      {count > 1 && (
        <p className="text-gray-500 text-[10px] mt-1">
          Recent: {recentDates.join(", ")}
          {count > 5 ? ` +${count - 5} more` : ""}
        </p>
      )}
    </BadgeTooltip>
  );
}

function EloMilestoneBadge({ badge }: { badge: PlayerBadge }) {
  const meta = getBadgeMeta(badge.badge_type);
  const tier = ELO_MILESTONE_TIERS.find((t) => t.badgeType === badge.badge_type);
  const earned = new Date(badge.earned_at).toLocaleDateString();

  return (
    <BadgeTooltip
      borderClassName="border-amber-700/40"
      trigger={
        <div className="relative group flex-shrink-0 self-start outline-none cursor-default">
          <BadgeMedalCore
            meta={meta}
            size="md"
            className="border-amber-500/50 shadow-[0_0_14px_rgba(245,158,11,0.2)] transition-transform duration-200 group-hover:scale-105"
          />
        </div>
      }
    >
      <p className="font-semibold" style={{ color: meta.accent }}>
        {meta.label}
      </p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      {tier && (
        <p className="text-gray-500 text-[10px] mt-1 tabular-nums">
          Peak: {tier.threshold}+ cumulative ELO
        </p>
      )}
      <p className="text-gray-500 text-[10px] mt-0.5">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function ScrimActivityBadge({ badge }: { badge: PlayerBadge }) {
  const meta = getBadgeMeta(badge.badge_type);
  const tier = SCRIM_ACTIVITY_TIERS.find((t) => t.badgeType === badge.badge_type);
  const earned = new Date(badge.earned_at).toLocaleDateString();

  return (
    <BadgeTooltip
      borderClassName="border-lime-700/40"
      trigger={
        <div className="relative group flex-shrink-0 self-start outline-none cursor-default">
          <BadgeMedalCore
            meta={meta}
            size="md"
            className="border-lime-500/50 shadow-[0_0_14px_rgba(132,204,22,0.25)] transition-transform duration-200 group-hover:scale-105"
          />
        </div>
      }
    >
      <p className="font-semibold" style={{ color: meta.accent }}>
        {meta.label}
      </p>
      <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{meta.description}</p>
      {tier && (
        <p className="text-gray-500 text-[10px] mt-1 tabular-nums">
          Tier: {tier.threshold}+ ranked scrims
        </p>
      )}
      <p className="text-gray-500 text-[10px] mt-0.5">Earned {earned}</p>
    </BadgeTooltip>
  );
}

function partitionBadges(badges: PlayerBadge[]) {
  let champion: PlayerBadge | null = null;
  let season1Top10: PlayerBadge | null = null;
  let heldFirstPlace: PlayerBadge | null = null;
  let combatPatch: PlayerBadge | null = null;
  const potato: PlayerBadge[] = [];
  const topFrag: PlayerBadge[] = [];
  const other: PlayerBadge[] = [];

  const scrimActivity = pickScrimActivityBadge(badges);
  const eloMilestone = pickEloMilestoneBadge(badges);

  for (const b of badges) {
    if (isScrimActivityBadgeType(b.badge_type)) {
      continue;
    }
    if (isEloMilestoneBadgeType(b.badge_type)) {
      continue;
    }
    if (b.badge_type === "season_1_champion") {
      if (
        !champion ||
        new Date(b.earned_at).getTime() > new Date(champion.earned_at).getTime()
      ) {
        champion = b;
      }
    } else if (b.badge_type === "season_1_top_10") {
      if (
        !season1Top10 ||
        new Date(b.earned_at).getTime() > new Date(season1Top10.earned_at).getTime()
      ) {
        season1Top10 = b;
      }
    } else if (b.badge_type === "held_first_place") {
      if (
        !heldFirstPlace ||
        new Date(b.earned_at).getTime() > new Date(heldFirstPlace.earned_at).getTime()
      ) {
        heldFirstPlace = b;
      }
    } else if (b.badge_type === "season_1_combat_patch") {
      combatPatch = b;
    } else if (b.badge_type === "potato") {
      potato.push(b);
    } else if (b.badge_type === "scrim_top_frag") {
      topFrag.push(b);
    } else {
      other.push(b);
    }
  }

  const byEarnedDesc = (a: PlayerBadge, b: PlayerBadge) =>
    new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime();

  potato.sort(byEarnedDesc);
  topFrag.sort(byEarnedDesc);

  // Combat patch and scrim activity are mutually exclusive (< 50 vs 50+ ranked scrims).
  const participationPatch = scrimActivity ? null : combatPatch;

  return {
    champion,
    season1Top10,
    heldFirstPlace,
    combatPatch: participationPatch,
    scrimActivity,
    eloMilestone,
    potato,
    topFrag,
    other,
  };
}

function BadgeRack({
  badges,
  variant,
  scrimsAtEloFirstPlace,
}: {
  badges: PlayerBadge[];
  variant: "panel" | "chest";
  scrimsAtEloFirstPlace?: number | null;
}) {
  const {
    champion,
    season1Top10,
    heldFirstPlace,
    combatPatch,
    scrimActivity,
    eloMilestone,
    potato,
    topFrag,
    other,
  } = partitionBadges(badges);

  return (
    <div
      className={
        variant === "chest"
          ? "flex flex-wrap items-start justify-end gap-x-3 gap-y-3 sm:gap-x-4"
          : "flex flex-wrap items-start justify-start gap-x-3 gap-y-3 sm:gap-x-4"
      }
    >
      {champion && <Season1ChampionBadge badge={champion} />}
      {season1Top10 && <Season1Top10Badge badge={season1Top10} />}
      {heldFirstPlace && (
        <HeldFirstPlaceBadge
          badge={heldFirstPlace}
          scrimsAtFirstPlace={scrimsAtEloFirstPlace}
        />
      )}
      {eloMilestone && <EloMilestoneBadge badge={eloMilestone} />}
      {scrimActivity ? (
        <ScrimActivityBadge badge={scrimActivity} />
      ) : (
        combatPatch && <Season1CombatPatchBadge badge={combatPatch} />
      )}
      {other.map((b) => (
        <BadgeMedal key={b.id} badge={b} />
      ))}
      {topFrag.length > 0 && <TopFragBadgeStack badges={topFrag} />}
      {potato.length > 0 && <PotatoBadgeStack badges={potato} />}
    </div>
  );
}

type PlayerBadgesRowProps = {
  badges: PlayerBadge[];
  variant?: "panel" | "chest";
  scrimsAtEloFirstPlace?: number | null;
};

export default function PlayerBadgesRow({
  badges,
  variant = "panel",
  scrimsAtEloFirstPlace = null,
}: PlayerBadgesRowProps) {
  if (!badges?.length) return null;

  if (variant === "chest") {
    return (
      <div className="flex-shrink-0 self-start" aria-label="Player awards">
        <BadgeRack
          badges={badges}
          variant="chest"
          scrimsAtEloFirstPlace={scrimsAtEloFirstPlace}
        />
      </div>
    );
  }

  const { champion } = partitionBadges(badges);

  return (
    <div
      className="
        mb-4 rounded-lg overflow-visible
        bg-gradient-to-b from-gray-800/90 via-gray-900 to-gray-950
        border border-gray-600/80
        shadow-[inset_0_2px_12px_rgba(0,0,0,0,0.4)]
      "
    >
      {champion && (
        <div className="px-4 sm:px-5 pt-4 pb-2 border-b border-amber-900/40 bg-gradient-to-r from-amber-950/50 via-transparent to-amber-950/30">
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-500/80 mb-3 font-medium">
            Featured award
          </p>
          <BadgeRack badges={[champion]} variant="panel" />
        </div>
      )}
      <div className="px-3 sm:px-4 pt-2 pb-0.5">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-gray-500 font-medium">
          {champion ? "Other awards" : "Awards"}
        </p>
      </div>
      <div className="px-3 sm:px-5 pb-4 pt-1">
        <BadgeRack
          badges={badges.filter(
            (b) =>
              b.badge_type !== "season_1_champion" &&
              b.badge_type !== "held_first_place" &&
              b.badge_type !== "season_1_combat_patch" &&
              !isScrimActivityBadgeType(b.badge_type) &&
              !isEloMilestoneBadgeType(b.badge_type)
          )}
          variant="panel"
        />
      </div>
    </div>
  );
}

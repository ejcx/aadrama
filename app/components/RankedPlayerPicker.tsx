"use client";

import { useState, useEffect, useRef } from "react";
import {
  resolveRankedPlayer,
  searchRankedPlayers,
  type RankedPlayerOption,
} from "@/app/tracker/actions";

interface RankedPlayerPickerProps {
  value: string;
  displayValue?: string;
  onChange: (gameNameLower: string, displayName: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RankedPlayerPicker({
  value,
  displayValue,
  onChange,
  placeholder = "Search ranked player…",
  className = "",
}: RankedPlayerPickerProps) {
  const [query, setQuery] = useState(displayValue ?? value);
  const [results, setResults] = useState<RankedPlayerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(displayValue ?? value);
  }, [displayValue, value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchRankedPlayers(trimmed, 12);
        setResults(found);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pick = (player: RankedPlayerOption) => {
    onChange(player.game_name_lower, player.game_name);
    setQuery(player.game_name);
    setOpen(false);
  };

  const commitQuery = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      onChange("", "");
      return;
    }

    const resolved = await resolveRankedPlayer(trimmed);
    if (resolved) {
      onChange(resolved.game_name_lower, resolved.game_name);
      setQuery(resolved.game_name);
    } else {
      onChange(trimmed.toLowerCase(), trimmed);
    }
    setOpen(false);
  };

  const handleBlur = () => {
    void commitQuery();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && results.length === 1) {
        pick(results[0]);
      } else {
        void commitQuery();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500" />
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map((player) => (
            <button
              key={player.game_name_lower}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(player)}
              className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors flex justify-between items-center border-b border-gray-700 last:border-b-0"
            >
              <span className="text-white font-medium truncate">
                {player.game_name}
              </span>
              <span className="text-gray-500 text-xs ml-2 shrink-0">
                {player.games_played} ranked
              </span>
            </button>
          ))}
        </div>
      )}
      {open && !loading && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3 text-gray-400 text-sm">
          No ranked players found — press Enter to use typed name
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchPlayers, PlayerSearchResult } from "@/app/tracker/actions";

interface PlayerSearchProps {
  placeholder?: string;
  className?: string;
}

const PlayerSearch = ({
  placeholder = "Search for a player...",
  className = "",
}: PlayerSearchProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await searchPlayers(query, 10);
        setResults(searchResults);
        setShowDropdown(true);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePlayerClick = (playerName: string) => {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    router.push(`/tracker/player/${encodeURIComponent(playerName)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && results.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((player, index) => (
            <button
              key={`${player.name}-${index}`}
              onClick={() => handlePlayerClick(player.name)}
              className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors flex justify-between items-center border-b border-gray-700 last:border-b-0"
            >
              <span className="text-white font-medium truncate">
                {player.name}
              </span>
              <span className="text-gray-400 text-xs ml-2 flex-shrink-0">
                <span className="text-green-400">{player.total_kills}</span>
                {" / "}
                <span className="text-red-400">{player.total_deaths}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && !loading && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3">
          <span className="text-gray-400 text-sm">No players found</span>
        </div>
      )}
    </div>
  );
};

export default PlayerSearch;

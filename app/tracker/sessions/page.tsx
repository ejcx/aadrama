"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import TrackerLayout from "../TrackerLayout";
import { SessionHoverPopover } from "../../components/SessionHoverPopover";

const API_BASE = "https://server-details.ej.workers.dev";

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  server_ip?: string;
  map?: string;
  peak_players?: number;
}

interface MapInfo {
  map_name: string;
  game_count: number;
}

const SessionsPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Toggle session selection
  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Select all visible sessions
  const selectAll = () => {
    setSelectedSessions(new Set(sessions.map((s) => s.session_id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedSessions(new Set());
  };

  // Generate combined session URL
  const getCombinedUrl = () => {
    const ids = Array.from(selectedSessions);
    return `${window.location.origin}/tracker/session/${ids.map((id) => encodeURIComponent(id)).join("+")}`;
  };

  // Copy URL to clipboard
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getCombinedUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Time picker state - default to showing recent sessions (last 7 days)
  const [startTime, setStartTime] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });
  const [selectedMap, setSelectedMap] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  // Fetch maps list
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const response = await fetch(`${API_BASE}/analytics/maps`);
        const data = await response.json();

        if (Array.isArray(data)) {
          setMaps(data);
        } else if (data.maps && Array.isArray(data.maps)) {
          setMaps(data.maps);
        }
      } catch (err) {
        console.error("Failed to fetch maps:", err);
      }
    };

    fetchMaps();
  }, []);

  // Fetch sessions with filters
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (startTime) {
          params.append("start_time", new Date(startTime).toISOString());
        }
        if (endTime) {
          params.append("end_time", new Date(endTime).toISOString());
        }
        if (selectedMap) {
          params.append("map", selectedMap);
        }
        params.append("limit", limit.toString());

        const response = await fetch(`${API_BASE}/sessions?${params.toString()}`);
        const data = await response.json();

        if (Array.isArray(data)) {
          setSessions(data);
        } else if (data.sessions && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        } else {
          setSessions([]);
        }
        setError(null);
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
        setError("Failed to fetch sessions");
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [startTime, endTime, selectedMap, limit]);

  const formatDate = (dateString: string) => {
    try {
      let dateStr = dateString;
      if (dateStr.includes(" ") && !dateStr.includes("T")) {
        dateStr = dateStr.replace(" ", "T");
        if (!dateStr.includes("Z") && !dateStr.includes("+") && !dateStr.includes("-", 10)) {
          dateStr += "Z";
        }
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <TrackerLayout>
      {/* Filters */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-gray-300 text-xs sm:text-sm mb-1">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-xs sm:text-sm mb-1">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-xs sm:text-sm mb-1">Map</label>
            <select
              value={selectedMap}
              onChange={(e) => setSelectedMap(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
            >
              <option value="">All Maps</option>
              {maps.map((map, index) => (
                <option key={`${map.map_name}-${index}`} value={map.map_name}>
                  {map.map_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-300 text-xs sm:text-sm mb-1">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
              min="1"
              max="500"
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-white text-center py-12">Loading...</div>}

      {/* Content */}
      {!loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-white text-xs sm:text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800">
                  <th className="py-2 sm:py-3 px-2 sm:px-4 w-10">
                    <input
                      type="checkbox"
                      checked={sessions.length > 0 && selectedSessions.size === sessions.length}
                      onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                      className="w-4 h-4 accent-cyan-500 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                    Session ID
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                    Start Time
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                    End Time
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Map</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                    Server IP
                  </th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Players</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <tr
                      key={session.session_id}
                      className={`border-b border-gray-800 hover:bg-gray-800 cursor-pointer ${selectedSessions.has(session.session_id) ? "bg-cyan-900/30" : ""
                        }`}
                      onClick={() => toggleSessionSelection(session.session_id)}
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.session_id)}
                          onChange={() => toggleSessionSelection(session.session_id)}
                          className="w-4 h-4 accent-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                        <SessionHoverPopover
                          session={session}
                          className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs truncate block max-w-[100px] sm:max-w-none"
                        />
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                        {formatDate(session.time_started)}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                        {session.time_finished ? formatDate(session.time_finished) : "Active"}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">{session.map || "N/A"}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-xs">
                        {session.server_ip || "N/A"}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        {session.peak_players || "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                      No sessions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating selection bar */}
      {selectedSessions.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-cyan-500 rounded-lg shadow-lg shadow-cyan-500/20 px-4 py-3 flex items-center gap-3 sm:gap-4">
          <span className="text-white text-sm font-medium">
            {selectedSessions.size} session{selectedSessions.size > 1 ? "s" : ""} selected
          </span>

          {selectedSessions.size >= 2 && (
            <>
              <Link
                href={`/tracker/session/${Array.from(selectedSessions).map((id) => encodeURIComponent(id)).join("+")}`}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
              >
                View Combined
              </Link>
              <button
                onClick={copyUrl}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy URL
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={clearSelection}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Clear selection"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </TrackerLayout>
  );
};

export default SessionsPage;


"use client";

import { formatLabel, SCRIM_FORMATS, type ScrimFormat } from "@/lib/scrim/format";

export default function ScrimFormatFilter({
  value,
  onChange,
  label = "Format",
}: {
  value: ScrimFormat | null;
  onChange: (format: ScrimFormat | null) => void;
  label?: string;
}) {
  return (
    <div>
      {label ? (
        <label className="block text-gray-300 text-xs sm:text-sm mb-2">{label}</label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={value === null ? "aa-chip-active" : "aa-chip"}
        >
          All
        </button>
        {SCRIM_FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => onChange(format)}
            className={value === format ? "aa-chip-active" : "aa-chip"}
          >
            {formatLabel(format)}
          </button>
        ))}
      </div>
    </div>
  );
}

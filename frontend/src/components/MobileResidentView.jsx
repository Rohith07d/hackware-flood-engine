"use client";

import { useState } from "react";
import { Search, LocateFixed } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import AlertHUD from "./AlertHUD.jsx";
import { currentRisk, riskLevelMeta } from "../data/floodData.js";

export default function MobileResidentView() {
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showEvacuation, setShowEvacuation] = useState(false);

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-black/5 px-5 py-4">
        <Logo size={26} textClassName="text-[17px] text-ink-900" />
        <button
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-full text-ink-700 transition hover:bg-ink-900/5"
        >
          <Search size={19} strokeWidth={2.1} />
        </button>
      </header>

      {/* Scrollable content */}
      <div className="relative flex-1 overflow-hidden">
        <div className="thin-scroll h-full overflow-y-auto px-4 pt-4">
          {/* Risk card via AlertHUD */}
          <AlertHUD
            variant="card"
            onEvacuationClick={() => setShowEvacuation((v) => !v)}
          />

          {/* Map Canvas */}
          <div className="relative mt-4 h-[360px] overflow-hidden rounded-2xl shadow-card">
            <MapCanvas
              variant="light"
              showMarkers={false}
              showOverlay={false}
              showEvacuation={showEvacuation}
            />
            <button
              aria-label="Center on my location"
              className="absolute bottom-4 right-4 z-[400] grid h-10 w-10 place-items-center rounded-full bg-white text-ink-700 shadow-card"
            >
              <LocateFixed size={19} />
            </button>
          </div>

          <div className="h-24" />
        </div>

        {/* Bottom search sheet */}
        <div
          className={`absolute inset-x-0 bottom-0 z-[500] rounded-t-2xl bg-white px-4 pb-5 pt-2 shadow-[0_-8px_24px_rgba(10,15,26,0.12)] transition-[max-height] duration-300 ${
            sheetExpanded ? "max-h-[70%]" : "max-h-[104px]"
          }`}
        >
          <button
            aria-label="Expand search"
            onClick={() => setSheetExpanded((v) => !v)}
            className="mx-auto mb-2 flex h-4 w-full items-center justify-center"
          >
            <span className="h-1 w-9 rounded-full bg-black/15" />
          </button>
          <label className="flex items-center gap-2 rounded-xl bg-ink-900/5 px-3.5 py-3">
            <Search size={17} className="text-ink-500" />
            <input
              defaultValue={currentRisk.location}
              placeholder="Search an address or area"
              className="w-full bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-500"
            />
          </label>

          {sheetExpanded && (
            <div className="mt-4 space-y-1">
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Nearby alerts
              </p>
              {[
                { name: "Ghatkesar Main Road", level: "high" },
                { name: "Keesara Bridge", level: "moderate" },
                { name: "Bibinagar Road Junction", level: "moderate" },
                { name: "Community Hospital Zone", level: "low" },
              ].map((item) => (
                <button
                  key={item.name}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-ink-900/5"
                >
                  <span className="text-[14px] font-medium text-ink-900">{item.name}</span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: riskLevelMeta[item.level].color }}
                  >
                    {riskLevelMeta[item.level].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

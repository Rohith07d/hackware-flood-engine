"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, LocateFixed, Sparkles, ShieldAlert, CheckCircle2, Car, X, ChevronRight } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import AlertHUD from "./AlertHUD.jsx";
import { analyzeArea, fetchSearchSuggestions } from "../lib/api.js";
import { riskLevelMeta } from "../data/floodData.js";

const NEARBY_AREAS = [
  { name: "Gachibowli, Hyderabad", level: "low" },
  { name: "Begumpet, Hyderabad", level: "high" },
  { name: "Musi River Basin, Hyderabad", level: "severe" },
  { name: "Ghatkesar Main Road", level: "moderate" },
  { name: "Secunderabad, Hyderabad", level: "moderate" },
];

export default function MobileResidentView() {
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showEvacuation, setShowEvacuation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rainfall, setRainfall] = useState(65);

  const runAnalysis = useCallback(async (params) => {
    setIsLoading(true);
    try {
      const res = await analyzeArea({
        rainfall_mm: params.rainfall_mm !== undefined ? params.rainfall_mm : rainfall,
        location_name: params.location_name,
        latitude: params.latitude,
        longitude: params.longitude,
      });
      if (res && res.status === "success") {
        setSelectedArea(res);
        setSelectedRoad(null);
        setSearchQuery(res.area_name);
      }
    } catch (err) {
      console.error("Mobile area analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [rainfall]);

  useEffect(() => {
    runAnalysis({ location_name: "Gachibowli, Hyderabad", rainfall_mm: 65 });
  }, []);

  // Fetch live autocomplete suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        const res = await fetchSearchSuggestions(searchQuery);
        setSuggestions(res);
      } else {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    runAnalysis({ location_name: searchQuery.trim(), rainfall_mm: rainfall });
    setSheetExpanded(false);
  };

  const handleMapClick = ({ latitude, longitude }) => {
    runAnalysis({ latitude, longitude, rainfall_mm: rainfall });
  };

  // Construct dynamic risk override for AlertHUD
  const riskTier = selectedArea?.risk_tier || "Low";
  const score = selectedArea ? Number(selectedArea.susceptibility_score) : 0.05;
  const mappedLevel =
    riskTier === "Very High"
      ? "severe"
      : riskTier === "High"
      ? "high"
      : riskTier === "Moderate"
      ? "moderate"
      : "low";

  const roads = selectedArea?.affected_roads || [];
  const submergedRoads = roads.filter((r) => r.inundation_tier in { Critical: 1, Severe: 1 });

  const riskOverride = selectedArea
    ? {
        level: mappedLevel,
        location: selectedArea.area_name,
        waterDepthMin: (score * 1.5).toFixed(1),
        waterDepthMax: (score * 2.8 + 0.2).toFixed(1),
        etaHours: riskTier.includes("High") ? 1.5 : 4.0,
        confidence: Math.round(score * 100),
      }
    : null;

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-black/5 px-4 py-3 bg-white">
        <Logo size={24} textClassName="text-[16px] text-ink-900 font-bold" />
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-50 px-2.5 py-1 text-[10.5px] font-semibold text-cyan-700">
          <Sparkles size={11} className="text-cyan-600" />
          <span>Featherless AI</span>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="relative flex-1 overflow-hidden bg-slate-50">
        <div className="thin-scroll h-full overflow-y-auto px-4 pt-3 pb-28 space-y-3">
          {/* Risk card via AlertHUD */}
          <AlertHUD
            variant="card"
            riskOverride={riskOverride}
            onEvacuationClick={() => setShowEvacuation((v) => !v)}
          />

          {/* Map Canvas with Road Gradients */}
          <div className="relative h-[320px] overflow-hidden rounded-2xl shadow-card border border-black/10">
            <MapCanvas
              variant="light"
              selectedArea={selectedArea}
              selectedRoad={selectedRoad}
              onRoadSelect={(r) => setSelectedRoad(r)}
              rainfall={rainfall}
              isLoading={isLoading}
              onMapClick={handleMapClick}
              showEvacuation={showEvacuation}
            />
            <button
              aria-label="Center on my location"
              onClick={() => runAnalysis({ location_name: "Gachibowli, Hyderabad", rainfall_mm: rainfall })}
              className="absolute bottom-4 right-4 z-[400] grid h-9 w-9 place-items-center rounded-full bg-white text-ink-700 shadow-card border border-black/10 active:scale-95 transition"
            >
              <LocateFixed size={17} />
            </button>
          </div>

          {/* Road Inundation Status Card */}
          {roads.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-900">
                  <Car size={15} className="text-cyan-600" />
                  <span>Roads & Corridors ({roads.length})</span>
                </div>
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  {submergedRoads.length} Submerged
                </span>
              </div>

              <div className="space-y-1.5">
                {roads.slice(0, 4).map((road) => (
                  <div
                    key={road.id}
                    onClick={() => setSelectedRoad(road)}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2 text-left cursor-pointer hover:bg-slate-100 transition"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="truncate text-[12px] font-semibold text-slate-800">
                        {road.road_name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {road.road_type} • Depth: <strong style={{ color: road.gradient_color }}>{road.predicted_water_depth_m}m</strong>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${road.badge_class}`}
                    >
                      {road.inundation_tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Tactical Directive Card */}
          {selectedArea && (
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={16} className="text-cyan-600" />
                <h4 className="text-[13px] font-bold text-slate-800">
                  AI Flood Analysis • {selectedArea.area_name}
                </h4>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600">
                {selectedArea.ai_summary}
              </p>

              {selectedArea.recommendations && selectedArea.recommendations.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-black/5 pt-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Emergency Advisories
                  </span>
                  {selectedArea.recommendations.slice(0, 3).map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11.5px] text-slate-700">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Search Sheet */}
        <div
          className={`absolute inset-x-0 bottom-0 z-[500] rounded-t-2xl bg-white px-4 pb-4 pt-2 shadow-[0_-8px_24px_rgba(10,15,26,0.15)] border-t border-black/5 transition-[max-height] duration-300 ${
            sheetExpanded ? "max-h-[80%]" : "max-h-[96px]"
          }`}
        >
          <button
            aria-label="Expand search"
            onClick={() => setSheetExpanded((v) => !v)}
            className="mx-auto mb-1.5 flex h-3.5 w-full items-center justify-center cursor-pointer"
          >
            <span className="h-1 w-8 rounded-full bg-black/20" />
          </button>

          <form onSubmit={handleSearchSubmit} className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSheetExpanded(true)}
              placeholder="Search area (e.g. Begumpet, Musi River)..."
              className="w-full rounded-xl bg-slate-100 py-2 pl-9 pr-16 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 border border-slate-200 focus:border-cyan-500 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-cyan-700 transition disabled:opacity-50"
            >
              Go
            </button>
          </form>

          {/* Autocomplete Suggestions or Quick Locations */}
          {sheetExpanded && (
            <div className="mt-3 space-y-1 overflow-y-auto max-h-[260px]">
              <div className="flex items-center justify-between px-1 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {suggestions.length > 0 ? "Matched Localities" : "Quick Hyderabad Locations"}
                </p>
                <button
                  onClick={() => setSheetExpanded(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              {(suggestions.length > 0 ? suggestions : NEARBY_AREAS).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    runAnalysis({ location_name: item.name, rainfall_mm: rainfall });
                    setSheetExpanded(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 active:bg-slate-200"
                >
                  <div>
                    <span className="text-[13px] font-medium text-slate-800">{item.name}</span>
                    {item.category && (
                      <div className="text-[10.5px] text-slate-400">{item.category}</div>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: riskLevelMeta[item.level || "moderate"]?.color || "#0ea5e9" }}
                  >
                    {riskLevelMeta[item.level || "moderate"]?.label || "Select"}
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

"use client";

import { useState } from "react";
import { Search, LocateFixed, Waves, AlertTriangle } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import { analyzeArea } from "../lib/api.js";
import { currentRisk, riskLevelMeta } from "../data/floodData.js";

export default function MobileResidentView({
  searchQuery, setSearchQuery,
  isAnalyzing,
  analysisResult,
  horizon, setHorizon,
  handleSearch
}) {
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showEvacuation, setShowEvacuation] = useState(false);

  const getRiskDetails = () => {
    if (!analysisResult) return null;
    const isCritical = analysisResult.risk_level === 'CRITICAL' || horizon > 80;
    const isHigh = analysisResult.risk_level === 'HIGH' || horizon > 60;
    
    const riskLabel = isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : analysisResult.risk_level;
    const color = isCritical ? riskLevelMeta.severe.color : isHigh ? riskLevelMeta.high.color : riskLabel === 'MODERATE' ? riskLevelMeta.moderate.color : riskLevelMeta.low.color;
    
    const displaySusceptibility = Math.min(100, (analysisResult.susceptibility_score * 100) + (horizon / 100) * 15).toFixed(1);
    
    return { label: riskLabel, color, susceptibility: displaySusceptibility };
  };

  const riskDetails = getRiskDetails();

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-black/5 px-5 py-4">
        <Logo size={26} textClassName="text-[17px] text-ink-900" />
        <button
          onClick={() => setSheetExpanded(true)}
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-full text-ink-700 transition hover:bg-ink-900/5"
        >
          <Search size={19} strokeWidth={2.1} />
        </button>
      </header>

      {/* Scrollable content */}
      <div className="relative flex-1 overflow-hidden">
        <div className="thin-scroll h-full overflow-y-auto px-4 pt-4">
          
          {/* AI Risk Card */}
          {isAnalyzing ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-card">
              <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-[13px] font-medium">Analyzing Area...</p>
            </div>
          ) : analysisResult && riskDetails ? (
            <div className="overflow-hidden rounded-2xl shadow-card" aria-label="AI Risk Card">
              <div
                className="flex items-center gap-3 px-5 py-5 transition-colors"
                style={{ backgroundColor: riskDetails.color }}
              >
                <Waves size={30} color="white" strokeWidth={2.4} />
                <span className="text-2xl font-extrabold tracking-tight text-white">
                  {riskDetails.label.toUpperCase()} RISK
                </span>
              </div>
              <div className="space-y-3 bg-white px-5 py-4">
                <div className="flex items-baseline justify-between border-b border-black/5 pb-3">
                  <span className="text-[15px] text-ink-500">AI Susceptibility:</span>
                  <span className="text-[16px] font-bold text-ink-900">
                    {riskDetails.susceptibility}%
                  </span>
                </div>
                
                <div className="pt-1">
                  <span className="text-[12px] font-semibold uppercase text-ink-500 flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} /> AI Advisory
                  </span>
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {analysisResult.ai_explanation.replace(/[#*`]/g, '').slice(0, 150)}
                    {analysisResult.ai_explanation.length > 150 ? '...' : ''}
                  </p>
                </div>
                
                <div className="border-t border-black/5 pt-3">
                  <button
                    onClick={() => setShowEvacuation((v) => !v)}
                    className="flex w-full items-center justify-between text-[15px] font-semibold text-brand-600 transition hover:text-brand-700"
                  >
                    View evacuation routes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl bg-ink-900/5 text-ink-500 shadow-card">
              <LocateFixed size={24} className="mb-2 opacity-50" />
              <p className="text-[13px] font-medium">Search an area to view AI risk</p>
            </div>
          )}

          {/* Rainfall Slider */}
          {analysisResult && (
            <div className="mt-4">
              <RainfallSlider
                value={horizon}
                onChange={setHorizon}
                className="w-full"
              />
            </div>
          )}

          {/* Map Canvas */}
          <div className="relative mt-4 h-[360px] overflow-hidden rounded-2xl shadow-card">
            <MapCanvas
              variant="light"
              showMarkers={false}
              showOverlay={false}
              showEvacuation={showEvacuation}
              horizon={horizon}
              center={analysisResult ? [analysisResult.latitude, analysisResult.longitude] : undefined}
              marker={analysisResult ? { lat: analysisResult.latitude, lng: analysisResult.longitude, label: analysisResult.location } : null}
            />
            
            <button
              aria-label="Center on my location"
              className="absolute bottom-4 right-4 z-[400] grid h-10 w-10 place-items-center rounded-full bg-white text-ink-700 shadow-card"
            >
              <LocateFixed size={19} />
            </button>
          </div>

          <div className="h-40" />
        </div>

        {/* Bottom search & slider sheet */}
        <div
          className={`absolute inset-x-0 bottom-0 z-[500] rounded-t-2xl bg-white px-4 pb-5 pt-2 shadow-[0_-8px_24px_rgba(10,15,26,0.12)] transition-[max-height] duration-300 ${
            sheetExpanded ? "max-h-[80%]" : "max-h-[140px]"
          }`}
        >
          <button
            aria-label="Expand search"
            onClick={() => setSheetExpanded((v) => !v)}
            className="mx-auto mb-2 flex h-4 w-full items-center justify-center"
          >
            <span className="h-1 w-9 rounded-full bg-black/15" />
          </button>
          
          <form onSubmit={(e) => { setSheetExpanded(false); handleSearch(e); }} className="mb-4">
            <label className="flex items-center gap-2 rounded-xl bg-ink-900/5 px-3.5 py-3 focus-within:ring-2 focus-within:ring-brand-500">
              <Search size={17} className="text-ink-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search an address or area"
                className="w-full bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-500"
              />
            </label>
          </form>

          {sheetExpanded && !analysisResult && (
            <div className="mt-4 space-y-1">
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Suggested areas
              </p>
              {[
                { name: "Gachibowli, Hyderabad" },
                { name: "Madhapur, Hyderabad" },
                { name: "Keesara Bridge" },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    setSearchQuery(item.name);
                    handleSearch({ preventDefault: () => {} });
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-ink-900/5"
                >
                  <span className="text-[14px] font-medium text-ink-900">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

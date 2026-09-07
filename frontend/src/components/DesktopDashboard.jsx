"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Gauge, Activity, FileText, CheckCircle2 } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import { analyzeArea, fetchHealth, fetchModelStatus } from "../lib/api.js";

export default function DesktopDashboard({
  searchQuery, setSearchQuery,
  isAnalyzing,
  analysisResult,
  horizon, setHorizon,
  errorMsg,
  handleSearch,
  effectiveScore,
  effectiveTier
}) {
  const [backendOnline, setBackendOnline] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);

  // Check backend health & model status on mount
  useEffect(() => {
    fetchHealth().then((res) => {
      if (res && res.status === "ok") {
        setBackendOnline(true);
      }
    });

    fetchModelStatus().then((info) => {
      if (info) {
        setModelInfo(info);
      }
    });
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-900 text-slate-200">
      {/* Header */}
      <header className="flex flex-col sm:flex-row shrink-0 items-stretch sm:items-center justify-between border-b border-white/[0.06] bg-ink-900 px-3 sm:px-5 py-2.5 sm:py-0 sm:h-14 gap-2.5 sm:gap-4 z-10">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
          <Logo size={22} textClassName="text-[14px] sm:text-[15px] font-bold text-white tracking-tight" />
          {backendOnline ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10.5px] sm:text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Hybrid AI / Featherless Linked</span>
              <span className="sm:hidden">AI Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10.5px] sm:text-[11px] text-rose-400">
              Offline
            </span>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="e.g. Gachibowli, Hyderabad"
              className="w-full rounded-full border border-white/[0.1] bg-ink-800 py-1.5 pl-9 pr-3 text-[12.5px] sm:text-[13px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isAnalyzing}
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !searchQuery.trim()}
            className="shrink-0 rounded-full bg-brand-600 px-3.5 sm:px-4 py-1.5 text-[12px] sm:text-[13px] font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
        </form>
      </header>

      {/* Body: Mobile flex-col (Map 60vh top, Data panel bottom) | Desktop lg:flex-row (Data panel fixed left 420px, Map flex-1 right) */}
      <div className="relative flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Mapbox / Vector Map Container (Top 60% viewport height on Mobile, Right flex-1 on Desktop) */}
        <div className="relative order-1 lg:order-2 h-[60vh] lg:h-full w-full lg:w-auto lg:flex-1 shrink-0 lg:shrink">
          <MapCanvas
            variant="dark"
            showMarkers={false}
            zoom={analysisResult ? 15 : 12}
            showOverlay={false}
            showEvacuation={false}
            horizon={horizon}
            center={analysisResult ? [analysisResult.latitude, analysisResult.longitude] : undefined}
            marker={analysisResult ? { lat: analysisResult.latitude, lng: analysisResult.longitude, label: analysisResult.location } : null}
          />
          
          {analysisResult && (
            <div className="absolute inset-x-0 bottom-3 sm:bottom-4 z-[400] flex justify-center px-3 sm:px-4">
              <RainfallSlider
                value={horizon}
                onChange={setHorizon}
                className="w-full max-w-[420px]"
              />
            </div>
          )}
        </div>

        {/* Data Panel: Stacks underneath Map on Mobile with vertical scroll, Left fixed 420px on Desktop */}
        <aside className="thin-scroll order-2 lg:order-1 flex-1 min-h-0 w-full lg:w-[420px] lg:h-full lg:flex-none shrink-0 lg:shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-r border-white/[0.06] bg-ink-800 px-3.5 sm:px-4 py-3.5 sm:py-4 space-y-3.5 sm:space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 sm:p-4 text-[12.5px] sm:text-[13px] text-rose-400">
              {errorMsg}
            </div>
          )}

          {!analysisResult && !isAnalyzing && !errorMsg && (
            <div className="flex h-44 sm:h-64 flex-col items-center justify-center text-center text-slate-500 px-4">
              <MapPin size={30} className="mb-2.5 opacity-50 text-slate-400" />
              <p className="text-[13px] font-medium text-slate-300">No Area Selected</p>
              <p className="mt-1 max-w-[250px] text-[11.5px] sm:text-[12px] text-slate-400 leading-relaxed">Search for a location to analyze real-time flood susceptibility using LightGBM and Featherless AI.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-44 sm:h-64 flex-col items-center justify-center text-center text-brand-400 px-4">
              <div className="mb-3.5 h-7 w-7 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              <p className="text-[13px] font-medium">Extracting Terrain & Rainfall...</p>
              <p className="mt-1 text-[11px] text-slate-500">Orchestrating via Featherless Agent</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-3.5 sm:space-y-4 animate-in fade-in">
              <div className="rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                <p className="mb-1 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">Location</p>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">{analysisResult.location}</h2>
                <div className="mt-2 flex gap-4 text-[11.5px] sm:text-[12px] text-slate-400">
                  <span>Lat: {analysisResult.latitude.toFixed(4)}</span>
                  <span>Lon: {analysisResult.longitude.toFixed(4)}</span>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="flex-1 rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                  <p className="mb-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">Susceptibility</p>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-white">
                      {effectiveScore}%
                    </span>
                  </div>
                </div>
                <div className="flex-1 rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                  <p className="mb-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">Risk Tier</p>
                  <div className={`text-lg sm:text-xl font-bold ${
                    effectiveTier === 'CRITICAL' ? 'text-rose-500' :
                    effectiveTier === 'HIGH' ? 'text-amber-500' :
                    effectiveTier === 'MODERATE' ? 'text-yellow-400' : 'text-emerald-400'
                  }`}>
                    {effectiveTier}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <FileText size={13} /> AI Advisory (Featherless)
                </p>
                <div className="prose prose-invert prose-sm max-w-none text-[12.5px] sm:text-[13px] leading-relaxed text-slate-300">
                  <p className="mb-2">
                    {analysisResult.ai_explanation.replace(/[#*`]/g, '').slice(0, 180)}
                    {analysisResult.ai_explanation.length > 180 ? '...' : ''}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/40 p-3.5 sm:p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Actionable Recommendations
                </p>
                <ul className="space-y-2 text-[12.5px] sm:text-[13px] text-slate-300">
                  {effectiveTier === 'CRITICAL' && (
                    <>
                      <li className="flex gap-2"><span className="text-rose-400 font-bold">•</span> Evacuate immediately if advised by local authorities.</li>
                      <li className="flex gap-2"><span className="text-rose-400 font-bold">•</span> Move essential items to the highest possible floor.</li>
                      <li className="flex gap-2"><span className="text-rose-400 font-bold">•</span> Avoid all travel; roads are extremely dangerous.</li>
                    </>
                  )}
                  {effectiveTier === 'HIGH' && (
                    <>
                      <li className="flex gap-2"><span className="text-amber-400 font-bold">•</span> Prepare an emergency kit and be ready to evacuate.</li>
                      <li className="flex gap-2"><span className="text-amber-400 font-bold">•</span> Move valuables to higher ground.</li>
                      <li className="flex gap-2"><span className="text-amber-400 font-bold">•</span> Avoid driving through flooded roads or bridges.</li>
                    </>
                  )}
                  {effectiveTier === 'MODERATE' && (
                    <>
                      <li className="flex gap-2"><span className="text-yellow-400 font-bold">•</span> Stay informed on local weather updates.</li>
                      <li className="flex gap-2"><span className="text-yellow-400 font-bold">•</span> Clear gutters and drains around your property.</li>
                      <li className="flex gap-2"><span className="text-yellow-400 font-bold">•</span> Avoid parking in low-lying areas.</li>
                    </>
                  )}
                  {effectiveTier === 'LOW' && (
                    <>
                      <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> Normal activities can proceed safely.</li>
                      <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> Ensure rainwater harvesting systems are clear.</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/40 p-3 sm:p-3.5 text-[10.5px] sm:text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-300">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Engine: {analysisResult.model_version}</span>
                </div>
                <p>Saved to Supabase successfully.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}


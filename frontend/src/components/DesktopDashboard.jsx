"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Gauge, Activity, FileText, CheckCircle2 } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import { analyzeArea, fetchHealth, fetchModelStatus } from "../lib/api.js";

export default function DesktopDashboard() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [horizon, setHorizon] = useState(62);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsAnalyzing(true);
    setErrorMsg("");
    setAnalysisResult(null);
    
    try {
      const res = await analyzeArea(searchQuery);
      if (res && res.location) {
        setAnalysisResult(res);
      } else {
        setErrorMsg("Analysis failed. Please check the backend or your query.");
      }
    } catch (err) {
      setErrorMsg(err.message || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-900 text-slate-200">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <div className="flex items-center gap-3">
          <Logo size={24} textClassName="text-[15px] text-white" />
          {backendOnline ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Hybrid AI / Featherless Linked
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[11px] text-rose-400">
              Backend Offline
            </span>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="e.g. Gachibowli, Hyderabad"
              className="w-80 rounded-full border border-white/[0.1] bg-ink-800 py-1.5 pl-9 pr-4 text-[13px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isAnalyzing}
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !searchQuery.trim()}
            className="rounded-full bg-brand-600 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Area"}
          </button>
        </form>
      </header>

      {/* Body: sidebar + map */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="thin-scroll w-[420px] shrink-0 overflow-y-auto border-r border-white/[0.06] bg-ink-800 px-4 py-4 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-[13px] text-rose-400">
              {errorMsg}
            </div>
          )}

          {!analysisResult && !isAnalyzing && !errorMsg && (
            <div className="flex h-64 flex-col items-center justify-center text-center text-slate-500">
              <MapPin size={32} className="mb-3 opacity-50" />
              <p className="text-[13px] font-medium">No Area Selected</p>
              <p className="mt-1 max-w-[250px] text-[12px]">Search for a location to analyze real-time flood susceptibility using LightGBM and Featherless AI.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-64 flex-col items-center justify-center text-center text-brand-400">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              <p className="text-[13px] font-medium">Extracting Terrain & Rainfall...</p>
              <p className="mt-1 text-[11px] text-slate-500">Orchestrating via Featherless Agent</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-5 animate-in fade-in">
              <div className="rounded-xl border border-white/[0.06] bg-ink-700/60 p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Location</p>
                <h2 className="text-lg font-bold text-white leading-tight">{analysisResult.location}</h2>
                <div className="mt-2 flex gap-4 text-[12px] text-slate-400">
                  <span>Lat: {analysisResult.latitude.toFixed(4)}</span>
                  <span>Lon: {analysisResult.longitude.toFixed(4)}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 rounded-xl border border-white/[0.06] bg-ink-700/60 p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Susceptibility</p>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-white">
                      {Math.min(100, (analysisResult.susceptibility_score * 100) + (horizon / 100) * 15).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex-1 rounded-xl border border-white/[0.06] bg-ink-700/60 p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Risk Tier</p>
                  <div className={`text-xl font-bold ${
                    analysisResult.risk_level === 'CRITICAL' || horizon > 80 ? 'text-rose-500' :
                    analysisResult.risk_level === 'HIGH' || horizon > 60 ? 'text-amber-500' :
                    analysisResult.risk_level === 'MODERATE' ? 'text-yellow-400' : 'text-emerald-400'
                  }`}>
                    {horizon > 80 ? 'CRITICAL' : horizon > 60 ? 'HIGH' : analysisResult.risk_level}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/60 p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <FileText size={13} /> AI Advisory (Featherless)
                </p>
                <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed text-slate-300">
                  <p className="mb-2">
                    {analysisResult.ai_explanation.replace(/[#*`]/g, '').slice(0, 180)}
                    {analysisResult.ai_explanation.length > 180 ? '...' : ''}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Model Features ({Object.keys(analysisResult.features_used).length})
                </p>
                <div className="space-y-1 rounded-xl border border-white/[0.06] bg-ink-700/40 p-3">
                  {Object.entries(analysisResult.features_used).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[12px]">
                      <span className="text-slate-400">{k}</span>
                      <span className="font-mono font-medium text-slate-200">{typeof v === 'number' ? v.toFixed(2) : v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/40 p-3.5 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-slate-300">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Engine: {analysisResult.model_version}</span>
                </div>
                <p>Saved to Supabase successfully.</p>
              </div>
            </div>
          )}
        </aside>

        {/* Map */}
        <div className="relative flex-1">
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
            <div className="absolute inset-x-0 bottom-4 z-[400] flex justify-center px-4">
              <RainfallSlider
                value={horizon}
                onChange={setHorizon}
                className="w-[420px]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


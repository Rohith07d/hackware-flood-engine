"use client";

import { useState, useEffect } from "react";
import { Bell, ChevronDown, Gauge, Building2, Shield, HeartPulse, User, Layers, Info, CheckCircle2 } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import Sparkline from "./Sparkline.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import AlertHUD from "./AlertHUD.jsx";
import { predictionDrivers, dashboardStats } from "../data/floodData.js";
import { predictFlood, fetchHealth, fetchModelStatus } from "../lib/api.js";

const legendItems = [
  { type: "gauge", label: "River gauge", icon: Gauge, color: "#f5b942" },
  { type: "infrastructure", label: "River infrastructure", icon: Building2, color: "#2dd4bf" },
  { type: "police", label: "Police stations", icon: Shield, color: "#4d8bf5" },
  { type: "critical", label: "Critical infrastructure", icon: HeartPulse, color: "#e2483d" },
];

export default function DesktopDashboard() {
  const [horizon, setHorizon] = useState(62);
  const [backendOnline, setBackendOnline] = useState(false);
  const [livePrediction, setLivePrediction] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

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

  // Fetch live prediction when rainfall slider changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      predictFlood({
        latitude: 17.4065,
        longitude: 78.4772,
        rainfall_mm: horizon,
      }).then((pred) => {
        if (pred) {
          setLivePrediction(pred);
          setBackendOnline(true);
        }
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [horizon]);

  // Derived stats combining baseline and live LightGBM predictions
  const stats = livePrediction
    ? {
        affectedArea: `${(horizon * 0.08).toFixed(1)} km²`,
        maxDepth: `${(horizon * 0.035).toFixed(1)} m`,
        highRiskStreets: Math.max(2, Math.round(horizon * 0.45)),
        confidence: `${Math.round(livePrediction.susceptibility * 100)}%`,
      }
    : dashboardStats;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-900 text-slate-200">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <div className="flex items-center gap-3">
          <Logo size={24} textClassName="text-[15px] text-white" />
          {backendOnline ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live LightGBM AI (13 Features)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-400">
              Local Standalone Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              showOverlay
                ? "bg-brand-600/30 text-brand-300 border border-brand-500/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
            title="Toggle LightGBM raster susceptibility heatmap layer"
          >
            <Layers size={14} />
            <span>AI Susceptibility Map: {showOverlay ? "ON" : "OFF"}</span>
          </button>
          <button className="relative grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
            <Bell size={16} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-risk-high" />
          </button>
          <button className="flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-2 text-slate-300 transition hover:bg-white/5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white">
              <User size={13} />
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

      {/* Body: sidebar + map */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="thin-scroll w-80 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-ink-800 px-4 py-4 space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              AI Flood Susceptibility
            </p>
            <AlertHUD variant="stats" statsOverride={stats} predictionOverride={livePrediction} />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Prediction Drivers (Hydrology & Terrain)
            </p>
            <div className="space-y-4 rounded-xl border border-white/[0.06] bg-ink-700/60 p-4">
              {predictionDrivers.map((d) => (
                <div key={d.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[12.5px] text-slate-400">{d.label}</span>
                    {d.value !== null && (
                      <span className="font-mono text-[12.5px] font-semibold text-white">
                        {d.value}
                        {d.unit}
                      </span>
                    )}
                  </div>
                  <Sparkline bars={d.bars} color="#33b8cf" />
                </div>
              ))}
            </div>
          </div>

          {/* Model Pipeline Spec */}
          <div className="rounded-xl border border-white/[0.06] bg-ink-700/40 p-3.5 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Model: {modelInfo?.model_name || "lgb_flood_model.txt"}</span>
            </div>
            <p>13 calibrated features: 9 physical DEM terrain + 4 hydrological storm parameters.</p>
            <div className="pt-2 border-t border-white/[0.06] flex items-start gap-1.5 text-slate-500">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>AI-based Flood Susceptibility Estimate (Experimental Prototype). Relative spatial probability, not an official flood warning.</span>
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="relative flex-1">
          <MapCanvas
            variant="dark"
            showMarkers
            zoom={13.5}
            showOverlay={showOverlay}
            overlayOpacity={0.7}
          />

          {/* Legend overlay */}
          <div className="absolute left-4 top-4 z-[400] w-56 rounded-lg border border-white/[0.08] bg-ink-800/90 p-3 backdrop-blur-sm">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Map Legend</p>
            {legendItems.map((item) => (
              <div key={item.type} className="flex items-center gap-2 py-1">
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: item.color }}
                >
                  <item.icon size={9} color="#0a0f1a" strokeWidth={2.5} />
                </span>
                <span className="text-[12px] text-slate-300">{item.label}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-white/[0.06] pt-2">
              <span className="h-2.5 w-6 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-rose-600" />
              <span className="text-[12px] text-slate-300">AI Susceptibility Layer</span>
            </div>
          </div>

          {/* Severity scale, top-right */}
          <div className="absolute right-4 top-4 z-[400] flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink-800/90 px-3 py-2 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-300">Risk Tier</span>
            <span className="h-2 w-24 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600" />
            <span className="font-mono text-[11px] font-bold text-slate-200">
              {livePrediction?.risk_level || "MODERATE"}
            </span>
          </div>

          {/* Depth legend, bottom-right */}
          <div className="absolute bottom-20 right-4 z-[400] rounded-lg border border-white/[0.08] bg-ink-800/90 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex h-24 gap-2">
              <div className="w-2 rounded-full bg-gradient-to-t from-emerald-500 via-amber-500 to-rose-600" />
              <div className="flex flex-col justify-between py-0.5 text-[10.5px] text-slate-400">
                <span>Critical</span>
                <span className="text-slate-500">High</span>
                <span>Moderate</span>
                <span className="text-slate-500">Low</span>
              </div>
            </div>
          </div>

          {/* Time horizon / rainfall slider */}
          <div className="absolute inset-x-0 bottom-4 z-[400] flex justify-center px-4">
            <RainfallSlider
              value={horizon}
              onChange={setHorizon}
              className="w-[420px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { CloudRain, Wind, Thermometer, Calendar, X, TrendingUp, AlertTriangle } from "lucide-react";

export default function ForecastTrendCard({ weatherData, currentRainfall = 62, onClose }) {
  const [activeWindow, setActiveWindow] = useState("24h"); // "24h" | "48h" | "72h"

  if (!weatherData) return null;

  const current = weatherData.current || {};
  const forecastSummary = weatherData.forecast_summary || {};
  const hourly = weatherData.hourly || {};
  const times = hourly.time || [];
  const precipitation = hourly.precipitation || [];

  // Slice hourly forecast based on window
  const windowCount = activeWindow === "24h" ? 24 : activeWindow === "48h" ? 48 : 72;
  const slicedTimes = times.slice(0, windowCount);
  const slicedPrecip = precipitation.slice(0, windowCount);

  // Cumulative rain in this window
  const totalWindowRain = slicedPrecip.reduce((acc, val) => acc + (val || 0), 0);
  const maxPrecip = Math.max(1, ...slicedPrecip);

  // Projected flood susceptibility curve
  // Model heuristic: baseline + rain impact
  const projectedRisk24h = Math.min(100, Math.round(30 + (forecastSummary.precip_24h_mm || 0) * 1.8));
  const projectedRisk48h = Math.min(100, Math.round(35 + (forecastSummary.precip_48h_mm || 0) * 1.5));
  const projectedRisk72h = Math.min(100, Math.round(35 + (forecastSummary.precip_72h_mm || 0) * 1.3));

  const activeProjectedRisk =
    activeWindow === "24h" ? projectedRisk24h : activeWindow === "48h" ? projectedRisk48h : projectedRisk72h;

  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-ink-800/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <CloudRain size={18} />
          </div>
          <div>
            <h3 className="text-[13.5px] sm:text-[14px] font-semibold text-white">Live Weather & Flood Trend</h3>
            <p className="text-[10.5px] text-slate-400">Open-Meteo High-Resolution Ensemble Forecast</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            aria-label="Close forecast"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Current Conditions Strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-4 text-center">
        <div className="rounded-xl border border-white/[0.05] bg-ink-700/50 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <Thermometer size={13} className="text-amber-400" /> Temp
          </div>
          <div className="text-[14px] sm:text-[15px] font-bold text-white">
            {current.temperature_2m != null ? `${current.temperature_2m}°C` : "--"}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.05] bg-ink-700/50 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <Wind size={13} className="text-sky-400" /> Wind
          </div>
          <div className="text-[14px] sm:text-[15px] font-bold text-white">
            {current.wind_speed_10m != null ? `${current.wind_speed_10m} km/h` : "--"}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.05] bg-ink-700/50 p-2.5">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <CloudRain size={13} className="text-brand-400" /> Rain
          </div>
          <div className="text-[14px] sm:text-[15px] font-bold text-white">
            {current.precipitation != null ? `${current.precipitation} mm` : "0.0 mm"}
          </div>
        </div>
      </div>

      {/* Window Tabs (24h / 48h / 72h) */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Projection Horizon</span>
        <div className="flex rounded-lg bg-ink-900/80 p-0.5 border border-white/[0.06]">
          {["24h", "48h", "72h"].map((windowKey) => (
            <button
              key={windowKey}
              onClick={() => setActiveWindow(windowKey)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                activeWindow === windowKey
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {windowKey}
            </button>
          ))}
        </div>
      </div>

      {/* Projected Risk Alert */}
      <div className="mb-3.5 rounded-xl border border-brand-500/20 bg-brand-500/10 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-400" />
          <div>
            <div className="text-[11.5px] font-semibold text-white">
              {activeWindow} Projected Flood Susceptibility
            </div>
            <div className="text-[10px] text-slate-400">
              Cumulative rain: <span className="font-semibold text-brand-300">{totalWindowRain.toFixed(1)} mm</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[16px] font-black ${
            activeProjectedRisk > 70 ? "text-rose-400" : activeProjectedRisk > 45 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {activeProjectedRisk}%
          </div>
          <div className="text-[9.5px] uppercase font-bold text-slate-400">
            {activeProjectedRisk > 70 ? "Critical" : activeProjectedRisk > 45 ? "Moderate" : "Low Risk"}
          </div>
        </div>
      </div>

      {/* Hourly Rainfall Histogram */}
      <div>
        <div className="flex items-center justify-between mb-1.5 text-[10.5px] text-slate-400">
          <span>Hourly Precipitation Profile (mm/hr)</span>
          <span>Peak: {maxPrecip.toFixed(1)} mm</span>
        </div>
        <div className="flex h-16 items-end gap-1 rounded-lg border border-white/[0.05] bg-ink-900/60 p-2 overflow-x-auto thin-scroll">
          {slicedPrecip.map((precip, idx) => {
            const heightPercent = maxPrecip > 0 ? Math.max(8, (precip / maxPrecip) * 100) : 8;
            const timeLabel = slicedTimes[idx] ? slicedTimes[idx].slice(11, 16) : `${idx}h`;
            return (
              <div
                key={idx}
                className="group relative flex-1 min-w-[8px] h-full flex flex-col justify-end items-center"
                title={`${timeLabel}: ${precip}mm`}
              >
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    precip > 5 ? "bg-rose-500" : precip > 2 ? "bg-amber-400" : "bg-brand-500/80"
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

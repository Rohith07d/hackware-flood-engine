"use client";

import { useState } from "react";
import { Bell, ChevronDown, Gauge, Building2, Shield, HeartPulse, User } from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import Sparkline from "./Sparkline.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import AlertHUD from "./AlertHUD.jsx";
import { predictionDrivers } from "../data/floodData.js";

const legendItems = [
  { type: "gauge", label: "River gauge", icon: Gauge, color: "#f5b942" },
  { type: "infrastructure", label: "River infrastructure", icon: Building2, color: "#2dd4bf" },
  { type: "police", label: "Police stations", icon: Shield, color: "#4d8bf5" },
  { type: "critical", label: "Critical infrastructure", icon: HeartPulse, color: "#e2483d" },
];

export default function DesktopDashboard() {
  const [horizon, setHorizon] = useState(62);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-900 text-slate-200">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <Logo size={24} textClassName="text-[15px] text-white" />
        <div className="flex items-center gap-4">
          <button className="relative grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
            <Bell size={16} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-risk-high" />
          </button>
          <button className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
            <Bell size={16} />
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
        <aside className="thin-scroll w-72 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-ink-800 px-4 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            AI Flood Prediction
          </p>
          <AlertHUD variant="stats" />

          <p className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Prediction Drivers
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
        </aside>

        {/* Map */}
        <div className="relative flex-1">
          <MapCanvas variant="dark" showMarkers zoom={13.5} />

          {/* Legend overlay */}
          <div className="absolute left-4 top-4 z-[400] w-52 rounded-lg border border-white/[0.08] bg-ink-800/90 p-3 backdrop-blur-sm">
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
            <div className="mt-1.5 flex items-center gap-2 border-t border-white/[0.06] pt-2">
              <span className="h-2.5 w-6 rounded-full bg-gradient-to-r from-risk-low via-risk-moderate to-risk-high" />
              <span className="text-[12px] text-slate-300">Flood risk</span>
            </div>
          </div>

          {/* Severity scale, top-right */}
          <div className="absolute right-4 top-4 z-[400] flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink-800/90 px-3 py-2 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-slate-300">Severe</span>
            <span className="h-2 w-24 rounded-full bg-gradient-to-r from-risk-low via-risk-moderate to-risk-severe" />
            <span className="font-mono text-[11px] text-slate-400">&gt;2m</span>
          </div>

          {/* Depth legend, bottom-right */}
          <div className="absolute bottom-20 right-4 z-[400] rounded-lg border border-white/[0.08] bg-ink-800/90 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex h-24 gap-2">
              <div className="w-2 rounded-full bg-gradient-to-t from-risk-low via-risk-moderate to-risk-severe" />
              <div className="flex flex-col justify-between py-0.5 text-[10.5px] text-slate-400">
                <span>&gt;2m</span>
                <span className="text-slate-500">Severe</span>
                <span>Low</span>
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

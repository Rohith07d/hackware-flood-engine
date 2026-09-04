"use client";

import { Waves, ChevronRight } from "lucide-react";
import { currentRisk, riskLevelMeta, dashboardStats } from "../data/floodData.js";

export default function AlertHUD({ variant = "card", onEvacuationClick }) {
  const risk = riskLevelMeta[currentRisk.level] || riskLevelMeta.high;

  if (variant === "stats") {
    return (
      <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-ink-700/60 p-4" aria-label="Alert HUD Stats">
        <div>
          <p className="text-[12.5px] text-slate-400">Predicted Affected Area</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{dashboardStats.affectedArea}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-400">Max Predicted Depth</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{dashboardStats.maxDepth}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-400">High-Risk Streets</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{dashboardStats.highRiskStreets}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-400">Prediction Confidence</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{dashboardStats.confidence}</p>
        </div>
      </div>
    );
  }

  // Default card format
  return (
    <div className="overflow-hidden rounded-2xl shadow-card" aria-label="Alert HUD">
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ backgroundColor: risk.color }}
      >
        <Waves size={30} color="white" strokeWidth={2.4} />
        <span className="text-2xl font-extrabold tracking-tight text-white">
          {risk.label.toUpperCase()}
        </span>
      </div>
      <div className="space-y-3 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-ink-500">Expected water depth:</span>
          <span className="text-[15px] font-bold text-ink-900">
            {currentRisk.waterDepthMin}–{currentRisk.waterDepthMax} m
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-ink-500">Estimated arrival:</span>
          <span className="text-[15px] font-bold text-ink-900">
            ~{currentRisk.etaHours} hours
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-ink-500">Confidence:</span>
          <span className="text-[15px] font-bold text-ink-900">
            {currentRisk.confidence}%
          </span>
        </div>
        <div className="border-t border-black/5 pt-3">
          <button
            onClick={onEvacuationClick}
            className="flex w-full items-center justify-between text-[15px] font-semibold text-brand-600 transition hover:text-brand-700"
          >
            View evacuation routes
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

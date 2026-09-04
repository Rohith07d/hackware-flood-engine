"use client";

import { Waves, ChevronRight } from "lucide-react";
import { currentRisk, riskLevelMeta, dashboardStats } from "../data/floodData.js";

export default function AlertHUD({
  variant = "card",
  onEvacuationClick,
  riskOverride,
  statsOverride,
  predictionOverride,
}) {
  const activeStats = statsOverride || dashboardStats;
  const activeRiskData = riskOverride || currentRisk;
  const risk = riskLevelMeta[activeRiskData.level] || riskLevelMeta.high;

  if (variant === "stats") {
    return (
      <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-ink-700/60 p-4" aria-label="Alert HUD Stats">
        {predictionOverride && (
          <div className="mb-2 border-b border-white/[0.08] pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-400">Susceptibility Tier</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${
                  predictionOverride.risk_level === "CRITICAL"
                    ? "border border-red-500/30 bg-red-500/20 text-red-400"
                    : predictionOverride.risk_level === "HIGH"
                    ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                    : predictionOverride.risk_level === "MODERATE"
                    ? "border border-yellow-500/30 bg-yellow-500/20 text-yellow-300"
                    : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {predictionOverride.risk_level || "LOW"}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-[12px] text-slate-400">AI Susceptibility Score</span>
              <span className="font-mono text-lg font-bold text-white">
                {typeof predictionOverride.susceptibility === "number"
                  ? `${(predictionOverride.susceptibility * 100).toFixed(1)}%`
                  : "--"}
              </span>
            </div>
          </div>
        )}
        <div>
          <p className="text-[12.5px] text-slate-400">Predicted Affected Area</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{activeStats.affectedArea}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-400">Max Predicted Depth</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{activeStats.maxDepth}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-400">High-Risk Streets</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{activeStats.highRiskStreets}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-400">Prediction Confidence</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-brand-400">{activeStats.confidence}</p>
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

"use client";

import { X, Play, Compass, Navigation, History, ShieldAlert } from "lucide-react";

const DEMO_SCENARIOS = [
  {
    id: "musi_critical",
    title: "Musi River Basin Cloudburst",
    badge: "Critical Risk (105mm)",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    icon: <ShieldAlert size={18} className="text-rose-400" />,
    query: "Musi River, Hyderabad",
    lat: 17.3753,
    lng: 78.4744,
    rainfall: 105,
    showEvacuation: true,
    showHistorical: false,
    description: "Catchment overload along the Musi river corridor. Simulates rapid road inundation and triggers automated evacuation routing to Malakpet Shelter.",
  },
  {
    id: "gachibowli_urban",
    title: "Gachibowli IT Corridor Waterlogging",
    badge: "High Risk (58mm)",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: <Compass size={18} className="text-amber-400" />,
    query: "Gachibowli, Hyderabad",
    lat: 17.4401,
    lng: 78.3489,
    rainfall: 58,
    showEvacuation: false,
    showHistorical: false,
    description: "High impervious surface runoff causing localized street-level ponding, IT corridor bottlenecks, and crowd-sourced hazard alerts.",
  },
  {
    id: "october_2020_replay",
    title: "October 2020 Super-Storm Replay",
    badge: "Historical Event (190mm)",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: <History size={18} className="text-purple-400" />,
    query: "Charminar, Hyderabad",
    lat: 17.3616,
    lng: 78.4747,
    rainfall: 100,
    showEvacuation: false,
    showHistorical: true,
    description: "Compares current LightGBM model outputs against the actual October 13-14, 2020 historical flood footprint where 190mm fell in 24 hours.",
  },
  {
    id: "begumpet_evacuation",
    title: "Begumpet Evacuation & Safe Shelter",
    badge: "Emergency Routing (75mm)",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    icon: <Navigation size={18} className="text-cyan-400" />,
    query: "Begumpet, Hyderabad",
    lat: 17.4447,
    lng: 78.4664,
    rainfall: 75,
    showEvacuation: true,
    showHistorical: false,
    description: "Calculates Dijkstra-weighted safe paths navigating around inundated drainage arteries to Gandhi Hospital safe evacuation hub.",
  },
];

export default function GuidedDemoModal({ isOpen, onClose, onSelectScenario }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in text-slate-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-ink-800 p-5 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/[0.06] pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <Play size={18} className="ml-0.5 fill-brand-400" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">Guided Demonstration Modes</h2>
            <p className="text-[11.5px] text-slate-400">
              One-click preset scenarios showcasing multi-scale flood forecasting & response
            </p>
          </div>
        </div>

        {/* Scenarios Grid */}
        <div className="space-y-2.5 max-h-[65vh] overflow-y-auto thin-scroll pr-1">
          {DEMO_SCENARIOS.map((scenario) => (
            <div
              key={scenario.id}
              className="group flex flex-col rounded-xl border border-white/[0.06] bg-ink-900/50 p-3.5 hover:border-brand-500/40 hover:bg-ink-900/80 transition-all cursor-pointer"
              onClick={() => {
                onSelectScenario(scenario);
                onClose();
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 font-semibold text-[13.5px] text-white group-hover:text-brand-300 transition-colors">
                  {scenario.icon}
                  <span>{scenario.title}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scenario.badgeColor}`}>
                  {scenario.badge}
                </span>
              </div>

              <p className="text-[11.5px] text-slate-400 leading-relaxed mb-3">
                {scenario.description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[11px] text-slate-400">
                <span>Coordinates: {scenario.lat.toFixed(4)}, {scenario.lng.toFixed(4)}</span>
                <span className="flex items-center gap-1 font-semibold text-brand-400 group-hover:translate-x-0.5 transition-transform">
                  Load Scenario →
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-white/[0.06] text-center">
          <p className="text-[11px] text-slate-500">
            Presets automatically adjust rainfall sliders, zoom coordinates, and model inference layers.
          </p>
        </div>
      </div>
    </div>
  );
}

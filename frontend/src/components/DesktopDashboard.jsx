"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  MapPin,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Database,
  Droplets,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Sliders,
  RefreshCw,
} from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import { analyzeArea, fetchHealth, fetchFeatherlessHealth } from "../lib/api.js";

const QUICK_AREAS = [
  "Gachibowli, Hyderabad",
  "Begumpet, Hyderabad",
  "Musi River Basin, Hyderabad",
  "Madhapur, Hyderabad",
  "Ghatkesar, Hyderabad",
  "Secunderabad, Hyderabad",
];

const TIER_STYLES = {
  "Very High": {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-400",
    badge: "bg-red-500 text-white",
    bar: "bg-red-500",
  },
  "High": {
    bg: "bg-orange-500/15",
    border: "border-orange-500/40",
    text: "text-orange-400",
    badge: "bg-orange-500 text-white",
    bar: "bg-orange-500",
  },
  "Moderate": {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-400",
    badge: "bg-amber-500 text-slate-900",
    bar: "bg-amber-500",
  },
  "Low": {
    bg: "bg-sky-500/15",
    border: "border-sky-500/40",
    text: "text-sky-400",
    badge: "bg-sky-500 text-white",
    bar: "bg-sky-500",
  },
  "Very Low": {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    badge: "bg-emerald-500 text-white",
    bar: "bg-emerald-500",
  },
};

export default function DesktopDashboard() {
  const [searchInput, setSearchInput] = useState("");
  const [rainfall, setRainfall] = useState(65);
  const [selectedArea, setSelectedArea] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState(null);
  const [featherlessStatus, setFeatherlessStatus] = useState(null);
  const [showReferenceRaster, setShowReferenceRaster] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "features" | "tactics"

  const currentCoordsRef = useRef({ latitude: 17.4401, longitude: 78.3489, location_name: "Gachibowli, Hyderabad" });

  // Core Area Analysis Request
  const runAreaAnalysis = useCallback(async (params) => {
    setIsLoading(true);
    try {
      const payload = {
        rainfall_mm: params.rainfall_mm !== undefined ? params.rainfall_mm : rainfall,
        location_name: params.location_name,
        latitude: params.latitude,
        longitude: params.longitude,
      };

      const res = await analyzeArea(payload);
      if (res && res.status === "success") {
        setSelectedArea(res);
        currentCoordsRef.current = {
          latitude: res.coordinates.latitude,
          longitude: res.coordinates.longitude,
          location_name: res.area_name,
        };
      }
    } catch (err) {
      console.error("Area analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [rainfall]);

  // Initial Load: Check services & analyze default area (Gachibowli)
  useEffect(() => {
    fetchHealth().then((h) => setBackendHealth(h));
    fetchFeatherlessHealth().then((fh) => setFeatherlessStatus(fh));

    runAreaAnalysis({
      location_name: "Gachibowli, Hyderabad",
      rainfall_mm: 65,
    });
  }, []);

  // Handle Search Submission
  const handleSearch = (e) => {
    e?.preventDefault();
    if (!searchInput.trim()) return;
    runAreaAnalysis({
      location_name: searchInput.trim(),
      rainfall_mm: rainfall,
    });
  };

  // Handle Map Click
  const handleMapClick = ({ latitude, longitude }) => {
    runAreaAnalysis({
      latitude,
      longitude,
      rainfall_mm: rainfall,
    });
  };

  // Handle Rainfall Slider Change (re-run analysis for active area)
  const handleSliderChange = (newVal) => {
    setRainfall(newVal);
  };

  // Debounced slider re-evaluation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentCoordsRef.current) {
        runAreaAnalysis({
          ...currentCoordsRef.current,
          rainfall_mm: rainfall,
        });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [rainfall]);

  const riskTier = selectedArea?.risk_tier || "Moderate";
  const tierStyle = TIER_STYLES[riskTier] || TIER_STYLES["Moderate"];
  const scorePercent = selectedArea ? (selectedArea.susceptibility_score * 100).toFixed(1) : "0.0";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-200">
      {/* Top Navigation Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <Logo size={22} textClassName="text-[15px] font-bold tracking-tight text-white" />
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/10 text-[11px]">
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-medium text-cyan-300">
              <Sparkles size={11} className="text-cyan-400" />
              Featherless AI Orchestrator
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-300">
              <Activity size={11} className="text-emerald-400" />
              LightGBM (13 Features)
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex flex-1 max-w-md mx-4 items-center">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Hyderabad area (e.g. Gachibowli, Begumpet, Musi River)..."
              className="w-full rounded-lg border border-white/15 bg-slate-800/80 py-1.5 pl-8 pr-20 text-[12.5px] text-white placeholder-slate-400 shadow-inner focus:border-cyan-400 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-cyan-500/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50"
            >
              Analyze
            </button>
          </div>
        </form>

        {/* Action Controls & Health */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReferenceRaster(!showReferenceRaster)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
              showReferenceRaster
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10"
            }`}
            title="Toggle reference flood susceptibility raster overlay"
          >
            <Layers size={13} />
            <span>Ref Raster: {showReferenceRaster ? "ON" : "OFF"}</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                backendHealth?.status === "ok" ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            <span>API Online</span>
          </div>
        </div>
      </header>

      {/* Quick Select Locality Pill Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] bg-slate-900/60 px-4 py-1.5 text-[11.5px] thin-scroll z-10">
        <span className="text-slate-400 flex items-center gap-1 pr-1 font-medium">
          <MapPin size={12} className="text-cyan-400" />
          Quick Localities:
        </span>
        {QUICK_AREAS.map((loc) => {
          const isSelected = selectedArea?.area_name?.includes(loc.split(",")[0]);
          return (
            <button
              key={loc}
              onClick={() => runAreaAnalysis({ location_name: loc, rainfall_mm: rainfall })}
              disabled={isLoading}
              className={`rounded-full px-2.5 py-0.5 whitespace-nowrap transition ${
                isSelected
                  ? "bg-cyan-500 text-slate-950 font-semibold shadow-sm"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/[0.08]"
              }`}
            >
              {loc.split(",")[0]}
            </button>
          );
        })}
      </div>

      {/* Main Content: Left Analytics Sidebar + Right Interactive Map */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Area Prediction & AI Strategy Card */}
        <aside className="thin-scroll w-96 shrink-0 overflow-y-auto border-r border-white/10 bg-slate-900/95 p-4 space-y-4 z-10 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Area Header Card */}
            <div className={`rounded-xl border ${tierStyle.border} ${tierStyle.bg} p-3.5 space-y-2`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-bold tracking-wider text-slate-400">
                    <MapPin size={12} className={tierStyle.text} />
                    <span>Selected Target Sector</span>
                  </div>
                  <h2 className="text-[17px] font-bold text-white tracking-tight">
                    {selectedArea?.area_name || "Gachibowli, Hyderabad"}
                  </h2>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${tierStyle.badge}`}>
                  {riskTier.toUpperCase()} RISK
                </span>
              </div>

              {/* Coordinates & Scenario Meta */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-2 font-mono">
                <span>
                  {selectedArea?.coordinates?.latitude?.toFixed(4)}°N, {selectedArea?.coordinates?.longitude?.toFixed(4)}°E
                </span>
                <span>{rainfall} mm Scenario</span>
              </div>
            </div>

            {/* Authoritative LightGBM Numerical Prediction Gauge */}
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-medium text-slate-300">
                  LightGBM Susceptibility Score
                </span>
                <span className="font-mono text-2xl font-black text-white">
                  {scorePercent}%
                </span>
              </div>

              {/* Segmented Risk Bar */}
              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-slate-700/80 overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-500 ${tierStyle.bar}`}
                    style={{ width: `${Math.max(3, Math.min(100, Number(scorePercent)))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0% (Low)</span>
                  <span>50% (Moderate)</span>
                  <span>100% (Critical)</span>
                </div>
              </div>

              {/* Persistence Status */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-white/10">
                <span className="flex items-center gap-1.5">
                  <Database size={12} className="text-cyan-400" />
                  <span>Storage:</span>
                </span>
                <span className="font-mono text-emerald-400 text-[10.5px]">
                  {selectedArea?.storage_status === "stored_in_supabase" ? "Supabase Live" : "Resilient Store (ID: " + (selectedArea?.supabase_record_id?.slice(0, 8) || "local") + ")"}
                </span>
              </div>
            </div>

            {/* Tabs for Intelligence Views */}
            <div className="flex rounded-lg bg-slate-800/80 p-0.5 border border-white/10 text-[11.5px]">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex-1 rounded-md py-1 font-medium transition ${
                  activeTab === "overview" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                AI Summary
              </button>
              <button
                onClick={() => setActiveTab("tactics")}
                className={`flex-1 rounded-md py-1 font-medium transition ${
                  activeTab === "tactics" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Directives ({selectedArea?.recommendations?.length || 3})
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`flex-1 rounded-md py-1 font-medium transition ${
                  activeTab === "features" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                13 Features
              </button>
            </div>

            {/* Tab 1: Featherless AI Executive Situation Analysis */}
            {activeTab === "overview" && (
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
                  <Sparkles size={13} className="text-cyan-400" />
                  <span>Featherless AI Situation Assessment</span>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-300">
                  {selectedArea?.ai_summary || "Analyzing spatial and hydrological features..."}
                </p>

                {/* Key Driver Highlights */}
                {selectedArea?.drivers && selectedArea.drivers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-cyan-500/20">
                    <span className="text-[10.5px] uppercase font-bold text-slate-400">
                      Primary Risk Drivers:
                    </span>
                    {selectedArea.drivers.map((drv, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${drv.impact === "High" ? "bg-red-400" : "bg-amber-400"}`} />
                        <span className="text-slate-300">
                          <strong className="text-white">{drv.factor}:</strong> {drv.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-cyan-400/80 font-mono pt-1">
                  Source: {selectedArea?.ai_source || "Featherless Orchestrator"}
                </div>
              </div>
            )}

            {/* Tab 2: Tactical Directives */}
            {activeTab === "tactics" && (
              <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                  <ShieldAlert size={13} />
                  <span>Tactical Emergency Directives</span>
                </div>
                <div className="space-y-2">
                  {selectedArea?.recommendations?.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11.5px] text-slate-300">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-amber-500/20 text-[10px] font-bold text-amber-300">
                        {i + 1}
                      </span>
                      <p className="leading-snug">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Exact 13 Features Breakdown */}
            {activeTab === "features" && (
              <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3 space-y-2 text-[11px]">
                <span className="font-semibold text-white">13 Model Input Parameters</span>
                <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono pt-1">
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Elevation (DEM)</div>
                    <div className="font-bold text-white">{selectedArea?.features_13?.elevation} m</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Slope</div>
                    <div className="font-bold text-white">{selectedArea?.features_13?.slope}°</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Wetness (TWI)</div>
                    <div className="font-bold text-white">{selectedArea?.features_13?.twi}</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Dist to Stream</div>
                    <div className="font-bold text-white">{selectedArea?.features_13?.dist_to_stream} m</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Total Rainfall</div>
                    <div className="font-bold text-cyan-300">{selectedArea?.features_13?.total_rainfall_mm} mm</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Max Hourly</div>
                    <div className="font-bold text-cyan-300">{selectedArea?.features_13?.max_hourly_mm} mm/h</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Antecedent Index (API)</div>
                    <div className="font-bold text-white">{selectedArea?.features_13?.max_api}</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-[10px] text-slate-400">Flow Acc (log)</div>
                    <div className="font-bold text-white">{selectedArea?.features_13?.flow_acc_log}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Model Specification Card Footer */}
          <div className="rounded-xl border border-white/[0.08] bg-slate-950/60 p-2.5 text-[10.5px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1 font-medium text-slate-300">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>Artifact: lgb_flood_model.txt</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Zero faking policy: True 13-feature LightGBM inference + real DEM + Featherless AI synthesis.
            </p>
          </div>
        </aside>

        {/* Right Map Canvas & Slider Overlay */}
        <div className="relative flex-1">
          <MapCanvas
            variant="dark"
            selectedArea={selectedArea}
            onMapClick={handleMapClick}
            showReferenceRaster={showReferenceRaster}
            rainfall={rainfall}
            isLoading={isLoading}
          />

          {/* Rainfall Scenario Slider (Floating at Bottom Center) */}
          <div className="absolute inset-x-0 bottom-4 z-[400] flex justify-center px-4 pointer-events-auto">
            <div className="rounded-2xl border border-white/15 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-md w-full max-w-lg">
              <RainfallSlider
                value={rainfall}
                onChange={handleSliderChange}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

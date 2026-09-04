"use client";

import { useState } from "react";
import { Smartphone, MonitorSmartphone } from "lucide-react";
import MobileResidentView from "../components/MobileResidentView.jsx";
import DesktopDashboard from "../components/DesktopDashboard.jsx";
import { analyzeArea } from "../lib/api.js";

export default function HomePage() {
  const [view, setView] = useState("desktop");

  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [horizon, setHorizon] = useState(62);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!searchQuery.trim()) return;
    
    setIsAnalyzing(true);
    setErrorMsg("");
    try {
      const res = await analyzeArea(searchQuery);
      if (res && res.location) {
        setAnalysisResult(res);
      } else {
        setErrorMsg("Analysis failed. Please check the backend or your query.");
      }
    } catch (err) {
      setErrorMsg(err.message || "An error occurred during analysis.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  let effectiveScore = 0;
  let effectiveTier = "LOW";

  if (analysisResult) {
    const baseScore = analysisResult.susceptibility_score;
    // Scale base score dynamically by rainfall (horizon). Even high-risk terrain needs rain to flood.
    // 0mm rain reduces the score massively, 100mm rain bumps it heavily.
    const scaledScore = baseScore * Math.max(0.05, horizon / 100) + (horizon / 100) * 0.25;
    effectiveScore = Math.min(100, scaledScore * 100).toFixed(1);

    const numericScore = parseFloat(effectiveScore);
    if (numericScore > 80) effectiveTier = "CRITICAL";
    else if (numericScore > 60) effectiveTier = "HIGH";
    else if (numericScore > 35) effectiveTier = "MODERATE";
    else effectiveTier = "LOW";
  }

  const sharedProps = {
    searchQuery, setSearchQuery,
    isAnalyzing,
    analysisResult,
    horizon, setHorizon,
    errorMsg,
    handleSearch,
    effectiveScore,
    effectiveTier
  };

  return (
    <div className="h-screen w-screen bg-[#e7edf3]">
      <ViewToggle view={view} setView={setView} />

      {view === "mobile" && (
        <div className="h-full w-full">
          <PhoneFrame>
            <MobileResidentView {...sharedProps} />
          </PhoneFrame>
        </div>
      )}

      {view === "desktop" && (
        <div className="h-full w-full">
          <DesktopDashboard {...sharedProps} />
        </div>
      )}
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-[#e7edf3] p-6">
      <div className="h-[780px] max-h-full w-[390px] max-w-full overflow-hidden rounded-[2.25rem] border-[8px] border-ink-900 bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function ViewToggle({ view, setView }) {
  const options = [
    { id: "mobile", label: "Resident app", icon: Smartphone },
    { id: "desktop", label: "Ops dashboard", icon: MonitorSmartphone },
  ];
  return (
    <div className="fixed left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-black/10 bg-white/90 p-1 text-[12.5px] shadow-card backdrop-blur">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setView(opt.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${
            view === opt.id
              ? "bg-ink-900 text-white"
              : "text-ink-700 hover:bg-ink-900/5"
          }`}
        >
          {opt.icon && <opt.icon size={13} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

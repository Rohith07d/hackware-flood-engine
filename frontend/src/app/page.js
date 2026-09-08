"use client";

import { useState } from "react";
import DesktopDashboard from "../components/DesktopDashboard.jsx";
import { analyzeArea } from "../lib/api.js";

export default function HomePage() {
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
    isAnalyzing, setIsAnalyzing,
    analysisResult, setAnalysisResult,
    horizon, setHorizon,
    errorMsg, setErrorMsg,
    handleSearch,
    effectiveScore,
    effectiveTier
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-ink-900">
      <DesktopDashboard {...sharedProps} />
    </main>
  );
}

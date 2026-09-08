"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MapPin,
  FileText,
  CheckCircle2,
  Navigation,
  CloudRain,
  Droplets,
  History,
  User,
  AlertTriangle,
  Globe,
  RefreshCw,
  Compass,
} from "lucide-react";
import Logo from "./Logo.jsx";
import MapCanvas from "./MapCanvas.jsx";
import RainfallSlider from "./RainfallSlider.jsx";
import Toast from "./Toast.jsx";
import ForecastTrendCard from "./ForecastTrendCard.jsx";
import CrowdReportModal from "./CrowdReportModal.jsx";
import AuthModal from "./AuthModal.jsx";
import GuidedDemoModal from "./GuidedDemoModal.jsx";
import {
  analyzeArea,
  fetchHealth,
  fetchModelStatus,
  fetchLiveWeather,
  reverseGeocode,
  fetchCrowdReports,
  fetchEvacuationRoute,
} from "../lib/api.js";
import {
  isLocationInCoverage,
  DEMO_LOCATIONS,
  SUPPORTED_LANGUAGES,
} from "../lib/constants.js";

export default function DesktopDashboard({
  searchQuery,
  setSearchQuery,
  isAnalyzing,
  analysisResult,
  horizon,
  setHorizon,
  errorMsg,
  handleSearch,
  effectiveScore,
  effectiveTier,
  setAnalysisResult,
  setIsAnalyzing,
  setErrorMsg,
}) {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [modelInfo, setModelInfo] = useState(null);
  const [isCachedData, setIsCachedData] = useState(false);

  // Multilingual state
  const [language, setLanguage] = useState("en");

  // Geolocation & User Pin
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [outsideCoverageWarning, setOutsideCoverageWarning] = useState(null);

  // Weather & Multi-day forecast
  const [weatherData, setWeatherData] = useState(null);
  const [showForecastCard, setShowForecastCard] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Crowd waterlogging pins
  const [crowdReports, setCrowdReports] = useState([]);
  const [showCrowdModal, setShowCrowdModal] = useState(false);

  // Evacuation route
  const [showEvacuation, setShowEvacuation] = useState(false);
  const [evacuationData, setEvacuationData] = useState(null);
  const [loadingEvacuation, setLoadingEvacuation] = useState(false);

  // Historical flood footprint (October 2020)
  const [showHistorical, setShowHistorical] = useState(false);

  // Auth & Profile
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Guided demo tour
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Feedback Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // 1. Health check & periodic polling (every 25s)
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetchHealth();
      if (res && res.status === "ok") {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkHealth();
    fetchModelStatus().then((info) => {
      if (info) setModelInfo(info);
    });

    fetchCrowdReports().then((reports) => {
      if (Array.isArray(reports)) setCrowdReports(reports);
    });

    const timer = setInterval(checkHealth, 25000);
    return () => clearInterval(timer);
  }, [checkHealth]);

  // 2. Client-side caching of last analysis in localStorage
  useEffect(() => {
    if (analysisResult) {
      try {
        localStorage.setItem("floodcast_last_analysis", JSON.stringify(analysisResult));
        setIsCachedData(false);
      } catch (err) {
        console.warn("Could not cache analysis to localStorage", err);
      }
    } else {
      try {
        const cached = localStorage.getItem("floodcast_last_analysis");
        if (cached && setAnalysisResult) {
          const parsed = JSON.parse(cached);
          setAnalysisResult(parsed);
          setIsCachedData(true);
        }
      } catch (err) {
        console.warn("Could not retrieve cached analysis", err);
      }
    }
  }, [analysisResult, setAnalysisResult]);

  // 3. Load live weather when analysis location changes
  useEffect(() => {
    if (analysisResult?.latitude && analysisResult?.longitude) {
      setLoadingWeather(true);
      fetchLiveWeather(analysisResult.latitude, analysisResult.longitude)
        .then((w) => {
          if (w) setWeatherData(w);
        })
        .finally(() => setLoadingWeather(false));
    }
  }, [analysisResult?.latitude, analysisResult?.longitude]);

  // 4. "Use My Location" GPS handler
  const handleUseMyLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.", "warning");
      return;
    }

    setIsLocating(true);
    setOutsideCoverageWarning(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const inBounds = isLocationInCoverage(lat, lon);

        if (!inBounds) {
          setOutsideCoverageWarning({
            userLat: lat,
            userLon: lon,
            message: `Detected location (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E) is outside the trained Hyderabad model coverage area.`,
          });
          showToast("Location outside Hyderabad coverage basin.", "warning");
          return;
        }

        try {
          const geoRes = await reverseGeocode(lat, lon);
          const locationName = geoRes?.address || `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

          setUserLocation({
            lat,
            lng: lon,
            address: locationName,
            risk_tier: effectiveTier,
            risk_score: effectiveScore,
          });

          if (setSearchQuery) setSearchQuery(locationName);
          showToast(`Pinpointed: ${locationName}`, "success");

          if (setIsAnalyzing && setAnalysisResult) {
            setIsAnalyzing(true);
            const res = await analyzeArea(locationName, language);
            if (res && res.location) {
              setAnalysisResult(res);
            }
            setIsAnalyzing(false);
          }
        } catch (err) {
          console.error(err);
          showToast("Error resolving your location address.", "error");
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation error:", err);
        let msg = "Could not detect location. You can search any Hyderabad zone manually.";
        if (err.code === 1) {
          msg = "Location permission was denied. Type an area name to analyze.";
        } else if (err.code === 2) {
          msg = "Location unavailable. Please check your device GPS.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please try searching manually.";
        }
        showToast(msg, "warning");
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  };

  const handleJumpToCoverageZone = async (demoLoc = DEMO_LOCATIONS[0]) => {
    setOutsideCoverageWarning(null);
    if (setSearchQuery) setSearchQuery(demoLoc.name);
    showToast(`Switched to active zone: ${demoLoc.name}`, "info");

    if (setIsAnalyzing && setAnalysisResult) {
      setIsAnalyzing(true);
      try {
        const res = await analyzeArea(demoLoc.name, language);
        if (res && res.location) {
          setAnalysisResult(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  // 5. Language switcher
  const handleLanguageChange = async (newLang) => {
    setLanguage(newLang);
    if (analysisResult && setIsAnalyzing && setAnalysisResult) {
      setIsAnalyzing(true);
      showToast(`Translating AI advisory to ${newLang === "hi" ? "हिन्दी" : newLang === "te" ? "తెలుగు" : "English"}...`, "info");
      try {
        const res = await analyzeArea(analysisResult.location, newLang);
        if (res) setAnalysisResult(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  // 6. Safe Evacuation Route handler
  const handleToggleEvacuation = async () => {
    if (showEvacuation) {
      setShowEvacuation(false);
      setEvacuationData(null);
      return;
    }

    const lat = analysisResult?.latitude || 17.4065;
    const lon = analysisResult?.longitude || 78.4772;

    setLoadingEvacuation(true);
    showToast("Computing flood-safe evacuation corridor...", "info");
    try {
      const res = await fetchEvacuationRoute(lat, lon);
      if (res && res.shelter_name) {
        setEvacuationData(res);
        setShowEvacuation(true);
        showToast(`Route plotted to ${res.shelter_name} (${res.distance_km} km)`, "success");
      } else {
        showToast("Could not calculate evacuation corridor.", "warning");
      }
    } catch (err) {
      console.error(err);
      showToast("Evacuation service currently offline.", "error");
    } finally {
      setLoadingEvacuation(false);
    }
  };

  // 7. Apply demo scenario from GuidedDemoModal
  const handleApplyScenario = async (scenario) => {
    if (setSearchQuery) setSearchQuery(scenario.query);
    if (setHorizon) setHorizon(scenario.rainfall);
    setShowHistorical(Boolean(scenario.showHistorical));

    if (scenario.showEvacuation) {
      setShowEvacuation(true);
      handleToggleEvacuation();
    } else {
      setShowEvacuation(false);
    }

    if (setIsAnalyzing && setAnalysisResult) {
      setIsAnalyzing(true);
      showToast(`Loading demo: ${scenario.title}`, "info");
      try {
        const res = await analyzeArea(scenario.query, language);
        if (res && res.location) {
          setAnalysisResult(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-900 text-slate-200">
      {/* Toast notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="flex flex-col sm:flex-row shrink-0 items-stretch sm:items-center justify-between border-b border-white/[0.06] bg-ink-900 px-3 sm:px-5 py-2.5 sm:py-0 sm:h-14 gap-2.5 sm:gap-4 z-20">
        {/* Left: Logo & 3-State Backend Health Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
          <Logo size={22} textClassName="text-[14px] sm:text-[15px] font-bold text-white tracking-tight" />

          {/* 3-State Health Indicator */}
          {backendStatus === "online" ? (
            <span
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10.5px] sm:text-[11px] font-medium text-emerald-400 cursor-pointer"
              title="FastAPI Backend & Featherless AI link operational"
              onClick={checkHealth}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">AI Online / Featherless Linked</span>
              <span className="sm:hidden">Online</span>
            </span>
          ) : backendStatus === "checking" ? (
            <span
              className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10.5px] sm:text-[11px] font-medium text-amber-400"
              title="Polling backend health..."
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Connecting...</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10.5px] sm:text-[11px] text-rose-400 cursor-pointer"
              title="Backend unreachable. Click to retry."
              onClick={checkHealth}
            >
              <RefreshCw size={11} className="animate-spin" />
              <span className="hidden sm:inline">Offline (Cached Mode)</span>
              <span className="sm:hidden">Offline</span>
            </span>
          )}
        </div>

        {/* Center: Search & Location Pinpoint */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="e.g. Gachibowli, Musi River, Charminar"
                className="w-full rounded-full border border-white/[0.1] bg-ink-800 py-1.5 pl-9 pr-8 text-[12.5px] sm:text-[13px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery?.(e.target.value)}
                disabled={isAnalyzing}
              />
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={isLocating}
                title="Detect & analyze my location"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-brand-400 transition-colors disabled:opacity-50"
              >
                {isLocating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                ) : (
                  <Navigation size={14} />
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={isAnalyzing || !searchQuery?.trim()}
              className="shrink-0 rounded-full bg-brand-600 px-3.5 sm:px-4 py-1.5 text-[12px] sm:text-[13px] font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze"}
            </button>
          </form>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto overflow-x-auto">
          {/* Multilingual Selector */}
          <div className="relative flex items-center rounded-lg border border-white/[0.08] bg-ink-800 px-2 py-1 text-[11px]">
            <Globe size={13} className="text-slate-400 mr-1.5 shrink-0" />
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer pr-1"
              aria-label="Language selector"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-ink-800 text-white">
                  {l.native}
                </option>
              ))}
            </select>
          </div>

          {/* 72h Forecast Button */}
          <button
            onClick={() => setShowForecastCard((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
              showForecastCard
                ? "border-brand-500 bg-brand-500/20 text-brand-300"
                : "border-white/[0.08] bg-ink-800 text-slate-300 hover:text-white hover:border-white/[0.15]"
            }`}
            title="View 72-hour precipitation forecast from Open-Meteo"
          >
            <CloudRain size={13} className="text-brand-400" />
            <span className="hidden sm:inline">72h Forecast</span>
          </button>

          {/* Waterlogging Crowd Report Button */}
          <button
            onClick={() => setShowCrowdModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-ink-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:border-white/[0.15] transition-all"
            title="Report localized street water depth"
          >
            <Droplets size={13} className="text-cyan-400" />
            <span className="hidden sm:inline">Report Flood</span>
          </button>

          {/* Guided Demo Button */}
          <button
            onClick={() => setShowDemoModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-300 hover:bg-brand-500/20 transition-all"
            title="Interactive judge scenarios & guided demonstrations"
          >
            <Compass size={13} className="text-brand-400" />
            <span>Demo Modes</span>
          </button>

          {/* Auth & Profile Modal Trigger */}
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-ink-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:border-white/[0.15] transition-all"
            title="Resident profile, saved zones & SMS alerts"
          >
            <User size={13} className="text-slate-400" />
            <span className="hidden sm:inline">{currentUser ? currentUser.email.split("@")[0] : "Account"}</span>
          </button>
        </div>
      </header>

      {/* Outside Coverage Warning Banner */}
      {outsideCoverageWarning && (
        <div className="z-20 flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-300 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            <span>{outsideCoverageWarning.message}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleJumpToCoverageZone(DEMO_LOCATIONS[0])}
              className="rounded-lg bg-amber-500/20 px-2.5 py-0.5 font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
            >
              Jump to Musi Basin Demo →
            </button>
            <button
              onClick={() => setOutsideCoverageWarning(null)}
              className="text-amber-400 hover:text-amber-200 text-base leading-none px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Offline Caching Warning Banner */}
      {isCachedData && backendStatus === "offline" && (
        <div className="z-10 flex items-center justify-between border-b border-rose-500/20 bg-rose-500/10 px-4 py-1.5 text-[11.5px] text-rose-300">
          <div className="flex items-center gap-1.5">
            <RefreshCw size={13} className="animate-spin text-rose-400" />
            <span>Backend is offline. Displaying cached analysis results from your previous session.</span>
          </div>
          <button
            onClick={checkHealth}
            className="underline hover:text-white font-medium"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="relative flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Map Container */}
        <div className="relative order-1 lg:order-2 h-[55vh] sm:h-[60vh] lg:h-full w-full lg:w-auto lg:flex-1 shrink-0 lg:shrink">
          <MapCanvas
            variant="dark"
            showMarkers={true}
            zoom={analysisResult ? 14.5 : 12}
            showOverlay={false}
            showEvacuation={showEvacuation}
            showHistorical={showHistorical}
            horizon={horizon}
            center={analysisResult ? [analysisResult.latitude, analysisResult.longitude] : undefined}
            marker={
              analysisResult
                ? {
                    lat: analysisResult.latitude,
                    lng: analysisResult.longitude,
                    label: analysisResult.location,
                  }
                : null
            }
            userLocation={userLocation}
            crowdReports={crowdReports}
            customEvacuationRoute={evacuationData}
          />

          {/* Map Overlay Action Badges */}
          <div className="absolute left-3 top-3 z-[300] flex flex-wrap gap-2">
            <button
              onClick={() => setShowHistorical((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md transition-all shadow-lg ${
                showHistorical
                  ? "border-purple-500 bg-purple-500/30 text-purple-200 ring-2 ring-purple-500/20"
                  : "border-white/10 bg-ink-900/80 text-slate-300 hover:bg-ink-800 hover:text-white"
              }`}
            >
              <History size={13} className={showHistorical ? "text-purple-300" : "text-slate-400"} />
              <span>Oct 2020 Super-Storm Footprint</span>
              {showHistorical && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />}
            </button>

            <button
              onClick={handleToggleEvacuation}
              disabled={loadingEvacuation}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md transition-all shadow-lg ${
                showEvacuation
                  ? "border-emerald-500 bg-emerald-500/30 text-emerald-200 ring-2 ring-emerald-500/20"
                  : "border-white/10 bg-ink-900/80 text-slate-300 hover:bg-ink-800 hover:text-white"
              }`}
            >
              {loadingEvacuation ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              ) : (
                <Navigation size={13} className={showEvacuation ? "text-emerald-300" : "text-slate-400"} />
              )}
              <span>{showEvacuation ? "Hide Safe Evacuation Route" : "Show Safe Evacuation Route"}</span>
            </button>
          </div>

          {/* Floating Live Forecast Card */}
          {showForecastCard && weatherData && (
            <div className="absolute right-3 top-3 z-[400] w-full max-w-sm sm:max-w-md">
              <ForecastTrendCard
                weatherData={weatherData}
                currentRainfall={horizon}
                onClose={() => setShowForecastCard(false)}
              />
            </div>
          )}

          {/* Rainfall Slider */}
          {analysisResult && (
            <div className="absolute inset-x-0 bottom-3 sm:bottom-4 z-[400] flex justify-center px-3 sm:px-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-[440px]">
                <RainfallSlider
                  value={horizon}
                  onChange={setHorizon}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Data Panel */}
        <aside className="thin-scroll order-2 lg:order-1 flex-1 min-h-0 w-full lg:w-[430px] lg:h-full lg:flex-none shrink-0 lg:shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-r border-white/[0.06] bg-ink-800 px-3.5 sm:px-4 py-3.5 sm:py-4 space-y-3.5 sm:space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 sm:p-4 text-[12.5px] sm:text-[13px] text-rose-400">
              {errorMsg}
            </div>
          )}

          {!analysisResult && !isAnalyzing && !errorMsg && (
            <div className="flex h-56 sm:h-72 flex-col items-center justify-center text-center text-slate-500 px-4">
              <MapPin size={34} className="mb-2.5 opacity-50 text-slate-400" />
              <p className="text-[13.5px] font-semibold text-slate-200">No Location Selected</p>
              <p className="mt-1 max-w-[280px] text-[11.5px] sm:text-[12px] text-slate-400 leading-relaxed">
                Click <span className="text-brand-400 font-medium">GPS locate</span> or search any Hyderabad zone to run LightGBM susceptibility modeling with Featherless AI advisories.
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {DEMO_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => handleJumpToCoverageZone(loc)}
                    className="rounded-lg border border-white/[0.08] bg-ink-700/50 px-2.5 py-1 text-[11px] text-slate-300 hover:border-brand-500/40 hover:text-white transition-all"
                  >
                    {loc.name.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-56 sm:h-72 flex-col items-center justify-center text-center text-brand-400 px-4">
              <div className="mb-3.5 h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              <p className="text-[13.5px] font-semibold text-white">Extracting Terrain & Rainfall...</p>
              <p className="mt-1 text-[11.5px] text-slate-400">
                Running LightGBM inference & Featherless Llama-3.1 multilingual advisory ({language.toUpperCase()})
              </p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-3.5 sm:space-y-4 animate-in fade-in">
              <div className="rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Location Profile
                  </p>
                  <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-400 border border-brand-500/20">
                    Hyderabad Basin
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {analysisResult.location}
                </h2>
                <div className="mt-2 flex gap-4 text-[11.5px] sm:text-[12px] text-slate-400">
                  <span>Lat: {analysisResult.latitude.toFixed(4)}°N</span>
                  <span>Lon: {analysisResult.longitude.toFixed(4)}°E</span>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="flex-1 rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                  <p className="mb-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Flood Susceptibility
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-white">
                      {effectiveScore}%
                    </span>
                    <span className="text-[11px] text-slate-400">at {horizon}mm</span>
                  </div>
                </div>

                <div className="flex-1 rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                  <p className="mb-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Risk Classification
                  </p>
                  <div
                    className={`text-lg sm:text-xl font-bold ${
                      effectiveTier === "CRITICAL"
                        ? "text-rose-400"
                        : effectiveTier === "HIGH"
                        ? "text-amber-400"
                        : effectiveTier === "MODERATE"
                        ? "text-yellow-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {effectiveTier}
                  </div>
                </div>
              </div>

              {evacuationData && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <Navigation size={13} className="text-emerald-400" /> Safe Evacuation Hub
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400">
                      {evacuationData.distance_km} km away
                    </span>
                  </div>
                  <div className="text-[13.5px] font-bold text-white">
                    {evacuationData.shelter_name}
                  </div>
                  <p className="text-[11.5px] text-slate-300 leading-relaxed">
                    {evacuationData.instructions || "Follow designated bypass arterial roads. Avoid low-lying drainage corridors and inundated underpasses."}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/60 p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <FileText size={13} className="text-brand-400" /> AI Advisory (Featherless Llama-3.1)
                  </p>
                  <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 border border-white/[0.08]">
                    {language === "hi" ? "हिन्दी" : language === "te" ? "తెలుగు" : "English"}
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-[12.5px] sm:text-[13px] leading-relaxed text-slate-300">
                  <p className="whitespace-pre-line">
                    {analysisResult.ai_explanation.replace(/[#*`]/g, "").slice(0, 320)}
                    {analysisResult.ai_explanation.length > 320 ? "..." : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/40 p-3.5 sm:p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Emergency Recommendations
                </p>
                <ul className="space-y-2 text-[12px] sm:text-[12.5px] text-slate-300">
                  {effectiveTier === "CRITICAL" && (
                    <>
                      <li className="flex gap-2">
                        <span className="text-rose-400 font-bold">•</span> Evacuate immediately if advised by local authorities or municipal flood wardens.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-rose-400 font-bold">•</span> Move essential supplies, power inverters, and emergency kits to the highest floor.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-rose-400 font-bold">•</span> Completely avoid driving through underpasses and submerged river causeways.
                      </li>
                    </>
                  )}
                  {effectiveTier === "HIGH" && (
                    <>
                      <li className="flex gap-2">
                        <span className="text-amber-400 font-bold">•</span> Assemble 48h emergency kit and verify evacuation routes to nearest relief camps.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-400 font-bold">•</span> Relocate electrical appliances, two-wheelers, and ground-floor valuables.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-amber-400 font-bold">•</span> Monitor local IMD & GHMC emergency broadcast advisories.
                      </li>
                    </>
                  )}
                  {effectiveTier === "MODERATE" && (
                    <>
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-bold">•</span> Keep drains, storm inlets, and perimeter drainage channels free of debris.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-bold">•</span> Avoid parking vehicles in basement garages or depression hollows.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-bold">•</span> Prepare basic emergency torches and backup battery packs.
                      </li>
                    </>
                  )}
                  {effectiveTier === "LOW" && (
                    <>
                      <li className="flex gap-2">
                        <span className="text-emerald-400 font-bold">•</span> Normal routine can proceed safely with standard monsoon awareness.
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-400 font-bold">•</span> Verify rooftop rainwater harvesting and downspout outflow clearance.
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-ink-700/40 p-3 text-[10.5px] sm:text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between font-medium text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>Engine: {analysisResult.model_version || "lgb_flood_model.txt@v1.2"}</span>
                  </div>
                  <span className="text-[10px] text-brand-400">Open-Meteo Synced</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  PostGIS Spatial Index & GHMC drainage topology active.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Modals */}
      <CrowdReportModal
        isOpen={showCrowdModal}
        onClose={() => setShowCrowdModal(false)}
        defaultCoords={
          analysisResult
            ? { lat: analysisResult.latitude, lng: analysisResult.longitude }
            : userLocation || { lat: 17.4065, lng: 78.4772 }
        }
        onReportSubmitted={(newReport) => {
          setCrowdReports((prev) => [newReport, ...prev]);
          showToast("Crowd waterlogging pin added to live map!", "success");
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentLocation={
          analysisResult
            ? {
                name: analysisResult.location,
                lat: analysisResult.latitude,
                lng: analysisResult.longitude,
              }
            : null
        }
        onSelectSavedLocation={(loc) => {
          if (setSearchQuery) setSearchQuery(loc.location_name);
          handleJumpToCoverageZone({ name: loc.location_name });
        }}
        onUserChange={(u) => setCurrentUser(u)}
      />

      <GuidedDemoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onSelectScenario={handleApplyScenario}
      />
    </div>
  );
}

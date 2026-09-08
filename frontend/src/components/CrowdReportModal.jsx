"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Droplets, MapPin, X, Send, CheckCircle2 } from "lucide-react";
import { submitCrowdReport } from "../lib/api.js";

const DEPTH_OPTIONS = [
  { id: "ankle", label: "Ankle Deep", height: "10-15 cm", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
  { id: "knee", label: "Knee Deep", height: "30-50 cm", color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { id: "waist", label: "Waist Deep", height: "80-100 cm", color: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  { id: "submerged", label: "Submerged", height: ">1.5 m", color: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
];

export default function CrowdReportModal({ isOpen, onClose, defaultCoords, onReportSubmitted }) {
  const [depth, setDepth] = useState("knee");
  const [lat, setLat] = useState(defaultCoords?.lat || 17.4065);
  const [lon, setLon] = useState(defaultCoords?.lng || defaultCoords?.lon || 78.4772);
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (defaultCoords) {
      if (defaultCoords.lat) setLat(defaultCoords.lat);
      if (defaultCoords.lng || defaultCoords.lon) setLon(defaultCoords.lng || defaultCoords.lon);
    }
  }, [defaultCoords]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const parsedLat = parseFloat(lat);
      const parsedLon = parseFloat(lon);

      if (isNaN(parsedLat) || isNaN(parsedLon)) {
        throw new Error("Please provide valid coordinates.");
      }

      const reportPayload = {
        latitude: parsedLat,
        longitude: parsedLon,
        depth_category: depth,
        description: description.trim() || `${depth.toUpperCase()} waterlogging reported at this location.`,
        reporter_name: reporterName.trim() || "Resident Reporter",
        location_name: locationName.trim() || undefined,
      };

      const result = await submitCrowdReport(reportPayload);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        onReportSubmitted?.(result);
        onClose();
      }, 1200);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit waterlogging report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-ink-800 p-5 shadow-2xl text-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-4 border-b border-white/[0.06] pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Droplets size={20} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">Report Waterlogging</h2>
            <p className="text-[11.5px] text-slate-400">Add verified crowd water depth to the live map</p>
          </div>
        </div>

        {submitSuccess ? (
          <div className="py-10 text-center space-y-2">
            <CheckCircle2 size={42} className="mx-auto text-emerald-400 animate-bounce" />
            <h3 className="text-base font-bold text-white">Report Published!</h3>
            <p className="text-[12px] text-slate-400">Your observation has been pinned on the community map.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {submitError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[12px] text-rose-300 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Depth Selection */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Observed Water Depth
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDepth(opt.id)}
                    className={`flex flex-col items-start rounded-xl border p-2.5 transition-all text-left ${
                      depth === opt.id
                        ? `${opt.color} ring-1 ring-white/20 shadow-md`
                        : "border-white/[0.06] bg-ink-900/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-[12px] font-bold">{opt.label}</span>
                    <span className="text-[10px] opacity-75">{opt.height}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-1.5 text-[12px] text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-1.5 text-[12px] text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Location Landmark */}
            <div>
              <label className="block text-[10.5px] text-slate-400 mb-1">Landmark / Street (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Tolichowki Main Road under flyover"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-1.5 text-[12px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10.5px] text-slate-400 mb-1">Notes / Street Conditions</label>
              <textarea
                rows={2}
                placeholder="e.g. Traffic halted, manhole overflowing, two-wheelers cannot pass."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-1.5 text-[12px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>

            {/* Reporter Name */}
            <div>
              <label className="block text-[10.5px] text-slate-400 mb-1">Your Name / Handle (Optional)</label>
              <input
                type="text"
                placeholder="Resident / Commuter"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-1.5 text-[12px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Submitting Pin...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Live Waterlogging Pin</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  User,
  LogIn,
  LogOut,
  X,
  Bookmark,
  BookmarkCheck,
  Bell,
  Trash2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  getCurrentUser,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  getUserSavedLocations,
  saveUserLocation,
  removeUserLocation,
} from "../lib/supabaseClient.js";
import { subscribeAlerts } from "../lib/api.js";

export default function AuthModal({
  isOpen,
  onClose,
  currentLocation,
  onSelectSavedLocation,
  onUserChange,
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });

  // Saved locations
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // SMS Alert Subscription
  const [phoneNumber, setPhoneNumber] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("HIGH");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribedMsg, setSubscribedMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      checkSession();
    }
  }, [isOpen]);

  const checkSession = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      onUserChange?.(user);
      if (user) {
        loadSavedLocations(user.id);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    }
  };

  const loadSavedLocations = async (userId) => {
    setLoadingLocations(true);
    try {
      const locs = await getUserSavedLocations(userId);
      setSavedLocations(locs || []);
    } catch (err) {
      console.error("Error loading saved locations:", err);
    } finally {
      setLoadingLocations(false);
    }
  };

  if (!isOpen) return null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ text: "", type: "" });

    try {
      if (isSignUp) {
        const res = await signUpWithEmail(email, password);
        if (res.user) {
          setStatusMsg({
            text: "Account created! Signed in successfully.",
            type: "success",
          });
          setCurrentUser(res.user);
          onUserChange?.(res.user);
          loadSavedLocations(res.user.id);
        }
      } else {
        const res = await signInWithEmail(email, password);
        if (res.user) {
          setStatusMsg({ text: "Signed in successfully!", type: "success" });
          setCurrentUser(res.user);
          onUserChange?.(res.user);
          loadSavedLocations(res.user.id);
        }
      }
    } catch (err) {
      setStatusMsg({ text: err.message || "Authentication failed.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    setSavedLocations([]);
    onUserChange?.(null);
    setStatusMsg({ text: "Signed out successfully.", type: "info" });
  };

  const handleSaveCurrentLocation = async () => {
    if (!currentUser) return;
    if (!currentLocation || !currentLocation.lat || !currentLocation.lng) {
      setStatusMsg({ text: "No active location to bookmark.", type: "error" });
      return;
    }

    try {
      await saveUserLocation(
        currentUser.id,
        currentLocation.name || "Custom Pinned Zone",
        currentLocation.lat,
        currentLocation.lng
      );
      setStatusMsg({ text: "Location bookmarked!", type: "success" });
      loadSavedLocations(currentUser.id);
    } catch (err) {
      setStatusMsg({ text: err.message || "Failed to bookmark location.", type: "error" });
    }
  };

  const handleDeleteSavedLocation = async (id) => {
    try {
      await removeUserLocation(id);
      setSavedLocations((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubscribeAlerts = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;
    setSubscribing(true);
    setSubscribedMsg("");

    try {
      const payload = {
        phone_number: phoneNumber.trim(),
        risk_threshold: alertThreshold,
        latitude: currentLocation?.lat || 17.4065,
        longitude: currentLocation?.lng || 78.4772,
        user_id: currentUser?.id,
      };
      const res = await subscribeAlerts(payload);
      setSubscribedMsg(res.message || "Subscribed to SMS flood warnings!");
    } catch (err) {
      setSubscribedMsg("Subscription error: " + (err.message || "Check backend."));
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in text-slate-200">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-ink-800 p-5 shadow-2xl">
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
            <User size={20} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-white">
              {currentUser ? "Resident Profile & Alerts" : "FloodCast Account"}
            </h2>
            <p className="text-[11.5px] text-slate-400">
              {currentUser
                ? "Manage saved zones & real-time SMS alert subscriptions"
                : "Sign in to save flood zones and subscribe to SMS alerts"}
            </p>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg.text && (
          <div
            className={`mb-3.5 rounded-xl border p-2.5 text-[12px] flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : statusMsg.type === "error"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-sky-500/30 bg-sky-500/10 text-sky-300"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle size={15} className="shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Signed-in View */}
        {currentUser ? (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto thin-scroll pr-1">
            {/* User Details */}
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-900/60 p-3">
              <div>
                <div className="text-[12.5px] font-semibold text-white">{currentUser.email}</div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={11} /> Supabase RLS Protected
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>

            {/* Saved Locations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Saved Monitoring Zones
                </span>
                {currentLocation && (
                  <button
                    onClick={handleSaveCurrentLocation}
                    className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300"
                  >
                    <Bookmark size={12} /> Save Current View
                  </button>
                )}
              </div>

              {loadingLocations ? (
                <div className="text-center text-[12px] text-slate-500 py-3">Loading saved zones...</div>
              ) : savedLocations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] p-3 text-center text-[11.5px] text-slate-500">
                  No saved flood zones yet. Search a location and bookmark it here!
                </div>
              ) : (
                <div className="space-y-1.5">
                  {savedLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-ink-900/40 px-3 py-2 text-[12px] hover:border-brand-500/30 transition-colors"
                    >
                      <button
                        onClick={() => {
                          onSelectSavedLocation?.(loc);
                          onClose();
                        }}
                        className="flex items-center gap-2 text-left text-slate-200 hover:text-brand-400 transition-colors"
                      >
                        <MapPin size={13} className="text-brand-400 shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">{loc.location_name}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSavedLocation(loc.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SMS Alerts Subscription Form */}
            <div className="rounded-xl border border-white/[0.06] bg-ink-900/50 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-brand-400" />
                <span className="text-[12px] font-semibold text-white">Emergency SMS Alerts</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Receive proactive flood warnings via Twilio when rainfall triggers risk.
              </p>

              <form onSubmit={handleSubscribeAlerts} className="space-y-2 pt-1">
                <div>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210 (E.164 format)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/[0.08] bg-ink-900 px-3 py-1.5 text-[12px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Trigger Alert At:</span>
                  <select
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    className="rounded bg-ink-900 border border-white/[0.08] px-2 py-1 text-white focus:outline-none"
                  >
                    <option value="CRITICAL">Critical Risk (&gt;80%)</option>
                    <option value="HIGH">High Risk (&gt;60%)</option>
                    <option value="MODERATE">Moderate Risk (&gt;35%)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={subscribing || !phoneNumber.trim()}
                  className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
                >
                  {subscribing ? "Subscribing..." : "Enable SMS Alerts"}
                </button>

                {subscribedMsg && (
                  <p className="text-[11px] text-emerald-300 mt-1">{subscribedMsg}</p>
                )}
              </form>
            </div>
          </div>
        ) : (
          /* Unauthenticated Auth Form */
          <div>
            <div className="flex border-b border-white/[0.06] mb-3.5">
              <button
                onClick={() => setIsSignUp(false)}
                className={`flex-1 pb-2 text-[12.5px] font-medium transition-colors border-b-2 ${
                  !isSignUp
                    ? "border-brand-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsSignUp(true)}
                className={`flex-1 pb-2 text-[12.5px] font-medium transition-colors border-b-2 ${
                  isSignUp
                    ? "border-brand-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="resident@hyderabad.gov"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-2 text-[12.5px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 py-2 text-[12.5px] text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand-600 py-2 text-[13px] font-medium text-white hover:bg-brand-500 transition-colors disabled:opacity-50"
              >
                {loading ? "Processing..." : isSignUp ? "Create Free Account" : "Sign In"}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-white/[0.06] text-center">
              <p className="text-[11px] text-slate-500 mb-2">
                FloodCast's interactive map and AI prediction engine are 100% public and free without logging in.
              </p>
              <button
                onClick={onClose}
                className="text-[12px] text-brand-400 hover:underline"
              >
                Continue as Guest Explorer →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

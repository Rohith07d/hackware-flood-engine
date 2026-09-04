"use client";

import { useState, useEffect } from "react";
import { Smartphone, MonitorSmartphone } from "lucide-react";
import MobileResidentView from "../components/MobileResidentView.jsx";
import DesktopDashboard from "../components/DesktopDashboard.jsx";

export default function HomePage() {
  const [view, setView] = useState("auto");
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const activeView = view === "auto" ? (isDesktop ? "desktop" : "mobile") : view;

  return (
    <div className="h-screen w-screen bg-[#e7edf3]">
      <ViewToggle view={view} setView={setView} />

      {activeView === "mobile" ? (
        <div className="h-full w-full">
          <PhoneFrame>
            <MobileResidentView />
          </PhoneFrame>
        </div>
      ) : (
        <div className="h-full w-full">
          <DesktopDashboard />
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
    { id: "auto", label: "Responsive" },
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

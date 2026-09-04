"use client";

import { useState } from "react";
import { Smartphone, MonitorSmartphone } from "lucide-react";
import MobileResidentView from "../components/MobileResidentView.jsx";
import DesktopDashboard from "../components/DesktopDashboard.jsx";

export default function HomePage() {
  // "auto" follows the viewport (resident app on small screens, ops
  // dashboard on large ones). Residents and control-room operators are
  // different audiences on different devices in real use — the toggle
  // below makes it easy to preview both from one browser window.
  const [view, setView] = useState("desktop");

  return (
    <div className="h-screen w-screen bg-[#e7edf3]">
      <ViewToggle view={view} setView={setView} />



      {view === "mobile" && (
        <div className="h-full w-full">
          <PhoneFrame>
            <MobileResidentView />
          </PhoneFrame>
        </div>
      )}

      {view === "desktop" && (
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

"use client";

import { useState, useEffect } from "react";
import MobileResidentView from "../components/MobileResidentView.jsx";
import DesktopDashboard from "../components/DesktopDashboard.jsx";

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      {isMobile ? <MobileResidentView /> : <DesktopDashboard />}
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

function MapSkeletonLoader({ step = "Connecting to spatial tile servers..." }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-ink-950 text-slate-300 select-none">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px]" />

      {/* Radar scan animation */}
      <div className="relative z-10 flex flex-col items-center gap-3.5 px-4 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-brand-500/20 animate-ping" style={{ animationDuration: "2.4s" }} />
          <div className="absolute inset-2 rounded-full border border-brand-500/40 animate-pulse" />
          <div className="absolute inset-5 rounded-full border border-brand-400/50" />
          <div className="h-3 w-3 rounded-full bg-brand-400 shadow-[0_0_12px_#38bdf8]" />
        </div>

        <div className="space-y-1">
          <span className="text-[13px] font-medium text-white tracking-tight">{step}</span>
          <p className="text-[11px] text-slate-400">Rendering Hyderabad DEM & Road Hydrography</p>
        </div>

        {/* Progress bar */}
        <div className="relative h-1 w-48 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full w-1/2 rounded-full bg-brand-500 animate-[moveShimmer_1.5s_infinite_linear]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes moveShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

// Next.js dynamic importer with SSR disabled to prevent Leaflet window reference errors
const MapCanvasInner = dynamic(
  () => import("./MapCanvasInner"),
  {
    ssr: false,
    loading: () => <MapSkeletonLoader step="Mounting map tiles..." />,
  }
);

export default function MapCanvas(props) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <MapSkeletonLoader step="Initializing map engine..." />;
  }

  return <MapCanvasInner {...props} />;
}

"use client";

import dynamic from "next/dynamic";

const MapCanvasInner = dynamic(() => import("./MapCanvasInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-400">
      <div className="flex items-center gap-2 text-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        <span>Loading map tiles...</span>
      </div>
    </div>
  ),
});

export default function MapCanvas(props) {
  return <MapCanvasInner {...props} />;
}

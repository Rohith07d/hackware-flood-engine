"use client";

export default function RainfallSlider({
  value = 62,
  onChange,
  min = 0,
  max = 100,
  className = "",
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg border border-white/[0.08] bg-ink-800/90 px-4 py-3 backdrop-blur-sm ${className}`}
    >
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
        Low risk
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-risk-low via-risk-moderate to-risk-high accent-white"
        aria-label="Rainfall and flood risk timeline slider"
      />
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
        Next 24 hours
      </span>
    </div>
  );
}

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
        0mm Rain
      </span>
      <div className="relative flex-1 w-full">
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-white px-2 py-1 text-[11px] font-extrabold text-ink-900 shadow-lg"
          style={{ left: `${(value / max) * 100}%` }}
        >
          {value}mm
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange && onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-risk-low via-risk-moderate to-risk-high accent-white outline-none"
          aria-label="Rainfall amount slider"
        />
      </div>
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
        100mm+ Rain
      </span>
    </div>
  );
}

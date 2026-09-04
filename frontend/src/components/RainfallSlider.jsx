"use client";

export default function RainfallSlider({
  value = 62,
  onChange,
  min = 0,
  max = 120,
  className = "",
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-white/[0.12] bg-ink-800/95 px-5 py-3 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Simulated Rain
        </span>
        <span className="whitespace-nowrap font-mono text-[13px] font-bold text-brand-400">
          {value} mm
        </span>
      </div>
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
        0 mm
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-risk-low via-risk-moderate to-risk-high accent-brand-400"
        aria-label="Rainfall simulation slider"
      />
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-400">
        {max} mm
      </span>
    </div>
  );
}

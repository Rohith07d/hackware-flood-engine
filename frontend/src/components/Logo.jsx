export default function Logo({ size = 28, textClassName = "" }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="floodcast-logo-grad" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#33b8cf" />
            <stop offset="100%" stopColor="#0c5c6d" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#floodcast-logo-grad)" />
        <path
          d="M17.5 6 9 18h6l-1.5 8L22 14h-6l1.5-8z"
          fill="white"
        />
      </svg>
      <span className={`font-semibold tracking-tight ${textClassName}`}>FloodCast</span>
    </div>
  );
}

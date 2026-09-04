export default function Logo({ size = 28, textClassName = "" }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#080c13" />
        <path d="M 4 10 Q 8 5 12 10 T 20 10 T 28 10" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3.5" fill="none" />
        <path d="M 4 18 Q 8 13 12 18 T 20 18 T 28 18" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <line x1="4" y1="26" x2="28" y2="26" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className={`font-semibold tracking-tight ${textClassName}`}>FloodCast</span>
    </div>
  );
}

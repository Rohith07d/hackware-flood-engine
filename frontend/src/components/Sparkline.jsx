export default function Sparkline({ bars, color = "#33b8cf" }) {
  const max = Math.max(...bars);
  return (
    <div className="flex h-6 items-end gap-[3px]">
      {bars.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${Math.max((v / max) * 100, 12)}%`,
            backgroundColor: color,
            opacity: 0.35 + (v / max) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

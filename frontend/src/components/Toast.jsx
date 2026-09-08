"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export default function Toast({ message, type = "info", onClose }) {
  if (!message) return null;

  const typeConfig = {
    success: {
      bg: "bg-emerald-950/90 border-emerald-500/30 text-emerald-300",
      icon: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
    },
    error: {
      bg: "bg-rose-950/90 border-rose-500/30 text-rose-300",
      icon: <XCircle size={16} className="text-rose-400 shrink-0" />,
    },
    warning: {
      bg: "bg-amber-950/90 border-amber-500/30 text-amber-300",
      icon: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
    },
    info: {
      bg: "bg-ink-800/95 border-white/10 text-slate-200",
      icon: <Info size={16} className="text-brand-400 shrink-0" />,
    },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div
      className={`fixed bottom-5 right-5 z-[9999] flex max-w-sm items-center gap-2.5 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md text-[12.5px] transition-all animate-in slide-in-from-bottom-3 ${config.bg}`}
      role="alert"
    >
      {config.icon}
      <span className="flex-1 leading-snug">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-1 rounded p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

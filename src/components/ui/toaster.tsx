"use client";

import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { useDemo, type Toast } from "@/store";

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useDemo((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.tone === "error" ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast.id, toast.tone, dismiss]);
  const Icon = toast.tone === "ok" ? CheckCircle : WarningCircle;
  return (
    <div className={cn("pointer-events-auto flex items-start gap-3 rounded-card border bg-canvas p-4 shadow-pop", toast.tone === "ok" ? "border-ok/30" : "border-bad/35")}>
      <Icon size={22} weight="fill" className={toast.tone === "ok" ? "text-ok" : "text-bad"} />
      <p className="flex-1 text-[13.5px] leading-snug text-ink">{toast.text}</p>
      <button type="button" onClick={() => dismiss(toast.id)} aria-label="Cerrar aviso" className="rounded-md p-0.5 text-muted hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}

/** Avisos de resultado de cada acción. Los errores explican qué regla de negocio se aplicó. */
export function Toaster() {
  const toasts = useDemo((s) => s.toasts);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

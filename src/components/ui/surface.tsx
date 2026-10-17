import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-canvas shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "brand" | "ok" | "warn" | "bad";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface text-ink-soft",
  brand: "bg-brand-100 text-brand-700",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
};

/** Etiqueta de estado. Siempre lleva texto: el color nunca es la única señal. */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn("num mt-1.5 text-[26px] leading-tight font-semibold tracking-tight", tone === "bad" ? "text-bad" : "text-ink")}>{value}</p>
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 h-12 w-12 rounded-2xl bg-brand-50 ring-8 ring-brand-50/50" aria-hidden />
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

/** Encabezado de página: descripción a la izquierda, acciones a la derecha. */
export function PageIntro({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl text-[14px] text-muted">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "brand", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    neutral: "border-line bg-surface text-ink-soft",
    brand: "border-brand-200 bg-brand-50 text-brand-900",
    ok: "border-ok/25 bg-ok-bg text-ok",
    warn: "border-warn/25 bg-warn-bg text-warn",
    bad: "border-bad/25 bg-bad-bg text-bad",
  };
  return (
    <div role="note" className={cn("rounded-control border px-4 py-3 text-[13.5px] leading-relaxed", styles[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

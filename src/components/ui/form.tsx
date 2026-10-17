"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "rounded-control border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-faint transition hover:border-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-surface disabled:text-muted";

/** Etiqueta arriba, ayuda opcional y error debajo. Nunca placeholder como etiqueta. */
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-[12.5px] text-bad">{error}</p> : hint ? <p className="text-[12.5px] text-muted">{hint}</p> : null}
    </div>
  );
}

/** Ancho completo por defecto; si quien llama define su propio ancho (w-40, w-64...), se respeta. */
const withWidth = (className?: string): string => (className && /(^|\s)w-/.test(className) ? className : cn("w-full", className));

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-10", withWidth(className))} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-20 w-full py-2", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "h-10 pr-8", withWidth(className))} {...rest}>
      {children}
    </select>
  );
}

const group = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** Campo de importes en pesos: muestra separadores de miles y entrega un entero. */
export function MoneyInput({ value, onChange, id, ...rest }: { value: number; onChange: (value: number) => void; id?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
      <input
        id={id}
        inputMode="numeric"
        className={cn(CONTROL, "num h-10 w-full pl-7")}
        value={value ? group.format(value) : ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        {...rest}
      />
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-line-strong accent-brand-500" />
      {children}
    </label>
  );
}

/** Selector segmentado: pocas opciones visibles a la vez, navegable con teclado. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition", value === o.value ? "bg-canvas text-ink shadow-card" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { Motorcycle, CarProfile } from "@phosphor-icons/react/dist/ssr";
import type { Unit } from "@/domain/types";
import { cn } from "@/lib/cn";

const SWATCH: Record<string, string> = {
  Blanco: "bg-white ring-line-strong",
  Gris: "bg-zinc-300 ring-zinc-300",
  Plata: "bg-zinc-200 ring-zinc-300",
  Negro: "bg-zinc-800 ring-zinc-800",
  Rojo: "bg-red-500 ring-red-500",
  Azul: "bg-blue-500 ring-blue-500",
  Naranja: "bg-orange-400 ring-orange-400",
  Amarillo: "bg-yellow-400 ring-yellow-400",
};

/** Identificador visual de una unidad: ícono por tipo y punto del color real. Sin fotos de terceros. */
export function UnitMark({ unit, size = "md" }: { unit: Pick<Unit, "kind" | "color">; size?: "md" | "lg" }) {
  const Icon = unit.kind === "car" ? CarProfile : Motorcycle;
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500", size === "md" ? "h-10 w-10" : "h-16 w-16 rounded-2xl")}>
      <Icon size={size === "md" ? 22 : 34} weight="duotone" />
      <span className={cn("absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-canvas", SWATCH[unit.color] ?? "bg-zinc-300 ring-zinc-300")} title={unit.color} />
    </span>
  );
}

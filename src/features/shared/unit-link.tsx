import Link from "next/link";
import type { Unit } from "@/domain/types";
import { UnitMark } from "./unit-chip";

/** Celda de tabla con la unidad: marca, nombre, placa y año. Enlaza al expediente. */
export function UnitCell({ unit, subtitle }: { unit: Unit | undefined; subtitle?: string }) {
  if (!unit) return <span className="text-muted">Unidad no encontrada</span>;
  return (
    <div className="flex items-center gap-3">
      <UnitMark unit={unit} />
      <div className="min-w-0">
        <Link href={`/inventario/${unit.id}`} className="block truncate font-medium text-ink hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
          {unit.make} {unit.model} {unit.trim}
        </Link>
        <p className="num truncate text-[13px] text-muted">{subtitle ?? `${unit.plate}, ${unit.year}`}</p>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import type { Unit } from "@/domain/types";
import { useDemo } from "@/store";

export function UnitHistory({ unit }: { unit: Unit }) {
  const audit = useDemo((s) => s.data.audit);
  const sales = useDemo((s) => s.data.sales);
  const orders = useDemo((s) => s.data.workOrders);

  const events = useMemo(() => {
    const related = new Set<string>([`unidad ${unit.id}`]);
    sales.filter((s) => s.unitId === unit.id).forEach((s) => related.add(`venta ${s.id}`));
    orders.filter((o) => o.unitId === unit.id).forEach((o) => related.add(`orden ${o.id}`));
    return audit.filter((e) => related.has(e.resource) || e.action.toLowerCase().includes(unit.model.toLowerCase())).slice().reverse();
  }, [audit, sales, orders, unit.id, unit.model]);

  return (
    <Card>
      <CardHeader title="Historial de la unidad" description="Cada cambio queda con quién, cuándo y qué. La bitácora está encadenada con SHA-256." />
      {events.length === 0 ? (
        <EmptyState title="Aún no hay movimientos" description="Cuando alguien cambie la unidad, aparecerá aquí." />
      ) : (
        <ol className="divide-y divide-line">
          {events.map((e) => (
            <li key={e.seq} className="flex gap-4 px-5 py-3 text-sm">
              <span className="num w-28 shrink-0 text-[13px] text-muted">{e.at.slice(5, 16).replace("T", " ")}</span>
              <span className="text-ink-soft">
                <strong className="font-medium text-ink">{e.actor}</strong> {e.action.charAt(0).toLowerCase() + e.action.slice(1)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

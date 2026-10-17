"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/form";
import { Badge, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import type { MovementType, StockMovement } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";

const TYPE: Record<MovementType, { label: string; tone: Tone }> = {
  purchase_in: { label: "Compra", tone: "ok" },
  work_order_out: { label: "Consumo en taller", tone: "brand" },
  counter_sale_out: { label: "Venta de mostrador", tone: "neutral" },
  adjustment: { label: "Ajuste", tone: "warn" },
  loss: { label: "Merma", tone: "bad" },
  reversal: { label: "Reverso", tone: "warn" },
};

export function KardexTab() {
  const movements = useDemo((s) => s.data.movements);
  const parts = useDemo((s) => s.data.parts);
  const stock = useDemo((s) => s.data.stock);
  const [partId, setPartId] = useState(parts[0]?.id ?? "");

  const rows = useMemo(() => movements.filter((m) => m.partId === partId).reverse(), [movements, partId]);
  const balance = (m: StockMovement) => {
    const upTo = movements.filter((x) => x.partId === partId && x.branchId === m.branchId);
    const idx = upTo.findIndex((x) => x.id === m.id);
    return upTo.slice(0, idx + 1).reduce((a, x) => a + x.qty, 0);
  };
  const part = parts.find((p) => p.id === partId);
  const levels = stock.filter((s) => s.partId === partId);

  const columns: Column<StockMovement>[] = [
    { header: "Fecha", cell: (m) => formatDate(m.on) },
    { header: "Movimiento", cell: (m) => <Badge tone={TYPE[m.type].tone}>{TYPE[m.type].label}</Badge> },
    { header: "Sede", cell: (m) => BRANCH_NAMES[m.branchId], hideBelow: "md" },
    { header: "Cantidad", align: "right", cell: (m) => <span className={m.qty < 0 ? "text-bad" : "text-ok"}>{m.qty > 0 ? "+" : ""}{m.qty}</span> },
    { header: "Costo unitario", align: "right", cell: (m) => formatCop(m.unitCost), hideBelow: "md" },
    { header: "Saldo de la sede", align: "right", cell: (m) => <span className="font-medium text-ink">{balance(m)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Select aria-label="Repuesto" value={partId} onChange={(e) => setPartId(e.target.value)} className="w-80">
          {parts.map((p) => <option key={p.id} value={p.id}>{p.description}</option>)}
        </Select>
        {part && (
          <p className="text-[13px] text-muted">
            {levels.map((l) => `${BRANCH_NAMES[l.branchId]}: ${l.onHand} a costo promedio ${formatCop(l.avgCost)}`).join("  ")}
          </p>
        )}
      </div>
      <div className="-mx-5"><DataTable caption="Kardex del repuesto" columns={columns} rows={rows} rowKey={(m) => m.id} empty={{ title: "Sin movimientos" }} /></div>
      <p className="text-[13px] text-muted">El saldo es la suma de los movimientos. Ningún movimiento confirmado se edita: un error se corrige con un reverso.</p>
    </div>
  );
}
